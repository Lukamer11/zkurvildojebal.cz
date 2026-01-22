// arena.js - Arena s reálnými hráči, cooldown sync, mail notifikacemi a vyhledáváním

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
    enemyWeapon: null
  };

  // ===== WEAPON / ATTACK TYPE HELPERS =====
  function emojiToDataUri(emoji) {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-size="96">${emoji}</text>
</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function resolveWeaponForRow(row) {
    // default: AK-47
    const fallback = { id: 'ak47', type: 'gun', img: 'zbran1.png', fireImg: 'zbran2.png' };

    const eq = (row?.equipped || window.SF?.stats?.equipped || {});
    const weaponRef = eq.weapon || eq.weapons || eq.main || null;
    const item = getItemById(weaponRef, row);
    if (!item) return fallback;

    const id = String(item.id || item.instance_id || weaponRef || '').trim() || 'ak47';

    // typ zbraně
    // - molotov = throw
    // - "gun" když je to jednoznačně střelná zbraň
    // - jinak melee (a v aréně se HÁZÍ jako projektil)
    let type = 'melee';
    if (id === 'molotov') type = 'throw';
    const gunIds = new Set([
      'ak47','m249','glock','shotgun','sniper','uzi','mp5','deagle','revolver',
      'crossbow','sks','famas','scar','rpk','ppsh','fnfal','saiga'
    ]);
    if (gunIds.has(id)) type = 'gun';

    // obrázek do ruky / projektil
    let img = null;
    if (typeof item.icon === 'string') {
      const ic = item.icon.trim();
      if (ic.endsWith('.png') || ic.endsWith('.jpg') || ic.endsWith('.jpeg') || ic.endsWith('.webp') || ic.endsWith('.gif')) {
        img = ic;
      } else if (ic.length <= 4) {
        img = emojiToDataUri(ic);
      }
    }

    // AK má speciální "fire" frame, ostatní guns necháme jako default
    if (id === 'ak47') {
      return { id, type, img: 'zbran1.png', fireImg: 'zbran2.png' };
    }

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

    // pro guns používáme klasické držení (zbran1.png), pro throw/melee použijeme ikonu itemu (pokud existuje)
    if (weapon.type === 'gun') {
      el.src = weapon.img || 'zbran1.png';
    } else {
      el.src = weapon.img || 'zbran1.png';
    }
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

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    }).finally(() => {
      try { proj.remove(); } catch {}
    });
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
    // Bez DEX/INT: třída je jen kosmetika pro UI
    return (str >= def) ? 'rvac' : 'padouch';
  }

  // ===== BALANCE (S&F-like) =====
  // aby nízké levely nebyly náhodně přestřelené a vysoké levely neměly 100% crit.
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
      $('searchPlayerBtn').disabled = true;
      $('attackBtn').textContent = `⏰ ${timeText}`;
      $('nextEnemyBtn').textContent = `⏰ ${timeText}`;
      $('searchPlayerBtn').textContent = `⏰ ${timeText}`;
      $('attackBtn').style.opacity = '0.5';
      $('nextEnemyBtn').style.opacity = '0.5';
      $('searchPlayerBtn').style.opacity = '0.5';
    } else {
      $('attackBtn').disabled = false;
      $('nextEnemyBtn').disabled = false;
      $('searchPlayerBtn').disabled = false;
      $('attackBtn').textContent = '⚔️ ZAÚTOČIT';
      $('nextEnemyBtn').textContent = '🔄 DALŠÍ SOUPEŘ';
      $('searchPlayerBtn').textContent = '🎯 VYHLEDAT';
      $('attackBtn').style.opacity = '1';
      $('nextEnemyBtn').style.opacity = '1';
      $('searchPlayerBtn').style.opacity = '1';
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

  // ===== SEARCH PLAYER BY NAME =====
  async function searchPlayerByName(playerName) {
    const sb = await ensureOnline();
    const currentUserId = window.SF?.user?.id;
    
    if (!currentUserId) {
      console.error('Current user not found');
      return null;
    }

    if (!playerName || playerName.trim() === '') {
      showNotification('Zadej jméno hráče!', 'error');
      return null;
    }

    const searchTerm = playerName.trim().toLowerCase();

    try {
      // Hledáme v username nebo v character_name (stats JSON)
      const { data: players, error } = await sb
        .from('player_stats')
        .select('*')
        .neq('user_id', currentUserId);

      if (error) {
        console.error('Error searching players:', error);
        showNotification('Chyba při hledání hráče', 'error');
        return null;
      }

      if (!players || players.length === 0) {
        showNotification('Žádní hráči nenalezeni', 'error');
        return null;
      }

      // Filtrujeme na základě username nebo character_name ve stats
      const foundPlayers = players.filter(p => {
        const username = (p.username || '').toLowerCase();
        let charName = '';
        
        try {
          const stats = typeof p.stats === 'string' ? JSON.parse(p.stats) : p.stats;
          charName = (stats?.character_name || '').toLowerCase();
        } catch (e) {
          // ignore parse errors
        }

        return username.includes(searchTerm) || charName.includes(searchTerm);
      });

      if (foundPlayers.length === 0) {
        showNotification(`Hráč "${playerName}" nebyl nalezen`, 'error');
        return null;
      }

      // Pokud je více výsledků, vezmeme prvního
      if (foundPlayers.length > 1) {
        showNotification(`Nalezeno ${foundPlayers.length} hráčů, vybírám prvního`, 'info');
      }

      return foundPlayers[0];
    } catch (e) {
      console.error('Search error:', e);
      showNotification('Chyba při hledání', 'error');
      return null;
    }
  }

  // ===== LOAD PLAYER DATA =====
  async function loadPlayerData() {
    await window.SFReady;
    const stats = window.SF?.stats;
    
    if (!stats) {
      console.error('Player stats not available');
      return null;
    }

    // stats.stats může být u některých hráčů uložené jako JSON string
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
      case "luck": {
        const crit = getCritChanceFromLuckAndLevel(val, level);
        return `${Math.round(crit * 100)}% Crit`;
      }
      case "constitution": {
        const hp = calculateMaxHP(val, level);
        return `${hp} HP`;
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

      // Celková hodnota = (base + itemy/bonusy) * (1 + mazlíček%) * (1 + guilda%)
      const rawTotal = base + bonus;
      const pPct = Number(petPct?.[stat] || 0);
      const gPct = Number(guildPct?.[stat] || 0);
      const total = Math.round(rawTotal * (1 + pPct / 100) * (1 + gPct / 100));
	
      // Zobraz: jen čistou hodnotu (bez bílých "(+...)" rozpadů).
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
	        if (bEl) bEl.textContent = `🐾 +${pPct.toFixed(1)}%  💥 +${gPct.toFixed(1)}%`;
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
    
    const baseStats = enemy.baseStats || {};
    const bonuses = enemy.bonuses || {};
    
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
      
      // Zobraz jen čistou hodnotu (bez rozpadů a plusů)
      valueEl.textContent = formatStatValue(total);
      
      if (els.extra) {
        const extraEl = $(els.extra);
        if (extraEl) {
          extraEl.textContent = calculateStatBonus(stat, total, enemy.level, enemy.classType);
        }
      }
      if (els.bonus) {
        const bEl = $(els.bonus);
        if (bEl) bEl.textContent = `🐾 +${pPct.toFixed(1)}%  💥 +${gPct.toFixed(1)}%`;
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

  async function performAttack(attacker, defender, attackerSide) {
    const weapon = attackerSide === 'player' ? gameState.playerWeapon : gameState.enemyWeapon;

    // Zbraň ukázat hned na startu útoku (ať enemy "má zbraň" vidět při střelbě)
    try { if (weapon) showWeapon(attackerSide); } catch {}

    const isCrit = checkCrit(attacker);
    let damage = calculateDamage(attacker, defender);
    if (attackerSide === 'player') {
      const m = Number(gameState.dmgRamp || 1);
      if (Number.isFinite(m) && m > 1) damage = Math.round(damage * m);
    }
    
    if (isCrit) {
      damage = Math.round(damage * 2);
    }

    // Throw/melee časujeme tak, aby DMG + HP update přišel při zásahu.
    if (weapon && (weapon.type === 'throw' || weapon.type === 'melee')) {
      if (weapon.id === 'molotov') hideWeapon(attackerSide);

      await animateProjectile(attackerSide, weapon.img);

      defender.currentHP = Math.max(0, defender.currentHP - damage);
      showDamage(attackerSide === 'player' ? 'enemy' : 'player', damage, isCrit);
      updateHP(attackerSide === 'player' ? 'enemy' : 'player', defender.currentHP, defender.maxHP);
      playHitAnimation(attackerSide === 'player' ? 'enemy' : 'player', { showHoles: false });

      if (weapon.id !== 'molotov') showWeapon(attackerSide);
    } else {
      // Guns: zásah je "instant" -> hned DMG + HP
      defender.currentHP = Math.max(0, defender.currentHP - damage);
      showDamage(attackerSide === 'player' ? 'enemy' : 'player', damage, isCrit);
      updateHP(attackerSide === 'player' ? 'enemy' : 'player', defender.currentHP, defender.maxHP);
      playHitAnimation(attackerSide === 'player' ? 'enemy' : 'player', { showHoles: true });
    }

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
        // žádné díry při házení (molotov / melee)
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

    // DMG ramp: každých 7s +10% (jen během boje)
    gameState.dmgRamp = 1;
    if (gameState._dmgRampTimer) { clearInterval(gameState._dmgRampTimer); gameState._dmgRampTimer = null; }
    gameState._dmgRampTimer = setInterval(() => {
      if (!gameState.battleInProgress) return;
      gameState.dmgRamp = Math.round((gameState.dmgRamp * 1.1) * 1000) / 1000;
    }, 7000);

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

    // Update cooldown na serveru
    await updateCooldown(window.SF?.user?.id);
    startCooldownTimer();

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
    
    await window.SFReady;
    const sb = await ensureOnline();
    
    // Update stats přes RPC
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

    showResultModal('🏆 VÍTĚZSTVÍ! 🏆', `
      Porazil jsi ${gameState.enemy.name}!
      
      Odměna:
      💰 +${reward.money.toLocaleString('cs-CZ')}🪙
      ⭐ +${reward.xp} XP
    `);
  }

  async function handleDefeat() {
    console.log('💀 Defeat!');
    
    const reward = calculateReward();
    
    await window.SFReady;
    const sb = await ensureOnline();
    
    // Update stats přes RPC
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
    
    showResultModal('💀 PROHRA 💀', `
      Byl jsi poražen hráčem ${gameState.enemy.name}!
      
      Ztráta:
      💰 -${Math.floor(reward.money * 0.5).toLocaleString('cs-CZ')}🪙
      
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
    // Badge pro soupeře (dablík) + hráče
    try { renderClassBadges(); } catch {}
    
    gameState.player.currentHP = gameState.player.maxHP;
    renderPlayer(gameState.player);
    // Nastav badge hráče hned po načtení
    try { renderClassBadges(); } catch {}
    try { renderClassBadges(); } catch {}

    showNotification(`Nový soupeř: ${gameState.enemy.name} (Level ${gameState.enemy.level})`, 'success');

    startCooldownTimer();
  }

  // ===== SEARCH AND LOAD SPECIFIC PLAYER =====
  async function loadSpecificPlayer() {
    const searchInput = $('searchPlayerInput');
    if (!searchInput) return;

    const playerName = searchInput.value;
    
    if (!playerName || playerName.trim() === '') {
      showNotification('Zadej jméno hráče!', 'error');
      return;
    }

    console.log(`🔍 Searching for player: ${playerName}`);
    
    $('searchPlayerBtn').disabled = true;
    $('searchPlayerBtn').textContent = '⏳ HLEDÁM...';
    
    const enemyRow = await searchPlayerByName(playerName);
    
    if (!enemyRow) {
      $('searchPlayerBtn').disabled = false;
      $('searchPlayerBtn').textContent = '🎯 VYHLEDAT';
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
    // Badge pro soupeře (dablík) + hráče
    try { renderClassBadges(); } catch {}
    
    gameState.player.currentHP = gameState.player.maxHP;
    renderPlayer(gameState.player);
    // Nastav badge hráče hned po načtení
    try { renderClassBadges(); } catch {}
    try { renderClassBadges(); } catch {}

    showNotification(`Soupeř nalezen: ${gameState.enemy.name} (Level ${gameState.enemy.level})`, 'success');

    // Clear search input
    searchInput.value = '';

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
      background: ${type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : type === 'info' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'linear-gradient(135deg, #ef4444, #dc2626)'};
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
    
    const remaining = await getCooldownRemaining(userId);
    if (remaining > 0) {
      showNotification('Musíš počkat na cooldown!', 'error');
      return;
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
    
    const remaining = await getCooldownRemaining(userId);
    if (remaining > 0) {
      showNotification('Musíš počkat na cooldown!', 'error');
      return;
    }
    
    hideResultModal();
    await loadNewOpponent();
  }

  async function onSearchPlayer() {
    if (gameState.battleInProgress) {
      showNotification('Boj právě probíhá!', 'error');
      return;
    }
    
    const userId = window.SF?.user?.id;
    if (!userId) {
      showNotification('Uživatel není přihlášen!', 'error');
      return;
    }
    
    const remaining = await getCooldownRemaining(userId);
    if (remaining > 0) {
      showNotification('Musíš počkat na cooldown!', 'error');
      return;
    }
    
    hideResultModal();
    await loadSpecificPlayer();
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
    $('searchPlayerBtn').addEventListener('click', onSearchPlayer);
    $('resultContinue').addEventListener('click', onResultContinue);

    // Enter key support for search
    $('searchPlayerInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        onSearchPlayer();
      }
    });

    // Sync currency
    syncCurrencyUI();

    console.log('✅ Arena initialized!');
  }

  // ===== BOOT =====
  
  function renderClassBadges() {
    try {
      // Ber třídu z nejspolehlivějšího zdroje (menu.js má safe getter)
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