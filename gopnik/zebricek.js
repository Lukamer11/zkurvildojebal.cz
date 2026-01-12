// zebricek.js - ONLINE SYNC + REALTIME
(() => {
  "use strict";

  const SUPABASE_URL = 'https://wngzgptxrgfrwuyiyueu.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZ3pncHR4cmdmcnd1eWl5dWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzQzNTYsImV4cCI6MjA4MzU1MDM1Nn0.N-UJpDi_CQVTC6gYFzYIFQdlm0C4x6K7GjeXGzdS8No';

  // ===== STATE =====
  let currentUserId = null;
  let myStats = null;
  let currentPlayerChannel = null; // Realtime kanál pro aktuálně zobrazeného hráče
  let leaderboardCache = {
    level: { data: null, timestamp: 0 },
    wealth: { data: null, timestamp: 0 }
  };
  const CACHE_DURATION = 30000;

  // ===== HELPERS =====
  function fmtInt(n) {
    return Number(n ?? 0).toLocaleString("cs-CZ");
  }

  function clampVal(v, min = 0, max = 999999999) {
    const num = Number(v ?? 0);
    if (isNaN(num)) return min;
    return Math.max(min, Math.min(max, Math.floor(num)));
  }

  function getSlotEmoji(slotName) {
    const emojis = {
      weapon: '🗡️', shield: '🛡️', ring: '💍', backpack: '🎒',
      helmet: '🎩', armor: '👕', boots: '👢', gloves: '🧤'
    };
    return emojis[slotName] || '❓';
  }

  function calculateStatBonus(stat, value) {
    const val = clampVal(value, 0, 9999);
    
    switch(stat) {
      case 'strength':
        return `+${val * 2} DMG`;
      case 'defense':
        return `${Math.min(Math.floor((val / 28) * 100), 100)}% Redukce`;
      case 'dexterity':
        return `+${Math.floor(val * 0.5)}% Crit`;
      case 'intelligence':
        return `+${Math.floor(val * 1.5)}% Magie`;
      case 'constitution':
        return `${500 + (val * 25)} HP`;
      case 'luck':
        return `${Math.min(val, 100)}% / 100%`;
      default:
        return '';
    }
  }

  const ALLOWED_STATS = ['strength','defense','dexterity','intelligence','constitution','luck'];

  function sanitizeStats(input) {
    const src = (input && typeof input === 'object') ? input : {};
    const out = {};
    for (const k of ALLOWED_STATS) {
      out[k] = clampVal(src[k], 0, 9999);
    }
    return out;
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

  function getAllItems() {
    if (!window.SHOP_ITEMS) return [];
    return [
      ...(window.SHOP_ITEMS.weapons || []),
      ...(window.SHOP_ITEMS.armor || []),
      ...(window.SHOP_ITEMS.special || [])
    ];
  }

  function getItemById(id) {
    return getAllItems().find(it => String(it.id) === String(id));
  }

  // ===== LOAD MY STATS =====
  async function loadMyStats() {
    try {
      console.log('🔥 === LOAD MY STATS ===');
      
      const sb = window.supabaseClient;
      const sf = await (window.SFReady || Promise.resolve(window.SF));
      currentUserId = (sf?.user?.id || sf?.stats?.user_id);
      
      if (!currentUserId || !sb) {
        console.error("❌ Missing uid or Supabase");
        return;
      }
      
      console.log('👤 User ID:', currentUserId);

      const { data, error } = await sb
        .from("player_stats")
        .select("level, xp, money, cigarettes, energy, max_energy")
        .eq("user_id", currentUserId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ Error:', error);
        return;
      }
      
      if (!data) {
        console.warn('⚠️ No data');
        return;
      }

      myStats = {
        level: clampVal(data.level, 1, 9999),
        xp: clampVal(data.xp, 0, 999999999),
        money: clampVal(data.money, 0, 999999999),
        cigarettes: clampVal(data.cigarettes, 0, 999999),
        energy: clampVal(data.energy, 0, 1000),
        max_energy: clampVal(data.max_energy, 100, 1000)
      };

      console.log('✅ My stats:', myStats);
      updateHUD();
    } catch (err) {
      console.error('❌ Error:', err);
    }
  }

  // ===== UPDATE HUD =====
  function updateHUD() {
    if (!myStats) return;
    
    console.log('📊 Updating HUD');
    
    const updates = {
      levelDisplay: myStats.level,
      money: fmtInt(myStats.money),
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
    if (xpText) xpText.textContent = `${fmtInt(myStats.xp)} / ${fmtInt(requiredXP)}`;
    
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
      console.log(`🔥 === LOAD LEADERBOARD (${type}) ===`);
      
      const now = Date.now();
      if (!forceRefresh && leaderboardCache[type].data && 
          (now - leaderboardCache[type].timestamp) < CACHE_DURATION) {
        console.log('✅ Using cache');
        return leaderboardCache[type].data;
      }

      const sb = window.supabaseClient;
      if (!sb) {
        console.warn('⚠️ No Supabase');
        return leaderboardCache[type].data || [];
      }

      let query = sb
        .from('player_stats')
        .select('user_id, level, xp, money');
      
      if (type === 'level') {
        query = query.order('level', { ascending: false })
                     .order('xp', { ascending: false });
      } else {
        query = query.order('money', { ascending: false });
      }
      
      const { data, error } = await query.limit(50);
      
      if (error) {
        console.error('❌ Error:', error);
        showNotification('Chyba při načítání žebříčku', 'error');
        return leaderboardCache[type].data || [];
      }
      
      const sanitizedData = (data || []).map(player => ({
        user_id: String(player.user_id || '').substring(0, 50),
        level: clampVal(player.level, 1, 9999),
        xp: clampVal(player.xp, 0, 999999999),
        money: clampVal(player.money, 0, 999999999)
      }));
      
      leaderboardCache[type] = {
        data: sanitizedData,
        timestamp: now
      };
      
      console.log(`✅ Loaded ${sanitizedData.length} players`);
      return sanitizedData;
    } catch (error) {
      console.error('❌ Error:', error);
      return leaderboardCache[type].data || [];
    }
  }

  // ===== RENDER LEADERBOARD =====
  function renderLeaderboard(players, type = 'level') {
    console.log(`🎨 Rendering ${type} leaderboard`);
    
    const listId = type === 'level' ? 'levelList' : 'wealthList';
    const list = document.getElementById(listId);
    
    if (!list) return;
    
    if (!players || players.length === 0) {
      list.innerHTML = '<div class="no-data">Žádná data</div>';
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
        statsLine = `Level ${player.level} • XP ${fmtInt(player.xp)}`;
        scoreValue = player.level;
      } else {
        statsLine = `Level ${player.level} • XP ${fmtInt(player.xp)}`;
        scoreValue = `${fmtInt(player.money)}₽`;
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
    
    console.log(`✅ Rendered ${players.length} players`);
  }

  // ===== UNSUBSCRIBE REALTIME =====
  function unsubscribePlayerChannel() {
    if (currentPlayerChannel) {
      console.log('🔌 Unsubscribing from player channel');
      const sb = window.supabaseClient;
      if (sb) {
        try {
          sb.removeChannel(currentPlayerChannel);
        } catch (e) {
          console.warn('Warning removing channel:', e);
        }
      }
      currentPlayerChannel = null;
    }
  }

  // ===== SUBSCRIBE TO PLAYER REALTIME =====
  function subscribeToPlayer(userId) {
    unsubscribePlayerChannel();
    
    const sb = window.supabaseClient;
    if (!sb || !userId) return;

    console.log('🔔 Subscribing to player:', userId);

    currentPlayerChannel = sb
      .channel(`player-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_stats',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 Realtime update:', payload);
          if (payload.new) {
            updatePlayerView(payload.new);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });
  }

  // ===== UPDATE PLAYER VIEW =====
  function updatePlayerView(data) {
    console.log('🔄 Updating player view with:', data);
    
    // Update level
    const levelEl = document.getElementById('playerLevel');
    if (levelEl) {
      levelEl.textContent = `Level ${clampVal(data.level, 1, 9999)}`;
    }
    
    // Update stats
    const stats = sanitizeStats(data.stats || {});
    
    ALLOWED_STATS.forEach(stat => {
      const value = clampVal(stats[stat], 0, 9999);
      const statEl = document.getElementById(`stat${stat.charAt(0).toUpperCase() + stat.slice(1)}`);
      const extraEl = document.getElementById(`stat${stat.charAt(0).toUpperCase() + stat.slice(1)}Extra`);
      
      if (statEl) statEl.textContent = value;
      if (extraEl) extraEl.textContent = calculateStatBonus(stat, value);
    });
    
    // Update equipped items
    if (data.equipped) {
      renderEquippedItems(data.equipped);
    }
  }

  // ===== SHOW PLAYER VIEW =====
  async function showPlayerView(player) {
    try {
      console.log('🔥 === SHOW PLAYER VIEW ===');
      console.log('Player:', player);
      
      document.getElementById('leaderboardView').style.display = 'none';
      document.getElementById('playerView').classList.remove('hidden');
      
      const sb = window.supabaseClient;
      if (!sb) {
        console.warn('⚠️ No Supabase');
        showLeaderboardView();
        return;
      }

      // Načti VŠECHNY data hráče
      const { data, error } = await sb
        .from('player_stats')
        .select('*')
        .eq('user_id', player.user_id)
        .single();
      
      if (error) {
        console.error('❌ Error:', error);
        showNotification('Chyba při načítání hráče', 'error');
        showLeaderboardView();
        return;
      }
      
      console.log('📦 Full player data:', data);
      
      const playerData = data;
      
      // Update player name
      const isMe = playerData.user_id === currentUserId;
      const characterName = playerData.stats?.character_name;
      const playerName = isMe 
        ? (characterName || 'TY (BORIS GOPNIKOV)')
        : (characterName || `PLAYER ${playerData.user_id.substring(0, 8).toUpperCase()}`);
      
      document.getElementById('playerName').textContent = playerName;
      
      // Update view with full data
      updatePlayerView(playerData);
      
      // Subscribe to realtime updates
      subscribeToPlayer(player.user_id);
      
      console.log('✅ Player view initialized');
      
    } catch (error) {
      console.error('❌ Error:', error);
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
        const item = getItemById(itemId);
        slot.classList.add('has-item');
        
        if (item && item.emoji) {
          slot.innerHTML = `<span class="slot-item">${item.emoji}</span>`;
        } else {
          slot.innerHTML = `<span class="slot-item">📦</span>`;
        }
      } else {
        slot.classList.remove('has-item');
        slot.innerHTML = `<span class="slot-emoji">${getSlotEmoji(slotName)}</span>`;
      }
    });
  }

  // ===== SHOW LEADERBOARD VIEW =====
  function showLeaderboardView() {
    // Unsubscribe from player updates
    unsubscribePlayerChannel();
    
    document.getElementById('playerView').classList.add('hidden');
    document.getElementById('leaderboardView').style.display = 'flex';
  }

  // ===== TAB SWITCHING =====
  function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', async () => {
        const tabType = tab.dataset.tab;
        
        console.log(`🔄 Switching to ${tabType}`);
        
        tabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        
        const lists = document.querySelectorAll('.leaderboard-list');
        lists.forEach(l => l.classList.remove('active'));
        
        const targetList = document.querySelector(`[data-content="${tabType}"]`);
        if (targetList) {
          targetList.classList.add('active');
          targetList.innerHTML = '<div class="loading-spinner">Načítám...</div>';
        }
        
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
        console.log('🔄 Auto-refresh');
        const tabType = activeTab.dataset.tab;
        const players = await loadLeaderboard(tabType, true);
        renderLeaderboard(players, tabType);
      }
    }, 60000);
  }

  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  }

  // ===== INITIALIZE =====
  async function initialize() {
    console.log('🚀 === ZEBRICEK BOOT ===');
    
    setupTabs();
    setupBackButton();
    
    await loadMyStats();
    
    const players = await loadLeaderboard('level');
    renderLeaderboard(players, 'level');
    
    startAutoRefresh();
    
    window.addEventListener('beforeunload', () => {
      stopAutoRefresh();
      unsubscribePlayerChannel();
    });
    
    console.log('✅ Boot complete!');
  }

  // ===== START =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
