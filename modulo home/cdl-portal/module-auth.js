// Sistema de presencia para que el Admin vea al usuario ONLINE
// Cache de ubicación para no llamar IPAPI en cada heartbeat
window.userLocationCache = null;
window.cachedSessionId = null;
window.deviceFingerprint = null;
window.userIpAddress = null;

// 🕵️ SISTEMA DE AUDITORÍA - Registra TODO
window.auditLog = async function(eventType,additionalData = {}) {
  if (!window.sp) return;
  try {
    const { data: { session } } = await window.sp.auth.getSession();
    if (!session) return;
    const { data: presence } = await window.sp.from("user_presence").select("ciudad, pais, page").eq("user_id", session.user.id).single();
    const metadata = {
      email: session.user.email,
      user_id: session.user.id,
      location: presence ? `${presence.ciudad || '—'}, ${presence.pais || '—'}` : '—',
      page: presence?.page || window.location.hash || '#dashboard',
      timestamp: new Date().toISOString(),
      ...additionalData
    };
    await window.sp.from("audit_events").insert({ user_id: session.user.id, event_type: eventType, metadata: metadata, created_at: new Date().toISOString() });
    console.log(`✅ ${eventType}`);
  } catch (err) { console.error("Error auditLog:", err); }
};

// Generar fingerprint único del dispositivo
function generateFingerprint() {
  if (window.deviceFingerprint) return window.deviceFingerprint;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('fingerprint', 2, 2);
  const canvasHash = canvas.toDataURL().slice(-50);
  
  const fingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvas: canvasHash,
    cores: navigator.hardwareConcurrency || 'unknown'
  };
  
  // Crear hash simple
  const str = JSON.stringify(fingerprint);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  window.deviceFingerprint = 'fp_' + Math.abs(hash).toString(36);
  console.log('🔍 Fingerprint:', window.deviceFingerprint);
  return window.deviceFingerprint;
}

// Función para obtener ubicación con IPAPI
async function fetchLocation(sessionId) {
  // Si hay cache y es de la misma sesión, usarlo
  if (window.userLocationCache && window.cachedSessionId === sessionId) {
    return window.userLocationCache;
  }
  
  // Nueva sesión o sin cache → llamar IPAPI
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) throw new Error('Error en IPAPI');
    
    const data = await response.json();
    window.userLocationCache = {
      ciudad: data.city || null,
      pais: data.country_name || null
    };
    window.userIpAddress = data.ip || null;
    window.cachedSessionId = sessionId;
    console.log(`📍 Ubicación: ${data.city}, ${data.country_name} | IP: ${data.ip}`);
    return window.userLocationCache;
  } catch (err) {
    console.error("Error obteniendo ubicación:", err);
    // Retornar valores null si falla
    window.userLocationCache = { ciudad: null, pais: null };
    window.cachedSessionId = sessionId;
    return window.userLocationCache;
  }
}

window.heartbeat = async function() {
  if (!window.sp) return;
  try {
    const { data: { session } } = await window.sp.auth.getSession();
    if (!session) return;
    
    // Obtener ubicación (actualiza si es nueva sesión)
    const location = await fetchLocation(session.user.id);
    // Generar fingerprint
    const fingerprint = generateFingerprint();
    
    await window.sp.from("user_presence").upsert({ 
      user_id: session.user.id, 
      online: true, 
      last_seen: new Date().toISOString(), 
      page: window.location.hash || "#dashboard",
      ciudad: location.ciudad,
      pais: location.pais,
      fingerprint: fingerprint,
      ip_address: window.userIpAddress
    });
  } catch (err) {
    console.error("Error en heartbeat:", err);
  }
};

// Función para cerrar sesión
window.handleLogout = async function() {
  try {
    const { data: { session } } = await window.sp.auth.getSession();
    if (session) {
      // 🕵️ Registrar cierre de sesión
      await window.auditLog("Sesión cerrada");
      // Intentar marcar como offline antes de salir
      await window.sp.from('user_presence').update({ online: false }).eq('user_id', session.user.id);
    }
    await window.sp.auth.signOut();
  } catch (err) {
    console.error("Error al cerrar sesión:", err);
  }
  // Redirección forzada al login
  window.location.href = "./login/index.html";
};