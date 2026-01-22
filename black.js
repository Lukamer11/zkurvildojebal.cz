// black.js - Černý trh s limity a eventem

(() => {
  "use strict";

  // ===== CONFIG =====
  const EVENT_DAYS = [4, 5, 6]; // Čtvrtek, Pátek, Sobota (0=Neděle)
  const BONUS_MULTIPLIER = 1.5; // +50% atributy
  const MONEY_TO_CIGS_RATE = 1000; // 1000₽ = 1🚬
  const CIGS_TO_MONEY_RATE = 800; // 1🚬 = 800₽
  const MYSTERY_BOX_PRICE = 50000;

  // ===== SUPABASE =====
  const supabaseClient = () => window.supabaseClient || window.SF?.sb;

  async function ensureOnline() {
    if (window.SFReady) await window.SFReady;
    const sb = supabaseClient();
    if (!sb) throw new Error('Supabase client není inicializován');
    return sb;
  }

  // ===== STATE =====
  let gameState = {
    userId: null,
    money: 0,
    cigarettes: 0,
    level: 1,
    inventory: [],
    equipped: {},
    blackMarketItems: [],
    eventStats: {
      purchases: 0,
      moneySpent: 0
    },
    isEventActive: false
  };

  // ===== EVENT TIMING =====
  function isEventActive() {
    const now = new Date();
    const day = now.getDay();
    return EVENT_DAYS.includes(day);
  }

  function getTimeUntilNextEvent() {
    const now = new Date();
    const currentDay = now.getDay();
    
    // Pokud je event aktivní, zobraz čas do konce (do nedělě)
    if (EVENT_DAYS.includes(currentDay)) {
      const sunday = new Date(now);
      sunday.setDate(now.getDate() + (7 - currentDay));
      sunday.setHours(0, 0, 0, 0);
      return sunday - now;
    }
    
    // Jinak najdi další čtvrtek
    let daysUntilThursday = (4 - currentDay + 7) % 7;
    if (daysUntilThursday === 0) daysUntilThursday = 7;
    
    const nextThursday = new Date(now);
    nextThursday.setDate(now.getDate() + daysUntilThursday);
    nextThursday.setHours(0, 0, 0, 0);
    
    return nextThursday - now;
  }

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function updateEventUI() {
    const isActive = isEventActive();
    gameState.isEventActive = isActive;
    
    const lockedOverlay = document.getElementById('blackLocked');
    const container = document.getElementById('blackContainer');
    const timerBox = document.querySelector('.black-timer-box');
    
    if (isActive) {
      if (lockedOverlay) lockedOverlay.classList.remove('active');
      if (container) container.style.display = 'grid';
      if (timerBox) {
        const label = timerBox.querySelector('.timer-label');
        if (label) label.textContent = 'ZBÝVÁ DO KONCE:';
      }
    } else {
      if (lockedOverlay) lockedOverlay.classList.add('active');
      if (container) container.style.display = 'none';
      if (timerBox) {
        const label = timerBox.querySelector('.timer-label');
        if (label) label.textContent = 'DALŠÍ OTEVŘENÍ ZA:';
      }
    }
    
    // Zvýrazni aktivní dny
    document.querySelectorAll('.day-badge').forEach(badge => {
      const day = parseInt(badge.dataset.day);
      if (EVENT_DAYS.includes(day) && isActive && day === new Date().getDay()) {
        badge.classList.add('active');
      } else {
        badge.classList.remove('active');
      }
    });
  }

  function updateTimers() {
    const timeLeft = getTimeUntilNextEvent();
    const formatted = formatTime(timeLeft);
    
    const timerCountdown = document.getElementById('timerCountdown');
    const lockedCountdown = document.getElementById('lockedCountdown');
    const statTimeLeft = document.getElementById('statTimeLeft');
    
    if (timerCountdown) timerCountdown.textContent = formatted;
    if (lockedCountdown) lockedCountdown.textContent = formatted;
    if (statTimeLeft) statTimeLeft.textContent = formatted;
  }

  // ===== ITEM GENERATION =====
  function createExclusiveItem(baseItem, level) {
    const item = JSON.parse(JSON.stringify(baseItem));
    item.instance_id = 'black_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    item.base_id = baseItem.id;
    item.isExclusive = true;
    
    // Bonusy +50%
    if (item.bonuses) {
      Object.keys(item.bonuses).forEach(stat => {
        item.bonuses[stat] = Math.round(item.bonuses[stat] * BONUS_MULTIPLIER);
      });
    }
    
    // Upravená cena (levnější než by měla být)
    const scale = 1 + (Math.max(1, level) - 1) * 0.08;
    item.price = Math.floor((baseItem.price || 0) * scale * 0.7); // 30% sleva
    
    item.level_roll = level;
    return item;
  }

  function generateBlackMarketItems() {
    if (!window.SHOP_ITEMS) return [];
    
    const allItems = [
      ...window.SHOP_ITEMS.weapons,
      ...window.SHOP_ITEMS.armor,
      ...window.SHOP_ITEMS.special
    ];
    
    // Vyber 6 náhodných itemů
    const shuffled = [...allItems].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 6);
    
    return selected.map(item => createExclusiveItem(item, gameState.level));
  }

  // ===== RENDER =====
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

  function renderBlackMarketItems() {
    const grid = document.getElementById('exclusiveGrid');
    if (!grid) return;
    
    grid.innerHTML = gameState.blackMarketItems.map(item => {
      const itemId = item.instance_id || item.id;
      const iconHTML = renderItemIconHTML(item.icon, item.name);
      
      let bonusesText = '';
      if (item.bonuses) {
        const statLabel = { strength: 'síla', defense: 'obrana', constitution: 'výdrž', luck: 'štěstí' };
        const stats = Object.entries(item.bonuses)
          .filter(([stat, value]) => value > 0 && statLabel[stat])
          .map(([stat, value]) => `+${value} ${statLabel[stat]}`)
          .join(', ');
        bonusesText = stats;
      }
      
      return `
        <div class="black-item" data-item-id="${itemId}">
          <div class="black-item-icon">
            ${iconHTML}
          </div>
          <div class="black-item-details">
            <h3>${item.name}</h3>
            <div class="black-item-bonus">💎 +50% Atributy: ${bonusesText}</div>
            <p class="black-item-desc">${item.description}</p>
            <div class="black-item-price">
              <span class="black-price">${item.price.toLocaleString('cs-CZ')}₽</span>
              <button class="black-buy-btn" onclick="buyBlackItem('${itemId}')">
                KOUPIT
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function updateStatsDisplay() {
    const statPurchases = document.getElementById('statPurchases');
    const statMoney = document.getElementById('statMoney');
    
    if (statPurchases) statPurchases.textContent = gameState.eventStats.purchases;
    if (statMoney) statMoney.textContent = gameState.eventStats.moneySpent.toLocaleString('cs-CZ') + '₽';
  }

  function syncCurrencyUI() {
    const money = document.getElementById('money');
    const cigarettes = document.getElementById('cigarettes');
    const energy = document.getElementById('energy');
    
    if (money) money.textContent = gameState.money.toLocaleString('cs-CZ');
    if (cigarettes) cigarettes.textContent = gameState.cigarettes;
    if (energy) energy.textContent = gameState.energy || 100;
    
    // XP Bar
    const xpFill = document.getElementById('xpFill');
    const xpText = document.getElementById('xpText');
    if (xpFill && xpText) {
      const xp = gameState.xp || 0;
      const level = gameState.level || 1;
      const requiredXP = Math.floor(100 * Math.pow(1.5, level - 1));
      const xpPercent = (xp / requiredXP) * 100;
      
      xpFill.style.width = `${xpPercent}%`;
      xpText.textContent = `${xp} / ${requiredXP}`;
    }
    
    // Energy Bar
    const energyFill = document.getElementById('energyFill');
    const energyText = document.getElementById('energyText');
    if (energyFill && energyText) {
      const energy = gameState.energy || 100;
      const maxEnergy = gameState.max_energy || 100;
      const energyPercent = (energy / maxEnergy) * 100;
      
      energyFill.style.width = `${energyPercent}%`;
      energyText.textContent = `${energy} / ${maxEnergy}`;
    }
    
    // Level Display
    const levelDisplay = document.getElementById('levelDisplay');
    if (levelDisplay) levelDisplay.textContent = gameState.level;
  }

  // ===== LOAD DATA =====
  async function loadPlayerData() {
    try {
      const sb = await ensureOnline();
      const userId = window.SF?.user?.id || window.SF?.stats?.user_id;
      
      if (!userId) {
        location.href = 'login.html';
        return;
      }
      
      gameState.userId = userId;
      
      const { data, error } = await sb
        .from('player_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        gameState.money = data.money || 0;
        gameState.cigarettes = data.cigarettes || 0;
        gameState.level = data.level || 1;
        gameState.xp = data.xp || 0;
        gameState.energy = data.energy || 100;
        gameState.max_energy = data.max_energy || 100;
        gameState.inventory = Array.isArray(data.inventory) ? data.inventory : [];
        gameState.equipped = data.equipped || {};
        
        // Load black market stats
        const bmData = data.black_market_data || {};
        gameState.blackMarketItems = bmData.items || generateBlackMarketItems();
        gameState.eventStats = bmData.stats || { purchases: 0, moneySpent: 0 };
        
        // Reset stats if not event day
        if (!isEventActive()) {
          gameState.eventStats = { purchases: 0, moneySpent: 0 };
        }
      }
    } catch (e) {
      console.error('Chyba při načítání dat:', e);
      showNotification('Chyba při načítání dat', 'error');
    }
  }

  async function saveToSupabase() {
    try {
      const sb = await ensureOnline();
      
      const payload = {
        user_id: gameState.userId,
        money: gameState.money,
        cigarettes: gameState.cigarettes,
        inventory: gameState.inventory,
        black_market_data: {
          items: gameState.blackMarketItems,
          stats: gameState.eventStats
        }
      };
      
      const { error } = await sb
        .from('player_stats')
        .upsert(payload, { onConflict: 'user_id' });
      
      if (error) throw error;
      
      // Sync with window.SF
      if (window.SF?.refresh) {
        await window.SF.refresh();
      }
      
      return true;
    } catch (e) {
      console.error('Chyba při ukládání:', e);
      return false;
    }
  }

  // ===== SHOP FUNCTIONS =====
  async function buyBlackItem(itemId) {
    if (!gameState.isEventActive) {
      showNotification('Černý trh není otevřený!', 'error');
      return;
    }
    
    const item = gameState.blackMarketItems.find(i => i.instance_id === itemId || i.id === itemId);
    
    if (!item) {
      showNotification('Item nenalezen!', 'error');
      return;
    }
    
    if (gameState.money < item.price) {
      showNotification('Nemáš dost peněz!', 'error');
      return;
    }
    
    if (gameState.inventory.length >= 8) {
      showNotification('Inventář je plný!', 'error');
      return;
    }
    
    // Buy item
    gameState.money -= item.price;
    gameState.inventory.push(item);
    
    // Update stats
    gameState.eventStats.purchases += 1;
    gameState.eventStats.moneySpent += item.price;
    
    // Remove from shop
    gameState.blackMarketItems = gameState.blackMarketItems.filter(i => i.instance_id !== itemId);
    
    const saved = await saveToSupabase();
    
    if (saved) {
      renderBlackMarketItems();
      syncCurrencyUI();
      updateStatsDisplay();
      showNotification(`${item.name} koupen za ${item.price.toLocaleString('cs-CZ')}₽!`, 'success');
      try { window.SFPlayClick && window.SFPlayClick(); } catch {}
    } else {
      // Rollback
      gameState.money += item.price;
      gameState.inventory.pop();
      gameState.eventStats.purchases -= 1;
      gameState.eventStats.moneySpent -= item.price;
      showNotification('Chyba při ukládání!', 'error');
    }
  }

  async function tradeMoneyForCigs() {
    if (!gameState.isEventActive) {
      showNotification('Černý trh není otevřený!', 'error');
      return;
    }
    
    const cost = 120000;
    const reward = 120;
    
    if (gameState.money < cost) {
      showNotification(`Potřebuješ ${cost.toLocaleString('cs-CZ')}₽!`, 'error');
      return;
    }
    
    gameState.money -= cost;
    gameState.cigarettes += reward;
    
    const saved = await saveToSupabase();
    
    if (saved) {
      syncCurrencyUI();
      showNotification(`Vyměněno! +${reward}🚬`, 'success');
      try { window.SFPlayClick && window.SFPlayClick(); } catch {}
    } else {
      // Rollback
      gameState.money += cost;
      gameState.cigarettes -= reward;
      showNotification('Chyba při ukládání!', 'error');
    }
  }

  async function tradeCigsForMoney() {
    if (!gameState.isEventActive) {
      showNotification('Černý trh není otevřený!', 'error');
      return;
    }
    
    const cost = 100;
    const reward = 80000;
    
    if (gameState.cigarettes < cost) {
      showNotification(`Potřebuješ ${cost}🚬!`, 'error');
      return;
    }
    
    gameState.cigarettes -= cost;
    gameState.money += reward;
    
    const saved = await saveToSupabase();
    
    if (saved) {
      syncCurrencyUI();
      showNotification(`Vyměněno! +${reward.toLocaleString('cs-CZ')}₽`, 'success');
      try { window.SFPlayClick && window.SFPlayClick(); } catch {}
    } else {
      // Rollback
      gameState.cigarettes += cost;
      gameState.money -= reward;
      showNotification('Chyba při ukládání!', 'error');
    }
  }

  async function buyMysteryBox() {
    if (!gameState.isEventActive) {
      showNotification('Černý trh není otevřený!', 'error');
      return;
    }
    
    if (gameState.money < MYSTERY_BOX_PRICE) {
      showNotification(`Potřebuješ ${MYSTERY_BOX_PRICE.toLocaleString('cs-CZ')}₽!`, 'error');
      return;
    }
    
    if (gameState.inventory.length >= 8) {
      showNotification('Inventář je plný!', 'error');
      return;
    }
    
    if (!window.SHOP_ITEMS) {
      showNotification('Items nejsou načteny!', 'error');
      return;
    }
    
    // Random premium item
    const allItems = [
      ...window.SHOP_ITEMS.weapons,
      ...window.SHOP_ITEMS.armor,
      ...window.SHOP_ITEMS.special
    ];
    
    const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
    const mysteryItem = createExclusiveItem(randomItem, gameState.level);
    
    gameState.money -= MYSTERY_BOX_PRICE;
    gameState.inventory.push(mysteryItem);
    
    gameState.eventStats.purchases += 1;
    gameState.eventStats.moneySpent += MYSTERY_BOX_PRICE;
    
    const saved = await saveToSupabase();
    
    if (saved) {
      syncCurrencyUI();
      updateStatsDisplay();
      showNotification(`📦 Otevřel jsi: ${mysteryItem.name}! 💎`, 'success');
      try { window.SFPlayClick && window.SFPlayClick(); } catch {}
    } else {
      // Rollback
      gameState.money += MYSTERY_BOX_PRICE;
      gameState.inventory.pop();
      gameState.eventStats.purchases -= 1;
      gameState.eventStats.moneySpent -= MYSTERY_BOX_PRICE;
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
  async function init() {
    console.log('💀 Initializing Black Market...');
    
    await loadPlayerData();
    
    // Generate items if empty
    if (gameState.blackMarketItems.length === 0) {
      gameState.blackMarketItems = generateBlackMarketItems();
      await saveToSupabase();
    }
    
    updateEventUI();
    renderBlackMarketItems();
    syncCurrencyUI();
    updateStatsDisplay();
    
    // Setup buttons
    const tradeMoney = document.getElementById('tradeMoney');
    const tradeCigs = document.getElementById('tradeCigs');
    const buyMystery = document.getElementById('buyMystery');
    
    if (tradeMoney) tradeMoney.addEventListener('click', tradeMoneyForCigs);
    if (tradeCigs) tradeCigs.addEventListener('click', tradeCigsForMoney);
    if (buyMystery) buyMystery.addEventListener('click', buyMysteryBox);
    
    // Update timers every second
    setInterval(() => {
      updateTimers();
      updateEventUI();
    }, 1000);
    
    // Auto-save every 30s
    setInterval(async () => {
      await saveToSupabase();
      console.log('💾 Auto-save completed');
    }, 30000);
    
    console.log('✅ Black Market initialized!');
  }

  // ===== BOOT =====
  document.addEventListener('DOMContentLoaded', init);

  // Listen to stats updates
  document.addEventListener('sf:stats', async () => {
    await loadPlayerData();
    syncCurrencyUI();
  });

  // ===== EXPOSE FOR HTML =====
  window.buyBlackItem = buyBlackItem;

})();

console.log('✅ Black Market system loaded!');