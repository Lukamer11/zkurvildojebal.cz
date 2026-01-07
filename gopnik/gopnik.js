document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("pagehide", () => { 
    try{ pushToSF(); }catch{} 
  });

  const bgMusic = document.getElementById("bgMusic");
  const clickSnd = document.getElementById("clickSnd");

  const settingsModal = document.getElementById("settingsModal");
  const btnSettings = document.getElementById("btnSettings");
  const btnCloseSettings = document.getElementById("btnCloseSettings");
  const musicToggle = document.getElementById("musicToggle");
  const langSelect = document.getElementById("langSelect");
  const navSettings = document.getElementById("navSettings");

  const coinsEl = document.getElementById("money");
  const mushEl = document.getElementById("cigarettes");
  const levelEl = document.getElementById("levelDisplay");

  const btnCursor = document.getElementById("buyCursor");
  const btnGranny = document.getElementById("buyGranny");
  const btnClick = document.getElementById("buyClick");

  const moneyEl = document.getElementById("clickerMoney");
  const cpcEl = document.getElementById("clickerCpc");
  const cpsEl = document.getElementById("clickerCps");

  const comboEl = document.getElementById("combo");
  const critEl = document.getElementById("crit");
  const eventLine = document.getElementById("eventLine");

  const gopnikImg = document.getElementById("gopnikImg");
  const gopnikBtn = document.getElementById("gopnik");

  const spEl = document.getElementById("sp");
  const bonusEl = document.getElementById("bonus");
  const spGainEl = document.getElementById("spGain");
  const btnPrestige = document.getElementById("btnPrestige");

  // ===== BALANCE =====
  const CURSOR_COST = 25;
  const GRANNY_COST = 150;
  const CLICK_COST = 80;

  const CURSOR_GAIN_CPS = 0.2;
  const GRANNY_GAIN_CPS = 2.0;
  const CLICK_GAIN_CPC = 1;

  const PRESTIGE_MIN = 150000;
  const SP_BONUS_PER_POINT = 0.005;

  const COMBO_WINDOW_MS = 850;
  const COMBO_ADD = 0.04;
  const COMBO_MAX = 2.20;

  const CRIT_CHANCE = 0.10;
  const CRIT_MULT = 2.5;

  const EVENT_MIN_MS = 45000;
  const EVENT_MAX_MS = 90000;

  // ===== i18n =====
  const i18n = {
    cs: {
      settingsTitle: "Nastavení",
      music: "Hudba",
      lang: "Jazyk",
      moneyTitle: "PENÍZE",
      moneyLabel: "Peníze:",
      cpcLabel: "Za klik:",
      cpsLabel: "Za sekundu:",
      shopTitle: "OBCHOD",
      prestigeTitle: "PRESTIGE",
      cursor: "Kurzor",
      granny: "Babička",
      clickPower: "Síla kliku",
      buy: "Koupit",
      upgrade: "Vylepšit",
      prestigeHint: "Resetuje peníze a upgradey, ale dá trvalý bonus.",
      prestigeBtn: "Prestige (reset)",
      combo: "Combo:",
      crit: "Krit:",
      eventNone: "—",
      eventVodka: "Vodka Rush aktivní",
      eventRaid: "Police Raid aktivní",
      eventMarket: "Slav Market aktivní",
      prestigeConfirm: (gain) => `Prestige? Získáš ${gain} Slav Points.\nResetuje se peníze a upgradey.`
    },
    en: {
      settingsTitle: "Settings",
      music: "Music",
      lang: "Language",
      moneyTitle: "MONEY",
      moneyLabel: "Money:",
      cpcLabel: "Per click:",
      cpsLabel: "Per second:",
      shopTitle: "SHOP",
      prestigeTitle: "PRESTIGE",
      cursor: "Cursor",
      granny: "Grandma",
      clickPower: "Click power",
      buy: "Buy",
      upgrade: "Upgrade",
      prestigeHint: "Resets money and upgrades, but gives a permanent bonus.",
      prestigeBtn: "Prestige (reset)",
      combo: "Combo:",
      crit: "Crit:",
      eventNone: "—",
      eventVodka: "Vodka Rush active",
      eventRaid: "Police Raid active",
      eventMarket: "Slav Market active",
      prestigeConfirm: (gain) => `Prestige? You will gain ${gain} Slav Points.\nMoney and upgrades will reset.`
    }
  };

  const el = (id) => document.getElementById(id);
  let lang = localStorage.getItem("slavLang") || "cs";
  function t() { return i18n[lang] || i18n.cs; }

  // ===== MODAL =====
  function applyMusicEnabled(enabled) {
    localStorage.setItem("musicEnabled", enabled ? "1" : "0");
    if (!bgMusic) return;

    if (enabled) {
      bgMusic.muted = false;
      bgMusic.volume = 0.35;
      bgMusic.play().catch(() => {});
    } else {
      bgMusic.pause();
      bgMusic.currentTime = 0;
    }
  }

  function openSettings() {
    if (!settingsModal) return;
    settingsModal.classList.add("show");
    settingsModal.setAttribute("aria-hidden", "false");
  }

  function closeSettings() {
    if (!settingsModal) return;
    settingsModal.classList.remove("show");
    settingsModal.setAttribute("aria-hidden", "true");
  }

  btnSettings?.addEventListener("click", openSettings);
  navSettings?.addEventListener("click", openSettings);
  btnCloseSettings?.addEventListener("click", closeSettings);
  settingsModal?.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  // ===== GAME STATE =====
  let money = 0, cpc = 1, cps = 0;
  let mushrooms = 0;
  let slavPoints = 0;
  let combo = 1.0;
  let lastClickAt = 0;
  let activeEvent = null;
  let eventEndsAt = 0;
  let nextEventTimer = null;

  // ===== SF SYNC =====
  const SF = window.SF || null;

  function pullFromSF() {
    if (!SF) return;
    const st = SF.getStats();
    if (typeof st.money !== "undefined") money = Number(st.money) || 0;
    if (typeof st.cigarettes !== "undefined") mushrooms = Number(st.cigarettes) || 0;
  }

  function pushToSF() {
    if (!SF) return;
    const patch = {
      money: Math.floor(money),
      cigarettes: Math.floor(mushrooms)
    };
    SF.setStats(patch, { save: true, sync: true });
  }

  pullFromSF();

  function totalPrestigeMultiplier() {
    return 1 + (slavPoints * SP_BONUS_PER_POINT);
  }

  function calcPrestigeGain(currentMoney) {
    if (currentMoney < PRESTIGE_MIN) return 0;
    return Math.floor(Math.sqrt(currentMoney / PRESTIGE_MIN));
  }

  function isEventActive(name) {
    return activeEvent === name && Date.now() < eventEndsAt;
  }

  function clickEventMultiplier() {
    if (isEventActive("vodka")) return 1.25;
    if (isEventActive("raid")) return 1.6;
    return 1.0;
  }

  function cpsEventMultiplier() {
    if (isEventActive("raid")) return 0.75;
    return 1.0;
  }

  function shopDiscountMultiplier() {
    if (isEventActive("market")) return 0.80;
    return 1.0;
  }

  function effectiveCost(base) {
    return Math.ceil(base * shopDiscountMultiplier());
  }

  // ===== SAVE/LOAD =====
  function getSave() {
    return {
      version: 4,
      money,
      cpc,
      cps,
      mushrooms,
      slavPoints,
      updatedAt: Date.now()
    };
  }

  function applySave(d) {
    money = d?.money ?? 0;
    cpc = d?.cpc ?? 1;
    cps = d?.cps ?? 0;
    mushrooms = d?.mushrooms ?? 0;
    slavPoints = d?.slavPoints ?? 0;
  }

  function saveGame() {
    localStorage.setItem("slavClickerSave", JSON.stringify(getSave()));
  }

  function loadGame() {
    const s = localStorage.getItem("slavClickerSave");
    if (!s) return;
    try {
      applySave(JSON.parse(s));
    } catch {}
  }

  // ===== i18n APPLY =====
  function applyLang(newLang) {
    lang = newLang;
    localStorage.setItem("slavLang", lang);
    const tr = t();

    if (el("t_settingsTitle")) el("t_settingsTitle").textContent = tr.settingsTitle;
    if (el("t_musicLabel")) el("t_musicLabel").textContent = tr.music;
    if (el("t_langLabel")) el("t_langLabel").textContent = tr.lang;

    if (el("t_moneyTitle")) el("t_moneyTitle").textContent = tr.moneyTitle;
    if (el("t_moneyLabel")) el("t_moneyLabel").textContent = tr.moneyLabel;
    if (el("t_cpcLabel")) el("t_cpcLabel").textContent = tr.cpcLabel;
    if (el("t_cpsLabel")) el("t_cpsLabel").textContent = tr.cpsLabel;

    if (el("t_shopTitle")) el("t_shopTitle").textContent = tr.shopTitle;
    if (el("t_prestigeTitle")) el("t_prestigeTitle").textContent = tr.prestigeTitle;

    if (el("t_itemCursor")) el("t_itemCursor").textContent = tr.cursor;
    if (el("t_itemGranny")) el("t_itemGranny").textContent = tr.granny;
    if (el("t_itemClick")) el("t_itemClick").textContent = tr.clickPower;

    if (btnCursor) btnCursor.textContent = `${tr.buy} (${effectiveCost(CURSOR_COST)})`;
    if (btnGranny) btnGranny.textContent = `${tr.buy} (${effectiveCost(GRANNY_COST)})`;
    if (btnClick) btnClick.textContent = `${tr.upgrade} (${effectiveCost(CLICK_COST)})`;

    if (el("t_prestigeHint")) el("t_prestigeHint").textContent = tr.prestigeHint;
    if (btnPrestige) btnPrestige.textContent = tr.prestigeBtn;

    if (el("t_comboLabel")) el("t_comboLabel").textContent = tr.combo;
    if (el("t_critLabel")) el("t_critLabel").textContent = tr.crit;

    renderEventLine();
  }

  // ===== UI =====
  function renderEventLine() {
    const tr = t();
    if (!eventLine) return;

    if (activeEvent && Date.now() >= eventEndsAt) {
      activeEvent = null;
      eventEndsAt = 0;
    }

    if (!activeEvent) {
      eventLine.textContent = tr.eventNone;
      return;
    }

    const left = Math.max(0, Math.ceil((eventEndsAt - Date.now()) / 1000));
    let label = tr.eventNone;
    if (activeEvent === "vodka") label = tr.eventVodka;
    if (activeEvent === "raid") label = tr.eventRaid;
    if (activeEvent === "market") label = tr.eventMarket;

    eventLine.textContent = `${label}: ${left}s`;
  }

  function render() {
    const prestigeMult = totalPrestigeMultiplier();
    const cpsMult = prestigeMult * cpsEventMultiplier();

    if (moneyEl) moneyEl.textContent = Math.floor(money);

    const effClick = cpc * prestigeMult * combo * clickEventMultiplier();
    if (cpcEl) cpcEl.textContent = `${cpc} (≈ ${Math.floor(effClick)})`;

    const effCps = cps * cpsMult;
    if (cpsEl) cpsEl.textContent = effCps.toFixed(1);

    if (comboEl) comboEl.textContent = `x${combo.toFixed(2)}`;
    if (critEl) critEl.textContent = `${Math.round(CRIT_CHANCE * 100)}%`;
    renderEventLine();

    const cCost = effectiveCost(CURSOR_COST);
    const gCost = effectiveCost(GRANNY_COST);
    const kCost = effectiveCost(CLICK_COST);

    if (btnCursor) {
      btnCursor.disabled = money < cCost;
      btnCursor.textContent = `${t().buy} (${cCost})`;
    }
    if (btnGranny) {
      btnGranny.disabled = money < gCost;
      btnGranny.textContent = `${t().buy} (${gCost})`;
    }
    if (btnClick) {
      btnClick.disabled = money < kCost;
      btnClick.textContent = `${t().upgrade} (${kCost})`;
    }

    const gain = calcPrestigeGain(money);
    if (spEl) spEl.textContent = String(slavPoints);
    if (bonusEl) bonusEl.textContent = `+${Math.round((prestigeMult - 1) * 100)}%`;
    if (spGainEl) spGainEl.textContent = String(gain);
    if (btnPrestige) btnPrestige.disabled = gain <= 0;

    if (coinsEl) coinsEl.textContent = Math.floor(money).toLocaleString("en-US");
    if (mushEl) mushEl.textContent = Math.floor(mushrooms).toLocaleString("en-US");
    if (levelEl) levelEl.textContent = String(Math.max(1, Math.floor(1 + Math.log10(1 + money))));

    saveGame();
  }

  setInterval(pushToSF, 1500);

  // ===== PRESTIGE =====
  function doPrestige() {
    const gain = calcPrestigeGain(money);
    if (gain <= 0) return;

    const ok = confirm(t().prestigeConfirm(gain));
    if (!ok) return;

    slavPoints += gain;
    money = 0;
    cpc = 1;
    cps = 0;
    combo = 1.0;
    lastClickAt = 0;
    activeEvent = null;
    eventEndsAt = 0;

    render();
  }

  btnPrestige?.addEventListener("click", doPrestige);

  // ===== SHOP =====
  btnCursor?.addEventListener("click", () => {
    const cost = effectiveCost(CURSOR_COST);
    if (money < cost) return;
    money -= cost;
    cps += CURSOR_GAIN_CPS;
    render();
  });

  btnGranny?.addEventListener("click", () => {
    const cost = effectiveCost(GRANNY_COST);
    if (money < cost) return;
    money -= cost;
    cps += GRANNY_GAIN_CPS;
    render();
  });

  btnClick?.addEventListener("click", () => {
    const cost = effectiveCost(CLICK_COST);
    if (money < cost) return;
    money -= cost;
    cpc += CLICK_GAIN_CPC;
    render();
  });

  // ===== CLICK ANIMATION A ↔ B =====
  const imgs = ["gopnik_A.png", "gopnik_B.png"];
  let imgIndex = 0;

  function updateComboOnClick() {
    const now = Date.now();
    if (lastClickAt && (now - lastClickAt) <= COMBO_WINDOW_MS) {
      combo = Math.min(COMBO_MAX, combo + COMBO_ADD);
    } else {
      combo = 1.0;
    }
    lastClickAt = now;
  }

  function rollCrit() {
    return Math.random() < CRIT_CHANCE;
  }

  // Lepší ovládání na mobilu
  if (gopnikImg) {
    gopnikImg.style.userSelect = "none";
    gopnikImg.draggable = false;
  }

  // HLAVNÍ KLIKÁNÍ - TU JE ANIMACE A ↔ B
  gopnikBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    
    // Zvuk
    if (clickSnd) {
      clickSnd.currentTime = 0;
      clickSnd.play().catch(() => {});
    }

    updateComboOnClick();

    const prestigeMult = totalPrestigeMultiplier();
    let gain = Math.max(1, Math.floor(cpc * prestigeMult * combo * clickEventMultiplier()));

    if (rollCrit()) {
      gain = Math.floor(gain * CRIT_MULT);
      if (eventLine) {
        eventLine.textContent = `💥 KRIT! +${gain}`;
        setTimeout(() => renderEventLine(), 800);
      }
    }

    money += gain;

    // ✅ ANIMACE A ↔ B
    imgIndex = (imgIndex + 1) % imgs.length;
    if (gopnikImg) {
      gopnikImg.src = imgs[imgIndex];
    }

    // Bounce efekt
    if (gopnikImg) {
      gopnikImg.style.transform = "scale(1.08)";
      setTimeout(() => {
        gopnikImg.style.transform = "scale(1)";
      }, 80);
    }

    render();
  });

  // Combo decay
  setInterval(() => {
    if (!lastClickAt) return;
    const idle = Date.now() - lastClickAt;
    if (idle > COMBO_WINDOW_MS && combo !== 1.0) {
      combo = 1.0;
      render();
    }
  }, 250);

  // Passive income
  setInterval(() => {
    const prestigeMult = totalPrestigeMultiplier();
    const gain = cps * prestigeMult * cpsEventMultiplier();
    money += gain;
    render();
  }, 1000);

  // ===== EVENTS =====
  function scheduleNextEvent() {
    clearTimeout(nextEventTimer);
    const delay = EVENT_MIN_MS + Math.random() * (EVENT_MAX_MS - EVENT_MIN_MS);
    nextEventTimer = setTimeout(startRandomEvent, delay);
  }

  function startRandomEvent() {
    if (activeEvent && Date.now() < eventEndsAt) {
      scheduleNextEvent();
      return;
    }

    const pool = ["vodka", "raid", "market"];
    activeEvent = pool[Math.floor(Math.random() * pool.length)];

    let dur = 14;
    if (activeEvent === "raid") dur = 10;
    if (activeEvent === "market") dur = 18;

    eventEndsAt = Date.now() + dur * 1000;
    render();

    setTimeout(() => {
      if (Date.now() >= eventEndsAt) {
        activeEvent = null;
        eventEndsAt = 0;
        render();
      }
      scheduleNextEvent();
    }, (dur + 0.2) * 1000);
  }

  // ===== INIT =====
  const savedMusic = localStorage.getItem("musicEnabled");
  if (musicToggle) {
    musicToggle.checked = (savedMusic !== "0");
    if (!musicToggle.checked && bgMusic) {
      bgMusic.pause();
      bgMusic.currentTime = 0;
    }
  }

  musicToggle?.addEventListener("change", () => applyMusicEnabled(musicToggle.checked));
  langSelect?.addEventListener("change", () => applyLang(langSelect.value));

  if (langSelect) langSelect.value = lang;
  applyLang(lang);

  loadGame();
  render();
  scheduleNextEvent();
});