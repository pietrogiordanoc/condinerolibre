window.radarTickTimer = null;

window.checkRadarAccess = async function() {
  if (!window.sp) return;
  const { data: { session } } = await window.sp.auth.getSession();
  if (!session) return;
  
  const res = await fetch(window.CONFIG.radarAccessUrl, { 
    method: "POST", 
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, 
    body: JSON.stringify({ action: "check" }) 
  });
  const data = await res.json();
  if (!data.allowed) { location.hash = "#upgrade"; return false; }
  return true;
};

window.startRadarTick = function() {
  if (window.radarTickTimer) return;
  window.radarTickTimer = setInterval(async () => {
    if (location.hash !== "#radar") return;
    const { data: { session } } = await window.sp.auth.getSession();
    const res = await fetch(window.CONFIG.radarAccessUrl, { 
      method: "POST", 
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, 
      body: JSON.stringify({ action: "tick" }) 
    });
    const data = await res.json();
    if (!data.allowed) { location.hash = "#upgrade"; window.stopRadarTick(); }
  }, 60000);
};

window.stopRadarTick = function() {
  if (window.radarTickTimer) { 
    clearInterval(window.radarTickTimer); 
    window.radarTickTimer = null; 
  }
};
let radarTickTimer = null;

async function checkRadarAccess() {
  const { data: { session } } = await sp.auth.getSession();
  if (!session) return;
  const res = await fetch(CONFIG.radarAccessUrl, { 
    method: "POST", 
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, 
    body: JSON.stringify({ action: "check" }) 
  });
  const data = await res.json();
  if (!data.allowed) { location.hash = "#upgrade"; return false; }
  return true;
}

function startRadarTick() {
  if (radarTickTimer) return;
  radarTickTimer = setInterval(async () => {
    if (location.hash !== "#radar") return;
    const { data: { session } } = await sp.auth.getSession();
    const res = await fetch(CONFIG.radarAccessUrl, { 
      method: "POST", 
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, 
      body: JSON.stringify({ action: "tick" }) 
    });
    const data = await res.json();
    if (!data.allowed) { location.hash = "#upgrade"; stopRadarTick(); }
  }, 60000);
}

function stopRadarTick() {
  if(radarTickTimer) { clearInterval(radarTickTimer); radarTickTimer = null; }
}