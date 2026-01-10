(() => {
  "use strict";

  // ===== DOM =====
  const listEl = document.querySelector(".mail-list");
  const detailEl = document.querySelector(".mail-detail-section");

  const composePanel = document.getElementById("composePanel");
  const composeOpenBtn = document.querySelector(".compose-open-btn");
  const composeCloseBtn = document.querySelector(".compose-close");
  const composeCancelBtn = document.getElementById("composeCancel");
  const composeSendBtn = document.getElementById("composeSend");
  const composeTo = document.getElementById("composeTo");
  const composeSubject = document.getElementById("composeSubject");
  const composeBody = document.getElementById("composeBody");

  const tabBtns = Array.from(document.querySelectorAll(".tab-btn"));

  // ===== helpers =====
  const LS_KEY = "sf_mail_threads_v1";

  function nowIso() {
    return new Date().toISOString();
  }

  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return "";
    }
  }

  function safeStr(x) {
    return String(x ?? "").trim();
  }

  // ===== data model =====
  // Jednoduché lokální zprávy + 1 systémová (welcome). Zatím bez serveru.
  function loadThreads() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [];
  }

  function saveThreads(threads) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(threads));
    } catch {}
  }

  function ensureWelcome(stats) {
    const claimed = Boolean(stats?.flags?.welcome_mail_claimed);
    return {
      id: "welcome",
      from: "SYSTÉM",
      to: "TY",
      subject: "Vítej, nováčku",
      body: [
        "Vítej v ulicích.",
        "Tohle není hra pro měkký.",
        "Tady máš něco na rozjezd.",
        "\n**100 cig**\n**5000 grošů**\n",
        "Neproser to."
      ].join("\n"),
      createdAt: "2026-01-01T00:00:00.000Z",
      unread: !claimed,
      important: true,
      kind: "system"
    };
  }

  function getAllThreads(stats) {
    const local = loadThreads();
    const welcome = ensureWelcome(stats);
    const merged = [welcome, ...local];
    // sort newest first (welcome fixed, but still ok)
    merged.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return merged;
  }

  // ===== UI: compose =====
  function openCompose() {
    if (!composePanel) return;
    composePanel.classList.add("open");
    composePanel.setAttribute("aria-hidden", "false");
    // focus
    setTimeout(() => composeTo?.focus?.(), 0);
  }

  function closeCompose() {
    if (!composePanel) return;
    composePanel.classList.remove("open");
    composePanel.setAttribute("aria-hidden", "true");
  }

  function clearCompose() {
    if (composeTo) composeTo.value = "";
    if (composeSubject) composeSubject.value = "";
    if (composeBody) composeBody.value = "";
  }

  // ===== UI: render =====
  function renderList(threads, activeId) {
    if (!listEl) return;
    listEl.innerHTML = threads
      .map((m) => {
        const unreadCls = m.unread ? "unread" : "";
        const imp = m.important ? "⭐" : "";
        const fromLine = m.kind === "system" ? m.from : `${m.from} → ${m.to}`;
        const snippet = safeStr(m.body).replace(/\s+/g, " ").slice(0, 70);
        const active = m.id === activeId ? "active" : "";
        const icon = m.kind === "system" ? "📩" : "✍️";
        const timeText = (m.kind === "system" && m.id === "welcome" && !m.unread)
          ? "VYZVEDNUTO"
          : fmtTime(m.createdAt);
        return `
          <div class="mail-item ${unreadCls} ${active}" data-id="${m.id}">
            <div class="mail-icon">${icon}</div>
            <div class="mail-info">
              <div class="mail-from">${imp} ${fromLine}</div>
              <div class="mail-subject">${safeStr(m.subject) || "(bez předmětu)"}</div>
              <div class="mail-preview">${snippet}${snippet.length >= 70 ? "…" : ""}</div>
            </div>
            <div class="mail-meta">
              <div class="mail-time">${timeText}</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderDetail(mail, stats) {
    if (!detailEl) return;
    if (!mail) {
      detailEl.innerHTML = `<div class="mail-detail-body"><p>Vyber zprávu vlevo.</p></div>`;
      return;
    }

    const isWelcome = mail.id === "welcome";
    const claimed = Boolean(stats?.flags?.welcome_mail_claimed);

    const bodyHtml = safeStr(mail.body)
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\n/g, "<br>");

    detailEl.innerHTML = `
      <div class="mail-detail">
        <div class="mail-detail-head">
          <h2>${safeStr(mail.subject) || "(bez předmětu)"}</h2>
          <div class="mail-detail-meta">
            <span>${safeStr(mail.from)}</span>
            <span class="dot">•</span>
            <span>${fmtTime(mail.createdAt)}</span>
          </div>
        </div>
        <div class="mail-detail-body">${bodyHtml}</div>
        <div class="mail-detail-actions">
          ${isWelcome ? `<button id="claimWelcome" class="skinBtn" ${claimed ? "disabled" : ""}>${claimed ? "Vyzvednuto" : "Vyzvednout odměnu"}</button>` : ""}
        </div>
      </div>
    `;

    const btn = document.getElementById("claimWelcome");
    if (btn) btn.addEventListener("click", () => claimWelcome(stats));
  }

  // ===== actions =====
  async function claimWelcome(stats) {
    if (window.SFReady) await window.SFReady;
    const s = window.SF?.stats || stats;
    if (!s) return;
    if (s?.flags?.welcome_mail_claimed) return;

    const flags = { ...(s.flags || {}), welcome_mail_claimed: true };
    const money = Number(s.money ?? 0) + 5000;
    const cigarettes = Number(s.cigarettes ?? 0) + 100;
    window.SF.updateStats({ money, cigarettes, flags });
  }

  function markReadIfLocal(id) {
    if (id === "welcome") return; // welcome read state řešíme přes flag
    const threads = loadThreads();
    const idx = threads.findIndex((t) => t.id === id);
    if (idx >= 0 && threads[idx].unread) {
      threads[idx].unread = false;
      saveThreads(threads);
    }
  }

  function addLocalMessage({ to, subject, body }) {
    const threads = loadThreads();
    threads.unshift({
      id: `local_${Math.random().toString(16).slice(2)}_${Date.now()}`,
      from: "TY",
      to,
      subject,
      body,
      createdAt: nowIso(),
      unread: false,
      important: false,
      kind: "local"
    });
    saveThreads(threads);
  }

  function setActiveTab(name) {
    tabBtns.forEach((b) => b.classList.toggle("active", safeStr(b.textContent) === name));
  }

  function filterByTab(threads) {
    const active = tabBtns.find((b) => b.classList.contains("active"));
    const name = safeStr(active?.textContent);
    if (name === "Nepřečtené") return threads.filter((t) => t.unread);
    if (name === "Důležité") return threads.filter((t) => t.important);
    return threads;
  }

  function wireListClicks(stats) {
    if (!listEl) return;
    listEl.addEventListener("click", (e) => {
      const item = e.target?.closest?.(".mail-item");
      const id = item?.getAttribute?.("data-id");
      if (!id) return;
      markReadIfLocal(id);
      const all = getAllThreads(stats);
      const filtered = filterByTab(all);
      const mail = all.find((m) => m.id === id);
      renderList(filtered, id);
      renderDetail(mail, stats);
    });
  }

  function wireCompose(stats) {
    composeOpenBtn?.addEventListener("click", openCompose);
    composeCloseBtn?.addEventListener("click", () => {
      closeCompose();
    });
    composeCancelBtn?.addEventListener("click", () => {
      closeCompose();
    });

    // ESC zavře
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeCompose();
    });

    composeSendBtn?.addEventListener("click", () => {
      const to = safeStr(composeTo?.value);
      const subject = safeStr(composeSubject?.value);
      const body = safeStr(composeBody?.value);

      if (!to || !body) {
        // mini feedback bez alertu, aby to nebylo otravný
        composeSendBtn.classList.add("shake");
        setTimeout(() => composeSendBtn.classList.remove("shake"), 350);
        return;
      }

      // Zatím jen lokálně (offline). Později to můžeš napojit na DB.
      addLocalMessage({ to, subject, body });
      clearCompose();
      closeCompose();

      // rerender
      const all = getAllThreads(stats);
      const filtered = filterByTab(all);
      renderList(filtered);
      renderDetail(null, stats);
    });
  }

  function wireTabs(stats) {
    tabBtns.forEach((b) => {
      b.addEventListener("click", () => {
        tabBtns.forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        const all = getAllThreads(stats);
        renderList(filterByTab(all));
        renderDetail(null, stats);
      });
    });
  }

  // ===== boot =====
  function boot(stats) {
    const all = getAllThreads(stats);
    renderList(filterByTab(all));
    renderDetail(null, stats);
    wireListClicks(stats);
    wireCompose(stats);
    wireTabs(stats);
  }

  function start() {
    // Re-render při změně statů (kvůli welcome claim)
    document.addEventListener("sf:stats", (e) => {
      const st = e.detail || window.SF?.stats;
      boot(st);
    });
    boot(window.SF?.stats);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
