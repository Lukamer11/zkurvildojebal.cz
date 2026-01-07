import { GameState } from "./core/gameState.js";
import { getSupabase } from "./core/supabaseClient.js";
// ===== SUPABASE SETUP =====
const SUPABASE_URL = 'https://bmmaijlbpwgzhrxzxphf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbWFpamxicHdnemhyeHp4cGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NjQ5MDcsImV4cCI6MjA4MjQ0MDkwN30.s0YQVnAjMXFu1pSI1NXZ2naSab179N0vQPglsmy3Pgw';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ===== GRIND TUNING =====
const STAT_UPGRADE_GAIN = 0.25;      // + přidá jen málo
const UPGRADE_COST_MULT = 1.35;      // cena roste rychleji
const UPGRADE_COST_ADD  = 15;        // a ještě přičítá

// ===== TŘÍDY (balanc) =====
function getPlayerClass(){
  return (localStorage.getItem('sf_class') || localStorage.getItem(`sf_class_${localStorage.getItem('slavFantasyUserId')||''}`) || 'padouch').toLowerCase();
}

function getUpgradeGain(stat){
  const cls = getPlayerClass();
  // padouch = vyváženě
  if (cls === 'padouch') return 0.25;
  // rváč = hodně HP (constitution) ale menší síla
  if (cls === 'rvac') {
    if (stat === 'constitution') return 0.35;
    if (stat === 'strength') return 0.20;
    return 0.25;
  }
  // mozek = velká síla (a inteligence), málo výdrže
  if (cls === 'mozek') {
    if (stat === 'strength' || stat === 'intelligence') return 0.35;
    if (stat === 'constitution') return 0.20;
    return 0.25;
  }
  return 0.25;
}

// ===== TOOLTIP SYSTEM (STEJNÉ JAKO V SHOPU) =====
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

function getCritChanceFromDexAndLevel(totalDex, level){
  const base = Math.floor(totalDex * 0.5);         // jako dřív
  const penalty = Math.floor((level - 1) * 0.35);  // čím vyšší level, tím větší mínus
  return Math.max(1, base - penalty);              // nikdy pod 1%
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
      bonusesHTML += `<div style="color:${color}; font-weight:900; font-size:13px; margin:3px 0;">${statNames[stat] || stat}: ${sign}${value}</div>`;
    });
    bonusesHTML += '</div>';
  }

  tooltip.innerHTML = `
    <div style="font-size:18px; font-weight:900; color:#f1d27a; margin-bottom:8px; text-shadow:0 2px 4px rgba(0,0,0,0.8);">
      ${item.icon || ''} ${item.name || 'Item'}
    </div>
    <div style="font-size:12px; color:#c9a44a; margin-bottom:8px; line-height:1.4;">
      ${item.description || ''}
    </div>
    ${typeof item.price === 'number' ? `
      <div style="font-size:16px; font-weight:900; color:#f1d27a; text-shadow:0 2px 4px rgba(0,0,0,0.8);">
        💰 ${item.price}₽
      </div>
    ` : ''}
    ${bonusesHTML}
  `;

  tooltip.style.display = 'block';
  tooltip.style.left = (x + 20) + 'px';
  tooltip.style.top  = (y - tooltip.offsetHeight / 2) + 'px';
}

function hideTooltip() {
  if (tooltip) tooltip.style.display = 'none';
}


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
  upgradeCosts: {
    strength: 100,
    defense: 100,
    dexterity: 100,
    intelligence: 100,
    constitution: 100,
    luck: 100
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
  }
};

