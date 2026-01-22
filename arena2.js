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
    roundNumber: 0,
    playerWeapon: null,
    enemyWeapon: null,
    // DMG ramp (jako v klasické aréně): +2% každých 7s během boje
    dmgMultiplier: 1,
    dmgRampTimer: null,
    fightStartedAt: 0
  };

  // ===== WEAPON / ATTACK TYPE HELPERS =====
  function emojiToDataUri(emoji) {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">` +
      `<text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-size="96">${emoji}</text>` +
      `</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function resolveWeaponForRow(row) {
    const fallback = { id: 'ak47', type: 'gun', img: 'zbran1.png', fireImg: 'zbran2.png' };
    const eq = (row?.equipped || window.SF?.stats?.equipped || {});
    const weaponRef = eq.weapon || eq.weapons || eq.main || null;
    const item = getItemById(weaponRef, row);
    if (!item) return fallback;

    const id = String(item.id || item.instance_id || weaponRef || '').trim() || 'ak47';

    let type = 'melee';
    if (id === 'molotov') type = 'throw';
    const gunIds = new Set([
      'ak47','m249','glock','shotgun','sniper','uzi','mp5','deagle','revolver',
      'crossbow','sks','famas','scar','rpk','ppsh','fnfal','saiga'
    ]);
    if (gunIds.has(id)) type = 'gun';

    let img = null;
    if (typeof item.icon === 'string') {
      const ic = item.icon.trim();
      if (ic.endsWith('.png') || ic.endsWith('.jpg') || ic.endsWith('.jpeg') || ic.endsWith('.webp') || ic.endsWith('.gif')) {
        img = ic;
      } else if (ic.length <= 4) {
        img = emojiToDataUri(ic);
      }
    }

    if (id === 'ak47') return { id, type, img: 'zbran1.png', fireImg: 'zbran2.png' };
    return { id, type, img: img || fallback.img, fireImg: null };
  }

  function setWeaponInHands(side, weapon) {
    const el = side === 'player'
      ? document.querySelector('.weapon-player')
      : document.querySelector('.weapon-enemy');
    if (!el) return;
    // Zbraň NECHCEME mít viditelnou permanentně – ukáže se jen při útoku.
    // (Viditelnost řeší showWeapon() přes třídu .show-weapon.)
    el.classList.remove('weapon-visible');
    el.classList.remove('show-weapon');
    el.style.opacity = '0';
    el.src = (weapon && weapon.img) ? weapon.img : 'zbran1.png';
  }

  function hideWeapon(side) {
    const weaponEl = side === 'player'
      ? document.querySelector('.weapon-player')
      : document.querySelector('.weapon-enemy');
    if (!weaponEl) return;
    weaponEl.classList.remove('weapon-visible');
    weaponEl.classList.remove('show-weapon');
    weaponEl.style.opacity = '0';
  }

  function animateProjectile(attackerSide, imgSrc) {
    const attackerBox = attackerSide === 'player' ? $('playerCharBox') : $('enemyCharBox');
    const defenderBox = attackerSide === 'player' ? $('enemyCharBox') : $('playerCharBox');
    if (!attackerBox || !defenderBox) return Promise.resolve();

    const a = attackerBox.getBoundingClientRect();
    const d = defenderBox.getBoundingClientRect();
    const startX = a.left + a.width * (attackerSide === 'player' ? 0.75 : 0.25);
    const startY = a.top + a.height * 0.55;
    const endX = d.left + d.width * (attackerSide === 'player' ? 0.25 : 0.75);
    const endY = d.top + d.height * 0.55;

    const proj = document.createElement('img');
    proj.className = 'projectile';
    proj.alt = '';
    proj.setAttribute('aria-hidden', 'true');
    proj.src = imgSrc || 'zbran1.png';
    proj.style.left = `${startX}px`;
    proj.style.top = `${startY}px`;
    document.body.appendChild(proj);

    const dx = endX - startX;
    const dy = endY - startY;
    const spin = attackerSide === 'player' ? 720 : -720;

    // Let obloukem (parabola): y = lerp + "vykopnutí" nahoru
    // RANDOM: každý hod trochu jiný (výška oblouku i rychlost)
    const duration = 460 + Math.random() * 280; // ~0.46s - 0.74s
    const baseArc = Math.min(220, Math.max(120, Math.abs(dx) * 0.18));
    const arc = Math.min(280, baseArc * (0.75 + Math.random() * 0.7));
    const t0 = performance.now();

    return new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const x = startX + dx * t;
        // parabola: 4t(1-t) dává 0 na začátku/konci a maximum uprostřed
        const lift = arc * 4 * t * (1 - t);
        const y = startY + dy * t - lift;
        const rot = spin * t;

        proj.style.left = `${x}px`;
        proj.style.top = `${y}px`;
        proj.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;

        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    }).finally(() => { try { proj.remove(); } catch {} });
  }


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
        // zachovej i metadata (slot, rewards, difficulty...) kvůli správnému ukončení mise
        return {
          type: 'mission',
          autoStart: m.autoStart !== false,
          enemy: m.enemy || m.target || m,
          rewards: m.rewards,
          missionName: m.missionName,
          difficulty: m.difficulty,
          slot: m.slot
        };
      } catch (_) {}
    }
    const rawC = sessionStorage.getItem('arenaFromCrypta');
    if (rawC) {
      try {
        const c = JSON.parse(rawC);
        // zachovej bossIndex + reward, aby po výhře šlo správně odemknout dalšího bosse
        return {
          type: 'crypta',
          autoStart: c.autoStart !== false,
          boss: c.boss || c.enemy || c,
          bossIndex: c.bossIndex,
          reward: c.reward
        };
      } catch (_) {}
    }
    return null;
  }

  async function fetchCryptaContextFromDB() {
    // Když se uživatel dostane do arena2 přes ?fromCrypta=1 a sessionStorage je prázdný
    // (např. otevření v nové kartě), zkusíme vytáhnout payload ze Supabase.
    try {
      const sb = await ensureOnline();
      const uid = window.SF?.user?.id || window.SF?.stats?.user_id;
      if (!uid) return null;
      const { data, error } = await sb
        .from('crypta_fights')
        .select('payload')
        .eq('user_id', uid)
        .maybeSingle();
      if (error) {
        console.warn('crypta_fights load error:', error);
        return null;
      }
      const payload = data?.payload;
      if (!payload) return null;
      return {
        type: 'crypta',
        autoStart: payload.autoStart !== false,
        boss: payload.boss || payload.enemy || payload,
        bossIndex: payload.bossIndex,
        reward: payload.reward
      };
    } catch (e) {
      console.warn('crypta_fights fetch failed:', e);
      return null;
    }
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
    const constitution=Number(rawStats.constitution?? s.constitution?? s.con ?? (s.hp != null ? Math.max(1, Math.round((Number(s.hp) - 500) / 25)) : 10));
    const luck=Number(rawStats.luck?? s.luck ?? 5);
    const stats = { strength, defense, constitution, luck };

    const maxHP = (s.maxHP != null)
      ? Number(s.maxHP)
      : (s.hp != null ? Number(s.hp) : calculateMaxHP(constitution, level));
    const currentHP = maxHP;

    return {
      userId: s.userId || s.user_id || s.id || 'npc_' + Math.random().toString(36).slice(2),
      name: s.name || s.title || s.enemyName || s.bossName || 'NEPŘÍTEL',
      level,
      baseStats: stats,
      bonuses: { strength:0, defense:0, constitution:0, luck:0 },
      stats,
      maxHP,
      currentHP,
      critChance: Math.round(getCritChanceFromLuckAndLevel(stats.luck, level) * 1000) / 10,
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
  const ALLOWED_STATS = ['strength','defense','constitution','luck'];

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
    return (str >= def) ? 'rvac' : 'padouch';
  }

  // ===== BALANCE (S&F-like) =====
  function getCritChanceFromLuckAndLevel(totalLuck, level) {
    // Krit šance přímo ze ŠTĚSTÍ: 1 Luck = 0.25% Crit, cap 50%
    const luck = Math.max(0, Number(totalLuck) || 0);
    const crit = luck * 0.0025;
    return Math.max(0, Math.min(0.50, crit));
  }

  function calculateTotalStats(row) {
    const stats = row.stats || {};
    const bonuses = calculateTotalBonuses(row);
    const petPct = (window.SF && typeof window.SF.getPetBonusesPercent === 'function')
      ? window.SF.getPetBonusesPercent(row)
      : { strength:0, defense:0, constitution:0, luck:0 };
		    const guildPct = (window.SF && typeof window.SF.getGuildBonusesPercent === 'function')
		      ? window.SF.getGuildBonusesPercent()
		      : { strength:0, defense:0, constitution:0, luck:0 };
    
    const total = {};
    ALLOWED_STATS.forEach(stat => {
      const base = Number(stats[stat] || 10);
      const bonus = bonuses[stat] || 0;
      const raw = base + bonus;
      const pct = Number(petPct?.[stat] || 0);
      total[stat] = Math.round(raw * (1 + pct / 100));
    });
    
    return total;
  }

  function calculateMaxHP(constitution, level) {
    const con = Math.max(0, Number(constitution) || 0);
    const lvl = Math.max(1, Number(level) || 1);
    // S&F-like: level + výdrž, ale výdrž dává čitelných +10 HP / bod
    return Math.round(200 + lvl * 35 + con * 10);
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

    // stats.stats může být JSON string
    let baseStats = stats.stats || {};
    if (typeof baseStats === 'string') {
      try { baseStats = JSON.parse(baseStats) || {}; } catch { baseStats = {}; }
    }

    const totalStats = calculateTotalStats({ ...stats, stats: baseStats });
    const level = Number(stats.level || 1);
    const maxHP = calculateMaxHP(totalStats.constitution, level);
    const uid = String(stats.user_id || window.SF?.user?.id || '').slice(0, 8).toUpperCase();
    const characterName = baseStats?.character_name || stats.username || window.SF?.user?.user_metadata?.username || (uid ? ('HRÁČ #' + uid) : 'NEZNÁMÝ HRÁČ');

    return {
      userId: stats.user_id,
      name: characterName,
      level: level,
      stats: totalStats,
      maxHP: maxHP,
      currentHP: maxHP,
      critChance: Math.round(getCritChanceFromLuckAndLevel(totalStats.luck, level) * 1000) / 10,
      classType: getPlayerClass(baseStats || {}),
      avatarUrl: baseStats?.avatar_url || null,
      avatarFrame: baseStats?.avatar_frame || null
    };
  }

  // ===== LOAD ENEMY DATA =====
  function loadEnemyData(enemyRow) {
    if (!enemyRow) return null;

    // enemyRow.stats může být JSON string
    let baseStats = enemyRow.stats || {};
    if (typeof baseStats === 'string') {
      try { baseStats = JSON.parse(baseStats) || {}; } catch { baseStats = {}; }
    }
    const bonuses = calculateTotalBonuses(enemyRow);
    const totalStats = calculateTotalStats({ ...enemyRow, stats: baseStats });
    const level = Number(enemyRow.level || 1);
    const maxHP = calculateMaxHP(totalStats.constitution, level);
    const uid = String(enemyRow.user_id || enemyRow.id || '').slice(0, 8).toUpperCase();
    const characterName = baseStats.character_name || enemyRow.username || enemyRow.display_name || (uid ? ('HRÁČ #' + uid) : 'NEZNÁMÝ SOUPEŘ');

    return {
      userId: enemyRow.user_id || enemyRow.id || null,
      name: characterName,
      level: level,
      baseStats: baseStats,
      bonuses: bonuses,
      stats: totalStats,
      maxHP: maxHP,
      currentHP: maxHP,
      critChance: Math.round(getCritChanceFromLuckAndLevel(totalStats.luck, level) * 1000) / 10,
      classType: getPlayerClass(baseStats),
      avatarUrl: baseStats?.avatar_url || null,
      avatarFrame: baseStats?.avatar_frame || null
    };
  }

  function formatStatValue(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0';
    const rounded = Math.round(n * 100) / 100;
    const s = String(rounded);
    return s.includes('.') ? rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1') : s;
  }

  function calculateStatBonus(stat, value, level, cls) {
    const v = Number(value);
    const val = Number.isFinite(v) ? v : 0;

    switch (stat) {
      case "strength":
        return `+${Math.round(val * 2)}% DMG`;
      case "defense": {
        const red = (window.SF && window.SF.getDefenseReductionPercent)
          ? window.SF.getDefenseReductionPercent(val, level, cls)
          : Math.min(100, Math.floor((val / (28 + Math.floor((level - 1) * 2))) * 100));
        return `${red}% Redukce`;
      }
      case "constitution": {
        const hp = calculateMaxHP(val, level);
        return `${hp} HP`;
      }
      case "luck": {
        const crit = getCritChanceFromLuckAndLevel(val, level);
        return `${Math.round(crit * 100)}% Crit`;
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

    // avatar + rámeček z výběru
    try {
      const img = document.getElementById('playerAvatar');
      if (img && player.avatarUrl) img.src = String(player.avatarUrl);
      const box = document.getElementById('playerCharBox');
      if (box && player.avatarFrame) box.style.borderColor = String(player.avatarFrame);
    } catch {}
    
    const baseStats = window.SF?.stats?.stats || {};
    const bonuses = calculateTotalBonuses(window.SF?.stats || {});
	    const petPct = (window.SF && typeof window.SF.getPetBonusesPercent === 'function')
	      ? window.SF.getPetBonusesPercent(window.SF?.stats || {})
	      : { strength:0, defense:0, constitution:0, luck:0 };
		    const guildPct = (window.SF && typeof window.SF.getGuildBonusesPercent === 'function')
		      ? window.SF.getGuildBonusesPercent()
		      : { strength:0, defense:0, constitution:0, luck:0 };
    
    const statElements = {
      strength: { value: 'pStr', extra: 'pStrExtra', bonus: 'pStrBonus' },
      defense: { value: 'pDef', extra: 'pDefExtra', bonus: 'pDefBonus' },
      constitution: { value: 'pCon', extra: 'pConExtra', bonus: 'pConBonus' },
      luck: { value: 'pLuck', extra: 'pLuckExtra', bonus: 'pLuckBonus' }
    };
    
    Object.keys(statElements).forEach(stat => {
      const els = statElements[stat];
      const valueEl = $(els.value);
      if (!valueEl) return;
      
      const base = Number(baseStats[stat] || 10);
      const bonus = bonuses[stat] || 0;
      const rawTotal = base + bonus;
      const pPct = Number(petPct?.[stat] || 0);
      const gPct = Number(guildPct?.[stat] || 0);
      const total = Math.round(rawTotal * (1 + pPct / 100) * (1 + gPct / 100));

      valueEl.textContent = formatStatValue(total);
      
      if (els.extra) {
        const extraEl = $(els.extra);
        if (extraEl) {
	          const extra = calculateStatBonus(stat, total, player.level, player.classType);
	          extraEl.textContent = extra;
        }
      }
      if (els.bonus) {
        const bEl = $(els.bonus);
        if (bEl) bEl.textContent = `🐾 +${pPct.toFixed(1)}%  👥 +${gPct.toFixed(1)}%`;
      }
    });

    updateHP('player', player.currentHP, player.maxHP);
  }

  function renderEnemy(enemy) {
    if (!enemy) return;

    $('enemyName').textContent = enemy.name;
    $('enemyLevel').textContent = `Level ${enemy.level}`;

    // avatar + rámeček soupeře (online)
    try {
      const img = document.getElementById('enemyAvatar');
      if (img && enemy.avatarUrl) img.src = String(enemy.avatarUrl);
      const box = document.getElementById('enemyCharBox');
      if (box && enemy.avatarFrame) box.style.borderColor = String(enemy.avatarFrame);
    } catch {}
    setEnemyAvatar(enemy);

    
    const baseStats = enemy.baseStats || {};
    const bonuses = enemy.bonuses || {};
	    const petPct = (window.SF && typeof window.SF.getPetBonusesPercent === 'function')
	      ? window.SF.getPetBonusesPercent(baseStats)
	      : { strength:0, defense:0, constitution:0, luck:0 };
    
    const statElements = {
      strength: { value: 'eStr', extra: 'eStrExtra', bonus: 'eStrBonus' },
      defense: { value: 'eDef', extra: 'eDefExtra', bonus: 'eDefBonus' },
      constitution: { value: 'eCon', extra: 'eConExtra', bonus: 'eConBonus' },
      luck: { value: 'eLuck', extra: 'eLuckExtra', bonus: 'eLuckBonus' }
    };
    
    Object.keys(statElements).forEach(stat => {
      const els = statElements[stat];
      const valueEl = $(els.value);
      if (!valueEl) return;

      const base = Number(baseStats[stat] || 10);
      const bonus = bonuses[stat] || 0;
      const rawTotal = base + bonus;
      const pPct = 0;
      const gPct = 0;
      const total = Math.round(rawTotal * (1 + pPct / 100) * (1 + gPct / 100));

      valueEl.textContent = formatStatValue(total);

      if (els.extra) {
        const extraEl = $(els.extra);
        if (extraEl) extraEl.textContent = calculateStatBonus(stat, total, enemy.level, enemy.classType);
      }
      if (els.bonus) {
        const bEl = $(els.bonus);
        if (bEl) bEl.textContent = `🐾 +${pPct.toFixed(1)}%  👥 +${gPct.toFixed(1)}%`;
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
  function startDmgRamp() {
    // DMG ramp: každých 7s +10% (jen během boje)
    gameState.dmgRamp = 1;
    if (gameState._dmgRampTimer) { clearInterval(gameState._dmgRampTimer); gameState._dmgRampTimer = null; }
    gameState._dmgRampTimer = setInterval(() => {
      if (!gameState.battleInProgress) return;
      gameState.dmgRamp = Math.round((gameState.dmgRamp * 1.1) * 1000) / 1000;
    }, 7000);
  }

  function stopDmgRamp() {
    if (gameState._dmgRampTimer) { clearInterval(gameState._dmgRampTimer); gameState._dmgRampTimer = null; }
    gameState.dmgRamp = 1;
  }

  function calculateDamage(attacker, defender) {
    const lvlA = Math.max(1, Number(attacker.level) || 1);
    const lvlD = Math.max(1, Number(defender.level) || 1);

    const str = Math.max(0, Number(attacker.stats?.strength) || 0);
    // Základní dmg roste s levelem, Síla dává +2% dmg / bod
    const base = 10 + lvlA * 3;
    const attackPower = base * (1 + str * 0.02);

    // Obrana: diminishing returns (nikdy 100% redukce)
    const def = Math.max(0, Number(defender.stats?.defense) || 0);
    const k = 140 + lvlD * 18;
    const defenseReduction = Math.min(0.75, def / (def + k));

    const baseDamage = Math.max(1, attackPower * (1 - defenseReduction));
    const variance = 0.9 + Math.random() * 0.2;
    return Math.max(1, Math.round(baseDamage * variance));
  }

  function checkCrit(attacker) {
    const roll = Math.random() * 100;
    return roll < attacker.critChance;
  }

  function checkDodge(attacker, defender) {
    return false;
  }

  async function performAttack(attacker, defender, attackerSide) {
    const weapon = attackerSide === 'player' ? gameState.playerWeapon : gameState.enemyWeapon;

    // Zbraň ukázat HNED na začátku útoku (ať se neobjeví až po zásahu / po HP update)
    try { if (weapon) showWeapon(attackerSide); } catch {}

    // Vyhnutí: když se defender vyhne, nedostane dmg
    if (checkDodge(attacker, defender)) {
      showDodge(attackerSide === 'player' ? 'enemy' : 'player');
      // malá animace "miss" bez hit-shake
      await sleep(850);
      return;
    }

    const isCrit = checkCrit(attacker);
    let damage = calculateDamage(attacker, defender);
    if (attackerSide === 'player') {
      const m = Number(gameState.dmgRamp || 1);
      if (Number.isFinite(m) && m > 1) damage = Math.round(damage * m);
    }
    
    if (isCrit) {
      damage = Math.round(damage * 2);
    }

    // Projektil (throw/melee) chceme časovat tak, aby DMG + HP update přišel ve chvíli zásahu,
    // ne až dlouho po začátku animace.
    if (weapon && (weapon.type === 'throw' || weapon.type === 'melee')) {
      // U molotovu nechceme, aby po hodu zůstal v ruce
      if (weapon.id === 'molotov') hideWeapon(attackerSide);

      // Nejdřív let projektilu
      await animateProjectile(attackerSide, weapon.img);

      // Až po "zásahu" aplikuj dmg + UI
      defender.currentHP = Math.max(0, defender.currentHP - damage);
      showDamage(attackerSide === 'player' ? 'enemy' : 'player', damage, isCrit);
      updateHP(attackerSide === 'player' ? 'enemy' : 'player', defender.currentHP, defender.maxHP);
      playHitAnimation(attackerSide === 'player' ? 'enemy' : 'player', { showHoles: false });

      // Molotov po hodu už neukazujeme v ruce
      if (weapon.id !== 'molotov') showWeapon(attackerSide);
    } else {
      // Guns: dmg + HP hned, protože zásah je "instant"
      defender.currentHP = Math.max(0, defender.currentHP - damage);
      showDamage(attackerSide === 'player' ? 'enemy' : 'player', damage, isCrit);
      updateHP(attackerSide === 'player' ? 'enemy' : 'player', defender.currentHP, defender.maxHP);
      playHitAnimation(attackerSide === 'player' ? 'enemy' : 'player', { showHoles: true });
    }

    await sleep(1000);
  }

  function showDodge(side) {
    const el = side === 'player' ? $('playerDmg') : $('enemyDmg');
    if (!el) return;
    el.textContent = 'VYHNUTÍ!';
    el.classList.remove('show');
    el.style.color = '#2cff5a';
    el.style.fontSize = '30px';
    el.style.textShadow = '0 0 18px rgba(44,255,90,0.75), 0 2px 4px rgba(0,0,0,0.95)';
    void el.offsetWidth;
    el.classList.add('show');
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

  function playHitAnimation(side, opts = {}) {
    const container = side === 'player' 
      ? document.querySelector('.player-section .character-arena')
      : document.querySelector('.enemy-section .character-arena');
    
    if (!container) return;

    container.classList.add('hit-shake');
    
    const showHoles = opts.showHoles !== false;
    const overlays = container.querySelectorAll('.hit-overlay');
    overlays.forEach((overlay, i) => {
      if (!showHoles) {
        overlay.classList.remove('show-hit');
        overlay.style.opacity = '0';
        return;
      }
      // umísti zásah náhodně na tělo (aby to nebylo pořád v rohu)
      try {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const size = 50;
        const minTop = 70; // pod HP barem
        const maxTop = Math.max(minTop, h - 90);
        const left = 10 + Math.random() * Math.max(1, (w - size - 20));
        const top = minTop + Math.random() * Math.max(1, (maxTop - minTop));
        overlay.style.left = `${left}px`;
        overlay.style.top = `${top}px`;
        overlay.style.transform = `rotate(${(-12 + Math.random()*24).toFixed(1)}deg)`;
      } catch {}
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
    }, 700);
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
        body: `**${winnerName}** na tebe zaútočil v aréně!\n\n**PROHRA** 💀\n\n**-${Math.abs(moneyChange)}🪙**\n\nZkus to příště lépe!`,
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
        body: `Porazil jsi **${loserName}** v aréně!\n\n**VÍTĚZSTVÍ** 🏆\n\n**+${moneyChange}🪙**\n\nSkvělý boj!`,
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
    startDmgRamp();

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

    // stop DMG ramp timer
    if (gameState._dmgRampTimer) { clearInterval(gameState._dmgRampTimer); gameState._dmgRampTimer = null; }
    gameState.dmgRamp = 1;
    gameState.battleInProgress = false;
    stopDmgRamp();

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
      // NPC fight (mise/crypta): přičti odměnu stejně jako v aréně
      try { await applyNpcOutcome(true, reward); } catch (e) { console.error('NPC victory update error:', e); }
    }

    const cigLine = reward.cigarettes ? `\n      🚬 +${Number(reward.cigarettes).toLocaleString('cs-CZ')}` : '';
    let lootLine = '';
    if (reward.lootItem) {
      if (reward.lootStatus === 'added') {
        lootLine = `\n      🎁 Drop: ${reward.lootItem.icon} ${reward.lootItem.name}`;
      } else if (reward.lootStatus === 'full') {
        lootLine = `\n      🎁 Drop: inventář plný (nic nepřidáno)`;
      } else {
        lootLine = `\n      🎁 Drop: chyba ukládání`;
      }
    }
    showResultModal('🏆 VÍTĚZSTVÍ! 🏆', `
      Porazil jsi ${gameState.enemy.name}!
      
      Odměna:
      💰 +${reward.money.toLocaleString('cs-CZ')}🪙
      ⭐ +${reward.xp} XP
      ${cigLine}
      ${lootLine}
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
      // NPC fight (mise/crypta): odečti postih
      try { await applyNpcOutcome(false, reward); } catch (e) { console.error('NPC defeat update error:', e); }
    }
    
    showResultModal('💀 PROHRA 💀', `
      Byl jsi poražen hráčem ${gameState.enemy.name}!
      
      Ztráta:
      💰 -${Math.floor(reward.money * 0.5).toLocaleString('cs-CZ')}🪙
      
      Zkus to znovu!
    `);
  }

  
  async function applyNpcOutcome(isWin, reward) {
    const userId = window.SF?.user?.id || window.SF?.stats?.user_id;
    if (!userId) return;

    const sb = await ensureOnline();

    // načti aktuální peníze/xp (radši z DB, aby to sedělo)
    const { data: row, error: e1 } = await sb
      .from('player_stats')
      .select('money,xp,cigarettes')
      .eq('user_id', userId)
      .maybeSingle();

    if (e1) throw e1;

    const curMoney = Number(row?.money ?? window.SF?.stats?.money ?? 0);
    const curXp = Number(row?.xp ?? window.SF?.stats?.xp ?? 0);
    const curCigs = Number(row?.cigarettes ?? window.SF?.stats?.cigarettes ?? 0);

    const moneyDelta = isWin ? reward.money : -Math.floor(reward.money * 0.5);
    const xpDelta = isWin ? reward.xp : 0;
    const cigsDelta = isWin ? Number(reward.cigarettes || 0) : 0;

    const newMoney = Math.max(0, curMoney + moneyDelta);
    const newXp = Math.max(0, curXp + xpDelta);
    const newCigs = Math.max(0, curCigs + cigsDelta);

    const { error: e2 } = await sb
      .from('player_stats')
      .update({ money: newMoney, xp: newXp, cigarettes: newCigs })
      .eq('user_id', userId);

    if (e2) throw e2;

    try { await window.SF?.refresh?.(); } catch (_) {}

    // S&F vibe: loot drop (mise/crypta) -> uloz do inventare
    if (isWin && reward && reward.lootItem) {
      try {
        const res = await addLootToInventory(userId, reward.lootItem);
        reward.lootStatus = res?.ok ? 'added' : (res?.reason || 'failed');
      } catch (e) {
        console.warn('loot add failed:', e);
        reward.lootStatus = 'error';
      }
    }

    // Extra logika pro mise/cryptu (aby nešlo znovu útočit a aby se správně posunul progress)
    try {
      if (arena2Mode === 'mission') {
        await finalizeMissionAfterFight(isWin, reward);
      } else if (arena2Mode === 'crypta') {
        await finalizeCryptaAfterFight(isWin);
      }
    } catch (e) {
      console.warn('finalize NPC failed:', e);
    }
  }

  async function finalizeMissionAfterFight(isWin, reward) {
    const sb = await ensureOnline();
    const userId = window.SF?.user?.id || window.SF?.stats?.user_id;
    if (!userId) return;

    const slot = arena2Ctx?.slot; // slot1/slot2
    if (!slot) return;

    const { data, error } = await sb
      .from('player_stats')
      .select('missiondata')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;

    const md = data?.missiondata || {};
    md.activeMissions = md.activeMissions || { slot1: null, slot2: null, slot3: null };

    // vždy ukonči misi (i prohra = konec, musí se vygenerovat nová)
    md.activeMissions[slot] = null;

    // statistiky
    md.totalBattles = (md.totalBattles || 0) + 1;
    if (isWin) {
      md.totalWins = (md.totalWins || 0) + 1;
      md.completedMissions = (md.completedMissions || 0) + 1;
      md.totalExpEarned = (md.totalExpEarned || 0) + Number(reward?.xp || 0);
      md.totalMoneyEarned = (md.totalMoneyEarned || 0) + Number(reward?.money || 0);
    }

    const { error: e2 } = await sb
      .from('player_stats')
      .update({ missiondata: md })
      .eq('user_id', userId);
    if (e2) throw e2;

    try { await window.SF?.refresh?.(); } catch (_) {}
  }

  async function finalizeCryptaAfterFight(isWin) {
    if (!isWin) return; // prohra = nic neodemkni

    const sb = await ensureOnline();
    const userId = window.SF?.user?.id || window.SF?.stats?.user_id;
    if (!userId) return;

    const bossIndex = Number(arena2Ctx?.bossIndex);
    if (!Number.isFinite(bossIndex)) return;

    const { data, error } = await sb
      .from('player_stats')
      .select('crypta_progress,inventory')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;

    const cp = data?.crypta_progress || { current: 0, defeated: [] };
    const defeated = Array.isArray(cp.defeated) ? cp.defeated.slice() : [];
    if (!defeated.includes(bossIndex)) defeated.push(bossIndex);

    // odemkni dalšího bosse
    const next = bossIndex + 1;
    const current = Math.max(Number(cp.current || 0), next);

    // přidej reward do inventáře (pokud je)
    const inv = Array.isArray(data?.inventory) ? data.inventory.slice() : [];
    const reward = arena2Ctx?.reward;
    if (reward && reward.id) {
      const exists = inv.some(it => (it && (it.id === reward.id || it.item_id === reward.id)));
      if (!exists) inv.push(reward);
    }

    const { error: e2 } = await sb
      .from('player_stats')
      .update({
        crypta_progress: { current, defeated },
        inventory: inv
      })
      .eq('user_id', userId);
    if (e2) throw e2;

    // vyčisti pending fight payload (aby se nevracel starý boss)
    try { await sb.from('crypta_fights').delete().eq('user_id', userId); } catch (_) {}

    try { await window.SF?.refresh?.(); } catch (_) {}
  }



  function applyLuckToReward(baseReward) {
    const r = baseReward || { money:0, xp:0, cigarettes:0 };
    let luck = 0;
    let lvl = 1;
    try {
      luck = Number(window.SF?.stats?.stats?.luck || window.SF?.stats?.luck || 0) || 0;
      lvl = Number(window.SF?.stats?.level || window.SF?.level || 1) || 1;
    } catch (_) {}
    luck = Math.max(0, luck);
    lvl = Math.max(1, lvl);

    const denom = luck + (200 + lvl * 20);
    const ratio = denom > 0 ? (luck / denom) : 0;
    const lootMult = 1 + ratio * 0.25; // až +25%

    const money = Math.floor((Number(r.money) || 0) * lootMult);
    const xp = Math.floor((Number(r.xp) || 0) * (0.97 + ratio * 0.03));

    // malá šance na extra cigáro při výhře
    const baseC = Math.max(0, Math.floor(Number(r.cigarettes) || 0));
    const extraChance = Math.min(0.22, 0.02 + ratio * 0.18);
    const extra = (Math.random() < extraChance) ? 1 : 0;

    return { money, xp, cigarettes: baseC + extra };
  }

  // ===== S&F-ish: loot dropy z misí/crypty =====
  function normalizeInventory8(inv) {
    const size = 8;
    const arr = Array.isArray(inv) ? inv.slice(0, size) : [];
    while (arr.length < size) arr.push(null);
    return arr.map(x => (x === undefined ? null : x));
  }

  function getAllShopItemsFlat() {
    const db = window.SHOP_ITEMS || {};
    return [
      ...(db.weapons || []),
      ...(db.armor || []),
      ...(db.special || [])
    ];
  }

  function rollRarity(level, luck, difficulty) {
    const lvl = Math.max(1, Number(level) || 1);
    const l = Math.max(0, Number(luck) || 0);
    const luckFactor = l / (l + 300); // 0..~1

    // base (shop): common 70, rare 22, epic 7, legendary 1
    let pLegend = 0.01;
    let pEpic = 0.07;
    let pRare = 0.22;

    // mise: obtiznost pridava trochu na lep... (dungeon feel)
    const d = String(difficulty || 'medium').toLowerCase();
    const diffBoost = (d === 'easy') ? 0.00 : (d === 'medium') ? 0.01 : (d === 'hard') ? 0.02 : 0.03;
    pLegend += diffBoost * 0.6;
    pEpic += diffBoost * 1.4;
    pRare += diffBoost * 2.0;

    // level mini posun
    const bonusP = Math.min(0.06, lvl / 2000);
    pLegend += bonusP * 0.35;
    pEpic += bonusP * 0.45;
    pRare += bonusP * 0.20;

    // luck posunuje hmotu z common do rare/epic/legend
    const luckShift = 0.10 * luckFactor; // max ~10%
    pLegend += luckShift * 0.08;
    pEpic += luckShift * 0.22;
    pRare += luckShift * 0.70;

    // normalizace aby sum nepřesáhl 1
    const totalUp = pLegend + pEpic + pRare;
    const pCommon = Math.max(0.02, 1 - totalUp);

    const roll = Math.random();
    if (roll < pLegend) return 'legendary';
    if (roll < pLegend + pEpic) return 'epic';
    if (roll < pLegend + pEpic + pRare) return 'rare';
    return 'common';
  }

  function makeLootInstance(baseItem, level, luck, difficulty) {
    const lvl = Math.max(1, Number(level) || 1);
    const rarity = rollRarity(lvl, luck, difficulty);
    const rarityMult = ({ common:1.0, rare:1.3, epic:1.7, legendary:2.2 }[rarity] || 1.0);
    const rollMin = 0.90;
    const rollMax = 1.15;
    const roll = rollMin + Math.random() * (rollMax - rollMin);

    const inst = JSON.parse(JSON.stringify(baseItem || {}));
    inst.instance_id = `${inst.id}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    inst.rarity = rarity;
    inst.req_level = Math.max(1, Math.floor(lvl * (0.85 + Math.random() * 0.20)));

    // ceny se moc nehodi pro loot (ale nechame pro prodej)
    inst.price = Math.max(10, Math.floor((Number(inst.price) || 10) * (0.75 + lvl * 0.02) * rarityMult));

    // bonusy skaluji jemne s levelem + roll
    if (inst.bonuses && typeof inst.bonuses === 'object') {
      const scaled = {};
      Object.keys(inst.bonuses).forEach(k => {
        const v0 = Number(inst.bonuses[k] || 0);
        if (!Number.isFinite(v0) || v0 === 0) { scaled[k] = v0; return; }
        const sign = v0 < 0 ? -1 : 1;
        const v = Math.abs(v0);
        const lvlScale = 1 + Math.min(0.9, lvl * 0.06);
        let out = v * roll * rarityMult * lvlScale;
        // soft cap na bonusy podle levelu (aby se to neutrhlo)
        const cap = 6 + lvl * 2.2;
        out = Math.min(out, cap);
        scaled[k] = Math.round(out * sign);
      });
      inst.bonuses = scaled;
    }
    return inst;
  }

  function maybeGenerateLootForContext(ctx) {
    if (!ctx || (ctx.type !== 'mission' && ctx.type !== 'crypta')) return null;
    // loot jen pro mise/cryptu a jen pri vyhre (vola se z handleVictory)
    let lvl = 1;
    let luck = 0;
    try {
      lvl = Number(window.SF?.stats?.level || window.SF?.level || 1) || 1;
      luck = Number(window.SF?.stats?.stats?.luck || window.SF?.stats?.luck || 0) || 0;
    } catch (_) {}
    lvl = Math.max(1, lvl);
    luck = Math.max(0, luck);

    const d = (ctx.difficulty || ctx?.rewards?.difficulty || 'medium');
    const diff = String(d).toLowerCase();
    const base = (diff === 'easy') ? 0.10 : (diff === 'medium') ? 0.14 : (diff === 'hard') ? 0.20 : 0.26;
    const luckFactor = luck / (luck + 280);
    const chance = Math.min(0.40, base + luckFactor * 0.12);
    if (Math.random() > chance) return null;

    const pool = getAllShopItemsFlat();
    if (!pool.length) return null;
    const baseItem = pool[Math.floor(Math.random() * pool.length)];
    return makeLootInstance(baseItem, lvl, luck, diff);
  }

  async function addLootToInventory(userId, lootItem) {
    if (!userId || !lootItem) return { ok: false, reason: 'missing' };
    const sb = await ensureOnline();
    const { data, error } = await sb
      .from('player_stats')
      .select('inventory')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;

    const inv = normalizeInventory8(data?.inventory);
    const freeIdx = inv.findIndex(x => !x);
    if (freeIdx === -1) return { ok: false, reason: 'full' };
    inv[freeIdx] = lootItem;

    const { error: e2 } = await sb
      .from('player_stats')
      .update({ inventory: inv })
      .eq('user_id', userId);
    if (e2) throw e2;

    return { ok: true };
  }

function calculateReward() {
    // Pro mise/cryptu přebíráme reward z contextu (mise.js/auto.js)
    let ctx = null;
    try { ctx = JSON.parse(sessionStorage.getItem('arena2_context') || 'null'); } catch {}
    if (ctx && (ctx.type === 'mission') && ctx.rewards) {
      const base = applyLuckToReward({
        money: Math.max(0, Math.floor(Number(ctx.rewards.money) || 0)),
        xp: Math.max(0, Math.floor(Number(ctx.rewards.exp ?? ctx.rewards.xp) || 0)),
        cigarettes: Math.max(0, Math.floor(Number(ctx.rewards.cigarettes) || 0)),
      });
      // S&F vibe: obcasny drop itemu z mise
      base.lootItem = maybeGenerateLootForContext(ctx);
      return base;
    }

    // Crypta může posílat buď reward item, nebo money/xp
    if (ctx && (ctx.type === 'crypta') && ctx.reward) {
      const r = ctx.reward;
      const base = applyLuckToReward({
        money: Math.max(0, Math.floor(Number(r.money) || 0)),
        xp: Math.max(0, Math.floor(Number(r.xp) || 0)),
        cigarettes: Math.max(0, Math.floor(Number(r.cigarettes) || 0)),
      });
      // Crypta: maly drop navic (mimo garantovanou odmenu)
      base.lootItem = maybeGenerateLootForContext(ctx);
      return base;
    }

    // Default (PVP nebo fallback): odměna podle levelu nepřítele
    const enemyLevel = Math.max(1, Number(gameState.enemy.level) || 1);
    const moneyReward = Math.round(70 * Math.pow(enemyLevel, 1.08));
    const xpReward = Math.round(40 * Math.pow(enemyLevel, 1.05));
    return applyLuckToReward({ money: moneyReward, xp: xpReward, cigarettes: 0 });
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
    // Weapon soupeře z equipu
    try {
      gameState.enemyWeapon = resolveWeaponForRow(enemyRow);
      setWeaponInHands('enemy', gameState.enemyWeapon);
    } catch (e) {
      console.warn('Weapon resolve (enemy) failed:', e);
      gameState.enemyWeapon = { id: 'ak47', type: 'gun', img: 'zbran1.png', fireImg: 'zbran2.png' };
      setWeaponInHands('enemy', gameState.enemyWeapon);
    }
    renderEnemy(gameState.enemy);
    
    gameState.player.currentHP = gameState.player.maxHP;
    renderPlayer(gameState.player);
    try { renderClassBadges(); } catch {}

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
    // V NPC módu po boji vrať hráče zpátky a nepovoluj znovu útočit na stejného bosse/misi
    if (arena2Mode === 'mission') {
      window.location.href = 'mise.html';
      return;
    }
    if (arena2Mode === 'crypta') {
      window.location.href = 'auto.html';
      return;
    }

    hideResultModal();
  }

  // ===== INIT =====
  async function init() {
    console.log('🎮 Initializing arena...');

    // Wire buttons (musí fungovat i v NPC módu, jinak nejde zavřít výsledek / ručně spustit boj)
    const attackBtn = $('attackBtn');
    const nextBtn = $('nextEnemyBtn');
    const contBtn = $('resultContinue');
    if (attackBtn) attackBtn.addEventListener('click', onAttack);
    if (nextBtn) nextBtn.addEventListener('click', onNextEnemy);
    if (contBtn) contBtn.addEventListener('click', onResultContinue);

    // arena2: načti context z misí/crypty
    arena2Ctx = readArena2Context();
    const fromCryptaParam = getQueryFlag('fromCrypta');
    if (arena2Ctx || fromCryptaParam) {
      if (!arena2Ctx && fromCryptaParam) {
        // když přišel jen param, zkus sessionStorage a pak DB
        arena2Ctx = readArena2Context();
        if (!arena2Ctx) {
          arena2Ctx = await fetchCryptaContextFromDB();
        }
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

    // Weapon z equipu (shop)
    try {
      gameState.playerWeapon = resolveWeaponForRow(window.SF?.stats || {});
      setWeaponInHands('player', gameState.playerWeapon);
    } catch (e) {
      console.warn('Weapon resolve (player) failed:', e);
      gameState.playerWeapon = { id: 'ak47', type: 'gun', img: 'zbran1.png', fireImg: 'zbran2.png' };
      setWeaponInHands('player', gameState.playerWeapon);
    }

    renderPlayer(gameState.player);

    // arena2: pokud jsme přišli z mise/crypty, načti NPC soupeře a (volitelně) auto-start
    if (arena2Mode !== 'pvp') {
      const rawEnemy = arena2Mode === 'mission' ? (arena2Ctx?.enemy) : (arena2Ctx?.boss || arena2Ctx?.enemy);
      if (!rawEnemy) {
        showNotification('Chybí data soupeře (mise/crypta)', 'error');
      } else {
        gameState.enemy = normalizeNpcStats(rawEnemy);
        // weapon NPC (pokud má equipped) – jinak fallback
        try {
          gameState.enemyWeapon = resolveWeaponForRow(rawEnemy);
          setWeaponInHands('enemy', gameState.enemyWeapon);
        } catch (e) {
          console.warn('Weapon resolve (npc enemy) failed:', e);
          gameState.enemyWeapon = { id: 'ak47', type: 'gun', img: 'zbran1.png', fireImg: 'zbran2.png' };
          setWeaponInHands('enemy', gameState.enemyWeapon);
        }
        renderEnemy(gameState.enemy);
        // v arena2 (mise/crypta) nechceme random soupeře ani cooldown tlačítka
        const nextBtn2 = $('nextEnemyBtn');
        if (nextBtn2) { nextBtn2.disabled = true; nextBtn2.style.display = 'none'; }
        const attackBtn2 = $('attackBtn');
        if (attackBtn2) { attackBtn2.textContent = '⚔️ BOJOVAT'; }
        // auto start
        if (arena2Ctx?.autoStart !== false) {
          // malý delay aby se DOM překreslil
          setTimeout(() => { startBattle(); }, 150);
        }
      }

      // Po načtení NPC kontextu ho smaž, ať se po návratu do arena2 nespouští furt dokola
      try {
        sessionStorage.removeItem('arena2_context');
        sessionStorage.removeItem('arenaFromMission');
        sessionStorage.removeItem('arenaFromCrypta');
      } catch (_) {}

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

    // Sync currency
    syncCurrencyUI();

    console.log('✅ Arena initialized!');
  }

  // ===== BOOT =====
  
  function renderClassBadges() {
    try {
      let cls = null;
      try {
        if (typeof window.sfGetPlayerClassSafe === 'function') cls = window.sfGetPlayerClassSafe();
      } catch {}
      if (!cls) {
        cls = (window.SF?.stats?.stats?.player_class) || (window.playerStats?.player_info?.player_class) || null;
        if (typeof cls === 'string') cls = String(cls).toLowerCase();
      }
      const meta = (window.SF_CLASS_META && cls && window.SF_CLASS_META[cls]) ? window.SF_CLASS_META[cls] : (window.SF_CLASS_META ? window.SF_CLASS_META.padouch : null);
      const pb = document.getElementById("playerClassBadge");
      if (pb && meta) { pb.textContent = meta.icon; pb.title = meta.label; }
      const eb = document.getElementById("enemyClassBadge");
      if (eb) { eb.textContent = window.SF_DABLIK_ICON || "😈"; eb.title = "Dablík"; }
    } catch {}
  }


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

try { renderClassBadges(); } catch {}
