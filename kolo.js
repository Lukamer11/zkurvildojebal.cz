// kolo.js - Wheel of Fortune System + Mini Games

const supabaseClient = () => window.supabaseClient;
async function ensureOnline() {
  if (window.SFReady) await window.SFReady;
  const sb = supabaseClient();
  if (!sb) throw new Error('Supabase client není inicializován');
  return sb;
}

// ===== CONSTANTS =====
const SPIN_COST = 10;
const UPGRADE_COST = 50;
const MAX_SLICES = 11;
const MIN_SLICES = 6;

// Prize pool - 11 možných výher
const PRIZES = [
  { id: 1, type: 'money', amount: 500, label: '500₽', color: '#f1d27a', icon: '💰' },
  { id: 2, type: 'cigs', amount: 20, label: '20🚬', color: '#ff6b6b', icon: '🚬' },
  { id: 3, type: 'money', amount: 1000, label: '1000₽', color: '#4af', icon: '💎' },
  { id: 4, type: 'cigs', amount: 5, label: '5🚬', color: '#ff9f43', icon: '🚬' },
  { id: 5, type: 'money', amount: 2000, label: '2000₽', color: '#10b981', icon: '💵' },
  { id: 6, type: 'nothing', amount: 0, label: 'ZTRÁTA', color: '#555', icon: '💀' },
  { id: 7, type: 'money', amount: 300, label: '300₽', color: '#c9a44a', icon: '💰' },
  { id: 8, type: 'cigs', amount: 15, label: '15🚬', color: '#ff6b6b', icon: '🚬' },
  { id: 9, type: 'money', amount: 5000, label: '5000₽', color: '#f1d27a', icon: '🏆' },
  { id: 10, type: 'cigs', amount: 30, label: '30🚬', color: '#ff9f43', icon: '📦' },
  { id: 11, type: 'jackpot', amount: 10000, label: 'JACKPOT!', color: '#ff00ff', icon: '🎰' }
];

// ===== GAME STATE =====
let gameState = {
  userId: null,
  money: 3170,
  cigarettes: 42,
  level: 1,
  xp: 0,
  wheelData: {
    unlockedSlices: 6,
    totalSpins: 0,
    totalMoneyWon: 0,
    totalCigsWon: 0,
    biggestWin: 0,
    lastFreeSpin: null,
    history: []
  },
  coinFlipData: {
    totalGames: 0,
    wins: 0,
    losses: 0,
    profit: 0,
    history: []
  },
  crashData: {
    totalGames: 0,
    highestMulti: 0,
    profit: 0,
    history: []
  },
  diceData: {
    totalGames: 0,
    wins: 0,
    profit: 0,
    history: []
  }
};

let isSpinning = false;
let currentRotation = 0;

// ===== CANVAS WHEEL =====
let canvas, ctx;

function initCanvas() {
  canvas = document.getElementById('wheelCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  drawWheel();
}

function drawWheel() {
  if (!ctx || !canvas) return;
  
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 220;
  
  const activeSlices = gameState.wheelData.unlockedSlices;
  const sliceAngle = (Math.PI * 2) / activeSlices;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw slices
  for (let i = 0; i < activeSlices; i++) {
    const prize = PRIZES[i];
    const startAngle = i * sliceAngle + currentRotation;
    const endAngle = startAngle + sliceAngle;
    
    // Draw slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    
    // Gradient fill
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, prize.color);
    gradient.addColorStop(1, adjustColor(prize.color, -30));
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Border
    ctx.strokeStyle = '#2b1a0f';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Text
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Icon
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(prize.icon, radius * 0.7, -10);
    
    // Label
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(prize.label, radius * 0.7, 20);
    ctx.fillText(prize.label, radius * 0.7, 20);
    
    ctx.restore();
  }
  
  // Center circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
  ctx.fillStyle = '#2b1a0f';
  ctx.fill();
  ctx.strokeStyle = '#f1d27a';
  ctx.lineWidth = 4;
  ctx.stroke();
  
  // Center text
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#f1d27a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SPIN', centerX, centerY);
}

