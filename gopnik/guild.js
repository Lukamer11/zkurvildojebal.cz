(() => {
  'use strict';

  // ====== CONFIG ======
  const CONFIG = {
    CREATE_COST_CIGS: 100,
    MAX_MEMBERS: 50,
    DONATE_COOLDOWN: 30000, // 30s
  };

  // ====== DEFAULT GUILDS ======
  const DEFAULT_GUILDS = [
    {
      id: 'red-army',
      name: 'RED ARMY',
      emblem: '�',
      desc: 'Nejstarší a nejsilnější guilda v regionu. Sdružujeme nejlepší bojovníky.',
      level: 25,
      members: 45,
      maxMembers: 50,
      power: 12500,
      vault: { money: 150000, cigs: 3200 },
      owner: 'BORIS',
      officers: ['VLADIMIR', 'IGOR'],
      memberList: [
        { name: 'BORIS', role: 'Master', level: 45, icon: '👑' },
        { name: 'VLADIMIR', role: 'Officer', level: 38, icon: '⚔️' },
        { name: 'IGOR', role: 'Officer', level: 35, icon: '🛡️' },
        { name: 'SERGEI', role: 'Elite', level: 32, icon: '🔥' },
        { name: 'DMITRI', role: 'Member', level: 28, icon: '💪' },
      ]
    },
    {
      id: 'slav-warriors',
      name: 'SLAV WARRIORS',
      emblem: '⚡',
      desc: 'Rychlí jako blesk, tvrdí jako beton. Přežije jen ten, kdo umí squatovat.',
      level: 22,
      members: 38,
      maxMembers: 50,
      power: 10200,
      vault: { money: 95000, cigs: 1800 },
      owner: 'IVAN',
      officers: ['PETR'],
      memberList: [
        { name: 'IVAN', role: 'Master', level: 42, icon: '👑' },
        { name: 'PETR', role: 'Officer', level: 36, icon: '⚡' },
        { name: 'OLEG', role: 'Elite', level: 34, icon: '🛡️' },
        { name: 'MAX', role: 'Member', level: 31, icon: '🔥' },
        { name: 'YURI', role: 'Member', level: 27, icon: '💪' },
      ]
    },
    {
      id: 'fire-gopniks',
      name: 'FIRE GOPNIKS',
      emblem: '🔥',
      desc: 'Žhavá parta panelákových žhářů. V aréně nechávají jen popel.',
      level: 24,
      members: 42,
      maxMembers: 50,
      power: 11800,
      vault: { money: 125000, cigs: 2500 },
      owner: 'KIRILL',
      officers: ['MIKHAIL', 'NIKITA'],
      memberList: [
        { name: 'KIRILL', role: 'Master', level: 44, icon: '👑' },
        { name: 'MIKHAIL', role: 'Officer', level: 37, icon: '⚔️' },
        { name: 'NIKITA', role: 'Officer', level: 35, icon: '🛡️' },
        { name: 'ROMAN', role: 'Elite', level: 33, icon: '🔥' },
        { name: 'STAS', role: 'Member', level: 29, icon: '💪' },
      ]
    },
    {
      id: 'diamond-squad',
      name: 'DIAMOND SQUATTERS',
      emblem: '💎',
      desc: 'Elitní squatters s diamantovým dripem. Jejich brnění se leskne více než tvoje budoucnost.',
      level: 30,
      members: 50,
      maxMembers: 50,
      power: 15000,
      vault: { money: 250000, cigs: 5000 },
      owner: 'ARTEM',
      officers: ['LEONID', 'PAVEL'],
      memberList: [
        { name: 'ARTEM', role: 'Master', level: 50, icon: '👑' },
        { name: 'LEONID', role: 'Officer', level: 41, icon: '⚔️' },
        { name: 'PAVEL', role: 'Officer', level: 39, icon: '🛡️' },
        { name: 'DENIS', role: 'Elite', level: 36, icon: '🔥' },
        { name: 'SASHA', role: 'Member', level: 33, icon: '💪' },
      ]
    },
  ];

  // ====== STATE ======
  class GuildState {
    constructor() {
      this.loadFromStorage();
    }

    loadFromStorage() {
      try {
        const saved = localStorage.getItem('gopnik.guild.v3');
        if (saved) {
          const data = JSON.parse(saved);
          this.guilds = data.guilds || [...DEFAULT_GUILDS];
          this.playerGuild = data.playerGuild || null;
          this.playerRole = data.playerRole || null;
          this.lastDonate = data.lastDonate || 0;
        } else {
          this.reset();
        }
      } catch {
        this.reset();
      }
    }

    reset() {
      this.guilds = [...DEFAULT_GUILDS];
      this.playerGuild = null;
      this.playerRole = null;
      this.lastDonate = 0;
      this.save();
    }

    save() {
      const data = {
        guilds: this.guilds,
        playerGuild: this.playerGuild,
        playerRole: this.playerRole,
        lastDonate: this.lastDonate,
      };
      localStorage.setItem('gopnik.guild.v3', JSON.stringify(data));
    }

    getGuild(id) {
      return this.guilds.find(g => g.id === id);
    }

    getPlayerGuild() {
      return this.playerGuild ? this.getGuild(this.playerGuild) : null;
    }

    isInGuild() {
      return !!this.playerGuild;
    }

    isMaster() {
      return this.playerRole === 'Master';
    }

    isOfficer() {
      return this.playerRole === 'Officer';
    }

    canManage() {
      return this.isMaster() || this.isOfficer();
    }
  }

  // ====== PLAYER UTILS ======
  class Player {
    static getName() {
      return localStorage.getItem('playerName') || 
             localStorage.getItem('nickname') || 
             localStorage.getItem('nick') || 
             'PLAYER';
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
    }

    static setCigs(amount) {
      const el = document.getElementById('cigarettes');
      if (el) el.textContent = Math.max(0, amount).toLocaleString('cs-CZ');
    }

    static getLevel() {
      const el = document.getElementById('levelDisplay');
      if (!el) return 1;
      return Number(el.textContent) || 1;
    }
  }

  // ====== UI UTILS ======
  class UI {
    static toast(msg, type = 'ok') {
      const toast = document.createElement('div');
      toast.className = `guild-toast ${type}`;
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    static showModal(id) {
      const modal = document.getElementById(id);
      if (modal) modal.classList.add('show');
    }

    static hideModal(id) {
      const modal = document.getElementById(id);
      if (modal) modal.classList.remove('show');
    }

    static formatNumber(num) {
      return num.toLocaleString('cs-CZ');
    }
  }

  // ====== GUILD MANAGER ======
  class GuildManager {
    constructor(state) {
      this.state = state;
      this.selectedGuildForJoin = null;
    }

    init() {
      this.setupEventListeners();
      this.updateView();
      this.setupMusic();
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
        if (e.target.id === 'btnLeaveGuild') {
          this.leaveGuild();
        } else if (e.target.id === 'btnDeleteGuild') {
          this.deleteGuild();
        } else if (e.target.id === 'btnGuildInfo') {
          this.showGuildInfo();
        } else if (e.target.id === 'btnDonateMoney') {
          this.handleDonate('money');
        } else if (e.target.id === 'btnDonateCigs') {
          this.handleDonate('cigs');
        }
      });
    }

    updateView() {
      const welcomeScreen = document.getElementById('welcomeScreen');
      const browserScreen = document.getElementById('guildBrowser');
      const myGuildView = document.getElementById('myGuildView');

      // Skrýt vše
      welcomeScreen.style.display = 'none';
      browserScreen.style.display = 'none';
      myGuildView.style.display = 'none';

      if (this.state.isInGuild()) {
        // Zobrazit mou guildu
        myGuildView.style.display = 'flex';
        this.renderMyGuild();
      } else {
        // Zobrazit welcome screen
        welcomeScreen.style.display = 'flex';
      }
    }

    showWelcome() {
      document.getElementById('welcomeScreen').style.display = 'flex';
      document.getElementById('guildBrowser').style.display = 'none';
      document.getElementById('myGuildView').style.display = 'none';
    }

    showBrowser() {
      document.getElementById('welcomeScreen').style.display = 'none';
      document.getElementById('guildBrowser').style.display = 'flex';
      document.getElementById('myGuildView').style.display = 'none';
      this.renderGuildList();
    }

    renderGuildList() {
      const container = document.getElementById('guildList');
      if (!container) return;

      container.innerHTML = '';
      
      this.state.guilds.forEach(guild => {
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
            <span>👥 ${guild.members}/${guild.maxMembers}</span>
            <span>⚔️ ${UI.formatNumber(guild.power)}</span>
          </div>
        </div>
        <div class="guild-level">LVL ${guild.level}</div>
      `;

      card.addEventListener('click', () => this.showJoinModal(guild.id));
      return card;
    }

    showJoinModal(guildId) {
      const guild = this.state.getGuild(guildId);
      if (!guild) return;

      this.selectedGuildForJoin = guildId;

      const modalBody = document.getElementById('joinModalBody');
      if (!modalBody) return;

      const bonusXP = Math.floor(guild.level * 0.5) + 5;
      const members = guild.memberList.slice(0, 6); // Pouze 6 členů

      modalBody.innerHTML = `
        <div class="guild-detail-header">
          <div class="guild-emblem-large">${guild.emblem}</div>
          <div class="guild-detail-name">${guild.name}</div>
          <div class="guild-detail-desc">${guild.desc}</div>
        </div>

        <div class="guild-stats-detail">
          <div class="stat-item">
            <div class="stat-label">Level</div>
            <div class="stat-value">${guild.level}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Členové</div>
            <div class="stat-value">${guild.members}/${guild.maxMembers}</div>
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
          <h3>👥 TOP ČLENOVÉ</h3>
          <div style="display: flex; flex-direction: column; gap: 5px; max-height: 180px; overflow-y: auto;">
            ${members.map(m => `
              <div style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 8px;">
                <div style="width: 28px; height: 28px; border-radius: 6px; background: radial-gradient(circle, rgba(80,85,92,0.95), rgba(40,45,50,0.98)); border: 2px solid #c9a44a; display: grid; place-items: center; font-size: 14px;">
                  ${m.icon}
                </div>
                <div style="flex: 1;">
                  <div style="font-size: 11px; font-weight: 900; color: #f1d27a; text-transform: uppercase; line-height: 1.2;">${m.name}</div>
                  <div style="font-size: 9px; color: #c9a44a; line-height: 1;">${m.role}</div>
                </div>
                <div style="font-size: 10px; font-weight: 900; color: #4a9eff;">LVL ${m.level}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      const btnJoin = document.getElementById('btnConfirmJoin');
      if (btnJoin) {
        if (guild.members >= guild.maxMembers) {
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
      if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
      } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
      }
      return num.toString();
    }

    joinGuild() {
      if (!this.selectedGuildForJoin) return;

      const guild = this.state.getGuild(this.selectedGuildForJoin);
      if (!guild) return;

      if (guild.members >= guild.maxMembers) {
        UI.toast('Guilda je plná', 'err');
        return;
      }

      const playerName = Player.getName();
      const playerLevel = Player.getLevel();

      guild.members++;
      guild.power += playerLevel * 50;
      guild.memberList.push({
        name: playerName,
        role: 'Member',
        level: playerLevel,
        icon: '💪'
      });

      this.state.playerGuild = guild.id;
      this.state.playerRole = 'Member';
      this.state.save();

      UI.hideModal('joinModal');
      UI.toast(`Připojil ses do guildy "${guild.name}"! ✅`);
      
      this.selectedGuildForJoin = null;
      this.updateView();
    }

    renderMyGuild() {
      const guild = this.state.getPlayerGuild();
      if (!guild) return;

      const container = document.getElementById('guildDetail');
      if (!container) return;

      const bonusXP = Math.floor(guild.level * 0.5) + 5;
      const members = guild.memberList.slice(0, 10);
      const canDonate = Date.now() - this.state.lastDonate >= CONFIG.DONATE_COOLDOWN;
      const cooldownSec = Math.ceil((CONFIG.DONATE_COOLDOWN - (Date.now() - this.state.lastDonate)) / 1000);

      container.innerHTML = `
        <div class="guild-detail-header">
          <div class="guild-emblem-large">${guild.emblem}</div>
          <div class="guild-detail-name">${guild.name}</div>
          <div class="guild-detail-desc">${guild.desc}</div>
        </div>

        <div class="guild-stats-detail">
          <div class="stat-item">
            <div class="stat-label">Level</div>
            <div class="stat-value">${guild.level}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Členové</div>
            <div class="stat-value">${guild.members}/${guild.maxMembers}</div>
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
              <div style="font-size: 18px; font-weight: 900; color: #f1d27a;">₽ ${UI.formatNumber(guild.vault.money)}</div>
            </div>
            <div style="padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; text-align: center;">
              <div style="font-size: 10px; color: #c9a44a; font-weight: 900;">CIGARETY</div>
              <div style="font-size: 18px; font-weight: 900; color: #f1d27a;">🚬 ${UI.formatNumber(guild.vault.cigs)}</div>
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
            ${members.map(m => `
              <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(0,0,0,0.3); border: 2px solid #5a4520; border-radius: 10px; transition: all 0.2s ease;">
                <div style="width: 36px; height: 36px; border-radius: 8px; background: radial-gradient(circle, rgba(80,85,92,0.95), rgba(40,45,50,0.98)); border: 2px solid #c9a44a; display: grid; place-items: center; font-size: 18px;">
                  ${m.icon}
                </div>
                <div style="flex: 1;">
                  <div style="font-size: 13px; font-weight: 900; color: #f1d27a; text-transform: uppercase;">${m.name}</div>
                  <div style="font-size: 10px; color: #c9a44a;">${m.role}</div>
                </div>
                <div style="font-size: 12px; font-weight: 900; color: #4a9eff;">LVL ${m.level}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="guild-actions" style="margin-top: 14px;">
          <button class="guild-btn" id="btnGuildInfo">
            📊 STATISTIKY GUILDY
          </button>
          ${this.state.isMaster() ? `
            <button class="guild-btn danger" id="btnDeleteGuild">
              🗑️ ROZPUSTIT GUILDU
            </button>
          ` : ''}
          <button class="guild-btn danger" id="btnLeaveGuild">
            ❌ OPUSTIT GUILDU
          </button>
        </div>
      `;
    }

    handleDonate(type) {
      if (Date.now() - this.state.lastDonate < CONFIG.DONATE_COOLDOWN) {
        UI.toast('Počkej chvíli před dalším příspěvkem', 'err');
        return;
      }

      const guild = this.state.getPlayerGuild();
      if (!guild) return;

      const inputId = type === 'money' ? 'donateMoneyInput' : 'donateCigsInput';
      const input = document.getElementById(inputId);
      const amount = Math.max(0, parseInt(input?.value) || 0);

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
        guild.vault.money += amount;
        Player.setMoney(playerMoney - amount);
        UI.toast(`Přispěl jsi ${UI.formatNumber(amount)} ₽ do trezoru`);
      } else {
        const playerCigs = Player.getCigs();
        if (playerCigs < amount) {
          UI.toast('Nemáš tolik cigaret', 'err');
          return;
        }
        guild.vault.cigs += amount;
        Player.setCigs(playerCigs - amount);
        UI.toast(`Přispěl jsi ${UI.formatNumber(amount)} 🚬 do trezoru`);
      }

      guild.power += Math.floor(amount / 10);
      this.state.lastDonate = Date.now();
      this.state.save();
      
      if (input) input.value = '';
      this.renderMyGuild();
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

    createGuild() {
      const name = document.getElementById('inputGuildName')?.value.trim() || '';
      const desc = document.getElementById('inputGuildDesc')?.value.trim() || '';
      const emblem = document.getElementById('inputGuildEmoji')?.value.trim() || '🏰';

      if (name.length < 3) {
        UI.toast('Název musí mít alespoň 3 znaky', 'err');
        return;
      }

      if (this.state.guilds.some(g => g.name.toLowerCase() === name.toLowerCase())) {
        UI.toast('Guilda s tímto názvem už existuje', 'err');
        return;
      }

      const cost = CONFIG.CREATE_COST_CIGS;
      const playerCigs = Player.getCigs();
      if (playerCigs < cost) {
        UI.toast(`Potřebuješ ${cost} 🚬 cigaret`, 'err');
        return;
      }

      const playerName = Player.getName();
      const playerLevel = Player.getLevel();

      const newGuild = {
        id: `guild-${Date.now()}`,
        name: name.toUpperCase(),
        emblem,
        desc: desc || 'Nová guilda připravená dobýt svět!',
        level: 1,
        members: 1,
        maxMembers: CONFIG.MAX_MEMBERS,
        power: playerLevel * 100,
        vault: { money: 0, cigs: 0 },
        owner: playerName,
        officers: [],
        memberList: [
          { name: playerName, role: 'Master', level: playerLevel, icon: '👑' }
        ]
      };

      this.state.guilds.push(newGuild);
      this.state.playerGuild = newGuild.id;
      this.state.playerRole = 'Master';
      this.state.save();

      Player.setCigs(playerCigs - cost);

      UI.hideModal('createModal');
      UI.toast(`Guilda "${newGuild.name}" byla vytvořena! 🎉`);
      
      this.updateView();
    }

    leaveGuild() {
      if (!confirm('Opravdu chceš opustit guildu?')) return;

      const guild = this.state.getPlayerGuild();
      if (!guild) return;

      const playerName = Player.getName();
      
      // Odebrat hráče ze seznamu členů
      guild.memberList = guild.memberList.filter(m => m.name !== playerName);
      guild.members--;
      
     // Přepočítat power
      const totalPower = guild.memberList.reduce((sum, m) => sum + (m.level * 50), 0);
      guild.power = totalPower;

      // Pokud byl Master a guilda má členy, přeřadit guildu prvnímu officerovi nebo členovi
      if (this.state.isMaster() && guild.members > 0) {
        const newMaster = guild.memberList[0];
        if (newMaster) {
          newMaster.role = 'Master';
          newMaster.icon = '👑';
          guild.owner = newMaster.name;
        }
      }

      // Pokud guilda zůstala prázdná, smazat ji
      if (guild.members === 0) {
        this.state.guilds = this.state.guilds.filter(g => g.id !== guild.id);
      }

      this.state.playerGuild = null;
      this.state.playerRole = null;
      this.state.save();

      UI.toast('Opustil jsi guildu', 'ok');
      this.updateView();
    }

    deleteGuild() {
      if (!this.state.isMaster()) {
        UI.toast('Pouze Master může rozpustit guildu', 'err');
        return;
      }

      if (!confirm('OPRAVDU chceš rozpustit guildu? Tato akce je nevratná!')) return;

      const guild = this.state.getPlayerGuild();
      if (!guild) return;

      this.state.guilds = this.state.guilds.filter(g => g.id !== guild.id);
      this.state.playerGuild = null;
      this.state.playerRole = null;
      this.state.save();

      UI.toast('Guilda byla rozpuštěna', 'ok');
      this.updateView();
    }

    showGuildInfo() {
      const guild = this.state.getPlayerGuild();
      if (!guild) return;

      const totalDonations = guild.vault.money + guild.vault.cigs;
      const avgLevel = Math.floor(guild.memberList.reduce((sum, m) => sum + m.level, 0) / guild.members);
      const bonusXP = Math.floor(guild.level * 0.5) + 5;

      UI.toast(`📊 ${guild.name} | Level ${guild.level} | Členů: ${guild.members} | Power: ${UI.formatNumber(guild.power)} | Průměrný level: ${avgLevel} | Bonus XP: +${bonusXP}%`, 'ok');
    }

    setupMusic() {
      const music = document.getElementById('bgMusic');
      if (music) {
        music.volume = 0.3;
        
        // Pokus o automatické přehrání
        const playPromise = music.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Automatické přehrání selhalo, přehrát po interakci
            document.addEventListener('click', () => {
              music.play().catch(() => {});
            }, { once: true });
          });
        }
      }
    }
  }

  // ====== INITIALIZATION ======
  const state = new GuildState();
  const manager = new GuildManager(state);
  
  document.addEventListener('DOMContentLoaded', () => {
    manager.init();
  });

  // Pokud je DOM již načten
  if (document.readyState === 'loading') {
    // Čeká na DOMContentLoaded
  } else {
    // DOM už je načten
    manager.init();
  }

})();