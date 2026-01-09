// mail.js - SUPABASE SYNC VERSION
(() => {
  "use strict";

  // ====== SUPABASE CONFIG ======
  const SUPABASE_URL = 'https://jbfvoxlcociwtyobaotz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZnZveGxjb2Npd3R5b2Jhb3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTQ3MTgsImV4cCI6MjA4MzM3MDcxOH0.ydY1I-rVv08Kg76wI6oPgAt9fhUMRZmsFxpc03BhmkA';

  let supabase = null;

  // ====== HELPERS ======
  function getUserId() {
    return (window.SF && window.SF.user && window.SF.user.id) || null;
  }

  function getUserName() {
    return localStorage.getItem('playerName') || 
           localStorage.getItem('nickname') || 
           localStorage.getItem('nick') || 
           'PLAYER';
  }

  function getUserEmail() {
    return localStorage.getItem('user_email') || 
           `${getUserName().toLowerCase()}@slavfantasy.local`;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function toast(msg, type = 'ok') {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText = `
      position: fixed; left: 50%; top: 18px; transform: translateX(-50%);
      background: ${type === 'err' ? 'rgba(160,40,40,.95)' : 'rgba(20,120,60,.95)'};
      border: 2px solid rgba(201,164,74,.6);
      color: #fff;
      font-weight: 1000;
      padding: 10px 14px;
      border-radius: 12px;
      z-index: 99999;
      box-shadow: 0 10px 30px rgba(0,0,0,.6);
      max-width: min(720px, 92vw);
      text-align: center;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
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

  function getRequiredXP(level) {
    return Math.floor(100 * Math.pow(1.5, Math.max(1, level) - 1));
  }

  // ====== DOM ELEMENTS ======
  const listEl = document.querySelector(".mail-list");
  const detailEl = document.querySelector(".mail-detail-section");
  const tabBtns = Array.from(document.querySelectorAll(".tab-btn"));

  const moneyEl = document.getElementById("money");
  const cigEl = document.getElementById("cigarettes");
  const levelEl = document.getElementById("levelDisplay");
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

  // ====== STATE ======
  let player = { level: 1, xp: 0, money: 0, cigarettes: 0 };
  let allMails = [];
  let activeMailId = null;
  let activeFilter = "all"; // all | unread | important

  // ====== SUPABASE MANAGER ======
  class SupabaseManager {
    static async init() {
      console.log('🔥 Initializing Supabase for Mail...');
      
      const lib = window.supabase;
      supabase = window.supabaseClient;
      
      if (!supabase) {
        console.error('❌ Supabase not available');
        return false;
      }
      
      console.log('✅ Supabase initialized');
      return true;
    }

    static async fetchPlayerStats() {
      console.log('📊 Fetching player stats...');
      
      try {
        const userId = getUserId();
        const { data, error } = await supabase
          .from("player_stats")
          .select("user_id, level, xp, money, cigarettes")
          .eq("user_id", userId)
          .limit(1)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            console.log('ℹ️ No player stats found, will create');
            return null;
          }
          console.error('❌ Error fetching player stats:', error);
          return null;
        }

        console.log('✅ Player stats loaded:', data);
        return data;
      } catch (err) {
        console.error('❌ Exception fetching player stats:', err);
        return null;
      }
    }

    static async ensurePlayerStats() {
      console.log('🔧 Ensuring player stats exist...');
      
      const existing = await this.fetchPlayerStats();
      if (existing) {
        player.level = Number(existing.level ?? 1);
        player.xp = Number(existing.xp ?? 0);
        player.money = Number(existing.money ?? 0);
        player.cigarettes = Number(existing.cigarettes ?? 0);
        return true;
      }

      // Create new player stats
      try {
        const userId = getUserId();
        const { error } = await supabase
          .from("player_stats")
          .insert([{
            user_id: userId,
            level: 1,
            xp: 0,
            money: 100,
            cigarettes: 0,
            updated_at: new Date().toISOString()
          }]);

        if (error) {
          console.error('❌ Error creating player stats:', error);
          return false;
        }

        player = { level: 1, xp: 0, money: 100, cigarettes: 0 };
        console.log('✅ Player stats created');
        return true;
      } catch (err) {
        console.error('❌ Exception creating player stats:', err);
        return false;
      }
    }

    static async updatePlayerStats(updates) {
      console.log('💾 Updating player stats:', updates);
      
      try {
        const userId = getUserId();
        const { error } = await supabase
          .from("player_stats")
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", userId);

        if (error) {
          console.error('❌ Error updating player stats:', error);
          return false;
        }

        console.log('✅ Player stats updated');
        return true;
      } catch (err) {
        console.error('❌ Exception updating player stats:', err);
        return false;
      }
    }

    static async addRewards(addMoney, addCigs) {
      console.log('🎁 Adding rewards:', { addMoney, addCigs });
      
      const newMoney = player.money + addMoney;
      const newCigs = player.cigarettes + addCigs;

      const success = await this.updatePlayerStats({
        money: newMoney,
        cigarettes: newCigs
      });

      if (success) {
        player.money = newMoney;
        player.cigarettes = newCigs;
        return true;
      }

      return false;
    }

    static async fetchMails() {
      console.log('📬 Fetching mails...');
      
      try {
        const userId = getUserId();
        const { data, error } = await supabase
          .from("player_mail")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error('❌ Error fetching mails:', error);
          return [];
        }

        console.log('✅ Mails loaded:', data?.length || 0);
        return data || [];
      } catch (err) {
        console.error('❌ Exception fetching mails:', err);
        return [];
      }
    }

    static async seedMailsIfEmpty() {
      console.log('🌱 Checking if mails need seeding...');
      
      const existing = await this.fetchMails();
      if (existing.length > 0) {
        console.log('ℹ️ Mails already exist, skipping seed');
        return existing;
      }

      console.log('🌱 Seeding initial mails...');
      const pack = this.generateRandomMails();

      try {
        const { data, error } = await supabase
          .from("player_mail")
          .insert(pack)
          .select("*");

        if (error) {
          console.error('❌ Error seeding mails:', error);
          return [];
        }

        console.log('✅ Mails seeded:', data?.length || 0);
        return data || [];
      } catch (err) {
        console.error('❌ Exception seeding mails:', err);
        return [];
      }
    }

    static generateRandomMails() {
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
      const userId = getUserId();

      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

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

    static async sendMail(to, subject, bodyText) {
      console.log('📨 Sending mail:', { to, subject });
      
      try {
        const recipientId = String(to || "").trim() || getUserId();
        const fromName = getUserName().toUpperCase();
        const fromEmail = getUserEmail();
        
        const preview = bodyText.length > 60 ? bodyText.slice(0, 60) + "..." : bodyText;
        const now = new Date().toISOString();

        const payload = {
          user_id: recipientId,
          from_name: fromName,
          from_email: fromEmail,
          subject: subject || "(bez předmětu)",
          preview,
          body: `<p>${escapeHtml(bodyText).replaceAll("\n","<br>")}</p>`,
          icon: "📨",
          badges: ["NEW"],
          is_read: false,
          is_starred: false,
          created_at: now
        };

        const { data, error } = await supabase
          .from("player_mail")
          .insert([payload])
          .select("*")
          .single();

        if (error) {
          console.error('❌ Error sending mail:', error);
          return null;
        }

        console.log('✅ Mail sent:', data);
        return data;
      } catch (err) {
        console.error('❌ Exception sending mail:', err);
        return null;
      }
    }

    static async setRead(mailId, read) {
      console.log('📖 Setting mail read status:', { mailId, read });
      
      try {
        const userId = getUserId();
        const { error } = await supabase
          .from("player_mail")
          .update({ is_read: !!read })
          .eq("id", mailId)
          .eq("user_id", userId);

        if (error) {
          console.error('❌ Error setting read status:', error);
          return false;
        }

        return true;
      } catch (err) {
        console.error('❌ Exception setting read status:', err);
        return false;
      }
    }

    static async updateBadges(mailId, badges) {
      console.log('🏷️ Updating mail badges:', { mailId, badges });
      
      try {
        const userId = getUserId();
        const { error } = await supabase
          .from("player_mail")
          .update({ badges })
          .eq("id", mailId)
          .eq("user_id", userId);

        if (error) {
          console.error('❌ Error updating badges:', error);
          return false;
        }

        return true;
      } catch (err) {
        console.error('❌ Exception updating badges:', err);
        return false;
      }
    }

    static async toggleStar(mailId, starred) {
      console.log('⭐ Toggling star:', { mailId, starred });
      
      try {
        const userId = getUserId();
        const { error } = await supabase
          .from("player_mail")
          .update({ is_starred: !!starred })
          .eq("id", mailId)
          .eq("user_id", userId);

        if (error) {
          console.error('❌ Error toggling star:', error);
          return false;
        }

        return true;
      } catch (err) {
        console.error('❌ Exception toggling star:', err);
        return false;
      }
    }

    static async deleteMail(mailId) {
      console.log('🗑️ Deleting mail:', mailId);
      
      try {
        const userId = getUserId();
        const { error } = await supabase
          .from("player_mail")
          .delete()
          .eq("id", mailId)
          .eq("user_id", userId);

        if (error) {
          console.error('❌ Error deleting mail:', error);
          return false;
        }

        console.log('✅ Mail deleted');
        return true;
      } catch (err) {
        console.error('❌ Exception deleting mail:', err);
        return false;
      }
    }
  }

  // ====== UI FUNCTIONS ======
  function syncPlayerUI() {
    if (moneyEl) moneyEl.textContent = String(player.money).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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

  function applyFilter(mails) {
    if (activeFilter === "unread") return mails.filter(m => !m.is_read);
    if (activeFilter === "important") return mails.filter(m => m.is_starred);
    return mails;
  }

  function renderList() {
    if (!listEl) return;

    const filtered = applyFilter(allMails);

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #c9a44a;">
          <div style="font-size: 60px; margin-bottom: 16px;">📭</div>
          <div style="font-size: 18px; font-weight: 900;">Žádné zprávy</div>
          <div style="font-size: 14px; margin-top: 8px;">Tvoje schránka je prázdná</div>
        </div>
      `;
      return;
    }

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
      await SupabaseManager.toggleStar(mail.id, mail.is_starred);
      renderList();
      renderDetail(mail);
    });

    delBtn?.addEventListener("click", async () => {
      if (!confirm('Opravdu smazat tuto zprávu?')) return;
      
      await SupabaseManager.deleteMail(mail.id);
      allMails = allMails.filter(m => m.id !== mail.id);
      activeMailId = allMails[0]?.id ?? null;
      renderList();
      renderDetail(allMails.find(m => m.id === activeMailId) || null);
      toast('Zpráva smazána');
    });

    const claimBtn = detailEl.querySelector(".claim-btn");
    claimBtn?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled) return;

      if (hasBadge(mail, "VYZVEDNUTO")) {
        toast("Už vyzvednuto.", 'err');
        return;
      }
      if (!hasBadge(mail, "ODMĚNA")) {
        toast("Tady žádná odměna není.", 'err');
        return;
      }

      const addMoney = Number(btn.getAttribute("data-rm") || "0");
      const addCigs = Number(btn.getAttribute("data-rc") || "0");

      btn.disabled = true;

      const ok = await SupabaseManager.addRewards(addMoney, addCigs);
      if (!ok) {
        btn.disabled = false;
        toast("Chyba: odměna se neuložila.", 'err');
        return;
      }

      let badges = Array.isArray(mail.badges) ? [...mail.badges] : [];
      badges = badges.filter(b => !["ODMĚNA","NEW"].includes(String(b).toUpperCase()));
      if (!badges.map(x => String(x).toUpperCase()).includes("VYZVEDNUTO")) {
        badges.push("VYZVEDNUTO");
      }

      mail.badges = badges;
      mail.is_read = true;

      await SupabaseManager.setRead(mail.id, true);
      await SupabaseManager.updateBadges(mail.id, badges);

      syncPlayerUI();
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
      await SupabaseManager.setRead(id, true);
      const badges = (Array.isArray(mail.badges) ? mail.badges : [])
        .filter(b => String(b).toUpperCase() !== "NEW");
      mail.badges = badges;
      await SupabaseManager.updateBadges(id, badges);
    }

    renderList();
    renderDetail(mail);
  }

  // ====== COMPOSE FUNCTIONS ======
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

  // ====== INITIALIZATION ======
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
    console.log('🚀 Booting Mail System...');
    
    // Initialize Supabase
    const supabaseOk = await SupabaseManager.init();
    if (!supabaseOk) {
      toast("Supabase není připojený", 'err');
      return;
    }

    // Initialize UI
    initTabs();

    // Setup compose events
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

      if (!to) {
        toast("Zadej adresáta.", 'err');
        composeToEl?.focus();
        return;
      }
      if (!body) {
        toast("Napiš text zprávy.", 'err');
        composeBodyEl?.focus();
        return;
      }

      composeSendBtn.disabled = true;

      const created = await SupabaseManager.sendMail(to, subject, body);
      if (!created) {
        toast("Nešlo odeslat (DB chyba).", 'err');
        composeSendBtn.disabled = false;
        return;
      }

      // Přidej nahoru do listu a otevři
      allMails = [created, ...allMails];
      activeMailId = created.id;

      renderList();
      renderDetail(created);

      toast("Zpráva odeslána.");
      composeSendBtn.disabled = false;
      clearCompose();
      closeCompose();
    });

    // Load player stats
    await SupabaseManager.ensurePlayerStats();
    syncPlayerUI();

    // Load mails (seed if empty)
    const seeded = await SupabaseManager.seedMailsIfEmpty();
    allMails = seeded.length ? seeded : await SupabaseManager.fetchMails();

    activeMailId = allMails[0]?.id ?? null;
    renderList();
    renderDetail(allMails.find(m => m.id === activeMailId) || null);

    // Handle URL params (from profile page)
    try {
      const p = new URLSearchParams(location.search);
      const to = (p.get('to') || '').trim();
      if (to) {
        const name = (p.get('name') || '').trim();
        const sub = (p.get('subject') || '').trim();
        openCompose();
        if (composeToEl) composeToEl.value = to;
        if (composeSubjectEl && (sub || name)) {
          composeSubjectEl.value = sub || `Zpráva pro ${name}`;
        }
        if (composeBodyEl) composeBodyEl.focus();
      }
    } catch (err) {
      console.error('Error handling URL params:', err);
    }

    console.log('✅ Mail System booted successfully');
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
