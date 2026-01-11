const supabaseClient = () => window.supabaseClient;
async function ensureOnline() {
  if (window.SFReady) await window.SFReady;
  const sb = supabaseClient();
  if (!sb) throw new Error('Supabase client není inicializovaný (načti menu.js před tímto skriptem)');
  return sb;
}

// ===== CONSTANTS =====
const INVENTORY_SIZE = 8;
const SHOP_ROTATION_HOURS = 5;
const ITEMS_PER_CATEGORY = 4;
const ITEM_LEVEL_SCALE = 0.08;
const ITEM_ROLL_MIN = 0.90;
const ITEM_ROLL_MAX = 1.15;

// ===== CLASS METADATA =====
const CLASS_META = {
  padouch: { icon: "👻", label: "Padouch" },
  rvac: { icon: "✊", label: "Rváč" },
  mozek: { icon: "💡", label: "Mozek" }
};

// ===== GAME STATE =====
let gameState = {
  userId: null,
  level: 1,
  xp: 0,
  money: 3170,
  cigarettes: 42,
  playerClass: 'padouch',
  stats: {
    strength: 18,
    defense: 14,
    dexterity: 11,
    intelligence: 11,
    constitution: 16,
    luck: 9
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
    gloves: null
  },
  lastShopRotation: null,
  currentShopItems: {
    weapons: [],
    armor: [],
    special: []
  }
};

let currentCategory = 'weapons';

// ===== SAFE STATS (prevence "undefined" řádků) =====
const ALLOWED_STATS = ['strength','defense','dexterity','intelligence','constitution','luck'];

function sanitizeStats(input) {
  const src = (input && typeof input === 'object') ? input : {};
  const out = {};
  for (const k of ALLOWED_STATS) {
    const v = Number(src[k]);
    out[k] = Number.isFinite(v) ? v : 0;
  }
  return out;
}

function formatStatValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  const s = String(rounded);
  return s.includes('.') ? rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1') : s;
}

// ===== UTILITY FUNCTIONS =====
function getRequiredXP(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function getAllItems() {
  return [
    ...window.SHOP_ITEMS.weapons,
    ...window.SHOP_ITEMS.armor,
    ...window.SHOP_ITEMS.special
  ];
}

function renderItemIconHTML(icon, alt) {
  const safeAlt = String(alt || 'item').replace(/"/g, '&quot;');
  const ic = icon == null ? '' : String(icon);

  const isImage =
    /^data:image\//i.test(ic) ||
    /^https?:\/\//i.test(ic) ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(ic);

  if (isImage) return `<img src="${ic}" alt="${safeAlt}">`;
  return ic ? ic : '❓';
}

function getItemById(itemId) {
  if (typeof itemId === 'object' && itemId !== null) {
    return itemId;
  }

  const ALIASES = {
    knife: 'nuz',
    tactical_knife: 'nuz',
    takticky_nuz: 'nuz',
    'takticky-nuz': 'nuz',
  };
  const normId = ALIASES[String(itemId)] || itemId;
  
  const allShop = [
    ...(gameState.currentShopItems?.weapons || []),
    ...(gameState.currentShopItems?.armor || []),
    ...(gameState.currentShopItems?.special || [])
  ];
  const foundInst = allShop.find(i => i.instance_id === normId || i.id === normId);
  if (foundInst) return foundInst;

  const foundInv = (gameState.inventory || []).find(i => {
    if (!i) return false;
    if (typeof i === 'object') return i.instance_id === normId || i.id === normId;
    return i === normId;
  });
  if (foundInv) return foundInv;

  return getAllItems().find(item => item.id === normId);
}

function makeItemInstance(baseItem, level){
  const roll = ITEM_ROLL_MIN + Math.random() * (ITEM_ROLL_MAX - ITEM_ROLL_MIN);
  const scale = 1 + (Math.max(1, level) - 1) * ITEM_LEVEL_SCALE;

  const inst = JSON.parse(JSON.stringify(baseItem));
  inst.instance_id = 'it_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  inst.base_id = baseItem.id;

  if (inst.bonuses) {
    Object.keys(inst.bonuses).forEach(stat => {
      inst.bonuses[stat] = Math.max(0, Math.round(inst.bonuses[stat] * scale * roll));
    });
  }

  inst.price = Math.floor(((baseItem.price || 0) * (0.9 + scale) * roll) * 0.5);
  inst.level_roll = level;
  return inst;
}

function calculateStatBonus(stat, value) {
  const v = Number(value);
  const val = Number.isFinite(v) ? v : 0;
  switch(stat) {
    case 'strength':
      return `+${Math.round(val * 2)} DMG`;
    case 'defense':
      const defPercent = Math.min(Math.floor((val / 28) * 100), 100);
      return `${defPercent}% Redukce`;
    case 'dexterity':
      return `+${Math.floor(val * 0.5)}% Crit`;
    case 'intelligence':
      return `+${Math.floor(val * 1.5)}% Magie`;
    case 'constitution':
      const hp = Math.round(500 + (val * 25));
      return `${hp} HP`;
    case 'luck':
      const luckPercent = Math.min(Math.floor(val), 100);
      return `${luckPercent}% / 100%`;
    default:
      return '';
  }
}

// ===== SHOP ROTATION SYSTEM =====
function shouldRotateShop() {
  if (!gameState.lastShopRotation) return true;
  
  const now = Date.now();
  const lastRotation = new Date(gameState.lastShopRotation).getTime();
  const hoursPassed = (now - lastRotation) / (1000 * 60 * 60);
  
  return hoursPassed >= SHOP_ROTATION_HOURS;
}

function getRandomItems(items, count) {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, items.length));
}

