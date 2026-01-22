// shop.js - Part 1: Constants, State, Utilities

const supabaseClient = () => window.supabaseClient;
async function ensureOnline() {
  if (window.SFReady) await window.SFReady;
  const sb = supabaseClient();
  if (!sb) throw new Error('Supabase client není inicializovaný (načti menu.js před tímto skriptem)');
  return sb;
}

// ===== CONSTANTS =====
const INVENTORY_SIZE = 8;
// S&F vibe: shop se obměňuje pravidelně (rychleji než dřív)
const SHOP_ROTATION_HOURS = 1;
const ITEMS_PER_CATEGORY = 4;
const ITEM_LEVEL_SCALE = 0.08;
const ITEM_ROLL_MIN = 0.90;
const ITEM_ROLL_MAX = 1.15;
// Prodejní cena podle rarity (S&F feeling: lepší rarita = lepší výkup)
const SELL_MULT_BY_RARITY = { common:0.35, rare:0.40, epic:0.45, legendary:0.50 };
function getSellMultiplier(r){ return SELL_MULT_BY_RARITY[(r||'common')] ?? 0.35; }

// ===== STAT UPGRADES (stejné chování jako v postava.js) =====
const UPGRADE_COST_DISCOUNT = 0.80; // -20% sleva na upgrady

function calcUpgradeCost(statValue, level) {
  const v = Math.max(1, Number(statValue) || 1);
  const lvl = Math.max(1, Number(level) || 1);
  const core = Math.pow(v + 1, 1.55) * 3;
  const lvlTax = (lvl - 1) * 10;
  return Math.max(1, Math.floor(core + lvlTax + 20));
}

async function doUpgrade(stat) {
  try {
    if (window.SFReady) await window.SFReady;
    if (!ALLOWED_STATS.includes(stat)) return;

    const row = window.SF?.stats;
    if (!row) return;

    const money = Number(row.money ?? 0);
    const level = Number(row.level ?? 1);
    const statsObj = { ...(row.stats || {}) };
    const costs = { ...(row.upgrade_costs || {}) };

    const currentVal = Number(statsObj[stat] ?? 10);
    const currentCost = Number(costs[stat] ?? calcUpgradeCost(currentVal, level));
    const discountedCost = Math.max(1, Math.ceil(currentCost * UPGRADE_COST_DISCOUNT));

    if (money < discountedCost) {
      showNotification('Nemáš dost peněz!', 'error');
      return;
    }

    // 1 klik = +1
    const newVal = Math.max(1, Math.round((currentVal + 1) * 100) / 100);
    const newCost = calcUpgradeCost(newVal, level);

    statsObj[stat] = newVal;
    costs[stat] = newCost;

    // uložit přes SF (menu.js drží supabase sync)
    if (window.SF && typeof window.SF.updateStats === 'function') {
      await window.SF.updateStats({
        money: money - discountedCost,
        stats: statsObj,
        upgrade_costs: costs,
        level
      });
    }

    await syncFromServer();
    updateUI();
    renderCharacterStats();
    showNotification(`+1 ${stat}!`, 'success');
  } catch (e) {
    console.error('Upgrade error:', e);
    showNotification('Chyba při upgradu!', 'error');
  }
}

// Sloty výbavy (stejně jako postava.html)
const EQUIP_SLOTS = [
  "weapon","shield","ring","backpack",
  "trinket1","trinket2","trinket3","trinket4",
  "helmet","armor","boots","gloves"
];

// Inventář držíme jako FIXNÍ pole o délce INVENTORY_SIZE (s null pro prázdné sloty)
// -> dovolí přesouvat itemy do libovolného slotu a hlavně to drží indexy stabilní.
function normalizeInventory(inv) {
  const arr = Array.isArray(inv) ? inv.slice(0, INVENTORY_SIZE) : [];
  while (arr.length < INVENTORY_SIZE) arr.push(null);
  return arr.map(x => (x === undefined ? null : x));
}

// Ujisti se, že equipped má všechny sloty (i nové trinkety)
function normalizeEquipped(eq){
  const src = (eq && typeof eq === 'object') ? eq : {};
  const out = {};
  for (const s of EQUIP_SLOTS) out[s] = (s in src) ? src[s] : null;
  return out;
}

// ===== CLASS ICONS (jako v postava.html) =====
const CLASS_ICONS = {
  // třídy z vyber.html
  padouch: '👻',
  rvac:    '✊',
  mozek:   '💡',

  // případné další (legacy)
  warrior: '⚔️',
  mage: '🔮',
  rogue: '🗡️',
  tank: '🛡️',
  archer: '🏹',
  paladin: '✨',
  necromancer: '💀',
  druid: '🌿'
};

// ===== GAME STATE =====
let gameState = {
  userId: null,
  level: 1,
  xp: 0,
  money: 3170,
  cigarettes: 42,
  stats: {
    strength: 18,
    defense: 14,
    constitution: 16,
    luck: 9,
    player_class: null,
    character_name: null,
    avatar_url: null
  },
  inventory: [],
  equipped: {
    weapon: null,
    shield: null,
    ring: null,
    backpack: null,
    trinket1: null,
    trinket2: null,
    trinket3: null,
    trinket4: null,
    helmet: null,
    armor: null,
    boots: null,
    gloves: null
  },
  lastShopRotation: null,
  currentShopItems: {
    weapons: [],
    armor: [],
    special: []
  }
};

let currentCategory = 'weapons';
let draggedItem = null;
let dragSource = null;

// ===== SYNC FROM SERVER (jako v mail.js) =====
async function syncFromServer() {
  if (window.SFReady) await window.SFReady;
  const stats = window.SF?.stats;
  if (!stats) return;

  // Synchronizuj všechny relevantní hodnoty
  gameState.level = stats.level ?? gameState.level;
  gameState.xp = stats.xp ?? gameState.xp;
  gameState.money = stats.money ?? gameState.money;
  gameState.cigarettes = stats.cigarettes ?? gameState.cigarettes;
  
  // Stats obsahující třídu, jméno, avatar
  if (stats.stats) {
    gameState.stats = { ...gameState.stats, ...stats.stats };
  }
  
  gameState.inventory = normalizeInventory(stats.inventory || gameState.inventory || []);
  gameState.equipped = normalizeEquipped(stats.equipped || gameState.equipped);
  gameState.lastShopRotation = stats.last_shop_rotation || stats.lastShopRotation || gameState.lastShopRotation;
  gameState.currentShopItems = stats.current_shop_items || stats.currentShopItems || gameState.currentShopItems;

  updateUI();
  updateClassBadge();
}

// Poslouchej změny ze serveru (jako v mail.js)
document.addEventListener('sf:stats', async (e) => {
  await syncFromServer();
});

// ===== SAFE STATS =====
// S&F styl: 6 core statů
const ALLOWED_STATS = ['strength','defense','constitution','luck'];

function sanitizeStats(input) {
  const src = (input && typeof input === 'object') ? input : {};
  const out = {};
  for (const k of ALLOWED_STATS) {
    const v = Number(src[k]);
    out[k] = Number.isFinite(v) ? v : 0;
  }
  // Zachovat ostatní stats (player_class, character_name, avatar_url)
  if (src.player_class) out.player_class = src.player_class;
  if (src.character_name) out.character_name = src.character_name;
  if (src.avatar_url) out.avatar_url = src.avatar_url;
  if (src.avatar_frame) out.avatar_frame = src.avatar_frame;
  if (src.avatar_color) out.avatar_color = src.avatar_color;
  return out;
}

function formatStatValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  const s = String(rounded);
  return s.includes('.') ? rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1') : s;
}

// ===== S&F-ish: score/compare helpery pro itemy =====
function getItemBonusesSafe(item) {
  const b = (item && typeof item === 'object' && item.bonuses && typeof item.bonuses === 'object') ? item.bonuses : {};
  return {
    strength: Number(b.strength || 0),
    defense: Number(b.defense || 0),
    constitution: Number(b.constitution || 0),
    luck: Number(b.luck || 0)
  };
}

function getItemBonusDiff(newItem, oldItem) {
  const a = getItemBonusesSafe(newItem);
  const b = getItemBonusesSafe(oldItem);
  return {
    strength: Math.round((a.strength - b.strength) * 100) / 100,
    defense: Math.round((a.defense - b.defense) * 100) / 100,
    constitution: Math.round((a.constitution - b.constitution) * 100) / 100,
    luck: Math.round((a.luck - b.luck) * 100) / 100
  };
}


function getItemScore(item, cls) {
  const b = getItemBonusesSafe(item);
  // Bez DEX/INT: jednoduchý S&F-like score
  const score =
    (b.strength || 0) * 2.0 +
    (b.defense || 0) * 1.6 +
    (b.constitution || 0) * 1.4 +
    (b.luck || 0) * 0.9;
  return Math.round(score * 10) / 10;
}


// ===== UTILITY FUNCTIONS =====
function getRequiredXP(level) {
  const lvl = Math.max(1, Number(level) || 1);
  // S&F-like: rychlý start, pak výrazně roste (next level requirement)
  return Math.floor(50 * Math.pow(lvl, 1.7));
}

function getAllItems() {
  return [
    ...window.SHOP_ITEMS.weapons,
    ...window.SHOP_ITEMS.armor,
    ...window.SHOP_ITEMS.special
  ];
}

// ===== DAILY SALE (vizuál "SALE" podobně jako na jiných stránkách) =====
function sfTodayKey(){
  try{
    const d = new Date();
    // YYYY-MM-DD (lokálně)
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }catch{ return 'unknown'; }
}

function sfGetDailySaleMap(){
  const key = `sf_daily_sale_${sfTodayKey()}`;
  try{
    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached) || {};
  }catch{}

  // vygeneruj 3 náhodné itemy se slevou -20%
  const all = getAllItems().map(i => i.id).filter(Boolean);
  const map = {};
  let picks = 0;
  for (let guard=0; guard<200 && picks<3; guard++){
    const id = all[Math.floor(Math.random()*all.length)];
    if (!id || map[id]) continue;
    map[id] = 20;
    picks++;
  }
  try{ localStorage.setItem(key, JSON.stringify(map)); }catch{}
  return map;
}

function sfGetSalePercentFor(item){
  const baseId = item?.id || item?.instance_id || null;
  if (!baseId) return 0;
  const map = sfGetDailySaleMap();
  return Number(map[baseId] || 0) || 0;
}

function sfGetEffectivePrice(item){
  const price = Number(item?.price || 0);
  const pct = sfGetSalePercentFor(item);
  if (pct <= 0) return price;
  return Math.max(0, Math.floor(price * (1 - (pct/100))));
}

