let PROFILES = [];
let RADAR_USAGE_BY_ID = {};
let COURSES = [];
let COURSE_IDS_WITH_MODULES = new Set();
let COURSE_ENROLLMENTS_BY_USER = {};
let EXPANDED_COURSE_ROWS = new Set();
let PROGRESS_BY_USER = {};
let LESSON_TITLES_BY_COURSE = {};
let sortKey = 'displayName';
let sortOrder = 'asc';

// Límite diario gratuito de CDLRadar en minutos. Debe coincidir con el límite real
// aplicado por la Edge Function `radar-access` (radar/supabase/functions/radar-access).
const RADAR_FREE_DAILY_LIMIT_MINUTES = 10;

async function refreshUsers() {
  const [profilesResponse, coursesResponse, modulesResponse, enrollmentsResponse, progressResponse, lessonsResponse] = await Promise.all([
    sp.from("profiles").select("*, notas_admin").order("email", { ascending: true }),
    sp.from("courses").select("id, title, bunny_collection_id").eq("active", true).order("title", { ascending: true }),
    sp.from("course_modules").select("course_id"),
    sp.from("course_enrollments").select("user_id, course_id"),
    sp.from("course_progress").select("user_id, course_id, bunny_video_id, last_viewed_at"),
    sp.from("course_lessons").select("course_id, bunny_video_id, title")
  ]);

  PROGRESS_BY_USER = (progressResponse.data || []).reduce((byUser, row) => {
    ((byUser[row.user_id] ||= {})[row.course_id] ||= []).push(row);
    return byUser;
  }, {});
  LESSON_TITLES_BY_COURSE = (lessonsResponse.data || []).reduce((byCourse, lesson) => {
    (byCourse[lesson.course_id] ||= new Map()).set(lesson.bunny_video_id, lesson.title);
    return byCourse;
  }, {});

  PROFILES = profilesResponse.data || [];
  COURSES = coursesResponse.data || [];
  COURSE_IDS_WITH_MODULES = new Set((modulesResponse.data || []).map(module => module.course_id));
  COURSE_ENROLLMENTS_BY_USER = (enrollmentsResponse.data || []).reduce((byUser, enrollment) => {
    if (!byUser[enrollment.user_id]) byUser[enrollment.user_id] = new Set();
    byUser[enrollment.user_id].add(enrollment.course_id);
    return byUser;
  }, {});

  if (coursesResponse.error || modulesResponse.error || enrollmentsResponse.error) {
    console.error('No se pudieron cargar los cursos de Classroom:', coursesResponse.error || modulesResponse.error || enrollmentsResponse.error);
  }
  renderUsers();
}

async function syncClassroomCourse(courseId, courseLabel, button) {
  const originalLabel = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Sincronizando...'; }
  let response;
  let result = {};
  try {
    const { data: { session } } = await sp.auth.getSession();
    response = await fetch(CONFIG.classroomSyncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ course_id: courseId })
    });
    result = await response.json().catch(() => ({}));
  } catch (error) {
    result = { error: error.message, code: 'network_error' };
  }
  if (button) { button.disabled = false; button.textContent = originalLabel; }

  if (!response?.ok) {
    const reason = [result.code, result.error, result.detail].filter(Boolean).join(' · ') || 'Error desconocido';
    console.error(`classroom-sync ${courseId}:`, result);
    Toastify({ text: `No se pudo sincronizar ${courseLabel}: ${reason}`, duration: 9000, backgroundColor: '#e74c3c' }).showToast();
    return false;
  }
  Toastify({ text: `${courseLabel}: ${result.imported || 0} lecciones sincronizadas`, duration: 3000, backgroundColor: '#10b981' }).showToast();
  return true;
}

async function refreshRadarUsage() {
  // Obtener uso del radar de HOY para todos los usuarios
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await sp.from("radar_daily_usage").select("*").eq("usage_date", today);
  console.log('[DEBUG] radar_daily_usage:', { data, error });
  const map = {}; 
  (data || []).forEach(row => { map[row.user_id] = row; });
  RADAR_USAGE_BY_ID = map;
}

