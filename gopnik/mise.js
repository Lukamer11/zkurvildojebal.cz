// Mission System - Gopnik Style v2.0
let playerLevel = 1;
let playerMoney = 3170;
let playerCigarettes = 42;
let playerEnergy = 100;
let playerMaxEnergy = 100;

// Stats
let completedMissions = 0;
let totalExpEarned = 0;
let totalMoneyEarned = 0;
let totalBattles = 0;
let totalWins = 0;

// Active missions data (2 slots)
let activeMissions = {
  slot1: null,
  slot2: null
};

// Mission timers
let missionTimers = {
  slot1: null,
  slot2: null
};

// Hired assassin
let assassinActive = false;
let assassinTimer = null;
let assassinStartTime = null;

// Random mission templates by difficulty (EXPANDED - MORE MISSIONS!)
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

// Load saved data
function loadGameData() {
  const saved = sessionStorage.getItem('missionData');
  if (saved) {
    const data = JSON.parse(saved);
    playerLevel = data.level || 1;
    playerMoney = data.money || 3170;
    playerCigarettes = data.cigarettes || 42;
    playerEnergy = data.energy !== undefined ? data.energy : 100;
    completedMissions = data.completed || 0;
    totalExpEarned = data.totalExp || 0;
    totalMoneyEarned = data.totalMoney || 0;
    totalBattles = data.battles || 0;
    totalWins = data.wins || 0;
    
    // Load active missions
    if (data.missions) {
      activeMissions = data.missions;
    }
    
    // Load assassin
    if (data.assassin) {
      assassinActive = data.assassin.active || false;
      assassinStartTime = data.assassin.startTime || null;
    }
  }
  
  // Regenerate energy (1 per 5 minutes)
  const lastEnergyUpdate = sessionStorage.getItem('lastEnergyUpdate');
  if (lastEnergyUpdate) {
    const timePassed = Date.now() - parseInt(lastEnergyUpdate);
    const energyGained = Math.floor(timePassed / (5 * 60 * 1000));
    if (energyGained > 0) {
      playerEnergy = Math.min(playerMaxEnergy, playerEnergy + energyGained);
      sessionStorage.setItem('lastEnergyUpdate', Date.now().toString());
    }
  } else {
    sessionStorage.setItem('lastEnergyUpdate', Date.now().toString());
  }
  
  updateUI();
  updateStats();
  restoreMissions();
  restoreAssassin();
}

// Save game data
function saveGameData() {
  const data = {
    level: playerLevel,
    money: playerMoney,
    cigarettes: playerCigarettes,
    energy: playerEnergy,
    completed: completedMissions,
    totalExp: totalExpEarned,
    totalMoney: totalMoneyEarned,
    battles: totalBattles,
    wins: totalWins,
    missions: activeMissions,
    assassin: {
      active: assassinActive,
      startTime: assassinStartTime
    }
  };
  sessionStorage.setItem('missionData', JSON.stringify(data));
}

// Update UI
function updateUI() {
  document.getElementById('money').textContent = playerMoney.toLocaleString();
  document.getElementById('cigarettes').textContent = playerCigarettes;
  document.getElementById('levelDisplay').textContent = playerLevel;
  document.getElementById('energy').textContent = playerEnergy;
  
  // Update energy bar
  const energyPercent = (playerEnergy / playerMaxEnergy) * 100;
  document.getElementById('energyFill').style.width = `${energyPercent}%`;
  document.getElementById('energyText').textContent = `${playerEnergy} / ${playerMaxEnergy}`;
}

// Update stats
function updateStats() {
  document.getElementById('completed-missions').textContent = completedMissions;
  document.getElementById('total-exp-earned').textContent = totalExpEarned.toLocaleString();
  document.getElementById('total-money-earned').textContent = `${totalMoneyEarned.toLocaleString()}₽`;
  
  const winRate = totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0;
  document.getElementById('win-rate').textContent = `${winRate}%`;
}

// Get difficulty based on player level
function getDifficulty() {
  if (playerLevel <= 3) return 'easy';
  if (playerLevel <= 7) return 'medium';
  if (playerLevel <= 12) return 'hard';
  return 'extreme';
}

