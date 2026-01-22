// dealer.js - Dealer systém s drogami a mini hrou

const supabaseClient = () => window.supabaseClient;
async function ensureOnline() {
  if (window.SFReady) await window.SFReady;
  const sb = supabaseClient();
  if (!sb) throw new Error('Supabase client není inicializovaný');
  return sb;
}

// ===== CONSTANTS =====
const DRUG_INVENTORY_SIZE = 8;
const WIN_CHANCE = 0.30; // 30% šance na výhru (70% prohry)

// Výherní multiplikátory s různými šancemi
const WIN_MULTIPLIERS = [
  { multiplier: 1.5, chance: 0.50, label: '1.5x' },    // 50% z výher
  { multiplier: 2.5, chance: 0.30, label: '2.5x' },    // 30% z výher
  { multiplier: 5, chance: 0.12, label: '5x' },        // 12% z výher
  { multiplier: 10, chance: 0.05, label: '10x' },      // 5% z výher
  { multiplier: 50, chance: 0.02, label: '50x' },      // 2% z výher
  { multiplier: 100, chance: 0.01, label: '100x' }     // 1% z výher (JACKPOT!)
];

// ===== DRUG DATABASE =====
const DRUGS = [
  {
    id: 'pytlicek_pervitin',
    name: 'Pytlíček Pervitinu',
    icon: 'pervitin.jpg',
    description: 'Čistý krystal pro power boost',
    price: 500,
    bonuses: {
      strength: 15,
      luck: 8,
      constitution: 12
    },
    duration: 3,
    rarity: 'rare'
  },
  {
    id: 'joint_trava',
    name: 'Joint - Tráva',
    icon: 'joint.jpg',
    description: 'Relax a boost výdrže',
    price: 200,
    bonuses: {
      constitution: 20,
      defense: 5
    },
    duration: 2,
    rarity: 'common'
  },
  {
    id: 'kokainka',
    name: 'Kokain',
    icon: 'kokain.jpg',
    description: 'Pure energy a síla',
    price: 800,
    bonuses: {
      strength: 25,
      dexterity: 15,
      intelligence: 10
    },
    duration: 4,
    rarity: 'epic'
  },
  {
    id: 'extaze',
    name: 'Extáze',
    icon: 'extaze.jpg',
    description: 'Party boost pro všechny staty',
    price: 350,
    bonuses: {
      strength: 10,
      defense: 8,
      luck: 12,
      constitution: 10
    },
    duration: 3,
    rarity: 'rare'
  },
  {
    id: 'lsd',
    name: 'LSD',
    icon: 'lsd.jpg',
    description: 'Mind expansion - inteligence boost',
    price: 600,
    bonuses: {
      intelligence: 30,
      luck: 15,
      dexterity: 10
    },
    duration: 5,
    rarity: 'epic'
  },
  {
    id: 'hrib',
    name: 'Magic Hřib',
    icon: 'hrib.jpg',
    description: 'Přírodní trip - luck boost',
    price: 150,
    bonuses: {
      luck: 20,
      intelligence: 8
    },
    duration: 2,
    rarity: 'common'
  },
  {
    id: 'heroin',
    name: 'Heroin',
    icon: 'heroin.jpg',
    description: 'Těžká droga - ultimate boost',
    price: 1200,
    bonuses: {
      strength: 30,
      constitution: 25,
      defense: 15
    },
    duration: 6,
    rarity: 'legendary'
  },
  {
    id: 'amfetamin',
    name: 'Amfetamin',
    icon: 'amfetamin.jpg',
    description: 'Speed boost - rychlost a obratnost',
    price: 450,
    bonuses: {
      dexterity: 25,
      intelligence: 12,
      luck: 10
    },
    duration: 3,
    rarity: 'rare'
  },
  {
    id: 'mdma',
    name: 'MDMA',
    icon: 'mdma.jpg',
    description: 'Pure molly - všechny staty nahoru',
    price: 550,
    bonuses: {
      strength: 15,
      defense: 12,
      dexterity: 15,
      intelligence: 15,
      luck: 15
    },
    duration: 4,
    rarity: 'epic'
  },
  {
    id: 'dmt',
    name: 'DMT',
    icon: 'dmt.jpg',
    description: 'Spirit molecule - inteligence extreme',
    price: 900,
    bonuses: {
      intelligence: 40,
      luck: 20,
      constitution: 15
    },
    duration: 5,
    rarity: 'epic'
  },
  {
    id: 'meskalin',
    name: 'Meskalin',
    icon: 'meskalin.jpg',
    description: 'Kaktusový trip - luck master',
    price: 400,
    bonuses: {
      luck: 30,
      intelligence: 15,
      defense: 8
    },
    duration: 4,
    rarity: 'rare'
  },
  {
    id: 'ketamin',
    name: 'Ketamin',
    icon: 'ketamin.jpg',
    description: 'K-hole special - obrana a výdrž',
    price: 650,
    bonuses: {
      defense: 25,
      constitution: 30,
      strength: 10
    },
    duration: 4,
    rarity: 'epic'
  }
];

