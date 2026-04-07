// 🕵️ SISTEMA DE AUDITORÍA COMPLETO - Registra TODO
// Este módulo es el "chismoso" que registra cada acción del usuario

window.auditLog = async function(eventType, additionalData = {}) {
  if (!window.sp) return;
  
  try {
    const { data: { session } } = await window.sp.auth.getSession();
    if (!session) return;
    
    // Obtener datos de presencia actual
    const { data: presence } = await window.sp.from("user_presence")
      .select("ciudad, pais, page")
      .eq("user_id", session.user.id)
      .single();
    
    // Construir metadata completo
    const metadata = {
      email: session.user.email,
      user_id: session.user.id,
      location: presence ? `${presence.ciudad || '—'}, ${presence.pais || '—'}` : '—',
      timestamp: new Date().toISOString(),
      ...additionalData
    };
    
    // Insertar evento en audit_events
    await window.sp.from("audit_events").insert({
      user_id: session.user.id,
      event_type: eventType,
      metadata: metadata,
      created_at: new Date().toISOString()
    });
    
    console.log(`✅ Evento registrado: ${eventType}`, metadata);
  } catch (err) {
    console.error("Error en auditLog:", err);
  }
};

// Registrar cambios de vista automáticamente
window.addEventListener('hashchange', () => {
  const view = window.location.hash.replace('#', '') || 'dashboard';
  window.auditLog('Navegación', { 
    page: view,
    url: window.location.href
  });
});

// Registrar cuando el usuario está activo (cada 5 minutos)
let lastActivityLog = Date.now();
document.addEventListener('click', () => {
  const now = Date.now();
  if (now - lastActivityLog > 300000) { // 5 minutos
    window.auditLog('Usuario activo', { 
      page: window.location.hash || '#dashboard'
    });
    lastActivityLog = now;
  }
});

console.log("🕵️ Sistema de auditoría cargado y activo");