// Get random mission duration (5-20 minutes in seconds)
function getRandomDuration() {
  return Math.floor(Math.random() * (20 - 5 + 1) + 5) * 60;
}

// Calculate rewards based on level and difficulty
function calculateRewards(difficulty) {
  const baseExp = playerLevel * 10;
  const baseMoney = playerLevel * 50;
  
  let multiplier = 1;
  switch(difficulty) {
    case 'easy': multiplier = 1; break;
    case 'medium': multiplier = 1.5; break;
    case 'hard': multiplier = 2.5; break;
    case 'extreme': multiplier = 4; break;
  }
  
  const exp = Math.floor(baseExp * multiplier * (0.8 + Math.random() * 0.4));
  const money = Math.floor(baseMoney * multiplier * (0.8 + Math.random() * 0.4));
  
  return { exp, money };
}

// Generate random mission
function generateMission(slot) {
  // Check energy
  if (playerEnergy < 15) {
    showNotification('Nemáš dost energie! (15 energie potřeba)', 'error');
    return null;
  }
  
  // Deduct energy
  playerEnergy -= 15;
  
  const difficulty = getDifficulty();
  const templates = missionTemplates[difficulty];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // Get duration, make sure it's different from other slot
  let duration = getRandomDuration();
  const otherSlot = slot === 'slot1' ? 'slot2' : 'slot1';
  if (activeMissions[otherSlot] && Math.abs(activeMissions[otherSlot].duration - duration) < 60) {
    duration += Math.floor(Math.random() * 120) + 60; // Add 1-3 minutes
    duration = Math.max(300, duration);
  }
  
  const rewards = calculateRewards(difficulty);
  
  // Pick random enemy
  const enemyIndex = Math.floor(Math.random() * template.enemies.length);
  const enemy = {
    name: template.enemies[enemyIndex],
    emoji: template.emojis[enemyIndex],
    hp: Math.floor(playerLevel * 80 + Math.random() * 40),
    damage: Math.floor(playerLevel * 8 + Math.random() * 5)
  };
  
  const mission = {
    name: template.name,
    story: template.story,
    difficulty: difficulty,
    duration: duration,
    remainingTime: duration,
    rewards: rewards,
    enemy: enemy,
    slot: slot
  };
  
  activeMissions[slot] = mission;
  saveGameData();
  updateUI();
  
  return mission;
}

// Start mission in specific slot
function startMission(slot) {
  const mission = generateMission(slot);
  if (!mission) return;
  
  // Hide empty, show active
  document.getElementById(`${slot}-empty`).style.display = 'none';
  document.getElementById(`${slot}-active`).style.display = 'flex';
  
  // Fill mission details
  document.getElementById(`${slot}-name`).textContent = mission.name;
  document.getElementById(`${slot}-difficulty`).textContent = mission.difficulty.toUpperCase();
  document.getElementById(`${slot}-difficulty`).className = `mission-difficulty ${mission.difficulty}`;
  document.getElementById(`${slot}-story`).textContent = mission.story;
  
  // Start timer
  startTimer(slot);
  
  showNotification(`Mise spuštěna! -15 energie`, 'success');
}

// Cancel mission
function cancelMission(slot) {
  if (!confirm('Opravdu chceš zrušit tuto misi? Nedostaneš energii zpět!')) return;
  
  // Clear timer
  if (missionTimers[slot]) {
    clearInterval(missionTimers[slot]);
    missionTimers[slot] = null;
  }
  
  // Clear mission data
  activeMissions[slot] = null;
  
  // Show empty, hide active
  document.getElementById(`${slot}-active`).style.display = 'none';
  document.getElementById(`${slot}-empty`).style.display = 'flex';
  
  saveGameData();
  showNotification('Mise zrušena', 'error');
}

