// arena.js – arena fight s POSTUPNOU animací (show weapon → fire → hide → THEN hit)
(() => {
  "use strict";

  // ===== NOVÉ SUPABASE CREDENTIALS =====
  const SUPABASE_URL = 'https://jbfvoxlcociwtyobaotz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZnZveGxjb2Npd3R5b2Jhb3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTQ3MTgsImV4cCI6MjA4MzM3MDcxOH0.ydY1I-rVv08Kg76wI6oPgAt9fhUMRZmsFxpc03BhmkA';

  const nextBtn = document.getElementById("nextEnemyBtn");
  const attackBtn = document.getElementById("attackBtn");

  const resultModal = document.getElementById("resultModal");
  const resultTitle = document.getElementById("resultTitle");
  const resultText  = document.getElementById("resultText");
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
    textEl.textContent = `HP ${fmtInt(cur)} / ${fmtInt(max)}`;
  }

  function showDmg(el, dmg) {
    if (!el) return;
    el.textContent = `-${fmtInt(dmg)}`;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
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
    const base = 500 + (Number(core.constitution ?? 0) * 25);
    let maxHp = clampHp(base);
    if (cls === "rvac")  maxHp = clampHp(maxHp * 1.25);
    if (cls === "mozek") maxHp = clampHp(maxHp * 0.8);
    return Math.max(1, maxHp);
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

    // PŘEPOČET MAX HP podle constitution + equipment bonusů
    playerMaxHp = computeMaxHpFromCore(playerTotal, cls);
    
    // Aktualizace UI atributů
    const map = {
      pStr: playerTotal.strength,
      pDef: playerTotal.defense,
      pDex: playerTotal.dexterity,
      pInt: playerTotal.intelligence,
      pCon: playerTotal.constitution,
      pLuck: playerTotal.luck
    };
    Object.keys(map).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(map[id]);
    });

    console.log('✅ Player totals recomputed:', playerTotal);
    console.log('💪 Max HP:', playerMaxHp, 'Current HP:', playerCurrentHp);
  }

  function healPlayerToFull() {
    recomputePlayerTotals();
    
    // Heal to full HP based on new max
    playerCurrentHp = playerMaxHp;
    
    if (window.SF) {
      window.SF.setHp(playerCurrentHp, playerMaxHp);
    }
    
    setBar(playerHealthFill, playerHealthText, playerCurrentHp, playerMaxHp);
    if (playerLevelText) playerLevelText.textContent = `Level ${playerTotal.level}`;
    
    console.log('🏥 Player healed to full:', playerCurrentHp, '/', playerMaxHp);
  }

  function renderEnemy() {
    const e = enemies[enemyIndex % enemies.length];
    const clsPool = ["padouch","rvac","mozek"];
    if (!e._class) e._class = clsPool[randInt(0, clsPool.length-1)];
    enemyCurHp = e.hp;
    enemyMaxHp = e.hp;

    if (e._class === "rvac")  enemyMaxHp = clampHp(enemyMaxHp * 1.25);
    if (e._class === "mozek") enemyMaxHp = clampHp(enemyMaxHp * 0.8);
    enemyCurHp = enemyMaxHp;

    if (enemyNameEl) enemyNameEl.textContent = e.name;
    if (enemyLevelEl) enemyLevelEl.textContent = `Level ${e.level}`;
    setBar(enemyHealthFill, enemyHealthText, enemyCurHp, enemyMaxHp);

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
      if (resultText)  resultText.textContent  = `Dostal jsi pár grošů... +${txtAmount}`;
    } else {
      if (resultTitle) resultTitle.textContent = "Prohrál jsi!";
      if (resultText)  resultText.textContent  = `Přišel jsi o groše... -${txtAmount}`;
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
    if (cls === "rvac")  dmg = clampHp(dmg * 0.85);
    return Math.max(1, dmg);
  }

  function computeEnemyHit(lvl, cls, dmgScale = 1) {
    const base = 30 + (lvl * 7);
    let dmg = clampHp((base + randInt(-10, 18)) * dmgScale);
    if (cls === "mozek") dmg = clampHp(dmg * 1.15);
    if (cls === "rvac")  dmg = clampHp(dmg * 0.85);
    return Math.max(1, dmg);
  }

  // ========================================
  // NOVÝ SYSTÉM ANIMACÍ - POSTUPNĚ
  // ========================================
  
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

  // ========================================
  // PERFORM ATTACK - SEKVENČNĚ
  // ========================================
  async function performAttack(attacker, defender, isPlayer, attackerTotal, defenderInfo) {
    const cls = isPlayer ? String(attackerTotal._class || "padouch").toLowerCase() : String(defenderInfo._class || "padouch").toLowerCase();
    const dmgScale = 1;

    let damage;
    if (isPlayer) {
      damage = computePlayerHit(attackerTotal, cls, dmgScale);
    } else {
      damage = computeEnemyHit(Number(defenderInfo.level ?? 1), cls, dmgScale);
    }

    console.log(`${isPlayer ? "Player" : "Enemy"} attacks for ${damage} damage`);

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
      
      if (window.SF) {
        window.SF.setHp(playerCurrentHp, playerMaxHp);
      }
    }
  }

  function startFight() {
    if (fightRunning) return;
    if (!window.SF) return;

    fightRunning = true;
    setButtonsVisible(false);

    recomputePlayerTotals();
    
    // Load current HP from SF
    const st = window.SF.getStats();
    playerCurrentHp = clampHp(st.hp ?? playerMaxHp);
    playerCurrentHp = Math.min(playerCurrentHp, playerMaxHp);

    const enemy = enemies[enemyIndex % enemies.length];
    const enemyLvl = Number(enemy.level ?? 1);
    const enemyCls = String(enemy._class || "padouch").toLowerCase();

    let attacker = Math.random() < 0.5 ? "player" : "enemy";

    let turn = 0;
    const step = async () => {
      if (!fightRunning) return;

      if (playerCurrentHp <= 0 || enemyCurHp <= 0) {
        const win = enemyCurHp <= 0 && playerCurrentHp > 0;
        endFight(win, playerCurrentHp, playerMaxHp, enemyLvl);
        return;
      }

      if (attacker === "player") {
        await performAttack(
          { name: "Player" },
          { name: "Enemy" },
          true,
          playerTotal,
          { level: enemyLvl, _class: enemyCls }
        );
        attacker = "enemy";
      } else {
        await performAttack(
          { name: "Enemy" },
          { name: "Player" },
          false,
          { level: enemyLvl, _class: enemyCls },
          { level: playerTotal.level, _class: playerTotal._class }
        );
        attacker = "player";
      }

      turn++;

      if (playerCurrentHp <= 0 || enemyCurHp <= 0) {
        const win = enemyCurHp <= 0 && playerCurrentHp > 0;
        endFight(win, playerCurrentHp, playerMaxHp, enemyLvl);
        return;
      }

      setTimeout(step, 1800);
    };

    const endFight = (win, playerHpEnd, playerMaxEnd, enemyLvlEnd) => {
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
        try { window.SF.addMoney(reward); } catch {}
        
        if (hasMissionRewards) {
          try { window.SF.addExp(window.missionRewards.exp); } catch {}
          
          const missionData = JSON.parse(localStorage.getItem('missionData') || '{}');
          missionData.completed = (missionData.completed || 0) + 1;
          missionData.totalExp = (missionData.totalExp || 0) + window.missionRewards.exp;
          missionData.totalMoney = (missionData.totalMoney || 0) + reward;
          missionData.battles = (missionData.battles || 0) + 1;
          missionData.wins = (missionData.wins || 0) + 1;
          localStorage.setItem('missionData', JSON.stringify(missionData));
        }
        
        finishFight(true, reward);
        
        if (hasMissionRewards) {
          setTimeout(() => {
            window.location.href = 'mise.html';
          }, 3000);
        }
      } else {
        try { window.SF.addMoney(-loss); } catch {}
        
        if (hasMissionRewards) {
          const missionData = JSON.parse(localStorage.getItem('missionData') || '{}');
          missionData.battles = (missionData.battles || 0) + 1;
          localStorage.setItem('missionData', JSON.stringify(missionData));
        }
        
        finishFight(false, loss);
        
        if (hasMissionRewards) {
          setTimeout(() => {
            window.location.href = 'mise.html';
          }, 3000);
        }
      }
      
      delete window.missionRewards;
      delete window.missionName;
    };

    setTimeout(step, 900);
  }

  function boot() {
    const cryptaDataStr = localStorage.getItem('cryptaBossFight');
    let autoStartFight = false;
    let cryptaBossData = null;
    
    if (cryptaDataStr) {
      try {
        cryptaBossData = JSON.parse(cryptaDataStr);
        if (cryptaBossData.fromCrypta && cryptaBossData.boss) {
          const cryptaBoss = {
            name: cryptaBossData.boss.name,
            level: cryptaBossData.boss.level,
            hp: cryptaBossData.boss.hp,
            _class: "padouch"
          };
          
          enemies[enemyIndex] = cryptaBoss;
          
          if (cryptaBossData.boss.background) {
            document.body.style.backgroundImage = `url('${cryptaBossData.boss.background}')`;
          }
          
          const enemyAvatar = document.querySelector('.enemy-section .character-arena img:not(.hit-overlay):not(.weapon)');
          if (enemyAvatar && cryptaBossData.boss.avatar) {
            enemyAvatar.src = cryptaBossData.boss.avatar;
          }
          
          if (cryptaBossData.autoStart) {
            autoStartFight = true;
          }
          
          localStorage.removeItem('cryptaBossFight');
          
          window.cryptaRewards = {
            reward: cryptaBossData.reward,
            bossIndex: cryptaBossData.bossIndex
          };
        }
      } catch (e) {
        console.error('Failed to load crypta boss:', e);
      }
    }
    
    const missionDataStr = localStorage.getItem('arenaFromMission');
    
    if (!cryptaDataStr && missionDataStr) {
      try {
        const missionData = JSON.parse(missionDataStr);
        if (missionData.fromMission && missionData.enemy) {
          const missionEnemy = {
            name: missionData.enemy.name.toUpperCase(),
            level: Math.floor(missionData.enemy.hp / 80),
            hp: missionData.enemy.hp,
            _class: "padouch"
          };
          
          enemies[enemyIndex] = missionEnemy;
          autoStartFight = true;
          localStorage.removeItem('arenaFromMission');
          
          window.missionRewards = missionData.rewards;
          window.missionName = missionData.missionName;
        }
      } catch (e) {
        console.error('Failed to load mission data:', e);
      }
    }
    
    hydratePlayerFromPostava().finally(() => {
      renderClassBadgeOnAvatar();
      healPlayerToFull();
      renderEnemy();
      
      if (autoStartFight) {
        setButtonsVisible(false);
        
        console.log("AUTO-STARTING FIGHT!");
        
        setTimeout(() => {
          startFight();
        }, 800);
      }
    });

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (fightRunning) return;
        nextEnemy();
      });
    }

    if (attackBtn) {
      attackBtn.addEventListener("click", () => {
        startFight();
      });
    }

    if (resultContinue) {
      resultContinue.addEventListener("click", () => {
        closeResult();
        
        if (window.cryptaRewards) {
          window.location.href = "auto.html";
        } else {
          window.location.href = "postava.html";
        }
      });
    }

    if (window.SF?.sb?.channel) {
      window.addEventListener("storage", (e) => {
        if (!e.key) return;
        if (String(e.key).startsWith("sf_stats_")) {
          healPlayerToFull();
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", boot);

  async function hydratePlayerFromPostava() {
    try {
      console.log('🔄 Loading player stats from Supabase...');
      
      const lib = window.supabase;
      const sb = window.supabaseClient || (lib?.createClient ? lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null);

      const uid = localStorage.getItem("user_id") || localStorage.getItem("slavFantasyUserId") || "1";
      if (!sb) {
        console.warn('⚠️ Supabase client not available');
        return;
      }

      console.log('👤 Loading data for user:', uid);

      const { data, error } = await sb
        .from("player_stats")
        .select("level,stats,equipped")
        .eq("user_id", uid)
        .limit(1);

      if (error) {
        console.error('❌ Supabase error:', error);
        return;
      }
      
      const row = data?.[0];
      if (!row) {
        console.warn('⚠️ No player data found');
        return;
      }

      console.log('✅ Player data loaded:', row);

      const st = row.stats || {};
      playerCore = {
        strength: Number(st.strength ?? playerCore.strength),
        defense: Number(st.defense ?? playerCore.defense),
        dexterity: Number(st.dexterity ?? playerCore.dexterity),
        intelligence: Number(st.intelligence ?? playerCore.intelligence),
        constitution: Number(st.constitution ?? playerCore.constitution),
        luck: Number(st.luck ?? playerCore.luck),
        level: Number(row.level ?? playerCore.level)
      };

      playerEquipped = row.equipped || null;

      console.log('💪 Player core stats:', playerCore);
      console.log('🎒 Player equipment:', playerEquipped);

      const dbCls = String(st.player_class || "").toLowerCase();
      if (dbCls) {
        try { window.SF?.setPlayerClass?.(dbCls); } catch {}
        localStorage.setItem("sf_class", dbCls);
      }

      recomputePlayerTotals();
    } catch (err) {
      console.error('❌ Error loading player stats:', err);
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
})();
