import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const bunnyApiKey = Deno.env.get("BUNNY_STREAM_API_KEY") || "";
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const ALLOWED_ORIGINS = new Set([
  "https://condinerolibre.com",
  "https://www.condinerolibre.com",
  "http://localhost:8888",
  "http://127.0.0.1:5500"
]);

// Bunny video status 3 = transcoding (already playable), 4 = finished.
const PLAYABLE_STATUSES = new Set([3, 4]);
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://condinerolibre.com",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Vary": "Origin",
    "Content-Type": "application/json"
  };
}

type Lesson = {
  course_id: string;
  module_id: string | null;
  title: string;
  bunny_video_id: string;
  duration_seconds: number;
  position: number;
  published: boolean;
};

async function fetchBunnyVideos(libraryId: number, collectionId: string) {
  const videos: Record<string, unknown>[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(`https://video.bunnycdn.com/library/${libraryId}/videos`);
    url.searchParams.set("collection", collectionId);
    url.searchParams.set("page", String(page));
    url.searchParams.set("itemsPerPage", String(PAGE_SIZE));
    const res = await fetch(url, { headers: { AccessKey: bunnyApiKey, Accept: "application/json" } });
    if (!res.ok) return { error: { status: res.status, detail: (await res.text()).slice(0, 300) } };

    const payload = await res.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    videos.push(...items);
    if (videos.length >= Number(payload?.totalItems || 0) || items.length < PAGE_SIZE) break;
  }
  return { videos };
}

