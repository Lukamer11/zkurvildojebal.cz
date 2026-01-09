async function syncStats() {
  if (window.SFReady) await window.SFReady;
  const s = window.SF?.getStats ? window.SF.getStats() : window.SF?.stats;
  if (!s) return;

  if (document.getElementById("levelDisplay"))
    document.getElementById("levelDisplay").textContent = s.level ?? 1;

  if (document.getElementById("money"))
    document.getElementById("money").textContent = s.money ?? 0;

  if (document.getElementById("cigarettes"))
    document.getElementById("cigarettes").textContent = s.cigarettes ?? 0;

  if (document.getElementById("xpText"))
    document.getElementById("xpText").textContent = `${s.exp ?? 0}`;
}
