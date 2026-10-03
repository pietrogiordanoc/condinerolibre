import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const bunnyApiKey = Deno.env.get("BUNNY_STREAM_API_KEY") || "";
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://condinerolibre.com",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json"
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const token = (request.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!token) return response({ error: "Unauthorized" }, 401);

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return response({ error: "Unauthorized" }, 401);

  const { data: adminUser } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!adminUser) return response({ error: "Forbidden" }, 403);
  if (!bunnyApiKey) return response({ error: "BUNNY_STREAM_API_KEY is not configured" }, 500);

  const { course_id: courseId } = await request.json().catch(() => ({}));
  if (!courseId) return response({ error: "Missing course_id" }, 400);

  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .select("id, bunny_library_id, bunny_collection_id")
    .eq("id", courseId)
    .maybeSingle();
  if (courseError || !course?.bunny_library_id || !course.bunny_collection_id) {
    return response({ error: "Course does not have a Bunny library and collection configured" }, 400);
  }

  const bunnyUrl = new URL(`https://video.bunnycdn.com/library/${course.bunny_library_id}/videos`);
  bunnyUrl.searchParams.set("collection", course.bunny_collection_id);
  bunnyUrl.searchParams.set("page", "1");
  bunnyUrl.searchParams.set("itemsPerPage", "100");
  bunnyUrl.searchParams.set("orderBy", "date");
  const bunnyResponse = await fetch(bunnyUrl, { headers: { AccessKey: bunnyApiKey } });
  if (!bunnyResponse.ok) {
    return response({ error: "Bunny could not return the collection videos", detail: await bunnyResponse.text() }, 502);
  }

  const bunnyPayload = await bunnyResponse.json();
  const videos = Array.isArray(bunnyPayload?.items) ? bunnyPayload.items : [];
  const lessons = videos
    .filter((video) => video?.guid && video?.title)
    .reverse()
    .map((video, index) => ({
      course_id: course.id,
      title: video.title,
      bunny_video_id: video.guid,
      duration_seconds: Math.round(Number(video.length) || 0),
      position: index + 1,
      published: true
    }));

  const { error: deleteError } = await supabaseAdmin.from("course_lessons").delete().eq("course_id", course.id);
  if (deleteError) return response({ error: deleteError.message }, 500);
  if (lessons.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("course_lessons").insert(lessons);
    if (insertError) return response({ error: insertError.message }, 500);
  }

  return response({ ok: true, imported: lessons.length, course_id: course.id });
});