function handleSort(key) {
  if (sortKey === key) { sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'; } 
  else { sortKey = key; sortOrder = 'asc'; }
  renderUsers();
}

function renderUsers() {
  const q = (document.getElementById("q").value || "").toLowerCase();
  const planF = document.getElementById("planFilter").value;
  const statF = document.getElementById("statusFilter").value;

  let rows = PROFILES.map(p => {
    const pres = PRESENCE_BY_ID[p.id] || {};
    const online = (pres.online === true) && (Math.abs(Date.now() - new Date(pres.last_seen).getTime()) <= 120000);
    const name = [p.display_name, p.full_name, p.name].find(n => n && String(n).trim() !== "") || p.email.split("@")[0];
    const radarUsage = RADAR_USAGE_BY_ID[p.id] || null;
    return { ...p, displayName: name, online, pres, radarUsage };
  });

  if (q) rows = rows.filter(r => r.email.toLowerCase().includes(q) || r.displayName.toLowerCase().includes(q));
  if (planF !== "all") rows = rows.filter(r => r.plan === planF);
  if (statF !== "all") rows = rows.filter(r => (statF === "online" ? r.online : !r.online));

  rows.sort((a, b) => {
    // Primero ordenar por estado online (ONLINE primero)
    if (a.online !== b.online) {
      return b.online - a.online; // online=true (1) primero que online=false (0)
    }
    // Luego por el sortKey seleccionado
    let valA = a[sortKey], valB = b[sortKey];
    return sortOrder === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
  });

  // Detectar IPs y fingerprints duplicados
  const ipCounts = {};
  const fpCounts = {};
  rows.forEach(r => {
    if (r.pres.ip_address) ipCounts[r.pres.ip_address] = (ipCounts[r.pres.ip_address] || 0) + 1;
    if (r.pres.fingerprint) fpCounts[r.pres.fingerprint] = (fpCounts[r.pres.fingerprint] || 0) + 1;
  });

  document.getElementById("usersTbody").innerHTML = rows.map(u => {
    const nextPlan = u.plan === 'paid' ? 'free' : 'paid';
    const notePreview = u.notas_admin ? (u.notas_admin.substring(0, 50) + (u.notas_admin.length > 50 ? '...' : '')) : 'Añadir nota...';
    const noteEscaped = escapeJS(u.notas_admin || '');
    
    const ipDup = u.pres.ip_address && ipCounts[u.pres.ip_address] > 1;
    const fpDup = u.pres.fingerprint && fpCounts[u.pres.fingerprint] > 1;
    const ipStyle = ipDup ? 'background:#664400; padding:2px 6px; border-radius:4px;' : '';
    const fpStyle = fpDup ? 'background:#660000; padding:2px 6px; border-radius:4px;' : '';
    const ipWarning = ipDup ? ` ⚠️(${ipCounts[u.pres.ip_address]})` : '';
    const fpWarning = fpDup ? ` ⚠️(${fpCounts[u.pres.fingerprint]})` : '';
    
    const blockBtn = u.blocked 
      ? `<button class="btn" style="background:#10b981;" onclick="toggleBlock('${u.id}', false)">✓ Desbloq</button>`
      : `<button class="btn" style="background:#e74c3c;" onclick="toggleBlock('${u.id}', true)">🚫 Bloquear</button>`;
    
    // Calcular uso del radar
      // Visualización de minutos usados en radar (local, seguro, restaurado)
    let radarDisplay = '';
    if (u.plan === 'paid' || u.plan === 'pro') {
      radarDisplay = '<span style="color:#10b981;">∞ Ilimitado</span>';
    } else if (u.radarUsage && typeof u.radarUsage.seconds_used === 'number') {
      const minutesUsed = Math.floor(u.radarUsage.seconds_used / 60);
      const isLimitReached = minutesUsed >= RADAR_FREE_DAILY_LIMIT_MINUTES;
      const warningThreshold = Math.max(1, RADAR_FREE_DAILY_LIMIT_MINUTES - 2);
      const color = isLimitReached ? '#e74c3c' : (minutesUsed >= warningThreshold ? '#f59e0b' : '#94a3b8');
      const icon = isLimitReached ? '🚫' : '⏱️';
      radarDisplay = `<span style="color:${color};">${minutesUsed}/${RADAR_FREE_DAILY_LIMIT_MINUTES} min ${icon}</span>`;
    } else {
      radarDisplay = `<span style="color:#64748b;">— / ${RADAR_FREE_DAILY_LIMIT_MINUTES} min</span>`;
    }

    const enrolledCourseIds = COURSE_ENROLLMENTS_BY_USER[u.id] || new Set();
    const coursesDisplay = COURSES.length
      ? COURSES.map(course => `
          <label class="course-access-option">
            <input type="checkbox" ${enrolledCourseIds.has(course.id) ? 'checked' : ''}
              onchange="setCourseAccess('${u.id}', '${course.id}', this.checked, this)">
            <span>${course.title}</span>
          </label>`).join('')
      : '<span class="course-access-empty">Aún no hay cursos configurados.</span>';
    
    return `
      <tr style="${u.blocked ? 'opacity:0.5; background:#331111;' : ''}">
        <td data-label="Usuario"><div class="user-line"><button class="course-toggle ${EXPANDED_COURSE_ROWS.has(u.id) ? 'open' : ''}" data-course-toggle="${u.id}" onclick="toggleCourseRow('${u.id}')" title="Ver y administrar cursos">▸</button><span class="course-led ${enrolledCourseIds.size ? 'on' : ''}" data-course-led="${u.id}" title="${enrolledCourseIds.size} cursos activos"></span><div><div class="name">${u.displayName}${u.blocked ? ' 🚫' : ''}</div><div class="email">${u.email}</div></div></div></td>
        <td data-label="Teléfono">${u.phone || "—"} <button class="btn" title="Editar teléfono" onclick="openPhoneModal('${u.id}', '${escapeJS(u.displayName)}', '${escapeJS(u.phone || '')}')">✎</button>${u.phone ? ` <button class="btn btn-danger" title="Borrar teléfono" onclick="savePhone('${u.id}', '')">✕</button>` : ''}</td>
        <td data-label="Plan"><span class="pill ${u.plan === 'paid' ? 'pill-paid' : 'pill-free'}" onclick="adminSetPlan('${u.id}','${nextPlan}')">${u.plan || "free"}</span></td>
        <td data-label="Estado"><div class="badge ${u.online ? 'online' : 'offline'}"><span class="dot"></span> ${u.online ? 'ONLINE' : 'OFFLINE'}</div></td>
        <td data-label="Uso Radar">${radarDisplay}</td>
        <td data-label="Historial"><div class="row-actions"><button class="btn btn-primary" onclick="openHistory('${u.id}','${u.email}')">Historial</button><button class="btn" title="Ver como alumno" onclick="openAuditView('${u.id}', '${escapeJS(u.email)}')">Abrir</button></div></td>
        <td data-label="SL Experimental"><label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:${u.experimental_sl_enabled ? '#fbbf24' : '#64748b'};"><input type="checkbox" ${u.experimental_sl_enabled ? 'checked' : ''} onchange="toggleExperimentalSl('${u.id}', this.checked)"> ${u.experimental_sl_enabled ? 'Activo' : 'Inactivo'}</label></td>
        <td data-label="Ubicación">${u.pres.ciudad || "—"}, ${u.pres.pais || "—"}</td>
        <td data-label="IP/Fingerprint"><span style="${ipStyle}">${(u.pres.ip_address || "—").slice(0,15)}${ipWarning}</span><br><small style="${fpStyle}">${(u.pres.fingerprint || "—").slice(0,10)}${fpWarning}</small></td>
        <td data-label="Acción">${blockBtn}</td>
        <td data-label="Notas"><button class="btn-note-view" onclick="openNoteModal('${u.id}', '${escapeJS(u.displayName)}', '${noteEscaped}')" title="${u.notas_admin ? 'Ver/editar nota' : 'Añadir nota'}">${notePreview}</button></td>
      </tr>
      <tr class="course-access-row ${u.blocked ? 'is-blocked' : ''} ${EXPANDED_COURSE_ROWS.has(u.id) ? '' : 'is-collapsed'}" id="course-row-${u.id}">
        <td colspan="11">
          <div class="course-access-line">
            <strong>La Classroom</strong>
            <span class="course-access-help">Marca los cursos que este alumno puede ver.</span>
            <div class="course-access-options">${coursesDisplay}</div>
          </div>
          ${progressSummary(u.id, enrolledCourseIds)}
        </td>
      </tr>`;
  }).join("");
}

async function setCourseAccess(userId, courseId, shouldGrant, checkbox) {
  checkbox.disabled = true;
  const { error } = await sp.rpc('admin_set_course_access', {
    target_user_id: userId,
    target_course_id: courseId,
    should_grant: shouldGrant
  });

  if (error) {
    checkbox.checked = !shouldGrant;
    Toastify({ text: `No se pudo guardar el curso: ${error.message}`, duration: 4000, backgroundColor: '#e74c3c' }).showToast();
    checkbox.disabled = false;
    return;
  }

  if (!COURSE_ENROLLMENTS_BY_USER[userId]) COURSE_ENROLLMENTS_BY_USER[userId] = new Set();
  if (shouldGrant) {
    COURSE_ENROLLMENTS_BY_USER[userId].add(courseId);
  } else {
    COURSE_ENROLLMENTS_BY_USER[userId].delete(courseId);
  }
  updateCourseLed(userId);

  Toastify({
    text: shouldGrant ? 'Curso activado para el alumno' : 'Curso retirado del alumno',
    duration: 2000,
    backgroundColor: shouldGrant ? '#10b981' : '#475569'
  }).showToast();
  checkbox.disabled = false;

  // Importa las lecciones al activar, para que el alumno las encuentre listas.
  const grantedCourse = COURSES.find(course => course.id === courseId);
  if (shouldGrant && (grantedCourse?.bunny_collection_id || COURSE_IDS_WITH_MODULES.has(courseId))) {
    syncClassroomCourse(courseId, grantedCourse.title, null);
  }
}

function escapeHtmlText(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function timeAgo(isoDate) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 1440) return `hace ${Math.round(minutes / 60)} h`;
  return `hace ${Math.round(minutes / 1440)} d`;
}