// ===== GAME STATE =====
let gameState = {
  userId: null,
  level: 1,
  money: 3170,
  cigarettes: 42,
  drugInventory: [], // Array of drug instances
  stats: {}
};

let currentBetType = 'money';
let isPlaying = false;

// ===== SYNC FROM SERVER =====
async function syncFromServer() {
  if (window.SFReady) await window.SFReady;
  const stats = window.SF?.stats;
  if (!stats) return;

  gameState.level = stats.level ?? gameState.level;
  gameState.money = stats.money ?? gameState.money;
  gameState.cigarettes = stats.cigarettes ?? gameState.cigarettes;
  gameState.drugInventory = normalizeDrugInventory(stats.drug_inventory || stats.drugInventory || []);
  
  if (stats.stats) {
    gameState.stats = { ...gameState.stats, ...stats.stats };
  }

  updateUI();
}

document.addEventListener('sf:stats', async () => {
  await syncFromServer();
});

// ===== UTILITY FUNCTIONS =====
function normalizeDrugInventory(inv) {
  const arr = Array.isArray(inv) ? inv.slice(0, DRUG_INVENTORY_SIZE) : [];
  while (arr.length < DRUG_INVENTORY_SIZE) arr.push(null);
  return arr.map(x => (x === undefined ? null : x));
}

function getDrugById(drugId) {
  return DRUGS.find(d => d.id === drugId);
}

function makeDrugInstance(baseDrug) {
  const inst = JSON.parse(JSON.stringify(baseDrug));
  inst.instance_id = 'drug_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  inst.base_id = baseDrug.id;
  inst.uses_left = baseDrug.duration;
  return inst;
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
      gameState.money = data.money ?? gameState.money;
      gameState.cigarettes = data.cigarettes ?? gameState.cigarettes;
      gameState.drugInventory = normalizeDrugInventory(data.drug_inventory || data.drugInventory || []);
      gameState.stats = data.stats || {};
    }
  } catch (error) {
    console.error("Error initializing user:", error);
    showNotification("Chyba při načítání", "error");
  }
}