// Format time
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Format time for assassin (hours:minutes:seconds)
function formatTimeHours(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Start timer for slot
function startTimer(slot) {
  const mission = activeMissions[slot];
  if (!mission) return;
  
  updateTimerDisplay(slot);
  
  missionTimers[slot] = setInterval(() => {
    mission.remainingTime--;
    updateTimerDisplay(slot);
    saveGameData();
    
    if (mission.remainingTime <= 0) {
      clearInterval(missionTimers[slot]);
      missionTimers[slot] = null;
      missionComplete(slot);
    }
  }, 1000);
}

// Update timer display
function updateTimerDisplay(slot) {
  const mission = activeMissions[slot];
  if (!mission) return;
  
  document.getElementById(`${slot}-timer`).textContent = formatTime(mission.remainingTime);
}

// Mission complete - redirect to arena
function missionComplete(slot) {
  const mission = activeMissions[slot];
  if (!mission) return;
  
  // Save mission enemy data for arena
  const missionData = {
    fromMission: true,
    enemy: mission.enemy,
    rewards: mission.rewards,
    missionName: mission.name,
    difficulty: mission.difficulty,
    slot: slot
  };
  
  sessionStorage.setItem('arenaFromMission', JSON.stringify(missionData));
  
  // Show notification and redirect
  showNotification('Mise hotová! Přesměrování do areny...', 'success');
  
  setTimeout(() => {
    window.location.href = 'arena.html';
  }, 1500);
}

// Restore missions from saved data
function restoreMissions() {
  ['slot1', 'slot2'].forEach(slot => {
    const mission = activeMissions[slot];
    if (mission) {
      // Show mission card
      document.getElementById(`${slot}-empty`).style.display = 'none';
      document.getElementById(`${slot}-active`).style.display = 'flex';
      
      // Fill details
      document.getElementById(`${slot}-name`).textContent = mission.name;
      document.getElementById(`${slot}-difficulty`).textContent = mission.difficulty.toUpperCase();
      document.getElementById(`${slot}-difficulty`).className = `mission-difficulty ${mission.difficulty}`;
      document.getElementById(`${slot}-story`).textContent = mission.story;
      
      // Start timer
      startTimer(slot);
    }
  });
}

// ===== ASSASSIN SYSTEM =====

function calculateAssassinReward() {
  return Math.min(20000, Math.floor(playerLevel * 800 + Math.random() * 200));
}

function updateAssassinRewardDisplay() {
  const reward = calculateAssassinReward();
  document.getElementById('assassin-reward-text').textContent = `${reward.toLocaleString()}₽`;
}

function hireAssassin() {
  if (assassinActive) {
    showNotification('Vrah už pracuje!', 'error');
    return;
  }
  
  if (playerEnergy < 50) {
    showNotification('Potřebuješ 50 energie!', 'error');
    return;
  }
  
  // Deduct energy
  playerEnergy -= 50;
  
  // Start assassin
  assassinActive = true;
  assassinStartTime = Date.now();
  
  // Show active state
  document.getElementById('assassin-idle').style.display = 'none';
  document.getElementById('assassin-active').style.display = 'flex';
  
  // Start timer
  startAssassinTimer();
  
  saveGameData();
  updateUI();
  showNotification('Vrah najat! Pracuje 14 hodin...', 'success');
}

function startAssassinTimer() {
  const ASSASSIN_DURATION = 14 * 60 * 60; // 14 hours in seconds
  
  const updateTimer = () => {
    if (!assassinActive || !assassinStartTime) return;
    
    const elapsed = Math.floor((Date.now() - assassinStartTime) / 1000);
    const remaining = Math.max(0, ASSASSIN_DURATION - elapsed);
    
    document.getElementById('assassin-timer').textContent = formatTimeHours(remaining);
    
    if (remaining <= 0) {
      // Assassin done
      clearInterval(assassinTimer);
      assassinTimer = null;
      document.getElementById('collect-assassin-btn').style.display = 'flex';
    }
  };
  
  updateTimer();
  assassinTimer = setInterval(updateTimer, 1000);
}

function collectAssassinReward() {
  if (!assassinActive) return;
  
  const reward = calculateAssassinReward();
  playerMoney += reward;
  totalMoneyEarned += reward;
  
  // Reset assassin
  assassinActive = false;
  assassinStartTime = null;
  
  // Show idle state
  document.getElementById('assassin-active').style.display = 'none';
  document.getElementById('assassin-idle').style.display = 'flex';
  document.getElementById('collect-assassin-btn').style.display = 'none';
  
  saveGameData();
  updateUI();
  updateStats();
  
  showNotification(`Vrah dokončil práci! +${reward.toLocaleString()}₽`, 'success');
}

function restoreAssassin() {
  updateAssassinRewardDisplay();
  
  if (assassinActive && assassinStartTime) {
    const ASSASSIN_DURATION = 14 * 60 * 60;
    const elapsed = Math.floor((Date.now() - assassinStartTime) / 1000);
    
    if (elapsed >= ASSASSIN_DURATION) {
      // Done
      document.getElementById('assassin-idle').style.display = 'none';
      document.getElementById('assassin-active').style.display = 'flex';
      document.getElementById('collect-assassin-btn').style.display = 'flex';
      document.getElementById('assassin-timer').textContent = '00:00:00';
    } else {
      // Still working
      document.getElementById('assassin-idle').style.display = 'none';
      document.getElementById('assassin-active').style.display = 'flex';
      startAssassinTimer();
    }
  }
}

// Show notification
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

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadGameData();
  
  // Assassin buttons
  const hireBtn = document.getElementById('hire-assassin-btn');
  const collectBtn = document.getElementById('collect-assassin-btn');
  
  if (hireBtn) hireBtn.addEventListener('click', hireAssassin);
  if (collectBtn) collectBtn.addEventListener('click', collectAssassinReward);
  
  // Energy regeneration
  setInterval(() => {
    const lastUpdate = parseInt(sessionStorage.getItem('lastEnergyUpdate') || Date.now());
    const timePassed = Date.now() - lastUpdate;
    const energyGained = Math.floor(timePassed / (5 * 60 * 1000));
    
    if (energyGained > 0) {
      playerEnergy = Math.min(playerMaxEnergy, playerEnergy + energyGained);
      sessionStorage.setItem('lastEnergyUpdate', Date.now().toString());
      saveGameData();
      updateUI();
    }
  }, 60000);
});

