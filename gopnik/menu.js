// menu.js - SYNCHRONIZOVANÃ‰ MENU
import { GameState } from "./core/gameState.js";

(async () => {
  "use strict";

  console.log('ðŸŽ¨ Inicializuji menu...');

  // âœ… INICIALIZUJ GAMESTATE
  await GameState.initialize();

  // âœ… FUNKCE PRO UPDATE UI
  function updateMenuUI(state) {
    console.log('ðŸ"„ Updating menu UI:', state);
    
    // Level
    const levelDisplay = document.getElementById('levelDisplay');
    if (levelDisplay) {
      levelDisplay.textContent = state.level;
    }
    
    // Money
    const moneyEl = document.getElementById('money');
    if (moneyEl) {
      moneyEl.textContent = Number(state.money).toLocaleString('cs-CZ');
    }
    
    // Cigarettes
    const cigarettesEl = document.getElementById('cigarettes');
    if (cigarettesEl) {
      cigarettesEl.textContent = state.cigarettes;
    }
    
    // Energy
    const energyEl = document.getElementById('energy');
    if (energyEl) {
      energyEl.textContent = state.energy;
    }
    
    // XP Bar
    const requiredXP = GameState.getRequiredXP();
    const xpPercent = (state.xp / requiredXP) * 100;
    
    const xpFill = document.getElementById('xpFill');
    if (xpFill) {
      xpFill.style.width = `${xpPercent}%`;
    }
    
    const xpText = document.getElementById('xpText');
    if (xpText) {
      xpText.textContent = `${state.xp} / ${requiredXP}`;
    }
    
    // Energy Bar
    const energyFill = document.getElementById('energyFill');
    if (energyFill) {
      const energyPercent = (state.energy / 100) * 100;
      energyFill.style.width = `${energyPercent}%`;
    }
    
    const energyText = document.getElementById('energyText');
    if (energyText) {
      energyText.textContent = `${state.energy} / 100`;
    }
  }

  // âœ… SUBSCRIBE NA ZMÄšNY
  GameState.subscribe(updateMenuUI);

  // âœ… INITIAL RENDER
  updateMenuUI(GameState.getState());

  // âœ… ACTIVE BUTTON HANDLING
  document.querySelectorAll(".sf-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sf-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // âœ… MUSIC HANDLING
  const music = document.getElementById("bgMusic");
  
  function safePlay() {
    if (!music) return;
    const p = music.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        console.log('Autoplay blocked - waiting for user interaction');
      });
    }
  }

  if (localStorage.getItem("musicPlaying") === "true") {
    music.currentTime = parseFloat(localStorage.getItem("musicTime")) || 0;
    music.volume = 0.4;
    safePlay();
  }

  document.addEventListener("click", () => {
    if (music.paused) {
      safePlay();
      localStorage.setItem("musicPlaying", "true");
    }
  }, { once: true });

  setInterval(() => {
    if (music && !music.paused) {
      localStorage.setItem("musicTime", music.currentTime);
    }
  }, 500);

  console.log('âœ… Menu initialized with GameState sync');
})();

// âœ… EXPORT PRO BACKWARD COMPATIBILITY
if (typeof window !== 'undefined') {
  window.SF = {
    getStats: () => {
      const state = GameState.getState();
      const totalStats = GameState.calculateTotalStats();
      return {
        level: state.level,
        xp: state.xp,
        money: state.money,
        cigarettes: state.cigarettes,
        energy: state.energy,
        hp: state.hp,
        maxHp: state.maxHp,
        ...totalStats
      };
    },
    setHp: (hp, maxHp) => {
      GameState.setHp(hp, maxHp);
    },
    addMoney: (amount) => {
      GameState.addMoney(amount);
    },
    addXP: (amount) => {
      GameState.addXP(amount);
    },
    getPlayerClass: () => {
      return GameState.getPlayerClass();
    },
    setPlayerClass: (cls) => {
      GameState.set('playerClass', cls);
      localStorage.setItem('sf_class', cls);
    },
    setStats: (updates, options = {}) => {
      GameState.setMultiple(updates, options);
    }
  };
}