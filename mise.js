// mise.js - Mission System s Supabase integrací

const supabaseClient = () => window.supabaseClient;

async function ensureOnline() {
  if (window.SFReady) await window.SFReady;
  const sb = supabaseClient();
  if (!sb) throw new Error('Supabase client není inicializovaný');
  return sb;
}

// ===== GAME STATE =====
let gameState = {
  userId: null,
  level: 1,
  money: 3170,
  cigarettes: 42,
  energy: 100,
  maxEnergy: 100,
  missionData: {
    completedMissions: 0,
    totalExpEarned: 0,
    totalMoneyEarned: 0,
    totalBattles: 0,
    totalWins: 0,
    // defaultně 3 sloty, další 3 jde odemknout (každý za 500🚬)
    unlockedSlots: 3,
    activeMissions: {
      slot1: null,
      slot2: null,
      slot3: null,
      slot4: null,
      slot5: null,
      slot6: null
    },
    assassin: {
      active: false,
      startTime: null
    },
    lastEnergyUpdate: Date.now()
  }
};

const ALL_MISSION_SLOTS = ['slot1','slot2','slot3','slot4','slot5','slot6'];

function getUnlockedSlots() {
  const n = Math.max(3, Math.min(6, Number(gameState?.missionData?.unlockedSlots || 3)));
  return ALL_MISSION_SLOTS.slice(0, n);
}

let missionTimers = { slot1: null, slot2: null, slot3: null, slot4: null, slot5: null, slot6: null };
let assassinTimer = null;

