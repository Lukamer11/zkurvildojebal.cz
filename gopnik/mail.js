// mail.js - Enhanced Online Mail System s Supabase

(() => {
  "use strict";

  // ===== DOM ELEMENTS =====
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

  // ===== CONFIG =====
  const TABLE = "player_mail";
  const REFRESH_INTERVAL = 10000; // Refresh každých 10s
  
  // ===== HELPERS =====
  const supabaseClient = () => window.supabaseClient;
  
  async function ensureOnline() {
    if (window.SFReady) await window.SFReady;
    const sb = supabaseClient();
    if (!sb) throw new Error("Supabase client není inicializovaný");
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
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return "Právě teď";
      if (diffMins < 60) return `${diffMins}m`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
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

  // ===== WELCOME MAIL =====
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

  // ===== DAILY REWARD MAIL =====
  function getDailyRewardMail() {
    const today = new Date().toISOString().split('T')[0];
    return {
      id: `daily_${today}`,
      from_name: "DENNÍ ODMĚNA",
      to_name: "TY",
      subject: "🎁 Denní bonus k vyzvednutí!",
      body: [
        "Máš nárok na denní odměnu!",
        "\n**+50 energie**\n**+1000₽**\n**+20 cig**\n",
        "Vyzvedni si to, než expiruje!",
      ].join("\n"),
      created_at: nowIso(),
      unread: true,
      important: true,
      kind: "daily_reward",
      reward: {
        energy: 50,
        money: 1000,
        cigarettes: 20
      }
    };
  }

  // ===== STATE =====
  let cache = {
    userId: null,
    mails: [],
    activeId: null,
    lastRefresh: 0,
    unreadCount: 0,
  };

  let refreshTimer = null;
  let realtimeSubscription = null;

  // ===== DATABASE OPERATIONS =====
  async function fetchMails(userId) {
    const sb = await ensureOnline();

    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      // Tabulka neexistuje - to je OK, vrátíme prázdný array
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("Mail tabulka neexistuje - používám jen system maily");
        return [];
      }
      throw error;
    }
    
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
      reward: payload.reward || null,
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

  async function markAllAsRead(userId) {
    const sb = await ensureOnline();
    const { error } = await sb
      .from(TABLE)
      .update({ unread: false })
      .eq("user_id", userId)
      .eq("unread", true);
    if (error) throw error;
  }

  async function deleteAllRead(userId) {
    const sb = await ensureOnline();
    const { error } = await sb
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("unread", false);
    if (error) throw error;
  }

  // ===== REALTIME SUBSCRIPTION =====
  function setupRealtime(userId, stats) {
    const sb = supabaseClient();
    if (!sb || realtimeSubscription) return;

    try {
      realtimeSubscription = sb
        .channel(`mail_${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: TABLE,
            filter: `user_id=eq.${userId}`
          },
          async (payload) => {
            console.log('📬 Mail realtime event:', payload);
            await refresh(stats);
            showNotification('📬 Nová pošta!', 'success');
          }
        )
        .subscribe();
      
      console.log('✅ Mail realtime zapnut');
    } catch (e) {
      console.warn('⚠️ Realtime se nepodařilo zapnout:', e);
    }
  }

  // ===== UI: COMPOSE =====
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

  // ===== UI: RENDER =====
  function renderList(threads, activeId) {
    if (!listEl) return;
    
    listEl.innerHTML = threads
      .map((m) => {
        const unreadCls = m.unread ? "unread" : "";
        const imp = m.important ? "⭐" : "";
        const fromLine = m.kind === "system" || m.kind === "daily_reward" 
          ? m.from_name 
          : `${m.from_name} → ${m.to_name}`;
        const snippet = safeStr(m.body).replace(/\s+/g, " ").slice(0, 70);
        const active = m.id === activeId ? "active" : "";
        
        let icon = "✉️";
        if (m.kind === "system") icon = "📩";
        if (m.kind === "daily_reward") icon = "🎁";
        if (m.kind === "mission") icon = "🎯";
        if (m.kind === "arena") icon = "⚔️";
        if (m.kind === "guild") icon = "👥";
        
        const timeText = fmtTime(m.created_at);
        
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
    
    // Update unread count
    updateUnreadCount(threads);
  }

  function updateUnreadCount(threads) {
    const count = threads.filter(m => m.unread).length;
    cache.unreadCount = count;
    
    // Update v menu (pokud existuje element)
    const mailBtn = document.querySelector('a[href="mail.html"]');
    if (mailBtn) {
      const existing = mailBtn.querySelector('.unread-badge');
      if (existing) existing.remove();
      
      if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'unread-badge';
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.cssText = `
          position: absolute;
          top: 8px;
          right: 8px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          font-size: 10px;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
        `;
        mailBtn.style.position = 'relative';
        mailBtn.appendChild(badge);
      }
    }
  }

  function renderDetail(mail, stats) {
    if (!detailEl) return;
    
    if (!mail) {
      detailEl.innerHTML = `<div class="mail-detail-body"><p>Vyber zprávu vlevo.</p></div>`;
      return;
    }

    const isWelcome = mail.id === "welcome";
    const isDaily = mail.kind === "daily_reward";
    const claimed = Boolean(stats?.flags?.welcome_mail_claimed);
    const dailyClaimed = checkDailyClaimed(stats);

    const bodyHtml = safeStr(mail.body)
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\n/g, "<br>");

    const canDelete = !isWelcome && !isDaily;
    const canClaim = (isWelcome && !claimed) || (isDaily && !dailyClaimed);

    let claimButton = "";
    if (isWelcome) {
      claimButton = `<button id="claimWelcome" class="reply-btn primary" ${claimed ? "disabled" : ""}>${claimed ? "Vyzvednuto ✓" : "🎁 Vyzvednout odměnu"}</button>`;
    } else if (isDaily) {
      claimButton = `<button id="claimDaily" class="reply-btn primary" ${dailyClaimed ? "disabled" : ""}>${dailyClaimed ? "Vyzvednuto ✓" : "🎁 Vyzvednout denní bonus"}</button>`;
    }

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
          ${claimButton}
          ${canDelete ? `<button id="deleteMail" class="reply-btn danger">🗑️ Smazat</button>` : ""}
          ${!isWelcome && !isDaily ? `<button id="replyMail" class="reply-btn">↩️ Odpovědět</button>` : ""}
        </div>
      </div>
    `;

    // Wire buttons
    const welcomeBtn = document.getElementById("claimWelcome");
    if (welcomeBtn) welcomeBtn.addEventListener("click", () => claimWelcome(stats));

    const dailyBtn = document.getElementById("claimDaily");
    if (dailyBtn) dailyBtn.addEventListener("click", () => claimDaily(stats));

    const delBtn = document.getElementById("deleteMail");
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        if (!confirm("Opravdu smazat tuto zprávu?")) return;
        try {
          await deleteMail(cache.userId, mail.id);
          cache.activeId = null;
          await refresh(stats);
          renderDetail(null, stats);
          showNotification("Zpráva smazána", "success");
        } catch (e) {
          console.error(e);
          showNotification("Chyba při mazání", "error");
        }
      });
    }

    const replyBtn = document.getElementById("replyMail");
    if (replyBtn) {
      replyBtn.addEventListener("click", () => {
        openCompose();
        if (composeTo) composeTo.value = mail.from_name;
        if (composeSubject) composeSubject.value = `Re: ${mail.subject}`;
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

  // ===== ACTIONS =====
  async function claimWelcome(stats) {
    if (window.SFReady) await window.SFReady;
    const s = window.SF?.stats || stats;
    if (!s || s?.flags?.welcome_mail_claimed) return;

    const flags = { ...(s.flags || {}), welcome_mail_claimed: true };
    const money = Number(s.money ?? 0) + 5000;
    const cigarettes = Number(s.cigarettes ?? 0) + 100;
    
    window.SF.updateStats({ money, cigarettes, flags });
    
    await refresh(s);
    const all = buildMergedThreads(s);
    const mail = all.find((m) => m.id === "welcome");
    renderDetail(mail, s);
    
    showNotification("🎁 Odměna vyzvednuta! +5000₽ +100 cig", "success");
  }

  function checkDailyClaimed(stats) {
    const today = new Date().toISOString().split('T')[0];
    return stats?.flags?.[`daily_claimed_${today}`] || false;
  }

  async function claimDaily(stats) {
    if (window.SFReady) await window.SFReady;
    const s = window.SF?.stats || stats;
    if (!s) return;

    const today = new Date().toISOString().split('T')[0];
    const flagKey = `daily_claimed_${today}`;
    
    if (s?.flags?.[flagKey]) return;

    const flags = { ...(s.flags || {}), [flagKey]: true };
    const money = Number(s.money ?? 0) + 1000;
    const cigarettes = Number(s.cigarettes ?? 0) + 20;
    const energy = Math.min(Number(s.max_energy ?? 100), Number(s.energy ?? 100) + 50);
    
    window.SF.updateStats({ money, cigarettes, energy, flags });
    
    await refresh(s);
    const all = buildMergedThreads(s);
    const mail = all.find((m) => m.id === `daily_${today}`);
    renderDetail(mail, s);
    
    showNotification("🎁 Denní bonus vyzvednuto! +1000₽ +20 cig +50 energie", "success");
  }

  async function markAllRead() {
    try {
      await markAllAsRead(cache.userId);
      cache.mails.forEach(m => m.unread = false);
      const stats = window.SF?.stats;
      const all = buildMergedThreads(stats);
      renderList(filterByTab(all), cache.activeId);
      showNotification("✓ Vše označeno jako přečtené", "success");
    } catch (e) {
      console.error(e);
      showNotification("Chyba při označování", "error");
    }
  }

  async function deleteAllReadMails() {
    if (!confirm("Opravdu smazat všechny přečtené zprávy?")) return;
    
    try {
      await deleteAllRead(cache.userId);
      cache.mails = cache.mails.filter(m => m.unread);
      cache.activeId = null;
      const stats = window.SF?.stats;
      const all = buildMergedThreads(stats);
      renderList(filterByTab(all), cache.activeId);
      renderDetail(null, stats);
      showNotification("✓ Přečtené zprávy smazány", "success");
    } catch (e) {
      console.error(e);
      showNotification("Chyba při mazání", "error");
    }
  }

  // ===== WIRING =====
  function wireListClicks(stats) {
    if (!listEl) return;
    
    listEl.addEventListener("click", async (e) => {
      const item = e.target?.closest?.(".mail-item");
      const id = item?.getAttribute?.("data-id");
      if (!id) return;

      cache.activeId = id;

      // Mark as read
      if (id !== "welcome" && !id.startsWith("daily_")) {
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
          from_name: window.SF?.stats?.stats?.character_name || "TY",
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
        showNotification("✓ Zpráva odeslána", "success");
      } catch (e) {
        console.error(e);
        showNotification("Chyba při odesílání", "error");
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

  // ===== BUILD & REFRESH =====
  function buildMergedThreads(stats) {
    const threads = [];
    
    // Welcome mail
    threads.push(ensureWelcome(stats));
    
    // Daily reward mail (jen pokud ještě nebyl vyzvednuto dnes)
    const today = new Date().toISOString().split('T')[0];
    if (!stats?.flags?.[`daily_claimed_${today}`]) {
      threads.push(getDailyRewardMail());
    }
    
    // User mails from DB
    threads.push(...(cache.mails || []));
    
    // Sort by date
    threads.sort((a, b) => 
      String(b.created_at || b.createdAt).localeCompare(String(a.created_at || a.createdAt))
    );
    
    return threads;
  }

  async function refresh(stats) {
    try {
      cache.mails = await fetchMails(cache.userId);
      cache.lastRefresh = Date.now();
    } catch (e) {
      console.error("Mail refresh error:", e);
      cache.mails = [];
    }

    const all = buildMergedThreads(stats);
    renderList(filterByTab(all), cache.activeId);
  }

  // ===== NOTIFICATIONS =====
  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      background: ${type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'};
      color: white;
      border-radius: 12px;
      font-weight: 900;
      font-size: 14px;
      box-shadow: 0 8px 20px rgba(0,0,0,.6);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // ===== BOOT =====
  async function start() {
    if (window.SFReady) await window.SFReady;

    const userId = window.SF?.user?.id || window.SF?.stats?.user_id;
    cache.userId = userId;

    if (!userId) {
      location.href = "login.html";
      return;
    }

    // Set default tab
    if (!tabBtns.some((b) => b.classList.contains("active")) && tabBtns[0]) {
      tabBtns[0].classList.add("active");
    }

    const stats = window.SF?.stats;
    
    // Initial load
    await refresh(stats);
    renderDetail(null, stats);
    
    // Wire events
    wireListClicks(stats);
    wireCompose(stats);
    wireTabs(stats);
    
    // Setup realtime
    setupRealtime(userId, stats);
    
    // Auto-refresh každých 10s
    refreshTimer = setInterval(() => {
      refresh(stats);
    }, REFRESH_INTERVAL);

    // Re-render when stats change
    document.addEventListener("sf:stats", async (e) => {
      const st = e.detail || window.SF?.stats;
      await refresh(st);
      const all = buildMergedThreads(st);
      const mail = all.find((m) => m.id === cache.activeId);
      renderDetail(mail || null, st);
    });

    console.log("✅ Mail system loaded!");
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    if (refreshTimer) clearInterval(refreshTimer);
    if (realtimeSubscription) {
      try {
        const sb = supabaseClient();
        sb?.removeChannel(realtimeSubscription);
      } catch (e) {
        console.error(e);
      }
    }
  });

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      start().catch(console.error);
    });
  } else {
    start().catch(console.error);
  }

  // Expose API
  window.MailAPI = {
    markAllRead,
    deleteAllRead: deleteAllReadMails,
    refresh: () => refresh(window.SF?.stats),
    sendMail: async (to, subject, body) => {
      await insertMail(cache.userId, {
        from_name: window.SF?.stats?.stats?.character_name || "TY",
        to_name: to,
        subject,
        body,
        unread: false,
        important: false,
        kind: "player",
      });
      await refresh(window.SF?.stats);
    }
  };
})();

// CSS Animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);

console.log("📬 Enhanced Mail System Loaded!");
