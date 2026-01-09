// guild.js - SUPABASE SYNC VERSION (FIXED 2026-01-09)
(() => {
  'use strict';

  // ====== SUPABASE CONFIG ======
  const SUPABASE_URL = 'https://wngzgptxrgfrwuyiyueu.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZ3pncHR4cmdmcnd1eWl5dWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzQzNTYsImV4cCI6MjA4MzU1MDM1Nn0.N-UJpDi_CQVTC6gYFzYIFQdlm0C4x6K7GjeXGzdS8No';

  let supabase = null;

  // ====== CONFIG ======
  const CONFIG = {
    CREATE_COST_CIGS: 100,
    MAX_MEMBERS: 50,
    DONATE_COOLDOWN: 30000, // 30s
  };

  // ====== PLAYER UTILS ======
  class Player {
    static getUserId() {
      return (
        (window.SF && window.SF.user && window.SF.user.id) ||
        localStorage.getItem('slavFantasyUserId') ||
        '1'
      );
    }

    static getName() {
      return (
        localStorage.getItem('playerName') ||
        localStorage.getItem('nickname') ||
        localStorage.getItem('nick') ||
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

      // Sync to SF if available
      if (window.SF && window.SF.setMoney) {
        window.SF.setMoney(Math.max(0, amount));
      }
    }

    static setCigs(amount) {
      const el = document.getElementById('cigarettes');
      if (el) el.textContent = Math.max(0, amount).toLocaleString('cs-CZ');

      // Sync to SF if available
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
  class SupabaseManager {
    static async init() {
      try {
        if (!window.supabase || !window.supabase.createClient) {
          console.error('❌ Supabase library not loaded');
          return false;
        }

        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized');
        return true;
      } catch (e) {
        console.error('❌ Supabase init failed:', e);
        return false;
      }
    }

    static _ensure() {
      if (!supabase) throw new Error('Supabase not initialized');
    }

    static async loadGuilds() {
      console.log('📦 Loading guilds from Supabase...');
      try {
        this._ensure();

        const { data, error } = await supabase
          .from('guilds')
          .select('*')
          .order('level', { ascending: false });

        if (error) {
          console.error('❌ Error loading guilds:', error);
          return [];
        }

        console.log('✅ Loaded guilds:', data);
        return data || [];
      } catch (err) {
        console.error('❌ Exception loading guilds:', err);
        return [];
      }
    }

    // ✅ FIX: use maybeSingle() to avoid 406 (Not Acceptable) when the player is not in any guild.
    static async loadPlayerGuild(userId) {
      console.log('👤 Loading player guild for user:', userId);

      try {
        this._ensure();

        // maybeSingle() returns { data: null, error: null } if no rows -> no 406
        const { data, error } = await supabase
          .from('guild_members')
          .select('guild_id, role, last_donate')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('❌ Error loading player guild:', error);
          return null;
        }

        if (!data) {
          console.log('ℹ️ Player not in any guild');
          return null;
        }

        console.log('✅ Player guild data:', data);
        return data;
      } catch (err) {
        console.error('❌ Exception loading player guild:', err);
        return null;
      }
    }

    static async loadGuildMembers(guildId) {
      console.log('👥 Loading guild members for:', guildId);

      try {
        this._ensure();

        const { data, error } = await supabase
          .from('guild_members')
          .select('user_id, role, level, icon')
          .eq('guild_id', guildId);

        if (error) {
          console.error('❌ Error loading guild members:', error);
          return [];
        }

        console.log('✅ Loaded members:', data);
        return data || [];
      } catch (err) {
        console.error('❌ Exception loading guild members:', err);
        return [];
      }
    }

    static async createGuild(guildData) {
      console.log('🏗️ Creating guild:', guildData);

      try {
        this._ensure();

        const { data, error } = await supabase
          .from('guilds')
          .insert([guildData])
          .select()
          .single();

        if (error) {
          console.error('❌ Error creating guild:', error);
          throw error;
        }

        console.log('✅ Guild created:', data);
        return data;
      } catch (err) {
        console.error('❌ Exception creating guild:', err);
        throw err;
      }
    }

    static async joinGuild(userId, guildId, role = 'Member') {
      console.log('✅ Joining guild:', { userId, guildId, role });

      try {
        this._ensure();

        const playerLevel = Player.getLevel();

        const memberData = {
          user_id: userId,
          guild_id: guildId,
          role,
          level: playerLevel,
          icon: role === 'Master' ? '👑' : '💪',
        };

        const { data, error } = await supabase
          .from('guild_members')
          .insert([memberData])
          .select()
          .single();

        if (error) {
          console.error('❌ Error joining guild:', error);
          throw error;
        }

        // Update guild member count and power (RPC)
        const { error: updateError } = await supabase.rpc('increment_guild_stats', {
          p_guild_id: guildId,
          p_members_delta: 1,
          p_power_delta: playerLevel * 50,
        });

        if (updateError) {
          console.warn('⚠️ Error updating guild stats:', updateError);
        }

        console.log('✅ Joined guild:', data);
        return data;
      } catch (err) {
        console.error('❌ Exception joining guild:', err);
        throw err;
      }
    }

    static async leaveGuild(userId, guildId) {
      console.log('🚪 Leaving guild:', { userId, guildId });

      try {
        this._ensure();

        // Get member data before deleting
        const { data: memberData } = await supabase
          .from('guild_members')
          .select('level')
          .eq('user_id', userId)
          .eq('guild_id', guildId)
          .maybeSingle();

        const { error } = await supabase
          .from('guild_members')
          .delete()
          .eq('user_id', userId)
          .eq('guild_id', guildId);

        if (error) {
          console.error('❌ Error leaving guild:', error);
          throw error;
        }

        // Update guild stats
        if (memberData) {
          const { error: updateError } = await supabase.rpc('increment_guild_stats', {
            p_guild_id: guildId,
            p_members_delta: -1,
            p_power_delta: -(memberData.level * 50),
          });

          if (updateError) {
            console.warn('⚠️ Error updating guild stats:', updateError);
          }
        }

        console.log('✅ Left guild');
        return true;
      } catch (err) {
        console.error('❌ Exception leaving guild:', err);
        throw err;
      }
    }

    static async deleteGuild(guildId) {
      console.log('🗑️ Deleting guild:', guildId);

      try {
        this._ensure();

        // Delete all members first
        await supabase.from('guild_members').delete().eq('guild_id', guildId);

        // Delete guild
        const { error } = await supabase.from('guilds').delete().eq('id', guildId);

        if (error) {
          console.error('❌ Error deleting guild:', error);
          throw error;
        }

        console.log('✅ Guild deleted');
        return true;
      } catch (err) {
        console.error('❌ Exception deleting guild:', err);
        throw err;
      }
    }

    static async donate(guildId, type, amount) {
      console.log('💰 Donating to guild:', { guildId, type, amount });

      try {
        this._ensure();

        const moneyDelta = type === 'money' ? amount : 0;
        const cigsDelta = type === 'cigs' ? amount : 0;

        // Prefer RPC (atomic) if you have it in DB:
        // create function increment_guild_vault(p_guild_id uuid, p_money_delta int, p_cigs_delta int)
        let usedRpc = false;
        try {
          const { error: rpcErr } = await supabase.rpc('increment_guild_vault', {
            p_guild_id: guildId,
            p_money_delta: moneyDelta,
            p_cigs_delta: cigsDelta,
          });
          if (!rpcErr) usedRpc = true;
        } catch (_) {
          // ignore, fallback below
        }

        if (!usedRpc) {
          // Fallback (non-atomic): read then update
          const { data: g, error: readErr } = await supabase
            .from('guilds')
            .select('vault_money, vault_cigs')
            .eq('id', guildId)
            .single();

          if (readErr) throw readErr;

          const nextMoney = (g?.vault_money || 0) + moneyDelta;
          const nextCigs = (g?.vault_cigs || 0) + cigsDelta;

          const { error: updErr } = await supabase
            .from('guilds')
            .update({ vault_money: nextMoney, vault_cigs: nextCigs })
            .eq('id', guildId);

          if (updErr) throw updErr;
        }

        // Update power (kept from your code)
        const powerDelta = Math.floor(amount / 10);
        await supabase.rpc('increment_guild_stats', {
          p_guild_id: guildId,
          p_members_delta: 0,
          p_power_delta: powerDelta,
        });

        // Update last_donate timestamp (store as ms epoch)
        const userId = Player.getUserId();
        await supabase
          .from('guild_members')
          .update({ last_donate: Date.now() })
          .eq('user_id', userId)
          .eq('guild_id', guildId);

        console.log('✅ Donation successful');
        return true;
      } catch (err) {
        console.error('❌ Exception donating:', err);
        throw err;
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

      // Load all guilds
      this.guilds = await SupabaseManager.loadGuilds();

      // Load player's guild membership
      const userId = Player.getUserId();
      this.playerGuildData = await SupabaseManager.loadPlayerGuild(userId);

      if (this.playerGuildData) {
        this.playerGuild = this.guilds.find((g) => g.id === this.playerGuildData.guild_id);

        if (this.playerGuild) {
          // Load guild members
          this.playerGuild.memberList = await SupabaseManager.loadGuildMembers(this.playerGuild.id);
        }
      }

      console.log('✅ Data loaded:', {
        guilds: this.guilds.length,
        playerGuild: this.playerGuild?.name || 'none',
      });
    }

    setupEventListeners() {
      // Hlavní tlačítka
      const btnSearch = document.getElementById('btnSearchGuild');
      const btnCreate = document.getElementById('btnCreateGuildMain');

      if (btnSearch) {
        btnSearch.addEventListener('click', () => this.showBrowser());
      }

      if (btnCreate) {
        btnCreate.addEventListener('click', () => this.showCreateModal());
      }

      // Browser
      const btnBackBrowser = document.getElementById('btnBackFromBrowser');
      if (btnBackBrowser) {
        btnBackBrowser.addEventListener('click', () => this.showWelcome());
      }

      // Create modal
      const btnCancelCreate = document.getElementById('btnCancelCreate');
      const btnConfirmCreate = document.getElementById('btnConfirmCreate');

      if (btnCancelCreate) {
        btnCancelCreate.addEventListener('click', () => UI.hideModal('createModal'));
      }

      if (btnConfirmCreate) {
        btnConfirmCreate.addEventListener('click', () => this.createGuild());
      }

      // Join modal
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

      // Dynamic listeners
      document.addEventListener('click', (e) => {
        const id = e.target && e.target.id;
        if (id === 'btnLeaveGuild') {
          this.leaveGuild();
        } else if (id === 'btnDeleteGuild') {
          this.deleteGuild();
        } else if (id === 'btnGuildInfo') {
          this.showGuildInfo();
        } else if (id === 'btnDonateMoney') {
          this.handleDonate('money');
        } else if (id === 'btnDonateCigs') {
          this.handleDonate('cigs');
        }
      });
    }

    updateView() {
      const welcomeScreen = document.getElementById('welcomeScreen');
      const browserScreen = document.getElementById('guildBrowser');
      const myGuildView = document.getElementById('myGuildView');

      // Skrýt vše
      if (welcomeScreen) welcomeScreen.style.display = 'none';
      if (browserScreen) browserScreen.style.display = 'none';
      if (myGuildView) myGuildView.style.display = 'none';

      if (this.playerGuild) {
        // Zobrazit mou guildu
        if (myGuildView) myGuildView.style.display = 'flex';
        this.renderMyGuild();
      } else {
        // Zobrazit welcome screen
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

      if (this.guilds.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #c9a44a;">
            <div style="font-size: 60px; margin-bottom: 16px;">😢</div>
            <div style="font-size: 18px; font-weight: 900;">Zatím žádné guildy</div>
            <div style="font-size: 14px; margin-top: 8px;">Buď první a založ vlastní guildu!</div>
          </div>
        `;
        return;
      }

      this.guilds.forEach((guild) => {
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

      card.addEventListener('click', () => this.showJoinModal(guild.id));
      return card;
    }

    async showJoinModal(guildId) {
      const guild = this.guilds.find((g) => g.id === guildId);
      if (!guild) return;

      UI.showLoading();

      // Load guild members
      const members = await SupabaseManager.loadGuildMembers(guildId);

      UI.hideLoading();

      this.selectedGuildForJoin = guildId;

      const modalBody = document.getElementById('joinModalBody');
      if (!modalBody) return;

      const bonusXP = Math.floor(guild.level * 0.5) + 5;
      const topMembers = members.slice(0, 6);

      modalBody.innerHTML = `
        <div class="guild-detail-header">
          <div class="guild-emblem-large">${guild.emblem}</div>
          <div class="guild-detail-name">${guild.name}</div>
          <div class="guild-detail-desc">${guild.description}</div>
        </div>

        <div class="guild-stats-detail">
          <div class="stat-item">
            <div class="stat-label">Level</div>
            <div class="stat-value">${guild.level}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Členové</div>
            <div class="stat-value">${guild.members}/${guild.max_members}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Power</div>
            <div class="stat-value">${this.formatCompact(guild.power)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">XP</div>
            <div class="stat-value">+${bonusXP}%</div>
          </div>
        </div>

        <div style="margin-top: 8px;">
          <h3 style="font-size: 13px; font-weight: 900; color: #f1d27a; margin-bottom: 8px;">👥 TOP ČLENOVÉ</h3>
          <div style="display: flex; flex-direction: column; gap: 5px; max-height: 180px; overflow-y: auto;">
            ${
              topMembers.length > 0
                ? topMembers
                    .map(
                      (m) => `
              <div style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 8px;">
                <div style="width: 28px; height: 28px; border-radius: 6px; background: radial-gradient(circle, rgba(80,85,92,0.95), rgba(40,45,50,0.98)); border: 2px solid #c9a44a; display: grid; place-items: center; font-size: 14px;">
                  ${m.icon}
                </div>
                <div style="flex: 1;">
                  <div style="font-size: 11px; font-weight: 900; color: #f1d27a; text-transform: uppercase; line-height: 1.2;">${m.user_id}</div>
                  <div style="font-size: 9px; color: #c9a44a; line-height: 1;">${m.role}</div>
                </div>
                <div style="font-size: 10px; font-weight: 900; color: #4a9eff;">LVL ${m.level}</div>
              </div>
            `
                    )
                    .join('')
                : '<div style="text-align: center; color: #c9a44a; padding: 20px;">Žádní členové</div>'
            }
          </div>
        </div>
      `;

      const btnJoin = document.getElementById('btnConfirmJoin');
      if (btnJoin) {
        if (guild.members >= guild.max_members) {
          btnJoin.disabled = true;
          btnJoin.textContent = '🚫 PLNÁ GUILDA';
        } else {
          btnJoin.disabled = false;
          btnJoin.textContent = '✅ Připojit se';
        }
      }

      UI.showModal('joinModal');
    }

    formatCompact(num) {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return String(num);
    }

    async joinGuild() {
      if (!this.selectedGuildForJoin) return;

      const guild = this.guilds.find((g) => g.id === this.selectedGuildForJoin);
      if (!guild) return;

      if (guild.members >= guild.max_members) {
        UI.toast('Guilda je plná', 'err');
        return;
      }

      UI.showLoading();

      try {
        const userId = Player.getUserId();
        await SupabaseManager.joinGuild(userId, guild.id, 'Member');

        UI.toast(`Připojil ses do guildy "${guild.name}"! ✅`);

        await this.loadData();

        UI.hideModal('joinModal');
        UI.hideLoading();

        this.selectedGuildForJoin = null;
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

      const container = document.getElementById('guildDetail');
      if (!container) return;

      const bonusXP = Math.floor(guild.level * 0.5) + 5;
      const members = guild.memberList || [];
      const topMembers = members.slice(0, 10);

      const lastDonate = this.playerGuildData?.last_donate || 0;
      const canDonate = Date.now() - lastDonate >= CONFIG.DONATE_COOLDOWN;
      const cooldownSec = Math.ceil(
        (CONFIG.DONATE_COOLDOWN - (Date.now() - lastDonate)) / 1000
      );

      const isMaster = this.playerGuildData?.role === 'Master';

      container.innerHTML = `
        <div class="guild-detail-header">
          <div class="guild-emblem-large">${guild.emblem}</div>
          <div class="guild-detail-name">${guild.name}</div>
          <div class="guild-detail-desc">${guild.description}</div>
        </div>

        <div class="guild-stats-detail">
          <div class="stat-item">
            <div class="stat-label">Level</div>
            <div class="stat-value">${guild.level}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Členové</div>
            <div class="stat-value">${guild.members}/${guild.max_members}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Power</div>
            <div class="stat-value">${UI.formatNumber(guild.power)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Bonus XP</div>
            <div class="stat-value">+${bonusXP}%</div>
          </div>
        </div>

        <div style="margin-top: 12px; padding: 16px; background: rgba(0,0,0,0.4); border: 2px solid #5a4520; border-radius: 12px;">
          <h3 style="font-size: 13px; font-weight: 900; color: #f1d27a; text-transform: uppercase; margin-bottom: 12px;">
            💰 GUILD TREZOR
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
            <div style="padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; text-align: center;">
              <div style="font-size: 10px; color: #c9a44a; font-weight: 900;">RUBLY</div>
              <div style="font-size: 18px; font-weight: 900; color: #f1d27a;">₽ ${UI.formatNumber(guild.vault_money)}</div>
            </div>
            <div style="padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; text-align: center;">
              <div style="font-size: 10px; color: #c9a44a; font-weight: 900;">CIGARETY</div>
              <div style="font-size: 18px; font-weight: 900; color: #f1d27a;">🚬 ${UI.formatNumber(guild.vault_cigs)}</div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-bottom: 8px;">
            <input type="number" id="donateMoneyInput" min="0" placeholder="Kolik ₽?"
              style="padding: 10px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.35); color: #fff; outline: none; font-family: inherit;">
            <button class="guild-btn" id="btnDonateMoney" ${!canDonate ? 'disabled' : ''}>
              ${canDonate ? 'Vložit ₽' : `⏳ ${cooldownSec}s`}
            </button>
          </div>
          <div style="display: grid; grid-template-columns: 1fr auto; gap: 8px;">
            <input type="number" id="donateCigsInput" min="0" placeholder="Kolik 🚬?"
              style="padding: 10px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.35); color: #fff; outline: none; font-family: inherit;">
            <button class="guild-btn" id="btnDonateCigs" ${!canDonate ? 'disabled' : ''}>
              ${canDonate ? 'Vložit 🚬' : `⏳ ${cooldownSec}s`}
            </button>
          </div>
          <div style="font-size: 10px; color: #c9a44a; margin-top: 10px; text-align: center;">
            Příspěvky pomáhají guildě růst a odemykat bonusy
          </div>
        </div>

        <div style="margin-top: 12px;">
          <h3 style="font-size: 13px; font-weight: 900; color: #f1d27a; text-transform: uppercase; margin-bottom: 10px;">
            👥 ČLENOVÉ (${guild.members})
          </h3>
          <div style="display: flex; flex-direction: column; gap: 6px; max-height: 300px; overflow-y: auto; padding-right: 6px;">
            ${topMembers
              .map(
                (m) => `
              <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px; transition: all 0.2s ease;">
                <div style="width: 36px; height: 36px; border-radius: 8px; background: radial-gradient(circle, rgba(80,85,92,0.95), rgba(40,45,50,0.98)); border: 2px solid #c9a44a; display: grid; place-items: center; font-size: 18px;">
                  ${m.icon}
                </div>
                <div style="flex: 1;">
                  <div style="font-size: 13px; font-weight: 900; color: #f1d27a; text-transform: uppercase;">${m.user_id}</div>
                  <div style="font-size: 10px; color: #c9a44a;">${m.role}</div>
                </div>
                <div style="font-size: 12px; font-weight: 900; color: #4a9eff;">LVL ${m.level}</div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="guild-actions" style="margin-top: 14px;">
          <button class="guild-btn" id="btnGuildInfo">📊 STATISTIKY GUILDY</button>
          ${
            isMaster
              ? `
            <button class="guild-btn danger" id="btnDeleteGuild">🗑️ ROZPUSTIT GUILDU</button>
          `
              : ''
          }
          <button class="guild-btn danger" id="btnLeaveGuild">❌ OPUSTIT GUILDU</button>
        </div>
      `;
    }

    async handleDonate(type) {
      const lastDonate = this.playerGuildData?.last_donate || 0;

      if (Date.now() - lastDonate < CONFIG.DONATE_COOLDOWN) {
        UI.toast('Počkej chvíli před dalším příspěvkem', 'err');
        return;
      }

      const guild = this.playerGuild;
      if (!guild) return;

      const inputId = type === 'money' ? 'donateMoneyInput' : 'donateCigsInput';
      const input = document.getElementById(inputId);
      const amount = Math.max(0, parseInt(input?.value, 10) || 0);

      if (amount <= 0) {
        UI.toast('Zadej platnou částku', 'err');
        return;
      }

      if (type === 'money') {
        const playerMoney = Player.getMoney();
        if (playerMoney < amount) {
          UI.toast('Nemáš tolik rublů', 'err');
          return;
        }
      } else {
        const playerCigs = Player.getCigs();
        if (playerCigs < amount) {
          UI.toast('Nemáš tolik cigaret', 'err');
          return;
        }
      }

      UI.showLoading();

      try {
        await SupabaseManager.donate(guild.id, type, amount);

        if (type === 'money') {
          const playerMoney = Player.getMoney();
          Player.setMoney(playerMoney - amount);
          UI.toast(`Přispěl jsi ${UI.formatNumber(amount)} ₽ do trezoru`);
        } else {
          const playerCigs = Player.getCigs();
          Player.setCigs(playerCigs - amount);
          UI.toast(`Přispěl jsi ${UI.formatNumber(amount)} 🚬 do trezoru`);
        }

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
        UI.toast(`Potřebuješ ${cost} 🚬 cigaret na založení guildy`, 'err');
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
          description: desc || 'Nová guilda připravená dobýt svět!',
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

        UI.toast(`Guilda "${createdGuild.name}" byla vytvořena! 🎉`);

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

      if (!confirm('OPRAVDU chceš rozpustit guildu? Tato akce je nevratná!')) return;

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

    showGuildInfo() {
      const guild = this.playerGuild;
      if (!guild) return;

      const avgLevel =
        guild.memberList && guild.memberList.length > 0
          ? Math.floor(guild.memberList.reduce((sum, m) => sum + m.level, 0) / guild.members)
          : 0;
      const bonusXP = Math.floor(guild.level * 0.5) + 5;

      UI.toast(
        `📊 ${guild.name} | Level ${guild.level} | Členů: ${guild.members} | Power: ${UI.formatNumber(
          guild.power
        )} | Průměrný level: ${avgLevel} | Bonus XP: +${bonusXP}%`,
        'ok'
      );
    }
  }

  // ====== INITIALIZATION ======
  const manager = new GuildManager();

  // Spusť init přesně jednou:
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => manager.init(), { once: true });
  } else {
    manager.init();
  }
})();
