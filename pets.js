// pets.js - Gopnik Pets System

const supabaseClient = () => window.supabaseClient;
async function ensureOnline() {
  if (window.SFReady) await window.SFReady;
  const sb = supabaseClient();
  if (!sb) throw new Error('Supabase client není inicializovaný (načti menu.js před tímto skriptem)');
  return sb;
}

// ===== CONSTANTS =====
const MAX_PET_LEVEL = 50;
const MAX_BONUS_PERCENT = 15;

// ===== PETS DATA =====
const PETS = [
  {
    id: 'medved',
    name: 'MEDVĚD BORIS',
    icon: '🐻',
    avatar: 'pet1.jpg',
    stat: 'strength',
    baseCost: 5000,
    baseCostCig: 0,
    upgradeBaseCost: 500,
    description: 'Silný jako ruský tank'
  },
  {
    id: 'vlk',
    name: 'VLK VLADIMIR',
    icon: '🐺',
    avatar: 'pet2.jpg',
    stat: 'defense',
    baseCost: 6000,
    baseCostCig: 10,
    upgradeBaseCost: 600,
    description: 'Chrání tě jako Kreml'
  },
  {
    id: 'kocka',
    name: 'KOČKA NATAŠA',
    icon: '🐱',
    avatar: 'pet3.jpg',
    stat: 'luck',
    baseCost: 4500,
    baseCostCig: 5,
    upgradeBaseCost: 450,
    description: 'Rychlá jako vodka do hlavy'
  },
  {
    id: 'sova',
    name: 'SOVA DMITRIJ',
    icon: '🦉',
    avatar: 'pet4.jpg',
    stat: 'luck',
    baseCost: 7000,
    baseCostCig: 15,
    upgradeBaseCost: 700,
    description: 'Moudrý jako starý gopník'
  },
  {
    id: 'kun',
    name: 'KŮŇ IVAN',
    icon: '🐴',
    avatar: 'pet5.jpg',
    stat: 'constitution',
    baseCost: 5500,
    baseCostCig: 8,
    upgradeBaseCost: 550,
    description: 'Vydrží víc než Lada'
  },
  {
    id: 'zajic',
    name: 'ZAJÍC SERGEJ',
    icon: '🐰',
    avatar: 'pet6.jpg',
    stat: 'luck',
    baseCost: 8000,
    baseCostCig: 20,
    upgradeBaseCost: 800,
    description: 'Štěstí jako v ruletu'
  },
  {
    id: 'pes',
    name: 'PES ALEKSEJ',
    icon: '🐕',
    avatar: 'pet7.jpg',
    stat: 'strength',
    baseCost: 4000,
    baseCostCig: 0,
    upgradeBaseCost: 400,
    description: 'Věrný jak AK-47'
  },
  {
    id: 'liska',
    name: 'LIŠKA KATARINA',
    icon: '🦊',
    avatar: 'pet8.jpg',
    stat: 'luck',
    baseCost: 6500,
    baseCostCig: 12,
    upgradeBaseCost: 650,
    description: 'Lstivá jako mafie'
  },
  {
    id: 'orel',
    name: 'OREL PAVEL',
    icon: '🦅',
    avatar: 'pet9.jpg',
    stat: 'luck',
    baseCost: 9000,
    baseCostCig: 25,
    upgradeBaseCost: 900,
    description: 'Vidí všechno jako KGB'
  },
  {
    id: 'zirafa',
    name: 'ŽIRAFA YURI',
    icon: '🦒',
    avatar: 'pet10.jpg',
    stat: 'constitution',
    baseCost: 10000,
    baseCostCig: 30,
    upgradeBaseCost: 1000,
    description: 'Vysoký jako paneláky'
  }
];

// ===== GAME STATE =====
let gameState = {
  userId: null,
  money: 3170,
  cigarettes: 42,
  level: 1,
  xp: 0,
  pets: {} // { petId: { level: 1 } }
};

// ===== UTILITY FUNCTIONS =====
function fmtInt(n) {
  return Number(n ?? 0).toLocaleString("cs-CZ");
}

function calculatePetBonus(petLevel) {
  // Linear scaling: level 1 = 0.3%, level 50 = 15%
  const bonusPercent = (petLevel / MAX_PET_LEVEL) * MAX_BONUS_PERCENT;
  return Math.round(bonusPercent * 10) / 10; // Round to 1 decimal
}

function calculateUpgradeCost(pet, currentLevel) {
  // Exponential cost scaling: baseCost * (1.15 ^ level)
  return Math.floor(pet.upgradeBaseCost * Math.pow(1.15, currentLevel));
}

function getStatName(stat) {
  const names = {
    strength: '⚔️ Síla',
    defense: '🛡️ Obrana',

    constitution: '💪 Výdrž',
    luck: '🍀 Štěstí'
  };
  return names[stat] || stat;
}

