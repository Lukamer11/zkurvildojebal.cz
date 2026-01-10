(() => {
  "use strict";

  const img = document.getElementById("gopnikImg");
  const clickSnd = document.getElementById("clickSnd");

  const moneyEl = document.getElementById("clickerMoney");
  const cpcEl = document.getElementById("clickerCpc");
  const cpsEl = document.getElementById("clickerCps");

  const buyCursorBtn = document.getElementById("buyCursor");
  const buyGrannyBtn = document.getElementById("buyGranny");
  const buyClickBtn = document.getElementById("buyClick");

  let anim = false;
  let tick = null;

  const defaults = () => ({
    money: 0,
    cursor: 0,
    granny: 0,
    clickLevel: 0
  });

  function getState(stats) {
    const c = stats?.clicker;
    if (c && typeof c === "object") return { ...defaults(), ...c };
    return defaults();
  }

  function compute(state) {
    const cpc = 0.00001 + state.clickLevel * 0.00001;
    const cps = state.cursor * 0.00002 + state.granny * 0.0002;
    return { cpc, cps };
  }

  function fmt(n) {
    const x = Number(n ?? 0);
    if (!Number.isFinite(x)) return "0";
    if (Math.abs(x) < 1) return x.toFixed(6);
    return x.toLocaleString("cs-CZ", { maximumFractionDigits: 6 });
  }

  function render(stats) {
    const st = getState(stats);
    const { cpc, cps } = compute(st);
    if (moneyEl) moneyEl.textContent = fmt(st.money);
    if (cpcEl) cpcEl.textContent = fmt(cpc);
    if (cpsEl) cpsEl.textContent = fmt(cps);

    const cursorCost = 12.5 * Math.pow(1.15, st.cursor);
    const grannyCost = 75 * Math.pow(1.15, st.granny);
    const clickCost = 40 * Math.pow(1.15, st.clickLevel);

    if (buyCursorBtn) buyCursorBtn.textContent = `Koupit (${fmt(cursorCost)})`;
    if (buyGrannyBtn) buyGrannyBtn.textContent = `Koupit (${fmt(grannyCost)})`;
    if (buyClickBtn) buyClickBtn.textContent = `Vylepšit (${fmt(clickCost)})`;
  }

  async function addMoney(delta, energyCost) {
    if (window.SFReady) await window.SFReady;
    const stats = window.SF?.stats;
    if (!stats) return;

    const energy = Number(stats.energy ?? 0);
    if (energyCost > 0 && energy < energyCost) return;

    const st = getState(stats);
    st.money = Number(st.money) + Number(delta);

    const patch = { clicker: st };
    if (energyCost > 0) patch.energy = Math.max(0, energy - energyCost);

    window.SF.updateStats(patch);
  }

  async function onClick() {
    if (clickSnd) {
      try { clickSnd.currentTime = 0; } catch {}
      try { clickSnd.play(); } catch {}
    }

    // Animace má jít A -> B -> A -> B ... (v HTML startujeme na A)
    anim = !anim;
    if (img) img.src = anim ? "gopnik_B.png" : "gopnik_A.png";

    if (window.SFReady) await window.SFReady;
    const stats = window.SF?.stats;
    if (!stats) return;

    const st = getState(stats);
    const { cpc } = compute(st);
    // Nepoužívej desetinný energyCost – mnoho saveů/DB schémat má energy jako INT a
    // update by pak padal (a clicker vypadal "mrtvej").
    await addMoney(cpc, 0);
  }

  async function buy(kind) {
    if (window.SFReady) await window.SFReady;
    const stats = window.SF?.stats;
    if (!stats) return;

    const st = getState(stats);

    const cursorCost = 12.5 * Math.pow(1.15, st.cursor);
    const grannyCost = 75 * Math.pow(1.15, st.granny);
    const clickCost = 40 * Math.pow(1.15, st.clickLevel);

    let cost = 0;
    if (kind === "cursor") cost = cursorCost;
    if (kind === "granny") cost = grannyCost;
    if (kind === "click") cost = clickCost;

    if (st.money < cost) return;

    st.money = Number(st.money) - Number(cost);
    if (kind === "cursor") st.cursor += 1;
    if (kind === "granny") st.granny += 1;
    if (kind === "click") st.clickLevel += 1;

    window.SF.updateStats({ clicker: st });
  }

  async function tickLoop() {
    if (window.SFReady) await window.SFReady;
    const stats = window.SF?.stats;
    if (!stats) return;
    const st = getState(stats);
    const { cps } = compute(st);
    if (cps > 0) await addMoney(cps, 0);
  }

  function start() {
    document.addEventListener("sf:stats", (e) => render(e.detail));
    if (img) img.addEventListener("click", onClick);
    if (buyCursorBtn) buyCursorBtn.addEventListener("click", () => buy("cursor"));
    if (buyGrannyBtn) buyGrannyBtn.addEventListener("click", () => buy("granny"));
    if (buyClickBtn) buyClickBtn.addEventListener("click", () => buy("click"));
    if (tick) clearInterval(tick);
    tick = setInterval(tickLoop, 1000);
    if (window.SF?.stats) render(window.SF.stats);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
