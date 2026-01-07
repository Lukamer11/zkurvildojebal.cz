
// === FORCE GLOBAL STATS OVERRIDE ===
['money','level','xp','cigs'].forEach(k=>{
  try{
    Object.defineProperty(window,k,{
      get(){ return GAME_STATE.stats[k]; },
      set(v){ GAME_STATE.stats[k]=v; saveGameState(); }
    });
  }catch(e){}
});

// ===== SUPABASE SETUP =====
// Konfigurace se načítá z config.js (nebude v GIT)
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// ===== SECURITY & VALIDATION =====
const RATE_LIMIT = {
  requests: new Map(),
  maxRequests: 30,
  timeWindow: 60000 // 1 minuta
};

function checkRateLimit(key) {
  const now = Date.now();
  const userRequests = RATE_LIMIT.requests.get(key) || [];
  
  // Vyčisti staré požadavky
  const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT.timeWindow);
  
  if (recentRequests.length >= RATE_LIMIT.maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  RATE_LIMIT.requests.set(key, recentRequests);
  return true;
}

function sanitizeUserId(userId) {
  if (!userId || typeof userId !== 'string') return null;
  return userId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
}

function validateNumber(value, min = 0, max = 1000000) {
  const num = parseInt(value);
  if (isNaN(num)) return 0;
  return Math.max(min, Math.min(max, num));
}

// ===== GAME STATE =====
let currentUserId = sanitizeUserId(
  localStorage.getItem('user_id') || 
  localStorage.getItem('slavFantasyUserId') || 
  'offline_user'
);
let myStats = null;
let leaderboardCache = {
  level: { data: null, timestamp: 0 },
  wealth: { data: null, timestamp: 0 }
};
const CACHE_DURATION = 30000; // 30 sekund

// ===== HELPER FUNCTIONS =====
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