// ===== MISSION TEMPLATES =====
const missionTemplates = {
  easy: [
    {
      name: "Kvašák u Petra",
      story: "Tvůj kámoš Petr volá o pomoc! Jeho babička dělá nejlepší kvašák v celém Česku, ale kvůli nehodě nemůže zajít do sklepa. Musíš dojít k nim domů, sebrat ten kvašák a přinést ho Petrovi.",
      enemies: ["Babička", "Sousedka", "Kocour"],
      emojis: ["👵", "👩‍🦰", "🐱"]
    },
    {
      name: "Cigarety pro Gopnika",
      story: "Starší gopnik u zastávky tě požádal, abys mu sehnal cigarety. Musíš dojít k trafice, koupit balíček a vrátit se. Ale pozor - ve frontě může být dlouhá čekací doba!",
      enemies: ["Trafikant", "Důchodce", "Policajt"],
      emojis: ["🚬", "👴", "👮"]
    },
    {
      name: "Ztracený adidas dres",
      story: "Tvůj nejlepší kámoš ztratil svůj limitovaný adidas dres na sídlišti. Musíš ho najít, než ho někdo ukradne! Prohledej všechny možné místa.",
      enemies: ["Kluk na BMX", "Bezdomovec", "Pes"],
      emojis: ["🚴", "🧔", "🐕"]
    },
    {
      name: "Semínka na zahrádku",
      story: "Tvůj děda potřebuje speciální semínka pro svou zahrádku. Musíš jet do zahradnictví, koupit ta správná semínka a vrátit se dřív, než začne pršet!",
      enemies: ["Prodavačka", "Rival zahradník", "Holubi"],
      emojis: ["👩‍🌾", "👨‍🌾", "🐦"]
    },
    {
      name: "Oprava kola",
      story: "Tvoje kolo má prásknutou pneumatiku uprostřed sídliště. Musíš dojít do servisu, koupit záplatu a vrátit se opravit kolo!",
      enemies: ["Mechanik", "Zlý kluk", "Strážník"],
      emojis: ["🔧", "😠", "👮‍♂️"]
    },
    {
      name: "Ztracený telefon",
      story: "Tvoje matka ztratila telefon někde na tržnici. Musíš ho najít dřív, než ho někdo prodá! Procházej stánky a ptej se lidí.",
      enemies: ["Prodavač", "Kapesní zloděj", "Hlídač"],
      emojis: ["🛒", "🕵️", "👁️"]
    },
    {
      name: "Pivo pro partu",
      story: "Tvoje gopnik parta sedí u garáží a došlo jim pivo. Ty jsi nejmladší, tak musíš běžet do obchodu pro bednu! Rychle, než zavřou!",
      enemies: ["Prodavač u pultu", "Bezdomovec u vchodu", "Babka v řadě"],
      emojis: ["🍺", "🧔", "👵"]
    },
    {
      name: "Hledání psa",
      story: "Sousedce utekl pes a nabízí odměnu za jeho návrat. Musíš prohledat celé sídliště a najít toho hafana!",
      enemies: ["Agresivní kočka", "Hlídač parku", "Jiný pes"],
      emojis: ["🐱", "👨‍✈️", "🐕‍🦺"]
    }
  ],
  medium: [
    {
      name: "Souboj o lavičku",
      story: "Tvoje gopnik parta má tradiční místo u panelákové lavičky, ale dnes tam sedí rivalové z vedlejšího sídliště! Musíš tam jít a ukázat jim, že tahle lavička je VAŠE!",
      enemies: ["Rival gopnik", "Jeho bratři", "Pitbull"],
      emojis: ["🥊", "👊", "🐕‍🦺"]
    },
    {
      name: "Nelegální street race",
      story: "Dostal jsi pozvánku na podzemní závody na sídlišti! Musíš sehnat auto a vyhrát závod proti místním šílencům!",
      enemies: ["Street racer", "Kopřivová káča", "Policejní honička"],
      emojis: ["🏎️", "🚔", "💨"]
    },
    {
      name: "Krádež gopnikova kola",
      story: "Někdo ukradl kolo tvému kámoši! Podle svědků jelo směrem k nádraží. Musíš zloděje najít a dostat kolo zpátky!",
      enemies: ["Zloděj", "Jeho kumpáni", "Hlídač u nádraží"],
      emojis: ["🚲", "😈", "🕵️"]
    },
    {
      name: "Obrana tržnice",
      story: "Na místní tržnici se objevila nová banda co se snaží ovládnout území! Prodavači tě prosí o pomoc. Musíš je vyhnat!",
      enemies: ["Bandita 1", "Bandita 2", "Boss bandy"],
      emojis: ["👿", "😡", "🤬"]
    },
    {
      name: "Zásilka od Ivana",
      story: "Ivan ze sousedního města ti poslal důležitou zásilku, ale kurýr se ztratil. Musíš ho najít a získat zásilku!",
      enemies: ["Ztracený kurýr", "Podezřelý muž", "Hlídka"],
      emojis: ["📦", "🕴️", "👮"]
    },
    {
      name: "Výběr dluhů",
      story: "Tvůj starší brácha ti dal úkol - musíš vybrat dluhy od tří lidí na sídlišti. Ale oni platit nechtějí!",
      enemies: ["Dlužník 1", "Dlužník 2", "Dlužník 3"],
      emojis: ["💰", "🤥", "😰"]
    },
    {
      name: "Ochrana baru",
      story: "Majitel lokálního baru tě najal jako ochranku na dnešní večer. Musíš vyhodit všechny výtržníky!",
      enemies: ["Opilec", "Výtržník", "Rváč"],
      emojis: ["🍺", "🤪", "🥊"]
    },
    {
      name: "Sabotáž konkurence",
      story: "Tvůj boss tě poslal sabotovat konkurenční podnik. Musíš se tam dostat, provést sabotáž a zmizet!",
      enemies: ["Hlídač", "Kamerový systém", "Majitel"],
      emojis: ["🎥", "🔒", "👨‍💼"]
    }
  ],
  hard: [
    {
      name: "Odplata za Borisa",
      story: "Borisa, tvého nejlepšího kámoše, zbili chuligáni u nádraží! Musíš najít ty bastardy a dát jim pořádnou lekci!",
      enemies: ["Hlavní chuligán", "Boxer", "Kickboxer"],
      emojis: ["💀", "🥊", "🦵"]
    },
    {
      name: "Černý trh",
      story: "Objevil se černý trh s nelegálním zbožím. Musíš tam zajít, najít obchodníka a dohodnout obchod. Policie o trhu taky ví...",
      enemies: ["Obchodník s nožem", "Bodyguard", "Undercover policajt"],
      emojis: ["🔪", "🥋", "🚨"]
    },
    {
      name: "Záchrana sestry",
      story: "Tvoje sestra se zapletla s špatnou partou! Drží ji v opuštěné budově. Musíš tam zajít sám a vyjednat její propuštění!",
      enemies: ["Bandita s řetězem", "MMA fighter", "Boss s baseballkou"],
      emojis: ["⛓️", "🥋", "⚾"]
    },
    {
      name: "Territorio válka",
      story: "Vypukla teritoriální válka mezi gopnik gangami! Musíš reprezentovat svoje sídliště v pěstním souboji!",
      enemies: ["Gopnik šampion", "Street warrior", "Legendární boss"],
      emojis: ["👑", "⚔️", "🏆"]
    },
    {
      name: "Zrazený obchod",
      story: "Domlouval jsi velký obchod, ale ukázalo se, že to byla past! Musíš najít zrádce a dostat zpátky svoje groše!",
      enemies: ["Dmitrij zrádce", "Bodyguard", "Najatý fighter"],
      emojis: ["🤥", "💪", "🥷"]
    },
    {
      name: "Loupež skladu",
      story: "Tvůj boss tě poslal vykrást sklad plný cenného zboží. Musíš se dostat dovnitř, ukrást zboží a uniknout!",
      enemies: ["Ochranká", "Alarm", "Policejní zásahová jednotka"],
      emojis: ["👮‍♂️", "🚨", "🚔"]
    },
    {
      name: "Vyřízení účtů",
      story: "Máš seznam lidí, kteří tvému bossovi dluží. Musíš je navštívit a 'přesvědčit' je, aby zaplatili. Nebude to legrace!",
      enemies: ["Zadlužený podnikatel", "Jeho ochranká", "Najatý bojovník"],
      emojis: ["💼", "🛡️", "⚔️"]
    }
  ],
  extreme: [
    {
      name: "Boss všech bossů",
      story: "Konečná výzva! Nejlegendárnější gopnik boss ve městě tě vyzval na souboj. Pokud vyhraješ, staneš se legendou!",
      enemies: ["Legendární boss", "Mistr bojových umění", "Šampion"],
      emojis: ["👹", "🐲", "☠️"]
    },
    {
      name: "Mafie vyřizuje účty",
      story: "Zapletl ses do něčeho velkého. Ruská mafie si myslí, že jsi ukradl jejich peníze. Musíš čelit jejich nejlepším lidem!",
      enemies: ["Mafiánský enforcer", "Profesionální vrah", "Don mafie"],
      emojis: ["🔫", "💼", "👔"]
    },
    {
      name: "Turnaj smrti",
      story: "Dostal ses do nelegálního turnaje plného nejnebezpečnějších fighterů. Jediný způsob ven? Vyhrát všechny zápasy!",
      enemies: ["Sambo mistr", "Siberian beast", "Neporazitelný šampion"],
      emojis: ["🥊", "🐻", "💀"]
    },
    {
      name: "Záchrana města",
      story: "Nebezpečná kriminální organizace chce ovládnout celé město! Policie je bezmocná. Jsi poslední naděje!",
      enemies: ["Elite soldier", "Cyber fighter", "Boss organizace"],
      emojis: ["🎯", "🤖", "👿"]
    },
    {
      name: "Pomsta za ztrátu",
      story: "Našli ti toho, kdo zabil tvého přítele před rokem. Je čas pomstít se. Ale není to žádný obyčejný chuligán - je to profesionální zabijak!",
      enemies: ["Professional hitman", "Combat veteran", "Death incarnate"],
      emojis: ["🗡️", "⚰️", "💀"]
    }
  ]
};

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
      gameState.money = data.money ?? gameState.money;
      gameState.cigarettes = data.cigarettes ?? gameState.cigarettes;
      gameState.energy = data.energy ?? gameState.energy;
      gameState.maxEnergy = data.max_energy ?? gameState.maxEnergy;
      
      // Načti missionData (kompatibilita s různými názvy)
      const md = data.missiondata || data.missionData || {};
      const unlockedSlots = Math.max(3, Math.min(6, Number(md.unlockedSlots ?? md.unlocked_slots ?? 3)));

      // doplň chybějící sloty (zpětná kompatibilita se starým uložením)
      const active = Object.assign(
        { slot1:null, slot2:null, slot3:null, slot4:null, slot5:null, slot6:null },
        (md.activeMissions || {})
      );

      gameState.missionData = {
        completedMissions: md.completedMissions || 0,
        totalExpEarned: md.totalExpEarned || 0,
        totalMoneyEarned: md.totalMoneyEarned || 0,
        totalBattles: md.totalBattles || 0,
        totalWins: md.totalWins || 0,
        unlockedSlots,
        activeMissions: active,
        assassin: md.assassin || { active: false, startTime: null },
        lastEnergyUpdate: md.lastEnergyUpdate || Date.now()
      };
    }

    // Regenerace energie
    regenerateEnergy();
    
    updateUI();
    updateStats();
    syncMissionSlotUnlockUI();
    restoreMissions();
    restoreAssassin();
    
  } catch (error) {
    console.error("Error initializing user:", error);
    showNotification("Chyba při načítání hry", "error");
  }
}

