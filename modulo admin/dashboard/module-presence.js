let PRESENCE_BY_ID = {};

async function refreshPresence() {
  const { data } = await sp.from("user_presence").select("*");
  const map = {}; 
  (data || []).forEach(row => { map[row.user_id] = row; });
  PRESENCE_BY_ID = map;
}

// Escuchar cambios en tiempo real
sp.channel('presence_changes').on('postgres_changes', { 
    event: '*', schema: 'public', table: 'user_presence' 
}, () => {
    refreshPresence().then(() => typeof renderUsers === 'function' && renderUsers());
}).subscribe();