function renderItemIconHTML(icon, alt) {
  const safeAlt = String(alt || 'item').replace(/"/g, '&quot;');
  const ic = icon == null ? '' : String(icon);

  const isImage =
    /^data:image\//i.test(ic) ||
    /^https?:\/\//i.test(ic) ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(ic);

  if (isImage) return `<img src="${ic}" alt="${safeAlt}">`;
  return ic ? ic : '❓';
}

function getItemById(itemRef) {
  if (typeof itemRef === 'object' && itemRef !== null) {
    return itemRef;
  }

  const ALIASES = {
    knife: 'nuz',
    tactical_knife: 'nuz',
    takticky_nuz: 'nuz',
    'takticky-nuz': 'nuz',
  };
  const normId = ALIASES[String(itemRef)] || itemRef;
  
  const allShop = [
    ...(gameState.currentShopItems?.weapons || []),
    ...(gameState.currentShopItems?.armor || []),
    ...(gameState.currentShopItems?.special || [])
  ];
  const foundInst = allShop.find(i => i.instance_id === normId || i.id === normId);
  if (foundInst) return foundInst;

  const foundInv = (gameState.inventory || []).find(i => {
    if (!i) return false;
    if (typeof i === 'object') return i.instance_id === normId || i.id === normId;
    return i === normId;
  });
  if (foundInv) return foundInv;

  return getAllItems().find(item => item.id === normId);
}

function makeItemInstance(baseItem, level){
  const lvl = Math.max(1, Number(level) || 1);

  // ===== S&F-like rarity roll =====
  // common 70%, rare 22%, epic 7%, legendary 1% (lehce roste s levelem)
  const bonusP = Math.min(0.06, lvl / 2000);
  // Luck lehce posouvá šanci na lepší raritu (diminishing returns)
  const luckRaw = Number(gameState?.stats?.luck ?? gameState?.luck ?? 0);
  const luck = Number.isFinite(luckRaw) ? Math.max(0, luckRaw) : 0;
  const luckFactor = luck / (luck + 300); // 0..~1

  let pLegend = 0.01 + bonusP * 0.35;
  let pEpic   = 0.07 + bonusP * 0.45;
  let pRare   = 0.22 + bonusP * 0.20;

  // max ~ +25% legend, +20% epic, +10% rare
  pLegend *= (1 + 0.25 * luckFactor);
  pEpic   *= (1 + 0.20 * luckFactor);
  pRare   *= (1 + 0.10 * luckFactor);

  // Ohlídej, ať se součet nepřehoupne přes 0.65 (common musí zůstat nejčastější)
  const sum = pLegend + pEpic + pRare;
  const maxSum = 0.65;
  if (sum > maxSum) {
    const k = maxSum / sum;
    pLegend *= k;
    pEpic   *= k;
    pRare   *= k;
  }

  const rr = Math.random();
  let rarity = 'common';
  if (rr < pLegend) rarity = 'legendary';
  else if (rr < pLegend + pEpic) rarity = 'epic';
  else if (rr < pLegend + pEpic + pRare) rarity = 'rare';

  const RARITY_MULT = { common:1.00, rare:1.30, epic:1.70, legendary:2.20 };
  const rarityMult = RARITY_MULT[rarity] || 1;

  // ===== Roll + level scaling =====
  const roll = ITEM_ROLL_MIN + Math.random() * (ITEM_ROLL_MAX - ITEM_ROLL_MIN);
  const scale = 1 + (lvl - 1) * ITEM_LEVEL_SCALE;

  const inst = JSON.parse(JSON.stringify(baseItem));
  inst.instance_id = 'it_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  inst.base_id = baseItem.id;
  inst.rarity = rarity;

  // požadovaný level (aby se neobjevovalo "OP" vybavení pro nízký lvl)
  // Požadovaný level: většinou okolo tvého levelu (aby shop nebyl ani OP ani mrtvý)
  inst.req_level = Math.max(1, Math.round(lvl * 0.92));

  // ===== Bonusy: škálování + zachování záporných hodnot =====
  if (inst.bonuses) {
    for (const stat of Object.keys(inst.bonuses)) {
      const base = Number(inst.bonuses[stat]);
      const b = Number.isFinite(base) ? base : 0;
      const scaled = b * scale * roll * rarityMult;
      // S&F feeling: cap per-stat podle levelu, ať se to neutrhne
      const cap = (lvl * 3 + 25) * rarityMult;
      const clamped = Math.max(-cap, Math.min(cap, scaled));
      inst.bonuses[stat] = Math.round(clamped);
    }
  }

  // ===== Cena: roste s levelem + raritou =====
  const basePrice = Number(baseItem.price || 0);
  // Cena: S&F vibe – roste hlavně s levelem a raritou, roll jen lehce
  const lvlPrice = 1 + (lvl - 1) * 0.12;
  const rollPrice = 0.95 + (roll - ITEM_ROLL_MIN) * 0.35;
  inst.price = Math.max(1, Math.floor(basePrice * lvlPrice * rarityMult * rollPrice));

  inst.level_roll = lvl;
  return inst;
}

function calculateStatBonus(stat, value, level, cls) {
  const v = Number(value);
  const val = Number.isFinite(v) ? v : 0;
  switch(stat) {
    case 'strength':
      return `+${Math.round(val * 2)}% DMG`;
    case 'defense':
      {
        const red = (window.SF && window.SF.getDefenseReductionPercent)
          ? window.SF.getDefenseReductionPercent(val, level, cls)
          : Math.min(75, Math.floor((val / (140 + Math.max(1, level) * 18)) * 100));
        return `${red}% Redukce`;
      }
    case 'constitution':
      {
        const lvl = Math.max(1, Number(level) || 1);
        const hp = Math.round(200 + lvl * 35 + val * 10);
        return `${hp} HP`;
      }
    case 'luck':
      {
        const critPct = Math.max(0, Math.min(50, Math.round(val * 0.25)));
        return `+${critPct}% Crit`;
      }
    default:
      return '';
  }
}

// ===== CLASS BADGE UPDATE (jako v postava.html) =====
function updateClassBadge() {
  const classBadge = document.getElementById('classBadge');
  // V shopu se stats často načítají async přes menu.js (window.SFReady).
  // Ber třídu robustně, ať nezmizí na "?".
  let playerClass = (gameState.stats?.player_class || null);
  try {
    const sfStats = window.SF?.stats?.stats;
    if (!playerClass && sfStats) {
      if (typeof sfStats === 'string') {
        try { playerClass = JSON.parse(sfStats)?.player_class || null; } catch {}
      } else {
        playerClass = sfStats.player_class || null;
      }
    }
  } catch {}
  playerClass = playerClass ? String(playerClass).toLowerCase() : null;
  
  if (classBadge) {
    // Vždy ukaž badge (neskrývej) – když nevíme, nech ❓
    if (playerClass && CLASS_ICONS[playerClass]) {
      classBadge.textContent = CLASS_ICONS[playerClass];
    } else {
      classBadge.textContent = '❓';
    }
    classBadge.style.display = 'flex';
  }

  // pokud je dostupný globální badge systém z menu.js, doplň i overlay na avatar box
  try { window.SFEnsureAvatarBadge && window.SFEnsureAvatarBadge(); } catch {}
  
  // Update character name
  const characterName = document.getElementById('characterName');
  if (characterName && gameState.stats?.character_name) {
    characterName.textContent = gameState.stats.character_name;
  }
  
  // Update avatar image
  const avatarImg = document.getElementById('avatarImg');
  if (avatarImg && gameState.stats?.avatar_url) {
    avatarImg.src = gameState.stats.avatar_url;
  }
}

// ===== SHOP ROTATION SYSTEM =====
function shouldRotateShop() {
  if (!gameState.lastShopRotation) return true;
  
  const now = Date.now();
  const lastRotation = new Date(gameState.lastShopRotation).getTime();
  const hoursPassed = (now - lastRotation) / (1000 * 60 * 60);
  
  return hoursPassed >= SHOP_ROTATION_HOURS;
}

function getRandomItems(items, count) {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, items.length));
}

function rotateShopItems() {
  console.log('🔄 Rotace itemů v shopu...');
  
  gameState.currentShopItems = {
    weapons: getRandomItems(window.SHOP_ITEMS.weapons, ITEMS_PER_CATEGORY).map(it => makeItemInstance(it, gameState.level)),
    armor: getRandomItems(window.SHOP_ITEMS.armor, ITEMS_PER_CATEGORY).map(it => makeItemInstance(it, gameState.level)),
    special: getRandomItems(window.SHOP_ITEMS.special, ITEMS_PER_CATEGORY).map(it => makeItemInstance(it, gameState.level))
  };
  
  gameState.lastShopRotation = new Date().toISOString();
  
  console.log('✅ Nové itemy:', gameState.currentShopItems);
}

function getTimeUntilNextRotation() {
  if (!gameState.lastShopRotation) return '0:00:00';
  
  const now = Date.now();
  const lastRotation = new Date(gameState.lastShopRotation).getTime();
  const nextRotation = lastRotation + (SHOP_ROTATION_HOURS * 60 * 60 * 1000);
  const remaining = Math.max(0, nextRotation - now);
  
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ===== SUPABASE FUNCTIONS =====
async function initUser() {
  try {
    const sb = await ensureOnline();
    const userId = window.SF?.user?.id || window.SF?.stats?.user_id;
    if (!userId) {
      location.href = "login.html";
      return;
    }

    gameState.userId = userId;

    const { data, error } = await sb
      .from("player_stats")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error loading from Supabase:", error);
      throw error;
    }

    if (data) {
      gameState.level = data.level || 1;
      gameState.xp = data.xp || 0;
      gameState.money = data.money ?? gameState.money;
      gameState.cigarettes = data.cigarettes ?? gameState.cigarettes;
      gameState.stats = sanitizeStats(data.stats ?? gameState.stats);
      gameState.inventory = normalizeInventory(data.inventory || []);
      gameState.equipped = normalizeEquipped(data.equipped || gameState.equipped);
      gameState.lastShopRotation = data.last_shop_rotation ?? data.lastShopRotation ?? null;
      gameState.currentShopItems = data.current_shop_items || data.currentShopItems || gameState.currentShopItems;

      // ===== MIGRACE STARÝCH SAVŮ =====
      const allBase = getAllItems();
      const toInstance = (ref) => {
        if (!ref) return null;
        if (typeof ref === 'object') return ref;
        const id = String(ref);
        const base = allBase.find(it => it.id === id);
        if (!base) return null;
        const inst = JSON.parse(JSON.stringify(base));
        inst.instance_id = id;
        inst.base_id = base.id;
        inst.level_roll = gameState.level;
        return inst;
      };

      gameState.inventory = normalizeInventory((gameState.inventory || []).map(x => toInstance(x) || x));
      const eq = gameState.equipped || {};
      Object.keys(eq).forEach(k => {
        if (typeof eq[k] === 'string') {
          eq[k] = toInstance(eq[k]) || null;
        }
      });
      gameState.equipped = normalizeEquipped(eq);
    } else {
      rotateShopItems();
      await saveToSupabase();
    }

    if (shouldRotateShop()) {
      rotateShopItems();
      await saveToSupabase();
      showNotification("🔄 Shop se obnovil!", "success");
    }
  } catch (error) {
    console.error("❌ Error initializing user:", error);
    showNotification("Chyba při načítání hry", "error");
  }
}

