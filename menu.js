// menu.js — jediný globální init (Supabase auth + player_stats + HUD + realtime)

// === i18n bootstrap (loads lang.js if not present) ===
(function(){
  try{
    if (!window.SF) window.SF = {};
    if (!window.SF.i18n){
      const s=document.createElement('script');
      s.src='lang.js';
      s.defer=true;
      document.head.appendChild(s);
    }
  }catch(e){}
})();

// === PWA/offline bootstrap (manifest + service worker) ===
(function(){
  try{
    // manifest
    if (!document.querySelector('link[rel="manifest"]')) {
      const l = document.createElement('link');
      l.rel = 'manifest';
      l.href = 'manifest.webmanifest';
      document.head.appendChild(l);
    }
    // basic theme-color (fallback)
    if (!document.querySelector('meta[name="theme-color"]')) {
      const m = document.createElement('meta');
      m.name = 'theme-color';
      m.content = '#000000';
      document.head.appendChild(m);
    }
    // service worker
    if ('serviceWorker' in navigator) {
      // relatívní cesta = funguje na GitHub Pages i v subfolderu repo
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
    }
  } catch(e) {}
})();

// Použití: načti supabase-js v HTML, pak načti tento soubor na KAŽDÉ stránce.

(() => {
  "use strict";

  // -------------------------
  // KONFIG (můžeš přepsat přes window.* nebo sessionStorage)
  // -------------------------
  const SUPABASE_URL = "https://wngzgptxrgfrwuyiyueu.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZ3pncHR4cmdmcnd1eWl5dWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzQzNTYsImV4cCI6MjA4MzU1MDM1Nn0.N-UJpDi_CQVTC6gYFzYIFQdlm0C4x6K7GjeXGzdS8No";

  const LOGIN_PAGE = "login.html";

  // -------------------------
  // HELPERS
  // -------------------------
  function isLoginPage() {
    return location.pathname.endsWith("/" + LOGIN_PAGE) || location.pathname.endsWith(LOGIN_PAGE);
  }

  function deepMerge(base, patch) {
    if (!patch || typeof patch !== "object") return base;
    const out = Array.isArray(base) ? [...base] : { ...(base || {}) };
    for (const k of Object.keys(patch)) {
      const pv = patch[k];
      const bv = out[k];
      if (pv && typeof pv === "object" && !Array.isArray(pv) && bv && typeof bv === "object" && !Array.isArray(bv)) {
        out[k] = deepMerge(bv, pv);
      } else {
        out[k] = pv;
      }
    }
    return out;
  }

  function emitStats() {
    try {
      document.dispatchEvent(
        new CustomEvent("sf:stats", {
          detail: structuredClone(window.SF.stats),
        })
      );
    } catch {
      // structuredClone nemusí být všude → fallback
      document.dispatchEvent(new CustomEvent("sf:stats", { detail: window.SF.stats }));
    }
    // SF_LEVELUP_WATCH: odměny + modal po každém level upu
    try {
      const currLevel = Number(window.SF?.stats?.level || 1);
      const key = "sf_last_level_seen";
      const prevLevel = Number(localStorage.getItem(key) || currLevel);
      if (!Number.isNaN(currLevel) && currLevel > prevLevel) {
        // spočítej reward za každý získaný level (součet, kdyby někdo přeskočil více levelů)
        let moneyReward = 0;
        for (let l = prevLevel + 1; l <= currLevel; l++) moneyReward += (1000 * l);
        const cigsReward = 5 * (currLevel - prevLevel);

        // ulož nové "last seen" hned, ať se to nespustí 2×
        localStorage.setItem(key, String(currLevel));

        // přičti odměny do profilu (přes updateStats, stejně jako zbytek hry)
        if (!window.__sfApplyingLevelUpReward) {
          window.__sfApplyingLevelUpReward = true;
          const currMoney = Number(window.SF?.stats?.money || 0);
          const currCigs  = Number(window.SF?.stats?.cigarettes || 0);
          window.SF.updateStats({
            money: currMoney + moneyReward,
            cigarettes: currCigs + cigsReward
          });
          setTimeout(() => { window.__sfApplyingLevelUpReward = false; }, 300);
        }

        // zobraz modal "LEVEL UP!" ve stejném stylu (panel_bg + shop tlačítko)
        (function showLevelUpModal(){
          const existing = document.getElementById("sfLevelUpModal");
          if (existing) existing.remove();

          const styleId = "sfLevelUpModalStyles";
          if (!document.getElementById(styleId)) {
            const st = document.createElement("style");
            st.id = styleId;
            st.textContent = `
              .sf-lu-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:25000;backdrop-filter:blur(4px);}
              .sf-lu-modal{width:min(640px,92vw);border-radius:16px;overflow:hidden;border:4px solid;border-image:linear-gradient(135deg,#f1d27a,#c9a44a,#f1d27a) 1;box-shadow:0 25px 70px rgba(0,0,0,0.85);background-image:url('panel_bg.jpg');background-size:cover;background-position:center;}
              .sf-lu-head{padding:14px 18px;background:linear-gradient(135deg,rgba(40,30,20,0.98),rgba(25,18,12,0.99));border-bottom:3px solid rgba(201,164,74,0.4);}
              .sf-lu-title{font-size:20px;font-weight:1000;letter-spacing:2px;color:#f1d27a;text-shadow:0 0 20px rgba(241,210,122,0.6),0 4px 12px rgba(0,0,0,0.95);text-transform:uppercase;display:flex;align-items:center;gap:10px;}
              .sf-lu-body{padding:16px 18px;background:linear-gradient(135deg,rgba(30,36,42,0.97),rgba(18,22,26,0.99));}
              .sf-lu-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:12px;border:2px solid rgba(201,164,74,0.25);background:rgba(0,0,0,0.35);margin:10px 0;}
              .sf-lu-row .k{font-weight:1000;color:#f7f0d0;text-shadow:0 2px 10px rgba(0,0,0,0.95);}
              .sf-lu-row .v{font-weight:1000;color:#f1d27a;text-shadow:0 2px 10px rgba(0,0,0,0.95);}
              .sf-lu-foot{padding:12px 16px;background:linear-gradient(135deg,rgba(40,30,20,0.98),rgba(25,18,12,0.99));border-top:3px solid rgba(201,164,74,0.4);display:flex;justify-content:flex-end;gap:10px;}
              .sf-lu-btn{height:42px;padding:0 18px;border:none;cursor:pointer;border-radius:10px;background-image:url('tlacitko_shop.jpg');background-size:cover;background-position:center;color:#fff;font-weight:1000;font-size:13px;letter-spacing:0.8px;text-shadow:0 3px 10px rgba(0,0,0,0.95);box-shadow:0 8px 20px rgba(0,0,0,0.65);border:3px solid rgba(201,164,74,0.4);transition:all 0.2s ease;text-transform:uppercase;}
              .sf-lu-btn:hover{transform:translateY(-2px);border-color:#c9a44a;box-shadow:0 14px 35px rgba(0,0,0,0.75),0 0 25px rgba(241,210,122,0.3);}
            `;
            document.head.appendChild(st);
          }

          const b = document.createElement("div");
          b.className = "sf-lu-backdrop";
          b.id = "sfLevelUpModal";
          b.innerHTML = `
            <div class="sf-lu-modal" role="dialog" aria-modal="true">
              <div class="sf-lu-head">
                <div class="sf-lu-title">🆙 LEVEL UP! <span style="opacity:.9">→ Level ${currLevel}</span></div>
              </div>
              <div class="sf-lu-body">
                <div class="sf-lu-row"><div class="k">🪙 GROŠE</div><div class="v">+${moneyReward.toLocaleString('cs-CZ')}</div></div>
                <div class="sf-lu-row"><div class="k">🚬 CIGA</div><div class="v">+${cigsReward}</div></div>
              </div>
              <div class="sf-lu-foot">
                <button type="button" class="sf-lu-btn" id="sfLuOk">OK</button>
              </div>
            </div>
          `;
          const close = () => b.remove();
          b.addEventListener("click", (e) => { if (e.target === b) close(); });
          document.body.appendChild(b);
          const ok = b.querySelector("#sfLuOk");
          if (ok) ok.addEventListener("click", close);
        })();
      } else {
        localStorage.setItem(key, String(currLevel));
      }
    } catch {}

  }

  function fmtInt(n) {
    const x = Number(n ?? 0);
    return Number.isFinite(x) ? x.toLocaleString("cs-CZ") : "0";
  }

  // -------------------------
  // LEVÉ MENU (sjednocení napříč stránkami)
  // -------------------------
  function ensureLeftMenu() {
    const panel = document.querySelector('aside.left-panel');
    if (!panel) return;

    const page = (location.pathname.split('/').pop() || '').toLowerCase();
    // Pozn.: split tlačítka jsou definovaná jako "levá" položka se split:true
    // a odpovídající "pravá" položka se splitOf:'leva.html'.
    const items = [
      // POSTAVA + PERKY (samostatně, jako ostatní tlačítka)
      { href: 'postava.html',  label: 'POSTAVA', i18n: 'menu.character',     icon: '🥺' },
      { href: 'perky.html',    label: 'PERKY', i18n: 'menu.perks',       icon: '🌳' },

      // ARENA | BOSS
      { href: 'arena.html',    label: 'ARENA', i18n: 'menu.arena',       icon: '⚔️', split: true },
      { href: 'boss.html',     label: 'BOSS', i18n: 'menu.boss',        icon: '👹', splitOf: 'arena.html' },

      // SHOP | DEALER
      { href: 'shop.html',     label: 'SHOP', i18n: 'menu.shop',        icon: '🗡️', split: true },
      { href: 'dealer.html',   label: 'DEALER', i18n: 'menu.dealer',     icon: '🕴️', splitOf: 'shop.html' },

      { href: 'auto.html',     label: 'CRYPTA', i18n: 'menu.crypta',      icon: '🚗' },
      { href: 'guild.html',    label: 'GUILD', i18n: 'menu.guild',       icon: '👥' },
      { href: 'mail.html',     label: 'MAIL', i18n: 'menu.mail',        icon: '✉️' },
      { href: 'zebricek.html', label: 'ŽEBŘÍČEK', i18n: 'menu.leaderboard',    icon: '🏆' },
      { href: 'mise.html',     label: 'MISE', i18n: 'menu.missions',        icon: '🎯' },
      { href: 'grose.html',    label: 'CIGARETÁŘ', i18n: 'menu.cigarettes',   icon: '🚬' },
      { href: 'kolo.html',     label: 'ŠTĚSTÍ', i18n: 'menu.luck',      icon: '🍀' },
      { href: 'gopnik.html',   label: 'SLAV CLICKER', i18n: 'menu.clicker',icon: '🎮' },
      { href: 'pets.html',     label: 'MAZLÍČCI', i18n: 'menu.pets',    icon: '🐾', last: true },
    ];

    function isArenaPage() {
      return page === 'arena.html' || page === 'arena2.html';
    }

    function isActiveHref(hrefLc) {
      if (hrefLc === 'arena.html') return isArenaPage();
      return page === hrefLc;
    }

    const buttons = items
      .filter(it => !it.splitOf) // splitOf se vykreslí uvnitř splitu
      .map((it) => {
        const hrefLc = it.href.toLowerCase();
        const cls = ['sf-btn', isActiveHref(hrefLc) ? 'active' : '', it.last ? 'sf-btn--last' : ''].filter(Boolean).join(' ');

        // Split: levá položka + pravá položka (splitOf)
        if (it.split) {
          const right = items.find(x => x.splitOf === it.href);
          const leftActive = isActiveHref(hrefLc);
          const rightActive = right ? isActiveHref(String(right.href || '').toLowerCase()) : false;
          const containerCls = ['sf-btn', 'sf-btn--split', (leftActive || rightActive) ? 'active' : '', it.last ? 'sf-btn--last' : ''].filter(Boolean).join(' ');
          return `
            <div class="${containerCls}">
              <a href="${it.href}" class="sf-split-half sf-split-left ${leftActive ? 'active' : ''}" data-icon="${it.icon}">${(window.SF && window.SF.i18n ? window.SF.i18n.t(it.i18n, it.label) : it.label)}</a>
              <span class="sf-split-divider" aria-hidden="true"></span>
              <a href="${right?.href || '#'}" class="sf-split-half sf-split-right ${rightActive ? 'active' : ''}" data-icon="${right?.icon || '✨'}">${right?.label || ''}</a>
            </div>
          `.trim();
        }

        return `<a href="${it.href}" class="${cls}" data-icon="${it.icon}">${(window.SF && window.SF.i18n ? window.SF.i18n.t(it.i18n, it.label) : it.label)}</a>`;
      })
      .join('\n');

    panel.innerHTML = `
      <div class="menu-top">
        <div class="status-row">
          <div class="status-bars">
            <div class="xp-bar">
              <div class="xp-fill" id="xpFill" style="width:0%"></div>
              <span class="xp-text" id="xpText">0 / 100</span>
            </div>

            <div class="xp-bar energy-bar">
              <div class="xp-fill energy-fill" id="energyFill" style="width:100%"></div>
              <span class="xp-text" id="energyText">100 / 100</span>
            </div>
          </div>

          <div class="level-box" aria-label="Level">
            <div class="level-label">LVL</div>
            <div class="level-number" id="levelDisplay">1</div>
          </div>
        </div>

        <div class="currency-col">
          <div class="currency-line">
            <span class="cur-icon">💰</span>
            <b id="money">0</b>
          </div>
          <div class="currency-line">
            <span class="cur-icon">🚬</span>
            <b id="cigarettes">0</b>
          </div>
          <div class="currency-line energy">
            <span class="cur-icon">⚡</span>
            <b id="energy">100</b>
          </div>
        </div>

	        <!-- EVENT BANNER (Global Event) -->
	        <div class="sf-event-banner closed" id="sfEventBanner" aria-live="polite">
	          🗓️ EVENT: <span id="sfEventBannerText">Načítám…</span>
	          <div class="small" id="sfEventBannerSub">Načítám…</div>
	        </div>
      </div>

      <div class="menu-frame">
        ${buttons}
      </div>

      <div class="menu-bottom">
        <button class="gear-btn" type="button">⚙️</button>
      </div>
    `;
  }

  // -------------------------
  // HUD (volitelné prvky napříč stránkami)
  // -------------------------
  function updateHud(stats) {
    if (!stats) return;

    const moneyEl = document.getElementById("money");
    const cigEl = document.getElementById("cigarettes");
    const energyEl = document.getElementById("energy");
    const levelEl = document.getElementById("levelDisplay") || document.querySelector(".level-number");
    const xpFillEl = document.getElementById("xpFill");
    const xpTextEl = document.getElementById("xpText");
    const energyFillEl = document.getElementById("energyFill");
    const energyTextEl = document.getElementById("energyText");

    if (moneyEl) moneyEl.textContent = fmtInt(stats.money);
    if (cigEl) cigEl.textContent = fmtInt(stats.cigarettes);
    if (levelEl) levelEl.textContent = fmtInt(stats.level);

    // Energy (pokud existuje)
    const energy = Number(stats.energy ?? 0);
    const maxEnergy = Math.max(1, Number(stats.max_energy ?? 100));
    if (energyEl) energyEl.textContent = fmtInt(energy);
    const ePct = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));
    if (energyFillEl) energyFillEl.style.width = ePct + "%";
    if (energyTextEl) energyTextEl.textContent = `${fmtInt(energy)} / ${fmtInt(maxEnergy)}`;

    // Avatar + rámeček z výběru (vyber.html)
    try {
      const s = (stats && typeof stats === 'object') ? (stats.stats || {}) : {};
      const avatarUrl = s.avatar_url ? String(s.avatar_url) : null;
      const frameColor = s.avatar_frame ? String(s.avatar_frame) : null;

      // Levé menu avatar-box
      document.querySelectorAll('.avatar-box img').forEach(img => {
        if (avatarUrl) img.src = avatarUrl;
      });
      document.querySelectorAll('.avatar-box').forEach(box => {
        if (frameColor) box.style.borderColor = frameColor;
      });

      // Velké avatary na stránkách (postava/shop/arena/žebříček)
      const avatarIds = ['avatarImg', 'playerAvatar'];
      avatarIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && avatarUrl) el.src = avatarUrl;
      });
      document.querySelectorAll('.character, .character-shop, .character-arena').forEach(box => {
        if (frameColor) box.style.borderColor = frameColor;
      });
    } catch {}

    // XP bar (pokud existuje)
    const level = Number(stats.level ?? 1);
    const xp = Number(stats.xp ?? 0);
    const req = Math.floor(100 * Math.pow(1.5, Math.max(0, level - 1)));
    const pct = req > 0 ? Math.max(0, Math.min(100, (xp / req) * 100)) : 0;
    if (xpFillEl) xpFillEl.style.width = pct + "%";
    if (xpTextEl) xpTextEl.textContent = `${fmtInt(xp)} / ${fmtInt(req)}`;
  }

  document.addEventListener("sf:stats", (e) => updateHud(e.detail));
  // jakmile dojdou stats (třída se často načítá až async), zkus znovu vykreslit badge
  document.addEventListener("sf:stats", () => {
    try { window.SFEnsureAvatarBadge && window.SFEnsureAvatarBadge(); } catch {}
  });

  // Sjednoť levé menu co nejdřív (aby nebylo na každé stránce jiné)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureLeftMenu, { once: true });
  } else {
    ensureLeftMenu();
  }

  // -------------------------
  // SUPABASE CLIENT
  // -------------------------
  function getSbClient() {
    // Jedna instance Supabase klienta na stránku (řeší warning "Multiple GoTrueClient instances")
    if (window.SF?.sb) return window.SF.sb;
    const lib = window.supabase;
    if (!lib || typeof lib.createClient !== "function") return null;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

    const sb = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // localStorage = stabilnější napříč stránkami; sessionStorage umí dělat divné věci při reloadu
        storage: window.localStorage,
      },
    });

    // cache
    if (!window.SF) window.SF = {};
    window.SF.sb = sb;
    return sb;
  }

  // -------------------------
  // GLOBAL SF API
  // -------------------------
  if (!window.SF) {
    window.SF = {
      sb: null,
      user: null,
      stats: null,
      updateStats: null,
    };
  }

  let saveTimer = null;

  // Pozn.: PostgreSQL bez uvozovek převádí identifikátory na lower-case.
  // V supabase_setup.sql je sloupec napsaný jako missionData, ale v DB se vytvoří jako "missiondata".
  // Pokud klient pošle JSON klíč "missionData", PostgREST vrátí 400 (neznámé pole).
  // Tady to normalizujeme, aby se ukládání nerozbilo napříč stránkami.
  function normalizeRowForDb(row) {
    if (!row || typeof row !== "object") return row;

    // Vezmeme jen sloupce, které skutečně existují v tabulce.
    // (cokoliv navíc může dělat 400)
    const out = {
      user_id: row.user_id,
      level: row.level,
      xp: row.xp,
      money: row.money,
      cigarettes: row.cigarettes,
      energy: row.energy,
      max_energy: row.max_energy,
      stats: row.stats,
      upgrade_costs: row.upgrade_costs,
      inventory: row.inventory,
      equipped: row.equipped,
      flags: row.flags,
      clicker: row.clicker,
      // DB sloupec je missiondata (lowercase)
      missiondata: row.missiondata ?? row.missionData,
      mail_claimed: row.mail_claimed,
    };

    // Odstraň undefined (PostgREST to umí poslat jako "null" nebo to může vadit u NOT NULL)
    for (const k of Object.keys(out)) {
      if (out[k] === undefined) delete out[k];
    }

    // Základní numerická normalizace:
    // - když nám UI někde vyrobí číslo jako string ("10" / "10.05"), převedeme na Number
    // - a pro jistotu pošleme INTEGER-like sloupce vždy jako celé číslo (ať je v DB int nebo numeric)
    const forceIntKeys = new Set(["level", "xp", "money", "cigarettes", "energy", "max_energy"]);
    for (const k of Object.keys(out)) {
      let v = out[k];
      if (typeof v === "string" && /^-?\d+(?:\.\d+)?$/.test(v.trim())) {
        const n = Number(v);
        if (!Number.isNaN(n)) v = n;
      }
      if (forceIntKeys.has(k) && typeof v === "number" && Number.isFinite(v)) {
        v = Math.floor(v);
      }
      out[k] = v;
    }
    return out;
  }

  function coerceIntegerishValues(obj) {
    // Projde jen top-level klíče: typická INTEGER pole jsou právě tam (level/xp/money/energy...)
    const out = { ...obj };
    for (const k of Object.keys(out)) {
      const v = out[k];
      if (typeof v === "number" && Number.isFinite(v) && !Number.isInteger(v)) {
        out[k] = Math.floor(v);
      } else if (typeof v === "string" && /^-?\d+(?:\.\d+)?$/.test(v.trim())) {
        const n = Number(v);
        if (!Number.isNaN(n)) out[k] = Number.isInteger(n) ? n : Math.floor(n);
      }
    }
    return out;
  }
  async function upsertNow() {
    const sb = window.SF.sb;
    const stats = window.SF.stats;
    if (!sb || !stats?.user_id) return;

    // 1) Standardní payload (bez neznámých klíčů)
    const payloadBase = normalizeRowForDb(stats);

    // 2) Mission sloupec detekujeme z načteného řádku (abychom neposílali "špatný" klíč a nespamovali 400).
    // Pokud jsme ho ještě nedetekovali, spadneme na původní "zkus obě" režim.
    const attempts = [];
    const m = window.SF?.dbCols?.player_stats || {};
    const hasMissiondata = !!m.missiondata;
    const hasMissionData = !!m.missionData;

    if (hasMissiondata) {
      const a = { ...payloadBase };
      delete a.missionData;
      attempts.push(a);
    } else if (hasMissionData) {
      const b = { ...payloadBase, missionData: stats.missionData ?? stats.missiondata };
      delete b.missiondata;
      attempts.push(b);
    } else {
      // Nevíme – zkusíme obě + fallback.
      const a = { ...payloadBase };
      delete a.missionData;
      attempts.push(a);

      const b = { ...payloadBase, missionData: stats.missionData ?? stats.missiondata };
      delete b.missiondata;
      attempts.push(b);

      const c = { ...payloadBase };
      delete c.missiondata;
      delete c.missionData;
      attempts.push(c);
    }

    let lastError = null;
    for (const payload of attempts) {
      // Nejprve zkus "jak je".
      let { error } = await sb.from("player_stats").upsert(payload, { onConflict: "user_id" });
      if (!error) return;

      // Když narazíme na 22P02 (např. "invalid input syntax for type integer: '10.05'")
      // zkusíme automaticky oříznout desetinné hodnoty na INTEGER a uložit znovu.
      if (error?.code === "22P02" && (error?.message || "").toLowerCase().includes("type integer")) {
        const fixed = coerceIntegerishValues(payload);
        const retry = await sb.from("player_stats").upsert(fixed, { onConflict: "user_id" });
        if (!retry.error) return;
        error = retry.error;
      }
      lastError = error;

      // Když jde o "neznámý sloupec", má smysl zkusit další variantu.
      const msg = (error?.message || "").toLowerCase();
      if (error?.code === "PGRST204" || msg.includes("could not find") || msg.includes("column")) {
        continue;
      }

      // Pro ostatní chyby už další pokusy typicky nepomůžou.
      break;
    }

    if (lastError) console.warn("SF upsert error:", lastError);
  }

  window.SF.updateStats = function updateStats(patch, opts = {}) {
    const merge = opts.merge !== false;
    const prev = window.SF.stats || {};
    const next = merge ? deepMerge(prev, patch) : { ...prev, ...patch };
    window.SF.stats = next;
    emitStats();

    // debounced save (proti spamování / rate limitům)
    clearTimeout(saveTimer);
    saveTimer = setTimeout(upsertNow, 250);
  };

  
  // -------------------------
  // COMBAT HELPERS (defense škálování podle levelu + class capy)
  // -------------------------
  window.SF.getDefenseReductionPercent = function getDefenseReductionPercent(defenseValue, level, cls) {
    const def = Number(defenseValue || 0);
    const lvl = Math.max(1, Number(level || 1));
    const c = (cls ? String(cls).toLowerCase() : "padouch");
    const caps = { rvac: 50, padouch: 25, mozek: 10 };
    const cap = Number.isFinite(caps[c]) ? caps[c] : 25;

    // S levely roste požadavek → stejná redukce vyžaduje víc DEF.
    const divisor = 28 + Math.floor((lvl - 1) * 2);

    const pct = Math.floor((def / divisor) * 100);
    return Math.max(0, Math.min(cap, pct));
  };

  window.SF.getDefenseReductionFraction = function getDefenseReductionFraction(defenseValue, level, cls) {
    return window.SF.getDefenseReductionPercent(defenseValue, level, cls) / 100;
  };

