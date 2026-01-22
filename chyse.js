// chyse.js - Bezdáci & Chýše System
(() => {
  'use strict';

  // ===== KONFIGURACE =====
  const INCOME_PER_HOMELESS = 0.00000001; // cigarety za sekundu
  const WORK_DURATION = 12 * 60 * 60 * 1000; // 12 hodin v milisekundách
  const SAVE_INTERVAL = 5000; // Auto-save každých 5 sekund

  // ===== HUT DEFINITIONS =====
  const HUTS = [
    {
      id: 'tent',
      name: 'Stan',
      icon: '⛺',
      baseCost: 100,
      slots: 3,
      unlockLevel: 1
    },
    {
      id: 'cardboard',
      name: 'Kartonová bedna',
      icon: '📦',
      baseCost: 500,
      slots: 4,
      unlockLevel: 3
    },
    {
      id: 'shack',
      name: 'Chatrč',
      icon: '🏚️',
      baseCost: 2000,
      slots: 5,
      unlockLevel: 5
    },
    {
      id: 'shed',
      name: 'Kůlna',
      icon: '🛖',
      baseCost: 8000,
      slots: 6,
      unlockLevel: 8
    },
    {
      id: 'trailer',
      name: 'Karavan',
      icon: '🚐',
      baseCost: 30000,
      slots: 8,
      unlockLevel: 12
    },
    {
      id: 'warehouse',
      name: 'Sklad',
      icon: '🏭',
      baseCost: 100000,
      slots: 10,
      unlockLevel: 15
    }
  ];

  // ===== STATE =====
  let state = {
    huts: {},
    lastUpdate: Date.now(),
    totalEarned: 0
  };

  // ===== UTILS =====
  function getCigs() {
    const el = document.getElementById('cigarettes');
    if (!el) return 0;
    return Number(el.textContent.replace(/\s|,/g, '')) || 0;
  }

  function setCigs(amount) {
    const el = document.getElementById('cigarettes');
    if (el) el.textContent = Math.max(0, Math.floor(amount)).toLocaleString('cs-CZ');
    
    if (window.SF?.setCigarettes) {
      window.SF.setCigarettes(Math.max(0, Math.floor(amount)));
    }
  }

  function getPlayerLevel() {
    const el = document.getElementById('levelDisplay');
    if (!el) return 1;
    return Number(el.textContent) || 1;
  }

  function saveState() {
    try {
      localStorage.setItem('chyse_state', JSON.stringify(state));
    } catch (e) {
      console.error('Save error:', e);
    }
  }

  function loadState() {
    try {
      const saved = localStorage.getItem('chyse_state');
      if (saved) {
        state = JSON.parse(saved);
        // Calculate offline earnings
        const now = Date.now();
        const timePassed = now - (state.lastUpdate || now);
        if (timePassed > 0) {
          const offlineIncome = calculateOfflineIncome(timePassed);
          if (offlineIncome > 0) {
            state.totalEarned += offlineIncome;
            showNotification(`⏰ Offline příjem: ${offlineIncome.toFixed(8)} 🚬`);
          }
        }
        state.lastUpdate = now;
      }
    } catch (e) {
      console.error('Load error:', e);
    }
  }

  function calculateOfflineIncome(ms) {
    let total = 0;
    Object.values(state.huts).forEach(hut => {
      if (!hut.owned) return;
      hut.homeless.forEach(h => {
        if (h.working && h.workUntil) {
          const workRemaining = h.workUntil - (state.lastUpdate || Date.now());
          if (workRemaining > 0) {
            const workTime = Math.min(ms, workRemaining);
            total += (workTime / 1000) * INCOME_PER_HOMELESS;
          }
        }
      });
    });
    return total;
  }

  // ===== HUT FUNCTIONS =====
  function initHut(hutDef) {
    if (!state.huts[hutDef.id]) {
      state.huts[hutDef.id] = {
        id: hutDef.id,
        level: 0,
        owned: false,
        homeless: Array(hutDef.slots).fill(null).map(() => ({
          working: false,
          workUntil: null
        }))
      };
    }
  }

  function buyHut(hutId) {
    const hutDef = HUTS.find(h => h.id === hutId);
    if (!hutDef) return;

    const hut = state.huts[hutId];
    if (hut.owned) return;

    const cost = hutDef.baseCost;
    const cigs = getCigs();

    if (cigs < cost) {
      showNotification('❌ Nemáš dost cigaret!', 'error');
      return;
    }

    setCigs(cigs - cost);
    hut.owned = true;
    hut.level = 1;

    showNotification(`✅ Koupil jsi ${hutDef.name}!`, 'success');
    saveState();
    render();
  }

  function upgradeHut(hutId) {
    const hutDef = HUTS.find(h => h.id === hutId);
    if (!hutDef) return;

    const hut = state.huts[hutId];
    if (!hut.owned) return;

    const cost = Math.floor(hutDef.baseCost * (1 + hut.level * 0.5));
    const cigs = getCigs();

    if (cigs < cost) {
      showNotification('❌ Nemáš dost cigaret!', 'error');
      return;
    }

    setCigs(cigs - cost);
    hut.level++;

    // Add new slot
    if (hut.homeless.length < hutDef.slots + Math.floor(hut.level / 2)) {
      hut.homeless.push({
        working: false,
        workUntil: null
      });
    }

    showNotification(`⬆️ Vylepšil jsi ${hutDef.name} na level ${hut.level}!`, 'success');
    saveState();
    render();
  }

  function kickHomeless(hutId, slotIndex) {
    const hut = state.huts[hutId];
    if (!hut || !hut.owned) return;

    const homeless = hut.homeless[slotIndex];
    if (!homeless) return;

    if (homeless.working && homeless.workUntil > Date.now()) {
      showNotification('⚠️ Už pracuje!', 'warn');
      return;
    }

    // Kopnutí animace
    showKickAnimation();

    // Start working
    homeless.working = true;
    homeless.workUntil = Date.now() + WORK_DURATION;

    showNotification('👟 Kopl jsi do bezdáka! Jde pracovat!', 'success');
    saveState();
    render();
  }

  // ===== INCOME CALCULATION =====
  function updateIncome() {
    const now = Date.now();
    const delta = now - state.lastUpdate;
    let income = 0;

    Object.values(state.huts).forEach(hut => {
      if (!hut.owned) return;
      hut.homeless.forEach(h => {
        if (h.working && h.workUntil) {
          if (now < h.workUntil) {
            // Still working
            income += (delta / 1000) * INCOME_PER_HOMELESS;
          } else {
            // Finished working
            h.working = false;
            h.workUntil = null;
          }
        }
      });
    });

    if (income > 0) {
      state.totalEarned += income;
      const currentCigs = getCigs();
      setCigs(currentCigs + income);
    }

    state.lastUpdate = now;
  }

  // ===== STATS CALCULATION =====
  function getStats() {
    let totalHuts = 0;
    let activeHomeless = 0;
    let totalHomeless = 0;
    let incomePerSec = 0;

    Object.values(state.huts).forEach(hut => {
      if (hut.owned) {
        totalHuts++;
        hut.homeless.forEach(h => {
          totalHomeless++;
          if (h.working && h.workUntil > Date.now()) {
            activeHomeless++;
            incomePerSec += INCOME_PER_HOMELESS;
          }
        });
      }
    });

    return { totalHuts, activeHomeless, totalHomeless, incomePerSec };
  }

  // ===== RENDERING =====
  function render() {
    const container = document.getElementById('chyseContainer');
    if (!container) return;

    const playerLevel = getPlayerLevel();
    container.innerHTML = '';

    HUTS.forEach(hutDef => {
      const hut = state.huts[hutDef.id];
      const locked = playerLevel < hutDef.unlockLevel;
      const upgradeCost = hut.owned ? Math.floor(hutDef.baseCost * (1 + hut.level * 0.5)) : 0;

      const card = document.createElement('div');
      card.className = `hut-card ${locked ? 'locked' : ''}`;

      card.innerHTML = `
        <div class="hut-header">
          <div class="hut-icon">${hutDef.icon}</div>
          <div class="hut-info">
            <div class="hut-name">${hutDef.name}</div>
            <div class="hut-level">${hut.owned ? `Level ${hut.level}` : `Odemknout: Level ${hutDef.unlockLevel}`}</div>
          </div>
        </div>

        ${hut.owned ? `
          <div class="hut-stats">
            <div class="hut-stat">
              <div class="hut-stat-label">Sloty</div>
              <div class="hut-stat-value">${hut.homeless.length}</div>
            </div>
            <div class="hut-stat">
              <div class="hut-stat-label">Příjem/s</div>
              <div class="hut-stat-value">${(hut.homeless.filter(h => h.working && h.workUntil > Date.now()).length * INCOME_PER_HOMELESS).toFixed(8)} 🚬</div>
            </div>
          </div>

          <div class="homeless-list">
            ${hut.homeless.map((h, i) => {
              const isWorking = h.working && h.workUntil > Date.now();
              const timeLeft = isWorking ? Math.ceil((h.workUntil - Date.now()) / 1000) : 0;
              const hours = Math.floor(timeLeft / 3600);
              const mins = Math.floor((timeLeft % 3600) / 60);
              
              return `
                <div class="homeless-slot ${isWorking ? 'working' : ''}" data-hut="${hutDef.id}" data-slot="${i}">
                  <div class="homeless-icon">🧑</div>
                  <div class="homeless-status">${isWorking ? 'PRACUJE' : 'LÍNÝ'}</div>
                  ${isWorking ? `<div class="homeless-timer">${hours}h ${mins}m</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>

          <div class="hut-actions">
            <button class="hut-btn" onclick="window.ChyseAPI.upgradeHut('${hutDef.id}')">
              ⬆️ VYLEPŠIT<br><small>${upgradeCost} 🚬</small>
            </button>
            <button class="hut-btn" onclick="window.ChyseAPI.kickAll('${hutDef.id}')">
              👟 KOPNOUT VŠECHNY
            </button>
          </div>
        ` : `
          <div class="hut-actions">
            <button class="hut-btn buy" onclick="window.ChyseAPI.buyHut('${hutDef.id}')" ${locked ? 'disabled' : ''}>
              ${locked ? `🔒 Level ${hutDef.unlockLevel}` : `💰 KOUPIT<br><small>${hutDef.baseCost} 🚬</small>`}
            </button>
          </div>
        `}
      `;

      container.appendChild(card);

      // Add click listeners for homeless slots
      if (hut.owned) {
        card.querySelectorAll('.homeless-slot').forEach(slot => {
          slot.addEventListener('click', () => {
            const hutId = slot.dataset.hut;
            const slotIndex = parseInt(slot.dataset.slot);
            kickHomeless(hutId, slotIndex);
          });
        });
      }
    });

    updateStatsDisplay();
  }

  function updateStatsDisplay() {
    const stats = getStats();
    
    const totalHutsEl = document.getElementById('totalHuts');
    if (totalHutsEl) totalHutsEl.textContent = stats.totalHuts;

    const activeHomelessEl = document.getElementById('activeHomeless');
    if (activeHomelessEl) activeHomelessEl.textContent = `${stats.activeHomeless} / ${stats.totalHomeless}`;

    const incomeEl = document.getElementById('incomePerSec');
    if (incomeEl) incomeEl.textContent = stats.incomePerSec.toFixed(8);
  }

  // ===== ANIMATIONS =====
  function showKickAnimation() {
    const overlay = document.createElement('div');
    overlay.className = 'kick-overlay';
    overlay.textContent = '👟💥';
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 600);
  }

  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      background: ${type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : type === 'error' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #f59e0b, #d97706)'};
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

  // ===== API =====
  window.ChyseAPI = {
    buyHut,
    upgradeHut,
    kickHomeless,
    kickAll: (hutId) => {
      const hut = state.huts[hutId];
      if (!hut || !hut.owned) return;
      
      let kicked = 0;
      hut.homeless.forEach((h, i) => {
        if (!h.working || h.workUntil <= Date.now()) {
          kickHomeless(hutId, i);
          kicked++;
        }
      });
      
      if (kicked > 0) {
        showNotification(`👟 Kopl jsi do ${kicked} bezdáků!`, 'success');
      } else {
        showNotification('⚠️ Všichni už pracují!', 'warn');
      }
    }
  };

  // ===== INITIALIZATION =====
  async function init() {
    console.log('🏚️ Initializing Chýše system...');

    // Wait for menu to load
    if (window.SFReady) await window.SFReady;

    // Initialize all huts
    HUTS.forEach(initHut);

    // Load saved state
    loadState();

    // Initial render
    render();

    // Income loop
    setInterval(() => {
      updateIncome();
      render();
    }, 1000);

    // Auto-save
    setInterval(saveState, SAVE_INTERVAL);

    console.log('✅ Chýše system ready!');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

console.log('🏚️ Chýše & Bezdáci loaded!');