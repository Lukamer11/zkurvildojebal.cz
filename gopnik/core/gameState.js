// gameState.js - BEZ ES6 MODULŮ (klasický JavaScript)
// Použij jako: <script src="gameState.js"></script>

(function() {
  "use strict";

  // ===== SUPABASE CLIENT =====
  function getSupabase() {
    const SUPABASE_URL = 'https://bmmaijlbpwgzhrxzxphf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbWFpamxicHdnemhyeHp4cGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NjQ5MDcsImV4cCI6MjA4MjQ0MDkwN30.s0YQVnAjMXFu1pSI1NXZ2naSab179N0vQPglsmy3Pgw';
    
    if (!window._supabaseClient) {
      const { createClient } = window.supabase;
      window._supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window._supabaseClient;
  }

  // ===== GAME STATE MANAGER =====
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

    getPlayerClass() {
      if (!this.state.playerClass) {
        this.state.playerClass = localStorage.getItem('sf_class') || 'padouch';
      }
      return this.state.playerClass.toLowerCase();
    }

    calculateMaxHP() {
      const cls = this.getPlayerClass();
      const con = Number(this.state.stats.constitution || 16);
      
      let maxHp = 500 + (con * 25);
      
      if (cls === 'rvac') maxHp = Math.floor(maxHp * 1.25);
      if (cls === 'mozek') maxHp = Math.floor(maxHp * 0.8);
      
      return Math.max(1, Math.floor(maxHp));
    }

    calculateTotalStats() {
      const bonuses = this.calculateEquipmentBonuses();
      
      const total = {};
      Object.keys(this.state.stats).forEach(stat => {
        total[stat] = this.state.stats[stat] + (bonuses[stat] || 0);
      });
      
      return total;
    }

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

    getItemById(itemId) {
      if (!window.SHOP_ITEMS) return null;
      
      const allItems = [
        ...(window.SHOP_ITEMS.weapons || []),
        ...(window.SHOP_ITEMS.armor || []),
        ...(window.SHOP_ITEMS.special || [])
      ];
      
      return allItems.find(item => String(item.id) === String(itemId));
    }

    async initialize() {
      if (this.initialized) return true;

      try {
        console.log('🔄 Inicializuji GameState...');
        
        let userId = localStorage.getItem('user_id') || 
                     localStorage.getItem('slavFantasyUserId');
        
        if (!userId) {
          userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          localStorage.setItem('slavFantasyUserId', userId);
          localStorage.setItem('user_id', userId);
        }
        
        this.state.userId = userId;
        
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
          console.log('✅ Data loaded from Supabase:', data);
          
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
          
          // ✅ PŘEPOČÍTEJ maxHP podle constitution
          this.state.maxHp = this.calculateMaxHP();
          
          // ✅ OPRAV HP pokud je větší než maxHP
          if (this.state.hp > this.state.maxHp) {
            console.warn('⚠️ HP bylo větší než maxHP, opravuji:', this.state.hp, '->', this.state.maxHp);
            this.state.hp = this.state.maxHp;
            await this.save(); // Ulož opravu
          }
          
          console.log('✅ Final HP:', this.state.hp, '/', this.state.maxHp);
          
        } else {
          console.log('🆕 Nový hráč - vytvářím základní data');
          
          this.state.maxHp = this.calculateMaxHP();
          this.state.hp = this.state.maxHp;
          
          await this.save();
        }
        
        this.initialized = true;
        this.notifyListeners();
        
        return true;
        
      } catch (error) {
        console.error('Error initializing GameState:', error);
        return false;
      }
    }

    async save() {
      try {
        const sb = getSupabase();
        
        this.state.maxHp = this.calculateMaxHP();
        
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
        
        console.log('💾 Saved to Supabase');
        return true;
        
      } catch (error) {
        console.error('Error saving:', error);
        return false;
      }
    }

    autoSave() {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      
      this.saveTimeout = setTimeout(() => {
        this.save();
      }, 2000);
    }

    getState() {
      return { ...this.state };
    }

    get(key) {
      return this.state[key];
    }

    set(key, value, options = {}) {
      this.state[key] = value;
      
      if (key === 'stats' || key === 'stats.constitution') {
        this.state.maxHp = this.calculateMaxHP();
      }
      
      this.notifyListeners();
      
      if (options.save !== false) {
        this.autoSave();
      }
    }

    setMultiple(updates, options = {}) {
      Object.keys(updates).forEach(key => {
        this.state[key] = updates[key];
      });
      
      this.state.maxHp = this.calculateMaxHP();
      
      this.notifyListeners();
      
      if (options.save !== false) {
        this.autoSave();
      }
    }

    addMoney(amount) {
      this.state.money += amount;
      this.notifyListeners();
      this.autoSave();
    }

    addXP(amount) {
      this.state.xp += amount;
      
      const requiredXP = this.getRequiredXP();
      if (this.state.xp >= requiredXP) {
        this.levelUp();
      }
      
      this.notifyListeners();
      this.autoSave();
    }

    getRequiredXP() {
      return Math.floor(100 * Math.pow(1.5, this.state.level - 1));
    }

    levelUp() {
      const requiredXP = this.getRequiredXP();
      this.state.xp -= requiredXP;
      this.state.level++;
      
      const moneyReward = this.state.level * 100;
      const cigaretteReward = Math.floor(this.state.level / 2);
      
      this.state.money += moneyReward;
      this.state.cigarettes += cigaretteReward;
      
      this.state.maxHp = this.calculateMaxHP();
      
      console.log('🎉 LEVEL UP! Level ' + this.state.level);
      
      if (this.state.xp >= this.getRequiredXP()) {
        this.levelUp();
      }
    }

    setHp(hp, maxHp = null) {
      if (maxHp !== null) {
        this.state.maxHp = maxHp;
      }
      
      this.state.hp = Math.max(0, Math.min(hp, this.state.maxHp));
      this.notifyListeners();
      this.autoSave();
    }

    healToFull() {
      this.state.maxHp = this.calculateMaxHP();
      this.state.hp = this.state.maxHp;
      this.notifyListeners();
      this.autoSave();
    }

    subscribe(callback) {
      this.listeners.push(callback);
      
      if (this.initialized) {
        callback(this.state);
      }
      
      return () => {
        this.listeners = this.listeners.filter(l => l !== callback);
      };
    }

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

  // ===== VYTVOŘ SINGLETON =====
  const GameState = new GameStateManager();

  // ===== EXPORT DO WINDOW =====
  window.GameState = GameState;

  // ===== BACKWARD COMPATIBILITY =====
  window.SF = {
    getStats: () => {
      const state = GameState.getState();
      const totalStats = GameState.calculateTotalStats();
      return {
        level: state.level,
        xp: state.xp,
        money: state.money,
        cigarettes: state.cigarettes,
        energy: state.energy,
        hp: state.hp,
        maxHp: state.maxHp,
        ...totalStats
      };
    },
    setHp: (hp, maxHp) => {
      GameState.setHp(hp, maxHp);
    },
    addMoney: (amount) => {
      GameState.addMoney(amount);
    },
    addXP: (amount) => {
      GameState.addXP(amount);
    },
    getPlayerClass: () => {
      return GameState.getPlayerClass();
    },
    setPlayerClass: (cls) => {
      GameState.set('playerClass', cls);
      localStorage.setItem('sf_class', cls);
    },
    setStats: (updates, options = {}) => {
      GameState.setMultiple(updates, options);
    }
  };

  console.log('✅ GameState loaded and exported to window.GameState');

})();