// Add CSS animation
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

// CHEAT CODES
console.log('%c🎮 GOPNIK CHEAT CODES 🎮', 'font-size: 20px; font-weight: bold; color: #f1d27a; text-shadow: 2px 2px 4px #000;');
console.log('%cPříkazy:', 'font-size: 14px; color: #10b981;');
console.log('%cskipTime("slot1")   - Přeskočit čas mise slot1', 'color: #fff;');
console.log('%cskipTime("slot2")   - Přeskočit čas mise slot2', 'color: #fff;');
console.log('%caddEnergy(50)       - Přidat energii', 'color: #fff;');
console.log('%caddMoney(10000)     - Přidat groše', 'color: #fff;');
console.log('%caddLevel(5)         - Přidat levely', 'color: #fff;');
console.log('%cskipAssassin()      - Dokončit vraha okamžitě', 'color: #fff;');

window.skipTime = function(slot) {
  const mission = activeMissions[slot];
  if (!mission) {
    console.log('%c❌ Není aktivní mise v tomto slotu!', 'color: #ef4444; font-weight: bold;');
    return;
  }
  mission.remainingTime = 0;
  console.log(`%c✅ Čas přeskočen pro ${slot}!`, 'color: #10b981; font-weight: bold;');
};

window.addEnergy = function(amount) {
  playerEnergy = Math.min(playerMaxEnergy, playerEnergy + amount);
  saveGameData();
  updateUI();
  console.log(`%c✅ Přidáno ${amount} energie!`, 'color: #10b981; font-weight: bold;');
};

window.addMoney = function(amount) {
  playerMoney += amount;
  saveGameData();
  updateUI();
  console.log(`%c✅ Přidáno ${amount}₽!`, 'color: #10b981; font-weight: bold;');
};

window.addLevel = function(amount) {
  playerLevel += amount;
  saveGameData();
  updateUI();
  console.log(`%c✅ Přidáno ${amount} levelů!`, 'color: #10b981; font-weight: bold;');
};

window.skipAssassin = function() {
  if (!assassinActive) {
    console.log('%c❌ Vrah není aktivní!', 'color: #ef4444; font-weight: bold;');
    return;
  }
  assassinStartTime = Date.now() - (14 * 60 * 60 * 1000);
  restoreAssassin();
  console.log('%c✅ Vrah dokončen!', 'color: #10b981; font-weight: bold;');
};

console.log('Mission system loaded! 🎯');