function rotateShopItems() {
  console.log('🔄 Rotace itemů v shopu...');
  
  gameState.currentShopItems = {
    weapons: getRandomItems(window.SHOP_ITEMS.weapons, ITEMS_PER_CATEGORY).map(it => makeItemInstance(it, gameState.level)),
    armor: getRandomItems(window.SHOP_ITEMS.armor, ITEMS_PER_CATEGORY).map(it => makeItemInstance(it, gameState.level)),
    special: getRandomItems(window.SHOP_ITEMS.special, ITEMS_PER_CATEGORY).map(it => makeItemInstance(it, gameState.level))
  };
  
  gameState.lastShopRotation = new Date().toISOString();
  
  console.log('✅ Nové itemy:', gameState.currentShopItems);
}

function getTimeUntilNextRotation() {
  if (!gameState.lastShopRotation) return '0:00:00';
  
  const now = Date.now();
  const lastRotation = new Date(gameState.lastShopRotation).getTime();
  const nextRotation = lastRotation + (SHOP_ROTATION_HOURS * 60 * 60 * 1000);
  const remaining = Math.max(0, nextRotation - now);
  
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ===== RENDER CLASS BADGE =====
function renderClassBadge() {
  const classBadge = document.getElementById('classBadge');
  if (!classBadge) return;
  
  const cls = String(gameState.playerClass || 'padouch').toLowerCase();
  const meta = CLASS_META[cls] || CLASS_META.padouch;
  
  classBadge.textContent = meta.icon;
  classBadge.title = meta.label;
  
  console.log('🎭 Class badge rendered:', meta.label, meta.icon);
}

// ===== SUPABASE FUNCTIONS =====
async function initUser() {
  try {
    const sb = await ensureOnline();
    const userId = window.SF?.user?.id || window.SF?.stats?.user_id;
    if (!userId) {
      location.href = "login.html";
      return;
    }

    gameState.userId = userId;

    const { data, error } = await sb
      .from("player_stats")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error loading from Supabase:", error);
      throw error;
    }

    if (data) {
      gameState.level = data.level || 1;
      gameState.xp = data.xp || 0;
      gameState.money = data.money ?? gameState.money;
      gameState.cigarettes = data.cigarettes ?? gameState.cigarettes;
      gameState.stats = sanitizeStats(data.stats ?? gameState.stats);
      gameState.inventory = data.inventory || [];
      gameState.equipped = data.equipped || gameState.equipped;
      gameState.lastShopRotation = data.last_shop_rotation ?? data.lastShopRotation ?? null;
      gameState.currentShopItems = data.current_shop_items || data.currentShopItems || gameState.currentShopItems;
      
      // Load player class
      if (data.stats?.player_class) {
        gameState.playerClass = String(data.stats.player_class).toLowerCase();
        console.log('🎭 Loaded player class:', gameState.playerClass);
      }

      // ===== MIGRACE STARÝCH SAVŮ =====
      const allBase = getAllItems();
      const toInstance = (ref) => {
        if (!ref) return null;
        if (typeof ref === 'object') return ref;
        const id = String(ref);
        const base = allBase.find(it => it.id === id);
        if (!base) return null;
        const inst = JSON.parse(JSON.stringify(base));
        inst.instance_id = id;
        inst.base_id = base.id;
        inst.level_roll = gameState.level;
        return inst;
      };

      gameState.inventory = (gameState.inventory || []).map(x => toInstance(x) || x).filter(Boolean);
      const eq = gameState.equipped || {};
      Object.keys(eq).forEach(k => {
        if (typeof eq[k] === 'string') {
          eq[k] = toInstance(eq[k]) || null;
        }
      });
      gameState.equipped = eq;
    } else {
      rotateShopItems();
      await saveToSupabase();
    }

    if (shouldRotateShop()) {
      rotateShopItems();
      await saveToSupabase();
      showNotification("🔄 Shop se obnovil!", "success");
    }
  } catch (error) {
    console.error("❌ Error initializing user:", error);
    showNotification("Chyba při načítání hry", "error");
  }
}

