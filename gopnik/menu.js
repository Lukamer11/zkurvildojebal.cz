// menu.js — jediný globální init (Supabase auth + player_stats + HUD + realtime)
// Použití: načti supabase-js v HTML, pak načti tento soubor na KAŽDÉ stránce.

(() => {
  "use strict";

  // -------------------------
  // KONFIG (můžeš přepsat přes window.* nebo localStorage)
  // -------------------------
  const DEFAULT_SUPABASE_URL = "https://jbfvoxlcociwtyobaotz.supabase.co";
  const DEFAULT_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZnZveGxjb2Npd3R5b2Jhb3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTQ3MTgsImV4cCI6MjA4MzM3MDcxOH0.ydY1I-rVv08Kg76wI6oPgAt9fhUMRZmsFxpc03BhmkA";

  const SUPABASE_URL =
    window.SUPABASE_URL ||
    localStorage.getItem("SUPABASE_URL") ||
    DEFAULT_SUPABASE_URL;

  const SUPABASE_ANON_KEY =
    window.SUPABASE_ANON_KEY ||
    localStorage.getItem("SUPABASE_ANON_KEY") ||
    DEFAULT_SUPABASE_ANON_KEY;

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
  }

  function fmtInt(n) {
    const x = Number(n ?? 0);
    return Number.isFinite(x) ? x.toLocaleString("cs-CZ") : "0";
  }

  // -------------------------
  // HUD (volitelné prvky napříč stránkami)
  // -------------------------
  function updateHud(stats) {
    if (!stats) return;

    const moneyEl = document.getElementById("money");
    const cigEl = document.getElementById("cigarettes");
    const levelEl = document.getElementById("levelDisplay") || document.querySelector(".level-number");
    const xpFillEl = document.getElementById("xpFill");
    const xpTextEl = document.getElementById("xpText");

    if (moneyEl) moneyEl.textContent = fmtInt(stats.money);
    if (cigEl) cigEl.textContent = fmtInt(stats.cigarettes);
    if (levelEl) levelEl.textContent = fmtInt(stats.level);

    // XP bar (pokud existuje)
    const level = Number(stats.level ?? 1);
    const xp = Number(stats.xp ?? 0);
    const req = Math.floor(100 * Math.pow(1.5, Math.max(0, level - 1)));
    const pct = req > 0 ? Math.max(0, Math.min(100, (xp / req) * 100)) : 0;
    if (xpFillEl) xpFillEl.style.width = pct + "%";
    if (xpTextEl) xpTextEl.textContent = `${fmtInt(xp)} / ${fmtInt(req)}`;
  }

  document.addEventListener("sf:stats", (e) => updateHud(e.detail));

  // -------------------------
  // SUPABASE CLIENT
  // -------------------------
  function getSbClient() {
    if (window.SF?.sb) return window.SF.sb;
    const lib = window.supabase;
    if (!lib || typeof lib.createClient !== "function") return null;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

    return lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    });
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
  async function upsertNow() {
    const sb = window.SF.sb;
    const stats = window.SF.stats;
    if (!sb || !stats?.user_id) return;
    const { error } = await sb.from("player_stats").upsert(stats, { onConflict: "user_id" });
    if (error) console.warn("SF upsert error:", error);
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
        dexterity: 10,
        intelligence: 10,
        constitution: 10,
        luck: 10,
        player_class: (localStorage.getItem("sf_class") || "padouch").toLowerCase(),
      },
      upgrade_costs: {
        strength: 100,
        defense: 100,
        dexterity: 100,
        intelligence: 100,
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
            window.SF.stats = payload.new;
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
    (function initRotateOverlay(){
      const mount = () => {
        let el = document.getElementById("sfRotateOverlay");
        if (!el) {
          el = document.createElement("div");
          el.id = "sfRotateOverlay";
          el.textContent = "Otoč telefon na výšku 📱";
          document.body.appendChild(el);
        }

        // Jen pro skutečná mobilní zařízení (coarse pointer / žádný hover),
        // aby se hláška nezobrazovala na PC při zúženém okně.
       const isMobileUA =
  (navigator.userAgentData && navigator.userAgentData.mobile) ||
  /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobi/i.test(navigator.userAgent);

const mq = window.matchMedia("(max-width: 900px) and (orientation: landscape)");
const apply = () => {
  // Overlay jen na mobilech + jen když je landscape a úzký viewport
  el.style.display = (isMobileUA && mq.matches) ? "flex" : "none";
};

      if (document.body) mount();
      else document.addEventListener("DOMContentLoaded", mount, { once: true });
    })();


    const sess = await sb.auth.getSession();
    const user = sess.data?.session?.user || null;

    if (!user) {
      if (!isLoginPage()) location.href = LOGIN_PAGE;
      return null;
    }

    window.SF.user = user;

    const row = await loadOrCreateStats(user.id);
    // zajisti user_id vždy
    window.SF.stats = { ...(row || {}), user_id: user.id };
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
