let PROFILES = [];
let RADAR_USAGE_BY_ID = {};
let sortKey = 'displayName';
let sortOrder = 'asc';

async function refreshUsers() {
  const { data } = await sp.from("profiles").select("*, notas_admin").order("email", { ascending: true });
  PROFILES = data || [];
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
      const isLimitReached = minutesUsed >= 60;
      const color = isLimitReached ? '#e74c3c' : (minutesUsed >= 50 ? '#f59e0b' : '#94a3b8');
      const icon = isLimitReached ? '🚫' : '⏱️';
      radarDisplay = `<span style="color:${color};">${minutesUsed}/60 min ${icon}</span>`;
    } else {
      radarDisplay = '<span style="color:#64748b;">— / 60 min</span>';
    }
    
    return `
      <tr style="${u.blocked ? 'opacity:0.5; background:#331111;' : ''}">
        <td data-label="Usuario"><div class="name">${u.displayName}${u.blocked ? ' 🚫' : ''}</div><div class="email">${u.email}</div></td>
        <td data-label="Plan"><span class="pill ${u.plan === 'paid' ? 'pill-paid' : 'pill-free'}" onclick="adminSetPlan('${u.id}','${nextPlan}')">${u.plan || "free"}</span></td>
        <td data-label="Estado"><div class="badge ${u.online ? 'online' : 'offline'}"><span class="dot"></span> ${u.online ? 'ONLINE' : 'OFFLINE'}</div></td>
        <td data-label="Uso Radar">${radarDisplay}</td>
        <td data-label="Historial"><button class="btn btn-primary" onclick="openHistory('${u.id}','${u.email}')">Historial</button></td>
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

