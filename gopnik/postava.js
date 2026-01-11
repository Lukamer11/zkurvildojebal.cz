// postava.js — čisté napojení na globální SF (menu.js)

(() => {
  "use strict";

  // ===== CLASS METADATA =====
  const CLASS_META = {
    padouch: { icon: "👻", label: "Padouch" },
    rvac: { icon: "✊", label: "Rváč" },
    mozek: { icon: "💡", label: "Mozek" }
  };

  // ---------- Tunables ----------
  const STAT_UPGRADE_GAIN_BASE = 0.08;
  const UPGRADE_COST_MULT = 1.35;
  const UPGRADE_COST_ADD = 15;

  // ---------- DOM helpers ----------
  const $ = (id) => document.getElementById(id);

  // ---------- Items / equipment helpers ----------
  const EQUIP_SLOTS = ["weapon", "shield", "ring", "backpack", "helmet", "armor", "boots", "gloves"];

  function getAllItems() {
    const db = window.SHOP_ITEMS;
    if (!db) return [];
    return [
      ...(db.weapons || []),
      ...(db.armor || []),
      ...(db.special || []),
    ];
  }

  function getItemById(itemRef, row) {
    if (itemRef && typeof itemRef === "object") return itemRef;

    const ALIASES = {
      knife: "nuz",
      tactical_knife: "nuz",
      takticky_nuz: "nuz",
      "takticky-nuz": "nuz",
    };

    const rawId = String(itemRef || "");
    const id = ALIASES[rawId] || rawId;
    if (!id) return null;

    const inv = (row?.inventory || window.SF?.stats?.inventory || []);
    const foundInv = inv.find((x) => {
      if (!x) return false;
      if (typeof x === "object") return x.instance_id === id || x.id === id;
      return String(x) === id;
    });
    if (foundInv && typeof foundInv === "object") return foundInv;

    const eq = (row?.equipped || window.SF?.stats?.equipped || {});
    const eqObj = Object.values(eq).find((x) => x && typeof x === "object" && (x.instance_id === id || x.id === id));
    if (eqObj && typeof eqObj === "object") return eqObj;

    return getAllItems().find((it) => it.id === id) || null;
  }

  function getSlotEmoji(slotName) {
    const m = {
      weapon: "🗡️",
      shield: "🛡️",
      ring: "💍",
      backpack: "🎒",
      helmet: "🎩",
      armor: "👕",
      boots: "👢",
      gloves: "🧤",
    };
    return m[slotName] || "❓";
  }

  function renderItemIconHTML(icon, alt) {
    const safeAlt = String(alt || "item").replace(/"/g, "&quot;");
    const ic = icon == null ? "" : String(icon);

    const isImage =
      /^data:image\//i.test(ic) ||
      /^https?:\/\//i.test(ic) ||
      /\.(png|jpe?g|webp|gif|svg)$/i.test(ic);

    if (isImage) {
      return `<img src="${ic}" alt="${safeAlt}">`;
    }

    return ic ? ic : "❓";
  }

  function renderEquipment(row) {
    const equipped = (row?.equipped || window.SF?.stats?.equipped || {});

    EQUIP_SLOTS.forEach((slotName) => {
      const slotEl = document.querySelector(`.slot[data-slot="${slotName}"]`);
      if (!slotEl) return;

      const ref = equipped?.[slotName] ?? null;
      if (!ref) {
        slotEl.classList.remove("has-item");
        slotEl.innerHTML = `<span class="slot-emoji">${getSlotEmoji(slotName)}</span>`;
        return;
      }

      const item = getItemById(ref, row);
      if (!item) {
        slotEl.classList.remove("has-item");
        slotEl.innerHTML = `<span class="slot-emoji">${getSlotEmoji(slotName)}</span>`;
        return;
      }

      slotEl.classList.add("has-item");
      const iconHTML = renderItemIconHTML(item.icon, item.name);
      slotEl.innerHTML = `<span class="slot-item">${iconHTML}</span>`;
    });
  }

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
      if (stat === "constitution") return 0.05;
      return STAT_UPGRADE_GAIN_BASE;
    }

    return STAT_UPGRADE_GAIN_BASE;
  }

  function nextCost(currCost) {
    const c = Number(currCost ?? 100);
    return Math.max(1, Math.floor(c * UPGRADE_COST_MULT + UPGRADE_COST_ADD));
  }

  // ===== RENDER CLASS BADGE =====
  function renderClassBadge(cls) {
    const char = document.querySelector(".character");
    if (!char) return;

    let badge = char.querySelector(".class-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "class-badge";
      char.appendChild(badge);
    }

    const meta = CLASS_META[cls] || CLASS_META.padouch;
    badge.textContent = meta.icon;
    badge.title = meta.label;

    console.log('🎭 Class badge rendered:', meta.label, meta.icon);
  }

  // ===== SYNC CURRENCY UI =====
  function syncCurrencyUI() {
    console.log('💰 === SYNC CURRENCY UI ===');
    
    if (!window.SF) {
      console.warn('⚠️ SF not available');
      return;
    }
    
    const stats = window.SF.stats;
    if (!stats) {
      console.warn("⚠️ SF stats not available");
      return;
    }
    console.log('📊 Stats from SF:', stats);
    
    const moneyEl = $('money');
    const cigarettesEl = $('cigarettes');
    const energyEl = $('energy');
    
    if (moneyEl) {
      moneyEl.textContent = Number(stats.money || 0).toLocaleString('cs-CZ');
      console.log('  💵 Money:', stats.money);
    }
    
    if (cigarettesEl) {
      cigarettesEl.textContent = String(stats.cigarettes || 0);
      console.log('  🚬 Cigarettes:', stats.cigarettes);
    }
    
    if (energyEl) {
      energyEl.textContent = String(stats.energy || 0);
      console.log('  ⚡ Energy:', stats.energy);
    }
    
    // Update XP bar
    const xpFill = $('xpFill');
    const xpText = $('xpText');
    
    if (xpFill && xpText) {
      const xp = stats.xp || 0;
      const level = stats.level || 1;
      const requiredXP = getRequiredXP(level);
      const xpPercent = (xp / requiredXP) * 100;
      
      xpFill.style.width = `${xpPercent}%`;
      xpText.textContent = `${xp} / ${requiredXP}`;
      console.log('  📈 XP:', xp, '/', requiredXP);
    }
    
    // Update energy bar
    const energyFill = $('energyFill');
    const energyText = $('energyText');
    
    if (energyFill && energyText) {
      const energy = stats.energy || 0;
      const maxEnergy = stats.max_energy || 100;
      const energyPercent = (energy / maxEnergy) * 100;
      
      energyFill.style.width = `${energyPercent}%`;
      energyText.textContent = `${energy} / ${maxEnergy}`;
      console.log('  ⚡ Energy bar:', energy, '/', maxEnergy);
    }
    
    console.log('===========================');
  }

  // ---------- Render ----------
  function renderFromStatsRow(row) {
    if (!row) return;

    const level = Number(row.level ?? 1);
    const xp = Number(row.xp ?? 0);
    const money = Number(row.money ?? 0);
    const cigarettes = Number(row.cigarettes ?? 0);

    if ($("levelDisplay")) $("levelDisplay").textContent = fmtInt(level);
    if ($("levelChar")) $("levelChar").textContent = `Level ${fmtInt(level)}`;
    if ($("money")) $("money").textContent = fmtInt(money);
    if ($("cigarettes")) $("cigarettes").textContent = fmtInt(cigarettes);

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

    renderEquipment(row);
    
    // Render class badge
    const cls = getPlayerClass(stats);
    renderClassBadge(cls);
    
    // Sync currency UI
    syncCurrencyUI();
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
      showNotification('Nemáš dost peněz!', 'error');
      return;
    }

    const newVal = Math.max(1, Math.round((currentVal + gain) * 100) / 100);
    const newCost = nextCost(currentCost);

    stats[stat] = newVal;
    costs[stat] = newCost;

    const patch = {
      money: money - currentCost,
      stats,
      upgrade_costs: costs,
      level,
    };

    window.SF.updateStats(patch);
    
    showNotification(`+${gain.toFixed(2)} ${stat}!`, 'success');
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

console.log('✅ Postava system loaded!');
