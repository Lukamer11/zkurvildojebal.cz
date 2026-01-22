// guild.js - KOMPAKTNÍ VERZE S NOVÝMI FUNKCEMI (2026-01-15)
(() => {
  'use strict';

  let supabase = null;

  // ====== CONFIG ======
  const CONFIG = {
    CREATE_COST_CIGS: 100,
    MAX_MEMBERS: 50,
    DONATE_COOLDOWN: 30000, // 30s
    UPGRADE_BASE_COST: 200, // Base cost for upgrades
    MAX_LEVEL: 100, // Max guild level
    MAX_BONUS_PERCENT: 200, // Max bonus 200%
    BOSSES: [
      {
        id: 1,
        name: 'БЛАТНОЙ GOPNIK',
        image: 'bossguild1.jpg',
        health: 5000,
        attack: 150,
        defense: 100,
        reward_exp: 10000,
        reward_cigs: 500
      },
      {
        id: 2,
        name: 'АВТОРИТЕТ',
        image: 'bossguild2.jpg',
        health: 12000,
        attack: 250,
        defense: 180,
        reward_exp: 25000,
        reward_cigs: 1200
      },
      {
        id: 3,
        name: 'ВОР В ЗАКОНЕ',
        image: 'bossguild3.jpg',
        health: 30000,
        attack: 400,
        defense: 300,
        reward_exp: 60000,
        reward_cigs: 3000
      },
      {
        id: 4,
        name: 'СМОТРЯЩИЙ',
        image: 'bossguild4.jpg',
        health: 75000,
        attack: 650,
        defense: 500,
        reward_exp: 150000,
        reward_cigs: 7500
      },
      {
        id: 5,
        name: 'ПОЛОЖЕНЕЦ',
        image: 'bossguild5.jpg',
        health: 200000,
        attack: 1000,
        defense: 800,
        reward_exp: 400000,
        reward_cigs: 20000
      }
    ]
  };

  // ====== PLAYER UTILS ======
  class Player {
    static getUserId() {
      return (
        window.SF?.user?.id ||
        window.SF?.stats?.user_id ||
        null
      );
    }

    static getName() {
      return (
        sessionStorage.getItem('playerName') ||
        sessionStorage.getItem('nickname') ||
        sessionStorage.getItem('nick') ||
        'PLAYER'
      );
    }

    static getMoney() {
      const el = document.getElementById('money');
      if (!el) return 0;
      return Number(el.textContent.replace(/\s|,/g, '')) || 0;
    }

    static getCigs() {
      const el = document.getElementById('cigarettes');
      if (!el) return 0;
      return Number(el.textContent.replace(/\s|,/g, '')) || 0;
    }

    static setMoney(amount) {
      const el = document.getElementById('money');
      if (el) el.textContent = Math.max(0, amount).toLocaleString('cs-CZ');

      if (window.SF && window.SF.setMoney) {
        window.SF.setMoney(Math.max(0, amount));
      }
    }

    static setCigs(amount) {
      const el = document.getElementById('cigarettes');
      if (el) el.textContent = Math.max(0, amount).toLocaleString('cs-CZ');

      if (window.SF && window.SF.setCigarettes) {
        window.SF.setCigarettes(Math.max(0, amount));
      }
    }

    static getLevel() {
      const el = document.getElementById('levelDisplay');
      if (!el) return 1;
      return Number(el.textContent) || 1;
    }
  }

  // ====== UI MANAGER ======
  class UI {
    static showLoading() {
      const loading = document.getElementById('loadingScreen');
      const welcome = document.getElementById('welcomeScreen');
      const browser = document.getElementById('guildBrowser');
      const myGuild = document.getElementById('myGuildView');

      if (loading) loading.style.display = 'flex';
      if (welcome) welcome.style.display = 'none';
      if (browser) browser.style.display = 'none';
      if (myGuild) myGuild.style.display = 'none';
    }

    static hideLoading() {
      const loading = document.getElementById('loadingScreen');
      if (loading) loading.style.display = 'none';
    }

    static showModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add('show');
    }

    static hideModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    }

    static toast(text, type = 'ok', timeout = 3200) {
      const t = document.createElement('div');
      t.className = `guild-toast ${type}`;
      t.textContent = text;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), timeout);
    }

    static formatNumber(num) {
      return Number(num || 0).toLocaleString('cs-CZ');
    }
  }

  // ====== SUPABASE MANAGER ======
  let sb = null;

  class SupabaseManager {
    static async init() {
      if (window.SFReady) {
        try { await window.SFReady; } catch (e) {
          console.warn('[guild] SFReady failed:', e);
        }
      }
      sb = window.SF?.sb || null;
      if (!sb) {
        console.error('[guild] Supabase client není dostupný.');
      }
      return sb;
    }

    static _ensure() {
      if (!sb) throw new Error('Supabase client není inicializovaný');
    }

    static async getUserId() {
      this._ensure();
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      return data?.session?.user?.id || null;
    }

    static async getRow(userId) {
      this._ensure();
      const { data, error } = await sb
        .from('player_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    static async updateStats(userId, statsObj) {
      this._ensure();
      const { error } = await sb
        .from('player_stats')
        .update({ stats: statsObj })
        .eq('user_id', userId);
      if (error) throw error;
    }

    // ====== GUILD API ======
    static async loadGuilds() {
      try {
        this._ensure();
        const { data, error } = await sb
          .from('guilds')
          .select('*')
          .order('level', { ascending: false })
          .limit(100);
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.warn('[guild] loadGuilds failed:', e);
        return [];
      }
    }

    static async loadPlayerGuild(userId) {
      try {
        this._ensure();
        const { data, error } = await sb
          .from('guild_members')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw error;
        return data || null;
      } catch (e) {
        console.warn('[guild] loadPlayerGuild failed:', e);
        return null;
      }
    }

    static async loadGuildMembers(guildId) {
      try {
        this._ensure();
        const { data, error } = await sb
          .from('guild_members')
          .select('*')
          .eq('guild_id', guildId)
          .limit(200);
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.warn('[guild] loadGuildMembers failed:', e);
        return [];
      }
    }

    static async createGuild(g) {
      try {
        this._ensure();

        const name = g?.name;
        const tag = (typeof g?.tag === 'string' && g.tag.trim()) ? g.tag.trim() : null;
        const ownerId = g?.ownerId ?? g?.owner ?? g?.owner_id;

        const base = { name };
        if (tag) base.tag = tag;

        const tries = [
          { ...base, owner_id: ownerId },
          { ...base, owner: ownerId },
          { ...base },
        ];

        let lastError = null;
        for (const row of tries) {
          const { data, error } = await sb
            .from('guilds')
            .insert([row])
            .select('*')
            .maybeSingle();

          if (!error) return data;
          lastError = error;

          const msg = (error?.message || '').toLowerCase();
          if (error?.code === 'PGRST204' || msg.includes('could not find') || msg.includes('column')) {
            continue;
          }
          break;
        }

        throw lastError;
      } catch (e) {
        console.warn('[guild] createGuild failed:', e);
        throw e;
      }
    }

    static async joinGuild(arg1, arg2, arg3) {
      try {
        this._ensure();
        const userId = (arg1 && typeof arg1 === 'object') ? arg1.userId : arg1;
        const guildId = (arg1 && typeof arg1 === 'object') ? arg1.guildId : arg2;
        const role = (arg1 && typeof arg1 === 'object') ? (arg1.role || null) : (arg3 || null);
        const { error } = await sb
          .from('guild_members')
          .insert([{ guild_id: guildId, user_id: userId, ...(role ? { role } : {}) }]);
        if (error) throw error;
      } catch (e) {
        console.warn('[guild] joinGuild failed:', e);
        throw e;
      }
    }

    static async leaveGuild(arg1, arg2) {
      try {
        this._ensure();
        const userId = (arg1 && typeof arg1 === 'object') ? arg1.userId : arg1;
        const guildId = (arg1 && typeof arg1 === 'object') ? arg1.guildId : arg2;
        const { error } = await sb
          .from('guild_members')
          .delete()
          .eq('guild_id', guildId)
          .eq('user_id', userId);
        if (error) throw error;
      } catch (e) {
        console.warn('[guild] leaveGuild failed:', e);
        throw e;
      }
    }

    static async deleteGuild(guildId) {
      try {
        this._ensure();
        await sb.from('guild_members').delete().eq('guild_id', guildId);
        const { error } = await sb.from('guilds').delete().eq('id', guildId);
        if (error) throw error;
      } catch (e) {
        console.warn('[guild] deleteGuild failed:', e);
        throw e;
      }
    }

    static async donate(guildId, type, amount) {
      try {
        this._ensure();
        // Změna: donace jen cigaret
        const field = 'vault_cigs';
        
        const { data: guild } = await sb
          .from('guilds')
          .select(field)
          .eq('id', guildId)
          .single();

        const newVal = (guild?.[field] || 0) + amount;

        const { error } = await sb
          .from('guilds')
          .update({ [field]: newVal })
          .eq('id', guildId);

        if (error) throw error;

        const userId = Player.getUserId();
        await sb
          .from('guild_members')
          .update({ last_donate: Date.now() })
          .eq('guild_id', guildId)
          .eq('user_id', userId);

      } catch (e) {
        console.warn('[guild] donate failed:', e);
        throw e;
      }
    }

    // NEW: Boss Fight System
    static async loadBossProgress(guildId) {
      try {
        this._ensure();
        const { data, error } = await sb
          .from('guild_boss_progress')
          .select('*')
          .eq('guild_id', guildId)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        return data || { 
          guild_id: guildId, 
          current_boss: 1, 
          boss_health: CONFIG.BOSSES[0].health,
          defeated_bosses: []
        };
      } catch (e) {
        console.warn('[guild] loadBossProgress failed:', e);
        return { 
          guild_id: guildId, 
          current_boss: 1, 
          boss_health: CONFIG.BOSSES[0].health,
          defeated_bosses: []
        };
      }
    }

    static async updateBossProgress(guildId, bossId, health, defeated = false) {
      try {
        this._ensure();
        
        const updateData = {
          guild_id: guildId,
          current_boss: bossId,
          boss_health: health,
          last_attack: new Date().toISOString()
        };

        if (defeated) {
          const { data: current } = await sb
            .from('guild_boss_progress')
            .select('defeated_bosses')
            .eq('guild_id', guildId)
            .maybeSingle();

          const defeatedList = current?.defeated_bosses || [];
          if (!defeatedList.includes(bossId)) {
            defeatedList.push(bossId);
          }
          
          updateData.defeated_bosses = defeatedList;
          updateData.current_boss = Math.min(bossId + 1, CONFIG.BOSSES.length);
          updateData.boss_health = CONFIG.BOSSES[Math.min(bossId, CONFIG.BOSSES.length - 1)].health;
        }

        const { error } = await sb
          .from('guild_boss_progress')
          .upsert(updateData, { onConflict: 'guild_id' });

        if (error) throw error;
      } catch (e) {
        console.warn('[guild] updateBossProgress failed:', e);
        throw e;
      }
    }

    static async rewardGuildBoss(guildId, reward) {
      try {
        this._ensure();
        
        const { data: guild } = await sb
          .from('guilds')
          .select('vault_cigs, level')
          .eq('id', guildId)
          .single();

        const newCigs = (guild?.vault_cigs || 0) + reward.cigs;
        const newLevel = Math.min((guild?.level || 1) + Math.floor(reward.exp / 50000), CONFIG.MAX_LEVEL);

        const { error } = await sb
          .from('guilds')
          .update({ 
            vault_cigs: newCigs,
            level: newLevel
          })
          .eq('id', guildId);

        if (error) throw error;
      } catch (e) {
        console.warn('[guild] rewardGuildBoss failed:', e);
        throw e;
      }
    }

    // NEW: PvP Battle System
    static async createPvPBattle(attackerGuildId, defenderGuildId) {
      try {
        this._ensure();
        const { error } = await sb
          .from('guild_pvp_battles')
          .insert([{
            attacker_guild_id: attackerGuildId,
            defender_guild_id: defenderGuildId,
            status: 'active',
            started_at: new Date().toISOString(),
          }]);
        if (error) throw error;
      } catch (e) {
        console.warn('[guild] createPvPBattle failed:', e);
        throw e;
      }
    }

    static async getActiveBattles(guildId) {
      try {
        this._ensure();
        const { data, error } = await sb
          .from('guild_pvp_battles')
          .select('*')
          .or(`attacker_guild_id.eq.${guildId},defender_guild_id.eq.${guildId}`)
          .eq('status', 'active')
          .order('started_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.warn('[guild] getActiveBattles failed:', e);
        return [];
      }
    }

    static async completePvPBattle(battleId, winnerId) {
      try {
        this._ensure();
        const { error } = await sb
          .from('guild_pvp_battles')
          .update({ 
            status: 'completed',
            winner_guild_id: winnerId,
            completed_at: new Date().toISOString()
          })
          .eq('id', battleId);
        
        if (error) throw error;
      } catch (e) {
        console.warn('[guild] completePvPBattle failed:', e);
        throw e;
      }
    }

    // NEW: Guild Upgrade System
    static async upgradeGuild(guildId, upgradeType) {
      try {
        this._ensure();
        const { data: guild, error: fetchError } = await sb
          .from('guilds')
          .select('level, vault_money, vault_cigs')
          .eq('id', guildId)
          .single();

        if (fetchError) throw fetchError;

        const cost = CONFIG.UPGRADE_BASE_COST * (guild.level || 1);
        
        if ((guild.vault_cigs || 0) < cost) {
          throw new Error('Nedostatek cigaret v trezoru');
        }

        const updates = {
          vault_cigs: (guild.vault_cigs || 0) - cost,
          level: (guild.level || 1) + 1,
        };

        const { error: updateError } = await sb
          .from('guilds')
          .update(updates)
          .eq('id', guildId);

        if (updateError) throw updateError;
      } catch (e) {
        console.warn('[guild] upgradeGuild failed:', e);
        throw e;
      }
    }
  }

  // ====== GUILD MANAGER ======
  class GuildManager {
    constructor() {
      this.guilds = [];
      this.playerGuild = null;
      this.playerGuildData = null;
      this.selectedGuildForJoin = null;
      this.searchFilter = '';
      this.bossProgress = null;
      this.currentBossFight = null;
      this.activeBattles = [];
    }

    async init() {
      console.log('🚀 Initializing Guild Manager...');

      UI.showLoading();

      const supabaseOk = await SupabaseManager.init();
      if (!supabaseOk) {
        UI.hideLoading();
        UI.toast('Nepodařilo se připojit k serveru', 'err');
        this.showWelcome();
        return;
      }

      await this.loadData();

      this.setupEventListeners();
      this.updateView();

      UI.hideLoading();
      console.log('✅ Guild Manager initialized');
    }

    async loadData() {
      console.log('📦 Loading all data...');

      this.guilds = await SupabaseManager.loadGuilds();

      const userId = Player.getUserId();
      if (!userId) {
        console.warn('⚠️ Missing userId');
        window.location.href = 'login.html';
        return;
      }
      this.playerGuildData = await SupabaseManager.loadPlayerGuild(userId);

      if (this.playerGuildData) {
        this.playerGuild = this.guilds.find((g) => g.id === this.playerGuildData.guild_id);

        if (this.playerGuild) {
          this.playerGuild.memberList = await SupabaseManager.loadGuildMembers(this.playerGuild.id);
          this.bossProgress = await SupabaseManager.loadBossProgress(this.playerGuild.id);
          this.activeBattles = await SupabaseManager.getActiveBattles(this.playerGuild.id);
        }
      }

      console.log('✅ Data loaded');
    }

    setupEventListeners() {
      const btnSearch = document.getElementById('btnSearchGuild');
      const btnCreate = document.getElementById('btnCreateGuildMain');

      if (btnSearch) {
        btnSearch.addEventListener('click', () => this.showBrowser());
      }

      if (btnCreate) {
        btnCreate.addEventListener('click', () => this.showCreateModal());
      }

      const btnBackBrowser = document.getElementById('btnBackFromBrowser');
      if (btnBackBrowser) {
        btnBackBrowser.addEventListener('click', () => this.showWelcome());
      }

      const btnCancelCreate = document.getElementById('btnCancelCreate');
      const btnConfirmCreate = document.getElementById('btnConfirmCreate');

      if (btnCancelCreate) {
        btnCancelCreate.addEventListener('click', () => UI.hideModal('createModal'));
      }

      if (btnConfirmCreate) {
        btnConfirmCreate.addEventListener('click', () => this.createGuild());
      }

      const btnCancelJoin = document.getElementById('btnCancelJoin');
      const btnConfirmJoin = document.getElementById('btnConfirmJoin');

      if (btnCancelJoin) {
        btnCancelJoin.addEventListener('click', () => {
          UI.hideModal('joinModal');
          this.selectedGuildForJoin = null;
        });
      }

      if (btnConfirmJoin) {
        btnConfirmJoin.addEventListener('click', () => this.joinGuild());
      }

      // Search filter
      const searchInput = document.getElementById('guildSearch');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchFilter = e.target.value.toLowerCase();
          this.renderGuildList();
        });
      }

      // Dynamic listeners
      document.addEventListener('click', (e) => {
        const id = e.target && e.target.id;
        if (id === 'btnLeaveGuild') {
          this.leaveGuild();
        } else if (id === 'btnDeleteGuild') {
          this.deleteGuild();
        } else if (id === 'btnGuildInfo') {
          this.showGuildInfoModal();
        } else if (id === 'btnDonateCigs') {
          this.handleDonate('cigs');
        } else if (id === 'btnGuildCrypta') {
          this.showCryptaModal();
        } else if (id === 'btnGuildPvP') {
          this.showPvPModal();
        } else if (id === 'btnGuildUpgrade') {
          this.showUpgradeModal();
        } else if (id === 'btnConfirmUpgrade') {
          this.upgradeGuild();
        } else if (id === 'btnCancelUpgrade') {
          UI.hideModal('upgradeModal');
        } else if (id === 'btnCloseInfo') {
          UI.hideModal('infoModal');
        } else if (id === 'btnCloseCrypta') {
          UI.hideModal('cryptaModal');
        } else if (id === 'btnAttackBoss') {
          this.attackBoss();
        } else if (id === 'btnClosePvp') {
          UI.hideModal('pvpModal');
        } else if (id === 'btnPvpAttack') {
          this.showPvPAttackMode();
        } else if (id === 'btnPvpDefend') {
          this.showPvPDefendMode();
        } else if (id === 'btnPvpBack') {
          this.showPvPModeSelect();
        }
      });
    }

    updateView() {
      const welcomeScreen = document.getElementById('welcomeScreen');
      const browserScreen = document.getElementById('guildBrowser');
      const myGuildView = document.getElementById('myGuildView');

      if (welcomeScreen) welcomeScreen.style.display = 'none';
      if (browserScreen) browserScreen.style.display = 'none';
      if (myGuildView) myGuildView.style.display = 'none';

      if (this.playerGuild) {
        if (myGuildView) myGuildView.style.display = 'flex';
        this.renderMyGuild();
      } else {
        if (welcomeScreen) welcomeScreen.style.display = 'flex';
      }
    }

    showWelcome() {
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.style.display = 'flex';
      const gb = document.getElementById('guildBrowser');
      if (gb) gb.style.display = 'none';
      const mg = document.getElementById('myGuildView');
      if (mg) mg.style.display = 'none';
    }

    showBrowser() {
      const ws2 = document.getElementById('welcomeScreen');
      if (ws2) ws2.style.display = 'none';
      const gb2 = document.getElementById('guildBrowser');
      if (gb2) gb2.style.display = 'flex';
      const mg = document.getElementById('myGuildView');
      if (mg) mg.style.display = 'none';
      this.renderGuildList();
    }

    renderGuildList() {
      const container = document.getElementById('guildList');
      if (!container) return;

      container.innerHTML = '';

      let filtered = this.guilds;
      if (this.searchFilter) {
        filtered = this.guilds.filter(g => 
          g.name.toLowerCase().includes(this.searchFilter)
        );
      }

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #c9a44a;">
            <div style="font-size: 60px; margin-bottom: 16px;">😢</div>
            <div style="font-size: 18px; font-weight: 900;">Žádné guildy nenalezeny</div>
          </div>
        `;
        return;
      }

      filtered.forEach((guild) => {
        const card = this.createGuildCard(guild);
        container.appendChild(card);
      });
    }

    createGuildCard(guild) {
      const card = document.createElement('div');
      card.className = 'guild-card';

      card.innerHTML = `
        <div class="guild-emblem">${guild.emblem}</div>
        <div class="guild-info">
          <div class="guild-name">${guild.name}</div>
          <div class="guild-stats-mini">
            <span>👥 ${guild.members}/${guild.max_members}</span>
            <span>⚔️ ${UI.formatNumber(guild.power)}</span>
          </div>
        </div>
        <div class="guild-level">LVL ${guild.level}</div>
      `;

      card.addEventListener('click', () => this.showJoinModal(guild));

      return card;
    }

    showJoinModal(guild) {
      this.selectedGuildForJoin = guild;
      
      const modalBody = document.getElementById('joinModalBody');
      if (!modalBody) return;

      modalBody.innerHTML = `
        <div style="text-align: center; margin-bottom: 16px;">
          <div style="width: 80px; height: 80px; margin: 0 auto 12px; border-radius: 14px; background: radial-gradient(circle, rgba(80,85,92,0.95), rgba(40,45,50,0.98)); border: 3px solid #c9a44a; display: grid; place-items: center; font-size: 48px;">
            ${guild.emblem}
          </div>
          <div style="font-size: 20px; font-weight: 900; color: #f1d27a; text-transform: uppercase; margin-bottom: 6px;">
            ${guild.name}
          </div>
          <div style="font-size: 13px; color: #c9a44a;">
            ${guild.description || 'Žádný popis'}
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px;">
          <div style="padding: 12px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px; text-align: center;">
            <div style="font-size: 10px; color: #c9a44a; margin-bottom: 4px; font-weight: 900;">LEVEL</div>
            <div style="font-size: 18px; font-weight: 900; color: #4a9eff;">${guild.level}</div>
          </div>
          <div style="padding: 12px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px; text-align: center;">
            <div style="font-size: 10px; color: #c9a44a; margin-bottom: 4px; font-weight: 900;">ČLENOVÉ</div>
            <div style="font-size: 18px; font-weight: 900; color: #f1d27a;">${guild.members}/${guild.max_members}</div>
          </div>
          <div style="padding: 12px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px; text-align: center;">
            <div style="font-size: 10px; color: #c9a44a; margin-bottom: 4px; font-weight: 900;">POWER</div>
            <div style="font-size: 18px; font-weight: 900; color: #ff6b6b;">${UI.formatNumber(guild.power)}</div>
          </div>
          <div style="padding: 12px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px; text-align: center;">
            <div style="font-size: 10px; color: #c9a44a; margin-bottom: 4px; font-weight: 900;">TREZOR</div>
            <div style="font-size: 14px; font-weight: 900; color: #f1d27a;">🪙 ${UI.formatNumber(guild.vault_money || 0)}</div>
          </div>
        </div>
      `;

      UI.showModal('joinModal');
    }

    async joinGuild() {
      const guild = this.selectedGuildForJoin;
      if (!guild) return;

      if (guild.members >= guild.max_members) {
        UI.toast('Guilda je plná', 'err');
        return;
      }

      UI.showLoading();

      try {
        const userId = Player.getUserId();
        await SupabaseManager.joinGuild(userId, guild.id, 'Member');

        UI.toast(`Připojil ses k ${guild.name}! 🎉`);

        await this.loadData();

        UI.hideModal('joinModal');
        UI.hideLoading();

        this.updateView();
      } catch (err) {
        UI.hideLoading();
        UI.toast('Chyba při připojování k guildě', 'err');
        console.error(err);
      }
    }

    renderMyGuild() {
      const guild = this.playerGuild;
      if (!guild) return;

      const isMaster = this.playerGuildData?.role === 'Master';
      const memberList = guild.memberList || [];

      // Calculate bonuses with 200% cap
      const bonusPercent = Math.min(guild.level * 2, CONFIG.MAX_BONUS_PERCENT);

      // HEADER
      const headerEl = document.getElementById('guildHeaderCompact');
      if (headerEl) {
        headerEl.innerHTML = `
          <div class="guild-emblem-large">${guild.emblem}</div>
          <div class="guild-detail-name">${guild.name}</div>
          <div class="guild-detail-desc">${guild.description || 'Žádný popis'}</div>
          <div class="guild-stats-detail">
            <div class="stat-item">
              <div class="stat-label">LEVEL</div>
              <div class="stat-value">${guild.level}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">POWER</div>
              <div class="stat-value">${UI.formatNumber(guild.power)}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">ČLENOVÉ</div>
              <div class="stat-value">${guild.members}/${guild.max_members}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">BONUS</div>
              <div class="stat-value">+${bonusPercent}%</div>
            </div>
          </div>
        `;
      }

      // VAULT - pouze groše (cigarety)
      const vaultEl = document.getElementById('guildVaultCompact');
      if (vaultEl) {
        vaultEl.innerHTML = `
          <div class="vault-title">🏦 TREZOR GUILDY</div>
          <div class="vault-stats">
            <div class="vault-item">
              <div class="vault-value">🚬 ${UI.formatNumber(guild.vault_cigs || 0)}</div>
              <div class="vault-label">GROŠE</div>
            </div>
            <div class="vault-item">
              <div class="vault-value">${this.bossProgress ? this.bossProgress.current_boss : 1}</div>
              <div class="vault-label">BOSS TIER</div>
            </div>
          </div>
          <div class="donate-inputs">
            <div class="donate-group" style="grid-column: span 2;">
              <input type="number" id="donateCigsInput" placeholder="Kolik grošů přispět?" min="0">
              <button id="btnDonateCigs">🚬 PŘISPĚT GROŠE</button>
            </div>
          </div>
        `;
      }

      // PERKS - max 200%
      const perksEl = document.getElementById('guildPerksCompact');
      if (perksEl) {
        const attackBonus = Math.min(guild.level * 2, CONFIG.MAX_BONUS_PERCENT);
        const defenseBonus = Math.min(guild.level * 2, CONFIG.MAX_BONUS_PERCENT);
        const cigsBonus = Math.min(guild.level * 2, CONFIG.MAX_BONUS_PERCENT);
        const energyBonus = Math.min(Math.floor(guild.level / 2), 100);

        const perks = [
          { icon: '⚔️', name: 'Bonus útok', desc: `+${attackBonus}% útok` },
          { icon: '🛡️', name: 'Bonus obrana', desc: `+${defenseBonus}% obrana` },
          { icon: '🚬', name: 'Bonus groše', desc: `+${cigsBonus}% groše` },
          { icon: '⚡', name: 'Bonus energie', desc: `+${energyBonus} max energie` },
        ];

        perksEl.innerHTML = `
          <div class="perks-title">🎁 BONUSY GUILDY</div>
          <div class="perks-list">
            ${perks.map(p => `
              <div class="perk-item">
                <div class="perk-icon">${p.icon}</div>
                <div class="perk-info">
                  <div class="perk-name">${p.name}</div>
                  <div class="perk-desc">${p.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

      // MEMBERS
      const memberCountEl = document.getElementById('memberCount');
      if (memberCountEl) {
        memberCountEl.textContent = `${guild.members}/${guild.max_members}`;
      }

      const membersListEl = document.getElementById('membersListCompact');
      if (membersListEl) {
        const icons = ['👑', '⚔️', '🛡️', '🏹', '🔮', '⚡', '🎯', '💎', '🌟', '🔥'];
        
        membersListEl.innerHTML = memberList.map((m, i) => `
          <div class="member-card">
            <div class="member-avatar">${icons[i % icons.length]}</div>
            <div class="member-info">
              <div class="member-name">${m.user_id.substring(0, 8)}...</div>
              <div class="member-role">${m.role || 'Member'}</div>
            </div>
            <div class="member-level">LVL ${m.level || 1}</div>
          </div>
        `).join('');
      }

      // ACTIONS - nová tlačítka
      const actionsEl = document.getElementById('guildActionsCompact');
      if (actionsEl) {
        const hasActiveBattle = this.activeBattles.length > 0;
        
        actionsEl.innerHTML = `
          <button class="guild-btn" id="btnGuildInfo">📊 INFO</button>
          <button class="guild-btn primary" id="btnGuildCrypta">🏛️ CRYPTA</button>
          <button class="guild-btn ${hasActiveBattle ? 'danger' : ''}" id="btnGuildPvP">${hasActiveBattle ? '🔔' : '⚔️'} PVP</button>
          <button class="guild-btn primary" id="btnGuildUpgrade">⬆️ UP</button>
          ${isMaster ? `
            <button class="guild-btn danger" id="btnDeleteGuild" style="grid-column: span 2;">🗑️ ROZPUSTIT</button>
          ` : `
            <button class="guild-btn danger" id="btnLeaveGuild" style="grid-column: span 2;">❌ OPUSTIT</button>
          `}
        `;
      }
    }

    async handleDonate(type) {
      const lastDonate = this.playerGuildData?.last_donate || 0;

      if (Date.now() - lastDonate < CONFIG.DONATE_COOLDOWN) {
        UI.toast('Počkej chvíli před dalším příspěvkem', 'err');
        return;
      }

      const guild = this.playerGuild;
      if (!guild) return;

      const inputId = 'donateCigsInput';
      const input = document.getElementById(inputId);
      const amount = Math.max(0, parseInt(input?.value, 10) || 0);

      if (amount <= 0) {
        UI.toast('Zadej platnou částku', 'err');
        return;
      }

      const playerCigs = Player.getCigs();
      if (playerCigs < amount) {
        UI.toast('Nemáš tolik grošů', 'err');
        return;
      }

      UI.showLoading();

      try {
        await SupabaseManager.donate(guild.id, 'cigs', amount);

        const newAmount = playerCigs - amount;
        Player.setCigs(newAmount);
        UI.toast(`Přispěl jsi ${UI.formatNumber(amount)} 🚬`);

        if (input) input.value = '';

        await this.loadData();
        this.renderMyGuild();

        UI.hideLoading();
      } catch (err) {
        UI.hideLoading();
        UI.toast('Chyba při vkládání příspěvku', 'err');
        console.error(err);
      }
    }

    showCreateModal() {
      const cost = CONFIG.CREATE_COST_CIGS;
      if (Player.getCigs() < cost) {
        UI.toast(`Potřebuješ ${cost} 🚬 cigaret`, 'err');
        return;
      }

      UI.showModal('createModal');

      const nameInput = document.getElementById('inputGuildName');
      if (nameInput) nameInput.value = '';
      const descInput = document.getElementById('inputGuildDesc');
      if (descInput) descInput.value = '';
      const emojiInput = document.getElementById('inputGuildEmoji');
      if (emojiInput) emojiInput.value = '🏰';
    }

    async createGuild() {
      const name = document.getElementById('inputGuildName')?.value.trim() || '';
      const desc = document.getElementById('inputGuildDesc')?.value.trim() || '';
      const emblem = document.getElementById('inputGuildEmoji')?.value.trim() || '🏰';

      if (name.length < 3) {
        UI.toast('Název musí mít alespoň 3 znaky', 'err');
        return;
      }

      if (this.guilds.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
        UI.toast('Guilda s tímto názvem už existuje', 'err');
        return;
      }

      const cost = CONFIG.CREATE_COST_CIGS;
      const playerCigs = Player.getCigs();
      if (playerCigs < cost) {
        UI.toast(`Potřebuješ ${cost} 🚬 cigaret`, 'err');
        return;
      }

      UI.showLoading();

      try {
        const playerLevel = Player.getLevel();
        const userId = Player.getUserId();

        const newGuild = {
          name: name.toUpperCase(),
          emblem,
          description: desc || 'Nová guilda!',
          level: 1,
          members: 1,
          max_members: CONFIG.MAX_MEMBERS,
          power: playerLevel * 100,
          vault_money: 0,
          vault_cigs: 0,
          owner: userId,
        };

        const createdGuild = await SupabaseManager.createGuild(newGuild);
        await SupabaseManager.joinGuild(userId, createdGuild.id, 'Master');

        Player.setCigs(playerCigs - cost);

        UI.toast(`Guilda "${createdGuild.name}" vytvořena! 🎉`);

        await this.loadData();

        UI.hideModal('createModal');
        UI.hideLoading();

        this.updateView();
      } catch (err) {
        UI.hideLoading();
        UI.toast('Chyba při vytváření guildy', 'err');
        console.error(err);
      }
    }

    async leaveGuild() {
      if (!confirm('Opravdu chceš opustit guildu?')) return;

      const guild = this.playerGuild;
      if (!guild) return;

      UI.showLoading();

      try {
        const userId = Player.getUserId();
        await SupabaseManager.leaveGuild(userId, guild.id);

        UI.toast('Opustil jsi guildu', 'ok');

        await this.loadData();

        UI.hideLoading();
        this.updateView();
      } catch (err) {
        UI.hideLoading();
        UI.toast('Chyba při opouštění guildy', 'err');
        console.error(err);
      }
    }

    async deleteGuild() {
      if (this.playerGuildData?.role !== 'Master') {
        UI.toast('Pouze Master může rozpustit guildu', 'err');
        return;
      }

      if (!confirm('OPRAVDU chceš rozpustit guildu?')) return;

      const guild = this.playerGuild;
      if (!guild) return;

      UI.showLoading();

      try {
        await SupabaseManager.deleteGuild(guild.id);

        UI.toast('Guilda byla rozpuštěna', 'ok');

        await this.loadData();

        UI.hideLoading();
        this.updateView();
      } catch (err) {
        UI.hideLoading();
        UI.toast('Chyba při rozpouštění guildy', 'err');
        console.error(err);
      }
    }

    showGuildInfoModal() {
      const guild = this.playerGuild;
      if (!guild) return;

      const modalBody = document.getElementById('infoModalBody');
      if (!modalBody) return;

      const memberList = guild.memberList || [];
      const avgLevel = memberList.length > 0
        ? Math.floor(memberList.reduce((sum, m) => sum + (m.level || 1), 0) / memberList.length)
        : 0;
      
      const bonusPercent = Math.min(guild.level * 2, CONFIG.MAX_BONUS_PERCENT);
      const totalPower = memberList.reduce((sum, m) => sum + ((m.level || 1) * 100), 0);
      
      const defeatedBosses = this.bossProgress?.defeated_bosses || [];
      const currentBoss = this.bossProgress?.current_boss || 1;

      modalBody.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">
          <div style="padding: 14px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; color: #c9a44a; margin-bottom: 6px; font-weight: 900;">LEVEL GUILDY</div>
            <div style="font-size: 24px; font-weight: 900; color: #4a9eff;">${guild.level}</div>
          </div>
          <div style="padding: 14px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; color: #c9a44a; margin-bottom: 6px; font-weight: 900;">MAX BONUS</div>
            <div style="font-size: 24px; font-weight: 900; color: #f1d27a;">+${bonusPercent}%</div>
          </div>
          <div style="padding: 14px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; color: #c9a44a; margin-bottom: 6px; font-weight: 900;">ČLENŮ</div>
            <div style="font-size: 24px; font-weight: 900; color: #f1d27a;">${guild.members}/${guild.max_members}</div>
          </div>
          <div style="padding: 14px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; color: #c9a44a; margin-bottom: 6px; font-weight: 900;">ØVG LEVEL</div>
            <div style="font-size: 24px; font-weight: 900; color: #4a9eff;">${avgLevel}</div>
          </div>
          <div style="padding: 14px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; color: #c9a44a; margin-bottom: 6px; font-weight: 900;">CELKOVÁ SÍLA</div>
            <div style="font-size: 20px; font-weight: 900; color: #ff6b6b;">${UI.formatNumber(totalPower)}</div>
          </div>
          <div style="padding: 14px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; color: #c9a44a; margin-bottom: 6px; font-weight: 900;">TREZOR</div>
            <div style="font-size: 18px; font-weight: 900; color: #f1d27a;">🚬 ${UI.formatNumber(guild.vault_cigs || 0)}</div>
          </div>
        </div>

        <div style="padding: 14px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px; margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 900; color: #f1d27a; margin-bottom: 10px; text-align: center;">🏛️ CRYPTA PROGRESS</div>
          <div style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;">
            ${CONFIG.BOSSES.map((boss, idx) => {
              const bossNum = idx + 1;
              const isDefeated = defeatedBosses.includes(bossNum);
              const isCurrent = bossNum === currentBoss;
              const isLocked = bossNum > currentBoss;
              
              return `
                <div style="padding: 8px 12px; background: ${isDefeated ? 'rgba(74, 158, 255, 0.2)' : isLocked ? 'rgba(0,0,0,0.5)' : 'rgba(255, 107, 107, 0.2)'}; border: 2px solid ${isDefeated ? '#4a9eff' : isLocked ? '#666' : '#ff6b6b'}; border-radius: 8px; text-align: center; min-width: 60px;">
                  <div style="font-size: 11px; color: ${isDefeated ? '#4a9eff' : isLocked ? '#666' : '#ff6b6b'}; font-weight: 900;">BOSS ${bossNum}</div>
                  <div style="font-size: 20px; margin: 4px 0;">${isDefeated ? '✅' : isLocked ? '🔒' : isCurrent ? '⚔️' : '❌'}</div>
                  <div style="font-size: 9px; color: #c9a44a;">${boss.name.substring(0, 10)}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="padding: 14px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px;">
          <div style="font-size: 13px; font-weight: 900; color: #f1d27a; margin-bottom: 10px; text-align: center;">💡 TIPY</div>
          <ul style="font-size: 11px; color: #c9a44a; line-height: 1.8; padding-left: 20px;">
            <li>Každý level guildy zvyšuje všechny bonusy o 2% (max 200%)</li>
            <li>Poraz bossy v Cryptě pro obrovské odměny</li>
            <li>PvP bitvy proti jiným guildám ti přinesou slávu</li>
            <li>Přispívej groše do trezoru pro vylepšení guildy</li>
          </ul>
        </div>
      `;

      UI.showModal('infoModal');
    }

    showCryptaModal() {
      const guild = this.playerGuild;
      if (!guild) return;

      const memberList = guild.memberList || [];
      if (memberList.length === 0) {
        UI.toast('Guilda nemá žádné členy!', 'err');
        return;
      }

      const currentBossId = this.bossProgress?.current_boss || 1;
      const bossData = CONFIG.BOSSES[currentBossId - 1];
      
      if (!bossData) {
        UI.toast('Všichni bossové poraženi! 🎉', 'ok');
        return;
      }

      this.currentBossFight = {
        boss: { ...bossData },
        bossCurrentHealth: this.bossProgress?.boss_health || bossData.health,
        fighters: memberList.map((m, idx) => ({
          ...m,
          currentHealth: (m.level || 1) * 100,
          maxHealth: (m.level || 1) * 100,
          isActive: idx === 0,
          isDead: false
        })),
        activeFighterIndex: 0,
        battleLog: []
      };

      this.renderCrypta();
      UI.showModal('cryptaModal');
    }

    renderCrypta() {
      if (!this.currentBossFight) return;

      const { boss, bossCurrentHealth, fighters } = this.currentBossFight;
      const bossHealthPercent = (bossCurrentHealth / boss.health) * 100;

      const bossAvatar = document.getElementById('bossAvatar');
      if (bossAvatar) {
        bossAvatar.style.backgroundImage = `url('${boss.image}')`;
      }

      const bossName = document.getElementById('bossName');
      if (bossName) {
        bossName.textContent = boss.name;
      }

      const bossHealthFill = document.getElementById('bossHealthFill');
      if (bossHealthFill) {
        bossHealthFill.style.width = `${bossHealthPercent}%`;
      }

      const bossHealthText = document.getElementById('bossHealthText');
      if (bossHealthText) {
        bossHealthText.textContent = `${UI.formatNumber(bossCurrentHealth)} / ${UI.formatNumber(boss.health)}`;
      }

      const bossStats = document.getElementById('bossStats');
      if (bossStats) {
        bossStats.innerHTML = `
          <div class="boss-stat-item">
            <div class="boss-stat-label">ÚTOK</div>
            <div class="boss-stat-value">${boss.attack}</div>
          </div>
          <div class="boss-stat-item">
            <div class="boss-stat-label">OBRANA</div>
            <div class="boss-stat-value">${boss.defense}</div>
          </div>
        `;
      }

      const fightersList = document.getElementById('fightersList');
      if (fightersList) {
        const icons = ['👑', '⚔️', '🛡️', '🏹', '🔮', '⚡', '🎯', '💎', '🌟', '🔥'];
        
        fightersList.innerHTML = fighters.map((f, idx) => {
          const healthPercent = (f.currentHealth / f.maxHealth) * 100;
          return `
            <div class="fighter-card ${f.isActive ? 'active' : ''} ${f.isDead ? 'defeated' : ''}">
              <div class="fighter-avatar">${icons[idx % icons.length]}</div>
              <div class="fighter-info">
                <div class="fighter-name">${f.user_id.substring(0, 10)}...</div>
                <div class="fighter-health-bar">
                  <div class="fighter-health-fill" style="width: ${healthPercent}%"></div>
                </div>
                <div class="fighter-stats">
                  <span>❤️ ${Math.floor(f.currentHealth)}/${f.maxHealth}</span>
                  <span>⚔️ ${(f.level || 1) * 10}</span>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    async attackBoss() {
      if (!this.currentBossFight) return;

      const { boss, fighters, activeFighterIndex } = this.currentBossFight;
      const currentFighter = fighters[activeFighterIndex];

      if (!currentFighter || currentFighter.isDead) return;

      UI.showLoading();

      // Fighter attacks boss
      const fighterAttack = (currentFighter.level || 1) * 10;
      const damageТoBoss = Math.max(1, fighterAttack - Math.floor(boss.defense / 10));
      
      this.currentBossFight.bossCurrentHealth = Math.max(0, this.currentBossFight.bossCurrentHealth - damageТoBoss);

      // Boss attacks fighter
      if (this.currentBossFight.bossCurrentHealth > 0) {
        const bossAttack = boss.attack;
        const damageToFighter = Math.max(1, bossAttack - Math.floor((currentFighter.level || 1) * 5));
        
        currentFighter.currentHealth = Math.max(0, currentFighter.currentHealth - damageToFighter);

        if (currentFighter.currentHealth <= 0) {
          currentFighter.isDead = true;
          currentFighter.isActive = false;

          // Find next alive fighter
          const nextFighterIndex = fighters.findIndex((f, idx) => idx > activeFighterIndex && !f.isDead);
          
          if (nextFighterIndex >= 0) {
            this.currentBossFight.activeFighterIndex = nextFighterIndex;
            fighters[nextFighterIndex].isActive = true;
          } else {
            // All fighters dead - defeat
            UI.hideLoading();
            UI.toast('Všichni bojovníci padli! 💀', 'err');
            setTimeout(() => {
              UI.hideModal('cryptaModal');
            }, 2000);
            return;
          }
        }
      }

      // Check if boss defeated
      if (this.currentBossFight.bossCurrentHealth <= 0) {
        try {
          await SupabaseManager.updateBossProgress(
            this.playerGuild.id,
            boss.id,
            0,
            true
          );

          await SupabaseManager.rewardGuildBoss(this.playerGuild.id, {
            exp: boss.reward_exp,
            cigs: boss.reward_cigs
          });

          UI.hideLoading();
          UI.toast(`🎉 BOSS PORAŽEN! +${UI.formatNumber(boss.reward_exp)} EXP, +${UI.formatNumber(boss.reward_cigs)} 🚬`, 'ok', 5000);

          await this.loadData();
          
          setTimeout(() => {
            UI.hideModal('cryptaModal');
            this.renderMyGuild();
          }, 3000);
        } catch (err) {
          UI.hideLoading();
          UI.toast('Chyba při ukládání progressu', 'err');
          console.error(err);
        }
      } else {
        // Save boss progress
        try {
          await SupabaseManager.updateBossProgress(
            this.playerGuild.id,
            boss.id,
            this.currentBossFight.bossCurrentHealth,
            false
          );
        } catch (err) {
          console.warn('Failed to save boss progress:', err);
        }

        UI.hideLoading();
        this.renderCrypta();
      }
    }

    showPvPModal() {
      UI.showModal('pvpModal');
      this.showPvPModeSelect();
    }

    showPvPModeSelect() {
      const modeSelect = document.getElementById('pvpModeSelect');
      const guildSelect = document.getElementById('pvpGuildSelect');
      const battleArena = document.getElementById('pvpBattleArena');

      if (modeSelect) modeSelect.style.display = 'grid';
      if (guildSelect) guildSelect.style.display = 'none';
      if (battleArena) battleArena.style.display = 'none';
    }

    showPvPAttackMode() {
      const modeSelect = document.getElementById('pvpModeSelect');
      const guildSelect = document.getElementById('pvpGuildSelect');
      
      if (modeSelect) modeSelect.style.display = 'none';
      if (guildSelect) guildSelect.style.display = 'block';

      this.renderPvPGuildsList();
    }

    showPvPDefendMode() {
      if (this.activeBattles.length === 0) {
        UI.toast('Žádné aktivní bitvy k obraně', 'err');
        return;
      }

      const battle = this.activeBattles[0];
      this.startPvPBattle(battle);
    }

    renderPvPGuildsList() {
      const listEl = document.getElementById('pvpGuildsList');
      if (!listEl) return;

      const attackableGuilds = this.guilds.filter(g => g.id !== this.playerGuild?.id);

      listEl.innerHTML = attackableGuilds.map(g => `
        <div class="pvp-guild-card" onclick="window.guildManager.selectPvPTarget('${g.id}')">
          <div class="guild-emblem">${g.emblem}</div>
          <div class="guild-info">
            <div class="guild-name">${g.name}</div>
            <div class="guild-stats-mini">
              <span>👥 ${g.members}</span>
              <span>⚔️ ${UI.formatNumber(g.power)}</span>
            </div>
          </div>
          <div class="guild-level">LVL ${g.level}</div>
        </div>
      `).join('');
    }

    async selectPvPTarget(targetGuildId) {
      UI.showLoading();

      try {
        await SupabaseManager.createPvPBattle(this.playerGuild.id, targetGuildId);
        
        const battle = {
          attacker_guild_id: this.playerGuild.id,
          defender_guild_id: targetGuildId
        };

        UI.hideLoading();
        this.startPvPBattle(battle);
      } catch (err) {
        UI.hideLoading();
        UI.toast('Chyba při vytváření bitvy', 'err');
        console.error(err);
      }
    }

    startPvPBattle(battle) {
      const attackerGuild = this.guilds.find(g => g.id === battle.attacker_guild_id);
      const defenderGuild = this.guilds.find(g => g.id === battle.defender_guild_id);

      if (!attackerGuild || !defenderGuild) {
        UI.toast('Chyba při načítání guild', 'err');
        return;
      }

      const modeSelect = document.getElementById('pvpModeSelect');
      const guildSelect = document.getElementById('pvpGuildSelect');
      const battleArena = document.getElementById('pvpBattleArena');

      if (modeSelect) modeSelect.style.display = 'none';
      if (guildSelect) guildSelect.style.display = 'none';
      if (battleArena) {
        battleArena.style.display = 'block';
        
        battleArena.innerHTML = `
          <div class="battle-header">
            <div class="battle-title">⚔️ GUILD BATTLE ⚔️</div>
            <div style="font-size: 14px; color: #c9a44a; text-align: center;">
              ${attackerGuild.emblem} ${attackerGuild.name} VS ${defenderGuild.emblem} ${defenderGuild.name}
            </div>
          </div>

          <div style="text-align: center; padding: 40px; color: #c9a44a;">
            <div style="font-size: 60px; margin-bottom: 16px;">⚔️</div>
            <div style="font-size: 18px; font-weight: 900;">PvP SYSTÉM V PŘÍPRAVĚ</div>
            <div style="font-size: 14px; margin-top: 12px;">Brzy budete moci bojovat proti jiným guildám!</div>
            <div style="font-size: 12px; margin-top: 8px; color: #4a9eff;">
              Systém kolo po kole jako v Shakes & Fidget
            </div>
          </div>
        `;
      }
    }
  

    showUpgradeModal() {
      const guild = this.playerGuild;
      if (!guild) return;

      const cost = CONFIG.UPGRADE_BASE_COST * guild.level;

      const modalBody = document.getElementById('upgradeModalBody');
      if (!modalBody) return;

      modalBody.innerHTML = `
        <div class="modal-info">
          <p>💰 Cena vylepšení: <strong>${UI.formatNumber(cost)} 🚬 cigaret z trezoru</strong></p>
        </div>
        <div style="padding: 14px; background: rgba(0,0,0,0.3); border-radius: 10px; border: 2px solid #5a4520; margin-top: 12px;">
          <div style="font-size: 13px; font-weight: 900; color: #f1d27a; margin-bottom: 10px; text-align: center;">
            📊 PO VYLEPŠENÍ
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; text-align: center;">
              <div style="font-size: 10px; color: #c9a44a; margin-bottom: 4px;">LEVEL</div>
              <div style="font-size: 18px; font-weight: 900; color: #4a9eff;">${guild.level} → ${guild.level + 1}</div>
            </div>
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; text-align: center;">
              <div style="font-size: 10px; color: #c9a44a; margin-bottom: 4px;">BONUS XP</div>
              <div style="font-size: 18px; font-weight: 900; color: #f1d27a;">+${Math.floor(guild.level * 0.5) + 5}% → +${Math.floor((guild.level + 1) * 0.5) + 5}%</div>
            </div>
          </div>
          <div style="margin-top: 10px; font-size: 11px; color: #c9a44a; text-align: center;">
            ✨ Všechny bonusy se zvýší o ${guild.level + 1}%
          </div>
        </div>
        <div style="margin-top: 12px; padding: 10px; background: rgba(74, 158, 255, 0.15); border: 2px solid rgba(74, 158, 255, 0.3); border-radius: 8px; font-size: 11px; color: #4a9eff; text-align: center;">
          💎 Trezor: ${UI.formatNumber(guild.vault_cigs || 0)} 🚬 / Potřeba: ${UI.formatNumber(cost)} 🚬
        </div>
      `;

      UI.showModal('upgradeModal');
    }

    async upgradeGuild() {
      const guild = this.playerGuild;
      if (!guild) return;

      const cost = CONFIG.UPGRADE_BASE_COST * guild.level;

      if ((guild.vault_cigs || 0) < cost) {
        UI.toast('Nedostatek cigaret v trezoru', 'err');
        return;
      }

      UI.showLoading();

      try {
        await SupabaseManager.upgradeGuild(guild.id);

        UI.toast(`Guilda vylepšena na level ${guild.level + 1}! 🎉`, 'ok');

        await this.loadData();
        this.renderMyGuild();

        UI.hideModal('upgradeModal');
        UI.hideLoading();
      } catch (err) {
        UI.hideLoading();
        UI.toast(err.message || 'Chyba při vylepšování', 'err');
        console.error(err);
      }
    }
  }

  // ====== INITIALIZATION ======
  const manager = new GuildManager();
  window.guildManager = manager; // Global reference for inline onclick

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => manager.init(), { once: true });
  } else {
    manager.init();
  }
})();