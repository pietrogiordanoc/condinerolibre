async function init() {
  const { data: { session } } = await sp.auth.getSession();
  if (!session) { 
    // Detectar si es local o producción
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    window.location.href = isLocal ? "../cdl-admin/" : "/cdl-admin/"; 
    return; 
  }

  const { data: adminUser, error: adminError } = await sp
    .from("admin_users")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (adminError || !adminUser) {
    await sp.auth.signOut();
    window.location.href = "/admin/cdl-admin/?error=forbidden";
    return;
  }
  
  document.getElementById("sessionEmail").textContent = session.user.email;
  
  // Carga inicial
  await refreshPresence();
  await refreshRadarUsage();
  await refreshUsers();
  await refreshLogs();
  await refreshStudyQuestionAlert();
  await refreshPlanChangeAlert();
  await refreshSupportMessageAlert();

  // Bucles de refresco (solo presencia, los eventos son en tiempo real con WebSockets)
  setInterval(async () => { await refreshPresence(); renderUsers(); }, 5000);
  
  // Refrescar uso del radar cada 2 minutos
  setInterval(async () => { await refreshRadarUsage(); renderUsers(); }, 120000);

  // Refresca cursos y progreso de alumnos cada minuto.
  setInterval(refreshUsers, 60000);
  setInterval(refreshStudyQuestionAlert, 30000);
  setInterval(refreshPlanChangeAlert, 30000);
  setInterval(refreshSupportMessageAlert, 30000);
}

// Función para cambiar entre tabs
window.switchTab = function(tab) {
  if (tab === 'users') {
    document.getElementById('viewUsers').style.display = 'block';
    document.getElementById('viewSupportMessages').style.display = 'none';
    document.getElementById('viewPlanChanges').style.display = 'none';
    document.getElementById('viewHistory').style.display = 'none';
    document.getElementById('viewStudyCenter').style.display = 'none';
    document.getElementById('viewAffiliates').style.display = 'none';
    document.getElementById('tabUsers').classList.add('active');
    document.getElementById('tabSupportMessages').classList.remove('active');
    document.getElementById('tabPlanChanges').classList.remove('active');
    document.getElementById('tabHistory').classList.remove('active');
    document.getElementById('tabStudyCenter').classList.remove('active');
    document.getElementById('tabAffiliates').classList.remove('active');
  } else if (tab === 'support-messages') {
    document.getElementById('viewUsers').style.display = 'none';
    document.getElementById('viewSupportMessages').style.display = 'block';
    document.getElementById('viewPlanChanges').style.display = 'none';
    document.getElementById('viewHistory').style.display = 'none';
    document.getElementById('viewStudyCenter').style.display = 'none';
    document.getElementById('viewAffiliates').style.display = 'none';
    document.getElementById('tabUsers').classList.remove('active');
    document.getElementById('tabSupportMessages').classList.add('active');
    document.getElementById('tabPlanChanges').classList.remove('active');
    document.getElementById('tabHistory').classList.remove('active');
    document.getElementById('tabStudyCenter').classList.remove('active');
    document.getElementById('tabAffiliates').classList.remove('active');
    refreshSupportMessages();
  } else if (tab === 'plan-changes') {
    document.getElementById('viewUsers').style.display = 'none';
    document.getElementById('viewSupportMessages').style.display = 'none';
    document.getElementById('viewPlanChanges').style.display = 'block';
    document.getElementById('viewHistory').style.display = 'none';
    document.getElementById('viewStudyCenter').style.display = 'none';
    document.getElementById('viewAffiliates').style.display = 'none';
    document.getElementById('tabUsers').classList.remove('active');
    document.getElementById('tabSupportMessages').classList.remove('active');
    document.getElementById('tabPlanChanges').classList.add('active');
    document.getElementById('tabHistory').classList.remove('active');
    document.getElementById('tabStudyCenter').classList.remove('active');
    document.getElementById('tabAffiliates').classList.remove('active');
    refreshPlanChanges();
  } else if (tab === 'history') {
    document.getElementById('viewUsers').style.display = 'none';
    document.getElementById('viewSupportMessages').style.display = 'none';
    document.getElementById('viewPlanChanges').style.display = 'none';
    document.getElementById('viewHistory').style.display = 'block';
    document.getElementById('viewStudyCenter').style.display = 'none';
    document.getElementById('viewAffiliates').style.display = 'none';
    document.getElementById('tabUsers').classList.remove('active');
    document.getElementById('tabSupportMessages').classList.remove('active');
    document.getElementById('tabPlanChanges').classList.remove('active');
    document.getElementById('tabHistory').classList.add('active');
    document.getElementById('tabStudyCenter').classList.remove('active');
    document.getElementById('tabAffiliates').classList.remove('active');
    refreshGlobalHistory();
  } else if (tab === 'study-center') {
    document.getElementById('viewUsers').style.display = 'none';
    document.getElementById('viewSupportMessages').style.display = 'none';
    document.getElementById('viewPlanChanges').style.display = 'none';
    document.getElementById('viewHistory').style.display = 'none';
    document.getElementById('viewStudyCenter').style.display = 'block';
    document.getElementById('viewAffiliates').style.display = 'none';
    document.getElementById('tabUsers').classList.remove('active');
    document.getElementById('tabSupportMessages').classList.remove('active');
    document.getElementById('tabPlanChanges').classList.remove('active');
    document.getElementById('tabHistory').classList.remove('active');
    document.getElementById('tabStudyCenter').classList.add('active');
    document.getElementById('tabAffiliates').classList.remove('active');
    refreshStudyCenter();
  } else if (tab === 'affiliates') {
    document.getElementById('viewUsers').style.display = 'none';
    document.getElementById('viewSupportMessages').style.display = 'none';
    document.getElementById('viewPlanChanges').style.display = 'none';
    document.getElementById('viewHistory').style.display = 'none';
    document.getElementById('viewStudyCenter').style.display = 'none';
    document.getElementById('viewAffiliates').style.display = 'block';
    document.getElementById('tabUsers').classList.remove('active');
    document.getElementById('tabSupportMessages').classList.remove('active');
    document.getElementById('tabPlanChanges').classList.remove('active');
    document.getElementById('tabHistory').classList.remove('active');
    document.getElementById('tabStudyCenter').classList.remove('active');
    document.getElementById('tabAffiliates').classList.add('active');
    refreshAffiliates();
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
  window.location.href = "/admin/cdl-admin/"; 
};

document.getElementById("q").oninput = renderUsers;
document.getElementById("tierFilter").onchange = renderUsers;
document.getElementById("statusFilter").onchange = renderUsers;
document.getElementById("clearBtn").onclick = () => { 
  document.getElementById("q").value=""; 
  document.getElementById("tierFilter").value="all";
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
  const refreshStudyCenterBtn = document.getElementById("refreshStudyCenterBtn");
  if (refreshStudyCenterBtn) refreshStudyCenterBtn.onclick = refreshStudyCenter;
  const refreshPlanChangesBtn = document.getElementById("refreshPlanChangesBtn");
  if (refreshPlanChangesBtn) refreshPlanChangesBtn.onclick = refreshPlanChanges;
  const refreshSupportMessagesBtn = document.getElementById("refreshSupportMessagesBtn");
  if (refreshSupportMessagesBtn) refreshSupportMessagesBtn.onclick = refreshSupportMessages;
  const studyQuestionFilter = document.getElementById("studyQuestionFilter");
  if (studyQuestionFilter) studyQuestionFilter.onchange = renderStudyCenter;
});

init();
