// menu.js — jednotné levé menu + globální sync (LOCAL + SUPABASE) + navigace
(() => {
  "use strict";

  // -------------------------
  // SUPABASE + USER
  // -------------------------
  const DEFAULT_SUPABASE_URL = "https://bmmaijlbpwgzhrxzxphf.supabase.co";
  const DEFAULT_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbWFpamxicHdnemhyeng6eHB"
    + "oZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzI0NDEzNzY3LCJleHAiOjIwODI0NDA5MDcwfQ.s0YQVnAjMXFu1pSI1NXZ2naSab179N0vQPglsmy3Pgw";

  const userId =
    localStorage.getItem("slavFantasyUserId") ||
    localStorage.getItem("user_id") ||
    "1";

  // Umožní přepsat zvenku (např. loginem), ale má to i defaulty
  const SUPABASE_URL =
    window.SUPABASE_URL ||
    localStorage.getItem("SUPABASE_URL") ||
    DEFAULT_SUPABASE_URL;

  const SUPABASE_ANON_KEY =
    window.SUPABASE_ANON_KEY ||
    localStorage.getItem("SUPABASE_ANON_KEY") ||
    DEFAULT_SUPABASE_ANON_KEY;

  function getSbClient() {
    if (window.supabaseClient) return window.supabaseClient;

    const lib = window.supabase;
    if (!lib || typeof lib.createClient !== "function") return null;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

    window.supabaseClient = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return window.supabaseClient;
  }

  const sb = getSbClient();

  // -------------------------
  // DOM (HUD)
  // -------------------------
  const moneyEl = document.getElementById("money");
  const cigEl = document.getElementById("cigarettes");
  const levelEl =
    document.getElementById("levelDisplay") ||
    document.querySelector(".level-number");

  const xpFillEl = document.getElementById("xpFill");
  const xpTextEl = document.getElementById("xpText");

  // -------------------------
  // HELPERS
  // -------------------------
  function fmtInt(n) {
    const x = Number(n ?? 0);
    return x.toLocaleString("cs-CZ");
  }

  function toast(msg) {
    try {
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
    } catch {}
  }

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  // -------------------------
  // NAV — sjednocené odkazy
  // -------------------------
  const LABEL_TO_HREF = {
    "postava": "postava.html",
    "arena": "arena.html",
    "shop": "shop.html",
    "magic shop": "crypta.html",
    "stable": "auto.html",
    "guild": "guild.html",
    "mail": "mail.html",
    "hall of fame": "zebricek.html",
    "slav clicker": "gopnik.html",
    "dr. abawuwu": null
  };

  function normalizeLabel(txt) {
    return String(txt || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function wireNavClicks() {
    // Pokud je v HTML <button> místo <a>, tak to přesměrujeme
    document.querySelectorAll(".sf-btn").forEach((el) => {
      if (el.tagName === "A") return;

      el.addEventListener("click", () => {
        const key = normalizeLabel(el.textContent);
        const href = LABEL_TO_HREF[key];
        if (!href) return; // disabled
        window.location.href = href;
      });
    });
  }

  function setActiveNav() {
    const file = (location.pathname.split("/").pop() || "").toLowerCase();
    document.querySelectorAll(".sf-btn").forEach((el) => {
      el.classList.remove("active");
      const href = (el.getAttribute("href") || "").toLowerCase();
      if (href && href === file) el.classList.add("active");
      if (!href) {
        // button bez href: porovnej label
        const key = normalizeLabel(el.textContent);
        if (LABEL_TO_HREF[key] && LABEL_TO_HREF[key].toLowerCase() === file) {
          el.classList.add("active");
        }

  // -------------------------
  // MENU RULES (např. skrýt ŽEBŘÍČEK když jsi v guildě)
  // -------------------------
  function applyMenuRules() {
    try {
      const guildRaw = localStorage.getItem('gopnik.guild.state.v1');
      const guildState = guildRaw ? JSON.parse(guildRaw) : null;
      const inGuild = !!(guildState && guildState.joinedGuild);

      // najdi tlačítko/odkaz na ŽEBŘÍČEK
      document.querySelectorAll('.sf-btn').forEach((el) => {
        const key = normalizeLabel(el.textContent);
        if (key === 'žebříček' || key === 'zebricek' || key === 'hall of fame') {
          el.style.display = inGuild ? 'none' : '';
        }
      });
    } catch {}
  }

      }
    });
  }

  // -------------------------
  // STATS (LOCAL CACHE)
  // -------------------------
  const LS_KEY = `sf_stats_${userId}`;

  // třída postavy (lokálně) — používá se na ikony a základní balanc
  const CLASS_LS_KEY = `sf_class_${userId}`;
  const CLASS_META = {
    padouch: { label: "Padouch", icon: "👻" },
    rvac:    { label: "Rváč",    icon: "✊" },
    mozek:   { label: "Mozek",   icon: "💡" }
  };

  function getPlayerClass() {
    const v = (localStorage.getItem(CLASS_LS_KEY) || localStorage.getItem("sf_class") || "padouch").toLowerCase();
    return CLASS_META[v] ? v : "padouch";
  }

  function setPlayerClass(cls) {
    const key = String(cls || "").toLowerCase();
    const normalized = CLASS_META[key] ? key : "padouch";
    localStorage.setItem(CLASS_LS_KEY, normalized);
    localStorage.setItem("sf_class", normalized);
    renderClassBadge(normalized);
    return normalized;
  }

  function renderClassBadge(clsKey = getPlayerClass()) {
    const meta = CLASS_META[clsKey] || CLASS_META.padouch;
    const box = document.querySelector(".avatar-box");
    if (!box) return;
    let badge = box.querySelector(".class-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "class-badge";
      box.appendChild(badge);
    }
    badge.textContent = meta.icon;
    badge.title = meta.label;
  }

  // "kanonická" struktura — další fields (inventář, equipped...) necháme projít
  const DEFAULT_STATS = {
    user_id: userId,
    level: 1,
    xp: 0,
    money: 0,
    cigarettes: 0,
    hp: 1000,
    max_hp: 1000
  };

  let state = {
    ...DEFAULT_STATS,
    ...(safeJsonParse(localStorage.getItem(LS_KEY), {}))
  };

  let dirty = false;
  let saveTimer = null;
  let schemaSupportsHp = true; // fallback pokud tabulka nemá sloupce
  let remoteCols = null;       // Set<string> sloupců, které skutečně existují v DB (podle select "*")

  function syncHud(st) {
    if (!st) return;

    if (moneyEl) moneyEl.textContent = fmtInt(st.money ?? 0);
    if (cigEl) cigEl.textContent = fmtInt(st.cigarettes ?? 0);
    if (levelEl) levelEl.textContent = String(Number(st.level ?? 1));

    // XP (pokud existuje)
    if (xpFillEl && xpTextEl) {
      const cur = Number(st.xp ?? 0);
      const lvl = Number(st.level ?? 1);
      const req = Math.max(100, lvl * 100);
      const pct = Math.max(0, Math.min(100, (cur / req) * 100));
      xpFillEl.style.width = `${pct}%`;
      xpTextEl.textContent = `${fmtInt(cur)} / ${fmtInt(req)}`;
    }
  }

  function persistLocal() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  // -------------------------
  // SUPABASE IO
  // -------------------------
  async function fetchMyStats() {
    if (!sb) return null;

    const { data, error } = await sb
      .from("player_stats")
      .select("*")
      .eq("user_id", userId)
      .limit(1);

    if (error) {
      console.error("menu.js player_stats select error:", error);
      return null;
    }
    const row = data?.[0] || null;
    if (row && typeof row === 'object') {
      try {
        remoteCols = new Set(Object.keys(row));
      } catch {}
    }
    return row;
  }

  async function ensureMyStats() {
    if (!sb) return null;

    const st = await fetchMyStats();
    if (st) return st;

    // vytvoř minimální záznam
    const payload = {
      user_id: userId,
      level: 1,
      xp: 0,
      money: 0,
      cigarettes: 0
    };

    const { error } = await sb.from("player_stats").insert(payload);
    if (error) {
      console.error("menu.js player_stats insert error:", error);
      return null;
    }
    return await fetchMyStats();
  }

  async function saveToSupabase(force = false) {
    if (!sb) return;
    if (!dirty && !force) return;

    // ----
    // PostgREST je přísný: pokud pošleš sloupec, který v tabulce není,
    // vrátí 400. Proto payload filtrujeme podle skutečných sloupců,
    // které jsme viděli v DB (remoteCols).
    // ----
    const basePayload = { ...state, user_id: userId };
    // když remoteCols ještě neznáme, držíme se minimálního jistého setu –
    // jinak PostgREST spadne na neexistujícím sloupci (hp/nickname apod.)
    const fallbackCols = ["user_id","level","xp","money","cigarettes","stats"];

    const allow = remoteCols ? Array.from(remoteCols) : fallbackCols;
    const payload = {};
    for (const k of allow) {
      if (k in basePayload) payload[k] = basePayload[k];
    }

    // pokud DB nemá hp sloupce, tak je nepoužívej
    if (!schemaSupportsHp) {
      delete payload.hp;
      delete payload.max_hp;
    }

    const { error } = await sb
      .from("player_stats")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      // fallback pro schema bez hp/max_hp (PostgREST hlášky jsou různé)
      const msg = String(error.message || "");
      const hpMissing = /\bhp\b/i.test(msg) && (/column/i.test(msg) || /find/i.test(msg) || /schema cache/i.test(msg) || /does not exist/i.test(msg));
      const maxHpMissing = /max_hp/i.test(msg) && (/column/i.test(msg) || /find/i.test(msg) || /schema cache/i.test(msg) || /does not exist/i.test(msg));

      if (schemaSupportsHp && (hpMissing || maxHpMissing)) {
        schemaSupportsHp = false;
        try {
          delete payload.hp;
          delete payload.max_hp;
          const { error: err2 } = await sb
            .from("player_stats")
            .upsert(payload, { onConflict: "user_id" });
          if (!err2) {
            dirty = false;
            return;
          }
        } catch {}
      }

      console.error("menu.js player_stats upsert error:", error);
      return;
    }

    dirty = false;
  }

  // -------------------------
  // GLOBAL API: window.SF
  // -------------------------
  function scheduleSave() {
    dirty = true;
    persistLocal();

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveToSupabase(false), 600);
  }

  function clamp(n, a, b) {
    const x = Number(n);
    if (Number.isNaN(x)) return a;
    return Math.max(a, Math.min(b, x));
  }

  function recomputeLevelFromXp() {
    const lvl = Number(state.level ?? 1);
    const xp = Number(state.xp ?? 0);
    const req = Math.max(100, lvl * 100);
    if (xp >= req) {
      const gained = Math.floor(xp / req);
      state.level = lvl + gained;
      state.xp = xp % req;
    }
  }

  function setStats(patch, opts = {}) {
    const { save = true, sync = true } = opts;

    state = { ...state, ...patch, user_id: userId };

    // sanity
    state.level = Math.max(1, Number(state.level || 1));
    state.money = Math.max(0, Number(state.money || 0));
    state.cigarettes = Math.max(0, Number(state.cigarettes || 0));
    state.xp = Math.max(0, Number(state.xp || 0));

    // hp
    state.max_hp = Math.max(1, Number(state.max_hp || 1000));
    state.hp = clamp(state.hp ?? state.max_hp, 0, state.max_hp);

    recomputeLevelFromXp();

    if (sync) syncHud(state);
    if (save) scheduleSave();
  }

  function getStats() {
    return { ...state };
  }

  function addMoney(delta) {
    setStats({ money: Number(state.money || 0) + Number(delta || 0) });
  }

  function addCigs(delta) {
    setStats({ cigarettes: Number(state.cigarettes || 0) + Number(delta || 0) });
  }

  function addXp(delta) {
    setStats({ xp: Number(state.xp || 0) + Number(delta || 0) });
  }

  function setHp(hp, maxHp) {
    const patch = {};
    if (typeof maxHp !== "undefined") patch.max_hp = Number(maxHp);
    if (typeof hp !== "undefined") patch.hp = Number(hp);
    setStats(patch);
  }

  async function loadRemote() {
    if (!sb) return;

    const st = await ensureMyStats();
    if (!st) return;

    // merge remote -> local (remote má prioritu)
    state = { ...state, ...st, user_id: userId };

    // doplň defaulty
    state.level = Math.max(1, Number(state.level || 1));
    state.xp = Math.max(0, Number(state.xp || 0));
    state.money = Math.max(0, Number(state.money || 0));
    state.cigarettes = Math.max(0, Number(state.cigarettes || 0));

    if (typeof state.hp === "undefined") state.hp = DEFAULT_STATS.hp;
    if (typeof state.max_hp === "undefined") state.max_hp = DEFAULT_STATS.max_hp;

    persistLocal();
    syncHud(state);
  }

  function wireRealtime() {
    if (!sb || typeof sb.channel !== "function") return;
    try {
      const ch = sb
        .channel(`sf_player_stats_${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "player_stats", filter: `user_id=eq.${userId}` },
          (payload) => {
            const newRow = payload?.new;
            if (!newRow) return;
            state = { ...state, ...newRow, user_id: userId };
            persistLocal();
            syncHud(state);
          }
        )
        .subscribe();
      window.__sfRealtimeChannel = ch;
    } catch (e) {
      console.warn("menu.js realtime subscribe failed:", e);
    }
  }

  window.SF = {
    userId,
    sb,
    supabaseClient: sb,
    getStats,
    setStats,
    addMoney,
    addXp,
    addCigs,
    setHp,
    getPlayerClass,
    setPlayerClass,
    saveNow: () => saveToSupabase(true),
    loadRemote
  };

  // -------------------------
  // BOOT
  // -------------------------
  async function boot() {
    wireNavClicks();
    setActiveNav();
    applyMenuRules();
    syncHud(state);

    // ikona třídy u avataru
    renderClassBadge();

    // remote load + realtime
    await loadRemote();
    wireRealtime();

    // periodic autosave (když se něco změnilo a user rychle přepne stránku)
    setInterval(() => saveToSupabase(false), 8000);

    window.addEventListener("pagehide", () => {
      // best effort
      try { saveToSupabase(true); } catch {}
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