async function saveToSupabase() {
  try {
    const sb = await ensureOnline();
    
    const payload = {
      user_id: gameState.userId,
      level: gameState.level,
      money: gameState.money,
      cigarettes: gameState.cigarettes,
      energy: gameState.energy,
      max_energy: gameState.maxEnergy,
      missiondata: gameState.missionData // lowercase = skutečný název sloupce
    };

    const { error } = await sb
      .from("player_stats")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      console.error("Error saving to Supabase:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error saving to Supabase:", error);
    return false;
  }
}

// ===== ENERGY REGENERATION =====
function regenerateEnergy() {
  const now = Date.now();
  const lastUpdate = gameState.missionData.lastEnergyUpdate || now;
  const timePassed = now - lastUpdate;
  const energyGained = Math.floor(timePassed / (10 * 60 * 1000)); // 1 energie každých 10 minut (S&F feeling)
  
  if (energyGained > 0) {
    gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + energyGained);
    gameState.missionData.lastEnergyUpdate = now;
  }
}

// ===== UI FUNCTIONS =====
function updateUI() {
  const money = document.getElementById('money');
  const cigarettes = document.getElementById('cigarettes');
  const levelDisplay = document.getElementById('levelDisplay');
  const energy = document.getElementById('energy');
  
  if (money) money.textContent = gameState.money.toLocaleString('cs-CZ');
  if (cigarettes) cigarettes.textContent = gameState.cigarettes;
  if (levelDisplay) levelDisplay.textContent = gameState.level;
  if (energy) energy.textContent = gameState.energy;
  
  // Update energy bar
  const energyPercent = (gameState.energy / gameState.maxEnergy) * 100;
  const energyFill = document.getElementById('energyFill');
  const energyText = document.getElementById('energyText');
  if (energyFill) energyFill.style.width = `${energyPercent}%`;
  if (energyText) energyText.textContent = `${gameState.energy} / ${gameState.maxEnergy}`;
}

function updateStats() {
  const completed = document.getElementById('completed-missions');
  const totalExp = document.getElementById('total-exp-earned');
  const totalMoney = document.getElementById('total-money-earned');
  const winRate = document.getElementById('win-rate');
  
  if (completed) completed.textContent = gameState.missionData.completedMissions;
  if (totalExp) totalExp.textContent = gameState.missionData.totalExpEarned.toLocaleString('cs-CZ');
  if (totalMoney) totalMoney.textContent = `${gameState.missionData.totalMoneyEarned.toLocaleString('cs-CZ')}🪙`;
  
  const rate = gameState.missionData.totalBattles > 0 
    ? Math.round((gameState.missionData.totalWins / gameState.missionData.totalBattles) * 100) 
    : 0;
  if (winRate) winRate.textContent = `${rate}%`;
}

