// arena.js - Arena s reálnými hráči, cooldown sync a mail notifikacemi

(() => {
  "use strict";

  // ===== CONFIG =====
  const ATTACK_COOLDOWN = 5 * 60 * 1000; // 5 minut
  const COOLDOWN_TABLE = "arena_cooldowns";
  const BATTLE_LOG_TABLE = "arena_battles";

  // ===== DOM HELPERS =====
  const $ = (id) => document.getElementById(id);

  // ===== GAME STATE =====
  let gameState = {
    player: null,
    enemy: null,
    battleInProgress: false,
    roundNumber: 0
  };


  // ===== ARENA2 CONTEXT (MISE / CRYPTA) =====
  // arena2 podporuje automatický fight z misí i z crypty.
  // Očekává payload v sessionStorage pod klíči:
  //  - arena2_context: { type:'mission'|'crypta', autoStart:true, enemy|boss:{...} }
  //  - arenaFromMission / arenaFromCrypta (zpětná kompatibilita)
  // A/nebo query param: ?fromCrypta=1
  let arena2Mode = 'pvp'; // 'pvp' | 'mission' | 'crypta'
  let arena2Ctx = null;

  function readArena2Context() {
    // 1) nový jednotný klíč
    const raw = sessionStorage.getItem('arena2_context');
    if (raw) {
      try { return JSON.parse(raw); } catch (_) {}
    }
    // 2) staré klíče (kompat)
    const rawM = sessionStorage.getItem('arenaFromMission');
    if (rawM) {
      try {
        const m = JSON.parse(rawM);
        return { type: 'mission', autoStart: m.autoStart !== false, enemy: m.enemy || m.target || m };
      } catch (_) {}
    }
    const rawC = sessionStorage.getItem('arenaFromCrypta');
    if (rawC) {
      try {
        const c = JSON.parse(rawC);
        return { type: 'crypta', autoStart: c.autoStart !== false, boss: c.boss || c.enemy || c };
      } catch (_) {}
    }
    return null;
  }

  function getQueryFlag(name) {
    try {
      const u = new URL(window.location.href);
      return u.searchParams.get(name);
    } catch (_) { return null; }
  }

  function normalizeNpcStats(src) {
    const s = src || {};
    const level = Number(s.level || s.lvl || 1);

    // Podpora různých tvarů: buď s.stats.*, nebo přímo strength/defense/...
    const rawStats = s.stats || s.baseStats || s.attributes || s.attr || {};
    const strength = Number(rawStats.strength ?? s.strength ?? s.str ?? (s.attack != null ? Math.max(1, Math.round(Number(s.attack) / 2)) : 10));
    const defense  = Number(rawStats.defense  ?? s.defense  ?? s.def ?? 5);
    const dexterity= Number(rawStats.dexterity?? s.dexterity?? s.dex ?? 10);
    const intelligence=Number(rawStats.intelligence?? s.intelligence?? s.int ?? 10);
    const constitution=Number(rawStats.constitution?? s.constitution?? s.con ?? (s.hp != null ? Math.max(1, Math.round((Number(s.hp) - 500) / 25)) : 10));
    const luck=Number(rawStats.luck?? s.luck ?? 5);

    const stats = { strength, defense, dexterity, intelligence, constitution, luck };

    const maxHP = (s.maxHP != null) ? Number(s.maxHP) : (s.hp != null ? Number(s.hp) : calculateMaxHP(constitution));
    const currentHP = maxHP;

    return {
      userId: s.userId || s.user_id || s.id || 'npc_' + Math.random().toString(36).slice(2),
      name: s.name || s.title || s.enemyName || s.bossName || 'NEPŘÍTEL',
      level,
      baseStats: stats,
      bonuses: { strength:0, defense:0, dexterity:0, intelligence:0, constitution:0, luck:0 },
      stats,
      maxHP,
      currentHP,
      critChance: getCritChanceFromDexAndLevel(stats.dexterity, level),
      classType: getPlayerClass(stats),
      avatar: s.avatar || s.avatarUrl || s.avatar_url || s.img || s.image || null,
      bossNumber: s.bossNumber || s.boss_id || s.bossId || s.number || null,
    };
  }

  function setEnemyAvatar(enemy) {
    const img = $('enemyAvatar');
    if (!img) return;

    // fallback
    img.onerror = () => { img.src = 'avatar.jpg'; };

    if (enemy?.avatar) {
      img.src = enemy.avatar;
      return;
    }

    // pokus: boss číslo (1,2,3...) → boss1.jpg / boss1.png
    let n = enemy?.bossNumber;
    if (!n) {
      const idStr = String(enemy?.userId || enemy?.id || enemy?.name || '');
      const m = idStr.match(/(\d+)/);
      if (m) n = m[1];
    }
    if (n) {
      // zkusíme jpg, když se nenačte, onerror spadne na avatar.jpg
      img.src = `boss${n}.jpg`;
      return;
    }

    // default pvp
    img.src = 'avatar.jpg';
  }

  // ===== SUPABASE HELPERS =====
  const supabaseClient = () => window.supabaseClient || window.SF?.sb;

  async function ensureOnline() {
    if (window.SFReady) await window.SFReady;
    const sb = supabaseClient();
    if (!sb) throw new Error('Supabase client není inicializovaný');
    return sb;
  }

  // ===== ITEM HELPERS =====
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

  function getPlayerClass(stats) {
    const str = Number(stats.strength || 0);
    const def = Number(stats.defense || 0);
    const int = Number(stats.intelligence || 0);

    if (str > def && str > int) return 'rvac';
    if (int > str && int > def) return 'mozek';
    return 'padouch';
  }

  function getCritChanceFromDexAndLevel(totalDex, level) {
    const base = Math.floor(totalDex * 0.5);
    const penalty = Math.floor((level - 1) * 0.35);
    return Math.max(1, base - penalty);
  }

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

  function calculateMaxHP(constitution) {
    return Math.round(500 + constitution * 25);
  }

  // ===== COOLDOWN MANAGEMENT (SERVER-SIDE) =====
  async function getCooldownRemaining(userId) {
    try {
      const sb = await ensureOnline();
      const { data, error } = await sb
        .from(COOLDOWN_TABLE)
        .select('last_attack_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Cooldown check error:', error);
        return 0;
      }

      if (!data || !data.last_attack_at) return 0;

      const lastAttack = new Date(data.last_attack_at).getTime();
      const elapsed = Date.now() - lastAttack;
      return Math.max(0, ATTACK_COOLDOWN - elapsed);
    } catch (e) {
      console.error('Cooldown error:', e);
      return 0;
    }
  }

  async function updateCooldown(userId) {
    try {
      const sb = await ensureOnline();
      await sb
        .from(COOLDOWN_TABLE)
        .upsert({
          user_id: userId,
          last_attack_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (e) {
      console.error('Update cooldown error:', e);
    }
  }

  async function updateCooldownDisplay() {
    const userId = window.SF?.user?.id;
    if (!userId) return;

    const remaining = await getCooldownRemaining(userId);
    
    if (remaining > 0) {
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      $('attackBtn').disabled = true;
      $('nextEnemyBtn').disabled = true;
      $('attackBtn').textContent = `⏰ ${timeText}`;
      $('nextEnemyBtn').textContent = `⏰ ${timeText}`;
      $('attackBtn').style.opacity = '0.5';
      $('nextEnemyBtn').style.opacity = '0.5';
    } else {
      $('attackBtn').disabled = false;
      $('nextEnemyBtn').disabled = false;
      $('attackBtn').textContent = '⚔️ ZAÚTOČIT';
      $('nextEnemyBtn').textContent = '🔄 DALŠÍ SOUPEŘ';
      $('attackBtn').style.opacity = '1';
      $('nextEnemyBtn').style.opacity = '1';
    }
  }

  function startCooldownTimer() {
    updateCooldownDisplay();
    
    const interval = setInterval(async () => {
      await updateCooldownDisplay();
      
      const userId = window.SF?.user?.id;
      if (!userId) {
        clearInterval(interval);
        return;
      }
      
      const remaining = await getCooldownRemaining(userId);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);
  }

  // ===== FETCH RANDOM OPPONENT (JEN REÁLNÍ HRÁČI) =====
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
    const characterName = stats.stats?.character_name || 'HRÁČ #' + stats.user_id.slice(0, 8).toUpperCase();

    return {
      userId: stats.user_id,
      name: characterName,
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
    const characterName = baseStats.character_name || 'HRÁČ #' + enemyRow.user_id.slice(0, 8).toUpperCase();

    return {
      userId: enemyRow.user_id,
      name: characterName,
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
        const red = Math.min(100, Math.floor((val / 28) * 100));
        return `${red}% Redukce`;
      }
      case "dexterity": {
        const crit = getCritChanceFromDexAndLevel(val, level);
        return `+${crit}% Crit`;
      }
      case "intelligence":
        return `+${Math.floor(val * 1.5)}% Magie`;
      case "constitution": {
        const hp = Math.round(500 + val * 25);
        return `${hp} HP`;
      }
      case "luck": {
        const luckPercent = Math.min(100, Math.floor(val));
        return `${luckPercent}% / 100%`;
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
    
    const baseStats = window.SF?.stats?.stats || {};
    const bonuses = calculateTotalBonuses(window.SF?.stats || {});
    
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
      
      if (bonus !== 0) {
        valueEl.innerHTML = `${formatStatValue(base)} <span style="color: #4af; font-size: 14px;">+${bonus}</span>`;
      } else {
        valueEl.textContent = formatStatValue(base);
      }
      
      if (els.extra) {
        const extraEl = $(els.extra);
        if (extraEl) {
          extraEl.textContent = calculateStatBonus(stat, total, player.level);
        }
      }
    });

    updateHP('player', player.currentHP, player.maxHP);
  }

  function renderEnemy(enemy) {
    if (!enemy) return;

    $('enemyName').textContent = enemy.name;
    $('enemyLevel').textContent = `Level ${enemy.level}`;
    setEnemyAvatar(enemy);

    
    const baseStats = enemy.baseStats || {};
    const bonuses = enemy.bonuses || {};
    
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
      
      if (bonus !== 0) {
        valueEl.innerHTML = `${formatStatValue(base)} <span style="color: #4af; font-size: 14px;">+${bonus}</span>`;
      } else {
        valueEl.textContent = formatStatValue(base);
      }
      
      if (els.extra) {
        const extraEl = $(els.extra);
        if (extraEl) {
          extraEl.textContent = calculateStatBonus(stat, total, enemy.level);
        }
      }
    });

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
    const variance = 0.9 + Math.random() * 0.2;
    
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

    showDamage(attackerSide === 'player' ? 'enemy' : 'player', damage, isCrit);
    playHitAnimation(attackerSide === 'player' ? 'enemy' : 'player');
    showWeapon(attackerSide);

    updateHP(attackerSide === 'player' ? 'enemy' : 'player', defender.currentHP, defender.maxHP);

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

  // ===== SEND MAIL NOTIFICATION =====
  async function sendBattleNotification(winnerId, loserId, winnerName, loserName, moneyChange) {
    try {
      const sb = await ensureOnline();
      
      // Mail pro poraženého
      const loserMail = {
        id: `battle_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        user_id: loserId,
        from_name: 'ARENA',
        to_name: loserName,
        subject: '⚔️ Byl jsi napaden!',
        body: `**${winnerName}** na tebe zaútočil v aréně!\n\n**PROHRA** 💀\n\n**-${Math.abs(moneyChange)}₽**\n\nZkus to příště lépe!`,
        created_at: new Date().toISOString(),
        unread: true,
        important: true,
        kind: 'arena'
      };

      // Mail pro vítěze
      const winnerMail = {
        id: `battle_${Date.now()}_${Math.random().toString(36).slice(2)}_win`,
        user_id: winnerId,
        from_name: 'ARENA',
        to_name: winnerName,
        subject: '⚔️ Vítězství v aréně!',
        body: `Porazil jsi **${loserName}** v aréně!\n\n**VÍTĚZSTVÍ** 🏆\n\n**+${moneyChange}₽**\n\nSkvělý boj!`,
        created_at: new Date().toISOString(),
        unread: true,
        important: true,
        kind: 'arena'
      };

      await sb.from('player_mail').insert([loserMail, winnerMail]);
      console.log('✅ Battle notifications sent');
    } catch (e) {
      console.error('❌ Failed to send battle notifications:', e);
    }
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
    
    gameState.battleInProgress = true;
    gameState.roundNumber = 0;

    $('attackBtn').disabled = true;
    $('attackBtn').textContent = '⚔️ BOJ PROBÍHÁ...';
    $('attackBtn').style.opacity = '0.5';

    while (gameState.player.currentHP > 0 && gameState.enemy.currentHP > 0) {
      gameState.roundNumber++;

      await performAttack(gameState.player, gameState.enemy, 'player');
      
      if (gameState.enemy.currentHP <= 0) break;

      await sleep(500);

      await performAttack(gameState.enemy, gameState.player, 'enemy');
      
      if (gameState.player.currentHP <= 0) break;
      
      await sleep(500);
    }

    console.log('🏁 Battle ended!');
    gameState.battleInProgress = false;

    // Update cooldown jen pro PVP arénu
    if (arena2Mode === 'pvp') {
      await updateCooldown(window.SF?.user?.id);
      startCooldownTimer();
    }

    await sleep(1000);
    
    if (gameState.player.currentHP > 0) {
      await handleVictory();
    } else {
      await handleDefeat();
    }
  }

  async function handleVictory() {
    console.log('🏆 Victory!');
    

    // arena2: pro mise/cryptu nepoužívej PVP RPC ani mail
    const isPvp = (arena2Mode === 'pvp');
    const reward = calculateReward();
    
    await window.SFReady;
    const sb = await ensureOnline();
    
    // Update stats přes RPC (jen PVP)
    if (isPvp) {
      try {
      const { data, error } = await sb.rpc('rpc_arena_win');
      if (error) throw error;
      
      // Refresh stats
      await window.SF.refresh();
      
      // Send mail notifications
      await sendBattleNotification(
        gameState.player.userId,
        gameState.enemy.userId,
        gameState.player.name,
        gameState.enemy.name,
        reward.money
      );
      
      } catch (e) {
        console.error('Victory update error:', e);
      }
    } else {
      // NPC fight: jen refresh UI/staty pokud existuje
      try { await window.SF?.refresh?.(); } catch (_) {}
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
    

    const isPvp = (arena2Mode === 'pvp');
    const reward = calculateReward();
    
    await window.SFReady;
    const sb = await ensureOnline();
    
    // Update stats přes RPC (jen PVP)
    if (isPvp) {
      try {
      const { data, error } = await sb.rpc('rpc_arena_lose');
      if (error) throw error;
      
      // Refresh stats
      await window.SF.refresh();
      
      // Send mail notifications
      await sendBattleNotification(
        gameState.enemy.userId,
        gameState.player.userId,
        gameState.enemy.name,
        gameState.player.name,
        Math.floor(reward.money * 0.5)
      );
      
      } catch (e) {
        console.error('Defeat update error:', e);
      }
    } else {
      try { await window.SF?.refresh?.(); } catch (_) {}
    }
    
    showResultModal('💀 PROHRA 💀', `
      Byl jsi poražen hráčem ${gameState.enemy.name}!
      
      Ztráta:
      💰 -${Math.floor(reward.money * 0.5).toLocaleString('cs-CZ')}₽
      
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
    
    gameState.player.currentHP = gameState.player.maxHP;
    renderPlayer(gameState.player);

    showNotification(`Nový soupeř: ${gameState.enemy.name} (Level ${gameState.enemy.level})`, 'success');

    startCooldownTimer();
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

  // ===== SYNC CURRENCY UI =====
  function syncCurrencyUI() {
    if (!window.SF) return;
    
    const stats = window.SF.stats;
    if (!stats) return;
    
    if ($('money')) $('money').textContent = Number(stats.money || 0).toLocaleString('cs-CZ');
    if ($('cigarettes')) $('cigarettes').textContent = String(stats.cigarettes || 0);
    if ($('energy')) $('energy').textContent = String(stats.energy || 0);
    
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
  async function onAttack() {
    if (gameState.battleInProgress) {
      showNotification('Boj již probíhá!', 'error');
      return;
    }
    
    if (!gameState.enemy) {
      showNotification('Nejprve načti soupeře!', 'error');
      return;
    }
    
    const userId = window.SF?.user?.id;
    if (!userId) {
      showNotification('Uživatel není přihlášen!', 'error');
      return;
    }
    
    if (arena2Mode === 'pvp') {
      const remaining = await getCooldownRemaining(userId);
      if (remaining > 0) {
        showNotification('Musíš počkat na cooldown!', 'error');
        return;
      }
    }

    await startBattle();
  }

  async function onNextEnemy() {
    if (gameState.battleInProgress) {
      showNotification('Boj právě probíhá!', 'error');
      return;
    }
    
    const userId = window.SF?.user?.id;
    if (!userId) {
      showNotification('Uživatel není přihlášen!', 'error');
      return;
    }
    
    if (arena2Mode !== 'pvp') {
      showNotification('V misích/cryptě se soupeř nemění', 'error');
      return;
    }

    const remaining = await getCooldownRemaining(userId);
    if (remaining > 0) {
      showNotification('Musíš počkat na cooldown!', 'error');
      return;
    }

    hideResultModal();
    await loadNewOpponent();
  }

  function onResultContinue() {
    hideResultModal();
  }

  // ===== INIT =====
  async function init() {
    console.log('🎮 Initializing arena...');

    // arena2: načti context z misí/crypty
    arena2Ctx = readArena2Context();
    const fromCryptaParam = getQueryFlag('fromCrypta');
    if (arena2Ctx || fromCryptaParam) {
      if (!arena2Ctx && fromCryptaParam) {
        // když přišel jen param, zkus starý klíč
        arena2Ctx = readArena2Context();
      }
      if (arena2Ctx?.type === 'mission') arena2Mode = 'mission';
      else if (arena2Ctx?.type === 'crypta' || fromCryptaParam) arena2Mode = 'crypta';
    }

    // Load player
    gameState.player = await loadPlayerData();
    
    if (!gameState.player) {
      showNotification('Nepodařilo se načíst data hráče', 'error');
      return;
    }

    renderPlayer(gameState.player);

    // arena2: pokud jsme přišli z mise/crypty, načti NPC soupeře a (volitelně) auto-start
    if (arena2Mode !== 'pvp') {
      const rawEnemy = arena2Mode === 'mission' ? (arena2Ctx?.enemy) : (arena2Ctx?.boss || arena2Ctx?.enemy);
      if (!rawEnemy) {
        showNotification('Chybí data soupeře (mise/crypta)', 'error');
      } else {
        gameState.enemy = normalizeNpcStats(rawEnemy);
        renderEnemy(gameState.enemy);
        // v arena2 (mise/crypta) nechceme random soupeře ani cooldown tlačítka
        const nextBtn = $('nextEnemyBtn');
        if (nextBtn) { nextBtn.disabled = true; nextBtn.style.display = 'none'; }
        const attackBtn = $('attackBtn');
        if (attackBtn) { attackBtn.textContent = '⚔️ BOJOVAT'; }
        // auto start
        if (arena2Ctx?.autoStart !== false) {
          // malý delay aby se DOM překreslil
          setTimeout(() => { startBattle(); }, 150);
        }
      }
      // sync currency a konec init
      syncCurrencyUI();
      console.log('✅ Arena2 initialized (NPC)!');
      return;
    }

    // Check cooldown and load first opponent if ready
    const userId = window.SF?.user?.id;
    if (userId) {
      const remaining = await getCooldownRemaining(userId);
      if (remaining <= 0) {
        await loadNewOpponent();
      } else {
        startCooldownTimer();
        showNotification('Arena je na cooldownu, počkej na konec odpočítávání', 'info');
      }
    }

    // Wire buttons
    $('attackBtn').addEventListener('click', onAttack);
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
