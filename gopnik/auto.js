const supabaseClient = () => window.supabaseClient;
async function ensureOnline() {
  if (window.SFReady) await window.SFReady;
  const sb = supabaseClient();
  if (!sb) throw new Error('Supabase client není inicializovaný (načti menu.js před tímto skriptem)');
  return sb;
}

// ===== BOSS DATA =====
const BOSSES = [
  {
    level: 1,
    name: "STARÝ DĚDEK GOMEZ",
    icon: "👴",
    hp: 1500,
    avatar: "boss1.jpg",
    story: "V první cryptě panelāku č.1 sedí starý dědek Gomez. Kdysi byl legendou, teraz strāží svůj poklad - zlatou lāhev vodky. Ale i v pokročilém věku umí pořādně nafackovat!",
    encounterText: "Vstupuješ do zaprāšené crypty. Starý Gomez zvedne hlavu a zavrčí: 'Kdo to sem leze?! Moje vodka!' Chytá hůl a jde na tebe!",
    background: "boss1.jpg",
    reward: { type: "weapon", id: "gomez_cane", name: "Gomezova Hůl", icon: "🦯", bonuses: { strength: 15, luck: 5 } }
  },
  {
    level: 2,
    name: "Igor 'ŽELEZNÁ PĚST'",
    icon: "👊",
    hp: 2000,
    avatar: "boss2.jpg",
    story: "Druhā crypta je domovem Igora, bývalého boxera. Jeho pěsti jsou tvrdé jako beton z panelového domu. Říkā se, že nikdy neprohrāl souboj... dokud nepřišel alkohol.",
    encounterText: "Slyšíš dunění kroků. Igor se vynořuje ze stínů: 'Tak ty chceš zkusit moje pěsti?' Zvedā obě ruce a útočí!",
    background: "boss2.jpg",
    reward: { type: "armor", id: "iron_gloves", name: "Železné Rukavice", icon: "🥊", bonuses: { strength: 20, defense: 15 } }
  },
  {
    level: 3,
    name: "BABUSHKA NATAŠA",
    icon: "👵",
    hp: 2500,
    avatar: "boss3.jpg",
    story: "Třetí crypta je plnā kočiček a zāpachu zelí. Babushka Nataša může vypadat nevinně, ale její pānvička způsobila mnoho otřesů mozku. Nikdy nepodceňuj babičku s pānví!",
    encounterText: "Vůně zelí tě udeří do nosu. Babushka se otočí s pānví v ruce: 'Ty myslíš, že ukradneš moje zelí?!' Rozmāchuje se na tebe!",
    background: "boss3.jpg",
    reward: { type: "weapon", id: "babushka_pan", name: "Babičina Pānev", icon: "🍳", bonuses: { strength: 25, constitution: 10 } }
  },
  {
    level: 4,
    name: "VLADIMIR 'MECHANIK'",
    icon: "🔧",
    hp: 3000,
    avatar: "boss4.jpg",
    story: "Čtvrtā crypta je plnā rozbitých Lad. Vladimir byl nejlepší mechanik v celém bloku, dokud neztratil rozum z benzínových výparů. Teraz opravuje jen lebky protivníků.",
    encounterText: "Slyšíš zvuk klíče na kov. Vladimir vyskočí zpoza Lady: 'Jdeš pokazit moje dīlo?!' Mīří na tebe obřím klíčem!",
    background: "boss4.jpg",
    reward: { type: "special", id: "wrench", name: "Mechanikův Klíč", icon: "🔧", bonuses: { strength: 30, dexterity: 15 } }
  },
  {
    level: 5,
    name: "OLGA 'KRÃLOVNA GOPNÍKŮ'",
    icon: "👸",
    hp: 3500,
    avatar: "boss5.jpg",
    story: "Pātā crypta zāří zlatem semínek a Adidas pruhů. Olga vlādne všem gopníkům v okolí. Její čučící je legendārnī a její kopačky smrtící. Připrav se na krālovský výprask!",
    encounterText: "Sedí na hromadě semínek a kouká na tebe: 'Ty myslíš, že máš dost sily na mě?' Vstāvā a natahuje nohu pro smrtící kopačku!",
    background: "boss5.jpg",
    reward: { type: "armor", id: "gopnik_tracksuit", name: "Krālovskā Teplākovka", icon: "👕", bonuses: { dexterity: 25, luck: 20 } }
  },
  {
    level: 6,
    name: "BORIS 'MEDVĚD'",
    icon: "🐻",
    hp: 4000,
    avatar: "boss6.jpg",
    story: "Šestā crypta je plnā prāzdných sudů piva. Boris není člověk - je to doslova medvěd, který se naučil pít vodku. Je silný jako tank a hloupý jako... no, medvěd.",
    encounterText: "Zāpach alkoholu je nepřekonatelný. Medvěd Boris zavrčí a vstane na zadní: 'RRROOOAAAAR!' Útočí s plnou silou!",
    background: "boss6.jpg",
    reward: { type: "weapon", id: "bear_claw", name: "Medvědí Spār", icon: "🐻", bonuses: { strength: 40, constitution: 20 } }
  },
  {
    level: 7,
    name: "DMITRIJ 'HACKER'",
    icon: "💻",
    hp: 4500,
    avatar: "boss7.jpg",
    story: "Sedmā crypta je plnā starých počítačů a zāpachu energeťāků. Dmitrij hackoval vše - od Ladek po jadernē elektrārny. Teraz hackuje tvé HP s kybernetickými útoky!",
    encounterText: "Obrazovky začnou blikat. Dmitrij se otočí s děsivým úsměvem: 'Pokusím se hacknout tvůj mozek!' Prsty létají po klāvesnici!",
    background: "boss7.jpg",
    reward: { type: "special", id: "laptop", name: "Hackerský Laptop", icon: "💻", bonuses: { intelligence: 40, dexterity: 20 } }
  },
  {
    level: 8,
    name: "SVETLANA 'DEATH DEALER'",
    icon: "💀",
    hp: 5000,
    avatar: "boss8.jpg",
    story: "Osmā crypta je nejděsivější mīsto v celém panelāku. Svetlana byla nejlepší dealerkou v Rusku. Nedealeovala drogy - dealeovala smrt. Její AK-47 nemā soucit.",
    encounterText: "Ticho. Pak slyšíš cvaknutí zbraně. Svetlana vychāzī ze tmy: 'Tvůj čas vypršel.' Zvedā AK-47 a mīří přímo na tebe!",
    background: "boss8.jpg",
    reward: { type: "weapon", id: "death_ak", name: "AK-47 Smrti", icon: "🔫", bonuses: { strength: 50, dexterity: 30 } }
  },
  {
    level: 9,
    name: "NIKOLAI 'OLIGARCHA'",
    icon: "💰",
    hp: 5500,
    avatar: "boss9.jpg",
    story: "Devātā crypta je plnā zlata a luxusu. Nikolai vlastní celý panelāk... vlastně vlastní celé město. Jeho peníze koupí vše, včetně tvé porāžky. Ale jeho tajemství může být odhaleno...",
    encounterText: "Počítā peníze na zlatém stole. Otočí se: 'Myslíš, že můžeš ukrāst moje bohatství?' Trhne prstem a jeho bodyguardi... ne, on sām útočí!",
    background: "boss9.jpg",
    reward: { type: "armor", id: "gold_armor", name: "Zlatā Zbroj", icon: "👔", bonuses: { defense: 40, luck: 30 } }
  },
  {
    level: 10,
    name: "VLADIMIR PUTIN CLONE",
    icon: "👔",
    hp: 6666,
    avatar: "boss10.jpg",
    story: "Desātā crypta... tajemství panelākového komplexu. Zde sedí klon samotného Putina, vytvořený v sovětské laboratoři. Je to finālní boss, konec všeho. Dokāžeš porazit moc Kremlu?!",
    encounterText: "Místnost je ledovā. Putin klon vstāvā z trůnu: 'Tak ty jsi ten, kdo se dostal až sem? Imponující. Ale teď umřeš.' Jeho oči zāří děsivou mocí!",
    background: "boss10.jpg",
    reward: { type: "special", id: "kremlin_crown", name: "Koruna Kremlu", icon: "👑", bonuses: { strength: 50, defense: 50, intelligence: 50 } }
  }
];

