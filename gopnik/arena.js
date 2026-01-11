// arena.js – VERZE S PLNOU SYNCHRONIZACÍ HP A STATS (jako v postava.js)
(() => {
  "use strict";

  // ====== SF COMPAT LAYER ======
  function sfGetStatsSync() {
    try {
      const SF = window.SF;
      if (!SF) return null;

      if (typeof SF.getStats === 'function') return SF.getStats();

      if (SF.stats && typeof SF.stats === 'object') return SF.stats;
      if (SF.playerStats && typeof SF.playerStats === 'object') return SF.playerStats;
      if (SF.state?.stats && typeof SF.state.stats === 'object') return SF.state.stats;
      if (SF.store?.stats && typeof SF.store.stats === 'object') return SF.store.stats;

      return null;
    } catch (e) {
      console.warn('⚠️ sfGetStatsSync failed:', e);
      return null;
    }
  }

  function sfSetHpSync(hp, hpMax) {
    try {
      const SF = window.SF;
      if (!SF) return false;

      if (typeof SF.setHp === 'function') { SF.setHp(hp, hpMax); return true; }
      if (SF.actions && typeof SF.actions.setHp === 'function') { SF.actions.setHp(hp, hpMax); return true; }

      if (SF.stats && typeof SF.stats === 'object') {
        if (typeof SF.stats.hp === 'number' || SF.stats.hp === undefined) SF.stats.hp = hp;
        if (typeof SF.stats.hp_max === 'number' || SF.stats.hp_max === undefined) SF.stats.hp_max = hpMax;
        return true;
      }
      if (SF.playerStats && typeof SF.playerStats === 'object') {
        SF.playerStats.hp = hp;
        SF.playerStats.hp_max = hpMax;
        return true;
      }
      if (SF.state && SF.state.stats && typeof SF.state.stats === 'object') {
        SF.state.stats.hp = hp;
        SF.state.stats.hp_max = hpMax;
        return true;
      }
      return false;
    } catch (e) {
      console.warn('⚠️ sfSetHpSync failed:', e);
      return false;
    }
  }

  const SUPABASE_URL = 'https://wngzgptxrgfrwuyiyueu.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZ3pncHR4cmdmcnd1eWl5dWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzQzNTYsImV4cCI6MjA4MzU1MDM1Nn0.N-UJpDi_CQVTC6gYFzYIFQdlm0C4x6K7GjeXGzdS8No';

  const nextBtn = document.getElementById("nextEnemyBtn");
  const attackBtn = document.getElementById("attackBtn");
  const resultModal = document.getElementById("resultModal");
  const resultTitle = document.getElementById("resultTitle");
  const resultText = document.getElementById("resultText");
  const resultContinue = document.getElementById("resultContinue");
  const playerHealthFill = document.getElementById("playerHealthFill");
  const playerHealthText = document.getElementById("playerHealthText");
  const playerLevelText = document.getElementById("playerLevelText");
  const playerDmgEl = document.getElementById("playerDmg");
  const enemyNameEl = document.getElementById("enemyName");
  const enemyLevelEl = document.getElementById("enemyLevel");
  const enemyHealthFill = document.getElementById("enemyHealthFill");
  const enemyHealthText = document.getElementById("enemyHealthText");
  const enemyDmgEl = document.getElementById("enemyDmg");

  const enemies = [
    { name: "IVAN DESTROYER", level: 3, hp: 1000 },
    { name: "MIKHAIL 'HAMMER'", level: 5, hp: 1400 },
    { name: "SERGEI THE WOLF", level: 7, hp: 1800 },
    { name: "VIKTOR NIGHTSTEP", level: 9, hp: 2200 }
  ];

  // ===== CRYPTA BOSS OVERRIDE =====
  let cryptaBossFight = null;
  async function loadCryptaBossFight() {
    const qs = new URLSearchParams(location.search);
    if (qs.get('fromCrypta') !== '1') return null;
    if (window.SFReady) await window.SFReady;
    const sb = window.SF?.sb;
    const uid = window.SF?.user?.id || window.SF?.stats?.user_id;
    if (!sb || !uid) return null;
    const { data } = await sb.from('crypta_fights').select('payload').eq('user_id', uid).maybeSingle();
    const payload = data?.payload;
    if (!payload || !payload.boss) return null;
    cryptaBossFight = payload;
    return payload;
  }

  async function clearCryptaBossFight() {
    if (window.SFReady) await window.SFReady;
    const sb = window.SF?.sb;
    const uid = window.SF?.user?.id || window.SF?.stats?.user_id;
    if (sb && uid) await sb.from('crypta_fights').delete().eq('user_id', uid);
  }

  function getBossDmgScale(boss) {
    const lvl = Number(boss?.level || 1);
    const idx = Number(cryptaBossFight?.bossIndex || 0);
    return 1.35 + (lvl * 0.05) + (idx * 0.05);
  }

  function getActiveEnemy() {
    if (cryptaBossFight?.boss) return cryptaBossFight.boss;
    return enemies[enemyIndex % enemies.length];
  }

  let enemyIndex = 0;
  let enemyCurHp = enemies[0].hp;
  let enemyMaxHp = enemies[0].hp;
  let fightRunning = false;

  let playerCore = {
    strength: 18,
    defense: 14,
    dexterity: 11,
    intelligence: 11,
    constitution: 16,
    luck: 9,
    level: 1
  };

  let playerEquipped = null;
  let playerTotal = { ...playerCore };
  let playerMaxHp = 500;
  let playerCurrentHp = 500;

  let playerHpFromDb = false;
  let playerHpDb = { hp: null, hp_max: null };

  function fmtInt(n) {
    return Number(n ?? 0).toLocaleString("cs-CZ");
  }

  function fmtHp(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    const isInt = Math.abs(v - Math.round(v)) < 1e-9;
    return v.toLocaleString("cs-CZ", { minimumFractionDigits: isInt ? 0 : 2, maximumFractionDigits: isInt ? 0 : 2 });
  }

  function setBar(fillEl, textEl, cur, max) {
    if (!fillEl || !textEl) return;
    const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (cur / max) * 100));
    fillEl.style.width = pct + "%";
    textEl.textContent = `HP ${fmtHp(cur)} / ${fmtHp(max)}`;
  }

  function clampHp(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n * 100) / 100);
  }

  function randInt(min, max) {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  // ===== COMPUTE MAX HP (stejně jako v postava.js) =====
  function computeMaxHpFromCore(core) {
    const con = Number(core?.constitution || core?.stats?.constitution || 0);
    const maxHp = Math.max(1, clampHp(500 + (con * 25)));
    console.log(`💪 computeMaxHpFromCore: con=${con}, maxHp=${maxHp}`);
    return maxHp;
  }

  // ===== SYNC CURRENCY UI (stejně jako v postava.js) =====
  function syncCurrencyUI() {
    console.log('💰 === SYNC CURRENCY UI ===');
    
    if (!window.SF) {
      console.warn('⚠️ SF not available');
      return;
    }
    
    const stats = sfGetStatsSync();
    if (!stats) {
      console.warn("⚠️ SF stats not available");
      return;
    }
    console.log('📊 Stats from SF:', stats);
    
    const moneyEl = document.getElementById('money');
    const cigarettesEl = document.getElementById('cigarettes');
    const energyEl = document.getElementById('energy');
    const levelDisplay = document.getElementById('levelDisplay');
    
    if (moneyEl) {
      moneyEl.textContent = Number(stats.money || 0).toLocaleString('cs-CZ');
      console.log('  💵 Money:', stats.money);
    }
    
    if (cigarettesEl) {
      cigarettesEl.textContent = String(stats.cigarettes || 0);
      console.log('  🚬 Cigarettes:', stats.cigarettes);
    }
    
    if (energyEl) {
      energyEl.textContent = String(stats.energy || 0);
      console.log('  ⚡ Energy:', stats.energy);
    }
    
    if (levelDisplay) {
      levelDisplay.textContent = String(stats.level || 1);
      console.log('  🎯 Level:', stats.level);
    }
    
    // Update XP bar
    const xpFill = document.getElementById('xpFill');
    const xpText = document.getElementById('xpText');
    
    if (xpFill && xpText) {
      const xp = stats.xp || 0;
      const level = stats.level || 1;
      const requiredXP = Math.floor(100 * Math.pow(1.5, level - 1));
      const xpPercent = (xp / requiredXP) * 100;
      
      xpFill.style.width = `${xpPercent}%`;
      xpText.textContent = `${xp} / ${requiredXP}`;
      console.log('  📈 XP:', xp, '/', requiredXP);
    }
    
    // Update energy bar
    const energyFill = document.getElementById('energyFill');
    const energyText = document.getElementById('energyText');
    
    if (energyFill && energyText) {
      const energy = stats.energy || 0;
      const maxEnergy = stats.max_energy || 100;
      const energyPercent = (energy / maxEnergy) * 100;
      
      energyFill.style.width = `${energyPercent}%`;
      energyText.textContent = `${energy} / ${maxEnergy}`;
      console.log('  ⚡ Energy bar:', energy, '/', maxEnergy);
    }
    
    console.log('===========================');
  }

  function getAllItems() {
    if (!window.SHOP_ITEMS) return [];
    return [
      ...(window.SHOP_ITEMS.weapons || []),
      ...(window.SHOP_ITEMS.armor || []),
      ...(window.SHOP_ITEMS.special || [])
    ];
  }

  function getItemById(id) {
    return getAllItems().find(it => String(it.id) === String(id));
  }

  function calcEquipBonuses(equipped) {
    const bonus = { strength:0, defense:0, dexterity:0, intelligence:0, constitution:0, luck:0 };
    if (!equipped) return bonus;
    Object.values(equipped).forEach(itemId => {
      if (!itemId) return;
      const item = typeof itemId === "object" ? itemId : getItemById(itemId);
      if (!item || !item.bonuses) return;
      Object.keys(item.bonuses).forEach(k => {
        if (k in bonus) bonus[k] += Number(item.bonuses[k] || 0);
      });
    });
    return bonus;
  }

  function formatStatValue(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0';
    const rounded = Math.round(n * 100) / 100;
    const s = String(rounded);
    return s.includes('.') ? rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1') : s;
  }

  // ===== RECOMPUTE PLAYER TOTALS (stejně jako v postava.js) =====
  function recomputePlayerTotals() {
    const cls = String(window.SF?.stats?.stats?.player_class || "padouch").toLowerCase();
    const equipBonus = calcEquipBonuses(playerEquipped);

    console.log('🔥 === RECOMPUTE PLAYER TOTALS ===');
    console.log('playerCore:', playerCore);
    console.log('equipBonus:', equipBonus);

    // Total stats = base + equipment bonuses (stejně jako v postava.js)
    playerTotal = {
      strength: Number(playerCore.strength||0) + Number(equipBonus.strength||0),
      defense: Number(playerCore.defense||0) + Number(equipBonus.defense||0),
      dexterity: Number(playerCore.dexterity||0) + Number(equipBonus.dexterity||0),
      intelligence: Number(playerCore.intelligence||0) + Number(equipBonus.intelligence||0),
      constitution: Number(playerCore.constitution||0) + Number(equipBonus.constitution||0),
      luck: Number(playerCore.luck||0) + Number(equipBonus.luck||0),
      level: Number(playerCore.level||1),
      _class: cls
    };

    console.log('playerTotal:', playerTotal);

    // HP SYNC: Vypočítat maxHP z constitution (500 + constitution * 25)
    const computedMax = computeMaxHpFromCore(playerTotal);
    
    // Pokud máme HP z DB, použij ho
    if (playerHpFromDb && playerHpDb?.hp_max) {
      playerMaxHp = clampHp(playerHpDb.hp_max);
      console.log('💚 Using maxHP from DB:', playerMaxHp);
    } else {
      playerMaxHp = computedMax;
      console.log('💚 Using computed maxHP:', playerMaxHp);
    }

    console.log('playerMaxHp:', playerMaxHp);
    
    // UPDATE UI ELEMENTS - zobrazit BASE + BONUS (stejně jako v postava.js)
    const statMap = {
      pStr: { base: playerCore.strength, bonus: equipBonus.strength, total: playerTotal.strength },
      pDef: { base: playerCore.defense, bonus: equipBonus.defense, total: playerTotal.defense },
      pDex: { base: playerCore.dexterity, bonus: equipBonus.dexterity, total: playerTotal.dexterity },
      pInt: { base: playerCore.intelligence, bonus: equipBonus.intelligence, total: playerTotal.intelligence },
      pCon: { base: playerCore.constitution, bonus: equipBonus.constitution, total: playerTotal.constitution },
      pLuck: { base: playerCore.luck, bonus: equipBonus.luck, total: playerTotal.luck }
    };
    
    console.log('📊 Updating UI elements...');
    Object.keys(statMap).forEach((id) => {
      const el = document.getElementById(id);
      const stat = statMap[id];
      if (el) {
        // Zobrazit BASE + BONUS (stejně jako v postava.js)
        if (stat.bonus !== 0) {
          el.innerHTML = `${formatStatValue(stat.base)} <span style="color: #4af;">+${stat.bonus}</span>`;
        } else {
          el.textContent = formatStatValue(stat.base);
        }
        console.log(`  ✅ ${id}: ${stat.base} + ${stat.bonus} = ${stat.total}`);
      } else {
        console.warn(`  ⚠️ Element not found: ${id}`);
      }
    });

    console.log('=================================');
  }
  
  function healPlayerToFull() {
    console.log('🏥 === HEAL PLAYER TO FULL ===');

    // Vypočítat maxHP z constitution
    const computedMax = computeMaxHpFromCore(playerTotal);
    
    // Pokud máme HP z DB, použij ho
    if (playerHpFromDb && playerHpDb?.hp_max) {
      playerMaxHp = clampHp(playerHpDb.hp_max);
      playerCurrentHp = clampHp(playerHpDb.hp);
      console.log('  💚 Using HP from DB:', playerCurrentHp, '/', playerMaxHp);
    } else {
      playerMaxHp = computedMax;
      playerCurrentHp = playerMaxHp;
      console.log('  💚 Using computed maxHP:', playerMaxHp);
    }

    // Zajisti, že current HP není větší než max
    playerCurrentHp = Math.min(clampHp(playerCurrentHp), playerMaxHp);

    try { sfSetHpSync(playerCurrentHp, playerMaxHp); } catch (e) { console.warn('⚠️ SF.setHp failed:', e); }
    setBar(playerHealthFill, playerHealthText, playerCurrentHp, playerMaxHp);
    
    console.log('  🏥 Final HP:', playerCurrentHp, '/', playerMaxHp);
  }

  function renderEnemy() {
    const e = getActiveEnemy();
    if (!e) return;

    const clsPool = ["padouch","rvac","mozek"];
    if (!e._class) e._class = clsPool[randInt(0, clsPool.length-1)];

    enemyMaxHp = Number(e.hp || 0);
    if (enemyMaxHp <= 0) enemyMaxHp = 1000;
    enemyCurHp = enemyMaxHp;

    if (e.avatar) {
      const img = document.querySelector('#enemyAvatar')
        || document.querySelector('.enemy-section .character-arena img')
        || document.querySelector('.enemy-section img');
      if (img && img.tagName === 'IMG') img.src = e.avatar;
    }
    
    const bg = document.querySelector('.enemy-section');
    if (bg) {
      bg.style.backgroundImage = '';
      bg.style.backgroundSize = '';
      bg.style.backgroundPosition = '';
    }

    const icon = (cryptaBossFight?.boss ? (e.icon || '💀') : '');
    if (enemyNameEl) enemyNameEl.textContent = icon ? `${icon} ${e.name}` : e.name;
    if (enemyLevelEl) enemyLevelEl.textContent = `Level ${e.level}`;
    setBar(enemyHealthFill, enemyHealthText, enemyCurHp, enemyMaxHp);

    const lvl = Number(e.level ?? 1);
    const bossMul = cryptaBossFight?.boss ? (1.25 + (Number(cryptaBossFight.bossIndex||0) * 0.07)) : 1;

    const eStr = clampHp((10 + (lvl * 3) + randInt(0, 5)) * bossMul);
    const eDef = clampHp((8 + (lvl * 2) + randInt(0, 4)) * bossMul);
    const eDex = clampHp((6 + (lvl * 2) + randInt(0, 3)) * bossMul);
    const eInt = clampHp((5 + lvl + randInt(0, 2)) * bossMul);
    const eCon = clampHp((12 + (lvl * 2) + randInt(0, 4)) * bossMul);
    const eLuck = clampHp((3 + lvl + randInt(0, 2)) * bossMul);

    const enemyStatElements = {
      eStr: eStr,
      eDef: eDef,
      eDex: eDex,
      eInt: eInt,
      eCon: eCon,
      eLuck: eLuck
    };

    Object.keys(enemyStatElements).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(enemyStatElements[id]);
    });

    renderEnemyClassBadge(e._class);
  }

  function renderEnemyClassBadge(clsKey){
    const meta = {
      padouch: { icon: "👻", label: "Padouch" },
      rvac: { icon: "✊", label: "Rváč" },
      mozek: { icon: "💡", label: "Mozek" }
    };
    const m = meta[String(clsKey||"padouch").toLowerCase()] || meta.padouch;
    const char = document.querySelector(".enemy-section .character-arena");
    if (!char) return;

    let badge = char.querySelector(".class-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "class-badge";
      char.appendChild(badge);
    }
    badge.textContent = m.icon;
    badge.title = m.label;
  }

  function nextEnemy() {
    enemyIndex = (enemyIndex + 1) % enemies.length;
    renderEnemy();
  }

  function setButtonsVisible(v) {
    const show = !!v;
    if (nextBtn) nextBtn.style.display = show ? "" : "none";
    if (attackBtn) attackBtn.style.display = show ? "" : "none";
  }

  function openResult(win, amount) {
    if (!resultModal) return;
    const txtAmount = fmtInt(amount);

    if (win) {
      if (resultTitle) resultTitle.textContent = "Vyhrál jsi!";
      if (resultText) resultText.textContent = `Dostal jsi pár grošů... +${txtAmount}₽`;
    } else {
      if (resultTitle) resultTitle.textContent = "Prohrál jsi!";
      if (resultText) resultText.textContent = `Přišel jsi o groše... -${txtAmount}₽`;
    }

    resultModal.classList.add("show");
    resultModal.setAttribute("aria-hidden", "false");
  }

  function closeResult() {
    if (!resultModal) return;
    resultModal.classList.remove("show");
    resultModal.setAttribute("aria-hidden", "true");
  }

  function finishFight(playerWon, moneyDeltaAbs) {
    fightRunning = false;
    openResult(playerWon, moneyDeltaAbs);
  }

  function computePlayerHit(total, cls, dmgScale = 1) {
    const lvl = Number(total.level ?? 1);
    const str = Number(total.strength ?? 0);
    const base = (str * 2) + (lvl * 3) + 10;
    let dmg = clampHp((base + randInt(-6, 14)) * dmgScale);
    if (cls === "mozek") dmg = clampHp(dmg * 1.2);
    if (cls === "rvac") dmg = clampHp(dmg * 0.85);
    return Math.max(1, dmg);
  }

  function computeEnemyHit(lvl, cls, dmgScale = 1) {
    const base = 30 + (lvl * 7);
    let dmg = clampHp((base + randInt(-10, 18)) * dmgScale);
    if (cls === "mozek") dmg = clampHp(dmg * 1.15);
    if (cls === "rvac") dmg = clampHp(dmg * 0.85);
    return Math.max(1, dmg);
  }

  function showWeapon(isPlayer) {
    return new Promise(resolve => {
      const weaponSelector = isPlayer ? ".weapon-player" : ".weapon-enemy";
      const weapon = document.querySelector(weaponSelector);
      if (!weapon) return resolve();
      
      weapon.src = "zbran1.png";
      weapon.classList.add("show-weapon");
      setTimeout(resolve, 400);
    });
  }

  function fireWeapon(isPlayer) {
    return new Promise(resolve => {
      const weaponSelector = isPlayer ? ".weapon-player" : ".weapon-enemy";
      const weapon = document.querySelector(weaponSelector);
      if (!weapon) return resolve();
      
      weapon.src = "zbran2.png";
      setTimeout(() => {
        weapon.src = "zbran1.png";
        resolve();
      }, 300);
    });
  }

  function hideWeapon(isPlayer) {
    return new Promise(resolve => {
      const weaponSelector = isPlayer ? ".weapon-player" : ".weapon-enemy";
      const weapon = document.querySelector(weaponSelector);
      if (!weapon) return resolve();
      
      weapon.classList.remove("show-weapon");
      setTimeout(resolve, 200);
    });
  }

  function showHitAnimation(targetSelector, dmgElSelector, damage, defender, fillEl, textEl, maxHp) {
    return new Promise(resolve => {
      const target = document.querySelector(targetSelector);
      const dmgEl = document.querySelector(dmgElSelector);

      if (!target) return resolve();

      target.classList.remove("hit-shake");
      void target.offsetWidth;
      target.classList.add("hit-shake");

      const holes = Array.from(target.querySelectorAll(".hit-overlay"));
      holes.forEach(h => {
        h.classList.remove("show-hit");
        h.style.opacity = "0";
      });

      let step = 0;
      const showNextHole = () => {
        if (step >= holes.length) {
          setTimeout(() => {
            if (dmgEl) {
              dmgEl.textContent = `-${fmtInt(damage)}`;
              dmgEl.classList.remove("show");
              void dmgEl.offsetWidth;
              dmgEl.classList.add("show");
            }
            setBar(fillEl, textEl, defender.curHp, maxHp);
            setTimeout(resolve, 850);
          }, 400);
          return;
        }

        const hole = holes[step];
        try {
          const parent = hole.parentElement;
          if (parent) {
            const pos = window.getComputedStyle(parent).position;
            if (pos === 'static') parent.style.position = 'relative';
          }
          hole.style.position = 'absolute';
          const x = 10 + Math.random() * 70;
          const y = 10 + Math.random() * 70;
          hole.style.left = x + '%';
          hole.style.top  = y + '%';
          hole.style.transform = 'translate(-50%, -50%)';
        } catch {}
        hole.style.opacity = "1";
        hole.classList.add("show-hit");
        step++;
        setTimeout(showNextHole, 120);
      };

      showNextHole();
    });
  }

  async function performAttack(attacker, defender, isPlayerAttacking, attackerTotal, meta) {
    const cls = String(meta._class || "padouch").toLowerCase();
    await showWeapon(isPlayerAttacking);
    await fireWeapon(isPlayerAttacking);

    if (isPlayerAttacking) {
      const dmg = computePlayerHit(attackerTotal, cls);
      enemyCurHp = clampHp(enemyCurHp - dmg);
      if (enemyCurHp < 0) enemyCurHp = 0;
      await showHitAnimation(".enemy-section .character-arena", "#enemyDmg", dmg, { curHp: enemyCurHp }, enemyHealthFill, enemyHealthText, enemyMaxHp);
    } else {
      const dmg = computeEnemyHit(Number(attackerTotal.level ?? 1), cls, (cryptaBossFight?.boss ? getBossDmgScale(getActiveEnemy()) : 1));
      playerCurrentHp = clampHp(playerCurrentHp - dmg);
      if (playerCurrentHp < 0) playerCurrentHp = 0;
      await showHitAnimation(".player-section .character-arena", "#playerDmg", dmg, { curHp: playerCurrentHp }, playerHealthFill, playerHealthText, playerMaxHp);
      try { sfSetHpSync(playerCurrentHp, playerMaxHp); } catch {}
    }

    await hideWeapon(isPlayerAttacking);
  }

  function startFight() {
    if (fightRunning) return;
    if (!window.SF) return;

    fightRunning = true;
    setButtonsVisible(false);

    recomputePlayerTotals();
    
    const st = sfGetStatsSync() || { money: 0 };
    
    // Použij aktuální HP (ne vždy full)
    if (playerHpFromDb && playerHpDb?.hp != null) {
      playerCurrentHp = clampHp(playerHpDb.hp);
    }
    playerCurrentHp = Math.min(playerCurrentHp, playerMaxHp);

    const enemy = enemies[enemyIndex % enemies.length];
    const enemyLvl = Number(enemy.level ?? 1);
    const enemyCls = String(enemy._class || "padouch").toLowerCase();

    let attacker = Math.random() < 0.5 ? "player" : "enemy";

    const step = async () => {
      if (!fightRunning) return;

      if (playerCurrentHp <= 0 || enemyCurHp <= 0) {
        const win = enemyCurHp <= 0 && playerCurrentHp > 0;
        await endFight(win, playerCurrentHp, playerMaxHp, enemyLvl);
        return;
      }

      if (attacker === "player") {
        await performAttack({ name: "Player" }, { name: "Enemy" }, true, playerTotal, { level: enemyLvl, _class: enemyCls });
        attacker = "enemy";
      } else {
        await performAttack({ name: "Enemy" }, { name: "Player" }, false, { level: enemyLvl, _class: enemyCls }, { level: playerTotal.level, _class: playerTotal._class });
        attacker = "player";
      }

      if (playerCurrentHp <= 0 || enemyCurHp <= 0) {
        const win = enemyCurHp <= 0 && playerCurrentHp > 0;
        endFight(win, playerCurrentHp, playerMaxHp, enemyLvl);
        return;
      }

      setTimeout(step, 1800);
    };

    const endFight = async (win, playerHpEnd, playerMaxEnd, enemyLvlEnd) => {
      try { sfSetHpSync(playerHpEnd, playerMaxEnd); } catch {}

      const hasMissionRewards = window.missionRewards && window.missionName;
      let reward, loss;
      
      if (hasMissionRewards) {
        reward = window.missionRewards.money;
        loss = Math.min(reward, sfGetStatsSync()?.money ?? 0);
      } else {
        reward = clampHp((enemyLvlEnd * 55) + randInt(20, 110));
        const stNow = sfGetStatsSync() || { money: 0 };
        const curMoney = clampHp(stNow.money ?? 0);
        loss = Math.min(curMoney, reward);
      }

      if (win) {
        try { await window.SF.actions.arenaWin(); } catch {}
        if (hasMissionRewards) {
          try { /* exp řeší server */ } catch {}
          const cur = window.SF?.stats?.missionData || {};
          const missionData = {
            ...cur,
            completed: (cur.completed || 0) + 1,
            totalExp: (cur.totalExp || 0) + window.missionRewards.exp,
            totalMoney: (cur.totalMoney || 0) + reward,
            battles: (cur.battles || 0) + 1,
            wins: (cur.wins || 0) + 1
          };
          window.SF.updateStats({ missionData });
        }
        finishFight(true, reward);
        if (hasMissionRewards) setTimeout(() => window.location.href = 'mise.html', 3000);
      } else {
        try { await (window.SF.actions.arenaLose ? window.SF.actions.arenaLose() : window.SF.actions.arenaWin()); } catch {}
        if (hasMissionRewards) {
          const cur = window.SF?.stats?.missionData || {};
          const missionData = { ...cur, battles: (cur.battles || 0) + 1 };
          window.SF.updateStats({ missionData });
        }
        finishFight(false, loss);
        if (hasMissionRewards) setTimeout(() => window.location.href = 'mise.html', 3000);
      }
      
      delete window.missionRewards;
      delete window.missionName;
    };

    setTimeout(step, 900);
  }

  async function hydratePlayerFromPostava() {
    try {
      console.log('🔥 === HYDRATE PLAYER FROM SUPABASE ===');
      
      const sb = window.supabaseClient;

      const sf = await (window.SFReady || Promise.resolve(window.SF));
      const uid = sf?.user?.id || sf?.stats?.user_id;
      if (!uid) {
        console.error("❌ Missing uid (not querying player_stats).");
        return;
      }
      
      console.log('👤 User ID:', uid);
      
      if (!sb) {
        console.warn('⚠️ Supabase not available');
        return;
      }

      const { data, error } = await sb
        .from("player_stats")
        .select("level,xp,money,stats,equipped,hp,hp_max")
        .eq("user_id", uid)
        .limit(1);

      if (error) {
        console.error('❌ Supabase error:', error);
        return;
      }
      
      console.log('📦 Raw Supabase data:', data);
      
      const row = data?.[0];
      if (!row) {
        console.warn('⚠️ No data found for user');
        return;
      }

      console.log('📊 Row data:', row);
      console.log('📊 Stats from DB:', row.stats);

      const st = row.stats || {};

      // --- HP sync (match Postava) ---
      const dbHpMax = (row.hp_max ?? row.hpMax ?? st.hp_max ?? st.max_hp ?? st.maxHp);
      const dbHpCur = (row.hp ?? row.hp_current ?? row.hpCur ?? st.hp ?? st.hp_current ?? st.current_hp);
      
      if (dbHpMax != null) {
        playerHpFromDb = true;
        playerHpDb.hp_max = clampHp(dbHpMax);
        playerHpDb.hp = clampHp(dbHpCur != null ? dbHpCur : dbHpMax);
        playerMaxHp = playerHpDb.hp_max;
        playerCurrentHp = Math.min(playerHpDb.hp, playerMaxHp);
        console.log('❤️ HP loaded from DB:', { hp: playerCurrentHp, hp_max: playerMaxHp });
      } else {
        playerHpFromDb = false;
        playerHpDb = { hp: null, hp_max: null };
        console.log('ℹ️ No hp_max in DB row; HP will be computed.');
      }

      playerCore = {
        strength: Number(st.strength ?? 18),
        defense: Number(st.defense ?? 14),
        dexterity: Number(st.dexterity ?? 11),
        intelligence: Number(st.intelligence ?? 11),
        constitution: Number(st.constitution ?? 16),
        luck: Number(st.luck ?? 9),
        level: Number(row.level ?? 1)
      };

      console.log('💪 playerCore after load:', playerCore);

      playerEquipped = row.equipped || null;
      console.log('🎒 playerEquipped:', playerEquipped);

      const dbCls = String(st.player_class || "").toLowerCase();
      if (dbCls) {
        try { window.SF?.setPlayerClass?.(dbCls); } catch {}
        try { window.SF?.updateStats?.({ stats: { ...(window.SF?.stats?.stats||{}), player_class: dbCls } }); } catch {}
        console.log('🎭 Class set:', dbCls);
      }

      recomputePlayerTotals();
      console.log('======================================');
    } catch (err) {
      console.error('❌ Error in hydratePlayerFromPostava:', err);
    }
  }

  function renderClassBadgeOnAvatar() {
    const meta = {
      padouch: { icon: "👻", label: "Padouch" },
      rvac: { icon: "✊", label: "Rváč" },
      mozek: { icon: "💡", label: "Mozek" }
    };
    const cls = String(window.SF?.stats?.stats?.player_class || "padouch").toLowerCase();
    const m = meta[cls] || meta.padouch;

    const char = document.querySelector(".player-section .character-arena");
    if (!char) return;

    let badge = char.querySelector(".class-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "class-badge";
      char.appendChild(badge);
    }
    badge.textContent = m.icon;
    badge.title = m.label;
  }

  async function boot() {
    console.log('🚀 === ARENA BOOT ===');
    
    await loadCryptaBossFight();
    if (cryptaBossFight?.boss) {
      console.log('💀 Crypta boss fight detected:', cryptaBossFight);
      if (nextBtn) nextBtn.style.display = 'none';
    }

    hydratePlayerFromPostava().finally(() => {
      console.log('✅ Hydration complete, rendering...');
      renderClassBadgeOnAvatar();
      healPlayerToFull();
      renderEnemy();
      
      // Auto-start duel pokud přicházíš z Crypty
      if (cryptaBossFight?.autoStart && cryptaBossFight?.boss) {
        setButtonsVisible(false);
        clearCryptaBossFight();
        setTimeout(() => {
          try { startFight(); } catch (e) { console.error('❌ AutoStart fight failed:', e); }
        }, 150);
      }

      // ⭐ SYNC CURRENCY UI
      syncCurrencyUI();
      
      console.log('✅ Boot complete!');
    });

    if (nextBtn) nextBtn.addEventListener("click", () => { if (!fightRunning) nextEnemy(); });
    if (attackBtn) attackBtn.addEventListener("click", startFight);
    if (resultContinue) {
      resultContinue.addEventListener("click", () => {
        closeResult();
        if (window.cryptaRewards) window.location.href = "auto.html";
        else window.location.href = "postava.html";
      });
    }
  }

  // ===== LISTEN TO SF STATS CHANGES =====
  document.addEventListener("sf:stats", async (e) => {
    console.log('🔄 Stats changed, resyncing...');
    await hydratePlayerFromPostava();
    syncCurrencyUI();
  });

  document.addEventListener("DOMContentLoaded", boot);
})();