function adjustColor(color, amount) {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ===== SPIN LOGIC =====
async function spinWheel(isFree = false) {
  if (isSpinning) return;
  
  // Check cost
  if (!isFree && gameState.cigarettes < SPIN_COST) {
    showNotification('Nemáš dost cigaret!', 'error');
    return;
  }
  
  // Check free spin availability
  if (isFree && !canUseFreeSpinToday()) {
    showNotification('Dnes jsi už použil zdarma zatočení!', 'error');
    return;
  }
  
  isSpinning = true;
  
  // Deduct cost
  if (!isFree) {
    gameState.cigarettes -= SPIN_COST;
  } else {
    gameState.wheelData.lastFreeSpin = new Date().toISOString();
  }
  
  // Play sound
  try { window.SFPlayClick && window.SFPlayClick(); } catch {}
  
  // Random prize
  const activeSlices = gameState.wheelData.unlockedSlices;
  const prizeIndex = Math.floor(Math.random() * activeSlices);
  const prize = PRIZES[prizeIndex];
  
  // Calculate rotation
  const sliceAngle = (Math.PI * 2) / activeSlices;
  const targetAngle = -(prizeIndex * sliceAngle + sliceAngle / 2);
  const spins = 5 + Math.random() * 3; // 5-8 full rotations
  const totalRotation = spins * Math.PI * 2 + targetAngle;
  
  // Animate
  const duration = 4000;
  const startTime = Date.now();
  const startRotation = currentRotation;
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function
    const easeOut = 1 - Math.pow(1 - progress, 3);
    
    currentRotation = startRotation + totalRotation * easeOut;
    drawWheel();
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Spin complete
      currentRotation = currentRotation % (Math.PI * 2);
      handleWin(prize, isFree);
      isSpinning = false;
    }
  };
  
  animate();
  updateUI();
}

async function handleWin(prize, wasFree) {
  // Update stats
  gameState.wheelData.totalSpins++;
  
  if (prize.type === 'money') {
    gameState.money += prize.amount;
    gameState.wheelData.totalMoneyWon += prize.amount;
    if (prize.amount > gameState.wheelData.biggestWin) {
      gameState.wheelData.biggestWin = prize.amount;
    }
  } else if (prize.type === 'cigs') {
    gameState.cigarettes += prize.amount;
    gameState.wheelData.totalCigsWon += prize.amount;
  } else if (prize.type === 'jackpot') {
    gameState.money += prize.amount;
    gameState.wheelData.totalMoneyWon += prize.amount;
    gameState.wheelData.biggestWin = prize.amount;
    showJackpotAnimation();
  }
  
  // Add to history
  gameState.wheelData.history.unshift({
    prize: prize.label,
    type: prize.type,
    amount: prize.amount,
    timestamp: Date.now(),
    wasFree
  });
  
  if (gameState.wheelData.history.length > 20) {
    gameState.wheelData.history = gameState.wheelData.history.slice(0, 20);
  }
  
  // Show reward
  showReward(prize);
  
  // Save
  await saveToSupabase();
  updateUI();
  renderHistory();
  
  // Notification
  if (prize.type !== 'nothing') {
    const msg = wasFree ? `🎉 ZDARMA: ${prize.label}!` : `🎰 Výhra: ${prize.label}!`;
    showNotification(msg, 'success');
  } else {
    showNotification('💀 Tentokrát to nevyšlo...', 'error');
  }
}

function showReward(prize) {
  const rewardEl = document.getElementById('currentReward');
  const iconEl = document.getElementById('rewardIcon');
  const textEl = document.getElementById('rewardText');
  const amountEl = document.getElementById('rewardAmount');
  
  if (!rewardEl) return;
  
  iconEl.textContent = prize.icon;
  textEl.textContent = prize.type === 'nothing' ? 'SMŮLA!' : 'VÝHRA!';
  amountEl.textContent = prize.label;
  amountEl.style.color = prize.color;
  
  rewardEl.style.display = 'flex';
  rewardEl.style.animation = 'rewardPop 0.5s ease';
  
  setTimeout(() => {
    rewardEl.style.animation = 'rewardFade 0.5s ease';
    setTimeout(() => {
      rewardEl.style.display = 'none';
    }, 500);
  }, 3000);
}

function showJackpotAnimation() {
  // Epic jackpot celebration
  const jackpot = document.createElement('div');
  jackpot.className = 'jackpot-overlay';
  jackpot.innerHTML = `
    <div class="jackpot-content">
      <div class="jackpot-title">🎰 JACKPOT! 🎰</div>
      <div class="jackpot-amount">10,000₽</div>
      <div class="jackpot-subtitle">MEGA VÝHRA!</div>
    </div>
  `;
  document.body.appendChild(jackpot);
  
  setTimeout(() => {
    jackpot.style.animation = 'fadeOut 0.5s ease';
    setTimeout(() => jackpot.remove(), 500);
  }, 3000);
}

