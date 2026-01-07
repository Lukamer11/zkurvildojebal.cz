// ===== SUPABASE SETUP =====
const SUPABASE_URL = 'https://bmmaijlbpwgzhrxzxphf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbWFpamxicHdnemhyeHp4cGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NjQ5MDcsImV4cCI6MjA4MjQ0MDkwN30.s0YQVnAjMXFu1pSI1NXZ2naSab179N0vQPglsmy3Pgw';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== CONSTANTS =====
const INVENTORY_SIZE = 8; // Změněno z 24 na 8
const SHOP_ROTATION_HOURS = 5; // Rotace každých 5 hodin
const ITEMS_PER_CATEGORY = 4; // Kolik itemů zobrazit v každé kategorii
// ===== GRIND TUNING =====
const ITEM_LEVEL_SCALE = 0.08;     // ~ +8% statů za level
const ITEM_ROLL_MIN = 0.90;        // náhodný roll
const ITEM_ROLL_MAX = 1.15;


// ===== GAME STATE =====
let gameState = {
  userId: null,
  level: 1,
  xp: 0,
  money: 3170,
  cigarettes: 42,
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

function getItemById(itemId) {
  // 1) instance v current shopu
  const allShop = [
    ...(gameState.currentShopItems?.weapons || []),
    ...(gameState.currentShopItems?.armor || []),
    ...(gameState.currentShopItems?.special || [])
  ];
  const foundInst = allShop.find(i => i.instance_id === itemId || i.id === itemId);
  if (foundInst) return foundInst;

  // 2) instance v inventáři
  const foundInv = (gameState.inventory || []).find(i => i && typeof i === 'object' && (i.instance_id === itemId || i.id === itemId));
  if (foundInv) return foundInv;

  // 3) fallback: base item podle id (starý styl)
  return getAllItems().find(item => item.id === itemId);
}



function resolveItem(ref){
  // ref může být string (starý styl) nebo objekt (instance)
  if (!ref) return null;
  if (typeof ref === 'string') return getAllItems().find(i => i.id === ref) || null;
  return ref; // instance
}

function makeItemInstance(baseItem, level){
  const roll = ITEM_ROLL_MIN + Math.random() * (ITEM_ROLL_MAX - ITEM_ROLL_MIN);
  const scale = 1 + (Math.max(1, level) - 1) * ITEM_LEVEL_SCALE;

  const inst = JSON.parse(JSON.stringify(baseItem)); // deep clone
  inst.instance_id = 'it_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  inst.base_id = baseItem.id;

  // scaling bonusů
  if (inst.bonuses) {
    Object.keys(inst.bonuses).forEach(stat => {
      inst.bonuses[stat] = Math.max(0, Math.round(inst.bonuses[stat] * scale * roll));
    });
  }

  // scaling ceny
  inst.price = Math.floor((baseItem.price || 0) * (0.9 + scale) * roll);

  // info do tooltipu
  inst.level_roll = level;
  return inst;
}


function calculateStatBonus(stat, value) {
  switch(stat) {
    case 'strength':
      return `+${value * 2} DMG`;
    case 'defense':
      const defPercent = Math.min(Math.floor((value / 28) * 100), 100);
      return `${defPercent}% Redukce`;
    case 'dexterity':
      return `+${Math.floor(value * 0.5)}% Crit`;
    case 'intelligence':
      return `+${Math.floor(value * 1.5)}% Magie`;
    case 'constitution': {
      const baseHp = 500 + (value * 25);
      const cls = String((window.SF?.getPlayerClass ? window.SF.getPlayerClass() : (localStorage.getItem('sf_class')||'padouch'))||'padouch').toLowerCase();
      let hp = Math.floor(baseHp);
      if (cls === 'rvac') hp = Math.floor(hp * 1.25);
      if (cls === 'mozek') hp = Math.floor(hp * 0.8);
      return `${hp} HP`;
    }
case 'luck':
      const luckPercent = Math.min(value, 100);
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
  armor:   getRandomItems(window.SHOP_ITEMS.armor,   ITEMS_PER_CATEGORY).map(it => makeItemInstance(it, gameState.level)),
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

// ===== SUPABASE FUNCTIONS =====
async function initUser() {
  try {
    // User ID: primárně Supabase auth user_id (sjednocení se stránkami arena/mail/menu)
    let userId = localStorage.getItem('user_id') || localStorage.getItem('slavFantasyUserId');
    
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('slavFantasyUserId', userId);
    }
    
    gameState.userId = userId;
    
    const { data, error } = await supabaseClient
      .from('player_stats')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error loading from Supabase:', error);
      throw error;
    }
    
    if (data) {
      gameState.level = data.level;
      gameState.xp = data.xp;
      gameState.money = data.money;
      gameState.cigarettes = data.cigarettes;
      gameState.stats = data.stats;
      gameState.inventory = data.inventory || [];
      gameState.equipped = data.equipped || gameState.equipped;
      gameState.lastShopRotation = data.last_shop_rotation;
      gameState.currentShopItems = data.current_shop_items || gameState.currentShopItems;
      
      console.log('Loaded from Supabase:', data);
    } else {
      // New user
      rotateShopItems();
      await saveToSupabase();
      console.log('New user created:', userId);
    }
    
    // Check if shop should rotate
    if (shouldRotateShop()) {
      rotateShopItems();
      await saveToSupabase();
      showNotification('🔄 Shop se obnovil!', 'success');
    }
    
  } catch (error) {
    console.error('Error initializing user:', error);
    showNotification('Chyba při načítání hry', 'error');
  }
}

async function saveToSupabase() {
  // Robustní uložení: pokud v DB chybí sloupec (PGRST204), odstraníme ho z payloadu a zkusíme znovu.
  try {
    const basePayload = {
      user_id: gameState.userId,
      level: gameState.level,
      xp: gameState.xp,
      money: gameState.money,
      cigarettes: gameState.cigarettes,
      stats: gameState.stats,
      inventory: gameState.inventory,
      equipped: gameState.equipped,
      // shop-only: pokud tyhle sloupce v DB nejsou, fallback níže je vyhodí z payloadu
      last_shop_rotation: gameState.lastShopRotation,
      current_shop_items: gameState.currentShopItems,
      updated_at: new Date().toISOString()
    };

    let payload = { ...basePayload };

    for (let attempts = 0; attempts < 6; attempts++) {
      const { error } = await supabaseClient
        .from('player_stats')
        .upsert(payload, { onConflict: 'user_id' });

      if (!error) {
        console.log('Saved to Supabase successfully');
        return true;
      }

      const msg = String(error?.message || '');
      const match = msg.match(/Could not find the '([^']+)' column/);
      if (error?.code === 'PGRST204' && match) {
        const missing = match[1];
        if (missing in payload) {
          console.warn('Supabase: chybí sloupec, zahazuji z payloadu:', missing);
          delete payload[missing];
          continue;
        }
      }

      throw error;
    }

    console.warn('Supabase: nepodařilo se uložit ani po ořezání payloadu.');
    return false;
  } catch (error) {
    console.error('Error saving to Supabase:', error);
    showNotification('Chyba ukládání do cloudu', 'error');
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
  
  shopGrid.innerHTML = items.map(item => `
    <div class="shop-item" data-item-id="${item.id}">
      <div class="item-icon">
        ${item.icon.endsWith('.jpg') ? 
          `<img src="${item.icon}" alt="${item.name}">` : 
          item.icon}
      </div>
      <div class="item-details">
        <h3>${item.name}</h3>
        <p class="item-desc">${item.description}</p>
        <div class="item-price">
          <span class="price">${item.price}₽</span>
          <button class="buy-btn" onclick="buyItem('${item.id}')">
            KOUPIT
          </button>
        </div>
      </div>
    </div>
  `).join('');
  
  // Add tooltip listeners
  document.querySelectorAll('.shop-item').forEach(itemEl => {
    const itemId = itemEl.dataset.itemId;
    const item = getItemById(itemId);
    
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

function renderInventory() {
  const inventoryGrid = document.getElementById('inventoryGrid');
  if (!inventoryGrid) return;
  
  inventoryGrid.innerHTML = '';
  
  // Render filled slots
  gameState.inventory.forEach((itemId, index) => {
    const item = getItemById(itemId);
    if (!item) return;
    
    const slot = document.createElement('div');
    slot.className = 'inv-slot filled';
    slot.draggable = true;
    slot.dataset.itemId = itemId;
    slot.dataset.invIndex = index;
    
    if (item.icon.endsWith('.jpg')) {
      slot.innerHTML = `<img src="${item.icon}" alt="${item.name}">`;
    } else {
      slot.textContent = item.icon;
    }
    
    // Tooltip
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
    
    // Drag events
    slot.addEventListener('dragstart', handleDragStart);
    slot.addEventListener('dragend', handleDragEnd);
    
    inventoryGrid.appendChild(slot);
  });
  
  // Render empty slots
  for (let i = gameState.inventory.length; i < INVENTORY_SIZE; i++) {
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    inventoryGrid.appendChild(slot);
  }
  
  // Update count
  const invCount = document.getElementById('invCount');
  if (invCount) {
    invCount.textContent = gameState.inventory.length;
  }
}

function renderEquippedItems() {
  Object.keys(gameState.equipped).forEach(slotName => {
    const itemId = gameState.equipped[slotName];
    const slotElement = document.querySelector(`[data-slot="${slotName}"]`);
    
    if (!slotElement) return;
    
    if (itemId) {
      const item = getItemById(itemId);
      if (!item) return;
      
      slotElement.classList.add('has-item');
      
      if (item.icon.endsWith('.jpg')) {
        slotElement.innerHTML = `<img src="${item.icon}" alt="${item.name}" class="slot-item" draggable="true" data-item-id="${itemId}" data-from-slot="${slotName}">`;
      } else {
        slotElement.innerHTML = `<span class="slot-item" draggable="true" data-item-id="${itemId}" data-from-slot="${slotName}">${item.icon}</span>`;
      }
      
      // Tooltip
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
      
      // Add drag events to equipped items
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
  
  Object.keys(gameState.stats).forEach(stat => {
    const baseValue = gameState.stats[stat];
    const bonus = bonuses[stat] || 0;
    const totalValue = baseValue + bonus;
    
    statsHTML += `
      <div class="stat">
        <span>${statNames[stat]}</span>
        <b id="${stat}Value">${baseValue}${bonus !== 0 ? ` <span style="color: #4af;" id="${stat}Bonus">+${bonus}</span>` : ''}</b>
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
  // Update level
  const levelDisplay = document.getElementById('levelDisplay');
  const levelShop = document.getElementById('levelShop');
  if (levelDisplay) levelDisplay.textContent = gameState.level;
  if (levelShop) levelShop.textContent = `Level ${gameState.level}`;
  
  // Update money
  const money = document.getElementById('money');
  const cigarettes = document.getElementById('cigarettes');
  if (money) money.textContent = gameState.money.toLocaleString();
  if (cigarettes) cigarettes.textContent = gameState.cigarettes;
  
  // Update XP bar
  const requiredXP = getRequiredXP(gameState.level);
  const xpPercent = (gameState.xp / requiredXP) * 100;
  const xpFill = document.getElementById('xpFill');
  const xpText = document.getElementById('xpText');
  if (xpFill) xpFill.style.width = `${xpPercent}%`;
  if (xpText) xpText.textContent = `${gameState.xp} / ${requiredXP}`;
  
  // Render all sections
  renderInventory();
  renderEquippedItems();
  renderCharacterStats();
  
  // Update shop rotation timer
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
  
  Object.values(gameState.equipped).forEach(itemId => {
    if (!itemId) return;
    const item = getItemById(itemId);
    if (!item || !item.bonuses) return;
    
    Object.keys(item.bonuses).forEach(stat => {
      bonuses[stat] += item.bonuses[stat];
    });
  });
  
  return bonuses;
}

// ===== SHOP FUNCTIONS =====
async function buyItem(itemId) {
  const item = getItemById(itemId);
  
  if (!item) {
    showNotification('Item nenalezen!', 'error');
    return;
  }
  
  if (gameState.money < item.price) {
    showNotification('Nemáš dost peněz!', 'error');
    return;
  }
  
  if (gameState.inventory.length >= INVENTORY_SIZE) {
    showNotification('Inventář je plný!', 'error');
    return;
  }
  
  // Purchase
  gameState.money -= item.price;
  gameState.inventory.push(item); // uloží celou instanci se scaled bonusy

  
  // Save and update
  await saveToSupabase();
  updateUI();
  
  showNotification(`${item.name} koupen za ${item.price}₽!`, 'success');
  try { sfSyncFromLocalState(gameState); } catch {}

}

// ===== DRAG & DROP =====
let draggedItem = null;
let dragSource = null;

function handleDragStart(e) {
  draggedItem = {
    itemId: e.target.dataset.itemId,
    invIndex: parseInt(e.target.dataset.invIndex)
  };
  dragSource = 'inventory';
  e.target.classList.add('dragging');
  hideTooltip();
}

function handleEquippedDragStart(e) {
  draggedItem = {
    itemId: e.target.dataset.itemId,
    fromSlot: e.target.dataset.fromSlot
  };
  dragSource = 'equipped';
  e.target.classList.add('dragging');
  hideTooltip();
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => {
    el.classList.remove('drag-over');
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  
  if (!draggedItem) return;
  
  const targetSlot = e.currentTarget.dataset.slot;
  const item = getItemById(draggedItem.itemId);
  
  if (!item) return;
  
  // Check if item can be equipped in this slot
  if (item.slot !== targetSlot) {
    showNotification(`${item.name} nelze nasadit do slotu ${targetSlot}!`, 'error');
    return;
  }
  
  // Handle equipping from inventory
  if (dragSource === 'inventory') {
    // If slot has item, swap
    const currentItem = gameState.equipped[targetSlot];
    if (currentItem) {
      gameState.inventory[draggedItem.invIndex] = currentItem;
    } else {
      // Remove from inventory
      gameState.inventory.splice(draggedItem.invIndex, 1);
    }
    
    // Equip new item
    gameState.equipped[targetSlot] = draggedItem.itemId;
    
    showNotification(`${item.name} nasazen!`, 'success');
  }
  
  // Handle moving between equipment slots
  else if (dragSource === 'equipped') {
    // Swap items
    const temp = gameState.equipped[targetSlot];
    gameState.equipped[targetSlot] = draggedItem.itemId;
    gameState.equipped[draggedItem.fromSlot] = temp;
    
    showNotification(`Položky přesunuty!`, 'success');
  }
  
  // Save and update
  await saveToSupabase();
  updateUI();
  
  draggedItem = null;
  dragSource = null;
}

async function unequipItem(slotName) {
  const itemId = gameState.equipped[slotName];
  if (!itemId) return;
  
  if (gameState.inventory.length >= INVENTORY_SIZE) {
    showNotification('Inventář je plný!', 'error');
    return;
  }
  
  gameState.equipped[slotName] = null;
  gameState.inventory.push(itemId);
  
  await saveToSupabase();
  updateUI();
  
  const item = getItemById(itemId);
  showNotification(`${item.name} odebrán z výbavy`, 'success');
  try { sfSyncFromLocalState(gameState); } catch {}

}

// ===== TAB SWITCHING =====
function switchCategory(category) {
  currentCategory = category;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeBtn = document.querySelector(`[data-category="${category}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  
  renderShopItems();
}

// ===== NOTIFICATIONS =====
function showNotification(message, type) {
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

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing shop...');
  
  // Check if SHOP_ITEMS is loaded
  if (!window.SHOP_ITEMS) {
    console.error('SHOP_ITEMS not loaded! Make sure items.js is included before shop.js');
    showNotification('Chyba: items.js není načten!', 'error');
    return;
  }
  
  showNotification('Načítání obchodu...', 'success');
  
  await initUser();
  
  renderShopItems();
  updateUI();
  
  // Setup tab listeners
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchCategory(btn.dataset.category);
    });
  });
  
  // Setup drop zones
  document.querySelectorAll('[data-dropzone="true"]').forEach(slot => {
    slot.addEventListener('dragover', handleDragOver);
    slot.addEventListener('dragleave', handleDragLeave);
    slot.addEventListener('drop', handleDrop);
    
    // Double-click to unequip
    slot.addEventListener('dblclick', (e) => {
      const slotName = e.currentTarget.dataset.slot;
      unequipItem(slotName);
    });
  });
  
  // Update rotation timer every second
  setInterval(() => {
    updateRotationTimer();
    
    // Check if shop should rotate
    if (shouldRotateShop()) {
      rotateShopItems();
      saveToSupabase();
      renderShopItems();
      showNotification('🔄 Shop se obnovil novými itemy!', 'success');
    }
  }, 1000);
  
  showNotification('Obchod načten!', 'success');
  
  console.log('Shop initialized!', gameState);
});

// ===== AUTO-SAVE =====
setInterval(async () => {
  await saveToSupabase();
  console.log('Auto-save completed');
}, 30000);

// ===== EXPOSE FOR HTML =====
window.buyItem = buyItem;

console.log('Shop system loaded!');

// === SF GLOBAL SYNC HELPERS (no UI changes) ===
function sfComputeMaxHpFromStats(stats){
  const cls = String((window.SF?.getPlayerClass ? window.SF.getPlayerClass() : (localStorage.getItem('sf_class')||'padouch'))||'padouch').toLowerCase();
  const con = Number(stats?.constitution ?? 0);
  let maxHp = Math.max(1, Math.floor(500 + con * 25));
  if (cls === 'rvac')  maxHp = Math.max(1, Math.floor(maxHp * 1.25));
  if (cls === 'mozek') maxHp = Math.max(1, Math.floor(maxHp * 0.8));
  return maxHp;
}
function sfSyncFromLocalState(gs){
  try{
    if(!window.SF?.setStats) return;
    window.SF.setStats({
      level: Number(gs.level ?? 1),
      xp: Number(gs.xp ?? 0),
      money: Number(gs.money ?? 0),
      cigarettes: Number(gs.cigarettes ?? 0),
      stats: gs.stats,
      equipped: gs.equipped
    }, { save: true, sync: true });
    const maxHp = sfComputeMaxHpFromStats(gs.stats);
    window.SF.setHp(maxHp, maxHp);
  }catch(e){}
}
