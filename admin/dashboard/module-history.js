// 🔴 SUSCRIPCIÓN EN TIEMPO REAL A EVENTOS DE AUDITORÍA
let latestEventId = null;

sp.channel('audit_changes').on('postgres_changes', { 
    event: '*', schema: 'public', table: 'audit_events' 
}, (payload) => {
    console.log('🔴 Evento nuevo en tiempo real:', payload.new?.event_type);
    
    // Guardar el ID del evento más reciente para resaltarlo
    if (payload.new?.id) {
        latestEventId = payload.new.id;
    }
    
    refreshLogs();
    // Si estamos en la pestaña de historial, refrescar también
    const historyView = document.getElementById('viewHistory');
    if (historyView && historyView.style.display !== 'none') {
        refreshGlobalHistory();
    }
}).subscribe();

async function refreshLogs() {
  const { data } = await sp.from("audit_events").select("*").order("created_at", { ascending: false }).limit(10);
  const logTbody = document.getElementById("logTbody");
  if (logTbody) {
    logTbody.innerHTML = (data || []).map(l => `
      <tr>
        <td style="width:140px; color:#666;">${new Date(l.created_at).toLocaleTimeString()}</td>
        <td>${l.metadata?.email || "Sistema"} ${l.event_type}</td>
      </tr>
    `).join("");
  }
}

async function refreshGlobalHistory() {
  const limit = document.getElementById("historyLimit")?.value || 50;
  
  // Obtener eventos con información de usuarios
  const { data: events } = await sp.from("audit_events").select("*").order("created_at", { ascending: false }).limit(parseInt(limit));
  
  // Obtener información de todos los usuarios y su presencia
  const { data: profiles } = await sp.from("profiles").select("id, email, display_name, full_name, name, plan");
  const { data: presence } = await sp.from("user_presence").select("*");
  
  const tbody = document.getElementById("globalHistoryTbody");
  
  if (tbody) {
    if (!events || events.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:#666;">No hay eventos registrados</td></tr>';
      return;
    }
    
    // Crear mapas para acceso rápido
    const profileMap = {};
    const presenceMap = {};
    
    (profiles || []).forEach(p => {
      profileMap[p.email] = p;
    });
    
    (presence || []).forEach(p => {
      presenceMap[p.user_id] = p;
    });
    
    tbody.innerHTML = events.map(l => {
      const date = new Date(l.created_at);
      const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      
      const email = l.metadata?.email || "Sistema";
      const profile = profileMap[email];
      const userPresence = profile ? presenceMap[profile.id] : null;
      
      // Nombre de usuario
      const displayName = profile ? (profile.display_name || profile.full_name || profile.name || email.split('@')[0]) : email.split('@')[0];
      
      // Ubicación
      const ciudad = userPresence?.ciudad || "—";
      const pais = userPresence?.pais || "—";
      const ubicacion = `${ciudad}, ${pais}`;
      
      // Plan
      const plan = profile?.plan || "free";
      const planBadge = plan === "paid" 
        ? '<span class="pill pill-paid">PAID</span>' 
        : '<span class="pill pill-free">FREE</span>';
      
      // Estado online/offline
      const isOnline = userPresence?.online && (Math.abs(Date.now() - new Date(userPresence.last_seen).getTime()) <= 120000);
      const statusBadge = isOnline
        ? '<span class="badge online"><span class="dot"></span> ONLINE</span>'
        : '<span class="badge offline"><span class="dot"></span> OFFLINE</span>';
      
      const eventType = l.event_type || "Evento desconocido";
      
      // Marcar eventos nuevos con clase especial para animación
      const isNewEvent = latestEventId && l.id === latestEventId;
      const rowClass = isNewEvent ? ' class="new-event"' : '';
      
      // Limpiar el marcador después de renderizar
      if (isNewEvent) {
        setTimeout(() => { latestEventId = null; }, 2000);
      }
      
      return `
        <tr${rowClass}>
          <td data-label="Fecha" style="color:#888; font-size:11px;">${dateStr}<br/><span style="color:#666; font-size:10px;">${timeStr}</span></td>
          <td data-label="Usuario">
            <div class="name" style="font-size:12px;">${displayName}</div>
            <div class="email" style="font-size:10px;">${email}</div>
          </td>
          <td data-label="Ubicación" style="color:#aaa; font-size:11px;">${ubicacion}</td>
          <td data-label="Plan">${planBadge}</td>
          <td data-label="Estado">${statusBadge}</td>
          <td data-label="Evento" style="color:#eaeaea; font-size:12px;">${eventType}</td>
        </tr>
      `;
    }).join("");
  }
}

