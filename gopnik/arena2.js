// arena2.js — PvE aréna pro MISE + CRYPTA (boss).
// - Mise: po dokončení mise se přesměruje sem a fight začne automaticky.
// - Crypta: auto.html po kliknutí na boss fight přesměruje sem a fight začne automaticky.
// - UI je stejné jako arena.html, jen se používá jiný zdroj soupeře (NPC/boss).

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const ALLOWED_STATS = ['strength','defense','dexterity','intelligence','constitution','luck'];

  // ===== Helpers (stejně jako arena/postava) =====
  function getCritChanceFromDexAndLevel(totalDex, level) {
    const base = Math.floor(Number(totalDex || 0) * 0.5);
    const penalty = Math.floor((Math.max(1, Number(level || 1)) - 1) * 0.35);
    return Math.max(1, base - penalty);
  }

  function calculateMaxHP(constitution) {
    return Math.round(500 + Number(constitution || 0) * 25);
  }

  function formatStatValue(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0';
    const rounded = Math.round(n * 100) / 100;
    const s = String(rounded);
    return s.includes('.') ? rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1') : s;
  }

  function calculateStatBonus(stat, value, level) {
    const val = Number(value);
    const safe = Number.isFinite(val) ? val : 0;
    const lvl = Math.max(1, Number(level || 1));
    switch (stat) {
      case "strength":
        return `+${Math.round(safe * 2)} DMG`;
      case "defense": {
        const red = Math.min(100, Math.floor((safe / 28) * 100));
        return `${red}% Redukce`;
      }
      case "dexterity": {
        const crit = getCritChanceFromDexAndLevel(safe, lvl);
        return `+${crit}% Crit`;
      }
      case "intelligence":
        return `+${Math.floor(safe * 1.5)}% Magie`;
      case "constitution": {
        const hp = Math.round(500 + safe * 25);
        return `${hp} HP`;
      }
      case "luck": {
        const luckPercent = Math.min(100, Math.floor(safe));
        return `${luckPercent}% / 100%`;
      }
      default:
        return "";
    }
  }

  function updateHP(side, current, max) {
    const fillId = side === 'player' ? 'playerHealthFill' : 'enemyHealthFill';
    const textId = side === 'player' ? 'playerHealthText' : 'enemyHealthText';
    const percent = Math.max(0, Math.min(100, (current / max) * 100));
    const fill = $(fillId);
    const text = $(textId);
    if (fill) fill.style.width = percent + '%';
    if (text) text.textContent = `${Math.max(0, Math.round(current))} / ${Math.round(max)}`;
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

    setTimeout(() => container.classList.remove('hit-shake'), 350);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function calculateDamage(attacker, defender) {
    const attackPower = Number(attacker.stats.strength || 0) * 2;
    const defense = Number(defender.stats.defense || 0);
    const defenseReduction = Math.min(0.75, defense * 0.01);
    const baseDamage = Math.max(1, attackPower * (1 - defenseReduction));
    const variance = 0.9 + Math.random() * 0.2;
    return Math.round(baseDamage * variance);
  }

  function checkCrit(attacker) {
    const roll = Math.random() * 100;
    return roll < Number(attacker.critChance || 1);
  }

  async function performAttack(attacker, defender, attackerSide) {
    const isCrit = checkCrit(attacker);
    let damage = calculateDamage(attacker, defender);
    if (isCrit) damage = Math.round(damage * 2);

    defender.currentHP = Math.max(0, defender.currentHP - damage);

    // dmg na druhé straně
    showDamage(attackerSide === 'player' ? 'enemy' : 'player', damage, isCrit);
    playHitAnimation(attackerSide === 'player' ? 'enemy' : 'player');
    updateHP(attackerSide === 'player' ? 'enemy' : 'player', defender.currentHP, defender.maxHP);

    await sleep(900);
  }

  // ===== Výpočet total stats hráče (bezpečně) =====
  function calculateTotalBonuses(row) {
    const bonuses = { strength: 0, defense: 0, dexterity: 0, intelligence: 0, constitution: 0, luck: 0 };
    const equipped = (row?.equipped || {});
    // Uložené itemy můžou být objekty → vezmeme rovnou bonuses
    Object.values(equipped).forEach((itemRef) => {
      if (!itemRef) return;
      const it = (typeof itemRef === 'object') ? itemRef : null;
      if (!it?.bonuses) return;
      for (const k of Object.keys(it.bonuses)) {
        if (bonuses[k] === undefined) continue;
        const v = Number(it.bonuses[k] || 0);
        if (Number.isFinite(v)) bonuses[k] += v;
      }
    });
    return bonuses;
  }

  function calculateTotalStats(row) {
    const base = (row?.stats || row?.stats?.stats) ? (row.stats || {}) : (row?.stats || {});
    const baseStats = (row?.stats && typeof row.stats === 'object' && row.stats.strength === undefined && row.stats.stats) ? row.stats.stats : (row?.stats || {});
    const stats = (row?.stats?.stats && typeof row.stats.stats === 'object') ? row.stats.stats : (row?.stats || baseStats || {});
    const bonuses = calculateTotalBonuses(row);
    const total = {};
    for (const s of ALLOWED_STATS) {
      const b = Number(stats?.[s] ?? 10);
      const bon = Number(bonuses[s] ?? 0);
      total[s] = (Number.isFinite(b) ? b : 10) + (Number.isFinite(bon) ? bon : 0);
    }
    return total;
  }

  function renderSide(side, data, baseStatsForView) {
    if (!data) return;
    if (side === 'player') {
      $('playerName').textContent = data.name;
      $('playerLevelText').textContent = `Level ${data.level}`;
    } else {
      $('enemyName').textContent = data.name;
      $('enemyLevel').textContent = `Level ${data.level}`;
      const av = $('enemyAvatar');
      if (av && data.avatar) av.src = data.avatar;
    }

    const statMap = {
      strength: { value: side === 'player' ? 'pStr' : 'eStr', extra: side === 'player' ? 'pStrExtra' : 'eStrExtra' },
      defense: { value: side === 'player' ? 'pDef' : 'eDef', extra: side === 'player' ? 'pDefExtra' : 'eDefExtra' },
      dexterity: { value: side === 'player' ? 'pDex' : 'eDex', extra: side === 'player' ? 'pDexExtra' : 'eDexExtra' },
      intelligence: { value: side === 'player' ? 'pInt' : 'eInt', extra: null },
      constitution: { value: side === 'player' ? 'pCon' : 'eCon', extra: null },
      luck: { value: side === 'player' ? 'pLuck' : 'eLuck', extra: null },
    };

    for (const stat of Object.keys(statMap)) {
      const el = $(statMap[stat].value);
      if (!el) continue;
      const val = Number(baseStatsForView?.[stat] ?? data.stats?.[stat] ?? 10);
      el.textContent = formatStatValue(val);
      const extraId = statMap[stat].extra;
      if (extraId) {
        const extraEl = $(extraId);
        if (extraEl) extraEl.textContent = calculateStatBonus(stat, Number(data.stats?.[stat] ?? val), data.level);
      }
    }

    updateHP(side, data.currentHP, data.maxHP);
  }

  function openResult(title, text) {
    const modal = $('resultModal');
    if (!modal) return;
    $('resultTitle').textContent = title;
    $('resultText').textContent = text;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeResult() {
    const modal = $('resultModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  // ===== Context loader (mise / crypta) =====
  function pullMissionPayload() {
    try {
      const raw = sessionStorage.getItem('arenaFromMission');
      if (!raw) return null;
      sessionStorage.removeItem('arenaFromMission');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function pullCryptaHint() {
    const qs = new URLSearchParams(location.search);
    if (qs.get('fromCrypta') === '1') return { fromCrypta: true };
    return null;
  }

  async function loadCryptaPayload() {
    // 1) sessionStorage fallback (když supabase fetch selže)
    try {
      const raw = sessionStorage.getItem('arenaFromCrypta');
      if (raw) {
        sessionStorage.removeItem('arenaFromCrypta');
        return JSON.parse(raw);
      }
    } catch { /* ignore */ }

    // 2) Supabase: crypta_fights (auto.js tam ukládá payload)
    try {
      await (window.SFReady || Promise.resolve());
      const sb = window.SF?.sb || window.supabaseClient;
      const uid = window.SF?.user?.id || window.SF?.stats?.user_id;
      if (!sb || !uid) return null;
      const { data } = await sb
        .from('crypta_fights')
        .select('payload')
        .eq('user_id', uid)
        .maybeSingle();
      if (data?.payload) return data.payload;
      return null;
    } catch {
      return null;
    }
  }

  function buildEnemyFromMission(missionPayload, player) {
    const diff = String(missionPayload?.difficulty || 'easy').toLowerCase();
    const diffMul = diff === 'easy' ? 0.85 : diff === 'medium' ? 1.05 : diff === 'hard' ? 1.25 : 1.45;
    const lvl = Math.max(1, Math.round(player.level * diffMul));
    const stats = {
      strength: Math.max(10, Math.round(player.stats.strength * diffMul)),
      defense: Math.max(6, Math.round(player.stats.defense * (0.9 + diffMul * 0.08))),
      dexterity: Math.max(6, Math.round(player.stats.dexterity * (0.9 + diffMul * 0.06))),
      intelligence: Math.max(6, Math.round(player.stats.intelligence * (0.9 + diffMul * 0.06))),
      constitution: Math.max(8, Math.round(player.stats.constitution * (0.95 + diffMul * 0.08))),
      luck: Math.max(1, Math.round(player.stats.luck * (0.8 + diffMul * 0.05))),
    };
    const maxHP = calculateMaxHP(stats.constitution);
    const name = missionPayload?.enemy ? String(missionPayload.enemy) : 'NEPŘÍTEL';
    return {
      userId: 'npc_mission',
      name,
      level: lvl,
      stats,
      maxHP,
      currentHP: maxHP,
      critChance: getCritChanceFromDexAndLevel(stats.dexterity, lvl),
      avatar: 'avatar.jpg',
      __source: { type: 'mission', payload: missionPayload },
    };
  }

  function buildEnemyFromBoss(bossPayload, player) {
    const boss = bossPayload?.boss || {};
    const lvl = Math.max(1, Number(boss.level || bossPayload?.bossIndex + 1 || player.level));
    const hp = Math.max(500, Number(boss.hp || 2000));
    const mul = 0.95 + (lvl * 0.06);
    const stats = {
      strength: Math.max(12, Math.round(player.stats.strength * mul)),
      defense: Math.max(8, Math.round(player.stats.defense * (mul * 0.95))),
      dexterity: Math.max(8, Math.round(player.stats.dexterity * (mul * 0.85))),
      intelligence: Math.max(6, Math.round(player.stats.intelligence * (mul * 0.6))),
      constitution: Math.max(10, Math.round((hp - 500) / 25)),
      luck: Math.max(1, Math.round(player.stats.luck * (0.7 + lvl * 0.02))),
    };
    // boss HP je dané → přepíšeme maxHP
    const maxHP = hp;
    const name = boss.name ? String(boss.name) : 'BOSS';
    const avatar = boss.avatar ? String(boss.avatar) : 'avatar.jpg';
    return {
      userId: 'npc_boss',
      name,
      level: lvl,
      stats,
      maxHP,
      currentHP: maxHP,
      critChance: getCritChanceFromDexAndLevel(stats.dexterity, lvl),
      avatar,
      __source: { type: 'crypta', payload: bossPayload },
    };
  }

  // ===== Reward application =====
  function safeNum(n, def = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : def;
  }

  async function applyMissionWin(missionPayload) {
    const rewards = missionPayload?.rewards || {};
    const moneyGain = safeNum(rewards.money, 0);
    const xpGain = safeNum(rewards.exp, 0);
    const cigGain = safeNum(rewards.cigarettes, 0);

    const patch = {
      money: safeNum(window.SF?.stats?.money, 0) + moneyGain,
      xp: safeNum(window.SF?.stats?.xp, 0) + xpGain,
      cigarettes: safeNum(window.SF?.stats?.cigarettes, 0) + cigGain,
    };

    // vyčisti aktivní misi v daném slotu (aby se nevracela zpátky)
    const slot = missionPayload?.slot;
    const md = window.SF?.stats?.missiondata || window.SF?.stats?.missionData;
    if (md && slot && md.activeMissions && md.activeMissions[slot]) {
      const nextMd = structuredClone(md);
      nextMd.activeMissions[slot] = null;
      nextMd.completedMissions = safeNum(nextMd.completedMissions, 0) + 1;
      nextMd.totalExpEarned = safeNum(nextMd.totalExpEarned, 0) + xpGain;
      nextMd.totalMoneyEarned = safeNum(nextMd.totalMoneyEarned, 0) + moneyGain;
      nextMd.totalBattles = safeNum(nextMd.totalBattles, 0) + 1;
      nextMd.totalWins = safeNum(nextMd.totalWins, 0) + 1;
      patch.missiondata = nextMd; // menu.js posílá do DB správný klíč
    }

    window.SF.updateStats(patch);
    // menu.js si to uloží samo (debounce)
  }

  async function applyCryptaWin(bossPayload) {
    const bossIndex = Number(bossPayload?.bossIndex);
    const reward = bossPayload?.reward;

    const row = window.SF?.stats || {};
    const progress = row.crypta_progress || { current: 0, defeated: [] };
    const defeated = Array.isArray(progress.defeated) ? [...progress.defeated] : [];

    if (Number.isFinite(bossIndex) && !defeated.includes(bossIndex)) defeated.push(bossIndex);
    const nextCurrent = Math.max(progress.current || 0, (Number.isFinite(bossIndex) ? bossIndex + 1 : progress.current || 0));

    const inv = Array.isArray(row.inventory) ? [...row.inventory] : [];
    if (reward && typeof reward === 'object') {
      // Uložíme jako objekt → postava/shop to umí zobrazit
      inv.push({
        id: reward.id,
        name: reward.name,
        icon: reward.icon,
        bonuses: reward.bonuses || {},
        type: reward.type || 'special',
        // instance_id aby se daly odlišit duplicitní dropy
        instance_id: `${reward.id}_${Date.now()}`
      });
    }

    window.SF.updateStats({
      inventory: inv,
      crypta_progress: { current: nextCurrent, defeated },
    });
  }

  // ===== Main battle runner =====
  async function runBattle(player, enemy) {
    let battleInProgress = true;
    $('attackBtn').disabled = true;
    $('nextEnemyBtn').disabled = true;
    $('nextEnemyBtn').style.display = 'none'; // v PvE nedává smysl
    $('attackBtn').textContent = '⚔️ FIGHT...';

    while (battleInProgress) {
      await performAttack(player, enemy, 'player');
      if (enemy.currentHP <= 0) {
        battleInProgress = false;
        break;
      }
      await performAttack(enemy, player, 'enemy');
      if (player.currentHP <= 0) {
        battleInProgress = false;
        break;
      }
    }

    const playerWon = enemy.currentHP <= 0 && player.currentHP > 0;
    const enemyWon = player.currentHP <= 0 && enemy.currentHP > 0;

    // výsledky
    if (playerWon) {
      if (enemy.__source?.type === 'mission') {
        await applyMissionWin(enemy.__source.payload);
        const r = enemy.__source.payload?.rewards || {};
        openResult('VÝHRA!', `Mise: ${enemy.__source.payload?.missionName || ''}\n+${safeNum(r.exp,0)} XP\n+${safeNum(r.money,0)}₽\n+${safeNum(r.cigarettes,0)} 🚬`);
      } else if (enemy.__source?.type === 'crypta') {
        await applyCryptaWin(enemy.__source.payload);
        const rw = enemy.__source.payload?.reward;
        openResult('BOSS PORAŽEN!', rw ? `Drop: ${rw.icon || '🎁'} ${rw.name || ''}` : 'BOSS PORAŽEN!');
      } else {
        openResult('VÝHRA!', 'Vyhrál jsi.');
      }
    } else if (enemyWon) {
      openResult('PROHRA!', 'Dostal jsi na držku. Zkus to znovu.');
    } else {
      openResult('KONEC', 'Souboj skončil.');
    }

    $('attackBtn').textContent = '⚔️ ZAÚTOČIT';
  }

  async function boot() {
    await (window.SFReady || Promise.resolve());
    const row = window.SF?.stats;
    if (!row?.user_id) {
      // menu.js už by to mělo řešit, ale pro jistotu
      location.href = 'login.html';
      return;
    }

    // player
    const totalStats = calculateTotalStats(row);
    const level = Number(row.level || 1);
    const maxHP = calculateMaxHP(totalStats.constitution);
    const charName = row?.stats?.character_name || row?.stats?.stats?.character_name || ('HRÁČ #' + String(row.user_id).slice(0, 8).toUpperCase());

    const player = {
      userId: row.user_id,
      name: charName,
      level,
      stats: totalStats,
      maxHP,
      currentHP: maxHP,
      critChance: getCritChanceFromDexAndLevel(totalStats.dexterity, level),
      avatar: 'avatar2.jpg',
    };

    // context
    const missionPayload = pullMissionPayload();
    const cryptaHint = pullCryptaHint();
    let enemy = null;

    if (missionPayload?.fromMission) {
      enemy = buildEnemyFromMission(missionPayload, player);
    } else if (cryptaHint?.fromCrypta) {
      const bossPayload = await loadCryptaPayload();
      if (bossPayload?.fromCrypta) enemy = buildEnemyFromBoss(bossPayload, player);
    }

    if (!enemy) {
      // fallback: aspoň něco, ať to nikdy nepadne
      enemy = buildEnemyFromMission({ fromMission: true, enemy: 'TRÉNINKOVÝ PANÁK', difficulty: 'easy', rewards: { money: 0, exp: 0 } }, player);
    }

    // render
    renderSide('player', player, row?.stats?.stats || row?.stats || {});
    renderSide('enemy', enemy, enemy.stats);

    // tlačítka
    const continueBtn = $('resultContinue');
    if (continueBtn) {
      continueBtn.onclick = () => {
        closeResult();
        // návrat na zdrojovou stránku
        if (enemy.__source?.type === 'mission') location.href = 'mise.html';
        else if (enemy.__source?.type === 'crypta') location.href = 'auto.html';
        else location.href = 'arena.html';
      };
    }

    // v arena2 startujeme automaticky (mise i crypta)
    const autoStart = (missionPayload?.fromMission) || (enemy.__source?.type === 'crypta' && enemy.__source?.payload?.autoStart);
    if (autoStart) {
      await sleep(500);
      await runBattle(player, enemy);
    } else {
      // manuální start (kdyby se sem někdo dostal jen tak)
      $('attackBtn').disabled = false;
      $('attackBtn').textContent = '⚔️ ZAČÍT FIGHT';
      $('attackBtn').onclick = async () => {
        $('attackBtn').onclick = null;
        await runBattle(player, enemy);
      };
      $('nextEnemyBtn').style.display = 'none';
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
