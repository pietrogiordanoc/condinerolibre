window.showView = async function(which) {
  // Ocultar todas las secciones
  ["viewDashboard", "viewRadar", "viewUpgrade"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // Mostrar la sección activa
  const targetId = "view" + which.charAt(0).toUpperCase() + which.slice(1);
  const targetEl = document.getElementById(targetId);
  if (targetEl) {
    targetEl.style.display = (targetId === "viewDashboard") ? "grid" : "flex";
  }

  // Lógica de Radar
  if (which === "radar") {
    try {
      const { data: profile } = await window.sp.from("profiles").select("plan").single();
      const banner = document.getElementById("radarBanner");
      if (banner) banner.style.display = (profile?.plan === 'free') ? "block" : "none";
      
      const isAllowed = await window.checkRadarAccess();
      if (isAllowed) window.startRadarTick();
    } catch (e) { console.error(e); }
  } else {
    if (window.stopRadarTick) window.stopRadarTick();
  }

  if (which === "upgrade" && window.renderPaypalButtons) {
    window.renderPaypalButtons();
  }
};

async function initPortal() {
  try {
    const { data: { session } } = await window.sp.auth.getSession();
    if (!session) {
      window.location.href = "./login/index.html";
      return;
    }

    // Llenar datos de interfaz
    document.getElementById("useremail").textContent = session.user.email;
    document.getElementById("avatar").textContent = session.user.email.charAt(0).toUpperCase();

    const { data: profile } = await window.sp.from("profiles").select("plan").single();
    document.getElementById("planStatus").textContent = profile?.plan || "free";

    // Iniciar presencia y repetir cada 30s
    if (window.heartbeat) {
      window.heartbeat();
      setInterval(window.heartbeat, 30000);
    }

    // Cargar vista inicial
    const initialView = window.location.hash.replace("#", "") || "dashboard";
    window.showView(initialView);
  
  // 🕵️ Registrar acceso inicial
  if (window.auditLog) {
    window.auditLog("Acceso al portal", { initial_view: initialView });
  }
  }
}

// Escuchar cambios de URL
window.addEventListener("hashchange", () => {
  const view = window.location.hash.replace("#", "") || "dashboard";
  window.showView(view);
  // 🕵️ Registrar navegación
  if (window.auditLog) {
    window.auditLog("Navegación", { page: view });
  }
});

// Iniciar
initPortal();