// -------------------------
  // PETS (mazlíčci) — globální helper
  // Ukládáme je do player_stats.stats.pets a bonusy (v %) do player_stats.stats.pet_bonuses
  // Tohle je jednotné napříč stránkami, aby se bonusy nenasčítávaly při reloadu.
  // -------------------------
  const SF_MAX_PET_LEVEL = 50;
  const SF_MAX_BONUS_PERCENT = 15;
  const SF_PET_STAT_MAP = {
    medved: 'strength',
    vlk: 'defense',
    kocka: 'luck',
    sova: 'luck',
    kun: 'constitution',
    zajic: 'luck',
    pes: 'strength',
    liska: 'luck',
    orel: 'luck',
    zirafa: 'constitution',
  };

  function sfPetBonusFromLevel(lvl) {
    const L = Math.max(0, Math.min(SF_MAX_PET_LEVEL, Number(lvl || 0)));
    const pct = (L / SF_MAX_PET_LEVEL) * SF_MAX_BONUS_PERCENT;
    return Math.round(pct * 10) / 10; // 1 desetinné místo
  }

  // Vrátí bonusy v procentech podle uložených mazlíčků.
  // Použití: const pct = window.SF.getPetBonusesPercent(row);
  window.SF.getPetBonusesPercent = function getPetBonusesPercent(rowOrStats) {
    const out = { strength:0, defense:0, constitution:0, luck:0 };
    try {
      const statsObj = rowOrStats?.stats ? rowOrStats.stats : rowOrStats;
      const pets = statsObj?.pets || {};
      for (const petId of Object.keys(pets)) {
        const st = SF_PET_STAT_MAP[petId];
        if (!st) continue;
        const lvl = pets?.[petId]?.level ?? pets?.[petId] ?? 0;
        out[st] += sfPetBonusFromLevel(lvl);
      }
      // Když už jsou bonusy spočítané a uložené, preferujeme uloženou hodnotu.
      if (statsObj?.pet_bonuses && typeof statsObj.pet_bonuses === 'object') {
        for (const k of Object.keys(out)) {
          const v = Number(statsObj.pet_bonuses?.[k]);
          if (Number.isFinite(v)) out[k] = v;
        }
      }
    } catch {}
    return out;
  };

  // ===== GUILD BONUSY (%): jednoduchá, univerzální vrstva =====
  // Použití: const pct = window.SF.getGuildBonusesPercent();
  // Vrací procenta pro jednotlivé staty.
  // Ukládáme do localStorage pod klíčem "sf_guild_bonus_pct" (číslo 0..200).
  // Pokud guild systém nastaví něco jiného, může ten klíč přepsat.
  window.SF.getGuildBonusesPercent = function getGuildBonusesPercent() {
    let raw = 0;
    try {
      raw = Number(localStorage.getItem('sf_guild_bonus_pct') || '0') || 0;
    } catch (_) {
      raw = 0;
    }
    // cap
    if (raw < 0) raw = 0;
    if (raw > 200) raw = 200;
    return { strength: raw, defense: raw, constitution: raw, luck: raw };
  };

  // -------------------------
  // LOAD or CREATE player_stats
  // -------------------------
  function defaultStatsRow(userId) {
    return {
      user_id: userId,
      level: 1,
      xp: 0,
      money: 0,
      cigarettes: 0,
      energy: 100,
      max_energy: 100,
      stats: {
        strength: 10,
        defense: 10,
        constitution: 10,
        luck: 10,
        // Nevyplňovat automaticky – třídu si hráč volí na stránce výběru
        player_class: null,
        character_name: null,
        avatar_url: null,
        avatar_frame: null,
        avatar_color: null,
      },
      upgrade_costs: {
        strength: 100,
        defense: 100,
        constitution: 100,
        luck: 100,
      },
      inventory: [],
      equipped: {
        weapon: null,
        shield: null,
        ring: null,
        backpack: null,
        helmet: null,
        armor: null,
        boots: null,
        gloves: null,
      },
    };
  }

  async function loadOrCreateStats(userId) {
    const sb = window.SF.sb;
    if (!sb) return null;

    const { data, error } = await sb
      .from("player_stats")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) console.warn("player_stats load error:", error);

    if (data) return data;

    const defaults = defaultStatsRow(userId);
    const ins = await sb.from("player_stats").insert(defaults).select().single();
    if (ins.error) {
      console.warn("player_stats create error:", ins.error);
      // fallback: i kdyby insert selhal, vrať aspoň defaults a nepadni
      return defaults;
    }
    return ins.data;
  }

  // -------------------------
  // REALTIME
  // -------------------------
  function initRealtime(userId) {
    const sb = window.SF.sb;
    if (!sb) return;

    // unsubscribe starého kanálu (kdyby reload skriptu)
    if (window.SF._rt) {
      try { sb.removeChannel(window.SF._rt); } catch {}
      window.SF._rt = null;
    }

    const ch = sb
      .channel("sf-player-stats")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_stats",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload?.new) {
            const next = payload.new;
            // kompatibilita: DB => missiondata, klient často čte missionData
            if (next.missiondata !== undefined && next.missionData === undefined) {
              next.missionData = next.missiondata;
            }
            window.SF.stats = next;
            emitStats();
          }
        }
      )
      .subscribe();

    window.SF._rt = ch;
  }

  // -------------------------
  // BOOT
  // -------------------------
  window.SFReady = (async () => {
    const sb = getSbClient();
    if (!sb) {
      console.error("❌ Supabase není načten. Přidej supabase-js před menu.js");
      return null;
    }
    window.SF.sb = sb;
    // kompatibilita se starými skripty (arena.js/guild.js/...) které čekají window.supabaseClient
    window.supabaseClient = sb;

    // mobil: vynucení portrait (jen overlay, bez hard lock)
    // Pozor: na GitHub Pages může být menu.js načtený v <head> ještě před <body>.
    // Proto overlay montujeme až ve chvíli, kdy existuje document.body.

    

    const sess = await sb.auth.getSession();
    const user = sess.data?.session?.user || null;

    if (!user) {
      if (!isLoginPage()) location.href = LOGIN_PAGE;
      return null;
    }

    window.SF.user = user;

    const row = await loadOrCreateStats(user.id);
    // zajisti user_id vždy + kompatibilita: missionData (camelCase) vs missiondata (reálný název sloupce v DB)
    const baseRow = { ...(row || {}), user_id: user.id };
    if (baseRow.missiondata !== undefined && baseRow.missionData === undefined) {
      baseRow.missionData = baseRow.missiondata;
    }

    // Zapamatuj si, jaké sloupce DB skutečně vrací, aby se upsert nemusel trefovat naslepo
    // (a tím pádem nespamoval 400 pokusy se špatným názvem sloupce).
    window.SF.dbCols = window.SF.dbCols || {};
    window.SF.dbCols.player_stats = {
      missiondata: Object.prototype.hasOwnProperty.call(baseRow, "missiondata"),
      missionData: Object.prototype.hasOwnProperty.call(baseRow, "missionData"),
    };

    window.SF.stats = baseRow;
    emitStats();

    initRealtime(user.id);

    return window.SF;
  })();

})();

  // -------------------------
  // HARDMODE: server-side autorita (RPC only)
  // -------------------------
  async function refreshStats() {
    const sb = window.supabaseClient;
    if (!sb) throw new Error("Supabase client není dostupný");
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error("Nepřihlášen");
    const { data, error } = await sb.from("player_stats").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!data) {
      // bootstrap řádek (pouze přes server? tady je to první vytvoření – pokud chceš 100% RPC, vytvoř si trigger on signup)
      const baseRow = { user_id: user.id };
      const ins = await sb.from("player_stats").insert(baseRow);
      if (ins.error) throw ins.error;
      const again = await sb.from("player_stats").select("*").eq("user_id", user.id).maybeSingle();
      if (again.error) throw again.error;
      window.SF.stats = again.data || {};
    } else {
      window.SF.stats = data;
    }
    updateHud(window.SF.stats);
    return window.SF.stats;
  }

  async function ensureNotBanned() {
    const sb = window.supabaseClient;
    if (!sb) return;
    const { data, error } = await sb.rpc("rpc_check_ban");
    if (!error && data === true) {
      location.href = "/banned.html";
    }
  }

  window.SF.refresh = refreshStats;

  window.SF.actions = Object.freeze({
    async claimDaily() {
      const sb = window.supabaseClient;
      await ensureNotBanned();
      const { data, error } = await sb.rpc("rpc_claim_daily");
      if (error) throw error;
      await refreshStats();
      return data;
    },
    async arenaWin() {
      const sb = window.supabaseClient;
      await ensureNotBanned();
      const { data, error } = await sb.rpc("rpc_arena_win");
      if (error) throw error;
      await refreshStats();
      return data;
    },
    async arenaLose() {
      const sb = window.supabaseClient;
      await ensureNotBanned();
      const { data, error } = await sb.rpc("rpc_arena_lose");
      if (error) throw error;
      await refreshStats();
      return data;
    },
    async upgradeStat(statName) {
      const sb = window.supabaseClient;
      await ensureNotBanned();
      const { data, error } = await sb.rpc("rpc_upgrade_stat", { p_stat: statName });
      if (error) throw error;
      await refreshStats();
      return data;
    },
    async spendMoney(amount, reason) {
      const sb = window.supabaseClient;
      await ensureNotBanned();
      const { data, error } = await sb.rpc("rpc_spend_money", { p_amount: amount, p_reason: reason || "" });
      if (error) throw error;
      await refreshStats();
      return data;
    },
    async logCheat(action, detail) {
      const sb = window.supabaseClient;
      await sb.rpc("rpc_log_cheat", { p_action: String(action||""), p_detail: String(detail||"") });
    }
  });

  // Deprecated helpers (zrušené kvůli anticheatu)
  window.SF.addMoney = async (amount) => {
    await window.SF.actions.logCheat("client_addMoney_call", String(amount));
    throw new Error("Zakázáno: addMoney. Použij serverové akce.");
  };
  window.SF.addExp = async (amount) => {
    await window.SF.actions.logCheat("client_addExp_call", String(amount));
    throw new Error("Zakázáno: addExp. Použij serverové akce.");
  };

  // -------------------------
  // SHARED BACKGROUND MUSIC - Prostě jedno audio pro celou hru
  // -------------------------
  if (!window.bgMusic) {
    // Vytvoř audio element (JEN JEDNOU pro celou aplikaci)
    window.bgMusic = document.createElement('audio');
    window.bgMusic.loop = true;
    window.bgMusic.volume = 0.3;
    window.bgMusic.id = 'bgMusic';
    
    // Funkce pro start hudby (volá se z jakékoliv stránky)
    window.playBgMusic = function(src) {
      if (!window.bgMusic.src || window.bgMusic.src !== src) {
        window.bgMusic.src = src;
      }
      if (window.bgMusic.paused) {
        window.bgMusic.play().catch(e => console.log('🎵 Autoplay blocked, čekám na klik...'));
      }
    };
    
    // Funkce pro zastavení
    window.stopBgMusic = function() {
      window.bgMusic.pause();
    };
    
    console.log('✅ Background music ready (sdílené audio element)');
  }


  // ===== SETTINGS (⚙️) =====
  const SF_SETTINGS_MODAL = "sfSettingsModal";
  const SF_HELP_MODAL = "sfHelpModal";

  // ===== Extra settings (S&F vibe) =====
  const SF_REDUCE_MOTION_KEY = 'sf_reduce_motion';
  const SF_PAGE_TRANS_KEY = 'sf_page_transitions';
  const SF_UI_SCALE_KEY = 'sf_ui_scale'; // 90 | 100 | 110
  const SF_INV_SIZE_KEY = 'sf_inv_size'; // normal | big
  const SF_CONFIRM_BUY_KEY = 'sf_confirm_buy';
  const SF_TOOLTIP_SCALE_KEY = 'sf_tooltip_scale'; // 100 | 85 | 70
  const SF_TOOLTIP_DELAY_KEY = 'sf_tooltip_delay'; // 0 | 200 | 400 (ms)
  const SF_CONFIRM_SELL_KEY = 'sf_confirm_sell';
  const SF_CONFIRM_UPGRADE_KEY = 'sf_confirm_upgrade';
  const SF_PERF_MODE_KEY = 'sf_perf_mode'; // normal | performance | battery
  const SF_CONTRAST_KEY = 'sf_contrast'; // normal | high
  const SF_SOUND_PACK_KEY = 'sf_sound_pack'; // default | minimal | retro

  function sfGetBool(key, def){
    try {
      const v = localStorage.getItem(key);
      if (v === null || v === undefined) return !!def;
      return v === '1' || v === 'true';
    } catch {
      return !!def;
    }
  }
  function sfSetBool(key, on){
    try { localStorage.setItem(key, on ? '1' : '0'); } catch {}
  }
  function sfGetUiScale(){
    try { return localStorage.getItem(SF_UI_SCALE_KEY) || '100'; } catch { return '100'; }
  }
  function sfSetUiScale(v){
    try { localStorage.setItem(SF_UI_SCALE_KEY, String(v || '100')); } catch {}
    // sf_scale.js čte data-ui-scale z <body> jako multiplier (1 = 100%)
    const num = parseFloat(String(v || '100'));
    const mul = (isFinite(num) && num > 0) ? (num / 100) : 1;
    try { document.body && document.body.setAttribute('data-ui-scale', String(mul)); } catch {}
  }
