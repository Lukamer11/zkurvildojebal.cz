// mail.js
(() => {
  "use strict";

  // -------------------------
  // SUPABASE INIT (bez konfliktu názvu "supabase")
  // -------------------------
  const DEFAULT_SUPABASE_URL = "https://bmmaijlbpwgzhrxzxphf.supabase.co";
  const DEFAULT_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbWFpamxicHdnemhyeng6eHB"
    + "oZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzI0NDEzNzY3LCJleHAiOjIwODI0NDA5MDcwfQ.s0YQVnAjMXFu1pSI1NXZ2naSab179N0vQPglsmy3Pgw";

  const SUPABASE_URL =
    window.SUPABASE_URL ||
    localStorage.getItem("SUPABASE_URL") ||
    DEFAULT_SUPABASE_URL;

  const SUPABASE_ANON_KEY =
    window.SUPABASE_ANON_KEY ||
    localStorage.getItem("SUPABASE_ANON_KEY") ||
    DEFAULT_SUPABASE_ANON_KEY;

  const FINAL_SUPABASE_URL = SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const FINAL_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;


  // sjednocení napříč hrou: primárně Supabase auth user_id
  const userId = localStorage.getItem("user_id") || localStorage.getItem("slavFantasyUserId") || "1";

  function getRequiredXP(level) {
    // stejné jako shop.js :contentReference[oaicite:1]{index=1}
    return Math.floor(100 * Math.pow(1.5, Math.max(1, level) - 1));
  }

  function getSbClient() {
    // 1) když už to zakládáš v login.html → používej to
    if (window.supabaseClient) return window.supabaseClient;

    // 2) když je přítomná CDN knihovna (window.supabase)
    const lib = window.supabase;
    if (!lib || typeof lib.createClient !== "function") return null;

    if (!FINAL_SUPABASE_URL || !FINAL_SUPABASE_ANON_KEY) return null;

    // DŮLEŽITÉ: neukládat do "const supabase = ..." (kolize)
    window.supabaseClient = lib.createClient(FINAL_SUPABASE_URL, FINAL_SUPABASE_ANON_KEY);
    return window.supabaseClient;
  }

  const sb = getSbClient();

  // -------------------------
  // DOM
  // -------------------------
  const listEl = document.querySelector(".mail-list");
  const detailEl = document.querySelector(".mail-detail-section");
  const tabBtns = Array.from(document.querySelectorAll(".tab-btn"));

  const moneyEl = document.getElementById("money");
  const cigEl = document.getElementById("cigarettes");
  const levelEl = document.getElementById("levelDisplay") || document.querySelector(".level-number");

  const xpFillEl = document.getElementById("xpFill");
  const xpTextEl = document.getElementById("xpText");
  const composeOpenBtn = document.querySelector(".compose-open-btn");
  const composePanel = document.getElementById("composePanel");
  const composeToEl = document.getElementById("composeTo");
  const composeSubjectEl = document.getElementById("composeSubject");
  const composeBodyEl = document.getElementById("composeBody");
  const composeSendBtn = document.getElementById("composeSend");
  const composeCancelBtn = document.getElementById("composeCancel");
  const composeCloseBtn = document.querySelector(".compose-close");


  // -------------------------
  // STATE
  // -------------------------
  let player = { level: 1, xp: 0, money: 0, cigarettes: 0 };
  let allMails = [];
  let activeMailId = null;
  let activeFilter = "all"; // all | unread | important

  // -------------------------
  // HELPERS
  // -------------------------
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText = `
      position: fixed; left: 50%; top: 18px; transform: translateX(-50%);
      background: rgba(0,0,0,.75);
      border: 2px solid rgba(201,164,74,.6);
      color: #f1d27a;
      font-weight: 1000;
      padding: 10px 14px;
      border-radius: 12px;
      z-index: 99999;
      box-shadow: 0 10px 30px rgba(0,0,0,.6);
      max-width: min(720px, 92vw);
      text-align: center;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  function formatRelative(iso) {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    const min = Math.floor(diff / 60000);
    if (min < 1) return "teď";
    if (min < 60) return `před ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `před ${h} hod`;
    const d = Math.floor(h / 24);
    if (d === 1) return "včera";
    return `před ${d} dny`;
  }

  function badgeToClass(txt) {
    const t = String(txt || "").toUpperCase();
    if (t === "NEW") return "new";
    if (t === "ODMĚNA") return "reward";
    if (t === "VÝZVA") return "challenge";
    if (t === "VYZVEDNUTO") return "new";
    return "new";
  }

  function hasBadge(mail, b) {
    const badges = Array.isArray(mail?.badges) ? mail.badges : [];
    return badges.map(x => String(x).toUpperCase()).includes(String(b).toUpperCase());
  }

  function applyFilter(mails) {
    if (activeFilter === "unread") return mails.filter(m => !m.is_read);
    if (activeFilter === "important") return mails.filter(m => m.is_starred);
    return mails;
  }

  function syncPlayerUI() {
    if (moneyEl) moneyEl.textContent = String(player.money);
    if (cigEl) cigEl.textContent = String(player.cigarettes);
    if (levelEl) levelEl.textContent = String(player.level);

    if (xpFillEl && xpTextEl) {
      const req = getRequiredXP(player.level);
      const cur = Math.max(0, Number(player.xp || 0));
      xpTextEl.textContent = `${cur} / ${req}`;
      const pct = req > 0 ? (cur / req) * 100 : 0;
      xpFillEl.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }
  }

  // -------------------------
  // SUPABASE: PLAYER STATS (sync jako postava)
  // -------------------------
  async function fetchPlayerStats() {
    if (!sb) return null;

    const { data, error } = await sb
      .from("player_stats")
      .select("user_id, level, xp, money, cigarettes")
      .eq("user_id", userId)
      .limit(1);

    if (error) {
      console.error("player_stats select error:", error);
      return null;
    }

  async function safeUpsertPlayerStats(basePayload) {
    if (!sb) return false;

    let payload = { ...basePayload };
    for (let attempts = 0; attempts < 6; attempts++) {
      const { error } = await sb
        .from("player_stats")
        .upsert(payload, { onConflict: "user_id" });

      if (!error) return true;

      const msg = String(error?.message || "");
      const m = msg.match(/Could not find the '([^']+)' column/);
      if (error?.code === "PGRST204" && m) {
        const missing = m[1];
        if (missing in payload) {
          console.warn("mail.js: chybí sloupec, vyhazuji z payloadu:", missing);
          delete payload[missing];
          continue;
        }
      }
      console.error("mail.js: upsert error:", error);
      return false;
    }
    return false;
  }

    return (data && data[0]) ? data[0] : null;
  }

  async function ensurePlayerStats() {
    if (!sb) return;

    const st = await fetchPlayerStats();
    if (st) {
      player.level = Number(st.level ?? 1);
      player.xp = Number(st.xp ?? 0);
      player.money = Number(st.money ?? 0);
      player.cigarettes = Number(st.cigarettes ?? 0);
      syncPlayerUI();
      return;
    }

    const payload = { user_id: userId, level: 1, xp: 0, money: 100, cigarettes: 0, updated_at: new Date().toISOString() };
    await safeUpsertPlayerStats(payload);

    player = { level: 1, xp: 0, money: 100, cigarettes: 0 };
    syncPlayerUI();
  }

    const payload = { user_id: userId, level: 1, xp: 0, money: 100, cigarettes: 0 };
    const { error } = await sb.from("player_stats").insert(payload);
    if (error) console.error("player_stats insert error:", error);

    player = { level: 1, xp: 0, money: 100, cigarettes: 0 };
    syncPlayerUI();
  }

  async function addRewardsToPlayer(addMoney, addCigs) {
    if (!sb) return false;

    const st = await fetchPlayerStats();
    const curMoney = Number(st?.money ?? player.money ?? 0);
    const curCigs = Number(st?.cigarettes ?? player.cigarettes ?? 0);

    const nextMoney = curMoney + addMoney;
    const nextCigs = curCigs + addCigs;

    const ok = await safeUpsertPlayerStats({
      user_id: userId,
      money: nextMoney,
      cigarettes: nextCigs,
      updated_at: new Date().toISOString()
    });

    if (!ok) return false;

    player.money = nextMoney;
    player.cigarettes = nextCigs;
    syncPlayerUI();
    return true;
  }

  // -------------------------
  // SUPABASE: MAIL
  // -------------------------
  async function fetchMails() {
    if (!sb) return [];

    const { data, error } = await sb
      .from("player_mail")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("player_mail select error:", error);
      return [];
    }
    return data || [];
  }

  function openCompose() {
    if (!composePanel) return;
    composePanel.classList.add("open");
    composePanel.setAttribute("aria-hidden", "false");
    composeToEl?.focus();
  }

  function closeCompose() {
    if (!composePanel) return;
    composePanel.classList.remove("open");
    composePanel.setAttribute("aria-hidden", "true");
  }

  function clearCompose() {
    if (composeToEl) composeToEl.value = "";
    if (composeSubjectEl) composeSubjectEl.value = "";
    if (composeBodyEl) composeBodyEl.value = "";
  }

  async function sendMail(to, subject, bodyText) {
    if (!sb) return null;

    // "to" bereme jako user_id příjemce (profil hráče v žebříčku posílá user_id)
    const recipientId = String(to || "").trim() || userId;

    const now = new Date().toISOString();
    const preview = bodyText.length > 60 ? bodyText.slice(0, 60) + "..." : bodyText;

    const fromName = (localStorage.getItem('user_email') || 'TY').split('@')[0] || 'TY';
    const fromEmail = localStorage.getItem('user_email') || 'player@slavfantasy.local';

    const payload = {
      // zpráva se uloží do inboxu příjemce
      user_id: recipientId,
      from_name: fromName.toUpperCase(),
      from_email: fromEmail,
      subject: subject || "(bez předmětu)",
      preview,
      body: `<p>${escapeHtml(bodyText).replaceAll("\n","<br>")}</p>`,
      icon: "📝",
      badges: ["NEW"],
      is_read: false,
      is_starred: false,
      created_at: now
    };

    const { data, error } = await sb
      .from("player_mail")
      .insert([payload])
      .select("*")
      .limit(1);

    if (error) {
      console.error("player_mail insert error:", error);
      return null;
    }

    return data?.[0] || null;
  }

  
  function randomMailPack() {
    const senders = [
      { name: "BORIS GOPNIKOV", email: "boris.gopnikov@arena.ru", icon: "📩" },
      { name: "SYSTEM", email: "system@slavclicker.ru", icon: "🎁" },
      { name: "IGOR THE MIGHTY", email: "igor@arena.ru", icon: "⚔️" },
      { name: "RED ARMY", email: "recruit@redarmy.ru", icon: "👥" },
      { name: "ARENA MASTER", email: "master@arena.ru", icon: "🏆" },
      { name: "SHOP KEEPER", email: "keeper@shop.ru", icon: "🛡️" },
      { name: "TREASURY", email: "treasury@arena.ru", icon: "💰" },
      { name: "DR. ABAWUWU", email: "abawu@magic.ru", icon: "🔮" }
    ];

    const subjects = [
      "Vítej v aréně, soudruhu!",
      "Denní odměna připravena!",
      "Výzva na souboj!",
      "Pozvánka do guildy",
      "Nové zboží v obchodě!",
      "Výplata za dokončené úkoly",
      "Tajná nabídka: černý trh",
      "Varování: špeh v tvé čtvrti"
    ];

    const bodies = [
      "Bez grindu není sláva. A bez slávy jsi nula.",
      "Odměna čeká. Vyzvedni si loot a pokračuj v utrpení.",
      "Přijmi výzvu a dokaž, že nejsi salát.",
      "Nábor do guildy: bude to bolet, ale stojí to za to.",
      "Nové itemy. Vyšší level = lepší staty. Šetři rubly.",
      "Výplata dorazila. Pozor: upgrady jsou dražší než tvoje duše.",
      "Pšššt. Některé věci se kupují jen v noci.",
      "Někdo tě sleduje. Zlepši luck a dex, nebo budeš bez critu."
    ];

    const badgesPool = [[], ["NEW"], ["ODMĚNA"], ["VÝZVA"], ["NEW", "ODMĚNA"]];
    const n = 7 + Math.floor(Math.random() * 3);
    const out = [];

    for (let i = 0; i < n; i++) {
      const s = pick(senders);
      const subj = pick(subjects);
      const body = pick(bodies);
      const preview = body.length > 60 ? body.slice(0, 60) + "..." : body;

      const minutesAgo = 5 + Math.floor(Math.random() * (60 * 24 * 5));
      const createdAt = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

      const badges = pick(badgesPool);

      out.push({
        user_id: userId,
        from_name: s.name,
        from_email: s.email,
        subject: subj,
        preview,
        body: `<p>${escapeHtml(body)}</p>`,
        icon: s.icon,
        badges,
        is_read: badges.includes("NEW") ? false : Math.random() < 0.6,
        is_starred: Math.random() < 0.12,
        created_at: createdAt
      });
    }

    out[0].is_read = false;
    out[0].badges = Array.from(new Set([...(out[0].badges || []), "NEW"]));
    return out;
  }

  async function seedMailsIfEmpty() {
    if (!sb) return [];

    const existing = await fetchMails();
    if (existing.length) return existing;

    const pack = randomMailPack();
    const { data, error } = await sb
      .from("player_mail")
      .insert(pack)
      .select("*");

    if (error) {
      console.error("player_mail seed error:", error);
      return [];
    }
    return data || [];
  }

  async function setRead(mailId, read) {
    if (!sb) return;
    const { error } = await sb
      .from("player_mail")
      .update({ is_read: !!read })
      .eq("id", mailId)
      .eq("user_id", userId);
    if (error) console.error("mail setRead error:", error);
  }

  async function updateBadges(mailId, badges) {
    if (!sb) return;
    const { error } = await sb
      .from("player_mail")
      .update({ badges })
      .eq("id", mailId)
      .eq("user_id", userId);
    if (error) console.error("mail updateBadges error:", error);
  }

  async function toggleStar(mailId, starred) {
    if (!sb) return;
    const { error } = await sb
      .from("player_mail")
      .update({ is_starred: !!starred })
      .eq("id", mailId)
      .eq("user_id", userId);
    if (error) console.error("mail toggleStar error:", error);
  }

  async function deleteMail(mailId) {
    if (!sb) return;
    const { error } = await sb
      .from("player_mail")
      .delete()
      .eq("id", mailId)
      .eq("user_id", userId);
    if (error) console.error("mail delete error:", error);
  }

  // -------------------------
  // RENDER
  // -------------------------
  function renderList() {
    if (!listEl) return;

    const filtered = applyFilter(allMails);

    listEl.innerHTML = filtered.map(m => {
      const unreadClass = m.is_read ? "" : " unread";
      const activeClass = (m.id === activeMailId) ? " active" : "";
      const badges = Array.isArray(m.badges) ? m.badges : [];

      const badgesHTML = badges.length
        ? `<div class="mail-badges">${badges.map(b => `<span class="badge ${badgeToClass(b)}">${escapeHtml(b)}</span>`).join("")}</div>`
        : "";

      return `
        <div class="mail-item${unreadClass}${activeClass}" data-id="${m.id}">
          <div class="mail-icon">${escapeHtml(m.icon || "📩")}</div>
          <div class="mail-info">
            <div class="mail-from">${escapeHtml(m.from_name)}</div>
            <div class="mail-subject">${escapeHtml(m.subject)}</div>
            <div class="mail-preview">${escapeHtml(m.preview)}</div>
          </div>
          <div class="mail-meta">
            <div class="mail-time">${formatRelative(m.created_at)}</div>
            ${badgesHTML}
          </div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll(".mail-item").forEach(el => {
      el.addEventListener("click", () => {
        const id = Number(el.dataset.id);
        openMail(id);
      });
    });
  }

  function rewardBlock(mail) {
    const isReward = hasBadge(mail, "ODMĚNA");
    const claimed = hasBadge(mail, "VYZVEDNUTO");
    if (!isReward && !claimed) return "";

    const baseMoney = 80 + Math.floor(player.level * 25);
    const baseCigs = 1 + Math.floor(player.level / 4);

    if (claimed) {
      return `
        <div class="mail-attachments">
          <div class="attachment-item">
            <div class="attachment-icon">✅</div>
            <div class="attachment-info">
              <div class="attachment-name">Balíček vyzvednut</div>
              <div class="attachment-size">Už vyzvednuto.</div>
            </div>
            <button class="claim-btn" disabled style="opacity:.5; cursor:not-allowed;">Hotovo</button>
          </div>
        </div>
      `;
    }

    const bonusMoney = baseMoney + Math.floor(Math.random() * 120);
    const bonusCigs = baseCigs + Math.floor(Math.random() * 4);

    return `
      <div class="mail-attachments">
        <div class="attachment-item">
          <div class="attachment-icon">🎁</div>
          <div class="attachment-info">
            <div class="attachment-name">Odměna za grind</div>
            <div class="attachment-size">💰 +${bonusMoney}₽ &nbsp;&nbsp; 🚬 +${bonusCigs}</div>
          </div>
          <button class="claim-btn" data-rm="${bonusMoney}" data-rc="${bonusCigs}">Vyzvednout</button>
        </div>
      </div>
    `;
  }

  function renderDetail(mail) {
    if (!detailEl) return;

    if (!mail) {
      detailEl.innerHTML = `<div class="mail-detail-body"><p>Vyber zprávu vlevo.</p></div>`;
      return;
    }

    const starIcon = mail.is_starred ? "⭐" : "☆";

    detailEl.innerHTML = `
      <div class="mail-detail-header">
        <div class="detail-from">
          <div class="sender-avatar">${escapeHtml(mail.icon || "📩")}</div>
          <div class="sender-info">
            <div class="sender-name">${escapeHtml(mail.from_name || "NEZNÁMÝ")}</div>
            <div class="sender-email">${escapeHtml(mail.from_email || "")}</div>
          </div>
        </div>

        <div class="detail-actions">
          <button class="action-btn star-btn" title="Důležité">${starIcon}</button>
          <button class="action-btn delete-btn" title="Smazat">🗑️</button>
        </div>
      </div>

      <div class="mail-detail-subject">
        <h2>${escapeHtml(mail.subject || "")}</h2>
        <div class="mail-detail-time">${formatRelative(mail.created_at)}</div>
      </div>

      <div class="mail-detail-body">
        ${mail.body || `<p>${escapeHtml(mail.preview || "")}</p>`}
        ${rewardBlock(mail)}
      </div>
    `;

    const starBtn = detailEl.querySelector(".star-btn");
    const delBtn = detailEl.querySelector(".delete-btn");

    starBtn?.addEventListener("click", async () => {
      mail.is_starred = !mail.is_starred;
      await toggleStar(mail.id, mail.is_starred);
      renderList();
      renderDetail(mail);
    });

    delBtn?.addEventListener("click", async () => {
      await deleteMail(mail.id);
      allMails = allMails.filter(m => m.id !== mail.id);
      activeMailId = allMails[0]?.id ?? null;
      renderList();
      renderDetail(allMails.find(m => m.id === activeMailId) || null);
    });

    const claimBtn = detailEl.querySelector(".claim-btn");
    claimBtn?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled) return;

      if (hasBadge(mail, "VYZVEDNUTO")) { toast("Už vyzvednuto."); return; }
      if (!hasBadge(mail, "ODMĚNA")) { toast("Tady žádná odměna není."); return; }

      const addMoney = Number(btn.getAttribute("data-rm") || "0");
      const addCigs  = Number(btn.getAttribute("data-rc") || "0");

      btn.disabled = true;

      const ok = await addRewardsToPlayer(addMoney, addCigs);
      if (!ok) {
        btn.disabled = false;
        toast("Chyba: odměna se neuložila.");
        return;
      }

      let badges = Array.isArray(mail.badges) ? [...mail.badges] : [];
      badges = badges.filter(b => !["ODMĚNA","NEW"].includes(String(b).toUpperCase()));
      if (!badges.map(x => String(x).toUpperCase()).includes("VYZVEDNUTO")) badges.push("VYZVEDNUTO");

      mail.badges = badges;
      mail.is_read = true;

      await setRead(mail.id, true);
      await updateBadges(mail.id, badges);

      toast(`+${addMoney}₽  +${addCigs}🚬`);
      renderList();
      renderDetail(mail);
    });
  }

  async function openMail(id) {
    activeMailId = id;
    const mail = allMails.find(m => m.id === id);
    if (!mail) return;

    if (!mail.is_read) {
      mail.is_read = true;
      await setRead(id, true);
      const badges = (Array.isArray(mail.badges) ? mail.badges : [])
        .filter(b => String(b).toUpperCase() !== "NEW");
      mail.badges = badges;
      await updateBadges(id, badges);
    }

    renderList();
    renderDetail(mail);
  }

  function initTabs() {
    const map = { 0: "all", 1: "unread", 2: "important" };
    tabBtns.forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        tabBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = map[idx] || "all";
        renderList();
        renderDetail(allMails.find(m => m.id === activeMailId) || null);
      });
    });
  }

  async function boot() {
    initTabs();
        // compose events
    composeOpenBtn?.addEventListener("click", () => {
      openCompose();
    });

    composeCancelBtn?.addEventListener("click", () => {
      closeCompose();
    });

    composeCloseBtn?.addEventListener("click", () => {
      closeCompose();
    });

    composeSendBtn?.addEventListener("click", async () => {
      const to = (composeToEl?.value || "").trim();
      const subject = (composeSubjectEl?.value || "").trim();
      const body = (composeBodyEl?.value || "").trim();

      if (!to) { toast("Zadej adresáta."); composeToEl?.focus(); return; }
      if (!body) { toast("Napiš text zprávy."); composeBodyEl?.focus(); return; }

      composeSendBtn.disabled = true;

      const created = await sendMail(to, subject, body);
      if (!created) {
        toast("Nešlo odeslat (DB chyba).");
        composeSendBtn.disabled = false;
        return;
      }

      // přidej nahoru do listu a otevři
      allMails = [created, ...allMails];
      activeMailId = created.id;

      renderList();
      renderDetail(created);

      toast("Zpráva odeslána.");
      composeSendBtn.disabled = false;
      clearCompose();
      closeCompose();
    });


    if (!sb) {
      toast("Supabase není připojený – nastav SUPABASE_URL a SUPABASE_ANON_KEY nebo používej window.supabaseClient z login.html.");
      return;
    }

    await ensurePlayerStats();

    const seeded = await seedMailsIfEmpty();
    allMails = seeded.length ? seeded : await fetchMails();

    activeMailId = allMails[0]?.id ?? null;
    renderList();
    renderDetail(allMails.find(m => m.id === activeMailId) || null);

    // Pokud někdo přišel z profilu hráče: mail.html?to=<user_id>&name=...&subject=...
    try{
      const p = new URLSearchParams(location.search);
      const to = (p.get('to') || '').trim();
      if (to){
        const name = (p.get('name') || '').trim();
        const sub = (p.get('subject') || '').trim();
        openCompose();
        if (composeToEl) composeToEl.value = to;
        if (composeSubjectEl && (sub || name)) composeSubjectEl.value = sub || `Zpráva pro ${name}`;
        if (composeBodyEl) composeBodyEl.focus();
      }
    }catch{}
  }

  document.addEventListener("DOMContentLoaded", boot);
})();


