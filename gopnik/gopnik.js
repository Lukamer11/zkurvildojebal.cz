// gopnik.js - Gopnik Clicker s správným sync přes menu.js

const supabaseClient = () => window.supabaseClient;

async function ensureOnline() {
  if (window.SFReady) await window.SFReady;
  const sb = supabaseClient();
  if (!sb) throw new Error('Supabase client není inicializovaný');
  return sb;
}

// ===== DOM ELEMENTS =====
let img = null;
let clickSnd = null;

const moneyEl = document.getElementById("clickerMoney");
const cpcEl = document.getElementById("clickerCpc");
const cpsEl = document.getElementById("clickerCps");

const buyCursorBtn = document.getElementById("buyCursor");
const buyGrannyBtn = document.getElementById("buyGranny");
const buyClickBtn = document.getElementById("buyClick");

const spEl = document.getElementById("sp");
const bonusEl = document.getElementById("bonus");
const spGainEl = document.getElementById("spGain");
const btnPrestige = document.getElementById("btnPrestige");

const comboEl = document.getElementById("combo");
const critEl = document.getElementById("crit");

// ===== GAME STATE =====
let gameState = {
  userId: null,
  clickerMoney: 0, // LOKÁLNÍ peníze pro clicker (odděleně od hlavních grošů)
  cursor: 0,
  granny: 0,
  clickLevel: 0,
  sp: 0,
  combo: 1.0,
  lastClickTime: 0
};

window.gameState = gameState;
window.animState = false;

let tick = null;
let saveTimer = null;

// ===== UTILITY FUNCTIONS =====
function fmt(n) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0";
  if (Math.abs(x) < 1) return x.toFixed(6);
  return x.toLocaleString("cs-CZ", { maximumFractionDigits: 2 });
}

function compute(state) {
  const prestigeBonus = 1 + (state.sp * 0.1);
  
  const baseCpc = 0.0000010 + state.clickLevel * 0.0000010;
  const cpc = baseCpc * prestigeBonus * state.combo;
  
  const baseCps = state.cursor * 0.0000002 + state.granny * 0.000002;
  const cps = baseCps * prestigeBonus;
  
  return { cpc, cps, prestigeBonus };
}

function calculateSPGain(money) {
  return Math.floor(money / 10000);
}

// ===== INIT =====
async function initUser() {
  try {
    await ensureOnline();
    const stats = window.SF?.stats;
    if (!stats?.user_id) {
      location.href = "login.html";
      return;
    }

    gameState.userId = stats.user_id;

    // Načti clicker data z stats
    const clickerData = stats.clicker || {};
    gameState.clickerMoney = clickerData.money || 0;
    gameState.cursor = clickerData.cursor || 0;
    gameState.granny = clickerData.granny || 0;
    gameState.clickLevel = clickerData.clickLevel || 0;
    gameState.sp = clickerData.sp || 0;
    gameState.combo = 1.0;
    gameState.lastClickTime = 0;

    render();
    console.log('✅ Gopnik Clicker loaded!', gameState);
  } catch (error) {
    console.error("Error initializing clicker:", error);
  }
}

// ===== SAVE - POUZE přes window.SF.updateStats() =====
function saveClickerData() {
  if (!window.SF?.updateStats) {
    console.error("❌ window.SF.updateStats není dostupné!");
    return;
  }

  // Ulož POUZE clicker data, NEDOTÝKEJ SE money/cigarettes/energy!
  window.SF.updateStats({
    clicker: {
      money: gameState.clickerMoney,
      cursor: gameState.cursor,
      granny: gameState.granny,
      clickLevel: gameState.clickLevel,
      sp: gameState.sp
    }
  });
}

function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveClickerData();
  }, 500);
}

// ===== RENDER =====
function render() {
  const { cpc, cps, prestigeBonus } = compute(gameState);
  
  if (moneyEl) moneyEl.textContent = fmt(gameState.clickerMoney);
  if (cpcEl) cpcEl.textContent = fmt(cpc);
  if (cpsEl) cpsEl.textContent = fmt(cps);

  if (spEl) spEl.textContent = fmt(gameState.sp);
  if (bonusEl) bonusEl.textContent = `+${((prestigeBonus - 1) * 100).toFixed(0)}%`;
  
  const spGain = calculateSPGain(gameState.clickerMoney);
  if (spGainEl) spGainEl.textContent = fmt(spGain);
  
  if (btnPrestige) {
    btnPrestige.disabled = spGain === 0;
  }

  if (comboEl) comboEl.textContent = `x${gameState.combo.toFixed(2)}`;
  if (critEl) critEl.textContent = "10%";

  // Shop buttons
  const cursorCost = 125 * Math.pow(1.15, gameState.cursor);
  const grannyCost = 750 * Math.pow(1.15, gameState.granny);
  const clickCost = 400 * Math.pow(1.15, gameState.clickLevel);

  if (buyCursorBtn) {
    buyCursorBtn.textContent = `Koupit (${fmt(cursorCost)})`;
    buyCursorBtn.disabled = gameState.clickerMoney < cursorCost;
  }
  
  if (buyGrannyBtn) {
    buyGrannyBtn.textContent = `Koupit (${fmt(grannyCost)})`;
    buyGrannyBtn.disabled = gameState.clickerMoney < grannyCost;
  }
  
  if (buyClickBtn) {
    buyClickBtn.textContent = `Vylepšit (${fmt(clickCost)})`;
    buyClickBtn.disabled = gameState.clickerMoney < clickCost;
  }
}

