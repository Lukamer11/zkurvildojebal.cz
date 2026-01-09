// arena.js – VERZE S EXTRA DEBUG LOGY
(() => {
  "use strict";

  const SUPABASE_URL = 'https://jbfvoxlcociwtyobaotz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZnZveGxjb2Npd3R5b2Jhb3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTQ3MTgsImV4cCI6MjA4MzM3MDcxOH0.ydY1I-rVv08Kg76wI6oPgAt9fhUMRZmsFxpc03BhmkA';

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

  function fmtInt(n) {
    return Number(n ?? 0).toLocaleString("cs-CZ");
  }

  function setBar(fillEl, textEl, cur, max) {
    if (!fillEl || !textEl) return;
    const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (cur / max) * 100));
    fillEl.style.width = pct + "%";
    textEl.textContent = `HP ${fmtInt(Math.floor(cur))} / ${fmtInt(Math.floor(max))}`;
  }

  function clampHp(v) {
    return Math.max(0, Math.floor(Number(v) || 0));
  }

  function randInt(min, max) {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

    function computeMaxHpFromCore(core, cls) {
    // Vypočítej HP POUZE z base Constitution (bez equipment bonusů)
    const baseCon = Number(core.constitution ?? 0);
    const base = 500 + (baseCon * 25);
    let maxHp = clampHp(base);
    
    // Aplikuj class modifikátory
    if (cls === "rvac") maxHp = clampHp(maxHp * 1.25);
    if (cls === "mozek") maxHp = clampHp(maxHp * 0.8);
    
    console.log(`💪 computeMaxHpFromCore: baseCon=${baseCon}, cls=${cls}, maxHp=${maxHp}`);
    return Math.max(1, maxHp);
  }

// ===== PŘIDEJ NOVOU FUNKCI pro synchronizaci měny =====
  function syncCurrencyUI() {
    console.log('💰 === SYNC CURRENCY UI ===');
    
    if (!window.SF) {
      console.warn('⚠️ SF not available');
      return;
    }
    
    const stats = window.SF.getStats();
    console.log('📊 Stats from SF:', stats);
    
    const moneyEl = document.getElementById('money');
    const cigarettesEl = document.getElementById('cigarettes');
    const energyEl = document.getElementById('energy');
    
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

  function recomputePlayerTotals() {
    const cls = (window.SF?.getPlayerClass ? window.SF.getPlayerClass() : (localStorage.getItem("sf_class") || "padouch")).toLowerCase();
    const equipBonus = calcEquipBonuses(playerEquipped);
    
    // Total stats = base + equipment bonuses
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

    // ⚠️ NEPOUŽÍVEJ computeMaxHpFromCore - vezmi HP ze SF!
    if (window.SF) {
      const sfStats = window.SF.getStats();
      playerMaxHp = clampHp(sfStats.max_hp || sfStats.maxHp || 500);
      console.log('💚 Using maxHP from SF:', playerMaxHp);
    } else {
      playerMaxHp = computeMaxHpFromCore(playerCore, cls);
      console.log('⚠️ SF not available, computed maxHP:', playerMaxHp);
    }
    
    console.log('🔥 === RECOMPUTE PLAYER TOTALS ===');
    console.log('playerCore:', playerCore);
    console.log('equipBonus:', equipBonus);
    console.log('playerTotal:', playerTotal);
    console.log('playerMaxHp:', playerMaxHp);
    
    // UPDATE UI ELEMENTS
    const statMap = {
      pStr: playerTotal.strength,
      pDef: playerTotal.defense,
      pDex: playerTotal.dexterity,
      pInt: playerTotal.intelligence,
      pCon: playerTotal.constitution,
      pLuck: playerTotal.luck
    };
    
    console.log('📊 Updating UI elements...');
    Object.keys(statMap).forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = String(statMap[id]);
        console.log(`  ✅ ${id}: ${statMap[id]}`);
      } else {
        console.warn(`  ⚠️ Element not found: ${id}`);
      }
    });

    console.log('=================================');
  }
  
  function healPlayerToFull() {
    console.log('🏥 === HEAL PLAYER TO FULL ===');
    
    // ⚠️ KRITICKÁ ZMĚNA: Vezmi maxHP přímo ze SF, ne z vlastního výpočtu!
    if (window.SF) {
      const sfStats = window.SF.getStats();
      playerMaxHp = clampHp(sfStats.max_hp || sfStats.maxHp || 500);
      playerCurrentHp = playerMaxHp;
      
      console.log('  💚 Using HP from SF:', playerCurrentHp, '/', playerMaxHp);
      console.log('  📊 SF Stats:', sfStats);
      
      window.SF.setHp(playerCurrentHp, playerMaxHp);
    } else {
      // Fallback pokud SF není k dispozici
      const cls = (localStorage.getItem("sf_class") || "padouch").toLowerCase();
      playerMaxHp = computeMaxHpFromCore(playerCore, cls);
      playerCurrentHp = playerMaxHp;
      
      console.log('  ⚠️ SF not available, using computed HP:', playerCurrentHp, '/', playerMaxHp);
    }
    
    setBar(playerHealthFill, playerHealthText, playerCurrentHp, playerMaxHp);
    console.log('  💚 Health bar set:', playerCurrentHp, '/', playerMaxHp);
    
    if (playerLevelText) {
      const level = window.SF ? window.SF.getStats().level : playerCore.level;
      playerLevelText.textContent = `Level ${level}`;
      console.log('  📊 Level text set:', level);
    }
    
    console.log('=============================');
  }
  function renderEnemy() {
    const e = enemies[enemyIndex % enemies.length];
    const clsPool = ["padouch","rvac","mozek"];
    if (!e._class) e._class = clsPool[randInt(0, clsPool.length-1)];
    
    enemyMaxHp = e.hp;
    if (e._class === "rvac") enemyMaxHp = clampHp(enemyMaxHp * 1.25);
    if (e._class === "mozek") enemyMaxHp = clampHp(enemyMaxHp * 0.8);
    enemyCurHp = enemyMaxHp;

    if (enemyNameEl) enemyNameEl.textContent = e.name;
    if (enemyLevelEl) enemyLevelEl.textContent = `Level ${e.level}`;
    setBar(enemyHealthFill, enemyHealthText, enemyCurHp, enemyMaxHp);

    const eStr = 10 + (e.level * 3) + randInt(0, 5);
    const eDef = 8 + (e.level * 2) + randInt(0, 4);
    const eDex = 6 + (e.level * 2) + randInt(0, 3);
    const eInt = 5 + e.level + randInt(0, 2);
    const eCon = 12 + (e.level * 2) + randInt(0, 4);
    const eLuck = 3 + e.level + randInt(0, 2);

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
          }, 100);

          setTimeout(() => {
            defender.hp = clampHp(defender.hp - damage);
            setBar(fillEl, textEl, defender.hp, maxHp);
          }, 200);
          return;
        }

        const hole = holes[step];
        if (!hole) {
          step++;
          showNextHole();
          return;
        }

        const x = 40 + Math.random() * 120;
        const y = 90 + Math.random() * 140;
        hole.style.left = x + "px";
        hole.style.top = y + "px";
        hole.classList.add("show-hit");

        step++;
        setTimeout(showNextHole, 200);
      };

      showNextHole();

      setTimeout(() => {
        target.classList.remove("hit-shake");
        holes.forEach(h => {
          h.classList.remove("show-hit");
          setTimeout(() => { h.style.opacity = "0"; }, 300);
        });
        resolve();
      }, 1400);
    });
  }

  async function performAttack(attacker, defender, isPlayer, attackerTotal, defenderInfo) {
    const cls = isPlayer ? String(attackerTotal._class || "padouch").toLowerCase() : String(defenderInfo._class || "padouch").toLowerCase();
    const dmgScale = 1;

    let damage;
    if (isPlayer) {
      damage = computePlayerHit(attackerTotal, cls, dmgScale);
    } else {
      damage = computeEnemyHit(Number(defenderInfo.level ?? 1), cls, dmgScale);
    }

    await showWeapon(isPlayer);
    await fireWeapon(isPlayer);
    await hideWeapon(isPlayer);

    if (isPlayer) {
      const enemyObj = { hp: enemyCurHp };
      await showHitAnimation(
        ".enemy-section .character-arena",
        "#enemyDmg",
        damage,
        enemyObj,
        enemyHealthFill,
        enemyHealthText,
        enemyMaxHp
      );
      enemyCurHp = enemyObj.hp;
    } else {
      const playerObj = { hp: playerCurrentHp };
      await showHitAnimation(
        ".player-section .character-arena",
        "#playerDmg",
        damage,
        playerObj,
        playerHealthFill,
        playerHealthText,
        playerMaxHp
      );
      playerCurrentHp = playerObj.hp;
      if (window.SF) window.SF.setHp(playerCurrentHp, playerMaxHp);
    }
  }

  function startFight() {
    if (fightRunning) return;
    if (!window.SF) return;

    fightRunning = true;
    setButtonsVisible(false);

    recomputePlayerTotals();
    
    const st = window.SF.getStats();
    playerCurrentHp = clampHp(st.hp ?? playerMaxHp);
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
        await endFight(win, playerCurrentHp, playerMaxHp, enemyLvl);
        return;
      }

      setTimeout(step, 1800);
    };

    const endFight = async (win, playerHpEnd, playerMaxEnd, enemyLvlEnd) => {
      try { window.SF.setHp(playerHpEnd, playerMaxEnd); } catch {}

      const hasMissionRewards = window.missionRewards && window.missionName;
      let reward, loss;
      
      if (hasMissionRewards) {
        reward = window.missionRewards.money;
        loss = Math.min(reward, window.SF?.getStats()?.money ?? 0);
      } else {
        reward = clampHp((enemyLvlEnd * 55) + randInt(20, 110));
        const stNow = window.SF.getStats();
        const curMoney = clampHp(stNow.money ?? 0);
        loss = Math.min(curMoney, reward);
      }

      if (win) {
        try { await window.SF.actions.arenaWin(); } catch {}
        if (hasMissionRewards) {
          try { /* exp řeší server */ } catch {}
          const missionData = JSON.parse(localStorage.getItem('missionData') || '{}');
          missionData.completed = (missionData.completed || 0) + 1;
          missionData.totalExp = (missionData.totalExp || 0) + window.missionRewards.exp;
          missionData.totalMoney = (missionData.totalMoney || 0) + reward;
          missionData.battles = (missionData.battles || 0) + 1;
          missionData.wins = (missionData.wins || 0) + 1;
          localStorage.setItem('missionData', JSON.stringify(missionData));
        }
        finishFight(true, reward);
        if (hasMissionRewards) setTimeout(() => window.location.href = 'mise.html', 3000);
      } else {
        try { await window.SF.actions.arenaWin(); } catch {}
        if (hasMissionRewards) {
          const missionData = JSON.parse(localStorage.getItem('missionData') || '{}');
          missionData.battles = (missionData.battles || 0) + 1;
          localStorage.setItem('missionData', JSON.stringify(missionData));
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
      
      const lib = window.supabase;
      const sb = window.supabaseClient;

      const uid = localStorage.getItem("user_id") || localStorage.getItem("slavFantasyUserId") || "1";
      
      console.log('👤 User ID:', uid);
      
      if (!sb) {
        console.warn('⚠️ Supabase not available');
        return;
      }

      const { data, error } = await sb
        .from("player_stats")
        .select("level,stats,equipped")
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
        localStorage.setItem("sf_class", dbCls);
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
    const cls = (window.SF?.getPlayerClass ? window.SF.getPlayerClass() : (localStorage.getItem("sf_class") || "padouch")).toLowerCase();
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

   function boot() {
    console.log('🚀 === ARENA BOOT ===');
    
    hydratePlayerFromPostava().finally(() => {
      console.log('✅ Hydration complete, rendering...');
      renderClassBadgeOnAvatar();
      healPlayerToFull();
      renderEnemy();
      
      // ⭐ PŘIDEJ TOTO:
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
  document.addEventListener("DOMContentLoaded", boot);
})();