async function saveToSupabase() {
  try {
    const sb = await ensureOnline();

    const basePayload = {
      user_id: gameState.userId,
      level: gameState.level,
      xp: gameState.xp,
      money: gameState.money,
      cigarettes: gameState.cigarettes,
      stats: sanitizeStats(gameState.stats),
      inventory: gameState.inventory,
      equipped: gameState.equipped,
      last_shop_rotation: gameState.lastShopRotation,
      current_shop_items: gameState.currentShopItems
    };

    let payload = { ...basePayload };

    for (let attempts = 0; attempts < 6; attempts++) {
      const { error } = await sb.from("player_stats").upsert(payload, { onConflict: "user_id" });
      if (!error) return true;

      const msg = String(error?.message || "");
      const match = msg.match(/Could not find the '([^']+)' column/);
      if (error?.code === "PGRST204" && match) {
        const missing = match[1];
        if (missing in payload) {
          delete payload[missing];
          continue;
        }
      }
      throw error;
    }
    return false;
  } catch (error) {
    console.error("❌ Error saving to Supabase:", error);
    return false;
  }
}

// ===== TOOLTIP SYSTEM =====
let tooltip = null;
let sfTooltipTimer = null;
let sfLastMouse = {x:0,y:0};
function sfGetTooltipDelayMs(){
  try { return parseInt(localStorage.getItem('sf_tooltip_delay')||'200',10)||0; } catch { return 200; }
}


function createTooltip() {
  tooltip = document.createElement('div');
  tooltip.className = 'item-tooltip';
  document.body.appendChild(tooltip);
}

function showTooltip(item, x, y) {
  if (!tooltip) createTooltip();
  
  let bonusesHTML = '';
  if (item.bonuses) {
    bonusesHTML = '<div style="margin-top: 10px; padding-top: 10px; border-top: 2px solid rgba(201,164,74,0.3);">';
    Object.keys(item.bonuses).forEach(stat => {
      const value = item.bonuses[stat];
      const color = value > 0 ? '#4af' : '#f44';
      const sign = value > 0 ? '+' : '';
      const statNames = {
        strength: '⚔️ Síla',
        defense: '🛡️ Obrana',
        constitution: '💪 Výdrž',
        luck: '🍀 Štěstí'
      };
      bonusesHTML += `<div style="color: ${color}; font-weight: 900; font-size: 13px; margin: 3px 0;">${statNames[stat]}: ${sign}${value}</div>`;
    });
    bonusesHTML += '</div>';
  }
  
  const mult = getSellMultiplier(item.rarity);
  const sellPrice = Math.floor((item.price || 0) * mult);

  // ===== S&F vibe: porovnani s nasazenym itemem ve stejnem slotu =====
  const cls = (gameState.stats?.player_class ? String(gameState.stats.player_class).toLowerCase() : 'padouch');
  const slotName = item.slot;
  let compareHTML = '';
  if (slotName && gameState?.equipped && gameState.equipped[slotName]) {
    const equippedItem = getItemById(gameState.equipped[slotName]);
    if (equippedItem) {
      const diff = getItemBonusDiff(item, equippedItem);
      const scoreNew = getItemScore(item, cls);
      const scoreOld = getItemScore(equippedItem, cls);
      const delta = Math.round((scoreNew - scoreOld) * 10) / 10;
      const dColor = delta >= 0 ? '#4af' : '#ff6b6b';

      let rows = '';
      Object.keys(diff).forEach(stat => {
        const v = diff[stat];
        if (!v) return;
        const color = v > 0 ? '#4af' : '#ff6b6b';
        const sign = v > 0 ? '+' : '';
        const statNames = {
          strength: '⚔️ Síla',
          defense: '🛡️ Obrana',
          constitution: '💪 Výdrž',
          luck: '🍀 Štěstí'
        };
        rows += `<div style="color:${color}; font-weight:900; font-size:12px; margin:2px 0;">${statNames[stat]}: ${sign}${v}</div>`;
      });

      compareHTML = `
        <div style="margin-top:10px; padding-top:10px; border-top:2px solid rgba(201,164,74,0.3);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div style="font-size:12px; font-weight:900; color:#c9a44a;">Porovnani (vs nasazeno)</div>
            <div style="font-size:12px; font-weight:900; color:${dColor};">${delta >= 0 ? '▲' : '▼'} ${delta}</div>
          </div>
          <div style="margin-top:6px;">${rows || '<div style="color:#9bd; font-size:12px;">Bez rozdilu ve statech</div>'}</div>
          <div style="margin-top:6px; font-size:11px; color:#9bd;">Nasazeno: ${equippedItem.icon} ${equippedItem.name}</div>
        </div>
      `;
    }
  }
  
  const rarityLabel = ({common:'⚪ Common',uncommon:'🟢 Uncommon',rare:'🔵 Rare',epic:'🟣 Epic',legendary:'🟠 Legendary'}[item.rarity]||'⚪ Common');
  tooltip.innerHTML = `
    <div class="tt-head">
      <div class="tt-title">${item.icon}<span class="tt-name">${item.name}</span></div>
      <div class="tt-sub">
        <span class="tt-pill tt-rarity tt-rarity--${item.rarity || 'common'}">${rarityLabel}</span>
        <span class="tt-pill tt-req">Min. lvl: ${item.req_level || 1}</span>
      </div>
    </div>
    ${item.description ? `<div class="tt-desc">${item.description}</div>` : ''}
    <div class="tt-price-row">
      <div class="tt-price">💰 ${item.price}🪙</div>
      <div class="tt-sell">Prodej: ${sellPrice}🪙 (${Math.round(mult*100)}%)</div>
    </div>
    ${bonusesHTML ? `<div class="tt-section">${bonusesHTML}</div>` : ''}
    ${compareHTML ? `<div class="tt-section">${compareHTML}</div>` : ''}
  `;
  
  tooltip.style.display = 'block';
  tooltip.style.left = (x + 20) + 'px';
  tooltip.style.top = (y - tooltip.offsetHeight / 2) + 'px';
}