function calculateStatBonus(stat, value) {
  const val = validateNumber(value, 0, 9999);
  
  switch(stat) {
    case 'strength':
      return `+${val * 2} DMG`;
    case 'defense':
      const defPercent = Math.min(Math.floor((val / 28) * 100), 100);
      return `${defPercent}% Redukce`;
    case 'dexterity':
      const crit = Math.floor(val * 0.5);
      return `+${crit}% Crit`;
    case 'intelligence':
      return `+${Math.floor(val * 1.5)}% Magie`;
    case 'constitution':
      const hp = 500 + (val * 25);
      return `${hp} HP`;
    case 'luck':
      const luckPercent = Math.min(val, 100);
      return `${luckPercent}% / 100%`;
    default:
      return '';
  }
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.className = `notification notification-${type}`;
  notification.setAttribute('role', 'alert');
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function formatNumber(num) {
  return parseInt(num || 0).toLocaleString('cs-CZ');
}

// ===== LOAD MY STATS =====
async function loadMyStats() {
  try {
    if (!checkRateLimit(`stats_${currentUserId}`)) {
      console.warn('Rate limit dosažen pro načítání statistik');
      return myStats;
    }

    const { data, error } = await supabaseClient
      .from('player_stats')
      .select('level, xp, money, cigarettes, energy, max_energy')
      .eq('user_id', currentUserId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Chyba načítání statistik:', error);
      return null;
    }
    
    if (data) {
      myStats = {
        level: validateNumber(data.level, 1, 9999),
        xp: validateNumber(data.xp, 0, 999999999),
        money: validateNumber(data.money, 0, 999999999),
        cigarettes: validateNumber(data.cigarettes, 0, 999999),
        energy: validateNumber(data.energy, 0, 1000),
        max_energy: validateNumber(data.max_energy, 100, 1000)
      };
      updateHUD();
      return myStats;
    }
    
    return null;
  } catch (error) {
    console.error('Chyba v loadMyStats:', error);
    return null;
  }
}

// ===== UPDATE HUD =====
function updateHUD() {
  if (!myStats) return;
  
  const updates = {
    levelDisplay: myStats.level,
    money: formatNumber(myStats.money),
    cigarettes: myStats.cigarettes,
    energy: myStats.energy
  };
  
  Object.entries(updates).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
  
  // XP bar
  const requiredXP = Math.floor(100 * Math.pow(1.5, myStats.level - 1));
  const xpPercent = Math.min((myStats.xp / requiredXP) * 100, 100);
  
  const xpFill = document.getElementById('xpFill');
  const xpText = document.getElementById('xpText');
  
  if (xpFill) xpFill.style.width = `${xpPercent}%`;
  if (xpText) xpText.textContent = `${formatNumber(myStats.xp)} / ${formatNumber(requiredXP)}`;
  
  // Energy bar
  const energyPercent = Math.min((myStats.energy / myStats.max_energy) * 100, 100);
  const energyFill = document.getElementById('energyFill');
  const energyText = document.getElementById('energyText');
  
  if (energyFill) energyFill.style.width = `${energyPercent}%`;
  if (energyText) energyText.textContent = `${myStats.energy} / ${myStats.max_energy}`;
}

// ===== LOAD LEADERBOARD =====
async function loadLeaderboard(type = 'level', forceRefresh = false) {
  try {
    // Cache kontrola
    const now = Date.now();
    if (!forceRefresh && leaderboardCache[type].data && 
        (now - leaderboardCache[type].timestamp) < CACHE_DURATION) {
      return leaderboardCache[type].data;
    }

    if (!checkRateLimit(`leaderboard_${type}`)) {
      console.warn('Rate limit dosažen pro žebříček');
      return leaderboardCache[type].data || [];
    }

    let query = supabaseClient
      .from('player_stats')
      .select('user_id, level, xp, money');
    
    if (type === 'level') {
      query = query.order('level', { ascending: false })
                   .order('xp', { ascending: false });
    } else if (type === 'wealth') {
      query = query.order('money', { ascending: false });
    }
    
    const { data, error } = await query.limit(50);
    
    if (error) {
      console.error('Chyba načítání žebříčku:', error);
      showNotification('Chyba při načítání žebříčku', 'error');
      return leaderboardCache[type].data || [];
    }
    
    const sanitizedData = (data || []).map(player => ({
      user_id: sanitizeUserId(player.user_id),
      level: validateNumber(player.level, 1, 9999),
      xp: validateNumber(player.xp, 0, 999999999),
      money: validateNumber(player.money, 0, 999999999)
    }));
    
    // Ulož do cache
    leaderboardCache[type] = {
      data: sanitizedData,
      timestamp: now
    };
    
    return sanitizedData;
  } catch (error) {
    console.error('Chyba v loadLeaderboard:', error);
    return leaderboardCache[type].data || [];
  }
}

// ===== RENDER LEADERBOARD =====
function renderLeaderboard(players, type = 'level') {
  const listId = type === 'level' ? 'levelList' : 'wealthList';
  const list = document.getElementById(listId);
  
  if (!list) return;
  
  if (!players || players.length === 0) {
    list.innerHTML = '<div class="no-data">Žádná data k zobrazení</div>';
    return;
  }
  
  list.innerHTML = '';
  
  players.forEach((player, index) => {
    const rank = index + 1;
    const isMe = player.user_id === currentUserId;
    
    const item = document.createElement('div');
    item.className = `leaderboard-item ${rank === 1 ? 'top-1' : rank === 2 ? 'top-2' : rank === 3 ? 'top-3' : ''} ${isMe ? 'player-me' : ''}`;
    item.dataset.userId = player.user_id;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    
    let statsLine = '';
    let scoreValue = '';
    
    if (type === 'level') {
      statsLine = `Level ${player.level} • XP ${formatNumber(player.xp)}`;
      scoreValue = player.level;
    } else {
      statsLine = `Level ${player.level} • XP ${formatNumber(player.xp)}`;
      scoreValue = `${formatNumber(player.money)}₽`;
    }
    
    const playerName = isMe ? 'TY (BORIS GOPNIKOV)' : `PLAYER ${player.user_id.substring(0, 8).toUpperCase()}`;
    
    item.innerHTML = `
      <div class="rank">${medal}</div>
      <div class="player-info">
        <div class="player-name">${playerName}</div>
        <div class="player-stats">${statsLine}</div>
      </div>
      <div class="player-score">${scoreValue}</div>
    `;
    
    const showPlayer = () => showPlayerView(player);
    item.addEventListener('click', showPlayer);
    item.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showPlayer();
      }
    });
    
    list.appendChild(item);
  });
}