function calculateTotalBonuses() {
  const bonuses = {
    strength: 0,
    defense: 0,
    constitution: 0,
    luck: 0
  };

  PETS.forEach(pet => {
    const petData = gameState.pets[pet.id];
    if (petData && petData.level > 0) {
      const bonus = calculatePetBonus(petData.level);
      bonuses[pet.stat] += bonus;
    }
  });

  return bonuses;
}

// ===== SUPABASE FUNCTIONS =====
async function initUser() {
  try {
    await ensureOnline();
    const row = window.SF?.stats;
    if (!row?.user_id) {
      location.href = "login.html";
      return;
    }

    gameState.userId = row.user_id;
    gameState.level = row.level || 1;
    gameState.xp = row.xp || 0;
    gameState.money = row.money ?? gameState.money;
    gameState.cigarettes = row.cigarettes ?? gameState.cigarettes;
    // Mazlíčky ukládáme do JSON pole "stats" (kvůli kompatibilitě DB) –
    // tím pádem se to po reloadu neztratí a zároveň to nelítá na 400 kvůli neznámému sloupci.
    gameState.pets = (row.stats && row.stats.pets) ? row.stats.pets : {};

    updateUI();
    renderPets();
  } catch (error) {
    console.error("Error initializing user:", error);
  }
}