async function saveToSupabase() {
  try {
    const sb = await ensureOnline();

    const basePayload = {
      user_id: gameState.userId,
      level: gameState.level,
      xp: gameState.xp,
      money: gameState.money,
      cigarettes: gameState.cigarettes,
      stats: sanitizeStats(gameState.stats),
      inventory: gameState.inventory,
      equipped: gameState.equipped,
      last_shop_rotation: gameState.lastShopRotation,
      current_shop_items: gameState.currentShopItems
    };

    let payload = { ...basePayload };

    for (let attempts = 0; attempts < 6; attempts++) {
      const { error } = await sb.from("player_stats").upsert(payload, { onConflict: "user_id" });
      if (!error) return true;

      const msg = String(error?.message || "");
      const match = msg.match(/Could not find the '([^']+)' column/);
      if (error?.code === "PGRST204" && match) {
        const missing = match[1];
        if (missing in payload) {
          delete payload[missing];
          continue;
        }
      }
      throw error;
    }
    return false;
  } catch (error) {
    console.error("❌ Error saving to Supabase:", error);
    return false;
  }
}

// ===== TOOLTIP SYSTEM =====
let tooltip = null;

function createTooltip() {
  tooltip = document.createElement('div');
  tooltip.className = 'item-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    background: linear-gradient(135deg, rgba(40,30,20,0.98), rgba(25,18,12,0.99));
    border: 3px solid #c9a44a;
    border-radius: 12px;
    padding: 14px;
    pointer-events: none;
    z-index: 10000;
    display: none;
    min-width: 250px;
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
        dexterity: '🎯 Obratnost',
        intelligence: '🧠 Inteligence',
        constitution: '💪 Výdrž',
        luck: '🍀 Štěstí'
      };
      bonusesHTML += `<div style="color: ${color}; font-weight: 900; font-size: 13px; margin: 3px 0;">${statNames[stat]}: ${sign}${value}</div>`;
    });
    bonusesHTML += '</div>';
  }
  
  tooltip.innerHTML = `
    <div style="font-size: 18px; font-weight: 900; color: #f1d27a; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">
      ${item.icon} ${item.name}
    </div>
    <div style="font-size: 12px; color: #c9a44a; margin-bottom: 8px; line-height: 1.4;">
      ${item.description}
    </div>
    <div style="font-size: 16px; font-weight: 900; color: #f1d27a; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">
      💰 ${item.price}₽
    </div>
    ${bonusesHTML}
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

// ===== UI RENDERING =====
function renderShopItems() {
  const shopGrid = document.getElementById('shopGrid');
  const items = gameState.currentShopItems[currentCategory] || [];
  
  if (!shopGrid) return;
  
  shopGrid.innerHTML = items.map(item => {
    const itemId = item.instance_id || item.id;
    const iconHTML = renderItemIconHTML(item.icon, item.name);
    return `
      <div class="shop-item" data-item-id="${itemId}">
        <div class="item-icon">
          ${iconHTML}
        </div>
        <div class="item-details">
          <h3>${item.name}</h3>
          <p class="item-desc">${item.description}</p>
          <div class="item-price">
            <span class="price">${item.price}₽</span>
            <button class="buy-btn" onclick="buyItem('${itemId}')">
              KOUPIT
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  document.querySelectorAll('.shop-item').forEach(itemEl => {
    const itemId = itemEl.dataset.itemId;
    const item = getItemById(itemId);
    
    if (!item) return;
    
    itemEl.addEventListener('mouseenter', (e) => {
      showTooltip(item, e.clientX, e.clientY);
    });
    
    itemEl.addEventListener('mousemove', (e) => {
      if (tooltip && tooltip.style.display === 'block') {
        tooltip.style.left = (e.clientX + 20) + 'px';
        tooltip.style.top = (e.clientY - tooltip.offsetHeight / 2) + 'px';
      }
    });
    
    itemEl.addEventListener('mouseleave', () => {
      hideTooltip();
    });
  });
}