// ===== GAME ACTIONS =====
function onClick() {
  console.log('🖱️ CLICK! anim before:', window.animState);
  
  // Sound
  if (clickSnd) {
    try { 
      clickSnd.currentTime = 0;
      clickSnd.volume = 0.3;
      clickSnd.play(); 
    } catch {}
  }

  // Animation toggle
  window.animState = !window.animState;
  if (img) {
    const newSrc = window.animState ? "./gopnik_B.png" : "./gopnik_A.png";
    console.log('🖼️ Changing image to:', newSrc);
    img.src = newSrc;
  }

  // Combo system
  const now = Date.now();
  const timeSinceLastClick = now - gameState.lastClickTime;
  
  if (timeSinceLastClick < 500) {
    gameState.combo = Math.min(gameState.combo + 0.05, 3.0);
  } else if (timeSinceLastClick > 2000) {
    gameState.combo = 1.0;
  } else {
    gameState.combo = Math.max(gameState.combo - 0.02, 1.0);
  }
  
  gameState.lastClickTime = now;

  // Crit
  const critChance = 0.1;
  const isCrit = Math.random() < critChance;
  
  const { cpc } = compute(gameState);
  const finalCpc = isCrit ? cpc * 2 : cpc;
  
  gameState.clickerMoney += finalCpc;
  
  console.log('💰 Clicker Money:', gameState.clickerMoney, '| Combo:', gameState.combo.toFixed(2));
  
  render();
  debouncedSave();
}

function buy(kind) {
  const cursorCost = 125 * Math.pow(1.15, gameState.cursor);
  const grannyCost = 750 * Math.pow(1.15, gameState.granny);
  const clickCost = 400 * Math.pow(1.15, gameState.clickLevel);

  let cost = 0;
  if (kind === "cursor") cost = cursorCost;
  if (kind === "granny") cost = grannyCost;
  if (kind === "click") cost = clickCost;

  if (gameState.clickerMoney < cost) return;

  gameState.clickerMoney -= cost;
  
  if (kind === "cursor") gameState.cursor += 1;
  if (kind === "granny") gameState.granny += 1;
  if (kind === "click") gameState.clickLevel += 1;

  render();
  saveClickerData();
}

function doPrestige() {
  const spGain = calculateSPGain(gameState.clickerMoney);
  
  if (spGain === 0) {
    showNotification("Potřebuješ alespoň 10,000 peněz pro prestige!", "error");
    return;
  }

  const confirmed = confirm(
    `Opravdu chceš udělat PRESTIGE?\n\n` +
    `Získáš: ${spGain} Slav Points\n` +
    `Bonus: +${spGain * 10}% na vše\n\n` +
    `Ztratíš: všechny peníze a upgrady!`
  );

  if (!confirmed) return;

  // Reset všeho kromě SP
  gameState.sp += spGain;
  gameState.clickerMoney = 0;
  gameState.cursor = 0;
  gameState.granny = 0;
  gameState.clickLevel = 0;
  gameState.combo = 1.0;

  render();
  saveClickerData();
  
  showNotification(`🌟 PRESTIGE! Získal jsi ${spGain} Slav Points!`, "success");
}

// ===== PASSIVE INCOME =====
function tickLoop() {
  const { cps } = compute(gameState);
  
  if (cps > 0) {
    gameState.clickerMoney += cps;
    render();
    debouncedSave();
  }
}

// ===== NOTIFICATIONS =====
function showNotification(message, type) {
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

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎮 Initializing Gopnik Clicker...');
  
  img = document.getElementById("gopnikImg");
  clickSnd = document.getElementById("clickSnd");
  
  if (img) {
    img.style.pointerEvents = "auto";
    img.style.cursor = "pointer";
  }
  
  console.log('🖼️ Gopnik image:', img);
  console.log('🔊 Click sound:', clickSnd);
  
  await initUser();
  
  // Event listeners
  if (img) {
    img.onclick = onClick;
    console.log('✅ Click listener attached');
  } else {
    console.error('❌ Gopnik image not found!');
  }
  
  if (buyCursorBtn) buyCursorBtn.onclick = () => buy("cursor");
  if (buyGrannyBtn) buyGrannyBtn.onclick = () => buy("granny");
  if (buyClickBtn) buyClickBtn.onclick = () => buy("click");
  if (btnPrestige) btnPrestige.onclick = doPrestige;
  
  // Listen to stats updates from menu.js
  document.addEventListener("sf:stats", (e) => {
    const clickerData = e.detail?.clicker;
    if (clickerData) {
      gameState.clickerMoney = clickerData.money || 0;
      gameState.cursor = clickerData.cursor || 0;
      gameState.granny = clickerData.granny || 0;
      gameState.clickLevel = clickerData.clickLevel || 0;
      gameState.sp = clickerData.sp || 0;
      render();
    }
  });
  
  // Start passive income
  if (tick) clearInterval(tick);
  tick = setInterval(tickLoop, 1000);
  
  console.log('✅ Gopnik Clicker ready!');
});

// Auto-save
setInterval(() => {
  saveClickerData();
  console.log('💾 Clicker auto-save');
}, 10000);

// CSS
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

console.log('✅ Gopnik Clicker system loaded!');