// ===== GAME STATE =====
let gameState = {
  userId: null,
  level: 1,
  currentCrypta: 0,
  defeatedBosses: [],
  stats: {
    strength: 18,
    defense: 14,
    dexterity: 11,
    intelligence: 11,
    constitution: 16,
    luck: 9
  },
  equipped: {},
  inventory: []
};

let currentBoss = null;

// ===== UTILITY FUNCTIONS =====
function fmtInt(n) {
  return Number(n ?? 0).toLocaleString("cs-CZ");
}

function clampHp(v) {
  return Math.max(0, Math.floor(Number(v) || 0));
}

// ===== SUPABASE FUNCTIONS =====
async function initUser() {
  try {
    await ensureOnline();
    const row = window.SF?.stats;
    if (!row?.user_id) {
      location.href = "login.html";
      return;
    }

    gameState.userId = row.user_id;
    gameState.level = row.level || 1;
    gameState.stats = row.stats || gameState.stats;
    gameState.equipped = row.equipped || {};
    gameState.inventory = row.inventory || [];

    const cryptaData = row.crypta_progress || { current: 0, defeated: [] };
    gameState.currentCrypta = cryptaData.current || 0;
    gameState.defeatedBosses = cryptaData.defeated || [];

    renderCrypta();
    updateProgress();
  } catch (error) {
    console.error("Error initializing user:", error);
  }
}