function progressSummary(userId, enrolledCourseIds) {
  const lines = COURSES.filter((course) => enrolledCourseIds.has(course.id)).map((course) => {
    const titles = LESSON_TITLES_BY_COURSE[course.id];
    const rows = ((PROGRESS_BY_USER[userId] || {})[course.id] || []).filter((row) => !titles || titles.has(row.bunny_video_id));
    const last = rows.reduce((best, row) => (!best || row.last_viewed_at > best.last_viewed_at ? row : best), null);
    const lastTitle = last ? escapeHtmlText((titles?.get(last.bunny_video_id) || '').replace(/\.(mp4|m4v|mov|mkv|webm)$/i, '')) : '';
    const detail = last ? `Última: ${lastTitle} · ${timeAgo(last.last_viewed_at)}` : 'Sin empezar';
    return `<div class="course-progress-line"><strong>${escapeHtmlText(course.title)}</strong><span>${rows.length} de ${titles ? titles.size : 0} vistas</span><span>${detail}</span></div>`;
  });
  return lines.length ? `<div class="course-progress">${lines.join('')}</div>` : '';
}

function toggleCourseRow(userId) {
  const open = !EXPANDED_COURSE_ROWS.has(userId);
  if (open) EXPANDED_COURSE_ROWS.add(userId); else EXPANDED_COURSE_ROWS.delete(userId);
  document.getElementById(`course-row-${userId}`)?.classList.toggle('is-collapsed', !open);
  document.querySelector(`[data-course-toggle="${userId}"]`)?.classList.toggle('open', open);
}

