// arena.js - SYNCHRONIZOVANÃ S GAMESTATE
import { GameState } from "./core/gameState.js";

(() => {
  "use strict";

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

  // âœ… HELPER FUNCTIONS
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
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // âœ… RENDER PLAYER HP A STATS (Z GAMESTATE!)
  function renderPlayer() {
    const state = GameState.getState();
    const totalStats = GameState.calculateTotalStats();
    
    console.log('ðŸŽ® Rendering player:', {
      hp: state.hp,
      maxHp: state.maxHp,
      level: state.level,
      stats: totalStats
    });
    
    // HP bar
    setBar(playerHealthFill, playerHealthText, state.hp, state.maxHp);
    
    // Level
    if (playerLevelText) {
      playerLevelText.textContent = `Level ${state.level}`;
    }
    
    // Staty (s equipment bonusy)
    const statMap = {
      pStr: totalStats.strength,
      pDef: totalStats.defense,
      pDex: totalStats.dexterity,
      pInt: totalStats.intelligence,
      pCon: totalStats.constitution,
      pLuck: totalStats.luck
    };
    
    Object.keys(statMap).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(statMap[id]);
    });
  }

  // âœ… RENDER ENEMY
  function renderEnemy() {
    const e = enemies[enemyIndex % enemies.length];
    const clsPool = ["padouch", "rvac", "mozek"];
    if (!e._class) e._class = clsPool[randInt(0, clsPool.length - 1)];
    
    enemyCurHp = e.hp;
    enemyMaxHp = e.hp;

    if (e._class === "rvac") enemyMaxHp = clampHp(enemyMaxHp * 1.25);
    if (e._class === "mozek") enemyMaxHp = clampHp(enemyMaxHp * 0.8);
    enemyCurHp = enemyMaxHp;

    if (enemyNameEl) enemyNameEl.textContent = e.name;
    if (enemyLevelEl) enemyLevelEl.textContent = `Level ${e.level}`;
    setBar(enemyHealthFill, enemyHealthText, enemyCurHp, enemyMaxHp);

    renderEnemyClassBadge(e._class);
  }

  function renderEnemyClassBadge(clsKey) {
    const meta = {
      padouch: { icon: "ðŸ'»", label: "Padouch" },
      rvac: { icon: "âœŠ", label: "RvÃ¡Ä" },
      mozek: { icon: "ðŸ'¡", label: "Mozek" }
    };
    const m = meta[String(clsKey || "padouch").toLowerCase()] || meta.padouch;
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
    if (nextBtn) nextBtn.style.display = v ? "" : "none";
    if (attackBtn) attackBtn.style.display = v ? "" : "none";
  }

  function openResult(win, amount) {
    if (!resultModal) return;
    const txtAmount = fmtInt(amount);

    if (win) {
      if (resultTitle) resultTitle.textContent = "VyhrÃ¡l jsi!";
      if (resultText) resultText.textContent = `Dostal jsi pÃ¡r groÅ¡Å¯... +${txtAmount}`;
    } else {
      if (resultTitle) resultTitle.textContent = "ProhrÃ¡l jsi!";
      if (resultText) resultText.textContent = `PÅ™iÅ¡el jsi o groÅ¡e... -${txtAmount}`;
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

  // âœ… VÃPOÄŒET DMG (pouÅ¾Ã­vÃ¡ total stats z GameState)
  function computePlayerHit(dmgScale = 1) {
    const state = GameState.getState();
    const totalStats = GameState.calculateTotalStats();
    const cls = GameState.getPlayerClass();
    
    const lvl = state.level;
    const str = totalStats.strength;
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

  // âœ… WEAPON ANIMATIONS
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

  // âœ… HIT ANIMATION
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

  // âœ… PERFORM ATTACK
  async function performAttack(isPlayer) {
    let damage;
    
    if (isPlayer) {
      damage = computePlayerHit();
      console.log(`Player attacks for ${damage} damage`);
      
      await showWeapon(true);
      await fireWeapon(true);
      await hideWeapon(true);
      
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
      const enemy = enemies[enemyIndex % enemies.length];
      const enemyCls = String(enemy._class || "padouch").toLowerCase();
      damage = computeEnemyHit(enemy.level, enemyCls);
      
      console.log(`Enemy attacks for ${damage} damage`);
      
      await showWeapon(false);
      await fireWeapon(false);
      await hideWeapon(false);
      
      // âœ… POUÅ½ÃVÃME GAMESTATE HP!
      const state = GameState.getState();
      const playerObj = { hp: state.hp };
      
      await showHitAnimation(
        ".player-section .character-arena",
        "#playerDmg",
        damage,
        playerObj,
        playerHealthFill,
        playerHealthText,
        state.maxHp
      );
      
      // âœ… ULOÅ½ÃME NOVÃ‰ HP DO GAMESTATE
      GameState.setHp(playerObj.hp);
    }
  }

  // âœ… START FIGHT
  function startFight() {
    if (fightRunning) return;
    fightRunning = true;
    setButtonsVisible(false);

    const state = GameState.getState();
    const enemy = enemies[enemyIndex % enemies.length];
    const enemyLvl = enemy.level;

    let attacker = Math.random() < 0.5 ? "player" : "enemy";
    let turn = 0;

    const step = async () => {
      if (!fightRunning) return;

      const currentState = GameState.getState();
      
      // Check for end conditions
      if (currentState.hp <= 0 || enemyCurHp <= 0) {
        const win = enemyCurHp <= 0 && currentState.hp > 0;
        endFight(win, currentState.hp, currentState.maxHp, enemyLvl);
        return;
      }

      // Perform attack
      if (attacker === "player") {
        await performAttack(true);
        attacker = "enemy";
      } else {
        await performAttack(false);
        attacker = "player";
      }

      turn++;

      const afterState = GameState.getState();
      
      if (afterState.hp <= 0 || enemyCurHp <= 0) {
        const win = enemyCurHp <= 0 && afterState.hp > 0;
        endFight(win, afterState.hp, afterState.maxHp, enemyLvl);
        return;
      }

      setTimeout(step, 1800);
    };

    const endFight = (win, playerHpEnd, playerMaxEnd, enemyLvlEnd) => {
      // âœ… ULOÅ½ÃME FINÃLNÃ HP
      GameState.setHp(playerHpEnd);

      const hasMissionRewards = window.missionRewards && window.missionName;
      let reward, loss;
      
      if (hasMissionRewards) {
        reward = window.missionRewards.money;
        loss = Math.min(reward, GameState.get('money'));
      } else {
        reward = clampHp((enemyLvlEnd * 55) + randInt(20, 110));
        loss = Math.min(GameState.get('money'), reward);
      }

      if (win) {
        GameState.addMoney(reward);
        
        if (hasMissionRewards) {
          GameState.addXP(window.missionRewards.exp);
          
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
        GameState.addMoney(-loss);
        
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

  // âœ… BOOT
  async function boot() {
    console.log('ðŸš€ Bootujeme arÃ©nu...');
    
    // âœ… INICIALIZUJEME GAMESTATE
    await GameState.initialize();
    
    // âœ… SUBSCRIBE NA ZMÄšNY
    GameState.subscribe((state) => {
      console.log('ðŸ"„ GameState update:', state);
      renderPlayer();
    });
    
    // Check crypta boss
    const cryptaDataStr = localStorage.getItem('cryptaBossFight');
    let autoStartFight = false;
    
    if (cryptaDataStr) {
      try {
        const cryptaBossData = JSON.parse(cryptaDataStr);
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
    
    // Check mission
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
    
    // âœ… RENDER
    renderPlayer();
    renderEnemy();
    renderPlayerClassBadge();
    
    // Auto-start fight
    if (autoStartFight) {
      setButtonsVisible(false);
      console.log("AUTO-STARTING FIGHT!");
      setTimeout(() => {
        startFight();
      }, 800);
    }

    // Buttons
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
    
    console.log('âœ… ArÃ©na ready!');
  }

  function renderPlayerClassBadge() {
    const meta = {
      padouch: { icon: "ðŸ'»", label: "Padouch" },
      rvac: { icon: "âœŠ", label: "RvÃ¡Ä" },
      mozek: { icon: "ðŸ'¡", label: "Mozek" }
    };
    const cls = GameState.getPlayerClass();
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

  document.addEventListener("DOMContentLoaded", boot);
})();