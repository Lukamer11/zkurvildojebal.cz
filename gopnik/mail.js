(() => {
  "use strict";

  // ======================================================
  //  MAIL — ONLINE (Supabase)
  //  Tabulka: player_mail
  //  Sloupce (doporučeno):
  //    id (text/uuid, PK), user_id (uuid), from_name (text), to_name (text),
  //    subject (text), body (text), created_at (timestamptz),
  //    unread (bool), important (bool), kind (text)
  // ======================================================

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
  const TABLE = "player_mail";

  const supabaseClient = () => window.supabaseClient;
  async function ensureOnline() {
    if (window.SFReady) await window.SFReady;
    const sb = supabaseClient();
    if (!sb) throw new Error("Supabase client není inicializovaný (načti menu.js před mail.js)");
    return sb;
  }

  function safeStr(x) {
    return String(x ?? "").trim();
  }

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

  function genId() {
    try {
      return crypto.randomUUID();
    } catch {
      return `m_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    }
  }

  function ensureWelcome(stats) {
    const claimed = Boolean(stats?.flags?.welcome_mail_claimed);
    return {
      id: "welcome",
      from_name: "SYSTÉM",
      to_name: "TY",
      subject: "Vítej, nováčku",
      body: [
        "Vítej v ulicích.",
        "Tohle není hra pro měkký.",
        "Tady máš něco na rozjezd.",
        "\n**100 cig**\n**5000 grošů**\n",
        "Neproser to.",
      ].join("\n"),
      created_at: "2026-01-01T00:00:00.000Z",
      unread: !claimed,
      important: true,
      kind: "system",
    };
  }

  // ===== state =====
  let cache = {
    userId: null,
    mails: [],
    activeId: null,
  };

  // ===== DB =====
  async function fetchMails(userId) {
    const sb = await ensureOnline();

    // NOTE: Pokud tabulka neexistuje, Supabase obvykle vrátí chybu.
    const { data, error } = await sb
      .from(TABLE)
      .select("id, from_name, to_name, subject, body, created_at, unread, important, kind")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function insertMail(userId, payload) {
    const sb = await ensureOnline();
    const row = {
      id: genId(),
      user_id: userId,
      from_name: payload.from_name,
      to_name: payload.to_name,
      subject: payload.subject,
      body: payload.body,
      created_at: nowIso(),
      unread: Boolean(payload.unread),
      important: Boolean(payload.important),
      kind: payload.kind || "player",
    };

    const { error } = await sb.from(TABLE).insert(row);
    if (error) throw error;
    return row;
  }

  async function setMailRead(userId, mailId) {
    const sb = await ensureOnline();
    const { error } = await sb
      .from(TABLE)
      .update({ unread: false })
      .eq("user_id", userId)
      .eq("id", mailId);
    if (error) throw error;
  }

  async function deleteMail(userId, mailId) {
    const sb = await ensureOnline();
    const { error } = await sb
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("id", mailId);
    if (error) throw error;
  }

  // ===== UI: compose =====
  function openCompose() {
    if (!composePanel) return;
    composePanel.classList.add("open");
    composePanel.setAttribute("aria-hidden", "false");
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
        const fromLine = m.kind === "system" ? m.from_name : `${m.from_name} → ${m.to_name}`;
        const snippet = safeStr(m.body).replace(/\s+/g, " ").slice(0, 70);
        const active = m.id === activeId ? "active" : "";
        const icon = m.kind === "system" ? "📩" : "✍️";
        const timeText = (m.kind === "system" && m.id === "welcome" && !m.unread) ? "VYZVEDNUTO" : fmtTime(m.created_at);
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

    const canDelete = !isWelcome;

    detailEl.innerHTML = `
      <div class="mail-detail">
        <div class="mail-detail-head">
          <h2>${safeStr(mail.subject) || "(bez předmětu)"}</h2>
          <div class="mail-detail-meta">
            <span>${safeStr(mail.from_name)}</span>
            <span class="dot">•</span>
            <span>${fmtTime(mail.created_at)}</span>
          </div>
        </div>
        <div class="mail-detail-body">${bodyHtml}</div>
        <div class="mail-detail-actions" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          ${isWelcome ? `<button id="claimWelcome" class="skinBtn" ${claimed ? "disabled" : ""}>${claimed ? "Vyzvednuto" : "Vyzvednout odměnu"}</button>` : ""}
          ${canDelete ? `<button id="deleteMail" class="skinBtn" style="filter:saturate(0.85);">🗑️ Odstranit</button>` : ""}
        </div>
      </div>
    `;

    const btn = document.getElementById("claimWelcome");
    if (btn) btn.addEventListener("click", () => claimWelcome(stats));

    const delBtn = document.getElementById("deleteMail");
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        try {
          await deleteMail(cache.userId, mail.id);
          cache.activeId = null;
          await refresh(stats);
          renderDetail(null, stats);
        } catch (e) {
          console.error(e);
          delBtn.classList.add("shake");
          setTimeout(() => delBtn.classList.remove("shake"), 350);
        }
      });
    }
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

  // ===== wiring =====
  function wireListClicks(stats) {
    if (!listEl) return;
    listEl.addEventListener("click", async (e) => {
      const item = e.target?.closest?.(".mail-item");
      const id = item?.getAttribute?.("data-id");
      if (!id) return;

      cache.activeId = id;

      // mark read (jen online, a jen pokud to není welcome)
      if (id !== "welcome") {
        const m = cache.mails.find((x) => x.id === id);
        if (m && m.unread) {
          try {
            await setMailRead(cache.userId, id);
            m.unread = false;
          } catch (e2) {
            console.error(e2);
          }
        }
      }

      const all = buildMergedThreads(stats);
      const filtered = filterByTab(all);
      const mail = all.find((m) => m.id === id);
      renderList(filtered, id);
      renderDetail(mail, stats);
    });
  }

  function wireCompose(stats) {
    composeOpenBtn?.addEventListener("click", openCompose);
    composeCloseBtn?.addEventListener("click", closeCompose);
    composeCancelBtn?.addEventListener("click", closeCompose);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeCompose();
    });

    composeSendBtn?.addEventListener("click", async () => {
      const to = safeStr(composeTo?.value);
      const subject = safeStr(composeSubject?.value);
      const body = safeStr(composeBody?.value);

      if (!to || !body) {
        composeSendBtn.classList.add("shake");
        setTimeout(() => composeSendBtn.classList.remove("shake"), 350);
        return;
      }

      try {
        await insertMail(cache.userId, {
          from_name: "TY",
          to_name: to,
          subject,
          body,
          unread: false,
          important: false,
          kind: "player",
        });
        clearCompose();
        closeCompose();
        await refresh(stats);
        renderDetail(null, stats);
      } catch (e) {
        console.error(e);
        composeSendBtn.classList.add("shake");
        setTimeout(() => composeSendBtn.classList.remove("shake"), 350);
      }
    });
  }

  function wireTabs(stats) {
    tabBtns.forEach((b) => {
      b.addEventListener("click", async () => {
        tabBtns.forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        const all = buildMergedThreads(stats);
        renderList(filterByTab(all), cache.activeId);
        const mail = all.find((m) => m.id === cache.activeId);
        renderDetail(mail || null, stats);
      });
    });
  }

  // ===== build & refresh =====
  function buildMergedThreads(stats) {
    const welcome = ensureWelcome(stats);
    const merged = [welcome, ...(cache.mails || [])];
    merged.sort((a, b) => String(b.created_at || b.createdAt).localeCompare(String(a.created_at || a.createdAt)));
    return merged;
  }

  async function refresh(stats) {
    try {
      cache.mails = await fetchMails(cache.userId);
    } catch (e) {
      console.error("MAIL: Supabase chyba", e);
      // Když tabulka neexistuje / chybí sloupce, nech aspoň welcome.
      cache.mails = [];
    }

    const all = buildMergedThreads(stats);
    renderList(filterByTab(all), cache.activeId);
  }

  // ===== boot =====
  async function start() {
    if (window.SFReady) await window.SFReady;

    const userId = window.SF?.user?.id || window.SF?.stats?.user_id;
    cache.userId = userId;

    if (!userId) {
      // bez usera = není přihlášen
      location.href = "login.html";
      return;
    }

    // default tab
    if (!tabBtns.some((b) => b.classList.contains("active")) && tabBtns[0]) {
      tabBtns[0].classList.add("active");
    }

    const stats = window.SF?.stats;
    await refresh(stats);
    renderDetail(null, stats);
    wireListClicks(stats);
    wireCompose(stats);
    wireTabs(stats);

    // Re-render při změně statů (kvůli welcome claim)
    document.addEventListener("sf:stats", async (e) => {
      const st = e.detail || window.SF?.stats;
      await refresh(st);
      const all = buildMergedThreads(st);
      const mail = all.find((m) => m.id === cache.activeId);
      renderDetail(mail || null, st);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      start().catch(console.error);
    });
  } else {
    start().catch(console.error);
  }
})();