function updateCourseLed(userId) {
  const count = (COURSE_ENROLLMENTS_BY_USER[userId] || new Set()).size;
  const led = document.querySelector(`[data-course-led="${userId}"]`);
  if (!led) return;
  led.classList.toggle('on', count > 0);
  led.title = `${count} cursos activos`;
}

let phoneEditingUserId = null;

function openPhoneModal(userId, name, phone) {
  phoneEditingUserId = userId;
  document.getElementById('phoneModalUser').textContent = name;
  const input = document.getElementById('phoneInput');
  input.value = phone;
  document.getElementById('modalPhone').style.display = 'flex';
  setTimeout(() => input.focus(), 50);
}

function closePhoneModal() {
  document.getElementById('modalPhone').style.display = 'none';
}

async function savePhone(userId, value) {
  const { error } = await sp.from('profiles').update({ phone: value.trim() || null }).eq('id', userId);
  if (error) {
    Toastify({ text: `No se pudo guardar el teléfono: ${error.message}`, duration: 5000, backgroundColor: '#e74c3c' }).showToast();
    return false;
  }
  Toastify({ text: value.trim() ? 'Teléfono actualizado' : 'Teléfono borrado', duration: 2000, backgroundColor: '#10b981' }).showToast();
  refreshUsers();
  return true;
}

document.getElementById('savePhoneBtn').onclick = async () => {
  if (await savePhone(phoneEditingUserId, document.getElementById('phoneInput').value)) closePhoneModal();
};
document.getElementById('clearPhoneBtn').onclick = async () => {
  if (await savePhone(phoneEditingUserId, '')) closePhoneModal();
};
document.getElementById('phoneInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') document.getElementById('savePhoneBtn').click();
  if (event.key === 'Escape') closePhoneModal();
});

