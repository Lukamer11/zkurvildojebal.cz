// postava.js - BEZ ES6 IMPORTS
(() => {
  "use strict";

  // ===== SUPABASE SETUP =====
  const SUPABASE_URL = 'https://jbfvoxlcociwtyobaotz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZnZveGxjb2Npd3R5b2Jhb3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTQ3MTgsImV4cCI6MjA4MzM3MDcxOH0.ydY1I-rVv08Kg76wI6oPgAt9fhUMRZmsFxpc03BhmkA';

  let supabaseClient = null;

  // ===== GRIND TUNING =====
  const STAT_UPGRADE_GAIN = 0.25;
  const UPGRADE_COST_MULT = 1.35;
  const UPGRADE_COST_ADD  = 15;

  // ===== GAME STATE =====
  let gameState = {
    userId: null,
    level: 1,
    xp: 0,
    money: 3170,
    cigarettes: 42,
    energy: 100,
    max_energy: 100,
    stats: {
      strength: 18,
      defense: 14,
      dexterity: 11,
      intelligence: 11,
      constitution: 16,
      luck: 9,
      player_class: "padouch"
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
      ...(window.SHOP_ITEMS.weapons || []),
      ...(window.SHOP_ITEMS.armor || []),
      ...(window.SHOP_ITEMS.special || [])
    ];
  }

  function getItemById(itemId) {
    return getAllItems().find(item => item.id === itemId);
  }

  function getPlayerClass() {
    return (gameState.stats.player_class || localStorage.getItem('sf_class') || 'padouch').toLowerCase();
  }

  function getUpgradeGain(stat) {
    const cls = getPlayerClass();
    if (cls === 'padouch') return 0.25;
    if (cls === 'rvac') {
      if (stat === 'constitution') return 0.35;
      if (stat === 'strength') return 0.20;
      return 0.25;
    }
    if (cls === 'mozek') {
      if (stat === 'strength' || stat === 'intelligence') return 0.35;
      if (stat === 'constitution') return 0.20;
      return 0.25;
    }
    return 0.25;
  }

  function getCritChanceFromDexAndLevel(totalDex, level) {
    const base = Math.floor(totalDex * 0.5);
    const penalty = Math.floor((level - 1) * 0.35);
    return Math.max(1, base - penalty);
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
        return `+${crit}% Crit`;
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
      
      // Inicializace Supabase
      if (window.supabase && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      } else {
        console.error('❌ Supabase library není načtena!');
        showNotification('Chyba: Supabase není k dispozici', 'error');
        return false;
      }
      
      let userId = localStorage.getItem('user_id') || localStorage.getItem('slavFantasyUserId');
      
      if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('slavFantasyUserId', userId);
        localStorage.setItem('user_id', userId);
        console.log('✨ Vytvořen nový user ID:', userId);
      } else {
        console.log('✅ User ID nalezen:', userId);
        localStorage.setItem('slavFantasyUserId', userId);
        localStorage.setItem('user_id', userId);
      }
      
      gameState.userId = userId;
      
      console.log('🔥 Načítám data ze Supabase...');
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
        
        gameState.level = (data.level ?? gameState.level);
        gameState.xp = (data.xp ?? gameState.xp);
        gameState.money = (data.money ?? gameState.money);
        gameState.cigarettes = (data.cigarettes ?? gameState.cigarettes);
        gameState.energy = (data.energy ?? gameState.energy);
        gameState.max_energy = (data.max_energy ?? gameState.max_energy);
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
    try {
      console.log('💾 Ukládám do Supabase...');

      const basePayload = {
        user_id: gameState.userId,
        level: gameState.level,
        xp: gameState.xp,
        money: gameState.money,
        cigarettes: gameState.cigarettes,
        energy: gameState.energy,
        max_energy: gameState.max_energy,
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
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      return false;
    }
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
    const energy = document.getElementById('energy');
    if (money) money.textContent = gameState.money.toLocaleString('cs-CZ');
    if (cigarettes) cigarettes.textContent = gameState.cigarettes;
    if (energy) energy.textContent = gameState.energy;
    
    // Update XP bar
    const requiredXP = getRequiredXP(gameState.level);
    const xpPercent = (gameState.xp / requiredXP) * 100;
    const xpFill = document.getElementById('xpFill');
    const xpText = document.getElementById('xpText');
    if (xpFill) xpFill.style.width = `${xpPercent}%`;
    if (xpText) xpText.textContent = `${gameState.xp} / ${requiredXP}`;
    
    // Update energy bar
    const energyPercent = (gameState.energy / gameState.max_energy) * 100;
    const energyFill = document.getElementById('energyFill');
    const energyText = document.getElementById('energyText');
    if (energyFill) energyFill.style.width = `${energyPercent}%`;
    if (energyText) energyText.textContent = `${gameState.energy} / ${gameState.max_energy}`;
    
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
        luck: 9,
        player_class: "padouch"
      };
    }
    
    Object.keys(gameState.stats).forEach(stat => {
      if (stat === 'player_class') return;
      
      const baseValue = gameState.stats[stat];
      const bonus = bonuses[stat] || 0;
      const totalValue = baseValue + bonus;
      const cost = gameState.upgradeCosts[stat];
      
      const valueElement = document.getElementById(`${stat}Value`);
      const extraElement = document.getElementById(`${stat}Extra`);
      const costElement = document.getElementById(`${stat}Cost`);
      
      if (valueElement) {
        if (bonus !== 0) {
          valueElement.innerHTML = `${baseValue} <span style="color: #4af; font-size: 14px;">+${bonus}</span>`;
        } else {
          valueElement.textContent = baseValue;
        }
      }
      
      if (extraElement) {
        extraElement.textContent = calculateStatBonus(stat, totalValue);
      }
      
      if (costElement) {
        costElement.textContent = `${cost}₽`;
      }
    });
    
    // Render class badge
    renderClassBadgeOnMainAvatar();
    
    console.log('✅ UI aktualizováno');
  }

  // ===== UPGRADE STAT =====
  async function upgradeStat(stat) {
    const cost = gameState.upgradeCosts[stat];
    
    if (gameState.money >= cost) {
      gameState.money -= cost;
      gameState.stats[stat] = +(gameState.stats[stat] + getUpgradeGain(stat)).toFixed(2);
      gameState.upgradeCosts[stat] = Math.floor((cost * UPGRADE_COST_MULT) + UPGRADE_COST_ADD + (gameState.level * 5));
      
      updateUI();
      await saveToSupabase();
      
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

  function renderClassBadgeOnMainAvatar() {
    try {
      const meta = {
        padouch: { icon: '👻', label: 'Padouch' },
        rvac: { icon: '✊', label: 'Rváč' },
        mozek: { icon: '💡', label: 'Mozek' }
      };
      const cls = getPlayerClass();
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
    } catch (err) {
      console.error('Error rendering class badge:', err);
    }
  }

  // ===== TEST: ADD MONEY + XP =====
  document.addEventListener('DOMContentLoaded', () => {
    const menuTop = document.querySelector('.menu-top');
    if (menuTop) {
      menuTop.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        if (clickX > rect.width - 40 && clickY < 40) {
          gameState.money += 1000;
          gameState.xp += 50;
          showNotification('+1000₽ +50 XP přidáno!', 'success');
          updateUI();
          saveToSupabase();
        }
      });
    }
  });

  // ===== AUTO-SAVE =====
  setInterval(async () => {
    if (gameState.userId && supabaseClient) {
      await saveToSupabase();
      console.log('💾 Auto-save completed');
    }
  }, 30000);

  // ===== INITIALIZE ON PAGE LOAD =====
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Spouštím inicializaci...');
    
    if (!window.SHOP_ITEMS) {
      console.warn('⚠️ SHOP_ITEMS not loaded');
    } else {
      console.log('✅ SHOP_ITEMS loaded:', Object.keys(window.SHOP_ITEMS));
    }
    
    showNotification('Načítání hry...', 'success');
    
    const success = await initUser();
    
    if (!success) {
      showNotification('Chyba při načítání!', 'error');
      return;
    }
    
    updateUI();
    showNotification('Hra načtena!', 'success');
    
    console.log('✅ Inicializace dokončena!');
    console.log('📊 Game State:', gameState);
  });

  // ===== EXPOSE FOR HTML ONCLICK =====
  window.upgradeStat = upgradeStat;
  window.gameState = gameState;
  window.getItemById = getItemById;

  console.log('✅ Postava system loaded!');
})();