// ===== FREE SPIN SYSTEM =====
function canUseFreeSpinToday() {
  if (!gameState.wheelData.lastFreeSpin) return true;
  
  const lastSpin = new Date(gameState.wheelData.lastFreeSpin);
  const now = new Date();
  
  // Check if it's a different day
  return lastSpin.toDateString() !== now.toDateString();
}

function getTimeUntilNextFreeSpin() {
  if (canUseFreeSpinToday()) return '00:00:00';
  
  const lastSpin = new Date(gameState.wheelData.lastFreeSpin);
  const tomorrow = new Date(lastSpin);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const now = Date.now();
  const remaining = Math.max(0, tomorrow.getTime() - now);
  
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ===== UPGRADE SYSTEM =====
async function upgradeWheel(sliceNumber) {
  if (sliceNumber <= gameState.wheelData.unlockedSlices) {
    showNotification('Tento dílek je už odemčený!', 'error');
    return;
  }
  
  if (gameState.cigarettes < UPGRADE_COST) {
    showNotification('Nemáš dost cigaret! (50🚬)', 'error');
    return;
  }
  
  if (sliceNumber !== gameState.wheelData.unlockedSlices + 1) {
    showNotification('Musíš odemykat postupně!', 'error');
    return;
  }
  
  gameState.cigarettes -= UPGRADE_COST;
  gameState.wheelData.unlockedSlices = sliceNumber;
  
  await saveToSupabase();
  updateUI();
  renderUpgrades();
  drawWheel();
  
  showNotification(`🎯 Dílek ${sliceNumber} odemčen!`, 'success');
}

// ===== UI RENDERING =====
function updateUI() {
  // Currency
  const money = document.getElementById('money');
  const cigarettes = document.getElementById('cigarettes');
  if (money) money.textContent = gameState.money.toLocaleString('cs-CZ');
  if (cigarettes) cigarettes.textContent = gameState.cigarettes;
  
  // Level & XP
  const levelDisplay = document.getElementById('levelDisplay');
  if (levelDisplay) levelDisplay.textContent = gameState.level;
  
  const requiredXP = Math.floor(100 * Math.pow(1.5, gameState.level - 1));
  const xpPercent = (gameState.xp / requiredXP) * 100;
  const xpFill = document.getElementById('xpFill');
  const xpText = document.getElementById('xpText');
  if (xpFill) xpFill.style.width = `${xpPercent}%`;
  if (xpText) xpText.textContent = `${gameState.xp} / ${requiredXP}`;
  
  // Stats
  document.getElementById('totalSpins').textContent = gameState.wheelData.totalSpins;
  document.getElementById('totalMoneyWon').textContent = gameState.wheelData.totalMoneyWon.toLocaleString('cs-CZ');
  document.getElementById('totalCigsWon').textContent = gameState.wheelData.totalCigsWon;
  document.getElementById('biggestWin').textContent = gameState.wheelData.biggestWin.toLocaleString('cs-CZ') + '₽';
  document.getElementById('activeSlices').textContent = `${gameState.wheelData.unlockedSlices} / ${MAX_SLICES}`;
  
  // Free spin status
  const freeSpinEl = document.getElementById('freeSpin');
  const freeSpinBadge = document.getElementById('freeSpinBadge');
  const spinButton = document.getElementById('spinButton');
  const spinCost = document.getElementById('spinCost');
  
  const canFree = canUseFreeSpinToday();
  if (freeSpinEl) {
    freeSpinEl.textContent = canFree ? 'Dostupné ✓' : 'Použito ✗';
    freeSpinEl.style.color = canFree ? '#10b981' : '#ff6b6b';
  }
  
  if (freeSpinBadge) {
    freeSpinBadge.style.display = canFree ? 'block' : 'none';
  }
  
  if (spinButton && spinCost) {
    if (canFree) {
      spinCost.textContent = '⭐ ZDARMA';
      spinButton.classList.add('free');
    } else {
      spinCost.textContent = '10 🚬';
      spinButton.classList.remove('free');
    }
  }
  
  updateTimer();
}

function updateTimer() {
  const timerEl = document.getElementById('freeSpinTimer');
  if (timerEl) {
    timerEl.textContent = getTimeUntilNextFreeSpin();
  }
}

function renderUpgrades() {
  const grid = document.getElementById('upgradeGrid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  for (let i = MIN_SLICES + 1; i <= MAX_SLICES; i++) {
    const isUnlocked = i <= gameState.wheelData.unlockedSlices;
    const isNext = i === gameState.wheelData.unlockedSlices + 1;
    
    const card = document.createElement('div');
    card.className = `upgrade-card ${isUnlocked ? 'unlocked' : ''} ${isNext ? 'next' : ''}`;
    
    const prize = PRIZES[i - 1];
    
    card.innerHTML = `
      <div class="upgrade-icon">${prize.icon}</div>
      <div class="upgrade-info">
        <div class="upgrade-name">Dílek ${i}</div>
        <div class="upgrade-prize">${prize.label}</div>
      </div>
      <button class="upgrade-btn ${isUnlocked ? 'disabled' : ''}" 
              onclick="upgradeWheel(${i})"
              ${isUnlocked ? 'disabled' : ''}>
        ${isUnlocked ? '✓ Aktivní' : (isNext ? '50🚬 Odemknout' : '🔒 Uzamčeno')}
      </button>
    `;
    
    grid.appendChild(card);
  }
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  
  const history = gameState.wheelData.history || [];
  
  if (history.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">🎰</div>
        <div class="history-empty-text">Zatočte kolem!</div>
      </div>
    `;
    return;
  }
  
  list.innerHTML = history.map(entry => {
    const date = new Date(entry.timestamp);
    const timeStr = date.toLocaleTimeString('cs-CZ');
    
    let iconClass = 'history-icon';
    if (entry.type === 'jackpot') iconClass += ' jackpot';
    else if (entry.type === 'nothing') iconClass += ' loss';
    
    return `
      <div class="history-item">
        <div class="${iconClass}">
          ${entry.type === 'money' ? '💰' : entry.type === 'cigs' ? '🚬' : entry.type === 'jackpot' ? '🎰' : '💀'}
        </div>
        <div class="history-content">
          <div class="history-prize">${entry.prize}</div>
          <div class="history-time">${timeStr}${entry.wasFree ? ' • ZDARMA' : ''}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== SUPABASE =====
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
      
      // Load wheel data
      if (data.wheel_data) {
        gameState.wheelData = {
          ...gameState.wheelData,
          ...data.wheel_data
        };
      }
      
      // Load game data
      if (data.coin_flip_data) {
        gameState.coinFlipData = { ...gameState.coinFlipData, ...data.coin_flip_data };
      }
      if (data.crash_data) {
        gameState.crashData = { ...gameState.crashData, ...data.crash_data };
      }
      if (data.dice_data) {
        gameState.diceData = { ...gameState.diceData, ...data.dice_data };
      }
    } else {
      await saveToSupabase();
    }
    
    updateUI();
    renderUpgrades();
    renderHistory();
    initCanvas();
    updateCoinStats();
    updateCrashStats();
    updateDiceStats();
    
  } catch (error) {
    console.error("Error initializing user:", error);
    showNotification("Chyba při načítání hry", "error");
  }
}

