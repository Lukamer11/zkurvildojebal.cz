// menu.js — jediný globální init (Supabase auth + player_stats + HUD + realtime)
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
    // - desetinné číslo se ponechá jako Number (oříznutí na int řešíme níže při chybě 22P02)
    for (const k of Object.keys(out)) {
      const v = out[k];
      if (typeof v === "string" && /^-?\d+(?:\.\d+)?$/.test(v.trim())) {
        const n = Number(v);
        if (!Number.isNaN(n)) out[k] = n;
      }
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

    // 2) Některé DB instance můžou mít sloupec pojmenovaný jinak (missiondata vs "missionData").
    // Zkusíme postupně obě varianty, a když DB některý sloupec nezná, spadneme na druhou.
    const attempts = [];

    // varianta A: missiondata (lowercase)
    if (payloadBase.missiondata !== undefined) {
      const a = { ...payloadBase };
      delete a.missionData;
      attempts.push(a);
    } else {
      attempts.push({ ...payloadBase });
    }

    // varianta B: "missionData" (camelCase) – jen pokud máme co uložit
    if (stats.missionData !== undefined || stats.missiondata !== undefined) {
      const b = { ...payloadBase, missionData: stats.missionData ?? stats.missiondata };
      delete b.missiondata;
      attempts.push(b);
    }

    // poslední záchrana: úplně bez misí (když DB nemá ani jeden sloupec)
    const c = { ...payloadBase };
    delete c.missiondata;
    delete c.missionData;
    attempts.push(c);

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