async function openHistory(uId, email) {
  document.getElementById("modalBackdrop").style.display = "flex";
  
  // Obtener datos del usuario
  const { data: profile } = await sp.from("profiles").select("*").eq("id", uId).single();
  const { data: presence } = await sp.from("user_presence").select("*").eq("user_id", uId).single();
  const { data: events } = await sp.from("audit_events").select("*").eq("metadata->>email", email).order("created_at", { ascending: false }).limit(50);
  
  // Mostrar info del usuario en el header
  if (profile) {
    const displayName = profile.display_name || profile.full_name || profile.name || email.split('@')[0];
    const plan = profile.plan || 'free';
    const planBadge = plan === 'paid' 
      ? '<span class="pill pill-paid" style="font-size:10px; padding:3px 8px;">PAID</span>' 
      : '<span class="pill pill-free" style="font-size:10px; padding:3px 8px;">FREE</span>';
    
    const isOnline = presence?.online && (Math.abs(Date.now() - new Date(presence.last_seen).getTime()) <= 120000);
    const statusBadge = isOnline
      ? '<span class="badge online" style="font-size:10px;"><span class="dot"></span> ONLINE</span>'
      : '<span class="badge offline" style="font-size:10px;"><span class="dot"></span> OFFLINE</span>';
    
    const location = presence ? `${presence.ciudad || '—'}, ${presence.pais || '—'}` : '—';
    
    document.getElementById("modalUserInfo").innerHTML = `
      ${displayName} • ${email} • ${planBadge} ${statusBadge} • 📍 ${location}
    `;
  }
  
  if (!events || events.length === 0) {
    document.getElementById("modalContent").innerHTML = '<div style="text-align:center; padding:40px; color:#666;">No hay historial para este usuario</div>';
    return;
  }
  
  document.getElementById("modalContent").innerHTML = `
    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr style="background:#1a1a1a;">
          <th style="padding:10px; text-align:left; border-bottom:2px solid #333; color:#888; font-size:11px; text-transform:uppercase;">Fecha y Hora</th>
          <th style="padding:10px; text-align:left; border-bottom:2px solid #333; color:#888; font-size:11px; text-transform:uppercase;">Evento</th>
          <th style="padding:10px; text-align:left; border-bottom:2px solid #333; color:#888; font-size:11px; text-transform:uppercase;">Ubicación en ese momento</th>
          <th style="padding:10px; text-align:left; border-bottom:2px solid #333; color:#888; font-size:11px; text-transform:uppercase;">Página</th>
        </tr>
      </thead>
      <tbody>
        ${events.map(e => {
          const date = new Date(e.created_at);
          const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
          const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          
          // Extraer info adicional del metadata si existe
          const metadata = e.metadata || {};
          const eventLocation = metadata.location || '—';
          const eventPage = metadata.page || e.page || '—';
          
          return `
            <tr style="border-bottom:1px solid #222;">
              <td style="padding:10px; color:#aaa; font-size:12px;">
                ${dateStr}<br/>
                <span style="color:#666; font-size:11px;">${timeStr}</span>
              </td>
              <td style="padding:10px; color:#eaeaea; font-size:12px; font-weight:600;">${e.event_type}</td>
              <td style="padding:10px; color:#888; font-size:11px;">${eventLocation}</td>
              <td style="padding:10px; color:#888; font-size:11px;">${eventPage}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}
