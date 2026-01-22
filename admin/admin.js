(async () => {
  "use strict";
  await window.SFReady;
  const out = document.getElementById("out");
  const sb = window.supabaseClient;

  const { data: isAdmin, error: eAdmin } = await sb.rpc("rpc_is_admin");
  if (eAdmin || !isAdmin) {
    out.textContent = "Nemáš admin roli.";
    return;
  }

  const $ = (id) => document.getElementById(id);

  async function ban() {
    const user = $("banUserId").value.trim();
    const reason = $("banReason").value.trim();
    const untilRaw = $("banUntil").value.trim();
    const until = untilRaw ? untilRaw : null;
    const { error } = await sb.rpc("rpc_admin_ban_user", { p_user: user, p_reason: reason, p_until: until });
    out.textContent = error ? ("Chyba: " + error.message) : "OK: BAN nastaven.";
  }

  async function unban() {
    const user = $("banUserId").value.trim();
    const { error } = await sb.rpc("rpc_admin_unban_user", { p_user: user });
    out.textContent = error ? ("Chyba: " + error.message) : "OK: BAN zrušen.";
  }

  async function logs() {
    const { data, error } = await sb.from("cheat_logs").select("*").order("created_at", { ascending: false }).limit(50);
    out.textContent = error ? ("Chyba: " + error.message) : JSON.stringify(data, null, 2);
  }

  $("btnBan").onclick = ban;
  $("btnUnban").onclick = unban;
  $("btnLoadLogs").onclick = logs;
})();