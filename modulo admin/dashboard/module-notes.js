let currentEditingUserId = null;

function openNoteModal(userId, name, note) {
  currentEditingUserId = userId;
  document.getElementById("noteModalUser").textContent = name;
  const textarea = document.getElementById("noteTextarea");
  textarea.value = note;
  updateCharCount();
  document.getElementById("modalNote").style.display = "flex";
  // Focus al textarea para escribir inmediatamente
  setTimeout(() => textarea.focus(), 100);
}

function updateCharCount() {
  const textarea = document.getElementById("noteTextarea");
  const counter = document.getElementById("noteCharCount");
  if (textarea && counter) {
    counter.textContent = textarea.value.length.toLocaleString();
  }
}

// Actualizar contador mientras escribe
document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById("noteTextarea");
  if (textarea) {
    textarea.addEventListener('input', updateCharCount);
  }
});

function closeNoteModal() {
  document.getElementById("modalNote").style.display = "none";
}

document.getElementById("saveNoteBtn").onclick = async () => {
  const note = document.getElementById("noteTextarea").value;
  const { error } = await sp.from("profiles").update({ notas_admin: note }).eq("id", currentEditingUserId);
  if (!error) {
    Toastify({ text: "Nota guardada", duration: 2000, backgroundColor: "#10b981" }).showToast();
    refreshUsers();
    closeNoteModal();
  }
};

function escapeJS(s) { 
  if (!s) return ''; 
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r'); 
}