function sfGetTooltipScale(){
    try { return localStorage.getItem(SF_TOOLTIP_SCALE_KEY) || '85'; } catch { return '85'; }
  }
  function sfSetTooltipScale(v){
    const val = String(v || '85');
    try { localStorage.setItem(SF_TOOLTIP_SCALE_KEY, val); } catch {}
    const num = parseFloat(val);
    const mul = (Number.isFinite(num) && num>0) ? (num/100) : 0.85
  }

  function sfGetTooltipDelay(){
    try { return localStorage.getItem(SF_TOOLTIP_DELAY_KEY) || '200'; } catch { return '200'; }
  }
  function sfSetTooltipDelay(v){
    const val = String(v || '200');
    try { localStorage.setItem(SF_TOOLTIP_DELAY_KEY, val); } catch {}
    const ms = parseInt(val, 10);
    const out = Number.isFinite(ms) ? ms : 200;
    try { document.documentElement.style.setProperty('--sf-tooltip-delay-ms', String(out)); } catch {}
    try { window.SF_TOOLTIP_DELAY_MS = out; } catch {}
  }

  function sfGetContrast(){
    try { return localStorage.getItem(SF_CONTRAST_KEY) || 'normal'; } catch { return 'normal'; }
  }
  function sfSetContrast(v){
    const val = String(v || 'normal');
    try { localStorage.setItem(SF_CONTRAST_KEY, val); } catch {}
    try { document.documentElement.dataset.contrast = (val === 'high') ? 'high' : 'normal'; } catch {}
  }

  function sfGetPerfMode(){
    try { return localStorage.getItem(SF_PERF_MODE_KEY) || 'normal'; } catch { return 'normal'; }
  }
  function sfSetPerfMode(v){
    const val = String(v || 'normal');
    try { localStorage.setItem(SF_PERF_MODE_KEY, val); } catch {}
    try { window.SF_PERF_MODE = val; } catch {}
  }

  function sfGetSoundPack(){
    try { return localStorage.getItem(SF_SOUND_PACK_KEY) || 'default'; } catch { return 'default'; }
  }
  function sfSetSoundPack(v){
    const val = String(v || 'default');
    try { localStorage.setItem(SF_SOUND_PACK_KEY, val); } catch {}
    try { window.SF_SOUND_PACK = val; } catch {}
  }
  function sfGetInvSize(){
    try { return localStorage.getItem(SF_INV_SIZE_KEY) || 'normal'; } catch { return 'normal'; }
  }
  function sfSetInvSize(v){
    try { localStorage.setItem(SF_INV_SIZE_KEY, String(v || 'normal')); } catch {}
  }
  function sfApplyReduceMotion(){
    try { document.documentElement.dataset.reduceMotion = sfGetBool(SF_REDUCE_MOTION_KEY, false) ? '1' : '0'; } catch {}
  }
  function sfPageTransitionsEnabled(){
    return sfGetBool(SF_PAGE_TRANS_KEY, true);
  }
  const SF_SOUND_KEY = "sf_sound_enabled";
  const SF_LANG_KEY  = "sf_lang";

  function sfGetSoundEnabled() {
    const v = localStorage.getItem(SF_SOUND_KEY);
    if (v === null) return true;
    return v === "1";
  }
  function sfSetSoundEnabled(on) {
    localStorage.setItem(SF_SOUND_KEY, on ? "1" : "0");
    window.SF_SOUND_ENABLED = on;
    // ztlum i bg music + všechny audio elementy na stránce
    try {
      document.querySelectorAll('audio').forEach(a => {
        a.muted = !on;
        if (!on) a.pause();
      });
    } catch {}
  }

  // Aplikuj stav zvuku hned po načtení stránky a blokuj jakýkoliv další play, když je vypnuto.
  function sfApplySoundState() {
    const on = sfGetSoundEnabled();
    window.SF_SOUND_ENABLED = on;
    try {
      document.querySelectorAll('audio').forEach(a => {
        a.muted = !on;
        if (!on) a.pause();
      });
    } catch {}
  }

  // inicializace
  try { sfApplySoundState(); } catch {}
  document.addEventListener('DOMContentLoaded', () => {
  // === SF: jednotné menu (text, emoty, pořadí) ===
  try {
    const menuFrame = document.querySelector('.menu-frame');
    if (menuFrame) {
      const MENU_ITEMS = [
        // POSTAVA + PERKY (split)
        { href: 'postava.html', label: 'POSTAVA', i18n: 'menu.character', icon: '🍺', split: true },
        { href: 'perky.html',   label: 'PERKY', i18n: 'menu.perks',   icon: '✨', splitOf: 'postava.html' },
        { href: 'arena.html',   label: 'ARENA', i18n: 'menu.arena',   icon: '⚔️', split: true },
        { href: 'boss.html',    label: 'BOSS',  i18n: 'menu.boss',    icon: '👹', splitOf: 'arena.html' },
        { href: 'shop.html',    label: 'SHOP', i18n: 'menu.shop',    icon: '🗡️' , split: true },
        { href: 'dealer.html',  label: 'DEALER', i18n: 'menu.dealer', icon: '🕴️', splitOf: 'shop.html' },
        { href: 'pets.html',    label: 'MAZLÍČCI', i18n: 'menu.pets',icon: '🐾' },
        { href: 'auto.html',    label: 'CRYPTA', i18n: 'menu.crypta',  icon: '🚗' },
        { href: 'guild.html',   label: 'GUILD', i18n: 'menu.guild',   icon: '👥' },
        { href: 'mail.html',    label: 'MAIL', i18n: 'menu.mail',    icon: '✉️' },
        { href: 'zebricek.html',label: 'ŽEBŘÍČEK', i18n: 'menu.leaderboard',icon: '🏆' },
        { href: 'mise.html',    label: 'MISE', i18n: 'menu.missions',    icon: '🎯' },
        { href: 'grose.html',   label: 'CIGARETÁŘ', i18n: 'menu.cigarettes',icon:'🚬' },
        { href: 'kolo.html',    label: 'ŠTĚSTÍ', i18n: 'menu.luck',  icon: '🍀' },
        { href: 'gopnik.html',  label: 'SLAV CLICKER', i18n: 'menu.clicker', icon: '🎮' },
        // ČERNÝ TRH (viditelný vždy, ale zamčený mimo časová okna)
        { href: 'black.html',   label: 'ČERNÝ TRH', i18n: 'menu.blackmarket', icon: '🔒', special: 'blackMarket' },
      ];

      // postavíme menu vždy stejně (nezávisle na tom, co je v HTML)
      menuFrame.innerHTML = MENU_ITEMS
        .filter(it => !it.splitOf)
        .map((it, idx, arr) => {
        const isLast = idx === arr.length - 1;
        const extra = isLast ? ' sf-btn--last' : '';

        // Split: POSTAVA | PERKY
        if (it.split) {
          const perky = MENU_ITEMS.find(x => x.splitOf === it.href);
          return `
            <div class="sf-btn sf-btn--split${extra}" id="menuSplitPostava">
              <a href="${it.href}" class="sf-split-half sf-split-left" data-icon="${it.icon}">${(window.SF && window.SF.i18n ? window.SF.i18n.t(it.i18n, it.label) : it.label)}</a>
              <span class="sf-split-divider" aria-hidden="true"></span>
              <a href="${perky?.href || 'perky.html'}" class="sf-split-half sf-split-right" data-icon="${perky?.icon || '✨'}">${(window.SF && window.SF.i18n ? window.SF.i18n.t(perky?.i18n || 'menu.perks', perky?.label || 'PERKY') : (perky?.label || 'PERKY'))}</a>
            </div>
          `.trim();
        }

        // Speciální tlačítko: ČERNÝ TRH + odpočet + dynamická ikona
        if (it.special === 'blackMarket') {
          return `
            <a href="${it.href}" id="blackMarketBtn" class="sf-btn${extra} locked" data-icon="${it.icon}">
              <span class="bm-label">${(window.SF && window.SF.i18n ? window.SF.i18n.t(it.i18n, it.label) : it.label)}</span>
              <small class="bm-countdown" id="globalEventCountdown"></small>
            </a>
          `.trim();
        }

        return `<a href="${it.href}" class="sf-btn${extra}" data-icon="${it.icon}">${(window.SF && window.SF.i18n ? window.SF.i18n.t(it.i18n, it.label) : it.label)}</a>`;
      }).join('\n');

      // aktivní tlačítko podle aktuální stránky
      const current = (location.pathname.split('/').pop() || '').toLowerCase();
      const links = menuFrame.querySelectorAll('a.sf-btn');
      links.forEach(a => {
        const href = (a.getAttribute('href') || '').toLowerCase();
        if (href === current) a.classList.add('active');
      });

      // split aktivace (POSTAVA | PERKY)
      const split = menuFrame.querySelector('#menuSplitPostava');
      if (split) {
        const left = split.querySelector('.sf-split-left');
        const right = split.querySelector('.sf-split-right');
        if (current === 'postava.html') {
          split.classList.add('active');
          if (left) left.classList.add('active');
        } else if (current === 'perky.html') {
          split.classList.add('active');
          if (right) right.classList.add('active');
        }
      }

      

      // =====================================================
      // PAGE TRANSITIONS (smooth navigation)
      // - fade/slide out current page, then navigate
      // - fade/slide in on load
      // =====================================================
      (function setupPageTransitions(){
        try {
          // enable enter animation
          document.body.classList.add('sf-page');
          requestAnimationFrame(() => {
            document.body.classList.add('sf-page-ready');
          });

          let navLock = false;

          function isSamePage(href){
            const here = (location.pathname.split('/').pop() || '').toLowerCase();
            const there = (String(href||'').split('/').pop() || '').toLowerCase();
            return !!here && here === there;
          }

          function shouldIgnore(e, a){
            if (!a) return true;
            const href = a.getAttribute('href') || '';
            if (!href) return true;
            if (href.startsWith('#')) return true;
            if (a.hasAttribute('download')) return true;
            if ((a.getAttribute('target') || '').toLowerCase() === '_blank') return true;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return true;
            if (!/\.html?(\?|#|$)/i.test(href)) return true;
            if (isSamePage(href)) return true;
            return false;
          }

          function onNavClick(e){
            const a = e.currentTarget;
            if (shouldIgnore(e, a)) return;
            e.preventDefault();
            if (navLock) return;
            navLock = true;

            const href = a.getAttribute('href');

            // Pokud jsou animace vypnuté v nastavení, přepni hned
            if (!sfPageTransitionsEnabled()) {
              location.href = href;
              return;
            }

            // exit animation
            try {
              document.body.classList.remove('sf-page-ready');
              document.body.classList.add('sf-page-out');
            } catch {}

            // small delay matches CSS transition (global.css)
            setTimeout(() => {
              location.href = href;
            }, 280);
          }

          // attach to all internal links (menu + any other UI links)
          const allLinks = Array.from(document.querySelectorAll('a[href]'));
          allLinks.forEach(a => {
            // avoid double-binding
            if (a.__sfTransBound) return;
            a.__sfTransBound = true;
            a.addEventListener('click', onNavClick);
          });
        } catch {}
      })();


      // === GLOBÁLNÍ EVENTY (rotace 1× denně) ===
      try {
        const EVENT_ROTATION = [
          { id:'gold_sunday',   name:'Zlatý den',        icon:'💰', sub:'+50% groše z misí', bonus:{ missionGold:1.5 } },
          { id:'bloody_arena',  name:'Krvavá aréna',     icon:'🩸', sub:'+25% XP z arény, -20% cooldown', bonus:{ arenaXP:1.25, arenaCooldown:0.8 } },
          { id:'black_market',  name:'Černý trh (slevy)',icon:'🕶️', sub:'-30% ceny v shopu', bonus:{ shopPrice:0.7 } },
          { id:'vodka_fest',    name:'Festival vodky',   icon:'🍾', sub:'+20 energie / 20 min', bonus:{ energyRegenAmount:20, energyRegenEveryMin:20 } },
          { id:'gomez_bless',   name:'Požehnání Gomeze', icon:'☠️', sub:'+1 loot z bossů', bonus:{ bossExtraLoot:1 } },
          { id:'mission_rush',  name:'Mise nadoraz',     icon:'🧭', sub:'-25% čas misí, +15% XP', bonus:{ missionTime:0.75, missionXP:1.15 } },
          { id:'taxi_bonus',    name:'Taxi prémium',     icon:'🚕', sub:'+35% groše z odměn', bonus:{ allGold:1.35 } },
          { id:'smoke_day',     name:'Kuřácký svátek',   icon:'🚬', sub:'+40% cíga z aktivit', bonus:{ cigarettes:1.4 } },
          { id:'forge_day',     name:'Den kováře',       icon:'⚒️', sub:'Upgrade ceny -20%', bonus:{ upgradeCost:0.8 } },
          { id:'lucky_hour',    name:'Šťastná hodina',   icon:'🍀', sub:'+5% šance na lepší loot', bonus:{ lootLuck:1.05 } },
        ];

        function startOfDayLocal(d){
          const x = new Date(d);
          x.setHours(0,0,0,0);
          return x;
        }
        function daysSinceEpoch(d){
          // lokální půlnoc → dny od 1970-01-01 v lokálním čase
          const sod = startOfDayLocal(d).getTime();
          return Math.floor(sod / 86400000);
        }
        function getDailyEvent(d){
          const idx = ((daysSinceEpoch(d) % EVENT_ROTATION.length) + EVENT_ROTATION.length) % EVENT_ROTATION.length;
          const ev = EVENT_ROTATION[idx];
          const start = startOfDayLocal(d);
          const end = new Date(start.getTime() + 86400000); // +24h
          return { ...ev, start, end, index: idx };
        }
        function pad2(n){ return String(n).padStart(2,'0'); }
        function fmtCountdown(ms){
          const total = Math.max(0, Math.floor(ms / 1000));
          const h = Math.floor(total / 3600);
          const m = Math.floor((total % 3600) / 60);
          const s = total % 60;
          return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
        }

        function ensureEventPopupStyles(){
          if (document.getElementById('sfGlobalEventPopupStyles')) return;
          const st = document.createElement('style');
          st.id = 'sfGlobalEventPopupStyles';
          st.textContent = `
            .sf-event-popup-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:10000}
            .sf-event-popup{width:min(420px,92vw);background:linear-gradient(135deg,rgba(40,30,20,.96),rgba(18,22,26,.96));border:3px solid rgba(201,164,74,.6);border-radius:14px;padding:16px 16px 14px;box-shadow:0 18px 44px rgba(0,0,0,.75);color:rgba(255,255,255,.95);text-shadow:0 2px 10px rgba(0,0,0,.95)}
            .sf-event-popup h3{margin:0 0 6px;font-size:16px;font-weight:1000}
            .sf-event-popup p{margin:0 0 10px;font-size:12px;opacity:.95;font-weight:900}
            .sf-event-popup .row{display:flex;gap:10px;align-items:center;justify-content:space-between}
            .sf-event-popup .btn{cursor:pointer;border:0;border-radius:10px;padding:8px 12px;font-weight:1000;background:rgba(201,164,74,.22);color:rgba(255,255,255,.95)}
            .sf-event-popup .btn:hover{filter:brightness(1.1)}
          `;
          document.head.appendChild(st);
        }

        function showEventPopup(ev){
          try{
            ensureEventPopupStyles();
            const overlay=document.createElement('div');
            overlay.className='sf-event-popup-overlay';
            overlay.innerHTML = `
              <div class="sf-event-popup" role="dialog" aria-modal="true">
                <h3>${ev.icon} EVENT ZAČAL: ${ev.name}</h3>
                <p>${ev.sub}</p>
                <div class="row">
                  <div style="font-size:11px;opacity:.9;font-weight:900">Konec za: <b>${fmtCountdown(ev.end - new Date())}</b></div>
                  <button class="btn" type="button">OK</button>
                </div>
              </div>`;
            overlay.querySelector('.btn').addEventListener('click', ()=>overlay.remove());
            overlay.addEventListener('click', (e)=>{ if(e.target===overlay) overlay.remove(); });
            document.body.appendChild(overlay);
          }catch(e){}
        }

        function updateGlobalEventUI(){
          const now = new Date();
          const ev = getDailyEvent(now);

          // expose globally (pro mise/shop/arenu, pokud to chceš napojit později)
          if (!window.SF) window.SF = {};
          window.SF.globalEvent = ev;

          const eb = document.getElementById('sfEventBanner');
          const ebText = document.getElementById('sfEventBannerText');
          const ebSub = document.getElementById('sfEventBannerSub');
          const evCd = document.getElementById('globalEventCountdown');

          if (eb) { eb.classList.add('open'); eb.classList.remove('closed'); }
          if (ebText) ebText.textContent = `${ev.icon} ${ev.name}`;
          if (ebSub) ebSub.textContent = `${ev.sub} • Konec za: ${fmtCountdown(ev.end - now)}`;
          if (evCd) evCd.textContent = `EVENT: ${fmtCountdown(ev.end - now)}`;

          // popup jen 1× pro nový den/event
          const last = localStorage.getItem('sf_last_event_id');
          if (last !== ev.id) {
            localStorage.setItem('sf_last_event_id', ev.id);
            // neotravuj úplně při prvním spuštění? – necháme vždy, jak chceš ve stylu S&F
            showEventPopup(ev);
          }
        }

        updateGlobalEventUI();
        window.__sfGlobalEventTimer && clearInterval(window.__sfGlobalEventTimer);
        window.__sfGlobalEventTimer = setInterval(updateGlobalEventUI, 1000);
      } catch (e) { /* silent */ }

      // === ČERNÝ TRH: odemykání + odpočet ===
      try {
        const bmBtn = document.getElementById('blackMarketBtn');
        const bmCountdown = null; // countdown text is used by Global Event now

        function pad2(n) { return String(n).padStart(2, '0'); }
        function fmtCountdown(ms) {
          const total = Math.max(0, Math.floor(ms / 1000));
          const h = Math.floor(total / 3600);
          const m = Math.floor((total % 3600) / 60);
          const s = total % 60;
          return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
        }

        function blackMarketState(now = new Date()) {
          // Musí sedět s black.js: otevřeno Čt+Pá+So (0 = neděle)
          const EVENT_DAYS = [4, 5, 6];
          const day = now.getDay();

          function nextDowTime(dow, hh, mm, ss) {
            const d = new Date(now);
            const daysUntil = (dow - d.getDay() + 7) % 7;
            d.setDate(d.getDate() + daysUntil);
            d.setHours(hh, mm, ss, 0);
            if (daysUntil === 0 && now.getTime() >= d.getTime()) d.setDate(d.getDate() + 7);
            return d;
          }

          if (EVENT_DAYS.includes(day)) {
            const sunday = new Date(now);
            sunday.setDate(now.getDate() + (7 - day));
            sunday.setHours(0, 0, 0, 0);
            return { open: true, endsAt: sunday, nextOpenAt: null };
          }

          const nextThu = nextDowTime(4, 0, 0, 0);
          return { open: false, endsAt: null, nextOpenAt: nextThu };
        }

        function updateBlackMarketUI() {
          if (!bmBtn) return;
          const st = blackMarketState(new Date());

          // Event banner v menu (hlavní lišta)
          const eb = null; // banner is used by Global Event
          const ebText = null;
          const ebSub = null;

          if (st.open) {
            bmBtn.classList.remove('locked');
            bmBtn.classList.add('unlocked');
            bmBtn.dataset.open = 'true';
            bmBtn.setAttribute('data-icon', '🛒');
            if (bmCountdown && st.endsAt) {
              bmCountdown.textContent = `Otevřeno: ${fmtCountdown(st.endsAt - new Date())}`;
            }

            if (eb) { eb.classList.add('open'); eb.classList.remove('closed'); }
            if (ebText) ebText.textContent = 'OTEVŘENO';
            if (ebSub && st.endsAt) ebSub.textContent = `Zavírá za: ${fmtCountdown(st.endsAt - new Date())}`;
          } else {
            bmBtn.classList.remove('unlocked');
            bmBtn.classList.add('locked');
            bmBtn.dataset.open = 'false';
            bmBtn.setAttribute('data-icon', '🔒');
            if (bmCountdown && st.nextOpenAt) {
              bmCountdown.textContent = `Otevírá za: ${fmtCountdown(st.nextOpenAt - new Date())}`;
            }

            if (eb) { eb.classList.add('closed'); eb.classList.remove('open'); }
            if (ebText) ebText.textContent = 'ZAVŘENO';
            if (ebSub && st.nextOpenAt) ebSub.textContent = `Otevírá za: ${fmtCountdown(st.nextOpenAt - new Date())}`;
          }
        }

        // klik – když je zamčeno, zablokuj
        if (bmBtn) {
          bmBtn.addEventListener('click', (e) => {
            if (bmBtn.dataset.open !== 'true') {
              e.preventDefault();
              alert('❌ ČERNÝ TRH je momentálně zavřený.\nOtevírá se vždy Čt/Pá/So (celý den).');
            }
          });
        }

        updateBlackMarketUI();
        // odpočet běží naživo
        window.__sfBlackMarketTimer && clearInterval(window.__sfBlackMarketTimer);
        window.__sfBlackMarketTimer = setInterval(updateBlackMarketUI, 1000);
      } catch (e) { /* silent */ }
    }
  } catch (e) { /* silent */ }

 try { sfApplySoundState(); } catch {} });

  // Zachytávej pokusy o přehrání (hudba i efekty)
  document.addEventListener('play', (ev) => {
    try {
      if (ev.target && ev.target.tagName === 'AUDIO' && sfGetSoundEnabled() === false) {
        ev.target.pause();
      }
    } catch {}
  }, true);

  function sfGetLang() {
    return localStorage.getItem(SF_LANG_KEY) || "cs";
  }
  function sfSetLang(lang) {
    localStorage.setItem(SF_LANG_KEY, lang);
    window.SF_LANG = lang;
  }

  // ===== SFX (efekty zvuků) =====
  // Použij: SFPlaySfx('buy'|'equip'|'error'|'ui_click')
  const __SFX_MAP = {
    ui_click: 'sfx/ui_click.wav',
    buy: 'sfx/buy.wav',
    equip: 'sfx/equip.wav',
    error: 'sfx/error.wav'
  };
  const __SFX_CACHE = {};

  function sfGetSfx(name) {
    const src = __SFX_MAP[name] || __SFX_MAP.ui_click;
    if (__SFX_CACHE[src]) return __SFX_CACHE[src];
    const a = document.createElement('audio');
    a.src = src;
    a.preload = 'auto';
    a.volume = 0.85;
    __SFX_CACHE[src] = a;
    return a;
  }

  window.SFPlaySfx = function SFPlaySfx(name) {
    if (window.SF_SOUND_ENABLED === false) return;
    try {
      const a = sfGetSfx(name);
      a.currentTime = 0;
      a.play().catch(()=>{});
    } catch {}
  };

  // zpětná kompatibilita
  window.SFPlayClick = function SFPlayClick() {
    window.SFPlaySfx('ui_click');
  };

  // CLASS META pro badge i na dalších stránkách
  window.SF_CLASS_META = window.SF_CLASS_META || {
    padouch: { icon: "👻", label: "Padouch" },
    rvac:    { icon: "✊", label: "Rváč" },
    mozek:   { icon: "💡", label: "Mozek" }
  };
  window.SF_DABLIK_ICON = "😈";

  function sfGetPlayerClassSafe() {
    try {
      // 1) nové SF stats (vyber.html ukládá sem)
      const rawStats = window.SF?.stats?.stats;
      if (rawStats) {
        if (typeof rawStats === "string") {
          try {
            const parsed = JSON.parse(rawStats);
            const sfCls = parsed?.player_class;
            if (sfCls) return String(sfCls).toLowerCase();
          } catch {}
        } else {
          const sfCls = rawStats?.player_class;
          if (sfCls) return String(sfCls).toLowerCase();
        }
      }

      // 2) starší runtime objekt
      const legacy = window.playerStats?.player_info?.player_class;
      if (legacy) return String(legacy).toLowerCase();

      // 3) localStorage (různé formáty)
      const raw = localStorage.getItem("player_stats");
      if (!raw) return null;
      const s = JSON.parse(raw);

      const c1 = s?.player_info?.player_class;
      if (c1) return String(c1).toLowerCase();
      const c2 = s?.stats?.player_class;
      if (c2) return String(c2).toLowerCase();
      const c3 = s?.player_class;
      if (c3) return String(c3).toLowerCase();

      return null;
    } catch { return null; }
  }

  // zpřístupni pro ostatní stránky (arena, shop, ...)
  window.sfGetPlayerClassSafe = sfGetPlayerClassSafe;

  window.SFEnsureAvatarBadge = function SFEnsureAvatarBadge() {
    const cls = sfGetPlayerClassSafe();
    if (!cls) return;
    const meta = window.SF_CLASS_META[cls] || window.SF_CLASS_META.padouch;

    // cíle: malé avatary v HUD + velké avatary na stránkách
    const targets = [];
    document.querySelectorAll(".avatar-box").forEach(t => targets.push(t));
    document.querySelectorAll(".character").forEach(t => targets.push(t));
    document.querySelectorAll(".character-shop").forEach(t => targets.push(t));
    document.querySelectorAll(".character-arena").forEach(t => targets.push(t));

    targets.forEach(t => {
      if (!t.style.position) t.style.position = "relative";
      let b = t.querySelector(".class-badge");
      if (!b) {
        b = document.createElement("div");
        b.className = "class-badge";
        t.appendChild(b);
      }
      b.textContent = meta.icon;
      b.title = meta.label;
    });
  };

  // Badge se často přidává až po vykreslení UI → hlídej DOM změny a zkus ho doplnit.
  (function sfWatchBadgeTargets(){
    if (window.__sfBadgeObserver) return;
    let t = null;
    const kick = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        try { window.SFEnsureAvatarBadge && window.SFEnsureAvatarBadge(); } catch {}
      }, 60);
    };
    try {
      const obs = new MutationObserver(kick);
      obs.observe(document.documentElement, { childList: true, subtree: true });
      window.__sfBadgeObserver = obs;
    } catch {}
    document.addEventListener("DOMContentLoaded", kick);
  })();

  async function sfLogout() {
    try {
      if (window.supabase?.auth) await window.supabase.auth.signOut();
    } catch (e) {
      console.warn("Logout error:", e);
    }
    // pro jistotu smaž lokální session a redirect
    try { localStorage.removeItem("sf_autologin"); } catch {}
    window.location.href = "login.html";
  }

  function sfCreateSettingsModal() {
    if (document.getElementById(SF_SETTINGS_MODAL)) return;

    const modal = document.createElement("div");
    modal.id = SF_SETTINGS_MODAL;
    modal.className = "sf-modal sf-modal--hidden";
    modal.innerHTML = `
      <div class="sf-modal__backdrop" data-close="1"></div>
      <div class="sf-modal__panel sf-modal__panel--wide">
        <div class="sf-modal__header">
          <div class="sf-modal__title">NASTAVENÍ</div>
          <button class="sf-modal__x" type="button" data-close="1">✕</button>
        </div>

        <div class="sf-modal__body">
          <div class="sf-setting">
            <div class="sf-setting__label" data-i18n="ui.sound">Zvuk</div>
            <button id="sfSoundToggle" class="sf-pill" type="button"></button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label" data-i18n="ui.language">Jazyk</div>
            <select id="sfLangSelect" class="sf-select">
              <option value="cs">Čeština</option>
              <option value="en">English</option>
              <option value="sk">Slovenčina</option>
              <option value="de">Deutsch</option>
              <option value="pl">Polski</option>
              <option value="ru">Русский</option>
            </select>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Kvalita grafiky</div>
            <select id="sfQualitySelect" class="sf-select">
              <option value="low">Nízká</option>
              <option value="med">Střední</option>
              <option value="high">Vysoká</option>
              <option value="ultra">Ultra</option>
            </select>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Přepínání stránek (animace)</div>
            <button id="sfTransToggle" class="sf-pill" type="button"></button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Snížit pohyb (pro slabší PC)</div>
            <button id="sfReduceMotionToggle" class="sf-pill" type="button"></button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Měřítko UI</div>
            <select id="sfUiScaleSelect" class="sf-select">
              <option value="90">90%</option>
              <option value="100">100%</option>
              <option value="110">110%</option>
            </select>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Inventář větší (shop/postava)</div>
            <select id="sfInvSizeSelect" class="sf-select">
              <option value="normal">Normální</option>
              <option value="big">Větší</option>
            </select>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Velikost tooltipu (info u itemů)</div>
            <select id="sfTooltipScaleSelect" class="sf-select">
              <option value="100">100%</option>
              <option value="85">85%</option>
              <option value="70">70%</option>
            </select>
          </div>



          <div class="sf-setting">
            <div class="sf-setting__label">Zpoždění tooltipu</div>
            <select id="sfTooltipDelaySelect" class="sf-select">
              <option value="0">0 ms</option>
              <option value="200">200 ms</option>
              <option value="400">400 ms</option>
            </select>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Režim výkonu</div>
            <select id="sfPerfModeSelect" class="sf-select">
              <option value="normal">Normal</option>
              <option value="performance">Performance</option>
              <option value="battery">Battery</option>
            </select>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Kontrast UI</div>
            <select id="sfContrastSelect" class="sf-select">
              <option value="normal">Normální</option>
              <option value="high">Vysoký</option>
            </select>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Zvukový balíček</div>
            <select id="sfSoundPackSelect" class="sf-select">
              <option value="default">Default</option>
              <option value="minimal">Minimal</option>
              <option value="retro">Old-school</option>
            </select>
          </div>
          <div class="sf-setting">
            <div class="sf-setting__label">Potvrzení nákupu</div>
            <button id="sfConfirmBuyToggle" class="sf-pill" type="button"></button>
          </div>



          <div class="sf-setting">
            <div class="sf-setting__label">Potvrzení prodeje</div>
            <button id="sfConfirmSellToggle" class="sf-pill" type="button"></button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Potvrzení upgradu</div>
            <button id="sfConfirmUpgradeToggle" class="sf-pill" type="button"></button>
          </div>
          <button id="sfLogoutBtn" class="sf-btn sf-btn--danger" type="button">ODHLÁSIT</button>
        </div>
      </div>
    `;
    // Připnout na <html>, aby fixed nebyl ovlivněný transformem (SF škálování wrapper)
    (document.documentElement || document.body).appendChild(modal);

    const syncUI = () => {
      const on = sfGetSoundEnabled();
      const btn = document.getElementById("sfSoundToggle");
      if (btn) btn.textContent = on ? "Zapnuto" : "Vypnuto";

      const sel = document.getElementById("sfLangSelect");
      if (sel) sel.value = sfGetLang();

      const q = document.getElementById("sfQualitySelect");
      if (q) q.value = sfGetQuality();

      const t = document.getElementById('sfTransToggle');
      if (t) t.textContent = sfPageTransitionsEnabled() ? 'Zapnuto' : 'Vypnuto';

      const rm = document.getElementById('sfReduceMotionToggle');
      if (rm) rm.textContent = sfGetBool(SF_REDUCE_MOTION_KEY, false) ? 'Zapnuto' : 'Vypnuto';

      const sc = document.getElementById('sfUiScaleSelect');
      if (sc) sc.value = sfGetUiScale();

      const inv = document.getElementById('sfInvSizeSelect');
      if (inv) inv.value = sfGetInvSize();

      const tt = document.getElementById('sfTooltipScaleSelect');
      if (tt) tt.value = sfGetTooltipScale();

      const td = document.getElementById('sfTooltipDelaySelect');
      if (td) td.value = sfGetTooltipDelay();

      const pm = document.getElementById('sfPerfModeSelect');
      if (pm) pm.value = sfGetPerfMode();

      const hc = document.getElementById('sfContrastSelect');
      if (hc) hc.value = sfGetContrast();

      const sp = document.getElementById('sfSoundPackSelect');
      if (sp) sp.value = sfGetSoundPack();

      const cb = document.getElementById('sfConfirmBuyToggle');
      if (cb) cb.textContent = sfGetBool(SF_CONFIRM_BUY_KEY, true) ? 'Zapnuto' : 'Vypnuto';

      const cs = document.getElementById('sfConfirmSellToggle');
      if (cs) cs.textContent = sfGetBool(SF_CONFIRM_SELL_KEY, true) ? 'Zapnuto' : 'Vypnuto';

      const cu = document.getElementById('sfConfirmUpgradeToggle');
      if (cu) cu.textContent = sfGetBool(SF_CONFIRM_UPGRADE_KEY, true) ? 'Zapnuto' : 'Vypnuto';
    };

    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.dataset && t.dataset.close) hideSettings();
    });

    document.getElementById("sfSoundToggle")?.addEventListener("click", () => {
      const next = !sfGetSoundEnabled();
      sfSetSoundEnabled(next);
      syncUI();
    });

    document.getElementById("sfLangSelect")?.addEventListener("change", (e) => {
      sfSetLang(e.target.value);
    });

      document.getElementById("sfQualitySelect")?.addEventListener("change", (e) => {
        sfSetQuality(e.target.value);
      });

    document.getElementById('sfTransToggle')?.addEventListener('click', () => {
      const next = !sfPageTransitionsEnabled();
      sfSetBool(SF_PAGE_TRANS_KEY, next);
      syncUI();
    });

    document.getElementById('sfReduceMotionToggle')?.addEventListener('click', () => {
      const next = !sfGetBool(SF_REDUCE_MOTION_KEY, false);
      sfSetBool(SF_REDUCE_MOTION_KEY, next);
      sfApplyReduceMotion();
      syncUI();
    });

    document.getElementById('sfUiScaleSelect')?.addEventListener('change', (e) => {
      sfSetUiScale(e.target.value);
      syncUI();
    });

    document.getElementById('sfInvSizeSelect')?.addEventListener('change', (e) => {
      sfSetInvSize(e.target.value);
      syncUI();
    });

    document.getElementById('sfConfirmBuyToggle')?.addEventListener('click', () => {
      const next = !sfGetBool(SF_CONFIRM_BUY_KEY, true);
      sfSetBool(SF_CONFIRM_BUY_KEY, next);
      syncUI();
    });

    document.getElementById("sfLogoutBtn")?.addEventListener("click", sfLogout);

    function showSettings() {
      syncUI();
      modal.classList.remove("sf-modal--hidden");
    }
    function hideSettings() {
      modal.classList.add("sf-modal--hidden");
    }

    window.SFShowSettings = showSettings;
    window.SFHideSettings = hideSettings;

    // initial
    sfSetSoundEnabled(sfGetSoundEnabled());
    sfSetLang(sfGetLang());
      sfSetQuality(sfGetQuality());
    sfApplyReduceMotion();
    sfSetUiScale(sfGetUiScale());
    sfSetTooltipScale(sfGetTooltipScale());
    sfSetTooltipDelay(sfGetTooltipDelay());
    sfSetContrast(sfGetContrast());
    sfSetPerfMode(sfGetPerfMode());
    sfSetSoundPack(sfGetSoundPack());
  }

  // -------------------------
  // PODPORA (otaznik) – UI připravené (bez funkcí)
  // -------------------------
  function sfGetQuality(){
    try { return localStorage.getItem('sf_quality') || 'high'; } catch { return 'high'; }
  }
  function sfSetQuality(v){
    try { localStorage.setItem('sf_quality', String(v || 'high')); } catch {}
    // jen připrava – zatím pouze data-atribut pro budoucí napojení
    try { document.documentElement.dataset.quality = String(v || 'high'); } catch {}
  }

  function sfCreateHelpModal(){
    if (document.getElementById(SF_HELP_MODAL)) return;

    const modal = document.createElement('div');
    modal.id = SF_HELP_MODAL;
    modal.className = 'sf-modal sf-modal--hidden';
    modal.innerHTML = `
      <div class="sf-modal__backdrop" data-close="1"></div>
      <div class="sf-modal__panel sf-modal__panel--wide">
        <div class="sf-modal__header">
          <div class="sf-modal__title">PODPORA</div>
          <button class="sf-modal__x" type="button" data-close="1">✕</button>
        </div>

        <div class="sf-modal__body">
          <div class="sf-setting">
            <div class="sf-setting__label">Export uložených dat</div>
            <button id="sfExportSave" class="sf-pill" type="button">Export</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Import uložených dat</div>
            <button id="sfImportSave" class="sf-pill" type="button">Import</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Reset progresu (lokálně)</div>
            <button id="sfResetLocal" class="sf-pill" type="button">Reset</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Nahlásit bug (kopírovat info)</div>
            <button id="sfCopyBug" class="sf-pill" type="button">Kopírovat</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Kupón (demo)</div>
            <button id="sfCoupon" class="sf-pill" type="button">Zadat</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Co je nového</div>
            <button id="sfWhatsNew" class="sf-pill" type="button">Otevřít</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">FAQ</div>
            <button id="sfFAQ" class="sf-pill" type="button">Zobrazit</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Ovládání / tipy</div>
            <button id="sfControls" class="sf-pill" type="button">Zobrazit</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Vyčistit cache (tvrdý reload)</div>
            <button id="sfHardReload" class="sf-pill" type="button">Reload</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Zpětná vazba (uloží se lokálně)</div>
            <button id="sfFeedback" class="sf-pill" type="button">Napsat</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Reset nastavení (doporučeno při bugu)</div>
            <button id="sfResetSettings" class="sf-pill" type="button">Reset</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">FPS počítadlo</div>
            <button id="sfFpsToggle" class="sf-pill" type="button">Vypnuto</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Diagnostika zařízení (kopírovat)</div>
            <button id="sfDeviceInfo" class="sf-pill" type="button">Kopírovat</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Zobrazit poslední feedback</div>
            <button id="sfShowFeedback" class="sf-pill" type="button">Zobrazit</button>
          </div>

          <div class="sf-setting">
            <div class="sf-setting__label">Import ze schránky</div>
            <button id="sfImportClipboard" class="sf-pill" type="button">Import</button>
          </div>
          <div class="sf-modal__note">
            Export/Import je čistě lokální (localStorage). Supabase účet to nemaže.
          </div>
        </div>
      </div>
    `;
    // Připnout na <html>, aby fixed nebyl ovlivněný transformem (SF škálování wrapper)
    (document.documentElement || document.body).appendChild(modal);

    modal.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.dataset && t.dataset.close) hideHelp();
    });

    // --- Help actions ---
    const byId = (id) => modal.querySelector('#' + id);

    function collectLocalSave(){
      const out = {
        version: 1,
        exportedAt: new Date().toISOString(),
        localStorage: {}
      };
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          // bereme jen věci hry/settings (sf_...) aby to nebylo creepy
          if (!/^sf_/i.test(k) && !/gameState|gopnik/i.test(k)) continue;
          out.localStorage[k] = localStorage.getItem(k);
        }
      } catch {}
      return out;
    }

    byId('sfExportSave')?.addEventListener('click', () => {
      const data = collectLocalSave();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'gopnik_save_export.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { URL.revokeObjectURL(a.href); } catch {}
        a.remove();
      }, 1000);
    });

    byId('sfImportSave')?.addEventListener('click', () => {
      const txt = prompt('Vlož JSON export (gopnik_save_export.json):');
      if (!txt) return;
      try {
        const data = JSON.parse(txt);
        const ls = data?.localStorage || {};
        Object.keys(ls).forEach((k) => {
          try { localStorage.setItem(k, String(ls[k])); } catch {}
        });
        alert('✅ Import hotový. Obnov stránku (F5).');
      } catch (e) {
        alert('❌ Neplatný JSON.');
      }
    });

    byId('sfResetLocal')?.addEventListener('click', () => {
      if (!confirm('Opravdu resetovat lokální data (nastavení + lokální progres)?')) return;
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (/^sf_/i.test(k) || /gameState|gopnik/i.test(k)) keys.push(k);
        }
        keys.forEach(k => { try { localStorage.removeItem(k); } catch {} });
      } catch {}
      alert('✅ Reset hotový. Obnov stránku (F5).');
    });

    byId('sfCopyBug')?.addEventListener('click', async () => {
      const info = {
        page: location.pathname.split('/').pop(),
        ua: navigator.userAgent,
        time: new Date().toISOString(),
        settings: {
          sound: sfGetSoundEnabled(),
          quality: sfGetQuality(),
          uiScale: sfGetUiScale(),
          tooltipScale: sfGetTooltipScale(),
          reduceMotion: sfGetBool(SF_REDUCE_MOTION_KEY, false),
          transitions: sfPageTransitionsEnabled(),
          invSize: sfGetInvSize(),
          confirmBuy: sfGetBool(SF_CONFIRM_BUY_KEY, true),
          fpsHud: (function(){ try { return localStorage.getItem('sf_fps') === '1'; } catch { return false; } })()
        }
      };
      const text = 'BUG REPORT\n' + JSON.stringify(info, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        alert('✅ Zkopírováno do schránky.');
      } catch {
        prompt('Zkopíruj ručně:', text);
      }
    });

    byId('sfCoupon')?.addEventListener('click', () => {
      const code = prompt('Zadej kupón (demo):');
      if (!code) return;
      const c = String(code).trim().toUpperCase();
      // demo kódy – bezpečné (jen lokální)
      if (c === 'GOPNIK10') {
        alert('✅ Kupón přijat (demo): +10🚬 při dalším přihlášení.');
        try { localStorage.setItem('sf_coupon_demo', 'GOPNIK10'); } catch {}
      } else {
        alert('❌ Neznámý kupón.');
      }
    });


    byId('sfWhatsNew')?.addEventListener('click', () => {
      // Přesměruj na postavu, kde je 'Co je nového' modal (hash to vynutí)
      location.href = 'postava.html#whatsnew';
    });

    byId('sfFAQ')?.addEventListener('click', () => {
      alert(`FAQ

• Crit šance = Štěstí (cap 50%)
• Výdrž = HP
• Síla = DMG
• Obrana má diminishing returns (nejde na 100%)

Tip: Pokud je tooltip moc velký, dej v Nastavení „Velikost tooltipu“ na 85% nebo 70%.`);
    });

    byId('sfControls')?.addEventListener('click', () => {
      alert(`Ovládání / tipy

• Shop: drag & drop itemů
• Výbava: přetáhni item do slotu
• Inventář: přetáhni zpět do volného slotu
• Aréna: štěstí = crit (ne intelligence)

Doporučení: pro mobil dej UI 90% a „Snížit pohyb“ = Zapnuto.`);
    });

    byId('sfHardReload')?.addEventListener('click', () => {
      const base = location.pathname.split('/').pop() || 'index.html';
      const h = location.hash || '';
      location.href = base + '?v=' + Date.now() + h;
    });

    byId('sfFeedback')?.addEventListener('click', () => {
      const msg = prompt('Napiš zpětnou vazbu (uloží se lokálně):');
      if (!msg) return;
      try { localStorage.setItem('sf_feedback_last', String(msg).slice(0, 2000)); } catch {}
      alert('✅ Uloženo lokálně. Díky.');
    });

    // --- Extra funkce (aby se "Otazník" vyplatil) ---
    function sfGetFpsEnabled(){ try { return localStorage.getItem('sf_fps') === '1'; } catch { return false; } }
    function sfSetFpsEnabled(v){ try { localStorage.setItem('sf_fps', v ? '1' : '0'); } catch {} }

    function sfEnsureFpsHud(){
      let hud = document.getElementById('sfFpsHud');
      if (hud) return hud;
      hud = document.createElement('div');
      hud.id = 'sfFpsHud';
      hud.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:30000;background:rgba(0,0,0,.55);border:2px solid rgba(219,176,69,.85);border-radius:12px;padding:8px 10px;color:#fff;font-weight:900;font-size:12px;letter-spacing:.4px;backdrop-filter:blur(2px);transform:none!important;'
      hud.textContent = 'FPS: ...';
      document.body.appendChild(hud);
      return hud;
    }

    function sfStartFps(){
      const hud = sfEnsureFpsHud();
      let last = performance.now();
      let frames = 0;
      let raf = 0;
      function tick(t){
        frames++;
        if (t - last >= 1000){
          const fps = Math.round((frames * 1000) / (t - last));
          hud.textContent = 'FPS: ' + fps;
          frames = 0;
          last = t;
        }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
      window.__sf_fps_raf = raf;
    }
    function sfStopFps(){
      try { cancelAnimationFrame(window.__sf_fps_raf || 0); } catch {}
      window.__sf_fps_raf = 0;
      const hud = document.getElementById('sfFpsHud');
      if (hud) hud.remove();
    }
    function sfSyncFpsBtn(){
      const b = byId('sfFpsToggle');
      if (!b) return;
      const on = sfGetFpsEnabled();
      b.textContent = on ? 'Zapnuto' : 'Vypnuto';
    }

    // pokud bylo FPS zapnuté už dřív, obnov HUD (i bez otevření modalu)
    try {
      if (sfGetFpsEnabled() && !document.getElementById('sfFpsHud')) sfStartFps();
    } catch {}
    sfSyncFpsBtn();

    byId('sfResetSettings')?.addEventListener('click', () => {
      if (!confirm('Resetovat nastavení na výchozí hodnoty?')) return;
      try {
        localStorage.setItem('sf_sound', '1');
        localStorage.setItem('sf_lang', 'cs');
        localStorage.setItem('sf_quality', 'high');
        localStorage.setItem('sf_ui_scale', '100');
        localStorage.setItem('sf_tooltip_scale', '85');
        localStorage.setItem('sf_inv_size', 'normal');
        localStorage.setItem(SF_REDUCE_MOTION_KEY, '0');
        localStorage.setItem(SF_PAGE_TRANS_KEY, '1');
        localStorage.setItem(SF_CONFIRM_BUY_KEY, '1');
        localStorage.setItem('sf_fps', '0');
      } catch {}
      alert('✅ Reset hotový. Obnov stránku (F5).');
    });

    byId('sfFpsToggle')?.addEventListener('click', () => {
      const next = !sfGetFpsEnabled();
      sfSetFpsEnabled(next);
      if (next) sfStartFps(); else sfStopFps();
      sfSyncFpsBtn();
    });

    byId('sfDeviceInfo')?.addEventListener('click', async () => {
      const info = {
        page: location.pathname.split('/').pop(),
        time: new Date().toISOString(),
        ua: navigator.userAgent,
        lang: navigator.language,
        dpr: window.devicePixelRatio,
        screen: { w: screen.width, h: screen.height },
        viewport: { w: window.innerWidth, h: window.innerHeight },
      };
      const text = 'DEVICE INFO\n' + JSON.stringify(info, null, 2);
      try { await navigator.clipboard.writeText(text); alert('✅ Zkopírováno.'); }
      catch { prompt('Zkopíruj ručně:', text); }
    });

    byId('sfShowFeedback')?.addEventListener('click', () => {
      let msg = '';
      try { msg = localStorage.getItem('sf_feedback_last') || ''; } catch {}
      if (!msg) return alert('Žádný feedback zatím není uložený.');
      alert('Poslední feedback:\n\n' + msg);
    });

    byId('sfImportClipboard')?.addEventListener('click', async () => {
      try {
        const txt = await navigator.clipboard.readText();
        if (!txt) return alert('Schránka je prázdná.');
        const data = JSON.parse(txt);
        const ls = data?.localStorage || {};
        Object.keys(ls).forEach((k) => {
          try { localStorage.setItem(k, String(ls[k])); } catch {}
        });
        alert('✅ Import hotový. Obnov stránku (F5).');
      } catch (e) {
        alert('❌ Ve schránce není platný JSON export.');
      }
    });



    byId('sfRules')?.addEventListener('click', () => {
      alert(`PRAVIDLA BOJE

• Štěstí = crit šance (0,25% za 1, max 50%)
• Crit dmg = 200%
• Síla = +2% DMG za bod
• Výdrž = +10 HP za bod
• Obrana = snižuje dmg s klesající účinností (není 100% reduc)
`);
    });

    byId('sfStatsLocal')?.addEventListener('click', () => {
      try {
        const gs = window.gameState || {};
        const fights = Number(localStorage.getItem('sf_stat_fights') || 0);
        const wins   = Number(localStorage.getItem('sf_stat_wins') || 0);
        const crits  = Number(localStorage.getItem('sf_stat_crits') || 0);
        const rate = fights ? Math.round((crits/fights)*1000)/10 : 0;
        alert(`STATISTIKY (lokální)

Boje: ${fights}
Výhry: ${wins}
Crite: ${crits}
Crit rate: ${rate}%
Level: ${gs.level || '?'}
`);
      } catch {
        alert('Statistiky nejsou dostupné.');
      }
    });

    byId('sfShortcuts')?.addEventListener('click', async () => {
      const txt = `ZKRATKY

• ESC – zavřít okno
• M – mise
• A – arena
• S – shop
`;
      try { await navigator.clipboard.writeText(txt); alert('Zkopírováno.'); } catch { alert(txt); }
    });

    byId('sfReportCheat')?.addEventListener('click', async () => {
      const txt = `REPORT CHEAT

Čas: ${new Date().toISOString()}
Stránka: ${location.href}
UserAgent: ${navigator.userAgent}
`;
      try { await navigator.clipboard.writeText(txt); alert('Zkopírováno do schránky.'); } catch { alert(txt); }
    });

    byId('sfContact')?.addEventListener('click', () => {
      alert('Kontakt/Discord: doplníš později (placeholder).');
    });
function showHelp(){ modal.classList.remove('sf-modal--hidden'); }
    function hideHelp(){ modal.classList.add('sf-modal--hidden'); }
    window.SFShowHelp = showHelp;
    window.SFHideHelp = hideHelp;
  }

  function sfInjectHelpButton(){
    const topBox = document.querySelector('.menu-top');
    if (!topBox) return;
    if (!topBox.querySelector('.sf-top-help')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sf-top-help';
      btn.title = 'Podpora';
      btn.setAttribute('aria-label', 'Podpora');
      btn.textContent = '❓';
      topBox.appendChild(btn);
      btn.addEventListener('click', () => {
        sfCreateHelpModal();
        window.SFShowHelp && window.SFShowHelp();
      });
    }
  }

  // Aplikuj nastavení hned po načtení stránky (i když se modal nikdy neotevře)
  document.addEventListener('DOMContentLoaded', () => {
    try { sfApplyReduceMotion(); } catch {}
    try { sfSetUiScale(sfGetUiScale());
    sfSetTooltipScale(sfGetTooltipScale());
    sfSetTooltipDelay(sfGetTooltipDelay());
    sfSetContrast(sfGetContrast());
    sfSetPerfMode(sfGetPerfMode());
    sfSetSoundPack(sfGetSoundPack()); } catch {}
    try { sfSetTooltipScale(sfGetTooltipScale()); } catch {}
  });

  // -------------------------
  // MENU: doplnění chybějících tlačítek globálně
  // -------------------------
  function sfEnsureMenuLinks() {
    const frame = document.querySelector('.menu-frame');
    if (!frame) return;

    // Najdi "poslední" tlačítko (clicker), před které budeme vkládat novinky
    const last = frame.querySelector('a.sf-btn--last') || frame.querySelector('a[href="gopnik.html"]');
    const insertBefore = last || null;

    const ensure = (href, label, icon) => {
      const existing = frame.querySelector(`a[href="${href}"]`);
      if (existing) return existing;
      const a = document.createElement('a');
      a.href = href;
      a.className = 'sf-btn';
      a.dataset.icon = icon;
      a.textContent = label;
      frame.insertBefore(a, insertBefore);
      return a;
    };

    // Pořadí: ... MISE -> CIGARETÁŘ -> ŠTĚSTÍ -> MAZLÍČEK -> CLICKER
    const aCig = ensure('grose.html', 'CIGARETÁŘ', '🚬');
    const aLuck = ensure('kolo.html', 'ŠTĚSTÍ', '🍀');
    const aPets = ensure('pets.html', 'MAZLÍČEK', '🐾');

    // Nové položky do levého menu (stejný scale systém jako ostatní .sf-btn)
    const aChyse = ensure('chys.html', 'CHÝŠE', '🏚️');
    const aAchi  = ensure('achi.html', 'ACHIEVEMENTY', '🏆');

    // Zajisti správné řazení (když už stránka měla některé z nich)
    // Jednoduchý přesun: vyndej a vrať zpět před "last".
    const order = [aCig, aLuck, aPets, aChyse, aAchi].filter(Boolean);
    order.forEach(el => {
      if (el && insertBefore) frame.insertBefore(el, insertBefore);
    });
  }

  function sfInjectGearButton() {
    const frame = document.querySelector(".menu-frame");
    if (!frame) return;

    // 0) Zajisti "TOP" ozubené kolečko v .menu-top (místo dřívějšího "+" pseudo-elementu)
    const topBox = document.querySelector('.menu-top');
    if (topBox && !topBox.querySelector('.sf-top-gear')) {
      const topBtn = document.createElement('button');
      topBtn.type = 'button';
      // nepoužívej .gear-btn (některé stránky ho přepisují velikostí)
      topBtn.className = 'sf-top-gear';
      topBtn.title = 'Nastavení';
      topBtn.setAttribute('aria-label', 'Nastavení');
      topBtn.textContent = '⚙️';
      topBox.appendChild(topBtn);
      topBtn.addEventListener('click', () => {
        sfCreateSettingsModal();
        window.SFShowSettings && window.SFShowSettings();
      });
    }

    // Pokud je na stránce víc gear tlačítek (některé HTML to má 2×), necháme jen jedno.
    const allGears = Array.from(document.querySelectorAll(".gear-btn"));
    if (allGears.length > 1) {
      // preferuj TOP kolečko; když není, vezmi spodní; když není, první výskyt
      const preferred = document.querySelector('.menu-top .sf-top-gear') || frame.querySelector(".menu-bottom .gear-btn") || frame.querySelector(".gear-btn") || allGears[0];
      allGears.forEach((b) => {
        if (b !== preferred) b.remove();
      });
    }

    // 1) Pokud stránka už má svoje tlačítko .gear-btn, jen ho napojíme (a zrušíme případné duplicity)
    const existing = frame.querySelector(".gear-btn") || document.querySelector(".gear-btn");
    if (existing) {
      // odstranit dřívější injected tlačítko, aby nebylo 2×
      const injected = frame.querySelector("#sfGearBtn");
      if (injected) injected.remove();

      existing.addEventListener("click", () => {
        sfCreateSettingsModal();
        window.SFShowSettings && window.SFShowSettings();
      }, { once: true });
      return;
    }

    // 2) Když na stránce gear není, vytvoříme jeden kus v TOP boxu (menu-top)
    const host = document.querySelector('.menu-top') || frame;
    if (host.querySelector("#sfGearBtn")) return;

    host.style.position = host.style.position || "relative";

    const btn = document.createElement("button");
    btn.id = "sfGearBtn";
    btn.type = "button";
    btn.className = "gear-btn sf-top-gear";
    btn.title = "Nastavení";
    btn.innerHTML = "⚙️";
    host.appendChild(btn);

    btn.addEventListener("click", () => {
      sfCreateSettingsModal();
      window.SFShowSettings && window.SFShowSettings();
    });
  }

  // init gear + badge po načtení DOM
  document.addEventListener("DOMContentLoaded", () => {
    try { sfEnsureMenuLinks(); } catch {}
    try { sfInjectGearButton(); } catch {}
    try { sfInjectHelpButton(); } catch {}
    try { sfCreateSettingsModal(); } catch {}
    try { sfCreateHelpModal(); } catch {}
    try { window.SFEnsureAvatarBadge(); } catch {}
  });