// ===== UTILITY FUNCTIONS =====
function getRequiredXP(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function getAllItems() {
  if (!window.SHOP_ITEMS) return [];
  return [
    ...window.SHOP_ITEMS.weapons,
    ...window.SHOP_ITEMS.armor,
    ...window.SHOP_ITEMS.special
  ];
}

function getItemById(itemId) {
  return getAllItems().find(item => item.id === itemId);
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

// ===== STAT BONUSES =====
function calculateStatBonus(stat, value) {
  switch(stat) {
    case 'strength':
      return `+${value * 2} DMG`;
    case 'defense':
      const defPercent = Math.min(Math.floor((value / 28) * 100), 100);
      return `${defPercent}% Redukce`;
    case 'dexterity': {
  const crit = getCritChanceFromDexAndLevel(value, gameState.level);
  return `+${crit}% Crit (lvl penalizace)`;
}
    case 'intelligence':
      return `+${Math.floor(value * 1.5)}% Magie`;
    case 'constitution':
      const hp = 500 + (value * 25);
      return `${hp} HP`;
    case 'luck':
      const luckPercent = Math.min(value, 100);
      return `${luckPercent}% / 100%`;
    default:
      return '';
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
    const item = (typeof itemId === 'object') ? itemId : getItemById(itemId);

    if (!item || !item.bonuses) return;
    
    Object.keys(item.bonuses).forEach(stat => {
      bonuses[stat] += item.bonuses[stat];
    });
  });
  
  return bonuses;
}

// ===== SUPABASE FUNCTIONS =====
async function initUser() {
  try {
    console.log('🔄 Inicializuji uživatele...');
    
    // User ID: primárně Supabase auth user_id (aby seděly staty napříč stránkami)
    // fallback: starý slavFantasyUserId (legacy) / generovaný offline id
    let userId = localStorage.getItem('user_id') || localStorage.getItem('slavFantasyUserId');
    
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('slavFantasyUserId', userId);
      console.log('✨ Vytvořen nový offline user ID:', userId);
    } else {
      console.log('✅ User ID nalezen:', userId);
      // držíme kompatibilitu – ať to vidí i starší části hry
      localStorage.setItem('slavFantasyUserId', userId);
    }
    
    gameState.userId = userId;
    
    // Try to load from Supabase
    console.log('📥 Načítám data ze Supabase...');
    const { data, error } = await supabaseClient
      .from('player_stats')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error loading from Supabase:', error);
      throw error;
    }
    
    if (data) {
      console.log('✅ Data načtena ze Supabase:', data);
      
      // Load from Supabase
	      // Pozor: některé sloupce můžou být v DB NULL (hlavně u starších záznamů).
	      // Když přepíšeme defaulty null hodnotou, rozbije to UI (Object.keys na null).
	      gameState.level = (data.level ?? gameState.level);
	      gameState.xp = (data.xp ?? gameState.xp);
	      gameState.money = (data.money ?? gameState.money);
	      gameState.cigarettes = (data.cigarettes ?? gameState.cigarettes);
	      gameState.stats = (data.stats && typeof data.stats === 'object') ? data.stats : gameState.stats;
      gameState.upgradeCosts = data.upgrade_costs || gameState.upgradeCosts;
      gameState.inventory = data.inventory || [];
      gameState.equipped = data.equipped || gameState.equipped;
      
      console.log('🎮 Equipped items:', gameState.equipped);
      console.log('🎒 Inventory:', gameState.inventory);
    } else {
      console.log('🆕 Nový uživatel - ukládám výchozí data');
      await saveToSupabase();
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error initializing user:', error);
    showNotification('Chyba při načítání hry', 'error');
    return false;
  }
}

