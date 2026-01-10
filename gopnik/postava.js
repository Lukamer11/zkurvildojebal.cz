// postava.js — čisté napojení na globální SF (menu.js)
// - žádný vlastní Supabase klient
// - žádné inline onclick
// - vše jde přes window.SF.stats + window.SF.updateStats

(() => {
  "use strict";

  // ---------- Tunables ----------
  const STAT_UPGRADE_GAIN_BASE = 0.08;
  const UPGRADE_COST_MULT = 1.35;
  const UPGRADE_COST_ADD = 15;

  // ---------- DOM helpers ----------
  const $ = (id) => document.getElementById(id);

  function fmtInt(n) {
    const x = Number(n ?? 0);
    return Number.isFinite(x) ? x.toLocaleString("cs-CZ") : "0";
  }

  function getRequiredXP(level) {
    return Math.floor(100 * Math.pow(1.5, Math.max(0, level - 1)));
  }

  function getCritChanceFromDexAndLevel(totalDex, level) {
    const base = Math.floor(totalDex * 0.5);
    const penalty = Math.floor((level - 1) * 0.35);
    return Math.max(1, base - penalty);
  }

  function calculateStatBonus(stat, value, level) {
    switch (stat) {
      case "strength":
        return `+${value * 2} DMG`;
      case "defense": {
        const defPercent = Math.min(Math.floor((value / 28) * 100), 100);
        return `${defPercent}% Redukce`;
      }
      case "dexterity": {
        const crit = getCritChanceFromDexAndLevel(value, level);
        return `+${crit}% Crit`;
      }
      case "intelligence":
        return `+${Math.floor(value * 1.5)}% Magie`;
      case "constitution": {
        const hp = 500 + value * 25;
        return `${hp} HP`;
      }
      case "luck": {
        const luckPercent = Math.min(value, 100);
        return `${luckPercent}% / 100%`;
      }
      default:
        return "";
    }
  }

  function getPlayerClass(statsObj) {
    const cls = (statsObj?.player_class || window.SF?.stats?.stats?.player_class || "padouch").toLowerCase();
    return cls;
  }

  function getUpgradeGain(stat, cls) {
    // GRIND režim: lineární přírůstky (žádné % z aktuální hodnoty).
    // Třídy:
    // - rvac = tank (CON/DEF výrazně lepší)
    // - padouch = vyvážený (lehce lepší LUCK/INT)
    // - mozek = "síla + burst, málo HP" (STR/DEX lepší, CON slabá)
    if (cls === "rvac") {
      if (stat === "constitution") return 0.12;
      if (stat === "defense") return 0.11;
      if (stat === "strength") return 0.09;
      if (stat === "dexterity") return 0.07;
      if (stat === "intelligence") return 0.06;
      if (stat === "luck") return 0.07;
      return STAT_UPGRADE_GAIN_BASE;
    }

    if (cls === "padouch") {
      if (stat === "luck") return 0.09;
      if (stat === "intelligence") return 0.09;
      return STAT_UPGRADE_GAIN_BASE;
    }

    if (cls === "mozek") {
      if (stat === "strength") return 0.12;
      if (stat === "dexterity") return 0.10;
      if (stat === "luck") return 0.08;
      if (stat === "intelligence") return 0.07;
      if (stat === "defense") return 0.06;
      if (stat === "constitution") return 0.05; // málo HP
      return STAT_UPGRADE_GAIN_BASE;
    }

    return STAT_UPGRADE_GAIN_BASE;
  }


function nextCost(currCost) {
    const c = Number(currCost ?? 100);
    return Math.max(1, Math.floor(c * UPGRADE_COST_MULT + UPGRADE_COST_ADD));
  }

  // ---------- Render ----------
  function renderFromStatsRow(row) {
    if (!row) return;

    const level = Number(row.level ?? 1);
    const xp = Number(row.xp ?? 0);
    const money = Number(row.money ?? 0);
    const cigarettes = Number(row.cigarettes ?? 0);

    // Základní UI (pokud na stránce existuje)
    if ($("level")) $("level").textContent = fmtInt(level);
    if ($("xp")) $("xp").textContent = fmtInt(xp);
    if ($("money")) $("money").textContent = fmtInt(money);
    if ($("cigarettes")) $("cigarettes").textContent = fmtInt(cigarettes);

    // XP bar (pokud existuje)
    const req = getRequiredXP(level);
    const pct = req > 0 ? Math.max(0, Math.min(100, (xp / req) * 100)) : 0;
    if ($("xpFill")) $("xpFill").style.width = pct + "%";
    if ($("xpText")) $("xpText").textContent = `${fmtInt(xp)} / ${fmtInt(req)}`;

    const stats = row.stats || {};
    const costs = row.upgrade_costs || {};

    const map = [
      "strength",
      "defense",
      "dexterity",
      "intelligence",
      "constitution",
      "luck",
    ];

    for (const st of map) {
      const v = Number(stats[st] ?? 10);
      const cost = Number(costs[st] ?? 100);

      const vEl = $(st + "Value");
      const eEl = $(st + "Extra");
      const cEl = $(st + "Cost");

      if (vEl) vEl.textContent = fmtInt(v);
      if (eEl) eEl.textContent = calculateStatBonus(st, v, level);
      if (cEl) cEl.textContent = fmtInt(cost) + "₽";
    }

    // --- Equipped (sync se shopem) ---
    try {
      const eq = row.equipped || {};
      const slots = document.querySelectorAll('.slot-shop[data-slot]');
      slots.forEach((slotEl) => {
        const slotName = slotEl.dataset.slot;
        const raw = eq[slotName];
        // Normalizace (pro staré savy, kde se omylem uložil objekt)
        const itemId = (raw && typeof raw === 'object') ? (raw.instance_id || raw.itemId || raw.id) : raw;

        if (itemId) {
          const item = (typeof window.getItemById === 'function') ? window.getItemById(itemId) : null;
          slotEl.classList.add('has-item');

          if (item) {
            const icon = item.icon || item.emoji || '📦';
            if (typeof icon === 'string' && icon.endsWith('.jpg')) {
              slotEl.innerHTML = `<img src="${icon}" alt="${item.name || 'item'}" class="slot-item">`;
            } else {
              slotEl.innerHTML = `<span class="slot-item">${icon}</span>`;
            }
          } else {
            slotEl.innerHTML = `<span class="slot-item">📦</span>`;
          }
        } else {
          slotEl.classList.remove('has-item');
          const fallback = (typeof window.getSlotEmoji === 'function') ? window.getSlotEmoji(slotName) : '⬜';
          slotEl.innerHTML = `<span class="slot-emoji">${fallback}</span>`;
        }
      });
    } catch (e) {
      console.warn('⚠️ render equipped failed:', e);
    }
  }

  // ---------- Upgrade handling ----------
  async function doUpgrade(stat) {
    await window.SFReady;
    const row = window.SF?.stats;
    if (!row) return;

    const money = Number(row.money ?? 0);
    const level = Number(row.level ?? 1);
    const stats = { ...(row.stats || {}) };
    const costs = { ...(row.upgrade_costs || {}) };

    const cls = getPlayerClass(stats);
    const gain = getUpgradeGain(stat, cls);

    const currentVal = Number(stats[stat] ?? 10);
    const currentCost = Number(costs[stat] ?? 100);

    if (money < currentCost) {
      // nic – později můžeš přidat toast
      return;
    }

    // zvýšení: používáme float gain, ale UI držíme jako int (aby to nebylo divný)
    const newVal = Math.max(1, Math.round((currentVal + gain) * 100) / 100);
    const newCost = nextCost(currentCost);

    stats[stat] = newVal;
    costs[stat] = newCost;

    // přepočet HP při constitution (volitelné)
    // (zůstává kompatibilní s tvými ostatními stránkami, které třeba hp neřeší)
    const patch = {
      money: money - currentCost,
      stats,
      upgrade_costs: costs,
      level,
    };

    window.SF.updateStats(patch);
  }

  function wireButtons() {
    document.querySelectorAll("[data-upgrade]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const stat = btn.getAttribute("data-upgrade");
        if (stat) doUpgrade(stat);
      });
    });
  }

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", async () => {
    wireButtons();
    await window.SFReady;
    renderFromStatsRow(window.SF?.stats);
  });

  document.addEventListener("sf:stats", (e) => {
    renderFromStatsRow(e.detail);
  });

})();
