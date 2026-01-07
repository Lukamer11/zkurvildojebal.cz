// core/gameState.js - CENTRÃLNÃ SYNC SYSTÃM
// Tento soubor zajistÃ­, Å¾e vÅ¡echny strÃ¡nky (postava, arena, shop) majÃ­ STEJNÃ‰ staty

import { getSupabase } from "./supabaseClient.js";

class GameStateManager {
  constructor() {
    this.state = {
      userId: null,
      level: 1,
      xp: 0,
      money: 3170,
      cigarettes: 42,
      energy: 100,
      hp: 1000,
      maxHp: 1000,
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
      },
      playerClass: 'padouch'
    };
    
    this.listeners = [];
    this.saveTimeout = null;
    this.initialized = false;
  }

  // ZÃ­skej tÅ™Ã­du hrÃ¡Äe
  getPlayerClass() {
    if (!this.state.playerClass) {
      this.state.playerClass = localStorage.getItem('sf_class') || 'padouch';
    }
    return this.state.playerClass.toLowerCase();
  }

  // VÃ½poÄet maxHP z constitution + tÅ™Ã­da
  calculateMaxHP() {
    const cls = this.getPlayerClass();
    const con = Number(this.state.stats.constitution || 16);
    
    let maxHp = 500 + (con * 25);
    
    // TÅ™Ã­dnÃ­ multiplikÃ¡tory
    if (cls === 'rvac') maxHp = Math.floor(maxHp * 1.25);
    if (cls === 'mozek') maxHp = Math.floor(maxHp * 0.8);
    
    return Math.max(1, Math.floor(maxHp));
  }

  // VÃ½poÄet celkovÃ½ch statÅ¯ (base + equipment bonuses)
  calculateTotalStats() {
    const bonuses = this.calculateEquipmentBonuses();
    
    const total = {};
    Object.keys(this.state.stats).forEach(stat => {
      total[stat] = this.state.stats[stat] + (bonuses[stat] || 0);
    });
    
    return total;
  }

  // VÃ½poÄet bonusÅ¯ z equipmentu
  calculateEquipmentBonuses() {
    const bonuses = {
      strength: 0,
      defense: 0,
      dexterity: 0,
      intelligence: 0,
      constitution: 0,
      luck: 0
    };
    
    if (!this.state.equipped) return bonuses;
    
    Object.values(this.state.equipped).forEach(itemId => {
      if (!itemId) return;
      
      const item = this.getItemById(itemId);
      if (!item || !item.bonuses) return;
      
      Object.keys(item.bonuses).forEach(stat => {
        if (stat in bonuses) {
          bonuses[stat] += Number(item.bonuses[stat] || 0);
        }
      });
    });
    
    return bonuses;
  }

  // ZÃ­skej item podle ID
  getItemById(itemId) {
    if (!window.SHOP_ITEMS) return null;
    
    const allItems = [
      ...(window.SHOP_ITEMS.weapons || []),
      ...(window.SHOP_ITEMS.armor || []),
      ...(window.SHOP_ITEMS.special || [])
    ];
    
    return allItems.find(item => String(item.id) === String(itemId));
  }

  // Inicializace - naÄti data ze Supabase
  async initialize() {
    if (this.initialized) return true;

    try {
      console.log('ðŸ"„ Inicializuji GameState...');
      
      // ZÃ­skej user ID
      let userId = localStorage.getItem('user_id') || 
                   localStorage.getItem('slavFantasyUserId');
      
      if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('slavFantasyUserId', userId);
        localStorage.setItem('user_id', userId);
      }
      
      this.state.userId = userId;
      
      // NaÄti ze Supabase
      const sb = getSupabase();
      const { data, error } = await sb
        .from('player_stats')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading from Supabase:', error);
      }
      
      if (data) {
        console.log('âœ… Data loaded from Supabase');
        
        // NaÄti vÅ¡echna data
        this.state.level = data.level || 1;
        this.state.xp = data.xp || 0;
        this.state.money = data.money || 3170;
        this.state.cigarettes = data.cigarettes || 42;
        this.state.energy = data.energy || 100;
        this.state.hp = data.hp || 1000;
        
        if (data.stats && typeof data.stats === 'object') {
          this.state.stats = data.stats;
        }
        
        if (data.upgrade_costs) {
          this.state.upgradeCosts = data.upgrade_costs;
        }
        
        if (data.inventory) {
          this.state.inventory = data.inventory;
        }
        
        if (data.equipped) {
          this.state.equipped = data.equipped;
        }
        
        if (data.player_class) {
          this.state.playerClass = data.player_class;
          localStorage.setItem('sf_class', data.player_class);
        }
        
        // PÅ™epoÄÃ­tej maxHP podle constitution
        this.state.maxHp = this.calculateMaxHP();
        
        // Pokud je HP vÄ›tÅ¡Ã­ neÅ¾ maxHP, oprav to
        if (this.state.hp > this.state.maxHp) {
          this.state.hp = this.state.maxHp;
        }
        
      } else {
        console.log('ðŸ†• NovÃ½ hrÃ¡Ä - vytÃ¡Å™Ã­m zÃ¡kladnÃ­ data');
        
        // VÃ½chozÃ­ maxHP
        this.state.maxHp = this.calculateMaxHP();
        this.state.hp = this.state.maxHp;
        
        await this.save();
      }
      
      this.initialized = true;
      this.notifyListeners();
      
      console.log('âœ… GameState inicializovÃ¡n:', this.state);
      return true;
      
    } catch (error) {
      console.error('Error initializing GameState:', error);
      return false;
    }
  }

  // UloÅ¾ do Supabase
  async save() {
    try {
      const sb = getSupabase();
      
      // PÅ™epoÄÃ­tej maxHP pÅ™ed uloÅ¾enÃ­m
      this.state.maxHp = this.calculateMaxHP();
      
      // Oprav HP pokud je mimo rozsah
      if (this.state.hp > this.state.maxHp) {
        this.state.hp = this.state.maxHp;
      }
      if (this.state.hp < 0) {
        this.state.hp = 0;
      }
      
      const payload = {
        user_id: this.state.userId,
        level: this.state.level,
        xp: this.state.xp,
        money: this.state.money,
        cigarettes: this.state.cigarettes,
        energy: this.state.energy,
        hp: this.state.hp,
        max_hp: this.state.maxHp,
        stats: this.state.stats,
        upgrade_costs: this.state.upgradeCosts,
        inventory: this.state.inventory,
        equipped: this.state.equipped,
        player_class: this.state.playerClass,
        updated_at: new Date().toISOString()
      };
      
      const { error } = await sb
        .from('player_stats')
        .upsert(payload, { onConflict: 'user_id' });
      
      if (error) {
        console.error('Error saving to Supabase:', error);
        return false;
      }
      
      console.log('ðŸ'¾ Saved to Supabase');
      return true;
      
    } catch (error) {
      console.error('Error saving:', error);
      return false;
    }
  }

  // Auto-save s debounce (Äeká 2s po poslednÃ­ zmÄ›nÄ›)
  autoSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.save();
    }, 2000);
  }

  // ZÃ­skej celÃ½ state
  getState() {
    return { ...this.state };
  }

  // ZÃ­skej konkrÃ©tnÃ­ hodnotu
  get(key) {
    return this.state[key];
  }

  // Nastav hodnotu
  set(key, value, options = {}) {
    this.state[key] = value;
    
    // PÅ™epoÄÃ­tej maxHP pokud se zmÄ›nila constitution
    if (key === 'stats' || (key === 'stats.constitution')) {
      this.state.maxHp = this.calculateMaxHP();
    }
    
    this.notifyListeners();
    
    if (options.save !== false) {
      this.autoSave();
    }
  }

  // Nastav vÃ­ce hodnot najednou
  setMultiple(updates, options = {}) {
    Object.keys(updates).forEach(key => {
      this.state[key] = updates[key];
    });
    
    // PÅ™epoÄÃ­tej maxHP
    this.state.maxHp = this.calculateMaxHP();
    
    this.notifyListeners();
    
    if (options.save !== false) {
      this.autoSave();
    }
  }

  // PÅ™idej peníze
  addMoney(amount) {
    this.state.money += amount;
    this.notifyListeners();
    this.autoSave();
  }

  // PÅ™idej XP
  addXP(amount) {
    this.state.xp += amount;
    
    // Kontrola level up
    const requiredXP = this.getRequiredXP();
    if (this.state.xp >= requiredXP) {
      this.levelUp();
    }
    
    this.notifyListeners();
    this.autoSave();
  }

  // PotÅ™ebnÃ© XP pro level
  getRequiredXP() {
    return Math.floor(100 * Math.pow(1.5, this.state.level - 1));
  }

  // Level up
  levelUp() {
    const requiredXP = this.getRequiredXP();
    this.state.xp -= requiredXP;
    this.state.level++;
    
    // Odmeny
    const moneyReward = this.state.level * 100;
    const cigaretteReward = Math.floor(this.state.level / 2);
    
    this.state.money += moneyReward;
    this.state.cigarettes += cigareetteReward;
    
    // PÅ™epoÄÃ­tej maxHP pro novÃ½ level
    this.state.maxHp = this.calculateMaxHP();
    
    console.log(`ðŸŽ‰ LEVEL UP! Level ${this.state.level}`);
    
    // Kontrola dalÅ¡Ã­ho level up
    if (this.state.xp >= this.getRequiredXP()) {
      this.levelUp();
    }
  }

  // Nastav HP
  setHp(hp, maxHp = null) {
    if (maxHp !== null) {
      this.state.maxHp = maxHp;
    }
    
    this.state.hp = Math.max(0, Math.min(hp, this.state.maxHp));
    this.notifyListeners();
    this.autoSave();
  }

  // VyléÄ na full HP
  healToFull() {
    this.state.maxHp = this.calculateMaxHP();
    this.state.hp = this.state.maxHp;
    this.notifyListeners();
    this.autoSave();
  }

  // PÅ™idej listener pro zmÄ›ny
  subscribe(callback) {
    this.listeners.push(callback);
    
    // ZaÅ™aÄ vÅ¡echny listenery po inicializaci
    if (this.initialized) {
      callback(this.state);
    }
    
    // VrÃ¡tÃ­ unsubscribe funkci
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  // Upozorni vÅ¡echny listenery
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in listener:', error);
      }
    });
  }
}

// Singleton instance
const GameState = new GameStateManager();

// Export
export { GameState };
export default GameState;