// ===== SHOW PLAYER VIEW =====
async function showPlayerView(player) {
  try {
    if (!checkRateLimit(`player_${player.user_id}`)) {
      showNotification('Příliš mnoho požadavků, zkuste později', 'error');
      return;
    }

    document.getElementById('leaderboardView').style.display = 'none';
    document.getElementById('playerView').classList.remove('hidden');
    
    const { data, error } = await supabaseClient
      .from('player_stats')
      .select('user_id, level, stats, equipped')
      .eq('user_id', player.user_id)
      .single();
    
    if (error) {
      console.error('Chyba načítání hráče:', error);
      showNotification('Chyba při načítání hráče', 'error');
      showLeaderboardView();
      return;
    }
    
    const playerData = data || player;
    
    // Update player name
    const isMe = playerData.user_id === currentUserId;
    const playerName = isMe ? 'TY (BORIS GOPNIKOV)' : `PLAYER ${playerData.user_id.substring(0, 8).toUpperCase()}`;
    document.getElementById('playerName').textContent = playerName;
    
    // Update level
    document.getElementById('playerLevel').textContent = `Level ${validateNumber(playerData.level, 1, 9999)}`;
    
    // Update stats
    const stats = playerData.stats || {
      strength: 0,
      defense: 0,
      dexterity: 0,
      intelligence: 0,
      constitution: 0,
      luck: 0
    };
    
    Object.keys(stats).forEach(stat => {
      const value = validateNumber(stats[stat], 0, 9999);
      const statEl = document.getElementById(`stat${stat.charAt(0).toUpperCase() + stat.slice(1)}`);
      const extraEl = document.getElementById(`stat${stat.charAt(0).toUpperCase() + stat.slice(1)}Extra`);
      
      if (statEl) statEl.textContent = value;
      if (extraEl) extraEl.textContent = calculateStatBonus(stat, value);
    });
    
    // Update equipped items
    const equipped = playerData.equipped || {};
    renderEquippedItems(equipped);
    
  } catch (error) {
    console.error('Chyba v showPlayerView:', error);
    showNotification('Chyba při zobrazení hráče', 'error');
    showLeaderboardView();
  }
}

// ===== RENDER EQUIPPED ITEMS =====
function renderEquippedItems(equipped) {
  const slots = document.querySelectorAll('.slot');
  
  slots.forEach(slot => {
    const slotName = slot.dataset.slot;
    const itemId = equipped[slotName];
    
    if (itemId) {
      slot.classList.add('has-item');
      slot.innerHTML = `<span class="slot-item">📦</span>`;
    } else {
      slot.classList.remove('has-item');
      slot.innerHTML = `<span class="slot-emoji">${getSlotEmoji(slotName)}</span>`;
    }
  });
}

// ===== SHOW LEADERBOARD VIEW =====
function showLeaderboardView() {
  document.getElementById('playerView').classList.add('hidden');
  document.getElementById('leaderboardView').style.display = 'flex';
}

// ===== TAB SWITCHING =====
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      const tabType = tab.dataset.tab;
      
      // Update active tab
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      
      // Update active list
      const lists = document.querySelectorAll('.leaderboard-list');
      lists.forEach(l => l.classList.remove('active'));
      
      const targetList = document.querySelector(`[data-content="${tabType}"]`);
      if (targetList) {
        targetList.classList.add('active');
        targetList.innerHTML = '<div class="loading-spinner">Načítám...</div>';
      }
      
      // Load data
      const players = await loadLeaderboard(tabType);
      renderLeaderboard(players, tabType);
    });
  });
}

// ===== BACK BUTTON =====
function setupBackButton() {
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', showLeaderboardView);
  }
}

// ===== AUTO REFRESH =====
let autoRefreshInterval = null;

function startAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  
  autoRefreshInterval = setInterval(async () => {
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab && document.getElementById('leaderboardView').style.display !== 'none') {
      const tabType = activeTab.dataset.tab;
      const players = await loadLeaderboard(tabType, true);
      renderLeaderboard(players, tabType);
    }
  }, 60000); // Refresh každou minutu
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

// ===== INITIALIZE =====
async function initialize() {
  console.log('🚀 Inicializuji žebříček...');
  
  // Security check
  if (!currentUserId) {
    console.error('Neplatné user ID');
    showNotification('Chyba: Neplatné ID uživatele', 'error');
    return;
  }
  
  // Setup UI
  setupTabs();
  setupBackButton();
  
  // Load my stats
  await loadMyStats();
  
  // Load initial leaderboard (level)
  const players = await loadLeaderboard('level');
  renderLeaderboard(players, 'level');
  
  // Start auto-refresh
  startAutoRefresh();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', stopAutoRefresh);
  
  console.log('✅ Žebříček načten!');
}

// ===== START =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}