async function saveToSupabase() {
  try {
    const sb = await ensureOnline();

    const payload = {
      user_id: gameState.userId,
      level: gameState.level,
      xp: gameState.xp,
      money: gameState.money,
      cigarettes: gameState.cigarettes,
      wheel_data: gameState.wheelData,
      coin_flip_data: gameState.coinFlipData,
      crash_data: gameState.crashData,
      dice_data: gameState.diceData
    };

    const { error } = await sb.from("player_stats").upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error("Error saving to Supabase:", error);
    return false;
  }
}

// ===== SYNC FROM SERVER =====
async function syncFromServer() {
  if (window.SFReady) await window.SFReady;
  const stats = window.SF?.stats;
  if (!stats) return;

  gameState.level = stats.level ?? gameState.level;
  gameState.xp = stats.xp ?? gameState.xp;
  gameState.money = stats.money ?? gameState.money;
  gameState.cigarettes = stats.cigarettes ?? gameState.cigarettes;
  
  if (stats.wheel_data) {
    gameState.wheelData = { ...gameState.wheelData, ...stats.wheel_data };
  }
  if (stats.coin_flip_data) {
    gameState.coinFlipData = { ...gameState.coinFlipData, ...stats.coin_flip_data };
  }
  if (stats.crash_data) {
    gameState.crashData = { ...gameState.crashData, ...stats.crash_data };
  }
  if (stats.dice_data) {
    gameState.diceData = { ...gameState.diceData, ...stats.dice_data };
  }

  updateUI();
  renderUpgrades();
  renderHistory();
  drawWheel();
  updateCoinStats();
  updateCrashStats();
  updateDiceStats();
}