async function saveToSupabase() {
  try {
    const sb = await ensureOnline();

    const basePayload = {
      user_id: gameState.userId,
      level: gameState.level,
      stats: gameState.stats,
      equipped: gameState.equipped,
      inventory: gameState.inventory,
      crypta_progress: {
        current: gameState.currentCrypta,
        defeated: gameState.defeatedBosses
      }
    };

    let payload = { ...basePayload };

    for (let attempts = 0; attempts < 6; attempts++) {
      const { error } = await sb.from("player_stats").upsert(payload, { onConflict: "user_id" });
      if (!error) {
        if (window.SF?.updateStats) window.SF.updateStats(payload);
        return true;
      }

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
    console.error("Error saving to Supabase:", error);
    return false;
  }
}

// ===== RENDER CRYPTA =====
function renderCrypta() {
  const container = document.getElementById('cryptaContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  BOSSES.forEach((boss, index) => {
    const isDefeated = gameState.defeatedBosses.includes(index);
    const isLocked = index > gameState.currentCrypta;
    const isCurrent = index === gameState.currentCrypta;
    
    const card = document.createElement('div');
    card.className = `crypta-card ${isDefeated ? 'defeated' : ''} ${isLocked ? 'locked' : ''} ${isCurrent ? 'current' : ''}`;
    
    card.innerHTML = `
      <div class="crypta-number">CRYPTA ${boss.level}</div>
      <div class="crypta-boss-avatar">
        <img src="${boss.avatar || 'avatar.jpg'}" alt="${boss.name}">
      </div>
      <div class="crypta-boss-name">${boss.name}</div>
      <div class="crypta-hp">
        <span>💀 HP:</span>
        <b>${fmtInt(boss.hp)}</b>
      </div>
      <div class="crypta-reward">
        <span>🎁 Odměna:</span>
        <b>${boss.reward.icon} ${boss.reward.name}</b>
      </div>
      ${isDefeated ? '<div class="crypta-status defeated-badge">✓ PORAŽEN</div>' : ''}
      ${isLocked ? '<div class="crypta-status locked-badge">🔒 ZAMČENO</div>' : ''}
      ${!isLocked && !isDefeated ? `<button class="crypta-enter-btn" data-boss="${index}">VSTOUPIT</button>` : ''}
    `;
    
    container.appendChild(card);
    
    if (!isLocked && !isDefeated) {
      const btn = card.querySelector('.crypta-enter-btn');
      btn.addEventListener('click', () => openBossModal(index));
    }
  });
}

function updateProgress() {
  const progressText = document.getElementById('cryptaProgress');
  const progressFill = document.getElementById('progressFill');
  
  if (progressText) {
    progressText.textContent = `${gameState.defeatedBosses.length} / ${BOSSES.length}`;
  }
  
  if (progressFill) {
    const percent = (gameState.defeatedBosses.length / BOSSES.length) * 100;
    progressFill.style.width = `${percent}%`;
  }
}

// ===== BOSS MODAL =====
function openBossModal(bossIndex) {
  currentBoss = BOSSES[bossIndex];
  if (!currentBoss) return;
  
  const modal = document.getElementById('bossModal');
  const bossAvatar = document.getElementById('bossAvatar');
  const bossStoryTitle = document.getElementById('bossStoryTitle');
  const bossStoryText = document.getElementById('bossStoryText');
  const bossEncounterText = document.getElementById('bossEncounterText');
  
  if (bossAvatar) bossAvatar.src = currentBoss.avatar || 'avatar.jpg';
  if (bossStoryTitle) bossStoryTitle.textContent = currentBoss.name;
  if (bossStoryText) bossStoryText.textContent = currentBoss.story;
  if (bossEncounterText) bossEncounterText.textContent = currentBoss.encounterText;
  
  if (modal) {
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }
  
  // Setup fight button
  const fightBtn = document.getElementById('bossFightBtn');
  if (fightBtn) {
    fightBtn.onclick = () => startBossFight(bossIndex);
  }
}

function closeBossModal() {
  const modal = document.getElementById('bossModal');
  if (modal) {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function startBossFight(bossIndex) {
  const boss = BOSSES[bossIndex];
  
  const bossData = {
    fromCrypta: true,
    bossIndex: bossIndex,
    autoStart: true, // DŮLEŽITÉ: řekne aréně aby automaticky začala
    boss: {
      name: boss.name,
      level: boss.level,
      hp: boss.hp,
      background: boss.background,
      avatar: boss.avatar,
      icon: boss.icon
    },
    reward: boss.reward,
    story: boss.story
  };
  
  sessionStorage.setItem('cryptaBossFight', JSON.stringify(bossData));
  window.location.href = 'arena.html';
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await initUser();
  
  // Close modal button
  const closeBtn = document.getElementById('bossModalClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeBossModal);
  }
});

console.log('Crypta Panelāků loaded!');