async function saveToSupabase() {
  // Robustní uložení: když v DB chybí některý sloupec, odstraníme ho z payloadu a zkusíme znovu.
  try {
    console.log('💾 Ukládám do Supabase...');

    const basePayload = {
      user_id: gameState.userId,
      level: gameState.level,
      xp: gameState.xp,
      money: gameState.money,
      cigarettes: gameState.cigarettes,
      stats: gameState.stats,
      upgrade_costs: gameState.upgradeCosts,
      inventory: gameState.inventory,
      equipped: gameState.equipped,
      updated_at: new Date().toISOString()
    };

    let payload = { ...basePayload };
    for (let attempts = 0; attempts < 6; attempts++) {
      const { error } = await supabaseClient
        .from('player_stats')
        .upsert(payload, { onConflict: 'user_id' });

      if (!error) {
        console.log('✅ Saved to Supabase successfully');
        return true;
      }

      const msg = String(error?.message || '');
      const m = msg.match(/Could not find the '([^']+)' column/);
      if (error?.code === 'PGRST204' && m) {
        const missing = m[1];
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
    console.error('❌ Error saving to Supabase:', error);
    return false;
  }
}

// ===== RENDER EQUIPPED ITEMS =====
function renderEquippedItems() {
  console.log('🎨 Renderuji equipnuté itemy...');
  
  Object.keys(gameState.equipped).forEach(slotName => {
    const itemId = gameState.equipped[slotName];
    const slotElement = document.querySelector(`[data-slot="${slotName}"]`);
    
    if (!slotElement) {
      console.warn(`⚠️ Slot element nenalezen: ${slotName}`);
      return;
    }
    
    if (itemId) {
      const item = getItemById(itemId);
      if (!item) {
        console.warn(`⚠️ Item nenalezen: ${itemId}`);
        return;
      }
      
      console.log(`✅ Renderuji item ${item.name} do slotu ${slotName}`);
      
      slotElement.classList.add('has-item');
      
      if (item.icon && item.icon.endsWith('.jpg')) {
        slotElement.innerHTML = `<img src="${item.icon}" alt="${item.name}" class="slot-item" draggable="true" data-item-id="${itemId}" data-from-slot="${slotName}">`;
      } else {
        slotElement.innerHTML = `<span class="slot-item" draggable="true" data-item-id="${itemId}" data-from-slot="${slotName}">${item.icon}</span>`;
      }
      
      // Tooltip (stejný systém jako v shopu)
slotElement.onmouseenter = (e) => showTooltip(item, e.clientX, e.clientY);
slotElement.onmousemove = (e) => {
  if (tooltip && tooltip.style.display === 'block') {
    tooltip.style.left = (e.clientX + 20) + 'px';
    tooltip.style.top = (e.clientY - tooltip.offsetHeight / 2) + 'px';
  }
};
slotElement.onmouseleave = () => hideTooltip();

      
      // Add drag events
      const itemElement = slotElement.querySelector('.slot-item');
      if (itemElement) {
        itemElement.addEventListener('dragstart', handleEquippedDragStart);
        itemElement.addEventListener('dragend', handleDragEnd);
      }
    } else {
      slotElement.classList.remove('has-item');
      slotElement.innerHTML = `<span class="slot-emoji">${getSlotEmoji(slotName)}</span>`;
      slotElement.title = `Prázdný slot: ${slotName}`;
      slotElement.onmouseenter = null;
	slotElement.onmousemove = null;
	slotElement.onmouseleave = null;

    }
  });
  
  console.log('✅ Renderování equipnutých itemů dokončeno');
}

// ===== UPDATE UI =====
function updateUI() {
  console.log('🔄 Aktualizuji UI...');
  
  // Update level
  const levelDisplay = document.getElementById('levelDisplay');
  const levelChar = document.getElementById('levelChar');
  if (levelDisplay) levelDisplay.textContent = gameState.level;
  if (levelChar) levelChar.textContent = `Level ${gameState.level}`;
  
  // Update money and cigarettes
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
  
  // Calculate bonuses from equipment
  const bonuses = calculateTotalBonuses();
  console.log('💪 Bonusy ze zbraní:', bonuses);
  
  // Update all stats
	  if (!gameState.stats || typeof gameState.stats !== 'object') {
	    console.warn('⚠️ gameState.stats je prázdné nebo neplatné – obnovuji defaulty');
	    gameState.stats = {
	      strength: 18,
	      defense: 14,
	      dexterity: 11,
	      intelligence: 11,
	      constitution: 16,
	      luck: 9
	    };
	  }
	  Object.keys(gameState.stats).forEach(stat => {
    const baseValue = gameState.stats[stat];
    const bonus = bonuses[stat] || 0;
    const totalValue = baseValue + bonus;
    const cost = gameState.upgradeCosts[stat];
    
    const valueElement = document.getElementById(`${stat}Value`);
    const extraElement = document.getElementById(`${stat}Extra`);
    const costElement = document.getElementById(`${stat}Cost`);
    
    if (valueElement) {
      // Show base value + bonus if there is equipment bonus
      if (bonus !== 0) {
        valueElement.innerHTML = `${baseValue} <span style="color: #4af; font-size: 14px;">+${bonus}</span>`;
      } else {
        valueElement.textContent = baseValue;
      }
    }
    
    if (extraElement) {
      // Calculate bonus with total value (base + equipment)
      extraElement.textContent = calculateStatBonus(stat, totalValue);
    }
    
    if (costElement) {
      costElement.textContent = `${cost}₽`;
    }
  });
  
  // Render equipped items
  renderEquippedItems();
  
  console.log('✅ UI aktualizováno');
}

// ===== UPGRADE STAT (BEZ XP!) =====
async function upgradeStat(stat) {
  const cost = gameState.upgradeCosts[stat];
  
  if (gameState.money >= cost) {
    // Deduct money
    gameState.money -= cost;
    
    gameState.stats[stat] = +(gameState.stats[stat] + getUpgradeGain(stat)).toFixed(2);

// cena: rychleji + přičtení + lehká penalizace dle levelu
gameState.upgradeCosts[stat] = Math.floor((cost * UPGRADE_COST_MULT) + UPGRADE_COST_ADD + (gameState.level * 5));

    
    // Increase upgrade cost (exponential: +20%)
    gameState.upgradeCosts[stat] = Math.floor(cost * 1.2);
    
    // Update UI
    updateUI();
    
    // Save to Supabase
    await saveToSupabase();
    
    // Show notification
    const statName = {
      strength: 'SÍLA',
      defense: 'OBRANA',
      dexterity: 'OBRATNOST',
      intelligence: 'INTELIGENCE',
      constitution: 'VÝDRŽ',
      luck: 'ŠTĚSTÍ'
    };
    
    showNotification(`${statName[stat]} zvýšena! -${cost}₽`, 'success');
  } else {
    showNotification('Nemáš dost peněz!', 'error');
  }
}

// ===== ADD XP & LEVEL UP =====
function addXP(amount) {
  gameState.xp += amount;
  
  const requiredXP = getRequiredXP(gameState.level);
  
  if (gameState.xp >= requiredXP) {
    // Level up!
    gameState.xp -= requiredXP;
    gameState.level++;
    
    // Bonus rewards
    const moneyReward = gameState.level * 100;
    const cigaretteReward = Math.floor(gameState.level / 2);
    
    gameState.money += moneyReward;
    gameState.cigarettes += cigareetteReward;
    
    showNotification(
      `🎉 LEVEL UP! Level ${gameState.level}! +${moneyReward}₽ +${cigareetteReward}🚬`,
      'success'
    );
    
    // Check for multiple level ups
    if (gameState.xp >= getRequiredXP(gameState.level)) {
      addXP(0);
    }
  }
}

// ===== DRAG & DROP =====
let draggedItem = null;
let dragSource = null;

function handleEquippedDragStart(e) {
  draggedItem = {
    itemId: e.target.dataset.itemId,
    fromSlot: e.target.dataset.fromSlot
  };
  dragSource = 'equipped';
  e.target.classList.add('dragging');
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
  
  if (!draggedItem || dragSource !== 'equipped') return;
  
  const targetSlot = e.currentTarget.dataset.slot;
  const item = getItemById(draggedItem.itemId);
  
  if (!item) return;
  
  // Check if item can be equipped in this slot
  if (item.slot !== targetSlot) {
    showNotification(`${item.name} nelze přesunout do slotu ${targetSlot}!`, 'error');
    return;
  }
  
  // Swap items
  const temp = gameState.equipped[targetSlot];
  gameState.equipped[targetSlot] = draggedItem.itemId;
  gameState.equipped[draggedItem.fromSlot] = temp;
  
  showNotification(`Položky přesunuty!`, 'success');
  
  // Save and update
  await saveToSupabase();
  updateUI();
  
  draggedItem = null;
  dragSource = null;
}

// Unequip item (double-click)
async function unequipItem(slotName) {
  const itemId = gameState.equipped[slotName];
  if (!itemId) return;
  
  if (gameState.inventory.length >= 24) {
    showNotification('Inventář je plný!', 'error');
    return;
  }
  
  const item = getItemById(itemId);
  gameState.equipped[slotName] = null;
  gameState.inventory.push(itemId);
  
  await saveToSupabase();
  updateUI();
  
  showNotification(`${item.name} odebrán z výbavy`, 'success');
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

// ===== MENU INTERACTIONS =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll(".sf-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sf-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
});