document.addEventListener('sf:stats', async (e) => {
  await syncFromServer();
});

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
  console.log('🎰 Initializing Wheel of Fortune...');
  
  await initUser();
  
  // Spin button
  const spinButton = document.getElementById('spinButton');
  if (spinButton) {
    spinButton.addEventListener('click', () => {
      const canFree = canUseFreeSpinToday();
      spinWheel(canFree);
    });
  }
  
  // Game tabs
  document.querySelectorAll('.game-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchGame(tab.dataset.game);
    });
  });
  
  // Update timer every second
  setInterval(updateTimer, 1000);
  
  showNotification('Herní centrum načteno!', 'success');
  
  console.log('✅ Wheel of Fortune initialized!');
});

// ===== GAME SWITCHING =====
function switchGame(gameId) {
  // Update tabs
  document.querySelectorAll('.game-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`[data-game="${gameId}"]`).classList.add('active');
  
  // Update content
  document.querySelectorAll('.game-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`game-${gameId}`).classList.add('active');
  
  // Init specific game
  if (gameId === 'crash') {
    initCrashCanvas();
  }
}

// ===== COIN FLIP GAME =====
let isCoinFlipping = false;

function adjustCoinBet(amount) {
  const input = document.getElementById('coinBetInput');
  const current = parseInt(input.value) || 50;
  const newVal = Math.max(10, Math.min(10000, current + amount));
  input.value = newVal;
  document.getElementById('coinBet').textContent = newVal;
}

function setCoinBet(amount) {
  document.getElementById('coinBetInput').value = amount;
  document.getElementById('coinBet').textContent = amount;
}

async function playCoinFlip(choice) {
  if (isCoinFlipping) return;
  
  const bet = parseInt(document.getElementById('coinBetInput').value) || 50;
  
  if (gameState.money < bet) {
    showNotification('Nemáš dost grošů!', 'error');
    return;
  }
  
  isCoinFlipping = true;
  gameState.money -= bet;
  
  // Coin flip animation
  const coin = document.querySelector('.coin');
  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  
  coin.classList.add('flipping');
  
  setTimeout(async () => {
    coin.classList.remove('flipping');
    
    const won = choice === result;
    const winAmount = won ? bet * 2 : 0;
    
    if (won) {
      gameState.money += winAmount;
      gameState.coinFlipData.wins++;
      gameState.coinFlipData.profit += bet;
      showNotification(`🎉 Výhra! +${winAmount}₽`, 'success');
    } else {
      gameState.coinFlipData.losses++;
      gameState.coinFlipData.profit -= bet;
      showNotification(`💀 Prohra! -${bet}₽`, 'error');
    }
    
    gameState.coinFlipData.totalGames++;
    gameState.coinFlipData.history.unshift({
      bet,
      choice,
      result,
      won,
      winAmount,
      timestamp: Date.now()
    });
    
    if (gameState.coinFlipData.history.length > 20) {
      gameState.coinFlipData.history = gameState.coinFlipData.history.slice(0, 20);
    }
    
    await saveToSupabase();
    updateUI();
    updateCoinStats();
    
    isCoinFlipping = false;
  }, 1000);
  
  updateUI();
}

function updateCoinStats() {
  document.getElementById('coinTotalGames').textContent = gameState.coinFlipData.totalGames;
  document.getElementById('coinWins').textContent = gameState.coinFlipData.wins;
  document.getElementById('coinLosses').textContent = gameState.coinFlipData.losses;
  
  const profit = gameState.coinFlipData.profit;
  const profitEl = document.getElementById('coinProfit');
  profitEl.textContent = (profit >= 0 ? '+' : '') + profit + '₽';
  profitEl.style.color = profit >= 0 ? '#10b981' : '#ff6b6b';
  
  // History
  const historyEl = document.getElementById('coinHistory');
  const history = gameState.coinFlipData.history || [];
  
  if (history.length === 0) {
    historyEl.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">🪙</div>
        <div class="history-empty-text">Zatím žádné hry</div>
      </div>
    `;
    return;
  }
  
  historyEl.innerHTML = history.map(h => `
    <div class="history-item">
      <div class="history-icon ${h.won ? '' : 'loss'}">
        ${h.won ? '✅' : '❌'}
      </div>
      <div class="history-content">
        <div class="history-prize">${h.won ? '+' + h.winAmount : '-' + h.bet}₽</div>
        <div class="history-time">${h.choice === 'heads' ? '₽' : '💀'} → ${h.result === 'heads' ? '₽' : '💀'}</div>
      </div>
    </div>
  `).join('');
}

// ===== CRASH GAME =====
let crashCanvas, crashCtx;
let crashInterval = null;
let crashMultiplier = 1.0;
let crashBetAmount = 0;
let isCrashing = false;
let crashPoints = [];

function initCrashCanvas() {
  crashCanvas = document.getElementById('crashCanvas');
  if (!crashCanvas) return;
  crashCtx = crashCanvas.getContext('2d');
  drawCrashGraph();
}

function drawCrashGraph() {
  if (!crashCtx || !crashCanvas) return;
  
  crashCtx.clearRect(0, 0, crashCanvas.width, crashCanvas.height);
  
  // Grid
  crashCtx.strokeStyle = 'rgba(255,215,100,0.1)';
  crashCtx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const y = (crashCanvas.height / 10) * i;
    crashCtx.beginPath();
    crashCtx.moveTo(0, y);
    crashCtx.lineTo(crashCanvas.width, y);
    crashCtx.stroke();
  }
  
  // Draw line
  if (crashPoints.length > 1) {
    crashCtx.strokeStyle = '#10b981';
    crashCtx.lineWidth = 4;
    crashCtx.beginPath();
    crashCtx.moveTo(crashPoints[0].x, crashPoints[0].y);
    for (let i = 1; i < crashPoints.length; i++) {
      crashCtx.lineTo(crashPoints[i].x, crashPoints[i].y);
    }
    crashCtx.stroke();
  }
}

function adjustCrashBet(amount) {
  const input = document.getElementById('crashBetInput');
  const current = parseInt(input.value) || 100;
  const newVal = Math.max(10, Math.min(10000, current + amount));
  input.value = newVal;
  document.getElementById('crashBet').textContent = newVal;
}

function setCrashBet(amount) {
  document.getElementById('crashBetInput').value = amount;
  document.getElementById('crashBet').textContent = amount;
}

async function startCrash() {
  if (isCrashing) return;
  
  const bet = parseInt(document.getElementById('crashBetInput').value) || 100;
  
  if (gameState.money < bet) {
    showNotification('Nemáš dost grošů!', 'error');
    return;
  }
  
  gameState.money -= bet;
  crashBetAmount = bet;
  isCrashing = true;
  crashMultiplier = 1.0;
  crashPoints = [];
  
  document.getElementById('crashBetBtn').style.display = 'none';
  document.getElementById('crashCashoutBtn').style.display = 'flex';
  
  const crashPoint = 1.5 + Math.random() * 8; // 1.5x - 9.5x
  let startTime = Date.now();
  
  crashInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    crashMultiplier = 1 + (elapsed * 0.5);
    
    // Add point
    const x = (crashPoints.length * 10) % crashCanvas.width;
    const y = crashCanvas.height - (crashMultiplier / 10) * crashCanvas.height;
    crashPoints.push({ x, y });
    if (crashPoints.length > 60) crashPoints.shift();
    
    drawCrashGraph();
    
    const multiEl = document.getElementById('crashMultiplier');
    const cashoutMultiEl = document.getElementById('cashoutMulti');
    multiEl.textContent = crashMultiplier.toFixed(2) + 'x';
    cashoutMultiEl.textContent = crashMultiplier.toFixed(2) + 'x';
    
    if (crashMultiplier >= crashPoint) {
      crashGame();
    }
  }, 100);
  
  updateUI();
}

function crashGame() {
  clearInterval(crashInterval);
  
  const multiEl = document.getElementById('crashMultiplier');
  multiEl.textContent = 'CRASHED!';
  multiEl.classList.add('crashed');
  
  setTimeout(() => {
    multiEl.classList.remove('crashed');
    multiEl.textContent = '1.00x';
  }, 2000);
  
  gameState.crashData.totalGames++;
  gameState.crashData.profit -= crashBetAmount;
  gameState.crashData.history.unshift({
    bet: crashBetAmount,
    multi: crashMultiplier.toFixed(2),
    won: false,
    timestamp: Date.now()
  });
  
  if (gameState.crashData.history.length > 20) {
    gameState.crashData.history = gameState.crashData.history.slice(0, 20);
  }
  
  saveToSupabase();
  updateCrashStats();
  resetCrash();
  
  showNotification(`💥 CRASH na ${crashMultiplier.toFixed(2)}x! -${crashBetAmount}₽`, 'error');
}

async function cashoutCrash() {
  if (!isCrashing) return;
  
  clearInterval(crashInterval);
  
  const winAmount = Math.floor(crashBetAmount * crashMultiplier);
  gameState.money += winAmount;
  gameState.crashData.profit += (winAmount - crashBetAmount);
  
  if (crashMultiplier > gameState.crashData.highestMulti) {
    gameState.crashData.highestMulti = crashMultiplier;
  }
  
  gameState.crashData.totalGames++;
  gameState.crashData.history.unshift({
    bet: crashBetAmount,
    multi: crashMultiplier.toFixed(2),
    won: true,
    winAmount,
    timestamp: Date.now()
  });
  
  if (gameState.crashData.history.length > 20) {
    gameState.crashData.history = gameState.crashData.history.slice(0, 20);
  }
  
  await saveToSupabase();
  updateUI();
  updateCrashStats();
  resetCrash();
  
  showNotification(`🎉 Výběr na ${crashMultiplier.toFixed(2)}x! +${winAmount - crashBetAmount}₽`, 'success');
}

function resetCrash() {
  isCrashing = false;
  crashBetAmount = 0;
  crashPoints = [];
  document.getElementById('crashBetBtn').style.display = 'flex';
  document.getElementById('crashCashoutBtn').style.display = 'none';
  drawCrashGraph();
}

function updateCrashStats() {
  document.getElementById('crashTotalGames').textContent = gameState.crashData.totalGames;
  document.getElementById('crashHighest').textContent = gameState.crashData.highestMulti.toFixed(2) + 'x';
  
  const profit = gameState.crashData.profit;
  const profitEl = document.getElementById('crashProfit');
  profitEl.textContent = (profit >= 0 ? '+' : '') + profit + '₽';
  profitEl.style.color = profit >= 0 ? '#10b981' : '#ff6b6b';
  
  // History
  const historyEl = document.getElementById('crashHistory');
  const history = gameState.crashData.history || [];
  
  if (history.length === 0) {
    historyEl.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">📈</div>
        <div class="history-empty-text">Zatím žádné hry</div>
      </div>
    `;
    return;
  }
  
  historyEl.innerHTML = history.map(h => `
    <div class="history-item">
      <div class="history-icon ${h.won ? '' : 'loss'}">
        ${h.won ? '✅' : '💥'}
      </div>
      <div class="history-content">
        <div class="history-prize">${h.multi}x${h.won ? ' (+' + (h.winAmount - h.bet) + '₽)' : ''}</div>
        <div class="history-time">Sázka: ${h.bet}₽</div>
      </div>
    </div>
  `).join('');
}

// ===== DICE GAME =====
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
let isDiceRolling = false;

function adjustDiceBet(amount) {
  const input = document.getElementById('diceBetInput');
  const current = parseInt(input.value) || 5;
  const newVal = Math.max(1, Math.min(100, current + amount));
  input.value = newVal;
  document.getElementById('diceBet').textContent = newVal;
}

function setDiceBet(amount) {
  document.getElementById('diceBetInput').value = amount;
  document.getElementById('diceBet').textContent = amount;
}

async function playDice(prediction) {
  if (isDiceRolling) return;
  
  const bet = parseInt(document.getElementById('diceBetInput').value) || 5;
  
  if (gameState.cigarettes < bet) {
    showNotification('Nemáš dost cigaret!', 'error');
    return;
  }
  
  isDiceRolling = true;
  gameState.cigarettes -= bet;
  
  // Roll animation
  const diceEls = [
    document.getElementById('dice1'),
    document.getElementById('dice2'),
    document.getElementById('dice3')
  ];
  
  diceEls.forEach(d => d.classList.add('rolling'));
  
  setTimeout(async () => {
    const rolls = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];
    
    const total = rolls.reduce((a, b) => a + b, 0);
    
    diceEls.forEach((d, i) => {
      d.querySelector('.dice-face').textContent = DICE_FACES[rolls[i] - 1];
      d.classList.remove('rolling');
    });
    
    document.getElementById('diceTotal').textContent = `Součet: ${total}`;
    
    // Check win
    let won = false;
    let multi = 0;
    
    if (prediction === 'low' && total >= 3 && total <= 8) {
      won = true;
      multi = 2.5;
    } else if (prediction === 'mid' && total >= 9 && total <= 12) {
      won = true;
      multi = 2;
    } else if (prediction === 'high' && total >= 13 && total <= 18) {
      won = true;
      multi = 2.5;
    } else if (prediction === 'triple' && rolls[0] === rolls[1] && rolls[1] === rolls[2]) {
      won = true;
      multi = 10;
    }
    
    const winAmount = won ? Math.floor(bet * multi) : 0;
    
    if (won) {
      gameState.cigarettes += winAmount;
      gameState.diceData.wins++;
      gameState.diceData.profit += (winAmount - bet);
      showNotification(`🎉 Výhra! +${winAmount}🚬 (${multi}x)`, 'success');
    } else {
      gameState.diceData.profit -= bet;
      showNotification(`💀 Prohra! -${bet}🚬`, 'error');
    }
    
    gameState.diceData.totalGames++;
    gameState.diceData.history.unshift({
      bet,
      rolls,
      total,
      prediction,
      won,
      multi,
      winAmount,
      timestamp: Date.now()
    });
    
    if (gameState.diceData.history.length > 20) {
      gameState.diceData.history = gameState.diceData.history.slice(0, 20);
    }
    
    await saveToSupabase();
    updateUI();
    updateDiceStats();
    
    isDiceRolling = false;
  }, 500);
  
  updateUI();
}

function updateDiceStats() {
  document.getElementById('diceTotalGames').textContent = gameState.diceData.totalGames;
  document.getElementById('diceWins').textContent = gameState.diceData.wins;
  
  const profit = gameState.diceData.profit;
  const profitEl = document.getElementById('diceProfit');
  profitEl.textContent = (profit >= 0 ? '+' : '') + profit + '🚬';
  profitEl.style.color = profit >= 0 ? '#10b981' : '#ff6b6b';
  
  // History
  const historyEl = document.getElementById('diceHistory');
  const history = gameState.diceData.history || [];
  
  if (history.length === 0) {
    historyEl.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">🎲</div>
        <div class="history-empty-text">Zatím žádné hry</div>
      </div>
    `;
    return;
  }
  
  historyEl.innerHTML = history.map(h => {
    const diceStr = h.rolls.map(r => DICE_FACES[r - 1]).join(' ');
    return `
      <div class="history-item">
        <div class="history-icon ${h.won ? '' : 'loss'}">
          ${h.won ? '✅' : '❌'}
        </div>
        <div class="history-content">
          <div class="history-prize">${diceStr} = ${h.total}</div>
          <div class="history-time">${h.won ? '+' + h.winAmount : '-' + h.bet}🚬</div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎰 Initializing Wheel of Fortune...');
  
  await initUser();
  
  // Spin button
  const spinButton = document.getElementById('spinButton');
  if (spinButton) {
    spinButton.addEventListener('click', () => {
      const canFree = canUseFreeSpinToday();
      spinWheel(canFree);
    });
  }
  
  // Update timer every second
  setInterval(updateTimer, 1000);
  
  showNotification('Kolo štěstí načteno!', 'success');
  
  console.log('✅ Wheel of Fortune initialized!');
});

// Auto-save
setInterval(async () => {
  await saveToSupabase();
  console.log('💾 Auto-save completed');
}, 30000);

// Expose functions
window.adjustCoinBet = adjustCoinBet;
window.setCoinBet = setCoinBet;
window.playCoinFlip = playCoinFlip;
window.adjustCrashBet = adjustCrashBet;
window.setCrashBet = setCrashBet;
window.startCrash = startCrash;
window.cashoutCrash = cashoutCrash;
window.adjustDiceBet = adjustDiceBet;
window.setDiceBet = setDiceBet;
window.playDice = playDice;

console.log('✅ Wheel of Fortune system loaded!');