function hideTooltip() {
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

// ===== PAID REROLL (NAHRADIT) =====
async function paidRerollShop() {
  try {
    const rerollCost = Math.min(50, 5 + Math.floor((gameState.level||1)/5));
    if (gameState.cigarettes < rerollCost) {
      showNotification(`Nemáš ${rerollCost} cigaret!`, 'error');
      return;
    }

    gameState.cigarettes -= rerollCost;
    rotateShopItems();
    gameState.lastShopRotation = new Date().toISOString();

    const saved = await saveToSupabase();
    if (!saved) {
      gameState.cigarettes += rerollCost;
      showNotification('Chyba při ukládání (reroll zrušen).', 'error');
      return;
    }

    updateUI();
    showNotification(`🎲 Itemy nahrazeny! (-${rerollCost}🚬)`, 'success');
  } catch (e) {
    console.error(e);
    showNotification('Chyba při nahrazení itemů', 'error');
  }
}

// ===== UI RENDERING =====
function renderShopItems() {
  const shopGrid = document.getElementById('shopGrid');
  const items = gameState.currentShopItems[currentCategory] || [];
  
  if (!shopGrid) return;
  
  const cls = (gameState.stats?.player_class ? String(gameState.stats.player_class).toLowerCase() : 'padouch');

  shopGrid.innerHTML = items.map(item => {
    const itemId = item.instance_id || item.id;
    const iconHTML = renderItemIconHTML(item.icon, item.name);
    const rarity = (item.rarity || 'common');
    const rarityLabel = ({
      common: 'COMMON',
      uncommon: 'UNCOMMON',
      rare: 'RARE',
      epic: 'EPIC',
      legendary: 'LEGEND'
    }[rarity] || 'COMMON');

    // S&F feeling: rychly indikator jestli je item lepsi/horsi nez nasazeny ve stejnem slotu
    let cmpClass = '';
    let cmpBadge = '';
    const slotName = item.slot;
    if (slotName && gameState?.equipped && gameState.equipped[slotName]) {
      const eq = getItemById(gameState.equipped[slotName]);
      if (eq) {
        const delta = getItemScore(item, cls) - getItemScore(eq, cls);
        if (delta > 0.1) { cmpClass = ' better'; cmpBadge = '<div class="cmp-badge better">▲ LEPŠÍ</div>'; }
        else if (delta < -0.1) { cmpClass = ' worse'; cmpBadge = '<div class="cmp-badge worse">▼ HORŠÍ</div>'; }
        else { cmpClass = ' equal'; cmpBadge = '<div class="cmp-badge equal">≈ STEJNÉ</div>'; }
      }
    }

    const salePct = sfGetSalePercentFor(item);
    const effPrice = sfGetEffectivePrice(item);
    const saleClass = salePct > 0 ? ' on-sale' : '';
    const saleBadge = salePct > 0 ? `🔥 SALE -${salePct}%` : '';
    const priceHTML = salePct > 0
      ? `<span class="price-old">${item.price}🪙</span><span class="price">${effPrice}🪙</span>`
      : `<span class="price">${item.price}🪙</span>`;

    return `
      <div class="shop-item rarity-${rarity}${cmpClass}${saleClass}" data-sale-badge="${saleBadge}" data-item-id="${itemId}" data-rarity="${rarity}" data-rarity-label="${rarityLabel}">
        <div class="rarity-badge rarity-${rarity}">${rarityLabel}</div>
        ${cmpBadge}
        <div class="item-icon">
          ${iconHTML}
        </div>
        <div class="item-details">
          <h3>${item.name}</h3>
          <p class="item-desc">${item.description}</p>
          <div class="item-price">
            ${priceHTML}
            <button class="buy-btn" onclick="buyItem('${itemId}')" ${gameState.level < Number(item.req_level || 1) ? 'disabled title="Nízký level"' : ''}>
              ${gameState.level < Number(item.req_level || 1) ? 'LOCK' : 'KOUPIT'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add tooltip listeners
  document.querySelectorAll('.shop-item').forEach(itemEl => {
    const itemId = itemEl.dataset.itemId;
    const item = getItemById(itemId);
    
    if (!item) return;
    
    itemEl.addEventListener('mouseenter', (e) => {
      sfLastMouse = {x: e.clientX, y: e.clientY};
      const d = sfGetTooltipDelayMs();
      clearTimeout(sfTooltipTimer);
      sfTooltipTimer = setTimeout(() => {
        showTooltip(item, sfLastMouse.x, sfLastMouse.y);
      }, d);
    });

    itemEl.addEventListener('mousemove', (e) => {
      sfLastMouse = {x: e.clientX, y: e.clientY};
      if (tooltip && tooltip.style.display === 'block') {
        tooltip.style.left = (e.clientX + 20) + 'px';
        tooltip.style.top = (e.clientY - tooltip.offsetHeight / 2) + 'px';
      }
    });

    itemEl.addEventListener('mouseleave', () => {
      clearTimeout(sfTooltipTimer);
      hideTooltip();
    });
  });
}

function renderInventory() {
  const inventoryGrid = document.getElementById('inventoryGrid');
  if (!inventoryGrid) return;

  console.log('🎨 Renderuji inventář:', gameState.inventory);

  inventoryGrid.innerHTML = '';

  // Render all 8 slots (filled + empty). Index = pozice ve slotu.
  for (let i = 0; i < INVENTORY_SIZE; i++) {
    const itemRef = (gameState.inventory || [])[i];
    const item = itemRef ? getItemById(itemRef) : null;

    const slot = document.createElement('div');
    slot.className = 'inv-slot' + (item ? ' filled' : ' empty');
    slot.dataset.invIndex = i;

    // Drop target pro přesuny v inventáři (i prázdný slot)
    slot.addEventListener('dragover', handleDragOver);
    slot.addEventListener('dragleave', handleDragLeave);
    slot.addEventListener('drop', handleInventoryDrop);

    if (item) {
      slot.draggable = true;
      const itemId = item.instance_id || item.id;
      slot.dataset.itemId = itemId;

      // Rarity styling (S&F feeling)
      const r = (item.rarity || 'common');
      const rLabel = ({ common:'COMMON', uncommon:'UNCOMMON', rare:'RARE', epic:'EPIC', legendary:'LEGEND' }[r] || 'COMMON');
      slot.classList.add(`rarity-${r}`);
      slot.dataset.rarity = r;
      slot.dataset.rarityLabel = rLabel;

      const iconHTML = renderItemIconHTML(item.icon, item.name);
      if (iconHTML.startsWith('<img')) {
        slot.innerHTML = iconHTML;
      } else {
        slot.textContent = iconHTML;
      }

      // Tooltip
      slot.addEventListener('mouseenter', (e) => {
        showTooltip(item, e.clientX, e.clientY);
      });

      slot.addEventListener('mousemove', (e) => {
        if (tooltip && tooltip.style.display === 'block') {
          tooltip.style.left = (e.clientX + 20) + 'px';
          tooltip.style.top = (e.clientY - tooltip.offsetHeight / 2) + 'px';
        }
      });

      slot.addEventListener('mouseleave', () => {
        hideTooltip();
      });

      // Drag events
      slot.addEventListener('dragstart', handleDragStart);
      slot.addEventListener('dragend', handleDragEnd);
    }

    inventoryGrid.appendChild(slot);
  }

  // Update count (kolik skutečných itemů)
  const invCount = document.getElementById('invCount');
  if (invCount) {
    const count = (gameState.inventory || []).filter(Boolean).length;
    invCount.textContent = count;
  }

  console.log('✅ Inventář vyrenderován');
}

function renderEquippedItems() {
  EQUIP_SLOTS.forEach(slotName => {
    const itemRef = gameState.equipped[slotName];
    const slotElement = document.querySelector(`[data-slot="${slotName}"]`);
    
    if (!slotElement) return;
    
    if (itemRef) {
      const item = getItemById(itemRef);
      if (!item) return;

      slotElement.classList.remove('is-empty');
      
      slotElement.classList.add('has-item');

      // Reset + apply rarity styling
      ['common','uncommon','rare','epic','legendary'].forEach(r => slotElement.classList.remove(`rarity-${r}`));
      const r = (item.rarity || 'common');
      const rLabel = ({ common:'COMMON', uncommon:'UNCOMMON', rare:'RARE', epic:'EPIC', legendary:'LEGEND' }[r] || 'COMMON');
      slotElement.classList.add(`rarity-${r}`);
      slotElement.dataset.rarity = r;
      slotElement.dataset.rarityLabel = rLabel;
      
      const itemId = item.instance_id || item.id;
      
      const iconHTML = renderItemIconHTML(item.icon, item.name);
      if (iconHTML.startsWith('<img')) {
        slotElement.innerHTML = iconHTML.replace(
          '<img',
          `<img class="slot-item" draggable="true" data-item-id="${itemId}" data-from-slot="${slotName}"`
        );
      } else {
        slotElement.innerHTML = `<span class="slot-item" draggable="true" data-item-id="${itemId}" data-from-slot="${slotName}">${iconHTML}</span>`;
      }
      
      // Tooltip
      slotElement.addEventListener('mouseenter', (e) => {
        showTooltip(item, e.clientX, e.clientY);
      });
      
      slotElement.addEventListener('mousemove', (e) => {
        if (tooltip && tooltip.style.display === 'block') {
          tooltip.style.left = (e.clientX + 20) + 'px';
          tooltip.style.top = (e.clientY - tooltip.offsetHeight / 2) + 'px';
        }
      });
      
      slotElement.addEventListener('mouseleave', () => {
        hideTooltip();
      });
      
      // Add drag events
      const itemElement = slotElement.querySelector('.slot-item');
      if (itemElement) {
        itemElement.addEventListener('dragstart', handleEquippedDragStart);
        itemElement.addEventListener('dragend', handleDragEnd);
      }
    } else {
      // Nezobrazuj prázdné políčko, dokud není vybavený item
      slotElement.classList.remove('has-item');
      slotElement.classList.add('is-empty');
      ['common','uncommon','rare','epic','legendary'].forEach(r => slotElement.classList.remove(`rarity-${r}`));
      delete slotElement.dataset.rarity;
      delete slotElement.dataset.rarityLabel;
      slotElement.innerHTML = '';
    }
  });
}

function renderCharacterStats() {
  const statsSection = document.getElementById('statsSection');
  if (!statsSection) return;

  // Inventář přesouváme do pravého panelu pod koš (sell zone).
  // Pozor: statsSection se přerenderovává přes innerHTML, což by inventář smazalo.
  // Proto si vezmeme referenci PŘED přepsáním obsahu a po renderu ho znovu připojíme.
  const inventoryPanel = document.getElementById('inventoryPanel');
  
  const bonuses = calculateTotalBonuses();
  const cls = (gameState.stats?.player_class ? String(gameState.stats.player_class).toLowerCase() : 'padouch');
  const lvl = Number(gameState.level || 1);
  const petPct = (window.SF && typeof window.SF.getPetBonusesPercent === 'function')
    ? window.SF.getPetBonusesPercent(window.SF.stats)
    : { strength:0, defense:0, constitution:0, luck:0 };

  const guildPct = (window.SF && typeof window.SF.getGuildBonusesPercent === 'function')
    ? window.SF.getGuildBonusesPercent()
    : { strength:0, defense:0, constitution:0, luck:0 };
  const statNames = {
    strength: '⚔️ Strength',
    defense: '🛡️ Defense',
    constitution: '💪 Constitution',
    luck: '🍀 Luck'
  };
  
  let statsHTML = '<div class="section-header"><h2>📊 STATISTIKY</h2></div>';
  
  ALLOWED_STATS.forEach(stat => {
    const baseValue = Number(gameState.stats[stat] ?? 0);
    const bonus = bonuses[stat] || 0;
    const rawTotal = baseValue + bonus;
    const p = Number(petPct?.[stat] || 0);
    const g = Number(guildPct?.[stat] || 0);
    const totalValue = Math.round(rawTotal * (1 + p / 100) * (1 + g / 100));
    
    const extraMain = calculateStatBonus(stat, totalValue, lvl, cls);
    // Bonusy ukazujeme jen pod "modrým" řádkem (stat-extra) – stejně jako v postavě/žebříčku.
    const extraSub = `🐾 +${p.toFixed(1)}%  👥 +${g.toFixed(1)}%`;

    // cena upgradu (pokud server nemá uloženou, dopočítáme)
    const baseStatForCost = Number(gameState.stats[stat] ?? 10);
    const costs = (window.SF?.stats?.upgrade_costs) || {};
    const rawCost = Number(costs[stat] ?? calcUpgradeCost(baseStatForCost, lvl));
    const discounted = Math.max(1, Math.ceil(rawCost * UPGRADE_COST_DISCOUNT));

    statsHTML += `
      <div class="stat">
        <span>${statNames[stat]}</span>
        <b id="${stat}Value">${formatStatValue(totalValue)}</b>
        <div class="stat-right">
          <span class="stat-extra" id="${stat}Extra">${extraMain}</span>
          <span class="stat-bonus" id="${stat}Bonus">${extraSub}</span>
        </div>
        <button type="button" data-upgrade="${stat}">+
          <span class="cost" id="${stat}Cost">${discounted}🪙</span>
        </button>
      </div>
    `;
  });
  
  // Přidat SELL ZONE pod statistiky
  statsHTML += `
    <div class="sell-zone" id="sellZone">
      <div class="sell-icon">💰</div>
      <div class="sell-text">PRODAT ITEM</div>
      <div class="sell-price">35% z hodnoty</div>
    </div>
  `;
  
  statsSection.innerHTML = statsHTML;

  // upgrade buttons
  statsSection.querySelectorAll('[data-upgrade]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stat = btn.getAttribute('data-upgrade');
      if (stat) doUpgrade(stat);
    });
  });
  
  // Přidat event listenery pro sell zone
  const sellZone = document.getElementById('sellZone');
  if (sellZone) {
    sellZone.addEventListener('dragover', handleDragOver);
    sellZone.addEventListener('dragleave', handleDragLeave);
    sellZone.addEventListener('drop', handleSellDrop);
  }

  // Znovu připojit inventář až po SELL ZONE
  // Znovu připoj inventář (pokud existuje) – jinak by po innerHTML renderu zmizel.
  if (inventoryPanel) statsSection.appendChild(inventoryPanel);
}

function getSlotEmoji(slotName) {
  const emojis = {
    weapon: "🗡️",
    shield: "🛡️",
    ring: "💍",
    backpack: "🎒",
    trinket1: "📿",
    trinket2: "🧿",
    trinket3: "🔮",
    trinket4: "🪬",
    helmet: "🎩",
    armor: "👕",
    boots: "👢",
    gloves: "🧤"
  };
  return emojis[slotName] || "❓";
}

function updateUI() {
  const levelDisplay = document.getElementById('levelDisplay');
  const levelShop = document.getElementById('levelShop');
  if (levelDisplay) levelDisplay.textContent = gameState.level;
  if (levelShop) levelShop.textContent = `Level ${gameState.level}`;
  
  const money = document.getElementById('money');
  const cigarettes = document.getElementById('cigarettes');
  if (money) money.textContent = gameState.money.toLocaleString('cs-CZ');
  if (cigarettes) cigarettes.textContent = gameState.cigarettes;
  
  const requiredXP = getRequiredXP(gameState.level);
  const xpPercent = (gameState.xp / requiredXP) * 100;
  const xpFill = document.getElementById('xpFill');
  const xpText = document.getElementById('xpText');
  if (xpFill) xpFill.style.width = `${xpPercent}%`;
  if (xpText) xpText.textContent = `${gameState.xp} / ${requiredXP}`;
  
  renderEquippedItems();
  renderCharacterStats();
  renderInventory();
  updateRotationTimer();
  updateClassBadge();
}

function updateRotationTimer() {
  const timerEl = document.getElementById('shopTimer');
  if (timerEl) {
    timerEl.textContent = `🔄 Další rotace: ${getTimeUntilNextRotation()}`;
  }
}

function calculateTotalBonuses() {
  const bonuses = {
    strength: 0,
    defense: 0,
    constitution: 0,
    luck: 0
  };
  
  Object.values(gameState.equipped).forEach(itemRef => {
    if (!itemRef) return;
    const item = getItemById(itemRef);
    if (!item || !item.bonuses) return;
    
    Object.keys(item.bonuses).forEach(stat => {
      bonuses[stat] += item.bonuses[stat];
    });
  });
  
  return bonuses;
}

// shop.js - Part 4: Shop Functions, Drag & Drop, Sell System, Init

// ===== SHOP FUNCTIONS =====

function sfSfx(name){
  try {
    if (window.SFPlaySfx) window.SFPlaySfx(name);
    else if (window.SFPlayClick) window.SFPlayClick();
  } catch {}
}
async function buyItem(itemId) {
  console.log('💰 Kupuji item:', itemId);
  
  const item = getItemById(itemId);
  
  if (!item) {
    console.error('❌ Item nenalezen:', itemId);
    showNotification('Item nenalezen!', 'error');
    return;
  }
  
  console.log('✅ Item nalezen:', item);
  
  const effectivePrice = sfGetEffectivePrice(item);

  if (gameState.money < effectivePrice) {
    sfSfx('error');
    showNotification('Nemáš dost peněz!', 'error');
    return;
  }

  const req = Number(item.req_level || 1);
  if (gameState.level < req) {
    sfSfx('error');
    showNotification(`Potřebuješ minimálně level ${req}!`, 'error');
    return;
  }

  // Nastavení: potvrzení nákupu
  try {
    const confirmOn = (localStorage.getItem('sf_confirm_buy') ?? '1') !== '0';
    if (confirmOn) {
      const ok = confirm(`Koupit ${item.name} za ${effectivePrice.toLocaleString('cs-CZ')}🪙?`);
      if (!ok) return;
    }
  } catch {}
  
  gameState.inventory = normalizeInventory(gameState.inventory || []);
  const emptyIndex = gameState.inventory.findIndex(x => !x);
  if (emptyIndex === -1) {
    sfSfx('error');
    showNotification('Inventář je plný!', 'error');
    return;
  }
  
  // Purchase - UKLÁDÁME CELÝ OBJEKT (instance) do prvního volného slotu
  gameState.money -= effectivePrice;
  gameState.inventory[emptyIndex] = item;

  
  console.log('📦 Item přidán do inventáře');
  console.log('📦 Inventář po koupi:', gameState.inventory);
  
  // Save and update
  const saved = await saveToSupabase();
  
  if (saved) {
    updateUI();
    sfSfx('buy');
    showNotification(`${item.name} koupen za ${effectivePrice}🪙!`, 'success');
  } else {
    // Rollback pokud se neuložilo
    gameState.money += effectivePrice;
    gameState.inventory[emptyIndex] = null;
    sfSfx('error');
    showNotification('Chyba při ukládání!', 'error');
  }
}

// ===== SELL SYSTEM (35% z ceny) =====
async function sellItem(itemRef) {
  try {
    const confirmSell = (localStorage.getItem('sf_confirm_sell') ?? '1') !== '0';
    if (confirmSell) {
      const it = getItemById(itemRef);
      const name = it?.name || 'item';
      if (!confirm(`Prodat ${name}?`)) return;
    }
  } catch {}

  const item = getItemById(itemRef);
  if (!item) return;
  
  const mult = getSellMultiplier(item.rarity);
  const sellPrice = Math.floor((item.price || 0) * mult);
  
  gameState.money += sellPrice;
  
  const saved = await saveToSupabase();
  
  if (saved) {
    updateUI();
    showNotification(`${item.name} prodán za ${sellPrice}🪙! (${Math.round((getSellMultiplier(item.rarity) || 0.35)*100)}%)`, 'success');
  } else {
    gameState.money -= sellPrice;
    showNotification('Chyba při prodeji!', 'error');
  }
}

// ===== DRAG & DROP =====
function handleDragStart(e) {
  // U JPG ikon je event.target často <img>, který nemá dataset.
  // Listener je na slotu, takže ber data z currentTarget.
  const t = e.currentTarget || e.target;
  draggedItem = {
    itemId: t.dataset.itemId,
    invIndex: parseInt(t.dataset.invIndex)
  };
  dragSource = 'inventory';
  (t.classList || e.target.classList).add('dragging');
  hideTooltip();
}

function handleEquippedDragStart(e) {
  // U JPG ikon je target často <img>, ale ber jistě currentTarget
  const t = e.currentTarget || e.target;
  const fromSlot = t.dataset.fromSlot;
  draggedItem = {
    fromSlot,
    itemRef: gameState.equipped[fromSlot]
  };
  dragSource = 'equipped';
  t.classList.add('dragging');
  hideTooltip();
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => {
    el.classList.remove('drag-over');
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  
  if (!draggedItem) return;
  
  const targetSlot = e.currentTarget.dataset.slot;
  const item = getItemById(draggedItem.itemId);
  
  if (!item) return;
  
  const req = Number(item.req_level || 1);
  if (gameState.level < req) {
    showNotification(`Potřebuješ minimálně level ${req} pro ${item.name}!`, 'error');
    return;
  }
  
  if (item.slot !== targetSlot) {
    showNotification(`${item.name} nelze nasadit do slotu ${targetSlot}!`, 'error');
    return;
  }
  
  if (dragSource === 'inventory') {
    const currentItem = gameState.equipped[targetSlot];
    if (currentItem) {
      gameState.inventory[draggedItem.invIndex] = currentItem;
    } else {
      gameState.inventory[draggedItem.invIndex] = null;
    }
    
    gameState.equipped[targetSlot] = item;
    showNotification(`${item.name} nasazen!`, 'success');
  }
  else if (dragSource === 'equipped') {
    const temp = gameState.equipped[targetSlot];
    gameState.equipped[targetSlot] = draggedItem.itemRef;
    gameState.equipped[draggedItem.fromSlot] = temp;
    showNotification(`Položky přesunuty!`, 'success');
  }
  
  await saveToSupabase();
  updateUI();
  
  draggedItem = null;
  dragSource = null;
}

// ===== INVENTORY DROP HANDLER (přesuny v inventáři + equip -> inventář) =====
async function handleInventoryDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  if (!draggedItem) return;

  const targetIndex = parseInt(e.currentTarget.dataset.invIndex);
  if (!Number.isFinite(targetIndex)) return;

  // Normalizuj inventář na fixní velikost (sloty 0..INVENTORY_SIZE-1)
  gameState.inventory = normalizeInventory(gameState.inventory || []);

  const isTargetFilled = !!gameState.inventory[targetIndex];

  if (dragSource === 'inventory') {
    const from = Number(draggedItem.invIndex);
    if (!Number.isFinite(from)) return;

    if (from === targetIndex) {
      draggedItem = null;
      dragSource = null;
      return;
    }

    const itemRef = gameState.inventory[from];
    if (!itemRef) {
      draggedItem = null;
      dragSource = null;
      return;
    }

    // Swap / move mezi sloty (zachová prázdné sloty)
    const tmp = gameState.inventory[targetIndex] || null;
    gameState.inventory[targetIndex] = itemRef;
    gameState.inventory[from] = tmp;

    showNotification('📦 Položka přesunuta', 'success');
  }
  else if (dragSource === 'equipped') {
    const fromSlot = draggedItem.fromSlot;
    const itemRef = draggedItem.itemRef;
    if (!fromSlot || !itemRef) {
      draggedItem = null;
      dragSource = null;
      return;
    }

    // pokud cíl obsazený, displaced item musí do prázdného slotu
    const emptyIndex = gameState.inventory.findIndex(x => !x);
    if (isTargetFilled && emptyIndex === -1) {
      sfSfx('error');
    showNotification('Inventář je plný!', 'error');
      draggedItem = null;
      dragSource = null;
      return;
    }

    // Odebrat z equipu
    gameState.equipped[fromSlot] = null;

    if (isTargetFilled) {
      const displaced = gameState.inventory[targetIndex];
      gameState.inventory[targetIndex] = itemRef;
      gameState.inventory[emptyIndex] = displaced;
    } else {
      gameState.inventory[targetIndex] = itemRef;
    }

    const it = getItemById(itemRef);
    showNotification(`${it?.name || 'Item'} přesunut do inventáře`, 'success');
  }

  await saveToSupabase();
  updateUI();

  draggedItem = null;
  dragSource = null;
}


// ===== SELL ZONE DROP HANDLER =====
async function handleSellDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  
  if (!draggedItem) return;
  
  let itemRef = null;
  let itemIndex = null;
  
  if (dragSource === 'inventory') {
    itemRef = gameState.inventory[draggedItem.invIndex];
    itemIndex = draggedItem.invIndex;
  } else if (dragSource === 'equipped') {
    itemRef = draggedItem.itemRef;
  }
  
  if (!itemRef) return;
  
  const item = getItemById(itemRef);
  if (!item) return;
  
  const mult = getSellMultiplier(item.rarity);
  const sellPrice = Math.floor((item.price || 0) * mult);
  
  // Remove from inventory or equipped
  if (dragSource === 'inventory') {
    gameState.inventory = normalizeInventory(gameState.inventory || []);
    gameState.inventory[itemIndex] = null;
  } else if (dragSource === 'equipped') {
    gameState.equipped[draggedItem.fromSlot] = null;
  }
  
  // Add money
  gameState.money += sellPrice;
  
  const saved = await saveToSupabase();
  
  if (saved) {
    updateUI();
    const pct = Math.round((mult || 0.35) * 100);
    showNotification(`💰 ${item.name} prodán za ${sellPrice}🪙! (${pct}%)`, 'success');
  } else {
    // Rollback
    if (dragSource === 'inventory') {
      gameState.inventory = normalizeInventory(gameState.inventory || []);
      gameState.inventory[itemIndex] = itemRef;
    } else if (dragSource === 'equipped') {
      gameState.equipped[draggedItem.fromSlot] = itemRef;
    }
    gameState.money -= sellPrice;
    showNotification('Chyba při prodeji!', 'error');
  }
  
  draggedItem = null;
  dragSource = null;
}

async function unequipItem(slotName) {
  const itemRef = gameState.equipped[slotName];
  if (!itemRef) return;
 
  gameState.inventory = normalizeInventory(gameState.inventory || []);
  const emptyIndex = gameState.inventory.findIndex(x => !x);
  if (emptyIndex === -1) {
    sfSfx('error');
    showNotification('Inventář je plný!', 'error');
    return;
  }
  
  const item = getItemById(itemRef);
  gameState.equipped[slotName] = null;
  gameState.inventory[emptyIndex] = itemRef;
  
  await saveToSupabase();
  updateUI();
  
  showNotification(`${item.name} odebrán z výbavy`, 'success');
}

// ===== TAB SWITCHING =====
function switchCategory(category) {
  currentCategory = category;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeBtn = document.querySelector(`[data-category="${category}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  
  renderShopItems();
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
  console.log('🚀 Initializing shop...');
  
  if (!window.SHOP_ITEMS) {
    console.error('❌ SHOP_ITEMS not loaded!');
    showNotification('Chyba: items.js není načten!', 'error');
    return;
  }
  
  showNotification('Načítání obchodu...', 'success');
  
  await initUser();

  // ===== INVENTÁŘ SIZE TOGGLE (malé zvětšení) =====
  const INV_SIZE_KEY = 'sf_inv_size'; // 'normal' | 'big'
  const invGrid = document.getElementById('inventoryGrid');
  const invSizeBtn = document.getElementById('invSizeToggle');

  function getInvSize(){
    try { return localStorage.getItem(INV_SIZE_KEY) || 'normal'; } catch { return 'normal'; }
  }
  function setInvSize(v){
    try { localStorage.setItem(INV_SIZE_KEY, v); } catch {}
  }
  function applyInvSize(){
    if (!invGrid) return;
    const v = getInvSize();
    invGrid.classList.toggle('inv-big', v === 'big');
    if (invSizeBtn) invSizeBtn.textContent = (v === 'big') ? '⤡' : '⤢';
  }

  if (invSizeBtn) {
    invSizeBtn.addEventListener('click', () => {
      const next = (getInvSize() === 'big') ? 'normal' : 'big';
      setInvSize(next);
      applyInvSize();
    });
  }
  applyInvSize();
  
  renderShopItems();
  updateUI();
  
  // Setup tab listeners
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchCategory(btn.dataset.category);
    });
  });

  // Paid reroll button (NAHRADIT)
  const rerollBtn = document.getElementById('shopRerollBtn');
  if (rerollBtn) {
    rerollBtn.addEventListener('click', paidRerollShop);
  }
  
  // Setup drop zones for equipment
  document.querySelectorAll('[data-dropzone="true"]').forEach(slot => {
    slot.addEventListener('dragover', handleDragOver);
    slot.addEventListener('dragleave', handleDragLeave);
    slot.addEventListener('drop', handleDrop);
    
    // Double-click to unequip
    slot.addEventListener('dblclick', (e) => {
      const slotName = e.currentTarget.dataset.slot;
      unequipItem(slotName);
    });
  });
  
  // Update rotation timer every second
  setInterval(() => {
    updateRotationTimer();
    
    if (shouldRotateShop()) {
      rotateShopItems();
      saveToSupabase();
      renderShopItems();
      showNotification('🔄 Shop se obnovil novými itemy!', 'success');
    }
  }, 1000);
  
  showNotification('Obchod načten!', 'success');
  
  console.log('✅ Shop initialized!', gameState);
});

// ===== AUTO-SAVE =====
setInterval(async () => {
  await saveToSupabase();
  console.log('💾 Auto-save completed');
}, 30000);

// ===== EXPOSE FOR HTML =====
window.buyItem = buyItem;

console.log('✅ Shop system loaded!');

// play click sfx when buying
