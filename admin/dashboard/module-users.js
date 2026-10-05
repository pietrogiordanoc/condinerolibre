let PROFILES = [];
let RADAR_USAGE_BY_ID = {};
let COURSES = [];
let COURSE_IDS_WITH_MODULES = new Set();
let COURSE_ENROLLMENTS_BY_USER = {};
let EXPANDED_COURSE_ROWS = new Set();
let PROGRESS_BY_USER = {};
let LESSONS_BY_COURSE = {};
let LESSON_INDEX_BY_COURSE = {};
let SESSIONS_BY_USER_COURSE = {};
let ACADEMY_BY_USER = {};
let MODULE_POSITION_BY_ID = {};
let EXPANDED_DETAIL = new Set();
let sortKey = 'displayName';
let sortOrder = 'asc';
let MOBILE_USER_ROWS_BY_ID = new Map();
let MOBILE_USER_DETAIL_ID = null;

// Límite diario gratuito de CDLRadar en minutos. Debe coincidir con el límite real
// aplicado por la Edge Function `radar-access` (radar/supabase/functions/radar-access).
const RADAR_FREE_DAILY_LIMIT_MINUTES = 10;
const COMMERCIAL_TIERS = {
  freemium: { label: 'CDL Freemium', description: 'Radar Free · 10 min/día', rank: 1, className: 'tier-freemium' },
  'freemium-class': { label: 'CDL Freemium Class', description: 'Radar Free + cursos individuales', rank: 2, className: 'tier-freemium-class' },
  premium: { label: 'CDL Premium', description: 'Radar Pro · sin cursos', rank: 3, className: 'tier-premium' },
  'premium-class': { label: 'CDL Premium Class', description: 'Radar Pro + cursos individuales', rank: 4, className: 'tier-premium-class' },
  ultra: { label: 'CDL Ultra', description: 'Radar Pro + Classroom completo', rank: 5, className: 'tier-ultra' }
};

function commercialTierFor(userId, plan) {
  if (academyHasAccess(userId)) return { id: 'ultra', ...COMMERCIAL_TIERS.ultra };

  const hasRadarPro = plan === 'paid' || plan === 'pro';
  const hasIndividualCourses = (COURSE_ENROLLMENTS_BY_USER[userId] || new Set()).size > 0;
  if (hasRadarPro) return hasIndividualCourses
    ? { id: 'premium-class', ...COMMERCIAL_TIERS['premium-class'] }
    : { id: 'premium', ...COMMERCIAL_TIERS.premium };
  return hasIndividualCourses
    ? { id: 'freemium-class', ...COMMERCIAL_TIERS['freemium-class'] }
    : { id: 'freemium', ...COMMERCIAL_TIERS.freemium };
}

async function fetchAllRows(buildQuery) {
  const rows = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await buildQuery().range(from, from + 999);
    if (error) return { data: rows, error };
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return { data: rows, error: null };
}

async function loadProgressRows() {
  const full = await fetchAllRows(() => sp.from("course_progress")
    .select("user_id, course_id, bunny_video_id, first_viewed_at, last_viewed_at, duration_seconds, watched_seconds, furthest_seconds, last_position_seconds, watched_ranges, completed_at")
    .order("user_id").order("bunny_video_id"));
  if (!full.error) return full;
  // Sin el SQL de seguimiento solo hay progreso básico (lección abierta).
  return fetchAllRows(() => sp.from("course_progress")
    .select("user_id, course_id, bunny_video_id, first_viewed_at, last_viewed_at")
    .order("user_id").order("bunny_video_id"));
}

function loadSessionRows() {
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  return fetchAllRows(() => sp.from("course_sessions")
    .select("id, user_id, course_id, started_at, seconds_watched")
    .gte("started_at", since)
    .order("started_at", { ascending: false }).order("id"));
}

