async function init() {
  const { data: { session } } = await sp.auth.getSession();
  if (!session) { 
    // Detectar si es local o producción
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    window.location.href = isLocal ? "../cdl-admin/" : "/cdl-admin/"; 
    return; 
  }
  
  document.getElementById("sessionEmail").textContent = session.user.email;
  
  // Carga inicial
  await refreshPresence();
  await refreshRadarUsage();
  await refreshUsers();
  await refreshLogs();

  // Bucles de refresco (solo presencia, los eventos son en tiempo real con WebSockets)
  setInterval(async () => { await refreshPresence(); renderUsers(); }, 5000);
  
  // Refrescar uso del radar cada 2 minutos
  setInterval(async () => { await refreshRadarUsage(); renderUsers(); }, 120000);
}

// Función para cambiar entre tabs
window.switchTab = function(tab) {
  if (tab === 'users') {
    document.getElementById('viewUsers').style.display = 'block';
    document.getElementById('viewHistory').style.display = 'none';
    document.getElementById('tabUsers').classList.add('active');
    document.getElementById('tabHistory').classList.remove('active');
  } else if (tab === 'history') {
    document.getElementById('viewUsers').style.display = 'none';
    document.getElementById('viewHistory').style.display = 'block';
    document.getElementById('tabUsers').classList.remove('active');
    document.getElementById('tabHistory').classList.add('active');
    refreshGlobalHistory();
  }
};

// Eventos de UI
document.getElementById("logoutBtn").onclick = async () => { 
  // 🕵️ Registrar logout de admin
  try {
    const { data: { session } } = await sp.auth.getSession();
    if (session) {
      await sp.from("audit_events").insert({
        user_id: session.user.id,
        event_type: "Logout Admin",
        metadata: { 
          email: session.user.email,
          admin: true,
          timestamp: new Date().toISOString() 
        },
        created_at: new Date().toISOString()
      });
    }
  } catch(e) { console.log("Audit log:", e); }
  await sp.auth.signOut(); 
  window.location.href = "/"; 
};

document.getElementById("q").oninput = renderUsers;
document.getElementById("planFilter").onchange = renderUsers;
document.getElementById("statusFilter").onchange = renderUsers;
document.getElementById("clearBtn").onclick = () => { 
  document.getElementById("q").value=""; 
  document.getElementById("planFilter").value="all";
  document.getElementById("statusFilter").value="all";
  renderUsers(); 
};

// Evento para refrescar historial
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById("refreshHistoryBtn");
  if (refreshBtn) {
    refreshBtn.onclick = refreshGlobalHistory;
  }
  const historyLimit = document.getElementById("historyLimit");
  if (historyLimit) {
    historyLimit.onchange = refreshGlobalHistory;
  }
});

init();
