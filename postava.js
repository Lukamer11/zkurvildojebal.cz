// postava.js — čisté napojení na globální SF (menu.js) + tooltip system

(() => {
  "use strict";

  // ===== CLASS METADATA =====
  const CLASS_META = {
    padouch: { icon: "👻", label: "Padouch" },
    rvac: { icon: "✊", label: "Rváč" },
    mozek: { icon: "💡", label: "Mozek" }
  };

  // ---------- Tunables ----------
  // (historický tunable – aktuálně se používá getUpgradeGain() = 1)
  const STAT_UPGRADE_GAIN_BASE = 1;
  const UPGRADE_COST_MULT = 1.35;
  const UPGRADE_COST_ADD = 15;
  // Sleva na upgrady v Postavě (uživatelský balancing)
  const UPGRADE_COST_DISCOUNT = 0.80; // -20%
  const SELL_MULTIPLIER = 0.35; // 35% z ceny (stejně jako v shop)
  // Rarity multipliers (stejné jako v shopu)
  const SELL_MULT_BY_RARITY = { common:0.35, uncommon:0.38, rare:0.40, epic:0.45, legendary:0.50 };
  function getSellMultiplier(r){ return SELL_MULT_BY_RARITY[(r||'common')] ?? SELL_MULTIPLIER; }

  // ---------- DOM helpers ----------
  const $ = (id) => document.getElementById(id);

  // ---------- Items / equipment helpers ----------
  const EQUIP_SLOTS = ["weapon", "shield", "ring", "backpack", "trinket1", "trinket2", "trinket3", "trinket4", "helmet", "armor", "boots", "gloves"];
  // S&F styl: 6 core statů
  const ALLOWED_STATS = ['strength','defense','constitution','luck'];
  const INVENTORY_SIZE = 8;

  // ===== DRAG & DROP STATE (inventář <-> equip, stejně jako v shopu) =====
  let draggedItem = null; // { itemId, invIndex } nebo { fromSlot, itemRef }
  let dragSource = null;  // 'inventory' | 'equipped'

  function normalizeInventory(arr){
    const a = Array.isArray(arr) ? [...arr] : [];
    if (a.length > INVENTORY_SIZE) a.length = INVENTORY_SIZE;
    while (a.length < INVENTORY_SIZE) a.push(null);
    return a;
  }

  function handleDragEnd(e){
    try { (e.currentTarget || e.target).classList.remove('dragging'); } catch {}
    try { document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over')); } catch {}
  }

  function handleDragOver(e){
    e.preventDefault();
    try { e.currentTarget.classList.add('drag-over'); } catch {}
  }

  function handleDragLeave(e){
    try { e.currentTarget.classList.remove('drag-over'); } catch {}
  }

  function handleInvDragStart(e){
    const t = e.currentTarget || e.target;
    draggedItem = {
      itemId: t.dataset.itemId,
      invIndex: parseInt(t.dataset.invIndex, 10)
    };
    dragSource = 'inventory';
    try { t.classList.add('dragging'); } catch {}
    try {
      e.dataTransfer?.setData('text/plain', JSON.stringify({ type:'inv', index: draggedItem.invIndex }));
      e.dataTransfer.effectAllowed = 'move';
    } catch {}
    hideTooltip();
  }

  function handleEquippedDragStart(e){
    const t = e.currentTarget || e.target;
    const fromSlot = t.dataset.fromSlot;
    if (!fromSlot) return;
    draggedItem = { fromSlot, itemRef: window.SF?.stats?.equipped?.[fromSlot] };
    dragSource = 'equipped';
    try { t.classList.add('dragging'); } catch {}
    try {
      e.dataTransfer?.setData('text/plain', JSON.stringify({ type:'equipped', slot: fromSlot }));
      e.dataTransfer.effectAllowed = 'move';
    } catch {}
    hideTooltip();
  }

  async function handleEquipDrop(e){
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!draggedItem) return;

    await window.SFReady;
    const row = window.SF?.stats || {};
    const targetSlot = e.currentTarget.dataset.slot;
    if (!targetSlot) return;

    const inv = normalizeInventory(row.inventory || []);
    const equipped = { ...(row.equipped || {}) };

    // Zjisti item
    let itemRef = null;
    if (dragSource === 'inventory') {
      const from = Number(draggedItem.invIndex);
      if (!Number.isFinite(from)) return;
      itemRef = inv[from];
    } else if (dragSource === 'equipped') {
      itemRef = draggedItem.itemRef;
    }
    const item = itemRef ? getItemById(itemRef, row) : null;
    if (!item) return;

    const req = Number(item.req_level || 1);
    const lvl = Number(row.level || 1);
    if (lvl < req) {
      showNotification(`Potřebuješ minimálně level ${req}!`, 'error');
      return;
    }

    if (item.slot && item.slot !== targetSlot) {
      showNotification(`${item.name} nelze nasadit do slotu ${targetSlot}!`, 'error');
      return;
    }

    if (dragSource === 'inventory') {
      const from = Number(draggedItem.invIndex);
      const curEquipped = equipped[targetSlot] || null;
      // Swap: co bylo v equipu jde zpět do stejného slotu inventáře
      inv[from] = curEquipped;
      equipped[targetSlot] = itemRef;
      showNotification(`${item.name} nasazen!`, 'success');
      setSelectedInvIndex(null);
    } else if (dragSource === 'equipped') {
      const fromSlot = draggedItem.fromSlot;
      const temp = equipped[targetSlot] || null;
      equipped[targetSlot] = draggedItem.itemRef;
      equipped[fromSlot] = temp;
      showNotification('Položky přesunuty!', 'success');
    }

    window.SF.updateStats({ inventory: inv, equipped });
    renderFromStatsRow({ ...row, inventory: inv, equipped });
    draggedItem = null;
    dragSource = null;
  }

  async function handleInventoryDrop(e){
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!draggedItem) return;

    await window.SFReady;
    const row = window.SF?.stats || {};
    const inv = normalizeInventory(row.inventory || []);
    const equipped = { ...(row.equipped || {}) };

    const targetIndex = parseInt(e.currentTarget.dataset.invIndex, 10);
    if (!Number.isFinite(targetIndex)) return;

    const isTargetFilled = !!inv[targetIndex];

    if (dragSource === 'inventory') {
      const from = Number(draggedItem.invIndex);
      if (!Number.isFinite(from) || from === targetIndex) {
        draggedItem = null; dragSource = null;
        return;
      }
      const itemRef = inv[from];
      if (!itemRef) { draggedItem = null; dragSource = null; return; }
      const tmp = inv[targetIndex] || null;
      inv[targetIndex] = itemRef;
      inv[from] = tmp;
      showNotification('📦 Položka přesunuta', 'success');
      // zachovej selekci na nové pozici
      if (selectedInvIndex === from) setSelectedInvIndex(targetIndex);
      else if (selectedInvIndex === targetIndex) setSelectedInvIndex(from);
    }
    else if (dragSource === 'equipped') {
      const fromSlot = draggedItem.fromSlot;
      const itemRef = draggedItem.itemRef;
      if (!fromSlot || !itemRef) { draggedItem = null; dragSource = null; return; }

      // Pokud cíl obsazený, potřebujeme extra prázdný slot pro displaced
      const emptyIndex = inv.findIndex(x => !x);
      if (isTargetFilled && emptyIndex === -1) {
        showNotification('Inventář je plný!', 'error');
        draggedItem = null; dragSource = null;
        return;
      }

      equipped[fromSlot] = null;
      if (isTargetFilled) {
        const displaced = inv[targetIndex];
        inv[targetIndex] = itemRef;
        inv[emptyIndex] = displaced;
      } else {
        inv[targetIndex] = itemRef;
      }

      const it = getItemById(itemRef, row);
      showNotification(`${it?.name || 'Item'} přesunut do inventáře`, 'success');
      setSelectedInvIndex(null);
    }

    window.SF.updateStats({ inventory: inv, equipped });
    renderFromStatsRow({ ...row, inventory: inv, equipped });
    draggedItem = null;
    dragSource = null;
  }

  // vybraný slot inventáře (pro koš)
  let selectedInvIndex = null;

  function setSelectedInvIndex(idx){
    selectedInvIndex = (Number.isFinite(idx) ? idx : null);
    // vizuál
    try{
      document.querySelectorAll('#inventoryGrid .inv-slot').forEach(el=>el.classList.remove('selected'));
      if (selectedInvIndex !== null){
        const el = document.querySelector(`#inventoryGrid .inv-slot[data-inv-index="${selectedInvIndex}"]`);
        if (el) el.classList.add('selected');
      }
    }catch{}
    updateSellZoneUI(window.SF?.stats);
  }

  function updateSellZoneUI(row){
    try{
      const sellZone = document.getElementById('sellZone');
      const priceEl = document.getElementById('sellZonePrice') || sellZone?.querySelector('.sell-price');
      if (!sellZone || !priceEl) return;

      const r = row || window.SF?.stats || {};
      const inv = Array.isArray(r.inventory) ? r.inventory : [];
      const itemRef = (selectedInvIndex !== null) ? inv[selectedInvIndex] : null;
      const item = itemRef ? getItemById(itemRef, r) : null;

      if (!item){
        priceEl.textContent = '35% z hodnoty';
        sellZone.classList.remove('has-selection');
        return;
      }

      const mult = getSellMultiplier(item.rarity || 'common');
      const sellValue = Math.max(0, Math.floor((Number(item.price) || 0) * mult));
      priceEl.textContent = `Prodej: ${sellValue}🪙`;
      sellZone.classList.add('has-selection');
    }catch{}
  }

  async function sellInvIndex(invIndex){
    await window.SFReady;
    const row = window.SF?.stats || {};
    const inv = Array.isArray(row.inventory) ? [...row.inventory] : [];
    const ref = inv[invIndex];
    if (!ref) return;

    const item = getItemById(ref, row);
    if (!item) return;

    const mult = getSellMultiplier(item.rarity || 'common');
    const sellValue = Math.max(0, Math.floor((Number(item.price) || 0) * mult));
    if (sellValue <= 0) return;

    const ok = confirm(`Prodat "${item.name}" za ${sellValue}🪙?`);
    if (!ok) return;

    inv[invIndex] = null;
    const newMoney = (Number(row.money) || 0) + sellValue;

    setSelectedInvIndex(null);
    window.SF.updateStats({ inventory: inv, money: newMoney });
    renderInventory({ ...row, inventory: inv, money: newMoney });
    updateSellZoneUI({ ...row, inventory: inv, money: newMoney });
  }



  // ===== TOOLTIP SYSTEM (stejně jako v shop) =====
  let tooltip = null;
let sfTooltipTimer = null;
let sfLastMouse = {x:0,y:0};
function sfGetTooltipDelayMs(){
  try { return parseInt(localStorage.getItem('sf_tooltip_delay')||'200',10)||0; } catch { return 200; }
}


  function createTooltip() {
    tooltip = document.createElement('div');
    tooltip.className = 'item-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: linear-gradient(135deg, rgba(40,30,20,0.98), rgba(25,18,12,0.99));
    border: 2px solid #c9a44a;
    border-radius: 10px;
    padding: calc(9px * var(--sf-tooltip-scale, 0.85));
    font-size: calc(14px * var(--sf-tooltip-scale, 0.85));
      pointer-events: none;
      z-index: 10000;
      display: none;
    min-width: 190px;
    max-width: 260px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.8);
    `;
    document.body.appendChild(tooltip);
  }

  function showTooltip(item, x, y) {
    if (!tooltip) createTooltip();
    
    let bonusesHTML = '';
    if (item.bonuses) {
      bonusesHTML = '<div style="margin-top: 10px; padding-top: 10px; border-top: 2px solid rgba(201,164,74,0.3);">';
      Object.keys(item.bonuses).forEach(stat => {
        const value = item.bonuses[stat];
        const color = value > 0 ? '#4af' : '#f44';
        const sign = value > 0 ? '+' : '';
        const statNames = {
          strength: '⚔️ Síla',
          defense: '🛡️ Obrana',

          constitution: '💪 Výdrž',
          luck: '🍀 Štěstí'
        };
        bonusesHTML += `<div style="color: ${color}; font-weight: 900; font-size: 13px; margin: 3px 0;">${statNames[stat]}: ${sign}${value}</div>`;
      });
      bonusesHTML += '</div>';
    }
    
    const sellPrice = Math.floor((item.price || 0) * SELL_MULTIPLIER);
    
    const rarityLabel = ({common:'⚪ Common',uncommon:'🟢 Uncommon',rare:'🔵 Rare',epic:'🟣 Epic',legendary:'🟠 Legendary'}[item.rarity]||'⚪ Common');
    tooltip.innerHTML = `
      <div class="tt-head">
        <div class="tt-title">${item.icon}<span class="tt-name">${item.name}</span></div>
        <div class="tt-sub">
          <span class="tt-pill tt-rarity tt-rarity--${item.rarity || 'common'}">${rarityLabel}</span>
        </div>
      </div>
      ${item.description ? `<div class="tt-desc">${item.description}</div>` : ''}
      <div class="tt-price-row">
        <div class="tt-price">💰 ${item.price}🪙</div>
        <div class="tt-sell">Prodej: ${sellPrice}🪙 (35%)</div>
      </div>
      ${bonusesHTML ? `<div class="tt-section">${bonusesHTML}</div>` : ''}
    `;
    
    tooltip.style.display = 'block';
    tooltip.style.left = (x + 20) + 'px';
    tooltip.style.top = (y - tooltip.offsetHeight / 2) + 'px';
  }

  function hideTooltip() {
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

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
      trinket1: "📿",
      trinket2: "🧿",
      trinket3: "🔮",
      trinket4: "🪬",
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

  // ===== CALCULATE TOTAL BONUSES (stejně jako v shop) =====
  function calculateTotalBonuses(row) {
    const bonuses = {
      strength: 0,
      defense: 0,

      constitution: 0,
      luck: 0
    };
    
    const equipped = (row?.equipped || window.SF?.stats?.equipped || {});
    
    Object.values(equipped).forEach(itemRef => {
      if (!itemRef) return;
      const item = getItemById(itemRef, row);
      if (!item || !item.bonuses) return;
      
      Object.keys(item.bonuses).forEach(stat => {
        if (bonuses[stat] !== undefined) {
          bonuses[stat] += item.bonuses[stat];
        }
      });
    });
    
    return bonuses;
  }

  function renderEquipment(row) {
    const equipped = (row?.equipped || window.SF?.stats?.equipped || {});

    EQUIP_SLOTS.forEach((slotName) => {
      const slotEl = document.querySelector(`.slot[data-slot="${slotName}"]`);
      if (!slotEl) return;

      const ref = equipped?.[slotName] ?? null;
      if (!ref) {
        // Prázdný slot: jen rámeček, bez placeholder ikon
        slotEl.classList.remove("has-item");
        slotEl.classList.add("is-empty");
        ['common','uncommon','rare','epic','legendary'].forEach(r => slotEl.classList.remove(`rarity-${r}`));
        delete slotEl.dataset.rarity;
        delete slotEl.dataset.rarityLabel;
        slotEl.innerHTML = "";
        return;
      }

      const item = getItemById(ref, row);
      if (!item) {
        // Pokud reference neexistuje v items DB, chovej se jako prázdný slot
        slotEl.classList.remove("has-item");
        slotEl.classList.add("is-empty");
        ['common','uncommon','rare','epic','legendary'].forEach(r => slotEl.classList.remove(`rarity-${r}`));
        delete slotEl.dataset.rarity;
        delete slotEl.dataset.rarityLabel;
        slotEl.innerHTML = "";
        return;
      }

      slotEl.classList.remove("is-empty");
      slotEl.classList.add("has-item");

      // Rarity barvy + glow
      ['common','uncommon','rare','epic','legendary'].forEach(r => slotEl.classList.remove(`rarity-${r}`));
      const r = (item.rarity || (window.SF && window.SF.getAutoRarity ? window.SF.getAutoRarity(item) : 'common') || 'common');
      const rLabel = ({ common:'COMMON', uncommon:'UNCOMMON', rare:'RARE', epic:'EPIC', legendary:'LEGEND' }[r] || 'COMMON');
      slotEl.classList.add(`rarity-${r}`);
      slotEl.dataset.rarity = r;
      slotEl.dataset.rarityLabel = rLabel;

      const iconHTML = renderItemIconHTML(item.icon, item.name);
      // Draggable item (equip -> inventář / přesun mezi sloty)
      slotEl.innerHTML = `<span class="slot-item" draggable="true" data-from-slot="${slotName}">${iconHTML}</span>`;
      
      // Tooltip
      slotEl.addEventListener('mouseenter', (e) => {
        sfLastMouse={x:e.clientX,y:e.clientY};
      clearTimeout(sfTooltipTimer);
      sfTooltipTimer=setTimeout(()=>showTooltip(item, sfLastMouse.x, sfLastMouse.y), sfGetTooltipDelayMs());
      });
      
      slotEl.addEventListener('mousemove', (e) => {
        if (tooltip && tooltip.style.display === 'block') {
          tooltip.style.left = (e.clientX + 20) + 'px';
          tooltip.style.top = (e.clientY - tooltip.offsetHeight / 2) + 'px';
        }
      });
      
      slotEl.addEventListener('mouseleave', () => {
        clearTimeout(sfTooltipTimer);
  hideTooltip();
      });

      // Drag events
      const itemEl = slotEl.querySelector('.slot-item');
      if (itemEl) {
        itemEl.addEventListener('dragstart', handleEquippedDragStart);
        itemEl.addEventListener('dragend', handleDragEnd);
      }
    });
  }

  // ===== INVENTÁŘ (stejně jako v shopu, bez DnD – jen zobrazení + tooltip) =====
  function renderInventory(row){
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    const inv = (row?.inventory || window.SF?.stats?.inventory || []);
    grid.innerHTML = '';

    for (let i = 0; i < INVENTORY_SIZE; i++){
      const itemRef = inv[i];
      const item = itemRef ? getItemById(itemRef, row) : null;

      const slot = document.createElement('div');
      slot.className = 'inv-slot' + (item ? ' filled' : ' empty');
      slot.dataset.invIndex = String(i);

      // Drop target (přesuny v inventáři + equip -> inventář)
      slot.addEventListener('dragover', handleDragOver);
      slot.addEventListener('dragleave', handleDragLeave);
      slot.addEventListener('drop', handleInventoryDrop);
      slot.addEventListener('click', () => {
        if (item) setSelectedInvIndex(i);
        else setSelectedInvIndex(null);
      });


      if (item){
        // drag & drop (inventář <-> equip + sell zone)
        slot.draggable = true;
        const itemId = (item.instance_id || item.id);
        slot.dataset.itemId = itemId;
        slot.addEventListener('dragstart', handleInvDragStart);
        slot.addEventListener('dragend', handleDragEnd);

        const r = (item.rarity || 'common');
        const rLabel = ({ common:'COMMON', uncommon:'UNCOMMON', rare:'RARE', epic:'EPIC', legendary:'LEGEND' }[r] || 'COMMON');
        slot.classList.add(`rarity-${r}`);
        slot.dataset.rarity = r;
        slot.dataset.rarityLabel = rLabel;

        const iconHTML = renderItemIconHTML(item.icon, item.name);
        if (iconHTML.startsWith('<img')) slot.innerHTML = iconHTML;
        else slot.textContent = iconHTML;

        slot.addEventListener('mouseenter', (e) => {
          sfLastMouse={x:e.clientX,y:e.clientY};
          clearTimeout(sfTooltipTimer);
          sfTooltipTimer=setTimeout(()=>showTooltip(item, sfLastMouse.x, sfLastMouse.y), sfGetTooltipDelayMs());
        });
        slot.addEventListener('mousemove', (e) => {
          if (tooltip && tooltip.style.display === 'block') {
            tooltip.style.left = (e.clientX + 20) + 'px';
            tooltip.style.top = (e.clientY - tooltip.offsetHeight / 2) + 'px';
          }
        });
        slot.addEventListener('mouseleave', () => {
          clearTimeout(sfTooltipTimer);
          hideTooltip();
        });
      }

      grid.appendChild(slot);
    }

    const invCount = document.getElementById('invCount');
    if (invCount) invCount.textContent = String(inv.filter(Boolean).length);
  }

  function fmtInt(n) {
    const x = Number(n ?? 0);
    return Number.isFinite(x) ? x.toLocaleString("cs-CZ") : "0";
  }

  function formatStatValue(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0';
    const rounded = Math.round(n * 100) / 100;
    const s = String(rounded);
    return s.includes('.') ? rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1') : s;
  }

  function getRequiredXP(level) {
    const lvl = Math.max(1, Number(level) || 1);
    return Math.floor(50 * Math.pow(lvl, 1.7));
  }

  function calculateStatBonus(stat, value, level, cls) {
    const v = Number(value);
    const val = Number.isFinite(v) ? v : 0;
    
    switch (stat) {
      case "strength":
        return `+${Math.round(val * 2)} DMG`;
      case "defense": {
        const red = (window.SF && window.SF.getDefenseReductionPercent)
          ? window.SF.getDefenseReductionPercent(val, level, cls)
          : Math.min(75, Math.floor((val / (140 + Math.max(1, level) * 18)) * 100));
        return `${red}% Redukce`;
      }
      case "constitution": {
        const lvl = Math.max(1, Number(level) || 1);
        // MUSÍ sedět s arénou (arena.js): 200 + lvl*35 + CON*10
        const hp = Math.round(200 + lvl * 35 + val * 10);
        return `${hp} HP`;
      }
      case "luck":
        // UI: Luck zůstává atribut, ale vpravo ukazujeme Crit % (uživatelský požadavek)
        return `${Math.max(0, Math.min(50, Math.round(val)))}% Crit`;
      default:
        return "";
    }
  }

  function getPlayerClass(statsObj) {
    const cls = (statsObj?.player_class || window.SF?.stats?.stats?.player_class || "padouch").toLowerCase();
    return cls;
  }

  function getUpgradeGain(stat, cls) {
    // Nové pravidlo: jeden klik na upgrade = +1 do statů.
    // (Už žádné desetinné přírůstky ani "velké skoky".)
    return 1;
  }

  // S&F-like cena: roste s hodnotou statu (a mírně s levelem)
  function calcUpgradeCost(statValue, level) {
    const v = Math.max(1, Number(statValue) || 1);
    const lvl = Math.max(1, Number(level) || 1);
    // 11 -> ~130, 50 -> ~1k+, 150 -> ~5k+
    const core = Math.pow(v + 1, 1.55) * 3;
    const lvlTax = (lvl - 1) * 10;
    return Math.max(1, Math.floor(core + lvlTax + 20));
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
    const cls = getPlayerClass(stats);

    // Vypočítat bonusy z equipmentu (stejně jako v shop)

    const bonuses = calculateTotalBonuses(row);

	  // PET bonusy (v %) – uložené v player_stats.stats.pet_bonuses / stats.pets
	  const petPct = (window.SF && typeof window.SF.getPetBonusesPercent === 'function')
	    ? window.SF.getPetBonusesPercent(row)
	    : { strength:0, defense:0, constitution:0, luck:0 };

    // GUILD bonusy (v %) – jednoduchá vrstva z menu.js (localStorage)
    const guildPct = (window.SF && typeof window.SF.getGuildBonusesPercent === 'function')
      ? window.SF.getGuildBonusesPercent()
      : { strength:0, defense:0, constitution:0, luck:0 };

    const fmtPct = (n) => {
      const x = Number(n) || 0;
      // chceme styl jako na obrázku: 4.2% apod.
      return (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, '');
    };

	    ALLOWED_STATS.forEach(stat => {
	      const baseValue = Number(stats[stat] ?? 10);
	      const itemBonus = Number(bonuses[stat] || 0);
	      const rawTotal = baseValue + itemBonus; // itemy přidávají přímo do čísel (S&F styl)
	      const p = Number(petPct?.[stat] || 0);
	      const g = Number(guildPct?.[stat] || 0);
	      const totalValue = Math.round(rawTotal * (1 + p / 100) * (1 + g / 100));
      // Pokud staré upgrade_costs chybí, dopočítáme deterministicky z hodnoty statu.
      const cost = Number(costs[stat] ?? calcUpgradeCost(baseValue, level));

      const vEl = $(stat + "Value");
      const eEl = $(stat + "Extra");
	      const bEl = $(stat + "Bonus");
      const cEl = $(stat + "Cost");

	      // Zobrazit jen čistou hodnotu (bez bílých "(+)" rozpadů).
	      if (vEl) vEl.textContent = formatStatValue(totalValue);
      
	      // Extra bonus: jen hlavní bonus (modře) + pod tím % bonusy (žlutě)
	      if (eEl) eEl.textContent = calculateStatBonus(stat, totalValue, level, cls);
	      if (bEl) bEl.textContent = `🐾 +${fmtPct(p)}%  👥 +${fmtPct(g)}%`;

      // Cena upgradu se zobrazuje a platí se se slevou -20%
      const discounted = Math.max(1, Math.ceil(cost * UPGRADE_COST_DISCOUNT));
      if (cEl) cEl.textContent = fmtInt(discounted) + "🪙";
    });

    renderEquipment(row);

    // Inventář zobrazený v postavě (sync se shopem)
    renderInventory(row);
    
    // Render class badge
    renderClassBadge(cls);
    
    // Sync currency UI
    syncCurrencyUI();
  }

  // ---------- Upgrade handling ----------
  async function doUpgrade(stat) {
    await window.SFReady;
    if (!ALLOWED_STATS.includes(stat)) return;
    const row = window.SF?.stats;
    if (!row) return;

    const money = Number(row.money ?? 0);
    const level = Number(row.level ?? 1);
    const stats = { ...(row.stats || {}) };
    const costs = { ...(row.upgrade_costs || {}) };

    const cls = getPlayerClass(stats);
    const gain = getUpgradeGain(stat, cls);

    const currentVal = Number(stats[stat] ?? 10);
    const currentCost = Number(costs[stat] ?? calcUpgradeCost(currentVal, level));
    const discountedCost = Math.max(1, Math.ceil(currentCost * UPGRADE_COST_DISCOUNT));

    if (money < discountedCost) {
      showNotification('Nemáš dost peněz!', 'error');
      return;
    }

    // Jeden klik = +1 stat
    const newVal = Math.max(1, Math.round((currentVal + gain) * 100) / 100);
    const newCost = calcUpgradeCost(newVal, level);

    stats[stat] = newVal;
    costs[stat] = newCost;

    const patch = {
      money: money - discountedCost,
      stats,
      upgrade_costs: costs,
      level,
    };

    window.SF.updateStats(patch);
    
    showNotification(`+${fmtInt(gain)} ${stat}!`, 'success');
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

  // ===== WHATS NEW MODAL (jen po loginu / autologinu) =====
  const WHATSNEW_VERSION = '0.1';
  const WHATSNEW_SESSION_KEY = 'sf_whatsnew_session_shown_' + WHATSNEW_VERSION;

  function injectWhatsNewStyles() {
    if (document.getElementById('whatsNewStyles')) return;
    const s = document.createElement('style');
    s.id = 'whatsNewStyles';
    s.textContent = `
      /* Backdrop: pouzijeme 100vw/100vh (ne inset), aby to drzelo i kdyz nekde nahore bezi transform */
      /* Pozn.: někde je škálování přes transform na wrapperu => fixed může dědit "podivný" viewport.
         Proto držíme striktně inset:0 + vypneme transform, aby to sedělo uprostřed obrazovky. */
      /* POZOR: menu.css už používá třídy .sf-modal/.sf-modal__*, takže pro "Co je nového" používáme vlastní prefix.
         Jinak se pravidla přepíšou a modal ujede doleva/roztáhne se přes celou plochu. */
      .sf-wn-backdrop{position:fixed;inset:0;left:0;top:0;right:0;bottom:0;width:100vw;height:100vh;background:rgba(0,0,0,.76);display:flex;align-items:center;justify-content:center;z-index:20000;backdrop-filter:blur(5px);padding:24px;box-sizing:border-box;transform:none!important;}
      html,body{min-height:100%;}
      .sf-wn-modal{width:min(920px,94vw);max-height:min(84vh,780px);border-radius:18px;overflow:hidden;border:4px solid;border-image:linear-gradient(135deg,#f1d27a,#c9a44a,#f1d27a) 1;box-shadow:0 28px 80px rgba(0,0,0,0.88);background-image:url('panel_bg.jpg');background-size:cover;background-position:center;}
      .sf-wn__head{padding:16px 20px;background:linear-gradient(135deg,rgba(40,30,20,0.99),rgba(25,18,12,0.99));border-bottom:3px solid rgba(201,164,74,0.45);}
      .sf-wn__title{font-size:20px;font-weight:900;letter-spacing:2.2px;color:#f1d27a;text-shadow:0 0 22px rgba(241,210,122,0.65),0 4px 12px rgba(0,0,0,0.95);text-transform:uppercase;display:flex;align-items:center;gap:10px;}
      .sf-wn__sub{margin-top:6px;font-weight:900;color:rgba(255,255,255,0.88);text-shadow:0 2px 10px rgba(0,0,0,0.95);font-size:13px;letter-spacing:0.4px;}

      .sf-wn__body{padding:18px 20px;background:linear-gradient(135deg,rgba(28,34,40,0.975),rgba(16,20,24,0.99));overflow:auto;}
      .sf-wn__grid{display:grid;grid-template-columns:1.05fr 0.95fr;gap:16px;}
      @media (max-width: 820px){.sf-wn__grid{grid-template-columns:1fr;}}

      .sf-wn__card{border:2px solid rgba(201,164,74,0.30);border-radius:14px;background:rgba(0,0,0,0.35);box-shadow:0 10px 28px rgba(0,0,0,0.55);padding:14px 14px;}
      .sf-wn__card h3{margin:0 0 10px 0;font-size:14px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#f1d27a;text-shadow:0 2px 10px rgba(0,0,0,0.95);}
      .sf-wn__body p{margin:0 0 10px 0;font-weight:900;color:rgba(255,255,255,0.9);text-shadow:0 2px 8px rgba(0,0,0,0.95);}

      .sf-wn__list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;}
      .sf-wn__list li{font-weight:900;color:#f7f0d0;text-shadow:0 2px 10px rgba(0,0,0,0.95);}
      .sf-wn__mini{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;}
      .sf-wn__mini li{font-weight:900;color:rgba(255,255,255,0.86);text-shadow:0 2px 10px rgba(0,0,0,0.95);}
      .sf-wn__tip{margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(201,164,74,0.12);border:1px solid rgba(201,164,74,0.35);color:#f7f0d0;font-weight:900;text-shadow:0 2px 10px rgba(0,0,0,0.95);}

      .sf-wn__foot{padding:12px 16px;background:linear-gradient(135deg,rgba(40,30,20,0.99),rgba(25,18,12,0.99));border-top:3px solid rgba(201,164,74,0.45);display:flex;justify-content:flex-end;gap:10px;}
      .sf-wn__btn{height:44px;min-width:120px;padding:0 20px;border:none;cursor:pointer;border-radius:12px;background-image:url('tlacitko_shop.jpg');background-size:cover;background-position:center;color:#fff;font-weight:900;font-size:13px;letter-spacing:0.9px;text-shadow:0 3px 10px rgba(0,0,0,0.95);box-shadow:0 10px 25px rgba(0,0,0,0.70);border:3px solid rgba(201,164,74,0.45);transition:all 0.2s ease;text-transform:uppercase;}
      .sf-wn__btn:hover{transform:translateY(-2px);border-color:#c9a44a;box-shadow:0 16px 38px rgba(0,0,0,0.78),0 0 26px rgba(241,210,122,0.28);} 
    `;
    document.head.appendChild(s);
  }

  function showWhatsNewModal() {
    injectWhatsNewStyles();

    const backdrop = document.createElement('div');
    backdrop.className = 'sf-wn-backdrop';
    backdrop.id = 'whatsNewModal';

    backdrop.innerHTML = `
      <div class="sf-wn-modal" role="dialog" aria-modal="true" aria-labelledby="whatsNewTitle">
        <div class="sf-wn__head">
          <div class="sf-wn__title" id="whatsNewTitle">🆕 Co je nového — Update ${WHATSNEW_VERSION}</div>
        </div>
        <div class="sf-wn__body">
          <div class="sf-wn__grid">
            <div class="sf-wn__card">
              <h3>Novinky v tomhle buildu</h3>
              <ul class="sf-wn__list">
                <li>🧰 Shop: inventář funguje na <b>drag &amp; drop</b> (přesouvání itemů)</li>
                <li>🎒 Equip: item z výbavy můžeš hodit zpět do konkrétního slotu inventáře</li>
                <li>📊 Staty: sjednocený vzhled (modrý bonus + pod tím 🐾/👥)</li>
                <li>🛠️ UI: vyčištěné prvky, menší bordel a méně překrývání</li>
              </ul>
              <div class="sf-wn__tip">Tip: Itemy teď přidávají <b>přímo do čísel statů</b> (S&amp;F styl). Čím vyšší level, tím lepší dropy a nabídky.</div>
            </div>
            <div class="sf-wn__card">
              <h3>Plán / co se ladí</h3>
              <ul class="sf-wn__mini">
                <li>⚔️ Aréna: škálování DMG v boji (+10% každých 7s)</li>
                <li>🧩 Balance: ceny/odměny a lepší rotace shopu</li>
                <li>🧼 Black Market: dolaďování rozměrů karet a tlačítek</li>
                <li>🐾 Mazlíček / 👥 Guilda: bonusy jako % vrstvy nad itemy</li>
              </ul>
	              
            </div>
          </div>
        </div>
        <div class="sf-wn__foot">
          <button class="sf-wn__btn" id="whatsNewOk" type="button">OK</button>
        </div>
      </div>
    `;

    function close() {
      try { sessionStorage.setItem(WHATSNEW_SESSION_KEY, '1'); } catch {}
      backdrop.remove();
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });

    // Pripnout na <html>, aby fixed nebyl ovlivneny pripadnym transform na body/wrapu
    (document.documentElement || document.body).appendChild(backdrop);
    const ok = backdrop.querySelector('#whatsNewOk');
    if (ok) ok.addEventListener('click', close);

    // ESC
    window.addEventListener('keydown', function esc(e){
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', esc);
        close();
      }
    });
  }

  function maybeShowWhatsNew() {
    try {
      if (sessionStorage.getItem(WHATSNEW_SESSION_KEY) === '1') return;
    } catch {}
    // jen pokud jsme přihlášení (po login/autologin)
    if (window.SF?.user?.id) showWhatsNewModal();
  }


  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", async () => {
    wireButtons();
    await window.SFReady;
    renderFromStatsRow(window.SF?.stats);

    // ===== DnD: equip sloty jako v shopu =====
    try {
      document.querySelectorAll('.slot[data-slot]').forEach(slotEl => {
        slotEl.addEventListener('dragover', handleDragOver);
        slotEl.addEventListener('dragleave', handleDragLeave);
        slotEl.addEventListener('drop', handleEquipDrop);
      });
    } catch {}

    // ===== INVENTÁŘ SIZE TOGGLE (stejně jako v shopu) =====
    const INV_SIZE_KEY = 'sf_inv_size'; // 'normal' | 'big'
    const invGrid = document.getElementById('inventoryGrid');
    const invSizeBtn = document.getElementById('invSizeToggle');
    const trashBtn = document.getElementById('trashBtn');

    if (trashBtn){
      trashBtn.addEventListener('click', async () => {
        try{
          await window.SFReady;
          const row = window.SF?.stats || {};
          const inv = Array.isArray(row.inventory) ? [...row.inventory] : [];
          if (selectedInvIndex === null) return;
          const cur = inv[selectedInvIndex];
          if (!cur) return;

          // potvrzení
          const ok = confirm('Opravdu chceš tento item zahodit?');
          if (!ok) return;

          inv[selectedInvIndex] = null;
          setSelectedInvIndex(null);
          window.SF.updateStats({ inventory: inv });
          renderInventory({ ...row, inventory: inv });
        }catch(e){
          console.warn('Koš selhal', e);
        }
      });
    }
    // ===== SELL ZONE (z shopu) =====
    const sellZone = document.getElementById('sellZone');
    if (sellZone){
      sellZone.addEventListener('click', async () => {
        try{
          if (selectedInvIndex === null) return;
          await sellInvIndex(selectedInvIndex);
        }catch(e){ console.warn('Sell zone selhala', e); }
      });

      sellZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        sellZone.classList.add('drag-over');
      });
      sellZone.addEventListener('dragleave', () => sellZone.classList.remove('drag-over'));
      sellZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        sellZone.classList.remove('drag-over');
        try{
          const raw = e.dataTransfer?.getData('text/plain') || '';
          let payload = null;
          try{ payload = JSON.parse(raw); }catch{}
          if (!payload || payload.type !== 'inv') return;
          const idx = Number(payload.index);
          if (!Number.isFinite(idx)) return;
          await sellInvIndex(idx);
        }catch(err){
          console.warn('Sell drop selhal', err);
        }
      });
    }



    function getInvSize(){
      try { return localStorage.getItem(INV_SIZE_KEY) || 'normal'; } catch { return 'normal'; }
    }
    function setInvSize(v){
      try { localStorage.setItem(INV_SIZE_KEY, v); } catch {}
    }
    function applyInvSize(){
      if (!invGrid) return;
      const v = getInvSize();
      invGrid.classList.toggle('inv-big', v === 'big');
      if (invSizeBtn) invSizeBtn.textContent = (v === 'big') ? '⤡' : '⤢';
    }

    if (invSizeBtn) {
      invSizeBtn.addEventListener('click', () => {
        const next = (getInvSize() === 'big') ? 'normal' : 'big';
        setInvSize(next);
        applyInvSize();
      });
    }
    applyInvSize();
    // Co je nového — zobrazit jen jednou po loginu/autologinu
    maybeShowWhatsNew();
    // Vynutit otevření přes #whatsnew (např. z otazníku)
    try {
      if ((location.hash || '').toLowerCase() === '#whatsnew') {
        showWhatsNewModal();
        history.replaceState(null, '', location.pathname);
      }
    } catch {}
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