// ===== MISSION FUNCTIONS =====
function getDifficulty() {
  if (gameState.level <= 3) return 'easy';
  if (gameState.level <= 7) return 'medium';
  if (gameState.level <= 12) return 'hard';
  return 'extreme';
}

function getRandomDuration() {
  return Math.floor(Math.random() * (20 - 5 + 1) + 5) * 60;
}

function calculateRewards(difficulty, durationSec) {
  const lvl = Math.max(1, Number(gameState.level) || 1);
  const minutes = Math.max(1, Math.round((Number(durationSec) || 0) / 60));
  // S&F-like: odměna závisí hodně na čase (quest délce)
  const baseExp = Math.pow(lvl, 1.35) * 6;
  const baseMoney = Math.pow(lvl, 1.35) * 25;
  
  let multiplier = 1;
  switch(difficulty) {
    case 'easy': multiplier = 1; break;
    case 'medium': multiplier = 1.5; break;
    case 'hard': multiplier = 2.5; break;
    case 'extreme': multiplier = 4; break;
  }
  
  const luck = Math.max(0, Number(gameState.stats?.luck || 0));
  const denom = luck + (180 + lvl * 18);
  const luckRatio = denom > 0 ? (luck / denom) : 0;
  const lootMult = 1 + luckRatio * 0.30; // až +30%

  const rng = 0.85 + Math.random() * 0.3; // menší rozptyl
  const exp = Math.floor(baseExp * minutes * multiplier * rng * (0.95 + lootMult * 0.05));
  const money = Math.floor(baseMoney * minutes * multiplier * rng * lootMult);
  // malé šance na bonus cigára (S&F vibe "něco navíc")
  const cigChance = Math.min(0.25, 0.04 + lvl / 250 + luckRatio * 0.10);
  const cigarettes = Math.random() < cigChance ? Math.max(1, Math.floor(multiplier)) : 0;
  
  return { exp, money, cigarettes };
}

// ===== S&F-LIKE NPC SCALING (MISE) =====
function clampInt(n, min = 1) {
  const v = Math.floor(Number(n) || 0);
  return Math.max(min, v);
}

function makeMissionEnemy(difficulty, template, enemyIndex) {
  const pLvl = clampInt(gameState.level || 1, 1);
  const p = gameState.stats || {};

  // obtížnost → jak moc je NPC před hráčem
  const diffLevelMult = {
    easy: 0.90,
    medium: 1.05,
    hard: 1.25,
    extreme: 1.50,
  }[difficulty] || 1.0;

  const diffStatMult = {
    easy: 0.85,
    medium: 1.00,
    hard: 1.15,
    extreme: 1.35,
  }[difficulty] || 1.0;

  const lvl = clampInt(Math.round(pLvl * diffLevelMult), 1);

  const stats = {
    strength: clampInt((p.strength || 10) * diffStatMult, 1),
    defense: clampInt((p.defense || 10) * diffStatMult, 1),
    constitution: clampInt((p.constitution || 10) * diffStatMult * 1.05, 1),
    luck: clampInt((p.luck || 10) * (0.95 * diffStatMult), 1),
  };

  return {
    name: template.enemies[enemyIndex],
    emoji: template.emojis[enemyIndex],
    level: lvl,
    stats,
    // HP/dmg necháme spočítat v arena2 (když pošleme stats+level, bude to konzistentní)
  };
}

function generateMission(slot) {
  const difficulty = getDifficulty();
  const templates = missionTemplates[difficulty];
  const template = templates[Math.floor(Math.random() * templates.length)];

  let duration = getRandomDuration();

  // U 3 slotů nechceme, aby byly mise skoro stejně dlouhé (lepší rozložení timerů)
  const slots = ['slot1', 'slot2', 'slot3'];
  for (const s of slots) {
    if (s === slot) continue;
    const other = gameState.missionData.activeMissions[s];
    if (other && Math.abs((other.duration || 0) - duration) < 60) {
      duration += Math.floor(Math.random() * 120) + 60;
      duration = Math.max(300, duration);
      break;
    }
  }

  // Energie podle délky + obtížnosti (S&F vibe)
  const cost = missionEnergyCost(difficulty, duration, gameState.level || 1);
  if (gameState.energy < cost) {
    showNotification(`Nemáš dost energie! (${cost} energie potřeba)`, 'error');
    return null;
  }
  gameState.energy -= cost;

  const rewards = calculateRewards(difficulty, duration);

  const enemyIndex = Math.floor(Math.random() * template.enemies.length);
  const enemy = makeMissionEnemy(difficulty, template, enemyIndex);

  const mission = {
    name: template.name,
    story: template.story,
    difficulty: difficulty,
    duration: duration,
    remainingTime: duration,
    rewards: rewards,
    enemy: enemy,
    slot: slot,
    startTime: Date.now() // DŮLEŽITÉ pro správné časování
  };

  gameState.missionData.activeMissions[slot] = mission;
  saveToSupabase();
  updateUI();

  // ulož poslední cost pro UI (třeba notifikace)
  mission.energyCost = cost;

  return mission;
}