serve(async (request) => {
  const headers = corsHeaders(request);
  const reply = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });

  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed", code: "method_not_allowed" }, 405);

  try {
    const token = (request.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!token) return reply({ error: "Unauthorized", code: "unauthorized" }, 401);

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Unauthorized", code: "unauthorized" }, 401);
    const userId = authData.user.id;

    const body = await request.json().catch(() => ({}));
    const courseId = typeof body?.course_id === "string" ? body.course_id : "";
    if (!courseId) return reply({ error: "Missing course_id", code: "bad_request" }, 400);

    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id, active, bunny_library_id, bunny_collection_id")
      .eq("id", courseId)
      .maybeSingle();
    if (!course || !course.active) return reply({ error: "Course not found", code: "course_not_found" }, 404);

    const { data: adminUser } = await supabaseAdmin
      .from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
    const isAdmin = !!adminUser;

    if (!isAdmin) {
      const { data: enrollment } = await supabaseAdmin
        .from("course_enrollments").select("course_id")
        .eq("user_id", userId).eq("course_id", courseId).maybeSingle();
      if (!enrollment) {
        const { data: hasAcademy } = await supabaseAdmin.rpc("academy_has_access", { target_user: userId });
        const canImportPublicPreview = course.active;
        // An active course may be imported by a visitor who is opening its free preview.
        // The course_lessons RLS policies still limit playback to the preview entitlement.
        if (hasAcademy !== true && !canImportPublicPreview) return reply({ error: "Forbidden", code: "forbidden" }, 403);
      }
    }

    const { count, error: countError } = await supabaseAdmin
      .from("course_lessons").select("id", { count: "exact", head: true }).eq("course_id", courseId);
    if (countError) {
      console.error("course_lessons count failed:", countError);
      return reply({ error: "Lessons table is not available", code: "lessons_table_error" }, 500);
    }
    // Students only trigger a first import; admins can force a refresh.
    if (!isAdmin && (count || 0) > 0) return reply({ ok: true, cached: true, imported: count, course_id: courseId });

    if (!bunnyApiKey) return reply({ error: "BUNNY_STREAM_API_KEY is not configured", code: "bunny_key_missing" }, 500);

    if (!course.bunny_library_id) {
      return reply({ error: "Course has no Bunny collection configured", code: "course_not_configured" }, 400);
    }

    const { data: modules, error: modulesError } = await supabaseAdmin
      .from("course_modules")
      .select("id, title, position, bunny_collection_id")
      .eq("course_id", course.id)
      .order("position");
    if (modulesError && !course.bunny_collection_id) {
      return reply({ error: "Course modules are not available", code: "modules_table_error" }, 500);
    }
    if (modulesError) console.warn("Course modules are not available; using the course collection:", modulesError);

    const sources = !modulesError && (modules || []).length > 0
      ? modules
      : course.bunny_collection_id
        ? [{ id: null, title: "", position: 1, bunny_collection_id: course.bunny_collection_id }]
        : [];
    if (sources.length === 0) {
      return reply({ error: "Course has no Bunny collection configured", code: "course_not_configured" }, 400);
    }

    const lessons: Lesson[] = [];
    let bunnyTotal = 0;
    for (const source of sources) {
      const result = await fetchBunnyVideos(Number(course.bunny_library_id), source.bunny_collection_id);
      if (result.error) {
        console.error("Bunny request failed:", result.error);
        const code = result.error.status === 401 || result.error.status === 403 ? "bunny_unauthorized" : "bunny_error";
        return reply({
          error: code === "bunny_unauthorized"
            ? "Bunny rejected the API key. Use the API key of library " + course.bunny_library_id
            : `Bunny could not return the videos for ${source.title || "the course"}`,
          code,
          bunny_status: result.error.status,
          ...(isAdmin ? { detail: result.error.detail } : {})
        }, 502);
      }

      const videos = result.videos || [];
      bunnyTotal += videos.length;
      const playableVideos = videos
        .filter((video) => video.guid && video.title && PLAYABLE_STATUSES.has(Number(video.status)))
        .sort((a, b) => String(a.title).localeCompare(String(b.title), "es", { numeric: true, sensitivity: "base" }));
      lessons.push(...playableVideos.map((video, index) => ({
        course_id: course.id,
        module_id: source.id,
        title: String(video.title),
        bunny_video_id: String(video.guid),
        duration_seconds: Math.round(Number(video.length) || 0),
        position: index + 1,
        published: true
      })));
    }

    // An empty or still-processing collection must never wipe lessons that already exist.
    if (lessons.length === 0) {
      return reply({
        error: bunnyTotal === 0 ? "The Bunny collections have no videos" : "The Bunny videos are still processing",
        code: bunnyTotal === 0 ? "collection_empty" : "videos_processing",
        bunny_total: bunnyTotal
      }, 422);
    }

    // Keep unchanged lessons (stable ids); replace only rows that differ, then insert the rest.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("course_lessons").select("id, bunny_video_id, title, position, duration_seconds, module_id").eq("course_id", course.id);
    if (existingError) return reply({ error: existingError.message, code: "lessons_read_error" }, 500);

    const wanted = new Map(lessons.map((lesson) => [lesson.bunny_video_id, lesson]));
    const unchangedVideoIds = new Set<string>();
    const staleIds: string[] = [];
    for (const row of existing || []) {
      const lesson = wanted.get(row.bunny_video_id);
      const same = lesson && lesson.module_id === row.module_id && lesson.position === row.position &&
        lesson.title === row.title && lesson.duration_seconds === row.duration_seconds;
      if (same) unchangedVideoIds.add(row.bunny_video_id); else staleIds.push(row.id);
    }

    if (staleIds.length > 0) {
      const { error: deleteError } = await supabaseAdmin.from("course_lessons").delete().in("id", staleIds);
      if (deleteError) return reply({ error: deleteError.message, code: "lessons_delete_error" }, 500);
    }
    const toInsert = lessons.filter((lesson) => !unchangedVideoIds.has(lesson.bunny_video_id));
    if (toInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin.from("course_lessons").insert(toInsert);
      if (insertError) return reply({ error: insertError.message, code: "lessons_insert_error" }, 500);
    }

    return reply({
      ok: true,
      imported: lessons.length,
      skipped_unplayable: bunnyTotal - lessons.length,
      modules: sources.length,
      course_id: course.id
    });
  } catch (error) {
    console.error("classroom-sync failed:", error);
    return reply({ error: "Internal error", code: "internal_error" }, 500);
  }
});