/* === OFFLINE EVENT BONUS: Festival vodky (+20 energie / 20 min) === */
(function(){
  const KEY='SF__VODKA_TICK';
  function tick(){
    try{
      const ev = window.SF && window.SF.globalEvent;
      if(!ev || ev.id!=='vodka_fest') return;
      const b = ev.bonus || {};
      const everyMin = Number(b.energyRegenEveryMin||0);
      const amount = Number(b.energyRegenAmount||0);
      if(!everyMin || !amount) return;

      const now = Date.now();
      const last = Number(localStorage.getItem(KEY) || now);
      const interval = everyMin * 60*1000;
      const ticks = Math.floor((now - last)/interval);
      if(ticks<=0) return;

      const gain = ticks * amount;
      const s = (window.SF && (window.SF.getStats?window.SF.getStats():window.SF.stats)) || null;
      if(!s) { localStorage.setItem(KEY, String(last + ticks*interval)); return; }

      s.energy = Math.min(s.max_energy ?? 100, (s.energy ?? 0) + gain);
      localStorage.setItem(KEY, String(last + ticks*interval));

      // refresh HUD if available
      if (typeof window.syncStats === 'function') { try{ window.syncStats(); }catch(e){} }
      // attempt save
      if (window.supabaseClient && typeof window.supabaseClient.from === 'function' && s.user_id){
        window.supabaseClient.from('player_stats').upsert(s);
      }
    }catch(e){}
  }
  setInterval(tick, 5000);
  document.addEventListener('DOMContentLoaded', tick);
})();
