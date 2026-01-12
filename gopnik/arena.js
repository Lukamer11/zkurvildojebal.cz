// arena.js - Arena s reálnými hráči, auto-fight a kritickými údery

(() => {
  "use strict";

  // ===== CLASS METADATA =====
  const CLASS_META = {
    padouch: { icon: "👻", label: "Padouch" },
    rvac: { icon: "✊", label: "Rváč" },
    mozek: { icon: "💡", label: "Mozek" }
  };

  // ===== DOM HELPERS =====
  const $ = (id) => document.getElementById(id);

  // ===== GAME STATE =====
  let gameState = {
    player: null,
    enemy: null,
    battleInProgress: false,
    roundNumber: 0
  };

  // ===== SUPABASE HELPERS =====
  const supabaseClient = () => window.supabaseClient || window.SF?.sb;

  async function ensureOnline() {
    if (window.SFReady) await window.SFReady;
    const sb = supabaseClient();
    if (!sb) throw new Error('Supabase client není inicializovaný');
    return sb;
  }

  // ===== ITEM HELPERS (stejně jako v postava) =====
  const ALLOWED_STATS = ['strength','defense','dexterity','intelligence','constitution','luck'];

  function getAllItems() {
    const db = window.SHOP_ITEMS;
    if (!db) return [];
    return [
      ...(db.weapons || []),
      ...(db.armor || []),
      ...(db.special || []),
    ];
  }

  function getItemById(itemRef, row) {
    if (itemRef && typeof itemRef === "object") return itemRef;

    const ALIASES = {
      knife: "nuz",
      tactical_knife: "nuz",
      takticky_nuz: "nuz",
      "takticky-nuz": "nuz",
    };

    const rawId = String(itemRef || "");
    const id = ALIASES[rawId] || rawId;
    if (!id) return null;

    const inv = (row?.inventory || window.SF?.stats?.inventory || []);
    const foundInv = inv.find((x) => {
      if (!x) return false;
      if (typeof x === "object") return x.instance_id === id || x.id === id;
      return String(x) === id;
    });
    if (foundInv && typeof foundInv === "object") return foundInv;

    const eq = (row?.equipped || window.SF?.stats?.equipped || {});
    const eqObj = Object.values(eq).find((x) => x && typeof x === "object" && (x.instance_id === id || x.id === id));
    if (eqObj && typeof eqObj === "object") return eqObj;

    return getAllItems().find((it) => it.id === id) || null;
  }

  function calculateTotalBonuses(row) {
    const bonuses = {
      strength: 0,
      defense: 0,
      dexterity: 0,
      intelligence: 0,
      constitution: 0,
      luck: 0
    };
    
    const equipped = (row?.equipped || {});
    
    Object.values(equipped).forEach(itemRef => {
      if (!itemRef) return;
      const item = getItemById(itemRef, row);
      if (!item || !item.bonuses) return;
      
      Object.keys(item.bonuses).forEach(stat => {
        if (bonuses[stat] !== undefined) {
          bonuses[stat] += item.bonuses[stat];
        }
      });
    });
    
    return bonuses;
  }

  // ===== PLAYER CLASS CALCULATION =====
  function getPlayerClass(stats) {
    const str = Number(stats.strength || 0);
    const def = Number(stats.defense || 0);
    const dex = Number(stats.dexterity || 0);
    const int = Number(stats.intelligence || 0);

    if (str > def && str > int) return 'rvac';
    if (int > str && int > def) return 'mozek';
    return 'padouch';
  }

  // ===== CRIT CALCULATION (stejně jako v postava) =====
  function getCritChanceFromDexAndLevel(totalDex, level) {
    const base = Math.floor(totalDex * 0.5);
    const penalty = Math.floor((level - 1) * 0.35);
    return Math.max(1, base - penalty);
  }

  // ===== CALCULATE TOTAL STATS WITH BONUSES =====
  function calculateTotalStats(row) {
    const stats = row.stats || {};
    const bonuses = calculateTotalBonuses(row);
    
    const total = {};
    ALLOWED_STATS.forEach(stat => {
      const base = Number(stats[stat] || 10);
      const bonus = bonuses[stat] || 0;
      total[stat] = base + bonus;
    });
    
    return total;
  }

  // ===== HP CALCULATION =====
  function calculateMaxHP(constitution) {
    return Math.floor(constitution * 50);
  }

  // ===== FETCH RANDOM OPPONENT =====
  async function fetchRandomOpponent() {
    const sb = await ensureOnline();
    const currentUserId = window.SF?.user?.id;
    
    if (!currentUserId) {
      console.error('Current user not found');
      return null;
    }

    // Získat všechny ostatní hráče (ne sebe)
    const { data: allPlayers, error } = await sb
      .from('player_stats')
      .select('*')
      .neq('user_id', currentUserId)
      .limit(100);

    if (error) {
      console.error('Error fetching players:', error);
      return null;
    }

    if (!allPlayers || allPlayers.length === 0) {
      console.warn('No other players found');
      return null;
    }

    // Vybrat náhodného soupeře
    const randomIndex = Math.floor(Math.random() * allPlayers.length);
    return allPlayers[randomIndex];
  }

  // ===== LOAD PLAYER DATA =====
  async function loadPlayerData() {
    await window.SFReady;
    const stats = window.SF?.stats;
    
    if (!stats) {
      console.error('Player stats not available');
      return null;
    }

    const totalStats = calculateTotalStats(stats);
    const level = Number(stats.level || 1);
    const maxHP = calculateMaxHP(totalStats.constitution);

    return {
      userId: stats.user_id,
      name: 'BORIS GOPNIKOV', // TODO: Load from profile
      level: level,
      stats: totalStats,
      maxHP: maxHP,
      currentHP: maxHP,
      critChance: getCritChanceFromDexAndLevel(totalStats.dexterity, level),
      classType: getPlayerClass(stats.stats || {})
    };
  }

  // ===== LOAD ENEMY DATA =====
  function loadEnemyData(enemyRow) {
    if (!enemyRow) return null;

    const baseStats = enemyRow.stats || {};
    const bonuses = calculateTotalBonuses(enemyRow);
    const totalStats = calculateTotalStats(enemyRow);
    const level = Number(enemyRow.level || 1);
    const maxHP = calculateMaxHP(totalStats.constitution);

    return {
      userId: enemyRow.user_id,
      name: 'HRÁČ #' + enemyRow.user_id.slice(0, 8).toUpperCase(),
      level: level,
      baseStats: baseStats,
      bonuses: bonuses,
      stats: totalStats,
      maxHP: maxHP,
      currentHP: maxHP,
      critChance: getCritChanceFromDexAndLevel(totalStats.dexterity, level),
      classType: getPlayerClass(baseStats)
    };
  }

  function formatStatValue(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0';
    const rounded = Math.round(n * 100) / 100;
    const s = String(rounded);
    return s.includes('.') ? rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1') : s;
  }

  function calculateStatBonus(stat, value, level) {
    const v = Number(value);
    const val = Number.isFinite(v) ? v : 0;
    
    switch (stat) {
      case "strength":
        return `+${Math.round(val * 2)} DMG`;
      case "defense": {
        const red = Math.min(75, Math.round(val));
        return `${red}% Redukce`;
      }
      case "dexterity": {
        const crit = getCritChanceFromDexAndLevel(val, level);
        return `${crit}% Crit`;
      }
      case "intelligence":
        return `+${Math.round(val * 1.5)}% Magie`;
      case "constitution":
        return `${Math.round(val * 50)} HP`;
      case "luck": {
        const drop = Math.min(100, Math.round(val));
        const dodge = Math.round(val);
        return `${drop}% / ${dodge}%`;
      }
      default:
        return "";
    }
  }

  // ===== UI RENDERING =====
  function renderPlayer(player) {
    if (!player) return;

    $('playerName').textContent = player.name;
    $('playerLevelText').textContent = `Level ${player.level}`;
    
    // Get base stats and bonuses from SF
    const baseStats = window.SF?.stats?.stats || {};
    const bonuses = calculateTotalBonuses(window.SF?.stats || {});
    
    // Stats - show BASE + BONUS format
    const statElements = {
      strength: { value: 'pStr', extra: 'pStrExtra' },
      defense: { value: 'pDef', extra: 'pDefExtra' },
      dexterity: { value: 'pDex', extra: 'pDexExtra' },
      intelligence: { value: 'pInt', extra: null },
      constitution: { value: 'pCon', extra: null },
      luck: { value: 'pLuck', extra: null }
    };
    
    Object.keys(statElements).forEach(stat => {
      const els = statElements[stat];
      const valueEl = $(els.value);
      if (!valueEl) return;
      
      const base = Number(baseStats[stat] || 10);
      const bonus = bonuses[stat] || 0;
      const total = base + bonus;
      
      // Show value with bonus
      if (bonus !== 0) {
        valueEl.innerHTML = `${formatStatValue(base)} <span style="color: #4af; font-size: 14px;">+${bonus}</span>`;
      } else {
        valueEl.textContent = formatStatValue(base);
      }
      
      // Show extra info
      if (els.extra) {
        const extraEl = $(els.extra);
        if (extraEl) {
          extraEl.textContent = calculateStatBonus(stat, total, player.level);
        }
      }
    });

    // HP
    updateHP('player', player.currentHP, player.maxHP);
  }

  function renderEnemy(enemy) {
    if (!enemy) return;

    $('enemyName').textContent = enemy.name;
    $('enemyLevel').textContent = `Level ${enemy.level}`;
    
    // Get base stats and bonuses
    const baseStats = enemy.baseStats || {};
    const bonuses = enemy.bonuses || {};
    
    // Stats - show BASE + BONUS format
    const statElements = {
      strength: { value: 'eStr', extra: 'eStrExtra' },
      defense: { value: 'eDef', extra: 'eDefExtra' },
      dexterity: { value: 'eDex', extra: 'eDexExtra' },
      intelligence: { value: 'eInt', extra: null },
      constitution: { value: 'eCon', extra: null },
      luck: { value: 'eLuck', extra: null }
    };
    
    Object.keys(statElements).forEach(stat => {
      const els = statElements[stat];
      const valueEl = $(els.value);
      if (!valueEl) return;
      
      const base = Number(baseStats[stat] || 10);
      const bonus = bonuses[stat] || 0;
      const total = base + bonus;
      
      // Show value with bonus
      if (bonus !== 0) {
        valueEl.innerHTML = `${formatStatValue(base)} <span style="color: #4af; font-size: 14px;">+${bonus}</span>`;
      } else {
        valueEl.textContent = formatStatValue(base);
      }
      
      // Show extra info
      if (els.extra) {
        const extraEl = $(els.extra);
        if (extraEl) {
          extraEl.textContent = calculateStatBonus(stat, total, enemy.level);
        }
      }
    });

    // HP
    updateHP('enemy', enemy.currentHP, enemy.maxHP);
  }

  function updateHP(side, current, max) {
    const fillId = side === 'player' ? 'playerHealthFill' : 'enemyHealthFill';
    const textId = side === 'player' ? 'playerHealthText' : 'enemyHealthText';
    
    const percent = Math.max(0, Math.min(100, (current / max) * 100));
    $(fillId).style.width = percent + '%';
    $(textId).textContent = `${Math.max(0, Math.round(current))} / ${Math.round(max)}`;
  }

  // ===== COMBAT LOGIC =====
  function calculateDamage(attacker, defender) {
    const attackPower = attacker.stats.strength * 2;
    const defense = defender.stats.defense;
    const defenseReduction = Math.min(0.75, defense * 0.01);
    
    const baseDamage = Math.max(1, attackPower * (1 - defenseReduction));
    const variance = 0.9 + Math.random() * 0.2; // 90-110%
    
    return Math.round(baseDamage * variance);
  }

  function checkCrit(attacker) {
    const roll = Math.random() * 100;
    return roll < attacker.critChance;
  }

  async function performAttack(attacker, defender, attackerSide) {
    const isCrit = checkCrit(attacker);
    let damage = calculateDamage(attacker, defender);
    
    if (isCrit) {
      damage = Math.round(damage * 2);
    }

    defender.currentHP = Math.max(0, defender.currentHP - damage);

    // Show damage animation
    showDamage(attackerSide === 'player' ? 'enemy' : 'player', damage, isCrit);
    playHitAnimation(attackerSide === 'player' ? 'enemy' : 'player');
    showWeapon(attackerSide);

    // Update HP
    updateHP(attackerSide === 'player' ? 'enemy' : 'player', defender.currentHP, defender.maxHP);

    // Wait for animation
    await sleep(1000);
  }

  function showDamage(side, amount, isCrit) {
    const dmgEl = side === 'player' ? $('playerDmg') : $('enemyDmg');
    if (!dmgEl) return;

    dmgEl.textContent = isCrit ? `CRIT! ${amount}` : `-${amount}`;
    dmgEl.classList.remove('show');
    
    if (isCrit) {
      dmgEl.style.color = '#ff4444';
      dmgEl.style.fontSize = '36px';
      dmgEl.style.textShadow = '0 0 20px rgba(255, 68, 68, 0.8), 0 2px 4px rgba(0,0,0,0.95)';
    } else {
      dmgEl.style.color = side === 'player' ? '#ffd24a' : '#ff6b6b';
      dmgEl.style.fontSize = '28px';
      dmgEl.style.textShadow = '0 2px 4px rgba(0,0,0,.95), 0 0 18px rgba(0,0,0,.8)';
    }

    void dmgEl.offsetWidth;
    dmgEl.classList.add('show');
  }

  function playHitAnimation(side) {
    const container = side === 'player' 
      ? document.querySelector('.player-section .character-arena')
      : document.querySelector('.enemy-section .character-arena');
    
    if (!container) return;

    container.classList.add('hit-shake');
    
    // Show hit overlays
    const overlays = container.querySelectorAll('.hit-overlay');
    overlays.forEach((overlay, i) => {
      setTimeout(() => {
        overlay.classList.add('show-hit');
        setTimeout(() => overlay.classList.remove('show-hit'), 250);
      }, i * 80);
    });

    setTimeout(() => {
      container.classList.remove('hit-shake');
    }, 350);
  }

  function showWeapon(side) {
    const weapon = side === 'player'
      ? document.querySelector('.weapon-player')
      : document.querySelector('.weapon-enemy');
    
    if (!weapon) return;

    weapon.classList.add('show-weapon');
    setTimeout(() => {
      weapon.classList.remove('show-weapon');
    }, 400);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== BATTLE FLOW =====
  async function startBattle() {
    if (gameState.battleInProgress) {
      console.warn('⚠️ Battle already in progress!');
      return;
    }
    
    if (!gameState.player || !gameState.enemy) {
      console.error('❌ Cannot start battle - player or enemy not loaded!');
      return;
    }
    
    console.log('⚔️ Battle started!');
    console.log('Player HP:', gameState.player.currentHP, '/', gameState.player.maxHP);
    console.log('Enemy HP:', gameState.enemy.currentHP, '/', gameState.enemy.maxHP);
    
    gameState.battleInProgress = true;
    gameState.roundNumber = 0;

    // Disable next enemy button during battle
    $('nextEnemyBtn').disabled = true;
    $('nextEnemyBtn').style.opacity = '0.5';
    $('nextEnemyBtn').textContent = '⚔️ BOJ PROBÍHÁ...';

    while (gameState.player.currentHP > 0 && gameState.enemy.currentHP > 0) {
      gameState.roundNumber++;
      console.log(`⚔️ Round ${gameState.roundNumber}`);

      // Player attacks
      await performAttack(gameState.player, gameState.enemy, 'player');
      
      if (gameState.enemy.currentHP <= 0) {
        console.log('Enemy defeated!');
        break;
      }

      await sleep(500);

      // Enemy attacks
      await performAttack(gameState.enemy, gameState.player, 'enemy');
      
      if (gameState.player.currentHP <= 0) {
        console.log('Player defeated!');
        break;
      }
      
      await sleep(500);
    }

    // Battle ended
    console.log('🏁 Battle ended!');
    gameState.battleInProgress = false;

    // Enable next enemy button
    $('nextEnemyBtn').disabled = false;
    $('nextEnemyBtn').style.opacity = '1';
    $('nextEnemyBtn').textContent = '🔄 DALŠÍ SOUPEŘ';

    await sleep(1000);
    
    if (gameState.player.currentHP > 0) {
      await handleVictory();
    } else {
      await handleDefeat();
    }
  }

  async function handleVictory() {
    console.log('🏆 Victory!');
    
    const reward = calculateReward();
    
    // Update stats
    await window.SFReady;
    const currentStats = window.SF?.stats;
    
    if (currentStats) {
      const newMoney = (currentStats.money || 0) + reward.money;
      const newXP = (currentStats.xp || 0) + reward.xp;
      
      window.SF.updateStats({
        money: newMoney,
        xp: newXP
      });
    }

    showResultModal('🏆 VÍTĚZSTVÍ! 🏆', `
      Porazil jsi ${gameState.enemy.name}!
      
      Odměna:
      💰 +${reward.money.toLocaleString('cs-CZ')}₽
      ⭐ +${reward.xp} XP
    `);
  }

  async function handleDefeat() {
    console.log('💀 Defeat!');
    
    showResultModal('💀 PROHRA 💀', `
      Byl jsi poražen hráčem ${gameState.enemy.name}!
      
      Zkus to znovu!
    `);
  }

  function calculateReward() {
    const enemyLevel = gameState.enemy.level;
    const baseMoney = 100;
    const baseXP = 50;
    
    const moneyReward = Math.round(baseMoney * (1 + enemyLevel * 0.3));
    const xpReward = Math.round(baseXP * (1 + enemyLevel * 0.2));
    
    return {
      money: moneyReward,
      xp: xpReward
    };
  }

  function showResultModal(title, text) {
    const modal = $('resultModal');
    const titleEl = $('resultTitle');
    const textEl = $('resultText');
    
    if (modal && titleEl && textEl) {
      titleEl.textContent = title;
      textEl.textContent = text;
      modal.classList.add('show');
    }
  }

  function hideResultModal() {
    const modal = $('resultModal');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  // ===== LOAD NEW OPPONENT =====
  async function loadNewOpponent() {
    console.log('🔄 Loading new opponent...');
    
    // Show loading state
    $('nextEnemyBtn').disabled = true;
    $('nextEnemyBtn').textContent = '⏳ NAČÍTÁNÍ...';
    
    const enemyRow = await fetchRandomOpponent();
    
    if (!enemyRow) {
      showNotification('Nepodařilo se načíst soupeře', 'error');
      $('nextEnemyBtn').disabled = false;
      $('nextEnemyBtn').textContent = '🔄 DALŠÍ SOUPEŘ';
      return;
    }

    gameState.enemy = loadEnemyData(enemyRow);
    renderEnemy(gameState.enemy);
    
    // Reset player HP
    gameState.player.currentHP = gameState.player.maxHP;
    renderPlayer(gameState.player);

    showNotification(`Nový soupeř: ${gameState.enemy.name} (Level ${gameState.enemy.level})`, 'success');

    // Reset button text
    $('nextEnemyBtn').textContent = '🔄 DALŠÍ SOUPEŘ';

    // Auto-start battle after 1.5 seconds
    console.log('⏰ Starting battle in 1.5 seconds...');
    await sleep(1500);
    
    // Check if we're still ready to battle (user didn't navigate away)
    if (gameState.player && gameState.enemy && !gameState.battleInProgress) {
      console.log('🎬 Auto-starting battle now!');
      startBattle();
    }
  }

  // ===== NOTIFICATIONS =====
  function showNotification(message, type = 'success') {
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

  // ===== SYNC CURRENCY UI (stejně jako v postava) =====
  function syncCurrencyUI() {
    if (!window.SF) return;
    
    const stats = window.SF.stats;
    if (!stats) return;
    
    if ($('money')) $('money').textContent = Number(stats.money || 0).toLocaleString('cs-CZ');
    if ($('cigarettes')) $('cigarettes').textContent = String(stats.cigarettes || 0);
    if ($('energy')) $('energy').textContent = String(stats.energy || 0);
    
    // Update XP bar
    const xpFill = $('xpFill');
    const xpText = $('xpText');
    
    if (xpFill && xpText) {
      const xp = stats.xp || 0;
      const level = stats.level || 1;
      const requiredXP = Math.floor(100 * Math.pow(1.5, Math.max(0, level - 1)));
      const xpPercent = (xp / requiredXP) * 100;
      
      xpFill.style.width = `${xpPercent}%`;
      xpText.textContent = `${xp} / ${requiredXP}`;
    }
    
    // Update energy bar
    const energyFill = $('energyFill');
    const energyText = $('energyText');
    
    if (energyFill && energyText) {
      const energy = stats.energy || 0;
      const maxEnergy = stats.max_energy || 100;
      const energyPercent = (energy / maxEnergy) * 100;
      
      energyFill.style.width = `${energyPercent}%`;
      energyText.textContent = `${energy} / ${maxEnergy}`;
    }

    if ($('levelDisplay')) $('levelDisplay').textContent = stats.level || 1;
  }

  // ===== EVENT HANDLERS =====
  async function onNextEnemy() {
    hideResultModal();
    await loadNewOpponent();
  }

  function onResultContinue() {
    hideResultModal();
  }

  // ===== INIT =====
  async function init() {
    console.log('🎮 Initializing arena...');

    // Load player
    gameState.player = await loadPlayerData();
    
    if (!gameState.player) {
      showNotification('Nepodařilo se načíst data hráče', 'error');
      return;
    }

    renderPlayer(gameState.player);

    // Load first opponent
    await loadNewOpponent();

    // Wire buttons
    $('nextEnemyBtn').addEventListener('click', onNextEnemy);
    $('resultContinue').addEventListener('click', onResultContinue);

    // Sync currency
    syncCurrencyUI();

    console.log('✅ Arena initialized!');
  }

  // ===== BOOT =====
  document.addEventListener('DOMContentLoaded', async () => {
    await init();
  });

  // Listen to stats updates
  document.addEventListener('sf:stats', () => {
    syncCurrencyUI();
  });

})();

// ===== CSS ANIMATIONS =====
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);

console.log('✅ Arena system loaded!');
