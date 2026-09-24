let PROFILES = [];
let RADAR_USAGE_BY_ID = {};
let LATEST_AUDIT_BY_USER = {};
let LATEST_AUDIT_BY_EMAIL = {};
let sortKey = 'displayName';
let sortOrder = 'asc';

// Límite diario gratuito de CDLRadar en minutos. Debe coincidir con el límite real
// aplicado por la Edge Function `radar-access` (radar/supabase/functions/radar-access).
const RADAR_FREE_DAILY_LIMIT_MINUTES = 10;

async function refreshUsers() {
  const [profilesResponse, auditResponse] = await Promise.all([
    sp.from("profiles").select("*, notas_admin").order("email", { ascending: true }),
    sp.from("audit_events").select("id, user_id, created_at, metadata").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(10000)
  ]);
  const { data } = profilesResponse;
  updateLatestAuditMaps(auditResponse.data || []);
  PROFILES = data || [];
  renderUsers();
}

function updateLatestAuditMaps(events) {
  LATEST_AUDIT_BY_USER = {};
  LATEST_AUDIT_BY_EMAIL = {};
  events.forEach(event => {
    const email = event.metadata?.email;
    if (event.user_id && !LATEST_AUDIT_BY_USER[event.user_id]) LATEST_AUDIT_BY_USER[event.user_id] = event;
    if (email && !LATEST_AUDIT_BY_EMAIL[email]) LATEST_AUDIT_BY_EMAIL[email] = event;
  });
}

async function refreshLatestUserLogs() {
  const { data, error } = await sp.from("audit_events")
    .select("id, user_id, created_at, metadata")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(10000);
  if (error) {
    console.error('[Usuarios] Error cargando último log:', error);
    return;
  }
  updateLatestAuditMaps(data || []);
  renderUsers();
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
    const latestAudit = LATEST_AUDIT_BY_USER[u.id] || LATEST_AUDIT_BY_EMAIL[u.email];
    const latestAuditDate = latestAudit
      ? `${new Date(latestAudit.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} ${new Date(latestAudit.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
      : 'Sin actividad registrada';
    
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
    
    return `
      <tr style="${u.blocked ? 'opacity:0.5; background:#331111;' : ''}">
        <td data-label="Usuario"><div class="name">${u.displayName}${u.blocked ? ' 🚫' : ''}</div><div class="email">${u.email}</div><div style="margin-top:3px; color:#64748b; font-size:10px;">Último log: ${latestAuditDate}</div></td>
        <td data-label="Teléfono">${u.phone || "—"}</td>
        <td data-label="Plan"><span class="pill ${u.plan === 'paid' ? 'pill-paid' : 'pill-free'}" onclick="adminSetPlan('${u.id}','${nextPlan}')">${u.plan || "free"}</span></td>
        <td data-label="Estado"><div class="badge ${u.online ? 'online' : 'offline'}"><span class="dot"></span> ${u.online ? 'ONLINE' : 'OFFLINE'}</div></td>
        <td data-label="Uso Radar">${radarDisplay}</td>
        <td data-label="Historial"><button class="btn btn-primary" onclick="openHistory('${u.id}','${u.email}')">Historial</button></td>
        <td data-label="SL Experimental"><label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:${u.experimental_sl_enabled ? '#fbbf24' : '#64748b'};"><input type="checkbox" ${u.experimental_sl_enabled ? 'checked' : ''} onchange="toggleExperimentalSl('${u.id}', this.checked)"> ${u.experimental_sl_enabled ? 'Activo' : 'Inactivo'}</label></td>
        <td data-label="Ubicación">${u.pres.ciudad || "—"}, ${u.pres.pais || "—"}</td>
        <td data-label="IP/Fingerprint"><span style="${ipStyle}">${(u.pres.ip_address || "—").slice(0,15)}${ipWarning}</span><br><small style="${fpStyle}">${(u.pres.fingerprint || "—").slice(0,10)}${fpWarning}</small></td>
        <td data-label="Acción">${blockBtn}</td>
        <td data-label="Notas"><button class="btn-note-view" onclick="openNoteModal('${u.id}', '${escapeJS(u.displayName)}', '${noteEscaped}')" title="${u.notas_admin ? 'Ver/editar nota' : 'Añadir nota'}">${notePreview}</button></td>
      </tr>`;
  }).join("");
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

