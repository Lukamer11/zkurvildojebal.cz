// boss.js - World Boss System s persistentním HP a legendárními odměnami

(() => {
  "use strict";

  // ===== CONFIG =====
  const BOSS_TABLE = "world_boss";
  const BOSS_ATTACKS_TABLE = "boss_attacks";
  const MAX_ATTACKS_PER_DAY = 6;
  const BOSS_RESPAWN_HOURS = 24; // 24 hodin mezi respawny
  
  // Boss stats - HODNĚ SILNÝ!
  const BOSS_CONFIG = {
    name: "💀 ANCIENT DEMON 💀",
    level: 100,
    maxHP: 500000, // 500k HP!
    strength: 500,
    defense: 300,
    constitution: 1000,
    luck: 50,
    avatarUrl: "avatar.jpg" // můžeš změnit na speciální boss avatar
  };

  // ===== DOM HELPERS =====
  const $ = (id) => document.getElementById(id);

  // ===== GAME STATE =====
  let gameState = {
    player: null,
    boss: null,
    battleInProgress: false,
    attacksToday: 0,
    playerWeapon: null
  };

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
    const rawId = String(itemRef || "");
    if (!rawId) return null;

    const inv = (row?.inventory || window.SF?.stats?.inventory || []);
    const foundInv = inv.find((x) => {
      if (!x) return false;
      if (typeof x === "object") return x.instance_id === rawId || x.id === rawId;
      return String(x) === rawId;
    });
    if (foundInv && typeof foundInv === "object") return foundInv;

    const eq = (row?.equipped || window.SF?.stats?.equipped || {});
    const eqObj = Object.values(eq).find((x) => x && typeof x === "object" && (x.instance_id === rawId || x.id === rawId));
    if (eqObj && typeof eqObj === "object") return eqObj;

    return getAllItems().find((it) => it.id === rawId) || null;
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
    const dex = Math.max(0, Number(totalDex) || 0);
    const lvl = Math.max(1, Number(level) || 1);
    const denom = dex + (lvl * 22 + 120);
    const ratio = denom > 0 ? (dex / denom) : 0;
    const crit = 2 + ratio * 48;
    return Math.max(1, Math.min(50, Math.round(crit)));
  }

  function calculateTotalStats(row) {
    const stats = row.stats || {};
    const bonuses = calculateTotalBonuses(row);
    const petPct = (window.SF && typeof window.SF.getPetBonusesPercent === 'function')
      ? window.SF.getPetBonusesPercent(row)
      : { strength:0, defense:0, dexterity:0, intelligence:0, constitution:0, luck:0 };
    
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
    return Math.round(250 + lvl * 35 + con * 22);
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
        return `+${Math.round(val * 2)} DMG`;
      case "defense": {
        const red = Math.min(100, Math.floor((val / (28 + Math.floor((level - 1) * 2))) * 100));
        return `${red}% Redukce`;
      }
      case "dexterity": {
        const crit = getCritChanceFromDexAndLevel(val, level);
        return `+${crit}% Crit`;
      }
      case "intelligence":
        return `+${Math.floor(val * 1.5)}% Magie`;
      case "constitution": {
        const hp = calculateMaxHP(val, level);
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

  // ===== BOSS DATA MANAGEMENT =====
  async function loadBossData() {
    try {
      const sb = await ensureOnline();
      
      // Zkus načíst aktuálního bosse
      const { data, error } = await sb
        .from(BOSS_TABLE)
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading boss:', error);
        return null;
      }

      // Pokud boss neexistuje nebo je mrtvý, vytvoř nového
      if (!data || data.current_hp <= 0) {
        return await createNewBoss();
      }

      // Zkontroluj, jestli už není čas na respawn (pokud je mrtvý)
      if (data.current_hp <= 0) {
        const deathTime = new Date(data.death_time).getTime();
        const now = Date.now();
        const hoursSinceDeath = (now - deathTime) / (1000 * 60 * 60);
        
        if (hoursSinceDeath >= BOSS_RESPAWN_HOURS) {
          return await createNewBoss();
        }
      }

      return {
        id: data.id,
        name: BOSS_CONFIG.name,
        level: BOSS_CONFIG.level,
        maxHP: BOSS_CONFIG.maxHP,
        currentHP: data.current_hp,
        stats: {
          strength: BOSS_CONFIG.strength,
          defense: BOSS_CONFIG.defense,
          constitution: BOSS_CONFIG.constitution,
          luck: BOSS_CONFIG.luck
        },
        deathTime: data.death_time,
        isActive: data.is_active,
        avatarUrl: BOSS_CONFIG.avatarUrl
      };
    } catch (e) {
      console.error('Load boss error:', e);
      return null;
    }
  }

  async function createNewBoss() {
    try {
      const sb = await ensureOnline();
      
      // Deaktivuj všechny staré bossy
      await sb
        .from(BOSS_TABLE)
        .update({ is_active: false })
        .eq('is_active', true);

      // Vytvoř nového bosse
      const { data, error } = await sb
        .from(BOSS_TABLE)
        .insert({
          current_hp: BOSS_CONFIG.maxHP,
          max_hp: BOSS_CONFIG.maxHP,
          is_active: true,
          spawn_time: new Date().toISOString(),
          death_time: null
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Nový boss vytvořen!');

      return {
        id: data.id,
        name: BOSS_CONFIG.name,
        level: BOSS_CONFIG.level,
        maxHP: BOSS_CONFIG.maxHP,
        currentHP: data.current_hp,
        stats: {
          strength: BOSS_CONFIG.strength,
          defense: BOSS_CONFIG.defense,
          constitution: BOSS_CONFIG.constitution,
          luck: BOSS_CONFIG.luck
        },
        deathTime: null,
        isActive: true,
        avatarUrl: BOSS_CONFIG.avatarUrl
      };
    } catch (e) {
      console.error('Create boss error:', e);
      return null;
    }
  }

  async function updateBossHP(bossId, newHP, killedBy = null) {
    try {
      const sb = await ensureOnline();
      
      const updateData = {
        current_hp: Math.max(0, newHP)
      };

      // Pokud boss zemřel
      if (newHP <= 0) {
        updateData.death_time = new Date().toISOString();
        updateData.killed_by = killedBy;
      }

      const { error } = await sb
        .from(BOSS_TABLE)
        .update(updateData)
        .eq('id', bossId);

      if (error) throw error;

      return true;
    } catch (e) {
      console.error('Update boss HP error:', e);
      return false;
    }
  }

  // ===== ATTACK TRACKING =====
  async function getAttacksToday(userId) {
    try {
      const sb = await ensureOnline();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await sb
        .from(BOSS_ATTACKS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .gte('attack_time', today.toISOString());

      if (error && error.code !== 'PGRST116') {
        console.error('Get attacks error:', error);
        return 0;
      }

      return data ? data.length : 0;
    } catch (e) {
      console.error('Get attacks today error:', e);
      return 0;
    }
  }

  async function recordAttack(userId, bossId, damageDealt) {
    try {
      const sb = await ensureOnline();
      
      const { error } = await sb
        .from(BOSS_ATTACKS_TABLE)
        .insert({
          user_id: userId,
          boss_id: bossId,
          damage_dealt: damageDealt,
          attack_time: new Date().toISOString()
        });

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Record attack error:', e);
      return false;
    }
  }

  async function getLeaderboard(bossId) {
    try {
      const sb = await ensureOnline();
      
      const { data: attacks, error: attackError } = await sb
        .from(BOSS_ATTACKS_TABLE)
        .select('user_id, damage_dealt')
        .eq('boss_id', bossId);

      if (attackError) throw attackError;

      if (!attacks || attacks.length === 0) {
        return [];
      }

      // Sečti damage pro každého hráče
      const damageByPlayer = {};
      attacks.forEach(attack => {
        const uid = attack.user_id;
        if (!damageByPlayer[uid]) {
          damageByPlayer[uid] = 0;
        }
        damageByPlayer[uid] += attack.damage_dealt;
      });

      // Získej jména hráčů
      const userIds = Object.keys(damageByPlayer);
      const { data: players, error: playerError } = await sb
        .from('player_stats')
        .select('user_id, stats')
        .in('user_id', userIds);

      if (playerError) throw playerError;

      // Vytvoř leaderboard
      const leaderboard = userIds.map(uid => {
        const player = players?.find(p => p.user_id === uid);
        let name = 'Neznámý hráč';
        
        if (player) {
          let stats = player.stats || {};
          if (typeof stats === 'string') {
            try { stats = JSON.parse(stats); } catch {}
          }
          name = stats.character_name || 'Hráč #' + uid.slice(0, 6);
        }

        return {
          userId: uid,
          name: name,
          totalDamage: damageByPlayer[uid]
        };
      });

      // Seřaď podle damage
      leaderboard.sort((a, b) => b.totalDamage - a.totalDamage);

      return leaderboard.slice(0, 10); // Top 10
    } catch (e) {
      console.error('Get leaderboard error:', e);
      return [];
    }
  }

  // ===== LEGENDARY REWARD =====
  async function grantLegendaryReward(userId) {
    try {
      const sb = await ensureOnline();
      
      // Vytvoř legendární item
      const legendaryItems = getAllItems().filter(item => 
        item.rarity === 'legendary' || 
        item.price > 5000
      );

      if (legendaryItems.length === 0) {
        console.warn('No legendary items found');
        return null;
      }

      const randomLegendary = legendaryItems[Math.floor(Math.random() * legendaryItems.length)];
      
      // Vytvoř instanci s level 50+
      const instance = makeItemInstance(randomLegendary, 50 + Math.floor(Math.random() * 51));
      instance.rarity = 'legendary'; // Zajisti legendary
      
      // Načti hráče
      const { data: player, error: getError } = await sb
        .from('player_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (getError) throw getError;

      const inventory = Array.isArray(player.inventory) ? player.inventory : [];
      
      // Přidej item do inventáře (pokud je místo)
      if (inventory.filter(Boolean).length < 8) {
        const emptyIndex = inventory.findIndex(x => !x);
        if (emptyIndex >= 0) {
          inventory[emptyIndex] = instance;
        } else {
          inventory.push(instance);
        }

        // Ulož
        const { error: updateError } = await sb
          .from('player_stats')
          .update({ inventory: inventory })
          .eq('user_id', userId);

        if (updateError) throw updateError;

        // Pošli mail
        await sendBossRewardMail(userId, instance);

        return instance;
      }

      return null;
    } catch (e) {
      console.error('Grant reward error:', e);
      return null;
    }
  }

  function makeItemInstance(baseItem, level) {
    const lvl = Math.max(1, Number(level) || 1);
    const inst = JSON.parse(JSON.stringify(baseItem));
    
    inst.instance_id = 'boss_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    inst.base_id = baseItem.id;
    inst.rarity = 'legendary';
    inst.req_level = Math.max(1, Math.round(lvl * 0.8));

    // Silné bonusy pro legendary
    if (inst.bonuses) {
      const rarityMult = 2.5; // Legendary multiplikátor
      const scale = 1 + (lvl - 1) * 0.12;
      
      for (const stat of Object.keys(inst.bonuses)) {
        const base = Number(inst.bonuses[stat]);
        const scaled = base * scale * rarityMult * (0.95 + Math.random() * 0.1);
        const cap = (lvl * 4 + 40) * rarityMult;
        inst.bonuses[stat] = Math.round(Math.max(-cap, Math.min(cap, scaled)));
      }
    }

    // Vysoká cena
    const basePrice = Number(baseItem.price || 100);
    inst.price = Math.max(1000, Math.floor(basePrice * (1 + lvl * 0.15) * 2.5));
    inst.level_roll = lvl;

    return inst;
  }

  async function sendBossRewardMail(userId, item) {
    try {
      const sb = await ensureOnline();
      
      const mail = {
        id: `boss_reward_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        user_id: userId,
        from_name: 'WORLD BOSS',
        to_name: 'Bojovník',
        subject: '🏆 LEGENDARY ODMĚNA!',
        body: `Gratulujeme! Pomohl jsi porazit World Bosse!\n\n**ODMĚNA:**\n${item.icon} **${item.name}** (LEGENDARY)\n\nItem byl přidán do tvého inventáře. Ověř si ho v SHOPU!`,
        created_at: new Date().toISOString(),
        unread: true,
        important: true,
        kind: 'boss_reward'
      };

      await sb.from('player_mail').insert(mail);
    } catch (e) {
      console.error('Send boss mail error:', e);
    }
  }

  async function distributeRewards(bossId) {
    try {
      const sb = await ensureOnline();
      
      // Získej všechny hráče, kteří na bosse útočili
      const { data: attacks, error } = await sb
        .from(BOSS_ATTACKS_TABLE)
        .select('user_id')
        .eq('boss_id', bossId);

      if (error) throw error;

      if (!attacks || attacks.length === 0) {
        console.log('No attackers to reward');
        return;
      }

      // Získej unikátní user IDs
      const uniqueUserIds = [...new Set(attacks.map(a => a.user_id))];

      console.log(`🎁 Distributing rewards to ${uniqueUserIds.length} players...`);

      // Dej každému legendary item
      for (const userId of uniqueUserIds) {
        await grantLegendaryReward(userId);
      }

      console.log('✅ Rewards distributed!');
    } catch (e) {
      console.error('Distribute rewards error:', e);
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
      critChance: getCritChanceFromDexAndLevel(totalStats.dexterity, level),
      classType: getPlayerClass(baseStats || {}),
      avatarUrl: baseStats?.avatar_url || null,
      avatarFrame: baseStats?.avatar_frame || null
    };
  }

  // ===== WEAPON SYSTEM =====
  function emojiToDataUri(emoji) {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-size="96">${emoji}</text>
</svg>`;
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

    el.classList.remove('weapon-visible');
    el.classList.remove('show-weapon');
    el.style.opacity = '0';

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

  async function animateProjectile(attackerSide, imgSrc) {
    const attackerBox = attackerSide === 'player' ? $('playerCharBox') : $('bossCharBox');
    const defenderBox = attackerSide === 'player' ? $('bossCharBox') : $('playerCharBox');
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
    proj.style.position = 'fixed';
    proj.style.left = `${startX}px`;
    proj.style.top = `${startY}px`;
    proj.style.width = '90px';
    proj.style.zIndex = '90';
    document.body.appendChild(proj);

    const dx = endX - startX;
    const dy = endY - startY;
    const spin = attackerSide === 'player' ? 720 : -720;

    const duration = 460 + Math.random() * 280;
    const baseArc = Math.min(220, Math.max(120, Math.abs(dx) * 0.18));
    const arc = Math.min(280, baseArc * (0.75 + Math.random() * 0.7));
    const t0 = performance.now();

    return new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const x = startX + dx * t;
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

  // ===== UI RENDERING =====
  function renderPlayer(player) {
    if (!player) return;

    $('playerName').textContent = player.name;
    $('playerLevelText').textContent = `Level ${player.level}`;

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
      : { strength:0, defense:0, dexterity:0, intelligence:0, constitution:0, luck:0 };
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

  function renderBoss(boss) {
    if (!boss) return;

    $('bossName').textContent = boss.name;
    $('bossLevel').textContent = `Level ${boss.level}`;
    
    try {
      const img = document.getElementById('bossAvatar');
      if (img && boss.avatarUrl) img.src = String(boss.avatarUrl);
    } catch {}

    $('bossStrength').textContent = boss.stats.strength;
    $('bossDefense').textContent = boss.stats.defense;
    $('bossDamage').textContent = '~' + Math.round(boss.stats.strength * 2);

    updateHP('boss', boss.currentHP, boss.maxHP);
  }

  function updateHP(side, current, max) {
    if (side === 'player') {
      const fillId = 'playerHealthFill';
      const textId = 'playerHealthText';
      const percent = Math.max(0, Math.min(100, (current / max) * 100));
      $(fillId).style.width = percent + '%';
      $(textId).textContent = `${Math.max(0, Math.round(current))} / ${Math.round(max)}`;
    } else {
      const fillId = 'bossHealthFill';
      const textId = 'bossHealthText';
      const percent = Math.max(0, Math.min(100, (current / max) * 100));
      $(fillId).style.width = percent + '%';
      $(textId).textContent = `${Math.max(0, Math.round(current)).toLocaleString('cs-CZ')} / ${Math.round(max).toLocaleString('cs-CZ')}`;
    }
  }

  async function renderLeaderboard() {
    const listEl = $('leaderboardList');
    if (!listEl || !gameState.boss) return;

    listEl.innerHTML = '<div class="leaderboard-loading">⏳ Načítání...</div>';

    const leaderboard = await getLeaderboard(gameState.boss.id);

    if (!leaderboard || leaderboard.length === 0) {
      listEl.innerHTML = '<div class="leaderboard-loading">Zatím žádní bojovníci</div>';
      return;
    }

    listEl.innerHTML = leaderboard.map((entry, index) => `
      <div class="leaderboard-item">
        <div class="leaderboard-rank">#${index + 1}</div>
        <div class="leaderboard-name">${entry.name}</div>
        <div class="leaderboard-damage">${entry.totalDamage.toLocaleString('cs-CZ')}</div>
      </div>
    `).join('');
  }

  function updateAttacksDisplay() {
    const attacksValueEl = $('attacksValue');
    if (attacksValueEl) {
      const remaining = MAX_ATTACKS_PER_DAY - gameState.attacksToday;
      attacksValueEl.textContent = `${remaining} / ${MAX_ATTACKS_PER_DAY}`;
    }
  }

  function updateRespawnTimer() {
    const timerValueEl = $('timerValue');
    if (!timerValueEl || !gameState.boss) return;

    if (gameState.boss.currentHP > 0) {
      timerValueEl.textContent = 'Boss je živý!';
      return;
    }

    if (!gameState.boss.deathTime) {
      timerValueEl.textContent = '--:--:--';
      return;
    }

    const deathTime = new Date(gameState.boss.deathTime).getTime();
    const respawnTime = deathTime + (BOSS_RESPAWN_HOURS * 60 * 60 * 1000);
    const now = Date.now();
    const remaining = Math.max(0, respawnTime - now);

    if (remaining === 0) {
      timerValueEl.textContent = 'Boss se respawnuje...';
      // Reload boss data
      setTimeout(() => loadBossData().then(boss => {
        if (boss) {
          gameState.boss = boss;
          renderBoss(boss);
          updateRespawnTimer();
        }
      }), 2000);
      return;
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    timerValueEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // ===== COMBAT LOGIC =====
  function calculateDamage(attacker, defender) {
    const lvlA = Math.max(1, Number(attacker.level) || 1);
    const lvlD = Math.max(1, Number(defender.level) || 1);

    const clsA = (attacker?.classType ? String(attacker.classType) : '').toLowerCase();
    const primary = (clsA === 'mozek')
      ? Math.max(0, Number(attacker.stats?.intelligence) || 0)
      : (clsA === 'padouch')
        ? Math.max(0, Number(attacker.stats?.dexterity) || 0)
        : Math.max(0, Number(attacker.stats?.strength) || 0);

    const attackPower = primary * 2 + lvlA * 3;

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
    const weapon = attackerSide === 'player' ? gameState.playerWeapon : null;

    try { if (weapon && attackerSide === 'player') showWeapon(attackerSide); } catch {}

    const isCrit = checkCrit(attacker);
    let damage = calculateDamage(attacker, defender);
    
    if (isCrit) {
      damage = Math.round(damage * 2);
    }

    if (weapon && (weapon.type === 'throw' || weapon.type === 'melee')) {
      if (weapon.id === 'molotov') hideWeapon(attackerSide);

      await animateProjectile(attackerSide, weapon.img);

      defender.currentHP = Math.max(0, defender.currentHP - damage);
      showDamage(attackerSide === 'player' ? 'boss' : 'player', damage, isCrit);
      updateHP(attackerSide === 'player' ? 'boss' : 'player', defender.currentHP, defender.maxHP);
      playHitAnimation(attackerSide === 'player' ? 'boss' : 'player', { showHoles: false });

      if (weapon.id !== 'molotov') showWeapon(attackerSide);
    } else {
      defender.currentHP = Math.max(0, defender.currentHP - damage);
      showDamage(attackerSide === 'player' ? 'boss' : 'player', damage, isCrit);
      updateHP(attackerSide === 'player' ? 'boss' : 'player', defender.currentHP, defender.maxHP);
      playHitAnimation(attackerSide === 'player' ? 'boss' : 'player', { showHoles: true });
    }

    await sleep(1000);
    
    return damage;
  }

  function showDamage(side, amount, isCrit) {
    const dmgEl = side === 'player' ? $('playerDmg') : $('bossDmg');
    if (!dmgEl) return;

    dmgEl.textContent = isCrit ? `CRIT! ${amount.toLocaleString('cs-CZ')}` : `-${amount.toLocaleString('cs-CZ')}`;
    dmgEl.classList.remove('show');
    
    if (isCrit) {
      dmgEl.style.color = '#ff4444';
      dmgEl.style.fontSize = '32px';
      dmgEl.style.textShadow = '0 0 20px rgba(255, 68, 68, 0.8), 0 2px 4px rgba(0,0,0,0.95)';
    } else {
      dmgEl.style.color = side === 'player' ? '#ffd24a' : '#ff6b6b';
      dmgEl.style.fontSize = '26px';
      dmgEl.style.textShadow = '0 2px 4px rgba(0,0,0,.95), 0 0 18px rgba(0,0,0,.8)';
    }

    void dmgEl.offsetWidth;
    dmgEl.classList.add('show');
  }

  function playHitAnimation(side, opts = {}) {
    const container = side === 'player' 
      ? document.querySelector('.player-section-boss .character-boss')
      : document.querySelector('.boss-section .boss-character');
    
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
      try {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const size = 50;
        const minTop = 80;
        const maxTop = Math.max(minTop, h - 100);
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

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== BATTLE FLOW =====
  async function startBattle() {
    if (gameState.battleInProgress) {
      showNotification('⚠️ Boj již probíhá!', 'error');
      return;
    }
    
    if (!gameState.player || !gameState.boss) {
      showNotification('❌ Chyba při načítání dat!', 'error');
      return;
    }

    if (gameState.boss.currentHP <= 0) {
      showNotification('💀 Boss je mrtvý! Čekej na respawn.', 'error');
      return;
    }

    if (gameState.attacksToday >= MAX_ATTACKS_PER_DAY) {
      showNotification('⚔️ Vyčerpal jsi všechny útoky na dnes!', 'error');
      return;
    }
    
    console.log('⚔️ Battle started!');
    
    gameState.battleInProgress = true;
    let totalDamageDealt = 0;

    $('attackBtn').disabled = true;
    $('attackBtn').textContent = '⚔️ BOJ PROBÍHÁ...';
    $('attackBtn').style.opacity = '0.5';

    // Reset player HP
    gameState.player.currentHP = gameState.player.maxHP;
    renderPlayer(gameState.player);

    // Bojuj dokud hráč nebo boss nezemře
    while (gameState.player.currentHP > 0 && gameState.boss.currentHP > 0) {
      // Hráč útočí
      const playerDamage = await performAttack(gameState.player, gameState.boss, 'player');
      totalDamageDealt += playerDamage;
      
      if (gameState.boss.currentHP <= 0) break;

      await sleep(500);

      // Boss útočí
      await performAttack(gameState.boss, gameState.player, 'boss');
      
      if (gameState.player.currentHP <= 0) break;
      
      await sleep(500);
    }

    console.log('🏁 Battle ended!');
    gameState.battleInProgress = false;

    // Ulož výsledek
    await recordAttack(gameState.player.userId, gameState.boss.id, totalDamageDealt);
    gameState.attacksToday++;
    updateAttacksDisplay();

    await sleep(1000);
    
    if (gameState.boss.currentHP <= 0) {
      // Boss poražen!
      await updateBossHP(gameState.boss.id, 0, gameState.player.userId);
      await distributeRewards(gameState.boss.id);
      await handleBossDefeated(totalDamageDealt);
    } else if (gameState.player.currentHP <= 0) {
      // Hráč prohrál, ale damage se počítá
      await updateBossHP(gameState.boss.id, gameState.boss.currentHP);
      await handlePlayerDefeated(totalDamageDealt);
    } else {
      // Nemělo by nastat
      await updateBossHP(gameState.boss.id, gameState.boss.currentHP);
    }

    // Reload boss data
    gameState.boss = await loadBossData();
    renderBoss(gameState.boss);
    await renderLeaderboard();

    $('attackBtn').disabled = false;
    $('attackBtn').textContent = '⚔️ ZAÚTOČIT NA BOSSE';
    $('attackBtn').style.opacity = '1';
  }

  async function handleBossDefeated(damageDealt) {
    console.log('🏆 Boss defeated!');
    
    showResultModal('🏆 BOSS PORAŽEN! 🏆', `
      Boss byl poražen!
      
      Tvůj příspěvek: ${damageDealt.toLocaleString('cs-CZ')} damage
      
      🎁 LEGENDARY ITEM byl přidán do inventáře!
      
      Všichni bojovníci obdrží odměnu!
      Boss se respawnuje za ${BOSS_RESPAWN_HOURS}h.
    `);
  }

  async function handlePlayerDefeated(damageDealt) {
    console.log('💀 Player defeated, but damage counted!');
    
    showResultModal('💀 PROHRA 💀', `
      Byl jsi poražen, ale tvůj damage byl započítán!
      
      Způsobený damage: ${damageDealt.toLocaleString('cs-CZ')}
      
      Boss má ještě ${gameState.boss.currentHP.toLocaleString('cs-CZ')} HP.
      
      Zkus to znovu! (${MAX_ATTACKS_PER_DAY - gameState.attacksToday} útoků zbývá)
    `);
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

  function renderClassBadge() {
    try {
      let cls = null;
      try {
        if (typeof window.sfGetPlayerClassSafe === 'function') cls = window.sfGetPlayerClassSafe();
      } catch {}
      if (!cls) {
        cls = (window.SF?.stats?.stats?.player_class) || null;
        if (typeof cls === 'string') cls = String(cls).toLowerCase();
      }
      const meta = (window.SF_CLASS_META && cls && window.SF_CLASS_META[cls]) ? window.SF_CLASS_META[cls] : (window.SF_CLASS_META ? window.SF_CLASS_META.padouch : null);
      const pb = document.getElementById("playerClassBadge");
      if (pb && meta) { pb.textContent = meta.icon; pb.title = meta.label; }
    } catch {}
  }

  // ===== INIT =====
  async function init() {
    console.log('🎮 Initializing boss battle...');

    // Load player
    gameState.player = await loadPlayerData();
    
    if (!gameState.player) {
      showNotification('Nepodařilo se načíst data hráče', 'error');
      return;
    }

    // Weapon
    try {
      gameState.playerWeapon = resolveWeaponForRow(window.SF?.stats || {});
      setWeaponInHands('player', gameState.playerWeapon);
    } catch (e) {
      console.warn('Weapon resolve failed:', e);
      gameState.playerWeapon = { id: 'ak47', type: 'gun', img: 'zbran1.png', fireImg: 'zbran2.png' };
      setWeaponInHands('player', gameState.playerWeapon);
    }

    renderPlayer(gameState.player);
    renderClassBadge();

    // Load boss
    gameState.boss = await loadBossData();
    
    if (!gameState.boss) {
      showNotification('Nepodařilo se načíst bosse', 'error');
      return;
    }

    renderBoss(gameState.boss);

    // Load attacks today
    const userId = window.SF?.user?.id;
    if (userId) {
      gameState.attacksToday = await getAttacksToday(userId);
      updateAttacksDisplay();
    }

    // Load leaderboard
    await renderLeaderboard();

    // Wire buttons
    $('attackBtn').addEventListener('click', startBattle);
    $('resultContinue').addEventListener('click', hideResultModal);

    // Start timers
    setInterval(updateRespawnTimer, 1000);
    updateRespawnTimer();

    // Sync currency
    syncCurrencyUI();

    console.log('✅ Boss battle initialized!');
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
  .projectile {
    position: fixed;
    width: 90px;
    height: auto;
    z-index: 90;
    pointer-events: none;
    filter: drop-shadow(0 8px 18px rgba(0,0,0,.85));
    will-change: transform;
  }
`;
document.head.appendChild(style);

console.log('✅ Boss system loaded!');