async function paidRerollShop() {
  try {
    if (gameState.cigarettes < 10) {
      showNotification('Nemáš 10 cigaret!', 'error');
      return;
    }

    gameState.cigarettes -= 10;
    rotateShopItems();
    gameState.lastShopRotation = new Date().toISOString();

    const saved = await saveToSupabase();
    if (!saved) {
      gameState.cigarettes += 10;
      showNotification('Chyba při ukládání (reroll zrušen).', 'error');
      return;
    }

    updateUI();
    showNotification('🔁 Itemy nahrazeny! (-10 cig)', 'success');
  } catch (e) {
    console.error(e);
    showNotification('Chyba při nahrazení itemů', 'error');
  }
}

function renderInventory() {
  const inventoryGrid = document.getElementById('inventoryGrid');
  if (!inventoryGrid) return;
  
  console.log('🎨 Renderuji inventář:', gameState.inventory);
  
  inventoryGrid.innerHTML = '';
  
  gameState.inventory.forEach((itemRef, index) => {
    const item = getItemById(itemRef);
    if (!item) {
      console.warn('⚠️ Item not found:', itemRef);
      return;
    }
    
    const slot = document.createElement('div');
    slot.className = 'inv-slot filled';
    slot.draggable = true;
    const itemId = item.instance_id || item.id;
    slot.dataset.itemId = itemId;
    slot.dataset.invIndex = index;
    
    const iconHTML = renderItemIconHTML(item.icon, item.name);
    if (iconHTML.startsWith('<img')) {
      slot.innerHTML = iconHTML;
    } else {
      slot.textContent = iconHTML;
    }
    
    slot.addEventListener('mouseenter', (e) => {
      showTooltip(item, e.clientX, e.clientY);
    });
    
    slot.addEventListener('mousemove', (e) => {
      if (tooltip && tooltip.style.display === 'block') {
        tooltip.style.left = (e.clientX + 20) + 'px';
        tooltip.style.top = (e.clientY - tooltip.offsetHeight / 2) + 'px';
      }
    });
    
    slot.addEventListener('mouseleave', () => {
      hideTooltip();
    });
    
    slot.addEventListener('dragstart', handleDragStart);
    slot.addEventListener('dragend', handleDragEnd);
    
    inventoryGrid.appendChild(slot);
  });
  
  for (let i = gameState.inventory.length; i < INVENTORY_SIZE; i++) {
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    inventoryGrid.appendChild(slot);
  }
  
  const invCount = document.getElementById('invCount');
  if (invCount) {
    invCount.textContent = gameState.inventory.length;
  }
  
  console.log('✅ Inventář vyrenderován');
}

function renderEquippedItems() {
  Object.keys(gameState.equipped).forEach(slotName => {
    const itemRef = gameState.equipped[slotName];
    const slotElement = document.querySelector(`[data-slot="${slotName}"]`);
    
    if (!slotElement) return;
    
    if (itemRef) {
      const item = getItemById(itemRef);
      if (!item) return;
      
      slotElement.classList.add('has-item');
      
      const itemId = item.instance_id || item.id;
      
      const iconHTML = renderItemIconHTML(item.icon, item.name);
      if (iconHTML.startsWith('<img')) {
        slotElement.innerHTML = iconHTML.replace(
          '<img',
          `<img class="slot-item" draggable="true" data-item-id="${itemId}" data-from-slot="${slotName}"`
        );
      } else {
        slotElement.innerHTML = `<span class="slot-item" draggable="true" data-item-id="${itemId}" data-from-slot="${slotName}">${iconHTML}</span>`;
      }
      
      slotElement.addEventListener('mouseenter', (e) => {
        showTooltip(item, e.clientX, e.clientY);
      });
      
      slotElement.addEventListener('mousemove', (e) => {
        if (tooltip && tooltip.style.display === 'block') {
          tooltip.style.left = (e.clientX + 20) + 'px';
          tooltip.style.top = (e.clientY - tooltip.offsetHeight / 2) + 'px';
        }
      });
      
      slotElement.addEventListener('mouseleave', () => {
        hideTooltip();
      });
      
      const itemElement = slotElement.querySelector('.slot-item');
      if (itemElement) {
        itemElement.addEventListener('dragstart', handleEquippedDragStart);
        itemElement.addEventListener('dragend', handleDragEnd);
      }
    } else {
      slotElement.classList.remove('has-item');
      slotElement.innerHTML = `<span class="slot-emoji">${getSlotEmoji(slotName)}</span>`;
    }
  });
}