async function saveToSupabase() {
  try {
    const sb = await ensureOnline();

    const basePayload = {
      user_id: gameState.userId,
      money: gameState.money,
      cigarettes: gameState.cigarettes,
      drug_inventory: gameState.drugInventory
    };

    let payload = { ...basePayload };

    for (let attempts = 0; attempts < 6; attempts++) {
      const { error } = await sb.from("player_stats").upsert(payload, { onConflict: "user_id" });
      if (!error) {
        // Sync do window.SF aby shop.html viděl drogy
        if (window.SF && window.SF.stats) {
          window.SF.stats.drug_inventory = gameState.drugInventory;
          window.SF.stats.drugInventory = gameState.drugInventory;
        }
        return true;
      }

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
    console.error("Error saving to Supabase:", error);
    return false;
  }
}

// ===== UI RENDERING =====
function renderDrugs() {
  const drugsGrid = document.getElementById('drugsGrid');
  if (!drugsGrid) return;

  drugsGrid.innerHTML = DRUGS.map(drug => {
    const rarityLabel = ({
      common: 'COMMON',
      rare: 'RARE',
      epic: 'EPIC',
      legendary: 'LEGEND'
    }[drug.rarity] || 'COMMON');

    const bonusesHTML = Object.keys(drug.bonuses).map(stat => {
      const value = drug.bonuses[stat];
      const statNames = {
        strength: '⚔️ Síla',
        defense: '🛡️ Obrana',
        dexterity: '🏹 Obratnost',
        intelligence: '🧠 Inteligence',
        constitution: '💪 Výdrž',
        luck: '🍀 Štěstí'
      };
      return `<div style="color: #4af; font-weight: 900; font-size: 12px;">+${value} ${statNames[stat]}</div>`;
    }).join('');

    // Render ikony jako JPG obrázky
    const iconHTML = drug.icon.endsWith('.jpg') || drug.icon.endsWith('.png') || drug.icon.endsWith('.webp')
      ? `<img src="${drug.icon}" alt="${drug.name}">`
      : drug.icon;

    return `
      <div class="drug-card rarity-${drug.rarity}" data-drug-id="${drug.id}">
        <div class="rarity-badge rarity-${drug.rarity}">${rarityLabel}</div>
        <div class="drug-icon">${iconHTML}</div>
        <div class="drug-details">
          <h3>${drug.name}</h3>
          <p class="drug-desc">${drug.description}</p>
          <div class="drug-bonuses">${bonusesHTML}</div>
          <div class="drug-duration">⏱️ ${drug.duration} fightů</div>
          <div class="drug-price">
            <span class="price">${drug.price}🪙</span>
            <button class="buy-drug-btn" onclick="buyDrug('${drug.id}')">KOUPIT</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDrugInventory() {
  const drugInventory = document.getElementById('drugInventory');
  if (!drugInventory) return;

  drugInventory.innerHTML = '';

  // Render jen 8 slotů
  for (let i = 0; i < DRUG_INVENTORY_SIZE; i++) {
    const drugRef = (gameState.drugInventory || [])[i];
    const drug = drugRef ? getDrugById(drugRef.base_id || drugRef.id) : null;

    const slot = document.createElement('div');
    slot.className = 'drug-inv-slot' + (drug ? ' filled' : ' empty');
    slot.dataset.invIndex = i;

    if (drug && drugRef) {
      const r = drug.rarity || 'common';
      const rLabel = ({ common:'COMMON', rare:'RARE', epic:'EPIC', legendary:'LEGEND' }[r] || 'COMMON');
      slot.classList.add(`rarity-${r}`);
      slot.dataset.rarity = r;
      slot.dataset.rarityLabel = rLabel;

      // Render ikony jako JPG obrázky
      const iconHTML = drug.icon.endsWith('.jpg') || drug.icon.endsWith('.png') || drug.icon.endsWith('.webp')
        ? `<img src="${drug.icon}" alt="${drug.name}" class="drug-slot-img">`
        : `<div class="drug-slot-icon">${drug.icon}</div>`;

      slot.innerHTML = `
        ${iconHTML}
        <div class="drug-slot-name">${drug.name}</div>
        <div class="drug-slot-uses">⏱️ ${drugRef.uses_left || drug.duration}</div>
      `;

      // Tooltip
      slot.addEventListener('mouseenter', (e) => {
        showDrugTooltip(drug, drugRef, e.clientX, e.clientY);
      });

      slot.addEventListener('mousemove', (e) => {
        updateTooltipPosition(e.clientX, e.clientY);
      });

      slot.addEventListener('mouseleave', () => {
        hideTooltip();
      });
    }

    drugInventory.appendChild(slot);
  }

  const drugCount = document.getElementById('drugCount');
  if (drugCount) {
    const count = (gameState.drugInventory || []).filter(Boolean).length;
    drugCount.textContent = count;
  }
}

function updateUI() {
  const levelDisplay = document.getElementById('levelDisplay');
  if (levelDisplay) levelDisplay.textContent = gameState.level;

  const money = document.getElementById('money');
  const cigarettes = document.getElementById('cigarettes');
  if (money) money.textContent = gameState.money.toLocaleString('cs-CZ');
  if (cigarettes) cigarettes.textContent = gameState.cigarettes;

  renderDrugInventory();
}

// ===== DRUG PURCHASE =====
async function buyDrug(drugId) {
  const drug = getDrugById(drugId);
  if (!drug) {
    showNotification('Droga nenalezena!', 'error');
    return;
  }

  if (gameState.money < drug.price) {
    showNotification('Nemáš dost peněz!', 'error');
    return;
  }

  gameState.drugInventory = normalizeDrugInventory(gameState.drugInventory || []);
  const emptyIndex = gameState.drugInventory.findIndex(x => !x);
  if (emptyIndex === -1) {
    showNotification('Stash je plný!', 'error');
    return;
  }

  gameState.money -= drug.price;
  const instance = makeDrugInstance(drug);
  gameState.drugInventory[emptyIndex] = instance;

  try { window.SFPlayClick && window.SFPlayClick(); } catch {}

  const saved = await saveToSupabase();

  if (saved) {
    updateUI();
    showNotification(`${drug.name} koupeno za ${drug.price}🪙!`, 'success');
  } else {
    gameState.money += drug.price;
    gameState.drugInventory[emptyIndex] = null;
    showNotification('Chyba při ukládání!', 'error');
  }
}

// ===== MINI GAME - KULIČKA =====
function initGame() {
  const slotsContainer = document.getElementById('slotsContainer');
  if (!slotsContainer) return;

  // Vytvoř sloty pro všechny možné výhry + prohra sloty
  slotsContainer.innerHTML = '';
  
  // Přidej LOSE sloty (70% šance na prohru = více LOSE slotů)
  for (let i = 0; i < 7; i++) {
    const slot = document.createElement('div');
    slot.className = 'game-slot lose';
    slot.dataset.type = 'LOSE';
    slot.innerHTML = '<div class="slot-label">PROHRA</div><div class="slot-icon">💀</div>';
    slotsContainer.appendChild(slot);
  }
  
  // Přidej WIN sloty pro každý multiplikátor
  WIN_MULTIPLIERS.forEach(mult => {
    const slot = document.createElement('div');
    slot.className = 'game-slot win';
    slot.dataset.type = 'WIN';
    slot.dataset.multiplier = mult.multiplier;
    slot.innerHTML = `
      <div class="slot-label">VÝHRA</div>
      <div class="slot-mult" style="color: ${mult.multiplier >= 50 ? '#ffb62c' : mult.multiplier >= 10 ? '#bd50ff' : '#10b981'}">
        x${mult.label}
      </div>
    `;
    slotsContainer.appendChild(slot);
  });
  
  // Shuffle slots pro random rozložení
  const slots = Array.from(slotsContainer.children);
  slots.sort(() => Math.random() - 0.5);
  slotsContainer.innerHTML = '';
  slots.forEach(slot => slotsContainer.appendChild(slot));
}

// Helper: vyber multiplikátor podle šancí
function selectWinMultiplier() {
  const roll = Math.random();
  let cumulative = 0;
  
  for (const mult of WIN_MULTIPLIERS) {
    cumulative += mult.chance;
    if (roll <= cumulative) {
      return mult.multiplier;
    }
  }
  
  // Fallback na nejnižší
  return WIN_MULTIPLIERS[0].multiplier;
}

async function playGame() {
  if (isPlaying) return;

  const betAmount = parseInt(document.getElementById('betAmount').value);
  if (!betAmount || betAmount < 1) {
    showNotification('Zadej platnou sázku!', 'error');
    return;
  }

  if (currentBetType === 'money' && gameState.money < betAmount) {
    showNotification('Nemáš dost peněz!', 'error');
    return;
  }

  if (currentBetType === 'cigarettes' && gameState.cigarettes < betAmount) {
    showNotification('Nemáš dost cigaret!', 'error');
    return;
  }

  isPlaying = true;

  // Odeber sázku
  if (currentBetType === 'money') {
    gameState.money -= betAmount;
  } else {
    gameState.cigarettes -= betAmount;
  }

  updateUI();

  const gameResult = document.getElementById('gameResult');
  gameResult.textContent = '';
  gameResult.className = 'game-result';

  // Animace kuličky
  const ball = document.getElementById('ball');
  const slots = document.querySelectorAll('.game-slot');
  
  // Reset all slots
  slots.forEach(s => s.classList.remove('active', 'winner', 'loser'));

  // Určí výsledek (30% šance na výhru)
  const won = Math.random() < WIN_CHANCE;
  
  let targetSlot;
  let winMultiplier = 1;
  
  if (won) {
    // Vyber multiplikátor podle šancí
    winMultiplier = selectWinMultiplier();
    
    // Najdi odpovídající WIN slot
    const winSlots = Array.from(slots).filter(s => 
      s.dataset.type === 'WIN' && 
      parseFloat(s.dataset.multiplier) === winMultiplier
    );
    
    targetSlot = winSlots[Math.floor(Math.random() * winSlots.length)];
  } else {
    // Vyber random LOSE slot
    const loseSlots = Array.from(slots).filter(s => s.dataset.type === 'LOSE');
    targetSlot = loseSlots[Math.floor(Math.random() * loseSlots.length)];
  }

  // Animace - projdi všechny sloty
  let currentIndex = 0;
  const animationInterval = setInterval(() => {
    slots.forEach(s => s.classList.remove('active'));
    slots[currentIndex].classList.add('active');
    
    try { window.SFPlayClick && window.SFPlayClick(); } catch {}
    
    currentIndex = (currentIndex + 1) % slots.length;
  }, 150);

  // Zastav na cílovém slotu
  setTimeout(() => {
    clearInterval(animationInterval);
    slots.forEach(s => s.classList.remove('active'));
    targetSlot.classList.add('active');
    
    if (won) {
      targetSlot.classList.add('winner');
      const winAmount = Math.floor(betAmount * winMultiplier);
      
      if (currentBetType === 'money') {
        gameState.money += winAmount;
      } else {
        gameState.cigarettes += winAmount;
      }

      // Speciální zpráva pro vysoké výhry
      let message = `🎉 VÝHRA ${winMultiplier}x! +${winAmount}${currentBetType === 'money' ? '🪙' : '🚬'}`;
      if (winMultiplier >= 100) {
        message = `🎰 JACKPOT 100x! +${winAmount}${currentBetType === 'money' ? '🪙' : '🚬'} 🎰`;
      } else if (winMultiplier >= 50) {
        message = `💎 MEGA VÝHRA 50x! +${winAmount}${currentBetType === 'money' ? '🪙' : '🚬'}`;
      } else if (winMultiplier >= 10) {
        message = `⭐ BIG WIN ${winMultiplier}x! +${winAmount}${currentBetType === 'money' ? '🪙' : '🚬'}`;
      }
      
      gameResult.textContent = message;
      gameResult.className = 'game-result win';
      showNotification(message, 'success');
    } else {
      targetSlot.classList.add('loser');
      gameResult.textContent = `💀 PROHRA! -${betAmount}${currentBetType === 'money' ? '🪙' : '🚬'}`;
      gameResult.className = 'game-result lose';
      showNotification(`Prohrál jsi ${betAmount}${currentBetType === 'money' ? '🪙' : '🚬'}!`, 'error');
    }

    saveToSupabase();
    updateUI();
    isPlaying = false;
  }, 3000);
}

// ===== TOOLTIPS =====
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

function showDrugTooltip(drug, instance, x, y) {
  if (!tooltip) createTooltip();

  const bonusesHTML = Object.keys(drug.bonuses).map(stat => {
    const value = drug.bonuses[stat];
    const statNames = {
      strength: '⚔️ Síla',
      defense: '🛡️ Obrana',
      dexterity: '🏹 Obratnost',
      intelligence: '🧠 Inteligence',
      constitution: '💪 Výdrž',
      luck: '🍀 Štěstí'
    };
    return `<div style="color: #4af; font-weight: 900; font-size: 13px; margin: 3px 0;">${statNames[stat]}: +${value}</div>`;
  }).join('');

  tooltip.innerHTML = `
    <div style="font-size: 18px; font-weight: 900; color: #f1d27a; margin-bottom: 8px;">
      ${drug.icon} ${drug.name}
    </div>
    <div style="font-size: 12px; color: #c9a44a; margin-bottom: 8px;">
      ${drug.description}
    </div>
    <div style="font-size: 12px; color: #9bd; margin-bottom: 8px;">
      ⏱️ Zbývá: ${instance.uses_left || drug.duration} použití
    </div>
    <div style="margin-top: 10px; padding-top: 10px; border-top: 2px solid rgba(201,164,74,0.3);">
      ${bonusesHTML}
    </div>
  `;

  tooltip.style.display = 'block';
  tooltip.style.left = (x + 20) + 'px';
  tooltip.style.top = (y - tooltip.offsetHeight / 2) + 'px';
}

function updateTooltipPosition(x, y) {
  if (tooltip && tooltip.style.display === 'block') {
    tooltip.style.left = (x + 20) + 'px';
    tooltip.style.top = (y - tooltip.offsetHeight / 2) + 'px';
  }
}

function hideTooltip() {
  if (tooltip) {
    tooltip.style.display = 'none';
  }
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
  console.log('🚀 Initializing dealer...');

  showNotification('Načítání dealera...', 'success');

  await initUser();

  renderDrugs();
  renderDrugInventory();
  updateUI();
  initGame();

  // Setup bet type buttons
  document.querySelectorAll('.bet-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bet-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBetType = btn.dataset.type;
    });
  });

  // Setup quick bet buttons
  document.querySelectorAll('.quick-bet').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('betAmount').value = btn.dataset.amount;
    });
  });

  // Setup play button
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.addEventListener('click', playGame);
  }

  showNotification('Dealer načten!', 'success');

  console.log('✅ Dealer initialized!', gameState);
});

// ===== AUTO-SAVE =====
setInterval(async () => {
  await saveToSupabase();
  console.log('💾 Auto-save completed');
}, 30000);

// ===== EXPOSE FOR HTML =====
window.buyDrug = buyDrug;

console.log('✅ Dealer system loaded!');