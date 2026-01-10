(() => {
  "use strict";

  const listEl = document.querySelector(".mail-list");
  const detailEl = document.querySelector(".mail-detail-section");

  function fmt(n) {
    const x = Number(n ?? 0);
    if (!Number.isFinite(x)) return "0";
    if (Math.abs(x) < 1) return x.toFixed(6);
    return x.toLocaleString("cs-CZ", { maximumFractionDigits: 6 });
  }

  function getClaimed(stats) {
    return Boolean(stats?.flags?.welcome_mail_claimed);
  }

  function render(stats) {
    if (!listEl || !detailEl) return;
    const claimed = getClaimed(stats);

    listEl.innerHTML = `
      <div class="mail-item ${claimed ? "" : "unread"}" data-id="welcome">
        <div class="mail-item-top">
          <b>Vítej, nováčku</b>
          <span class="mail-time">${claimed ? "VYZVEDNUTO" : "NEW"}</span>
        </div>
        <div class="mail-snippet">Odměna: 100 cig • 5000 grošů</div>
      </div>
    `;

    detailEl.innerHTML = `
      <div class="mail-detail">
        <div class="mail-detail-head">
          <h2>Vítej, nováčku</h2>
        </div>
        <div class="mail-detail-body">
          <p>Vítej v ulicích.</p>
          <p>Tohle není hra pro měkký.</p>
          <p>Tady máš něco na rozjezd.</p>
          <p><b>100 cig</b><br><b>5000 grošů</b></p>
          <p>Neproser to.</p>
        </div>
        <div class="mail-detail-actions">
          <button id="claimWelcome" class="skinBtn" ${claimed ? "disabled" : ""}>${claimed ? "Vyzvednuto" : "Vyzvednout odměnu"}</button>
        </div>
      </div>
    `;

    const btn = document.getElementById("claimWelcome");
    if (btn) btn.addEventListener("click", claim);
  }

  async function claim() {
    if (window.SFReady) await window.SFReady;
    const stats = window.SF?.stats;
    if (!stats) return;
    if (getClaimed(stats)) return;

    const flags = { ...(stats.flags || {}), welcome_mail_claimed: true };
    const money = Number(stats.money ?? 0) + 5000;
    const cigarettes = Number(stats.cigarettes ?? 0) + 100;

    window.SF.updateStats({ money, cigarettes, flags });
  }

  function start() {
    document.addEventListener("sf:stats", (e) => render(e.detail));
    if (window.SF?.stats) render(window.SF.stats);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