function renderCharacterStats() {
  const statsSection = document.getElementById('statsSection');
  if (!statsSection) return;
  
  const bonuses = calculateTotalBonuses();
  const statNames = {
    strength: '⚔️ Strength',
    defense: '🛡️ Defense',
    dexterity: '🎯 Dexterity',
    intelligence: '🧠 Intelligence',
    constitution: '💪 Constitution',
    luck: '🍀 Luck'
  };
  
  let statsHTML = '<div class="section-header"><h2>📊 STATISTIKY</h2></div>';
  
  ALLOWED_STATS.forEach(stat => {
    const baseValue = Number(gameState.stats[stat] ?? 0);
    const bonus = bonuses[stat] || 0;
    const totalValue = baseValue + bonus;
    
    statsHTML += `
      <div class="stat">
        <span>${statNames[stat]}</span>
        <b id="${stat}Value">${formatStatValue(baseValue)}${bonus !== 0 ? ` <span style="color: #4af;" id="${stat}Bonus">+${bonus}</span>` : ''}</b>
        <span class="stat-extra" id="${stat}Extra">${calculateStatBonus(stat, totalValue)}</span>
      </div>
    `;
  });
  
  statsSection.innerHTML = statsHTML;
}

function getSlotEmoji(slotName) {
  const emojis = {
    weapon: '🗡️',
    shield: '🛡️',
    ring: '💍',
    backpack: '🎒',
    helmet: '🎩',
    armor: '👕',
    boots: '👢',
    gloves: '🧤'
  };
  return emojis[slotName] || '❓';
}

function updateUI() {
  const levelDisplay = document.getElementById('levelDisplay');
  const levelShop = document.getElementById('levelShop');
  if (levelDisplay) levelDisplay.textContent = gameState.level;
  if (levelShop) levelShop.textContent = `Level ${gameState.level}`;
  
  const money = document.getElementById('money');
  const cigarettes = document.getElementById('cigarettes');
  if (money) money.textContent = gameState.money.toLocaleString('cs-CZ');
  if (cigarettes) cigarettes.textContent = gameState.cigarettes;
  
  const requiredXP = getRequiredXP(gameState.level);
  const xpPercent = (gameState.xp / requiredXP) * 100;
  const xpFill = document.getElementById('xpFill');
  const xpText = document.getElementById('xpText');
  if (xpFill) xpFill.style.width = `${xpPercent}%`;
  if (xpText) xpText.textContent = `${gameState.xp} / ${requiredXP}`;
  
  renderInventory();
  renderEquippedItems();
  renderCharacterStats();
  renderClassBadge();
  updateRotationTimer();
}

function updateRotationTimer() {
  const timerEl = document.getElementById('shopTimer');
  if (timerEl) {
    timerEl.textContent = `🔄 Další rotace: ${getTimeUntilNextRotation()}`;
  }
}

function calculateTotalBonuses() {
  const bonuses = {
    strength: 0,
    defense: 0,
    dexterity: 0,
    intelligence: 0,
    constitution: 0,
    luck: 0
  };
  
  Object.values(gameState.equipped).forEach(itemRef => {
    if (!itemRef) return;
    const item = getItemById(itemRef);
    if (!item || !item.bonuses) return;
    
    Object.keys(item.bonuses).forEach(stat => {
      bonuses[stat] += item.bonuses[stat];
    });
  });
  
  return bonuses;
}

async function buyItem(itemId) {
  console.log('💰 Kupuji item:', itemId);
  
  const item = getItemById(itemId);
  
  if (!item) {
    console.error('❌ Item nenalezen:', itemId);
    showNotification('Item nenalezen!', 'error');
    return;
  }
  
  console.log('✅ Item nalezen:', item);
  
  if (gameState.money < item.price) {
    showNotification('Nemáš dost peněz!', 'error');
    return;
  }
  
  if (gameState.inventory.length >= INVENTORY_SIZE) {
    showNotification('Inventář je plný!', 'error');
    return;
  }
  
  gameState.money -= item.price;
  gameState.inventory.push(item);
  
  console.log('📦 Item přidán do inventáře');
  console.log('📦 Inventář po koupi:', gameState.inventory);
  
  const saved = await saveToSupabase();
  
  if (saved) {
    updateUI();
    showNotification(`${item.name} koupen za ${item.price}₽!`, 'success');
  } else {
    gameState.money += item.price;
    gameState.inventory.pop();
    showNotification('Chyba při ukládání!', 'error');
  }
}

// ===== DRAG & DROP =====
let draggedItem = null;
let dragSource = null;

function handleDragStart(e) {
  draggedItem = {
    itemId: e.target.dataset.itemId,
    invIndex: parseInt(e.target.dataset.invIndex)
  };
  dragSource =