// ===== TEST: ADD MONEY + XP =====
document.addEventListener('DOMContentLoaded', () => {
  const menuTop = document.querySelector('.menu-top');
  if (menuTop) {
    menuTop.addEventListener('click', function(e) {
      // Only trigger if clicking the ::after pseudo-element area (top-right corner)
      const rect = this.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      // Check if click is in top-right corner (where the + button is)
      if (clickX > rect.width - 40 && clickY < 40) {
        gameState.money += 1000;
        addXP(50);
        showNotification('+1000₽ +50 XP přidáno!', 'success');
        updateUI();
        saveToSupabase();
      }
    });
  }
});

// ===== AUTO-SAVE =====
setInterval(async () => {
  if (gameState.userId) {
    await saveToSupabase();
    console.log('💾 Auto-save completed');
  }
}, 30000);

// ===== INITIALIZE ON PAGE LOAD =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Spouštím inicializaci...');
  
  // Check if SHOP_ITEMS is loaded
  if (!window.SHOP_ITEMS) {
    console.warn('⚠️ SHOP_ITEMS not loaded - equipment icons will not show');
  } else {
    console.log('✅ SHOP_ITEMS loaded:', Object.keys(window.SHOP_ITEMS));
  }
  
  // Show loading
  showNotification('Načítání hry...', 'success');
  
  // Initialize user and load data
  const success = await initUser();
  
  if (!success) {
    showNotification('Chyba při načítání!', 'error');
    return;
  }
  
  // Update UI
  updateUI();

  // Ikona třídy do pravého horního rohu hlavního avatara
  renderClassBadgeOnMainAvatar();
  
  // Setup drop zones for equipment slots
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
  
  showNotification('Hra načtena!', 'success');
  
  console.log('✅ Inicializace dokončena!');
  console.log('📊 Game State:', gameState);
});

function renderClassBadgeOnMainAvatar(){
  try {
    const meta = {
      padouch: { icon: '👻', label: 'Padouch' },
      rvac: { icon: '✊', label: 'Rváč' },
      mozek: { icon: '💡', label: 'Mozek' }
    };
    const cls = (window.SF?.getPlayerClass ? window.SF.getPlayerClass() : (localStorage.getItem('sf_class') || 'padouch')).toLowerCase();
    const m = meta[cls] || meta.padouch;
    const char = document.querySelector('.character');
    if (!char) return;
    let badge = char.querySelector('.class-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'class-badge';
      char.appendChild(badge);
    }
    badge.textContent = m.icon;
    badge.title = m.label;
  } catch {}
}

// ===== EXPOSE FOR HTML ONCLICK =====
window.upgradeStat = upgradeStat;
window.addXP = addXP;
window.gameState = gameState; // Pro debug
window.getItemById = getItemById; // Pro debug

console.log('✅ Postava system loaded with equipment support!');
const sb = getSupabase();

GameState.subscribe(stats=>{ console.log('Stats sync',stats); });