async function startMission(slot) {
  const mission = generateMission(slot);
  if (!mission) return;
  
  document.getElementById(`${slot}-empty`).style.display = 'none';
  document.getElementById(`${slot}-active`).style.display = 'flex';
  
  document.getElementById(`${slot}-name`).textContent = mission.name;
  document.getElementById(`${slot}-difficulty`).textContent = mission.difficulty.toUpperCase();
  document.getElementById(`${slot}-difficulty`).className = `mission-difficulty ${mission.difficulty}`;
  document.getElementById(`${slot}-story`).textContent = mission.story;
  
  startTimer(slot);
  
  showNotification(`Mise spuštěna! -${mission.energyCost || 0} energie`, 'success');
}

async function cancelMission(slot) {
  if (!confirm('Opravdu chceš zrušit tuto misi? Nedostaneš energii zpět!')) return;
  
  if (missionTimers[slot]) {
    clearInterval(missionTimers[slot]);
    missionTimers[slot] = null;
  }
  
  gameState.missionData.activeMissions[slot] = null;
  
  document.getElementById(`${slot}-active`).style.display = 'none';
  document.getElementById(`${slot}-empty`).style.display = 'flex';
  
  await saveToSupabase();
  showNotification('Mise zrušena', 'error');
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeHours(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function startTimer(slot) {
  const mission = gameState.missionData.activeMissions[slot];
  if (!mission) return;

  // doplň akční tlačítka (přeskočit / doplnit energii / zaútočit)
  ensureMissionActionButtons(slot);
  
  updateTimerDisplay(slot);
  
  missionTimers[slot] = setInterval(() => {
    // Přepočítej remaining time podle elapsed času (přesněji než --remainingTime)
    const elapsed = Math.floor((Date.now() - mission.startTime) / 1000);
    mission.remainingTime = Math.max(0, mission.duration - elapsed);
    
    updateTimerDisplay(slot);
    saveToSupabase();
    
    if (mission.remainingTime <= 0) {
      clearInterval(missionTimers[slot]);
      missionTimers[slot] = null;
      missionComplete(slot);
    }
  }, 1000);
}

function updateTimerDisplay(slot) {
  const mission = gameState.missionData.activeMissions[slot];
  if (!mission) return;

  ensureMissionActionButtons(slot);
  
  const timerEl = document.getElementById(`${slot}-timer`);
  if (timerEl) {
    timerEl.textContent = formatTime(mission.remainingTime);
  }

  // když je hotovo, zobraz "ZAÚTOČIT"
  const attackBtn = document.getElementById(`${slot}-attack-btn`);
  if (attackBtn) {
    attackBtn.style.display = mission.remainingTime <= 0 ? 'flex' : 'none';
  }
}

function missionComplete(slot) {
  const mission = gameState.missionData.activeMissions[slot];
  if (!mission) return;

  // mise doběhla – NEpřesměrovávej automaticky, jen nabídni tlačítko
  mission.remainingTime = 0;
  mission.readyToAttack = true;
  ensureMissionActionButtons(slot);
  updateTimerDisplay(slot);
  
  const missionData = {
    fromMission: true,
    autoStart: true,
    enemy: mission.enemy,
    rewards: mission.rewards,
    missionName: mission.name,
    difficulty: mission.difficulty,
    slot: slot
  };
  
  sessionStorage.setItem('arenaFromMission', JSON.stringify(missionData));

  // Jednotný context pro arena2 (spolehlivější autostart + budoucí kompatibilita)
  try {
    sessionStorage.setItem('arena2_context', JSON.stringify({
      type: 'mission',
      autoStart: true,
      enemy: mission.enemy,
      rewards: mission.rewards,
      missionName: mission.name,
      difficulty: mission.difficulty,
      slot
    }));
  } catch (_) {}

  showNotification('Mise hotová! Klikni na "ZAÚTOČIT".', 'success');
}

// ===== MISSION ACTION BUTTONS (skip / energy / attack) =====
const SKIP_MISSION_COST = 1000;

// ===== ENERGY BALANCE (S&F vibe) =====
function clampInt(n, min=0, max=1e9){
  n = Math.floor(Number(n)||0);
  return Math.max(min, Math.min(max, n));
}

function missionEnergyCost(difficulty, durationSec, level){
  const d = String(difficulty||'medium');
  const dur = Math.max(60, Number(durationSec)||60);
  const lvl = Math.max(1, Number(level)||1);
  const base = Math.ceil(dur / 600) * 2; // každých 10 min = +2
  const diff = { easy:6, medium:8, hard:10, extreme:12 }[d] ?? 8;
  const lvlTax = Math.floor(lvl / 10);
  return clampInt(base + diff + lvlTax, 8, 40);
}

function todayKey(){
  // lokální den (pro denní reset)
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function getEnergyRefillState(){
  try {
    const raw = localStorage.getItem('sf_energy_refill');
    const obj = raw ? JSON.parse(raw) : null;
    const t = todayKey();
    if (!obj || obj.date !== t) return { date: t, count: 0 };
    return { date: t, count: clampInt(obj.count||0, 0, 999) };
  } catch (_) {
    return { date: todayKey(), count: 0 };
  }
}

function setEnergyRefillState(st){
  try {
    localStorage.setItem('sf_energy_refill', JSON.stringify(st));
  } catch (_) {}
}

function getRefillCostCigs(){
  const st = getEnergyRefillState();
  // 1,2,3,5,8,... cap 25 / den
  const cost = Math.min(25, Math.max(1, Math.round(Math.pow(1.7, st.count))));
  return { cost, st };
}


function ensureMissionActionButtons(slot) {
  const activeCard = document.getElementById(`${slot}-active`);
  if (!activeCard) return;

  // najdi sekci s timerem
  const timerSection = activeCard.querySelector('.timer-section');
  if (!timerSection) return;

  let box = activeCard.querySelector('.mission-actions');
  if (!box) {
    box = document.createElement('div');
    box.className = 'mission-actions';
    // vlož hned za timer-section
    timerSection.insertAdjacentElement('afterend', box);
  }

  // 1) ZAÚTOČIT (objeví se až po doběhnutí)
  if (!document.getElementById(`${slot}-attack-btn`)) {
    const btn = document.createElement('button');
    btn.id = `${slot}-attack-btn`;
    btn.type = 'button';
    btn.className = 'timer-action-btn';
    btn.style.display = 'none';
    btn.innerHTML = `⚔️ ZAÚTOČIT`;
    btn.addEventListener('click', () => {
      // payload je už připravený v missionComplete; kdyby někdo klikl hned po reloadu,
      // vytvoř znovu pro jistotu
      const mission = gameState.missionData.activeMissions[slot];
      if (mission) {
        try {
          sessionStorage.setItem('arena2_context', JSON.stringify({
            type: 'mission',
            autoStart: true,
            enemy: mission.enemy,
            rewards: mission.rewards,
            missionName: mission.name,
            difficulty: mission.difficulty,
            slot
          }));
        } catch (_) {}
      }
      window.location.href = 'arena2.html';
    });
    box.appendChild(btn);
  }

  // 2) Přeskočit časovač (za 1000 grošů)
  if (!document.getElementById(`${slot}-skip-btn`)) {
    const btn = document.createElement('button');
    btn.id = `${slot}-skip-btn`;
    btn.type = 'button';
    btn.className = 'timer-small-btn';
    btn.innerHTML = `⏩ Přeskočit (${SKIP_MISSION_COST.toLocaleString('cs-CZ')}🪙)`;
    btn.addEventListener('click', async () => {
      const mission = gameState.missionData.activeMissions[slot];
      if (!mission) return;
      if (mission.remainingTime <= 0) {
        showNotification('Mise už je hotová.', 'info');
        return;
      }
      if (gameState.money < SKIP_MISSION_COST) {
        showNotification('Nemáš dost grošů!', 'error');
        return;
      }
      gameState.money -= SKIP_MISSION_COST;
      // nastav tak, aby to bylo "dokončeno"
      mission.startTime = Date.now() - (mission.duration * 1000);
      mission.remainingTime = 0;
      await saveToSupabase();
      updateUI();
      missionComplete(slot);
    });
    box.appendChild(btn);
  }

    // 3) Doplnit energii (za 🚬, cena roste během dne)
  const existingRefill = document.getElementById('refill-energy-btn');
  if (existingRefill) {
    existingRefill.innerHTML = `⚡ Doplnit energii (${(getRefillCostCigs().cost)}🚬)`;
  }

  if (!existingRefill) {
    const btn = document.createElement('button');
    btn.id = 'refill-energy-btn';
    btn.type = 'button';
    btn.className = 'timer-small-btn';

    const syncLabel = () => {
      const { cost } = getRefillCostCigs();
      btn.innerHTML = `⚡ Doplnit energii (${cost}🚬)`;
    };
    syncLabel();

    btn.addEventListener('click', async () => {
      const { cost, st } = getRefillCostCigs();
      if (gameState.cigarettes < cost) {
        showNotification(`Nemáš dost cigaret! (${cost}🚬)`, 'error');
        return;
      }
      if (gameState.energy >= gameState.maxEnergy) {
        showNotification('Energie už je plná.', 'info');
        return;
      }
      gameState.cigarettes -= cost;
      gameState.energy = gameState.maxEnergy;
      st.count = (st.count || 0) + 1;
      setEnergyRefillState(st);
      await saveToSupabase();
      updateUI();
      syncLabel();
      showNotification('Energie doplněna!', 'success');
    });

    // vlož do prvního boxu (slot1) – je to globální tlačítko, ale vizuálně sedí do misí
    box.appendChild(btn);
  }
  else {
    // když už existuje, jen aktualizuj cenu
    try {
      const btn = document.getElementById('refill-energy-btn');
      if (btn) {
        const { cost } = getRefillCostCigs();
        btn.innerHTML = `⚡ Doplnit energii (${cost}🚬)`;
      }
    } catch (_) {}
  }
}

function restoreMissions() {
  getUnlockedSlots().forEach(slot => {
    const mission = gameState.missionData.activeMissions[slot];
    if (mission) {
      // Přepočítej remaining time podle uloženého startTime
      if (mission.startTime) {
        const elapsed = Math.floor((Date.now() - mission.startTime) / 1000);
        mission.remainingTime = Math.max(0, mission.duration - elapsed);
      }
      
      const emptyEl = document.getElementById(`${slot}-empty`);
      const activeEl = document.getElementById(`${slot}-active`);
      if (emptyEl) emptyEl.style.display = 'none';
      if (activeEl) activeEl.style.display = 'flex';
      
      const nameEl = document.getElementById(`${slot}-name`);
      const diffEl = document.getElementById(`${slot}-difficulty`);
      const storyEl = document.getElementById(`${slot}-story`);
      if (nameEl) nameEl.textContent = mission.name;
      if (diffEl) {
        diffEl.textContent = mission.difficulty.toUpperCase();
        diffEl.className = `mission-difficulty ${mission.difficulty}`;
      }
      if (storyEl) storyEl.textContent = mission.story;
      
      startTimer(slot);
    }
  });
}

// ===== SLOT UPGRADE (4-6) =====
function syncMissionSlotUnlockUI() {
  const unlocked = Math.max(3, Math.min(6, Number(gameState?.missionData?.unlockedSlots || 3)));

  for (let i = 4; i <= 6; i++) {
    const lockedEl = document.getElementById(`slot${i}-locked`);
    const emptyEl = document.getElementById(`slot${i}-empty`);
    const activeEl = document.getElementById(`slot${i}-active`);
    const isUnlocked = i <= unlocked;

    if (!lockedEl || !emptyEl || !activeEl) continue;

    if (!isUnlocked) {
      lockedEl.style.display = 'flex';
      emptyEl.style.display = 'none';
      activeEl.style.display = 'none';
    } else {
      // pokud je slot odemčený, ukaž empty nebo active podle stavu
      lockedEl.style.display = 'none';
      const m = gameState.missionData.activeMissions[`slot${i}`];
      if (m) {
        emptyEl.style.display = 'none';
        activeEl.style.display = 'flex';
      } else {
        emptyEl.style.display = 'flex';
        activeEl.style.display = 'none';
      }
    }
  }
}

async function upgradeMissionSlot(slotNumber) {
  const n = Number(slotNumber);
  if (!Number.isFinite(n) || n < 4 || n > 6) return;

  const current = Math.max(3, Math.min(6, Number(gameState?.missionData?.unlockedSlots || 3)));
  if (n !== current + 1) {
    showNotification('Nejdřív odemkni předchozí slot!', 'error');
    return;
  }

  const COST = 500;
  if (gameState.cigarettes < COST) {
    showNotification('Nemáš dost cigaret! (500🚬)', 'error');
    return;
  }

  gameState.cigarettes -= COST;
  gameState.missionData.unlockedSlots = current + 1;

  // ujisti se, že slot existuje v activeMissions
  const key = `slot${n}`;
  if (!gameState.missionData.activeMissions) gameState.missionData.activeMissions = {};
  if (!(key in gameState.missionData.activeMissions)) gameState.missionData.activeMissions[key] = null;

  await saveToSupabase();
  updateUI();
  syncMissionSlotUnlockUI();
  showNotification(`Odemčeno: MISE #${n}!`, 'success');
}

// ===== ASSASSIN SYSTEM =====
function calculateAssassinReward() {
  return Math.min(20000, Math.floor(gameState.level * 800 + Math.random() * 200));
}

function updateAssassinRewardDisplay() {
  const reward = calculateAssassinReward();
  const rewardText = document.getElementById('assassin-reward-text');
  if (rewardText) {
    rewardText.textContent = `${reward.toLocaleString('cs-CZ')}🪙`;
  }
}

async function hireAssassin() {
  if (gameState.missionData.assassin.active) {
    showNotification('Vrah už pracuje!', 'error');
    return;
  }
  
  const needE = clampInt(30 + Math.floor((gameState.level || 1) / 2), 30, 60);
  if (gameState.energy < needE) {
    showNotification(`Potřebuješ ${needE} energie!`, 'error');
    return;
  }
  
  gameState.energy -= needE;
  gameState.missionData.assassin.active = true;
  gameState.missionData.assassin.startTime = Date.now();
  
  document.getElementById('assassin-idle').style.display = 'none';
  document.getElementById('assassin-active').style.display = 'flex';
  
  startAssassinTimer();
  
  await saveToSupabase();
  updateUI();
  showNotification('Vrah najat! Pracuje 14 hodin...', 'success');
}

function startAssassinTimer() {
  const ASSASSIN_DURATION = 14 * 60 * 60; // 14 hodin v sekundách
  
  const updateTimer = () => {
    if (!gameState.missionData.assassin.active || !gameState.missionData.assassin.startTime) return;
    
    const elapsed = Math.floor((Date.now() - gameState.missionData.assassin.startTime) / 1000);
    const remaining = Math.max(0, ASSASSIN_DURATION - elapsed);
    
    const timerEl = document.getElementById('assassin-timer');
    if (timerEl) {
      timerEl.textContent = formatTimeHours(remaining);
    }
    
    if (remaining <= 0) {
      clearInterval(assassinTimer);
      assassinTimer = null;
      const collectBtn = document.getElementById('collect-assassin-btn');
      if (collectBtn) {
        collectBtn.style.display = 'flex';
      }
    }
  };
  
  updateTimer();
  assassinTimer = setInterval(updateTimer, 1000);
}

async function collectAssassinReward() {
  if (!gameState.missionData.assassin.active) return;
  
  const reward = calculateAssassinReward();
  gameState.money += reward;
  gameState.missionData.totalMoneyEarned += reward;
  
  // Reset assassin
  gameState.missionData.assassin.active = false;
  gameState.missionData.assassin.startTime = null;
  
  // Show idle state
  document.getElementById('assassin-active').style.display = 'none';
  document.getElementById('assassin-idle').style.display = 'flex';
  const collectBtn = document.getElementById('collect-assassin-btn');
  if (collectBtn) {
    collectBtn.style.display = 'none';
  }
  
  await saveToSupabase();
  updateUI();
  updateStats();
  
  showNotification(`Vrah dokončil práci! +${reward.toLocaleString('cs-CZ')}🪙`, 'success');
}

function restoreAssassin() {
  updateAssassinRewardDisplay();
  
  if (gameState.missionData.assassin.active && gameState.missionData.assassin.startTime) {
    const ASSASSIN_DURATION = 14 * 60 * 60;
    const elapsed = Math.floor((Date.now() - gameState.missionData.assassin.startTime) / 1000);
    
    if (elapsed >= ASSASSIN_DURATION) {
      // Hotovo
      document.getElementById('assassin-idle').style.display = 'none';
      document.getElementById('assassin-active').style.display = 'flex';
      const collectBtn = document.getElementById('collect-assassin-btn');
      if (collectBtn) {
        collectBtn.style.display = 'flex';
      }
      const timerEl = document.getElementById('assassin-timer');
      if (timerEl) {
        timerEl.textContent = '00:00:00';
      }
    } else {
      // Stále pracuje
      document.getElementById('assassin-idle').style.display = 'none';
      document.getElementById('assassin-active').style.display = 'flex';
      startAssassinTimer();
    }
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
  console.log('🎯 Initializing mission system...');
  
  await initUser();
  
  // Event listeners pro tlačítka
  const hireBtn = document.getElementById('hire-assassin-btn');
  const collectBtn = document.getElementById('collect-assassin-btn');
  
  if (hireBtn) hireBtn.addEventListener('click', hireAssassin);
  if (collectBtn) collectBtn.addEventListener('click', collectAssassinReward);
  
  // Auto-regenerace energie každou minutu
  setInterval(() => {
    regenerateEnergy();
    saveToSupabase();
    updateUI();
  }, 60000);
  
  // Auto-save každých 30 sekund
  setInterval(() => {
    saveToSupabase();
  }, 30000);
  
  console.log('✅ Mission system loaded!');
});

// ===== CSS ANIMATIONS =====
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

// ===== EXPOSE FOR HTML =====
window.startMission = startMission;
window.cancelMission = cancelMission;

// ===== CHEAT CODES (pro testování) =====
console.log('%c🎮 GOPNIK CHEAT CODES 🎮', 'font-size: 20px; font-weight: bold; color: #f1d27a; text-shadow: 2px 2px 4px #000;');
console.log('%cPříkazy:', 'font-size: 14px; color: #10b981;');
console.log('%cskipTime("slot1")   - Přeskočit čas mise slot1', 'color: #fff;');
console.log('%cskipTime("slot2")   - Přeskočit čas mise slot2', 'color: #fff;');
console.log('%caddEnergy(50)       - Přidat energii', 'color: #fff;');
console.log('%caddMoney(10000)     - Přidat groše', 'color: #fff;');
console.log('%caddLevel(5)         - Přidat levely', 'color: #fff;');
console.log('%cskipAssassin()      - Dokončit vraha okamžitě', 'color: #fff;');

window.skipTime = function(slot) {
  const mission = gameState.missionData.activeMissions[slot];
  if (!mission) {
    console.log('%c❌ Není aktivní mise v tomto slotu!', 'color: #ef4444; font-weight: bold;');
    return;
  }
  mission.remainingTime = 0;
  mission.startTime = Date.now() - (mission.duration * 1000);
  console.log(`%c✅ Čas přeskočen pro ${slot}!`, 'color: #10b981; font-weight: bold;');
};

window.addEnergy = async function(amount) {
  gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + amount);
  await saveToSupabase();
  updateUI();
  console.log(`%c✅ Přidáno ${amount} energie!`, 'color: #10b981; font-weight: bold;');
};

window.addMoney = async function(amount) {
  gameState.money += amount;
  await saveToSupabase();
  updateUI();
  console.log(`%c✅ Přidáno ${amount}🪙!`, 'color: #10b981; font-weight: bold;');
};

window.addLevel = async function(amount) {
  gameState.level += amount;
  await saveToSupabase();
  updateUI();
  console.log(`%c✅ Přidáno ${amount} levelů!`, 'color: #10b981; font-weight: bold;');
};

window.skipAssassin = function() {
  if (!gameState.missionData.assassin.active) {
    console.log('%c❌ Vrah není aktivní!', 'color: #ef4444; font-weight: bold;');
    return;
  }
  gameState.missionData.assassin.startTime = Date.now() - (14 * 60 * 60 * 1000);
  restoreAssassin();
  console.log('%c✅ Vrah dokončen!', 'color: #10b981; font-weight: bold;');
};

console.log('✅ Mission system fully loaded!');