async function openAuditView(userId, email) {
  try {
    const { data: { session } } = await sp.auth.getSession();
    const response = await fetch(CONFIG.adminAuditLoginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ target_user_id: userId })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.portal_url || !result.token_hash) throw new Error(result.error || 'No se pudo abrir la cuenta');
    const auditUrl = new URL(result.portal_url);
    auditUrl.searchParams.set('audit_token_hash', result.token_hash);
    try {
      await navigator.clipboard.writeText(auditUrl.toString());
      Toastify({ text: `Enlace de ${email} copiado. Abre incógnito (Ctrl+Shift+N) y pégalo.`, duration: 6000, backgroundColor: '#10b981' }).showToast();
    } catch (clipboardError) {
      const field = document.createElement('input');
      field.readOnly = true;
      field.value = auditUrl.toString();
      field.style.cssText = 'width:260px;margin-top:6px;padding:6px;border-radius:6px;border:0;color:#000;';
      field.onfocus = () => field.select();
      const box = document.createElement('div');
      box.textContent = 'No se pudo copiar solo. Copia el enlace (Ctrl+C):';
      box.appendChild(field);
      Toastify({ node: box, duration: -1, close: true, backgroundColor: '#475569' }).showToast();
      field.focus();
    }
  } catch (error) {
    Toastify({ text: `No se pudo preparar el acceso: ${error.message}`, duration: 5000, backgroundColor: '#e74c3c' }).showToast();
  }
}

async function adminSetPlan(uId, plan) {
  const { data: { session } } = await sp.auth.getSession();
  const res = await fetch(CONFIG.edgeSetPlanUrl, { 
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` }, 
    body: JSON.stringify({ action: "set_plan", target_user_id: uId, plan }) 
  });
  if (res.ok) { 
    Toastify({ text: "Plan actualizado", duration: 2000, backgroundColor: "#10b981" }).showToast();
    // 🕵️ Registrar cambio de plan por admin
    try {
      await sp.from("audit_events").insert({
        user_id: uId,
        event_type: "Cambio de plan (Admin)",
        metadata: { 
          new_plan: plan, 
          admin_user: session.user.email,
          timestamp: new Date().toISOString() 
        },
        created_at: new Date().toISOString()
      });
    } catch(e) { console.log("Audit log:", e); }
    refreshUsers(); 
  }
}

async function toggleExperimentalSl(uId, enabled) {
  const action = enabled ? 'activar' : 'desactivar';
  if (!confirm(`¿Quieres ${action} el SL experimental para este usuario?`)) {
    refreshUsers();
    return;
  }

  const { error } = await sp.from("profiles").update({ experimental_sl_enabled: enabled }).eq("id", uId);
  if (error) {
    Toastify({ text: "Error: " + error.message, duration: 3000, backgroundColor: "#e74c3c" }).showToast();
    refreshUsers();
    return;
  }

  try {
    const { data: { session } } = await sp.auth.getSession();
    await sp.from("audit_events").insert({
      user_id: uId,
      event_type: "SL experimental (Admin)",
      metadata: { enabled, admin_user: session?.user.email, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString()
    });
  } catch (auditError) {
    console.log("Audit log:", auditError);
  }

  Toastify({ text: enabled ? "SL experimental activado" : "SL experimental desactivado", duration: 2000, backgroundColor: "#10b981" }).showToast();
  refreshUsers();
}

async function toggleBlock(uId, block) {
  const action = block ? 'bloquear' : 'desbloquear';
  if (!confirm(`¿Estás seguro de ${action} este usuario?`)) return;
  
  const { error } = await sp.from("profiles").update({ blocked: block }).eq("id", uId);
  
  if (error) {
    Toastify({ text: "Error: " + error.message, duration: 3000, backgroundColor: "#e74c3c" }).showToast();
  } else {
    Toastify({ 
      text: block ? "Usuario bloqueado 🚫" : "Usuario desbloqueado ✓", 
      duration: 2000, 
      backgroundColor: block ? "#e74c3c" : "#10b981" 
    }).showToast();
    
    // Registrar acción
    try {
      const { data: { session } } = await sp.auth.getSession();
      await sp.from("audit_events").insert({
        user_id: uId,
        event_type: block ? "Usuario bloqueado (Admin)" : "Usuario desbloqueado (Admin)",
        metadata: { 
          admin_user: session.user.email,
          timestamp: new Date().toISOString() 
        },
        created_at: new Date().toISOString()
      });
    } catch(e) { console.log("Audit log:", e); }
    
    refreshUsers(); 
  }
}

