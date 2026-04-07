window.radarTickTimer = null;

window.checkRadarAccess = async function() {
  const { data: { session } } = await window.sp.auth.getSession();
  if (!session) return false;
  try {
    const res = await fetch(window.CONFIG.radarAccessUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "check" })
    });
    const data = await res.json();
    if (!data.allowed) { 
      // 🕵️ Registrar intento de acceso denegado al radar
      if (window.auditLog) {
        window.auditLog("Acceso denegado al Radar (plan insuficiente)");
      }
      window.location.hash = "#upgrade"; 
      return false; 
    }
    // 🕵️ Registrar acceso exitoso al radar
    if (window.auditLog) {
      window.auditLog("Acceso al Radar");
    }
    return true;
  } catch (e) { return false; }
};

window.startRadarTick = function() {
  if (window.radarTickTimer) return;
  window.radarTickTimer = setInterval(async () => {
    if (window.location.hash !== "#radar") return;
    const { data: { session } } = await window.sp.auth.getSession();
    const res = await fetch(window.CONFIG.radarAccessUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "tick" })
    });
    const data = await res.json();
    if (!data.allowed) {
      window.location.hash = "#upgrade";
      window.stopRadarTick();
    }
  }, 60000);
};

window.stopRadarTick = function() {
  if (window.radarTickTimer) {
    clearInterval(window.radarTickTimer);
    window.radarTickTimer = null;
  }
};