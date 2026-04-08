async function showView(which) {
  // Manejo de visibilidad de secciones
  document.getElementById("viewDashboard").style.display = (which === "dashboard") ? "grid" : "none";
  document.getElementById("viewRadar").style.display = (which === "radar") ? "flex" : "none";
  document.getElementById("viewUpgrade").style.display = (which === "upgrade") ? "flex" : "none";
  
  // Lógica específica por vista
  if (which === "radar") {
    const { data: profile } = await sp.from("profiles").select("plan").single();
    document.getElementById("radarBanner").style.display = (profile?.plan === 'free') ? "block" : "none";
    if (await checkRadarAccess()) startRadarTick();
  } else {
    if (typeof stopRadarTick === "function") stopRadarTick();
  }
  
  if (which === "upgrade") renderPaypalButtons();
  
  // Actualizar estado activo en la barra lateral
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if(which === "dashboard") document.getElementById("navDashboard").classList.add('active');
  if(which === "radar") document.getElementById("navRadar").classList.add('active');
  if(which === "upgrade") document.getElementById("navUpgrade").classList.add('active');
}

async function init() {
  const { data: { session } } = await sp.auth.getSession();
  if (!session) { 
    window.location.href = "./login/index.html"; // Ajuste de ruta también aquí
    return; 
  }
  // NUEVO: Re-asegurar que el botón tenga el evento asignado
  if(document.getElementById("logoutBtn")) {
    document.getElementById("logoutBtn").onclick = handleLogout;
  }

  document.getElementById("useremail").textContent = session.user.email;
  document.getElementById("avatar").textContent = session.user.email.charAt(0).toUpperCase();
  document.getElementById("username").textContent = "Usuario CDL";
  
  const { data: profile } = await sp.from("profiles").select("plan").single();
  document.getElementById("planStatus").textContent = profile?.plan || "free";
  
  setInterval(heartbeat, 30000); 
  heartbeat();
  showView(location.hash.replace("#", "") || "dashboard");
}

// Eventos de Navegación
window.addEventListener("hashchange", () => showView(location.hash.replace("#", "") || "dashboard"));
document.getElementById("navDashboard").onclick = () => location.hash = "#dashboard";
document.getElementById("navRadar").onclick = () => location.hash = "#radar";
document.getElementById("navUpgrade").onclick = () => location.hash = "#upgrade";

init();
document.getElementById("navDashboard").onclick = () => location.hash = "#dashboard";
document.getElementById("navRadar").onclick = () => location.hash = "#radar";
document.getElementById("navUpgrade").onclick = () => location.hash = "#upgrade";
window.showView = async function(which) {
  document.getElementById("viewDashboard").style.display = (which === "dashboard") ? "grid" : "none";
  document.getElementById("viewRadar").style.display = (which === "radar") ? "flex" : "none";
  document.getElementById("viewUpgrade").style.display = (which === "upgrade") ? "flex" : "none";
  
  if (which === "radar") {
    const { data: profile } = await window.sp.from("profiles").select("plan").single();
    document.getElementById("radarBanner").style.display = (profile?.plan === 'free') ? "block" : "none";
    if (await window.checkRadarAccess()) window.startRadarTick();
  } else {
    window.stopRadarTick();
  }
  if (which === "upgrade") window.renderPaypalButtons();
};

async function initPortal() {
  const { data: { session } } = await window.sp.auth.getSession();
  if (!session) { window.location.href = "./login/index.html"; return; }
  
  document.getElementById("useremail").textContent = session.user.email;
  document.getElementById("avatar").textContent = session.user.email.charAt(0).toUpperCase();
  document.getElementById("username").textContent = "Usuario CDL";
  
  const { data: profile } = await window.sp.from("profiles").select("plan").single();
  document.getElementById("planStatus").textContent = profile?.plan || "free";
  
  setInterval(window.heartbeat, 30000); 
  window.heartbeat();
  window.showView(location.hash.replace("#", "") || "dashboard");
}

window.addEventListener("hashchange", () => window.showView(location.hash.replace("#", "") || "dashboard"));
initPortal();