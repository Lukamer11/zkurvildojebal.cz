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

  function formatStatValue(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0';
    const rounded = Math.round(n * 100) / 100;
    const s = String(rounded);
    return s.includes('.') ? rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1') : s;
  }

  function clampVal(v, min = 0, max = 999999999) {
    const num = Number(v ?? 0);
    if (isNaN(num)) return min;
    return Math.max(min, Math.min(max, Math.floor(num)));
  }

  function clampStatVal(v, min = 0, max = 9999) {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) return min;
    const clamped = Math.max(min, Math.min(max, n));
    return Math.round(clamped * 100) / 100;
  }

  // Stejná logika jako v postava.js / arena.js
  function getCritChanceFromDexAndLevel(totalDex, level) {
    const dex = Number(totalDex);
    const lvl = clampVal(level, 1, 9999);
    const safeDex = Number.isFinite(dex) ? dex : 0;
    const base = Math.floor(safeDex * 0.5);
    const penalty = Math.floor((lvl - 1) * 0.35);
    return Math.max(1, base - penalty);
  }

  function getSlotEmoji(slotName) {
    const emojis = {
      weapon: '🗡️', shield: '🛡️', ring: '💍', backpack: '🎒',
      helmet: '🎩', armor: '👕', boots: '👢', gloves: '🧤'
    };
    return emojis[slotName] || '❓';
  }

  // stejný výpočty jako v postava.js / arena.js
  function calculateStatBonus(stat, value, level = 1) {
    const val = Number(value);
    const safe = Number.isFinite(val) ? val : 0;
    const lvl = clampVal(level, 1, 9999);
    
    switch(stat) {
      case 'strength':
        return `+${Math.round(safe * 2)} DMG`;
      case 'defense':
        return `${Math.min(Math.floor((safe / 28) * 100), 100)}% Redukce`;
      case 'dexterity':
        return `+${getCritChanceFromDexAndLevel(safe, lvl)}% Crit`;
      case 'intelligence':
        return `+${Math.floor(safe * 1.5)}% Magie`;
      case 'constitution':
        return `${Math.round(500 + (safe * 25))} HP`;
      case 'luck':
        return `${Math.min(Math.floor(safe), 100)}% / 100%`;
      default:
        return '';
    }
  }

  const ALLOWED_STATS = ['strength','defense','dexterity','intelligence','constitution','luck'];

  function sanitizeStats(input) {
    const src = (input && typeof input === 'object') ? input : {};
    const out = {};
    for (const k of ALLOWED_STATS) {
      out[k] = clampStatVal(src[k], 0, 9999);
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

  // ===== TOOLTIP SYSTEM (stejně jako postava/shop) =====
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
    if (!item) return;
    if (!tooltip) createTooltip();

    let bonusesHTML = '';
    if (item.bonuses && typeof item.bonuses === 'object') {
      bonusesHTML = '<div style="margin-top: 10px; padding-top: 10px; border-top: 2px solid rgba(201,164,74,0.3);">';
      Object.keys(item.bonuses).forEach(stat => {
        const value = Number(item.bonuses[stat] || 0);
        if (!Number.isFinite(value) || value === 0) return;
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
        bonusesHTML += `<div style="color: ${color}; font-weight: 900; font-size: 13px; margin: 3px 0;">${statNames[stat] || stat}: ${sign}${value}</div>`;
      });
      bonusesHTML += '</div>';
    }

    const icon = item.icon ?? item.emoji ?? '📦';
    const name = item.name || 'ITEM';
    const description = item.description || '';
    const price = Number(item.price || 0);
    const sellPrice = Math.floor(price * 0.35);

    tooltip.innerHTML = `
      <div style="font-size: 18px; font-weight: 900; color: #f1d27a; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">
        ${icon} ${name}
      </div>
      <div style="font-size: 12px; color: #c9a44a; margin-bottom: 8px; line-height: 1.4;">${description}</div>
      ${price ? `
        <div style="font-size: 16px; font-weight: 900; color: #f1d27a; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">💰 ${price}₽</div>
        <div style="font-size: 12px; font-weight: 900; color: #ff6b6b; margin-top: 4px;">Prodej: ${sellPrice}₽ (35%)</div>
      ` : ''}
      ${bonusesHTML}
    `;

    tooltip.style.display = 'block';
    tooltip.style.left = (x + 20) + 'px';
    tooltip.style.top = (y - tooltip.offsetHeight / 2) + 'px';
  }

  function hideTooltip() {
    if (tooltip) tooltip.style.display = 'none';
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

  function getItemById(itemRef, row) {
    // když už je to objekt (např. uložená instance), vrať rovnou
    if (itemRef && typeof itemRef === 'object') return itemRef;

    const ALIASES = {
      knife: 'nuz',
      tactical_knife: 'nuz',
      takticky_nuz: 'nuz',
      'takticky-nuz': 'nuz',
    };

    const rawId = String(itemRef || '');
    const id = ALIASES[rawId] || rawId;
    if (!id) return null;

    // zkus nejdřív inventář/equipped objekt, pokud je k dispozici
    const inv = (row?.inventory || []);
    const foundInv = inv.find(x => {
      if (!x) return false;
      if (typeof x === 'object') return x.instance_id === id || x.id === id;
      return String(x) === id;
    });
    if (foundInv && typeof foundInv === 'object') return foundInv;

    const eq = (row?.equipped || {});
    const eqObj = Object.values(eq).find(x => x && typeof x === 'object' && (x.instance_id === id || x.id === id));
    if (eqObj && typeof eqObj === 'object') return eqObj;

    return getAllItems().find(it => String(it.id) === String(id)) || null;
  }

  function calculateTotalBonuses(row) {
    const bonuses = { strength: 0, defense: 0, dexterity: 0, intelligence: 0, constitution: 0, luck: 0 };
    const equipped = (row?.equipped || {});
    Object.values(equipped).forEach(itemRef => {
      if (!itemRef) return;
      const item = getItemById(itemRef, row);
      if (!item || !item.bonuses) return;
      Object.keys(item.bonuses).forEach(stat => {
        if (bonuses[stat] === undefined) return;
        const v = Number(item.bonuses[stat] || 0);
        if (Number.isFinite(v)) bonuses[stat] += v;
      });
    });
    return bonuses;
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
    const lvl = clampVal(data.level, 1, 9999);
    if (levelEl) levelEl.textContent = `Level ${lvl}`;

    // XP + money (pokud je v UI)
    const xpEl = document.getElementById('playerXP');
    const moneyEl = document.getElementById('playerMoney');
    if (xpEl) xpEl.textContent = fmtInt(data.xp);
    if (moneyEl) moneyEl.textContent = fmtInt(data.money);
    
    // Update stats
    const baseStats = sanitizeStats(data.stats || {});
    const bonuses = calculateTotalBonuses(data);
    
    ALLOWED_STATS.forEach(stat => {
      const baseValue = Number(baseStats[stat] ?? 0);
      const bonus = Number(bonuses[stat] ?? 0);
      const totalValue = baseValue + bonus;
      const statEl = document.getElementById(`stat${stat.charAt(0).toUpperCase() + stat.slice(1)}`);
      const extraEl = document.getElementById(`stat${stat.charAt(0).toUpperCase() + stat.slice(1)}Extra`);
      
      if (statEl) {
        if (bonus !== 0) {
          const sign = bonus > 0 ? '+' : '';
          statEl.innerHTML = `${formatStatValue(baseValue)} <span style="color:#4af; font-weight:900;">${sign}${formatStatValue(bonus)}</span>`;
        } else {
          statEl.textContent = formatStatValue(baseValue);
        }
      }
      if (extraEl) extraEl.textContent = calculateStatBonus(stat, totalValue, lvl);
    });
    
    // Update equipped items + tooltips
    renderEquippedItems(data);
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
  function renderEquippedItems(row) {
    const equipped = (row?.equipped || {});
    const slots = document.querySelectorAll('.slot');
    
    slots.forEach(slot => {
      const slotName = slot.dataset.slot;
      const itemId = equipped[slotName];
      
      // zruš starý handlery (aby se neduplikovaly při realtime update)
      slot.onmouseenter = null;
      slot.onmousemove = null;
      slot.onmouseleave = null;

      if (itemId) {
        const item = getItemById(itemId, row);
        slot.classList.add('has-item');

        if (item) {
          const iconHTML = renderItemIconHTML(item.icon ?? item.emoji, item.name);
          slot.innerHTML = `<span class="slot-item">${iconHTML}</span>`;

          // tooltip
          slot.onmouseenter = (e) => showTooltip(item, e.clientX, e.clientY);
          slot.onmousemove = (e) => {
            if (tooltip && tooltip.style.display === 'block') {
              tooltip.style.left = (e.clientX + 20) + 'px';
              tooltip.style.top = (e.clientY - tooltip.offsetHeight / 2) + 'px';
            }
          };
          slot.onmouseleave = hideTooltip;
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