async function refreshUsers() {
  // Devuelve el plan previo a quien canceló y ya agotó su periodo pagado (ignora errores si el SQL no existe).
  await sp.rpc("academy_expire_overdue").then(() => {}, () => {});
  const profilesPromise = sp.from("profiles").select("*, notas_admin").order("email", { ascending: true });
  const userDetailsPromise = Promise.all([
    sp.from("courses").select("id, title, bunny_collection_id").eq("active", true).order("title", { ascending: true }),
    sp.from("course_modules").select("id, course_id, position"),
    sp.from("course_enrollments").select("user_id, course_id"),
    loadProgressRows(),
    fetchAllRows(() => sp.from("course_lessons").select("id, course_id, module_id, position, bunny_video_id, title, duration_seconds").order("id")),
    loadSessionRows(),
    sp.from("academy_subscriptions").select("user_id, status, access_until, paypal_subscription_id, activated_at")
  ]);
  const profilesResponse = await profilesPromise;

  if (profilesResponse.error) {
    console.error('No se pudieron cargar los usuarios:', profilesResponse.error);
    document.getElementById("usersTbody").innerHTML = '<tr><td colspan="11" style="padding:24px; color:#fca5a5; text-align:center;">No se pudieron cargar los usuarios. Comprueba la conexión e inténtalo de nuevo.</td></tr>';
    Toastify({ text: `No se pudieron cargar los usuarios: ${profilesResponse.error.message}`, duration: 7000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }

  PROFILES = profilesResponse.data || [];
  renderUsers();

  const [coursesResponse, modulesResponse, enrollmentsResponse, progressResponse, lessonsResponse, sessionsResponse, academyResponse] = await userDetailsPromise;
  ACADEMY_BY_USER = Object.fromEntries((academyResponse.data || []).map((row) => [row.user_id, row]));

  PROGRESS_BY_USER = (progressResponse.data || []).reduce((byUser, row) => {
    ((byUser[row.user_id] ||= {})[row.course_id] ||= []).push(row);
    return byUser;
  }, {});
  MODULE_POSITION_BY_ID = Object.fromEntries((modulesResponse.data || []).map((module) => [module.id, module.position]));
  const lessonsByCourse = {};
  (lessonsResponse.data || []).forEach((lesson) => {
    (lessonsByCourse[lesson.course_id] ||= []).push({
      videoId: lesson.bunny_video_id, title: lesson.title, duration: lesson.duration_seconds || 0,
      order: (MODULE_POSITION_BY_ID[lesson.module_id] ?? 0) * 100000 + lesson.position
    });
  });
  LESSONS_BY_COURSE = {};
  LESSON_INDEX_BY_COURSE = {};
  Object.entries(lessonsByCourse).forEach(([courseId, lessons]) => {
    lessons.sort((a, b) => a.order - b.order);
    LESSONS_BY_COURSE[courseId] = lessons;
    LESSON_INDEX_BY_COURSE[courseId] = new Map(lessons.map((lesson) => [lesson.videoId, lesson]));
  });
  SESSIONS_BY_USER_COURSE = {};
  (sessionsResponse.data || []).forEach((session) => {
    (SESSIONS_BY_USER_COURSE[`${session.user_id}|${session.course_id}`] ||= [])
      .push({ t: new Date(session.started_at).getTime(), seconds: session.seconds_watched || 0 });
  });

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
  const tierF = document.getElementById("tierFilter").value;
  const statF = document.getElementById("statusFilter").value;

  let rows = PROFILES.map(p => {
    const pres = PRESENCE_BY_ID[p.id] || {};
    const online = (pres.online === true) && (Math.abs(Date.now() - new Date(pres.last_seen).getTime()) <= 120000);
    const name = [p.display_name, p.full_name, p.name].find(n => n && String(n).trim() !== "") || p.email.split("@")[0];
    const radarUsage = RADAR_USAGE_BY_ID[p.id] || null;
    const tier = commercialTierFor(p.id, p.plan);
    const hasRadarPro = p.plan === 'paid' || p.plan === 'pro';
    return {
      ...p,
      displayName: name,
      online,
      pres,
      radarUsage,
      tier,
      tierRank: tier.rank,
      phoneSort: p.phone || '',
      radarUsageSort: hasRadarPro ? Number.MAX_SAFE_INTEGER : (radarUsage?.seconds_used || 0),
      blockedSort: p.blocked ? 1 : 0,
      noteSort: p.notas_admin || '',
      location: `${pres.ciudad || ''}, ${pres.pais || ''}`
    };
  });

  if (q) rows = rows.filter(r => r.email.toLowerCase().includes(q) || r.displayName.toLowerCase().includes(q));
  if (tierF !== "all") rows = rows.filter(r => r.tier.id === tierF);
  if (statF !== "all") rows = rows.filter(r => (statF === "online" ? r.online : !r.online));

  rows.sort((a, b) => {
    // Primero ordenar por estado online (ONLINE primero)
    if (a.online !== b.online) {
      return b.online - a.online; // online=true (1) primero que online=false (0)
    }
    // Luego por el sortKey seleccionado
    const valA = a[sortKey] ?? '', valB = b[sortKey] ?? '';
    const comparison = typeof valA === 'number' && typeof valB === 'number'
      ? valA - valB
      : String(valA).localeCompare(String(valB), 'es', { numeric: true });
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Detectar IPs y fingerprints duplicados
  const ipCounts = {};
  const fpCounts = {};
  rows.forEach(r => {
    if (r.pres.ip_address) ipCounts[r.pres.ip_address] = (ipCounts[r.pres.ip_address] || 0) + 1;
    if (r.pres.fingerprint) fpCounts[r.pres.fingerprint] = (fpCounts[r.pres.fingerprint] || 0) + 1;
  });
  MOBILE_USER_ROWS_BY_ID = new Map(rows.map((row) => [row.id, row]));
  renderMobileUserList(rows, ipCounts, fpCounts);

  document.getElementById("usersTbody").innerHTML = rows.map(u => {
    const hasRadarPro = u.plan === 'paid' || u.plan === 'pro';
    const nextPlan = hasRadarPro ? 'free' : 'paid';
    const notePreview = u.notas_admin ? (u.notas_admin.substring(0, 50) + (u.notas_admin.length > 50 ? '...' : '')) : 'Añadir nota...';
    const noteEscaped = escapeJS(u.notas_admin || '');
    
    const ipDup = u.pres.ip_address && ipCounts[u.pres.ip_address] > 1;
    const fpDup = u.pres.fingerprint && fpCounts[u.pres.fingerprint] > 1;
    const ipStyle = ipDup ? 'background:#664400; padding:2px 6px; border-radius:4px;' : '';
    const fpStyle = fpDup ? 'background:#660000; padding:2px 6px; border-radius:4px;' : '';
    const ipWarning = ipDup ? ` ⚠️(${ipCounts[u.pres.ip_address]})` : '';
    const fpWarning = fpDup ? ` ⚠️(${fpCounts[u.pres.fingerprint]})` : '';
    
    const blockBtn = u.blocked 
      ? `<button class="row-action row-action-positive" type="button" onclick="toggleBlock('${u.id}', false)" title="Desbloquear usuario"><span aria-hidden="true">✓</span> Desbloquear</button>`
      : `<button class="row-action row-action-danger" type="button" onclick="toggleBlock('${u.id}', true)" title="Bloquear usuario"><span aria-hidden="true">⊘</span> Bloquear</button>`;
    
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

    const ownCourseIds = COURSE_ENROLLMENTS_BY_USER[u.id] || new Set();
    const academyOn = academyHasAccess(u.id);
    const enrolledCourseIds = academyOn ? new Set([...ownCourseIds, ...COURSES.map(course => course.id)]) : ownCourseIds;
    const radarControl = u.tier.id === 'ultra'
      ? '<span class="tier-radar-included">Radar Pro incluido</span>'
      : `<button type="button" class="row-action row-action-quiet tier-radar-toggle" onclick="adminSetPlan('${u.id}', '${nextPlan}')" title="Cambiar solo el acceso a CDLRadar">Radar: ${hasRadarPro ? 'Pro' : 'Free'}</button>`;
    const coursesDisplay = COURSES.length
      ? COURSES.map(course => {
          const enrolled = enrolledCourseIds.has(course.id);
          const viaAcademy = academyOn && !ownCourseIds.has(course.id);
          const started = enrolled && courseProgressStats(u.id, course).seen > 0;
          return `
          <div class="course-block">
          <div class="course-row ${started ? '' : 'is-idle'}">
            <label class="course-access-option">
              <input type="checkbox" ${enrolled ? 'checked' : ''} ${viaAcademy ? 'disabled' : ''}
                onchange="setCourseAccess('${u.id}', '${course.id}', this.checked, this)">
              <span>${course.title}${viaAcademy ? ' <small style="color:#f59e0b">(por suscripción)</small>' : ''}</span>
            </label>
            <div class="course-metrics">${enrolled ? courseMetrics(u.id, course) : '<span class="course-metrics-empty">Sin acceso</span>'}</div>
          </div>
          ${enrolled && EXPANDED_DETAIL.has(`${u.id}|${course.id}`) ? lessonDetail(u.id, course) : ''}
          </div>`;
        }).join('')
      : '<span class="course-access-empty">Aún no hay cursos configurados.</span>';
    
    return `
      <tr style="${u.blocked ? 'opacity:0.5; background:#331111;' : ''}">
        <td data-label="Usuario"><div class="user-line"><button class="course-toggle ${EXPANDED_COURSE_ROWS.has(u.id) ? 'open' : ''}" data-course-toggle="${u.id}" onclick="toggleCourseRow('${u.id}')" title="Ver y administrar cursos">▸</button><span class="course-led ${enrolledCourseIds.size ? 'on' : ''}" data-course-led="${u.id}" title="${enrolledCourseIds.size} cursos activos"></span>${progressBadge(u.id, enrolledCourseIds)}<div><div class="name">${u.displayName}${u.blocked ? ' 🚫' : ''}</div><div class="email">${u.email}</div></div></div></td>
        <td data-label="Teléfono"><span class="phone-value">${u.phone || "—"}</span><span class="phone-actions"><button class="icon-action" type="button" aria-label="Editar teléfono de ${escapeJS(u.displayName)}" title="Editar teléfono" onclick="openPhoneModal('${u.id}', '${escapeJS(u.displayName)}', '${escapeJS(u.phone || '')}')">✎</button>${u.phone ? `<button class="icon-action icon-action-danger" type="button" aria-label="Borrar teléfono de ${escapeJS(u.displayName)}" title="Borrar teléfono" onclick="savePhone('${u.id}', '')">×</button>` : ''}</span></td>
        <td data-label="Nivel"><div class="tier-cell"><span class="pill tier-pill ${u.tier.className}">${u.tier.label}</span><small>${u.tier.description}</small>${radarControl}</div></td>
        <td data-label="Estado"><div class="badge ${u.online ? 'online' : 'offline'}"><span class="dot"></span> ${u.online ? 'ONLINE' : 'OFFLINE'}</div></td>
        <td data-label="Uso Radar">${radarDisplay}</td>
        <td data-label="Historial"><div class="row-actions"><button class="row-action row-action-primary" type="button" onclick="openHistory('${u.id}','${u.email}')">Historial</button><button class="row-action" type="button" title="Ver como alumno" onclick="openAuditView('${u.id}', '${escapeJS(u.email)}')">Abrir</button></div></td>
        <td data-label="SL Experimental"><label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:${u.experimental_sl_enabled ? '#fbbf24' : '#64748b'};"><input type="checkbox" ${u.experimental_sl_enabled ? 'checked' : ''} onchange="toggleExperimentalSl('${u.id}', this.checked)"> ${u.experimental_sl_enabled ? 'Activo' : 'Inactivo'}</label></td>
        <td data-label="Ubicación">${u.pres.ciudad || "—"}, ${u.pres.pais || "—"}</td>
        <td data-label="IP/Fingerprint"><span style="${ipStyle}">${(u.pres.ip_address || "—").slice(0,15)}${ipWarning}</span><br><small style="${fpStyle}">${(u.pres.fingerprint || "—").slice(0,10)}${fpWarning}</small></td>
        <td data-label="Acción">${blockBtn}</td>
        <td data-label="Notas"><button class="btn-note-view" onclick="openNoteModal('${u.id}', '${escapeJS(u.displayName)}', '${noteEscaped}')" title="${u.notas_admin ? 'Ver/editar nota' : 'Añadir nota'}">${notePreview}</button></td>
      </tr>
      <tr class="course-access-row ${u.blocked ? 'is-blocked' : ''} ${EXPANDED_COURSE_ROWS.has(u.id) ? '' : 'is-collapsed'}" id="course-row-${u.id}">
        <td colspan="11">
          <div class="course-access-line">
            ${academyBlock(u.id)}
            <strong>La Classroom</strong>
            <span class="course-access-help">Marca los cursos que este alumno puede ver.</span>
            <div class="course-list">${coursesDisplay}</div>
          </div>
        </td>
      </tr>`;
  }).join("");
}

const ACADEMY_STATUS_LABELS = {
  active: ['Activo', '#10b981'],
  payment_failed: ['Pago fallido (en gracia)', '#f59e0b'],
  cancelled: ['Cancelado', '#f59e0b'],
  suspended: ['Suspendido', '#e74c3c'],
  expired: ['Expirado', '#e74c3c'],
  revoked: ['Revocado', '#e74c3c']
}

function mobileUserDetailItem(label, value) {
  return `<div class="mobile-user-detail-item"><span>${escapeHtmlText(label)}</span><strong>${escapeHtmlText(value || '—')}</strong></div>`;
}

function mobileRadarUsageLabel(user) {
  if (user.plan === 'paid' || user.plan === 'pro') return 'Ilimitado';
  if (typeof user.radarUsage?.seconds_used === 'number') {
    return `${Math.floor(user.radarUsage.seconds_used / 60)}/${RADAR_FREE_DAILY_LIMIT_MINUTES} min hoy`;
  }
  return `—/${RADAR_FREE_DAILY_LIMIT_MINUTES} min hoy`;
}

function renderMobileUserList(rows, ipCounts, fpCounts) {
  const list = document.getElementById('mobileUserList');
  if (!list) return;

  list.innerHTML = rows.length ? rows.map((user) => {
    const hasSharedIdentity = (user.pres.ip_address && ipCounts[user.pres.ip_address] > 1)
      || (user.pres.fingerprint && fpCounts[user.pres.fingerprint] > 1);
    const flags = [
      `<span class="mobile-user-chip ${user.online ? 'is-online' : ''}">${user.online ? 'En línea' : 'Sin conexión'}</span>`,
      user.blocked ? '<span class="mobile-user-chip is-danger">Bloqueado</span>' : '',
      hasSharedIdentity ? '<span class="mobile-user-chip is-warning">Alerta</span>' : ''
    ].join('');
    return `<button class="mobile-user-card" type="button" onclick="openMobileUserDetail('${user.id}')">
      <span class="mobile-user-presence ${user.online ? 'online' : ''}" aria-hidden="true"></span>
      <span class="mobile-user-card-main">
        <span class="mobile-user-card-name">${escapeHtmlText(user.displayName)}</span>
        <span class="mobile-user-card-email">${escapeHtmlText(user.email)}</span>
        <span class="mobile-user-card-meta"><span class="mobile-user-chip">${escapeHtmlText(user.tier.label)}</span>${flags}</span>
      </span>
      <span class="mobile-user-card-arrow" aria-hidden="true">›</span>
    </button>`;
  }).join('') : '<div class="support-messages-empty">No hay usuarios que coincidan con estos filtros.</div>';
}

function renderMobileUserDetail(section = 'summary') {
  const user = MOBILE_USER_ROWS_BY_ID.get(MOBILE_USER_DETAIL_ID);
  if (!user) return;

  const detailSections = {
    summary: {
      label: 'Resumen',
      items: [
        ['Estado', user.online ? 'En línea' : 'Sin conexión'],
        ['Plan', user.tier.label],
        ['Uso del Radar', mobileRadarUsageLabel(user)],
        ['Ubicación', user.location || 'No disponible']
      ]
    },
    access: {
      label: 'Acceso',
      items: [
        ['Radar', user.plan === 'paid' || user.plan === 'pro' ? 'CDLRadar Pro' : 'CDLRadar Free'],
        ['Classroom', academyHasAccess(user.id) ? 'Acceso completo activo' : `${(COURSE_ENROLLMENTS_BY_USER[user.id] || new Set()).size} cursos individuales`],
        ['SL experimental', user.experimental_sl_enabled ? 'Activo' : 'Inactivo'],
        ['Teléfono', user.phone || 'No registrado']
      ]
    },
    activity: {
      label: 'Actividad',
      items: [
        ['Historial', 'Consulta las acciones y eventos registrados'],
        ['Última presencia', user.pres.last_seen ? timeAgo(user.pres.last_seen) : 'No disponible'],
        ['Estado de cuenta', user.blocked ? 'Bloqueada' : 'Activa']
      ]
    },
    security: {
      label: 'Seguridad',
      items: [
        ['IP', user.pres.ip_address || 'No disponible'],
        ['Fingerprint', user.pres.fingerprint || 'No disponible'],
        ['Estado', user.blocked ? 'Usuario bloqueado' : 'Usuario sin bloqueo']
      ]
    }
  };
  const active = detailSections[section] || detailSections.summary;
  const nav = document.getElementById('mobileUserDetailNav');
  const content = document.getElementById('mobileUserDetailContent');
  document.getElementById('mobileUserDetailTitle').textContent = user.displayName;
  nav.innerHTML = Object.entries(detailSections).map(([key, value]) =>
    `<button type="button" class="${key === section ? 'active' : ''}" onclick="showMobileUserDetailSection('${key}')">${value.label}</button>`
  ).join('');
  content.innerHTML = `<div class="mobile-user-detail-grid">${active.items.map(([label, value]) => mobileUserDetailItem(label, value)).join('')}</div>
    <div class="mobile-user-detail-actions">
      ${section === 'activity' ? '<button type="button" class="btn btn-primary" onclick="mobileUserAction(\'history\')">Ver historial</button>' : ''}
      ${section === 'access' ? '<button type="button" class="btn" onclick="mobileUserAction(\'phone\')">Editar teléfono</button>' : ''}
      <button type="button" class="btn" onclick="mobileUserAction('note')">Notas</button>
      <button type="button" class="btn ${user.blocked ? 'btn-primary' : 'btn-danger'}" onclick="mobileUserAction('block')">${user.blocked ? 'Desbloquear' : 'Bloquear'}</button>
    </div>`;
}

window.openMobileUserDetail = function(userId) {
  if (!MOBILE_USER_ROWS_BY_ID.has(userId)) return;
  MOBILE_USER_DETAIL_ID = userId;
  document.getElementById('mobileUserDetail').hidden = false;
  document.body.style.overflow = 'hidden';
  renderMobileUserDetail();
};

window.closeMobileUserDetail = function() {
  document.getElementById('mobileUserDetail').hidden = true;
  document.body.style.overflow = '';
  MOBILE_USER_DETAIL_ID = null;
};

window.showMobileUserDetailSection = function(section) {
  renderMobileUserDetail(section);
};

window.mobileUserAction = function(action) {
  const user = MOBILE_USER_ROWS_BY_ID.get(MOBILE_USER_DETAIL_ID);
  if (!user) return;
  closeMobileUserDetail();
  if (action === 'history') openHistory(user.id, user.email);
  if (action === 'phone') openPhoneModal(user.id, user.displayName, user.phone || '');
  if (action === 'note') openNoteModal(user.id, user.displayName, user.notas_admin || '');
  if (action === 'block') toggleBlock(user.id, !user.blocked);
};

function academyHasAccess(userId) {
  const sub = ACADEMY_BY_USER[userId];
  if (!sub) return false;
  if (sub.status === 'active' || sub.status === 'payment_failed') return true;
  return sub.status === 'cancelled' && !!sub.access_until && new Date(sub.access_until).getTime() > Date.now();
}

function academyBlock(userId) {
  const sub = ACADEMY_BY_USER[userId];
  const on = academyHasAccess(userId);
  const [label, color] = sub ? (ACADEMY_STATUS_LABELS[sub.status] || [sub.status, '#94a3b8']) : ['Sin plan', '#64748b'];
  const until = sub?.status === 'cancelled' && sub.access_until ? ` · hasta ${new Date(sub.access_until).toLocaleDateString('es')}` : '';
  const source = sub?.paypal_subscription_id ? ' · PayPal' : (sub ? ' · manual' : '');
  const button = on
    ? `<button class="row-action row-action-danger" type="button" onclick="setAcademyAccess('${userId}', false)">Revocar</button>`
    : `<button class="row-action row-action-primary" type="button" onclick="setAcademyAccess('${userId}', true)">Activar</button>`;
  return `<div class="academy-line"><strong>CDLRadar + Classroom</strong><span style="color:${color}">${label}${until}${source}</span>${button}</div>`;
}

async function setAcademyAccess(userId, shouldGrant) {
  const { error } = await sp.rpc('admin_set_academy_access', { target_user_id: userId, should_grant: shouldGrant });
  if (error) {
    Toastify({ text: `No se pudo cambiar el plan: ${error.message}`, duration: 5000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  Toastify({ text: shouldGrant ? 'Plan CDLRadar + Classroom activado' : 'Plan CDLRadar + Classroom revocado', duration: 2500, backgroundColor: shouldGrant ? '#10b981' : '#475569' }).showToast();
  await refreshUsers();
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

const COMPLETE_RATIO = 0.9;
const STOP_WORDS_EXT = /\.(mp4|m4v|mov|mkv|webm)$/i;

function fmtDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  return minutes ? `${minutes} min` : `${seconds} s`;
}

function fmtClock(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function fmtDateTime(ms) {
  return new Date(ms).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// none | opened (sin datos de reproducción) | done | skips | partial
function lessonStatus(row, duration) {
  if (!row) return 'none';
  const watched = row.watched_seconds || 0;
  if (row.duration_seconds == null && !watched) return 'opened';
  if (!duration) return 'opened';
  if (row.completed_at || watched / duration >= COMPLETE_RATIO) return 'done';
  if ((row.furthest_seconds || 0) - watched > Math.max(30, duration * 0.15)) return 'skips';
  return 'partial';
}

function courseProgressStats(userId, course) {
  const lessons = LESSONS_BY_COURSE[course.id] || [];
  const index = LESSON_INDEX_BY_COURSE[course.id];
  const rows = ((PROGRESS_BY_USER[userId] || {})[course.id] || []).filter((row) => !index || index.has(row.bunny_video_id));
  const total = lessons.length;
  const totalDuration = lessons.reduce((sum, lesson) => sum + lesson.duration, 0);
  let watched = 0, completed = 0, skipped = 0, tracked = 0;
  rows.forEach((row) => {
    const duration = row.duration_seconds || index?.get(row.bunny_video_id)?.duration || 0;
    const status = lessonStatus(row, duration);
    watched += row.watched_seconds || 0;
    if (row.duration_seconds != null) tracked++;
    if (status === 'done') completed++;
    if (status === 'skips') skipped++;
  });
  const last = rows.reduce((best, row) => (!best || row.last_viewed_at > best.last_viewed_at ? row : best), null);
  const first = rows.reduce((best, row) => (row.first_viewed_at && (!best || row.first_viewed_at < best) ? row.first_viewed_at : best), null);
  const pct = tracked && totalDuration
    ? Math.min(100, Math.round((watched / totalDuration) * 100))
    : (total ? Math.round((rows.length / total) * 100) : 0);
  return { index, seen: rows.length, total, pct, last, first, watched, completed, skipped, tracked };
}

function visitStats(userId, courseId) {
  const sessions = SESSIONS_BY_USER_COURSE[`${userId}|${courseId}`] || [];
  const times = sessions.map((session) => session.t).sort((a, b) => a - b);
  // Una visita = sesiones separadas por más de 30 min.
  let visits = 0, previous = -Infinity;
  times.forEach((t) => { if (t - previous > 30 * 60000) visits++; previous = t; });
  const recent = new Set(times.filter((t) => t >= Date.now() - 28 * 86400000).map((t) => new Date(t).toDateString()));
  return { visits, activeDays: recent.size, perWeek: recent.size / 4, lastVisit: times[times.length - 1] || null };
}

function progressBadge(userId, enrolledCourseIds) {
  const stats = COURSES.filter((course) => enrolledCourseIds.has(course.id)).map((course) => ({ course, ...courseProgressStats(userId, course) }));
  if (!stats.length) return '';
  const trackedAny = stats.some((item) => item.tracked);
  let pct;
  if (trackedAny) {
    const totalDuration = stats.reduce((sum, item) => sum + (LESSONS_BY_COURSE[item.course.id] || []).reduce((s, l) => s + l.duration, 0), 0);
    pct = totalDuration ? Math.min(100, Math.round(stats.reduce((sum, item) => sum + item.watched, 0) / totalDuration * 100)) : 0;
  } else {
    const total = stats.reduce((sum, item) => sum + item.total, 0);
    pct = total ? Math.round(stats.reduce((sum, item) => sum + item.seen, 0) / total * 100) : 0;
  }
  const opened = stats.reduce((sum, item) => sum + item.seen, 0);
  return `<span class="course-pct ${opened ? '' : 'zero'}" title="${trackedAny ? 'Porcentaje del vídeo total visto' : 'Lecciones abiertas'} en ${stats.length} cursos">${pct}%</span>`;
}

function courseMetrics(userId, course) {
  const stats = courseProgressStats(userId, course);
  const { index, seen, total, pct, last, first, watched, completed, skipped, tracked } = stats;
  const visit = visitStats(userId, course.id);
  const chips = [`<span class="mchip" title="Lecciones que ha abierto">${seen}/${total} abiertas</span>`];
  if (tracked) {
    chips.push(`<span class="mchip ok" title="Lecciones vistas al 90% o más">✓ ${completed} completas</span>`);
    if (skipped) chips.push(`<span class="mchip warn" title="Lecciones en las que avanzó saltando partes">↷ ${skipped} con saltos</span>`);
    chips.push(`<span class="mchip" title="Tiempo de vídeo realmente visto (sin contar repeticiones)">⏱ ${fmtDuration(watched)}</span>`);
  }
  if (visit.visits) {
    chips.push(`<span class="mchip" title="Visitas en los últimos 90 días (sesiones separadas por más de 30 min)">${visit.visits} visitas</span>`);
    chips.push(`<span class="mchip" title="Días distintos con actividad en las últimas 4 semanas">${visit.activeDays} días/4 sem · ${visit.perWeek.toFixed(1)}/sem</span>`);
  }
  if (first) chips.push(`<span class="mchip" title="Primera lección abierta">Desde ${new Date(first).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>`);
  if (last) {
    const fullTitle = (index?.get(last.bunny_video_id)?.title || '').replace(STOP_WORDS_EXT, '');
    const shortTitle = fullTitle.length > 40 ? `${fullTitle.slice(0, 39)}…` : fullTitle;
    chips.push(`<span class="mchip" title="${fmtDateTime(new Date(last.last_viewed_at).getTime())}">Última visita ${timeAgo(last.last_viewed_at)}</span>`);
    chips.push(`<span class="mchip last" title="${escapeHtmlText(fullTitle)}">${escapeHtmlText(shortTitle)}</span>`);
  } else {
    chips.push('<span class="mchip">Sin empezar</span>');
  }
  const detailOpen = EXPANDED_DETAIL.has(`${userId}|${course.id}`);
  return `<span class="progress-bar" title="${tracked ? 'Tiempo de vídeo visto sobre el total del curso' : 'Lecciones abiertas'}"><i style="width:${pct}%"></i></span><span class="progress-pct">${pct}%</span>${chips.join('')}<button type="button" class="row-action row-action-quiet detail-toggle" onclick="toggleLessonDetail('${userId}', '${course.id}')">${detailOpen ? 'Ocultar' : 'Detalle'}</button>`;
}

function toggleLessonDetail(userId, courseId) {
  const key = `${userId}|${courseId}`;
  if (EXPANDED_DETAIL.has(key)) EXPANDED_DETAIL.delete(key); else EXPANDED_DETAIL.add(key);
  renderUsers();
}

const LESSON_STATUS_LABELS = { none: 'Sin ver', opened: 'Abierta', done: 'Completa', skips: 'Saltó partes', partial: 'Parcial' };

function lessonDetail(userId, course) {
  const lessons = LESSONS_BY_COURSE[course.id] || [];
  const rows = new Map(((PROGRESS_BY_USER[userId] || {})[course.id] || []).map((row) => [row.bunny_video_id, row]));
  const items = lessons.map((lesson, position) => {
    const row = rows.get(lesson.videoId);
    const duration = row?.duration_seconds || lesson.duration || 0;
    const status = lessonStatus(row, duration);
    const watched = row?.watched_seconds || 0;
    const pct = duration ? Math.min(100, Math.round((watched / duration) * 100)) : 0;
    const ranges = Array.isArray(row?.watched_ranges) && duration
      ? row.watched_ranges.map(([start, end]) => `<i style="left:${((start / duration) * 100).toFixed(2)}%;width:${Math.max(0.6, ((end - start) / duration) * 100).toFixed(2)}%"></i>`).join('')
      : '';
    const title = lesson.title.replace(STOP_WORDS_EXT, '');
    const shortTitle = title.length > 52 ? `${title.slice(0, 51)}…` : title;
    return `<div class="ld-row"><span class="ld-n">${position + 1}</span><span class="ld-title" title="${escapeHtmlText(title)}">${escapeHtmlText(shortTitle)}</span><span class="ld-dur">${duration ? fmtClock(duration) : '—'}</span><span class="ld-ranges" title="Tramos vistos del vídeo">${ranges}</span><span class="ld-pct">${status === 'none' || status === 'opened' ? '—' : `${pct}%`}</span><span class="ld-status st-${status}">${LESSON_STATUS_LABELS[status]}</span><span class="ld-when">${row ? timeAgo(row.last_viewed_at) : '—'}</span></div>`;
  });
  return `<div class="lesson-detail">${items.join('') || '<span class="course-metrics-empty">Este curso aún no tiene lecciones importadas.</span>'}</div>`;
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