async function saveToSupabase() {
  try {
    // Preferuj globální sync z menu.js (stejný jako shop/postava)
    if (window.SFReady) await window.SFReady;
    if (window.SF?.updateStats) {
      window.SF.updateStats({
        level: gameState.level,
        xp: gameState.xp,
        money: gameState.money,
        cigarettes: gameState.cigarettes,
        // Uložíme do stats.pets + uložíme i vypočtené bonusy (pro ostatní stránky)
        stats: {
          pets: gameState.pets,
          pet_bonuses: calculateTotalBonuses()
        }
      });
      return true;
    }

    // Fallback: přímý upsert (kdyby menu.js nebylo dostupné)
    const sb = await ensureOnline();

    const basePayload = {
      user_id: gameState.userId,
      level: gameState.level,
      xp: gameState.xp,
      money: gameState.money,
      cigarettes: gameState.cigarettes,
      stats: {
        ...(window.SF?.stats?.stats || {}),
        pets: gameState.pets,
        pet_bonuses: calculateTotalBonuses()
      }
    };

    let payload = { ...basePayload };

    for (let attempts = 0; attempts < 6; attempts++) {
      const { error } = await sb.from("player_stats").upsert(payload, { onConflict: "user_id" });
      if (!error) return true;

      // Když je problém "unknown column", zkus ho zahodit a uložit znovu
      const msg = (error?.message || "").toLowerCase();
      const match = msg.match(/could not find the '(.*?)' column/i) || msg.match(/column "(.*?)" does not exist/i);
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

// ===== RENDER FUNCTIONS =====
function renderPets() {
  const container = document.getElementById('petsContainer');
  if (!container) return;

  container.innerHTML = '';

  PETS.forEach(pet => {
    const petData = gameState.pets[pet.id] || { level: 0 };
    const isOwned = petData.level > 0;
    const isMaxLevel = petData.level >= MAX_PET_LEVEL;
    const currentBonus = calculatePetBonus(petData.level);
    const upgradeCost = calculateUpgradeCost(pet, petData.level);

    const card = document.createElement('div');
    card.className = `pet-card ${isOwned ? 'owned' : 'locked'}`;

    let buttonHTML = '';
    if (!isOwned) {
      // Buy button
      const canBuy = gameState.money >= pet.baseCost && gameState.cigarettes >= pet.baseCostCig;
      buttonHTML = `
        <button class="pet-buy-btn ${canBuy ? '' : 'disabled'}" data-pet-id="${pet.id}">
          KOUPIT: ${fmtInt(pet.baseCost)}🪙${pet.baseCostCig > 0 ? ` + ${pet.baseCostCig}🚬` : ''}
        </button>
      `;
    } else if (isMaxLevel) {
      buttonHTML = `
        <div class="pet-max-level">
          ⭐ MAX LEVEL ⭐
        </div>
      `;
    } else {
      // Upgrade button
      const canUpgrade = gameState.money >= upgradeCost;
      buttonHTML = `
        <button class="pet-upgrade-btn ${canUpgrade ? '' : 'disabled'}" data-pet-id="${pet.id}">
          UPGRADE: ${fmtInt(upgradeCost)}🪙
        </button>
      `;
    }

    card.innerHTML = `
      <div class="pet-icon">${pet.icon} ${pet.id.toUpperCase()}</div>
      <div class="pet-avatar">
        <img src="${pet.avatar}" alt="${pet.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22280%22 height=%22200%22%3E%3Crect width=%22280%22 height=%22200%22 fill=%22%23333%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22white%22 font-size=%2240%22 text-anchor=%22middle%22 dy=%22.35em%22%3E${pet.icon}%3C/text%3E%3C/svg%3E'">
      </div>
      <div class="pet-name">${pet.name}</div>
      <div class="pet-stat">
        <span>Atribut:</span>
        <b>${getStatName(pet.stat)}</b>
      </div>
      <div class="pet-level">
        Level: ${petData.level} / ${MAX_PET_LEVEL}
      </div>
      ${isOwned ? `
        <div class="pet-bonus">
          +${currentBonus.toFixed(1)}% ${getStatName(pet.stat)}
        </div>
      ` : `
        <div class="pet-stat">
          <span style="font-size: 11px; color: #888;">${pet.description}</span>
        </div>
      `}
      ${buttonHTML}
    `;

    container.appendChild(card);
  });

  // Add event listeners
  document.querySelectorAll('.pet-buy-btn').forEach(btn => {
    btn.addEventListener('click', () => buyPet(btn.dataset.petId));
  });

  document.querySelectorAll('.pet-upgrade-btn').forEach(btn => {
    btn.addEventListener('click', () => upgradePet(btn.dataset.petId));
  });
}

function updateUI() {
  // Update currency displays
  const money = document.getElementById('money');
  const cigarettes = document.getElementById('cigarettes');
  if (money) money.textContent = fmtInt(gameState.money);
  if (cigarettes) cigarettes.textContent = gameState.cigarettes;

  // Update level and XP
  const levelDisplay = document.getElementById('levelDisplay');
  if (levelDisplay) levelDisplay.textContent = gameState.level;

  const requiredXP = Math.floor(100 * Math.pow(1.5, gameState.level - 1));
  const xpPercent = (gameState.xp / requiredXP) * 100;
  const xpFill = document.getElementById('xpFill');
  const xpText = document.getElementById('xpText');
  if (xpFill) xpFill.style.width = `${xpPercent}%`;
  if (xpText) xpText.textContent = `${gameState.xp} / ${requiredXP}`;

  // Update stat bonuses
  const bonuses = calculateTotalBonuses();
  Object.keys(bonuses).forEach(stat => {
    const el = document.getElementById(`${stat}Bonus`);
    if (el) {
      const bonus = bonuses[stat];
      el.textContent = bonus > 0 ? `+${bonus.toFixed(1)}%` : '+0%';
    }
  });
}

// ===== PET ACTIONS =====
async function buyPet(petId) {
  const pet = PETS.find(p => p.id === petId);
  if (!pet) return;

  if (gameState.money < pet.baseCost) {
    showNotification('Nemáš dost grošů!', 'error');
    return;
  }

  if (gameState.cigarettes < pet.baseCostCig) {
    showNotification('Nemáš dost cigaret!', 'error');
    return;
  }

  // Buy pet
  gameState.money -= pet.baseCost;
  gameState.cigarettes -= pet.baseCostCig;
  gameState.pets[petId] = { level: 1 };

  const saved = await saveToSupabase();

  if (saved) {
    updateUI();
    renderPets();
    showNotification(`${pet.icon} ${pet.name} koupeno!`, 'success');
    try { window.SFPlayClick && window.SFPlayClick(); } catch {}
  } else {
    // Rollback
    gameState.money += pet.baseCost;
    gameState.cigarettes += pet.baseCostCig;
    delete gameState.pets[petId];
    showNotification('Chyba při ukládání!', 'error');
  }
}

async function upgradePet(petId) {
  const pet = PETS.find(p => p.id === petId);
  if (!pet) return;

  const petData = gameState.pets[petId];
  if (!petData || petData.level >= MAX_PET_LEVEL) return;

  const upgradeCost = calculateUpgradeCost(pet, petData.level);

  if (gameState.money < upgradeCost) {
    showNotification('Nemáš dost grošů na upgrade!', 'error');
    return;
  }

  // Upgrade pet
  gameState.money -= upgradeCost;
  petData.level += 1;

  const saved = await saveToSupabase();

  if (saved) {
    updateUI();
    renderPets();
    const newBonus = calculatePetBonus(petData.level);
    showNotification(`${pet.icon} ${pet.name} upgradnuto na level ${petData.level}! (+${newBonus.toFixed(1)}%)`, 'success');
    try { window.SFPlayClick && window.SFPlayClick(); } catch {}
  } else {
    // Rollback
    gameState.money += upgradeCost;
    petData.level -= 1;
    showNotification('Chyba při ukládání!', 'error');
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
  console.log('🐾 Initializing pets...');
  await initUser();
  console.log('✅ Pets initialized!', gameState);
});

// ===== AUTO-SAVE =====
setInterval(async () => {
  await saveToSupabase();
  console.log('💾 Auto-save completed');
}, 30000);

console.log('✅ Pets system loaded!');