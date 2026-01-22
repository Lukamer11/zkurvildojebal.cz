// perky.js - Perk Tree System

// ===== DEBUG =====
const dbg = console.log.bind(console);

// ===== SUPABASE =====
const supabaseClient = () => window.supabaseClient;
async function ensureOnline() {
  if (window.SFReady) await window.SFReady;
  const sb = supabaseClient();
  if (!sb) throw new Error('Supabase client není inicializovaný');
  return sb;
}

// ===== CLASS ICONS =====
const CLASS_ICONS = {
  padouch: '👻',
  kriminalita: '🔫',
  dealer: '💊',
  zlodej: '🥷',
  stvac: '🐕',
  boss: '👔',
  hacker: '💻',
  teroristka: '💣'
};

const CLASS_NAMES = {
  padouch: 'PADOUCH',
  kriminalita: 'KRIMINALITA',
  dealer: 'DEALER',
  zlodej: 'ZLODĚJ',
  stvac: 'ŠTVÁČ',
  boss: 'BOSS',
  hacker: 'HACKER',
  teroristka: 'TERORISTKA'
};

// ===== GAME STATE =====
let gameState = {
  userId: null,
  level: 1,
  xp: 0,
  money: 3170,
  cigarettes: 42,
  energy: 100,
  stats: {
    strength: 18,
    defense: 14,
    dexterity: 12,
    intelligence: 12,
    constitution: 16,
    luck: 9,
    player_class: 'padouch',
    character_name: 'BORIS GOPNIKOV',
    avatar_url: 'avatar.jpg'
  },
  perkPoints: 0,
  unlockedPerks: []
};

// ===== PERK TREES FOR EACH CLASS =====
// Each class has 50+ perks organized in tiers (levels)
const PERK_TREES = {
  padouch: [
    // TIER 1 (Level 1-10)
    { id: 'p1', name: 'Pouliční Bojovník', icon: '👊', tier: 1, levelReq: 1, x: 200, y: 60, requires: [], effects: { strength: 2 }, desc: 'Základní pouliční bojové schopnosti. +2 Síla' },
    { id: 'p2', name: 'Rychlé Reflexy', icon: '⚡', tier: 1, levelReq: 1, x: 450, y: 60, requires: [], effects: { dexterity: 2 }, desc: 'Ostré reflexy pro rychlé reakce. +2 Obratnost' },
    { id: 'p3', name: 'Tvrdá Kůže', icon: '🛡️', tier: 1, levelReq: 2, x: 75, y: 180, requires: ['p1'], effects: { defense: 3, constitution: 1 }, desc: 'Navyklý na rány. +3 Obrana, +1 Výdrž' },
    { id: 'p4', name: 'Lstivost', icon: '🎭', tier: 1, levelReq: 2, x: 325, y: 180, requires: ['p1'], effects: { intelligence: 2, luck: 1 }, desc: 'Umění přelstít ostatní. +2 Inteligence, +1 Štěstí' },
    { id: 'p5', name: 'Parkour Specialista', icon: '🏃', tier: 1, levelReq: 3, x: 575, y: 180, requires: ['p2'], effects: { dexterity: 3, constitution: 1 }, desc: 'Mistr v parkour technikách. +3 Obratnost, +1 Výdrž' },
    
    // TIER 2 (Level 5-15)
    { id: 'p6', name: 'Grázlova Síla', icon: '💪', tier: 2, levelReq: 5, x: 150, y: 300, requires: ['p3'], effects: { strength: 4, defense: 2 }, desc: 'Brutální síla pouličního rváče. +4 Síla, +2 Obrana' },
    { id: 'p7', name: 'Hbitý Zloděj', icon: '🤏', tier: 2, levelReq: 5, x: 400, y: 300, requires: ['p4', 'p5'], effects: { dexterity: 4, luck: 2 }, desc: 'Krade rychle a ticho. +4 Obratnost, +2 Štěstí' },
    { id: 'p8', name: 'Pouliční Moudrost', icon: '🧠', tier: 2, levelReq: 6, x: 275, y: 400, requires: ['p4'], effects: { intelligence: 5, luck: 1 }, desc: 'Znalost ulic a jejich pravidel. +5 Inteligence, +1 Štěstí' },
    { id: 'p9', name: 'Železná Vůle', icon: '🎯', tier: 2, levelReq: 7, x: 525, y: 300, requires: ['p5'], effects: { constitution: 5, defense: 2 }, desc: 'Nepřekonatelná odolnost. +5 Výdrž, +2 Obrana' },
    { id: 'p10', name: 'Gang Expert', icon: '👥', tier: 2, levelReq: 8, x: 225, y: 520, requires: ['p6', 'p8'], effects: { strength: 3, intelligence: 3 }, desc: 'Znalost gangové kultury. +3 Síla, +3 Inteligence' },
    
    // TIER 3 (Level 10-20)
    { id: 'p11', name: 'Mistr Pěstí', icon: '🥊', tier: 3, levelReq: 10, x: 100, y: 640, requires: ['p6'], effects: { strength: 6, dexterity: 2 }, desc: 'Expertní bojové dovednosti. +6 Síla, +2 Obratnost' },
    { id: 'p12', name: 'Stínový Pohyb', icon: '🌑', tier: 3, levelReq: 11, x: 350, y: 640, requires: ['p7', 'p8'], effects: { dexterity: 6, intelligence: 2 }, desc: 'Pohyb ve stínech města. +6 Obratnost, +2 Inteligence' },
    { id: 'p13', name: 'Nebojácný', icon: '🦁', tier: 3, levelReq: 12, x: 225, y: 740, requires: ['p10', 'p11'], effects: { constitution: 6, defense: 3 }, desc: 'Nic tě nevyleká. +6 Výdrž, +3 Obrana' },
    { id: 'p14', name: 'Šestý Smysl', icon: '👁️', tier: 3, levelReq: 13, x: 475, y: 640, requires: ['p9', 'p12'], effects: { luck: 8, intelligence: 2 }, desc: 'Vycítíš nebezpečí předem. +8 Štěstí, +2 Inteligence' },
    { id: 'p15', name: 'Territorial Lord', icon: '🏘️', tier: 3, levelReq: 14, x: 300, y: 860, requires: ['p13'], effects: { strength: 4, defense: 4, intelligence: 2 }, desc: 'Pánem svého teritoria. +4 Síla, +4 Obrana, +2 Inteligence' },
    
    // TIER 4 (Level 15-25)
    { id: 'p16', name: 'Devastátor', icon: '💥', tier: 4, levelReq: 15, x: 175, y: 980, requires: ['p11', 'p13'], effects: { strength: 8, constitution: 4 }, desc: 'Ničíš vše v cestě. +8 Síla, +4 Výdrž' },
    { id: 'p17', name: 'Mistr Infiltrace', icon: '🥷', tier: 4, levelReq: 16, x: 425, y: 980, requires: ['p12', 'p14'], effects: { dexterity: 8, intelligence: 4 }, desc: 'Pronikneš kamkoliv. +8 Obratnost, +4 Inteligence' },
    { id: 'p18', name: 'Neprůstřelný', icon: '🛡️', tier: 4, levelReq: 17, x: 300, y: 1100, requires: ['p15', 'p16'], effects: { defense: 10, constitution: 5 }, desc: 'Odolný vůči všemu. +10 Obrana, +5 Výdrž' },
    { id: 'p19', name: 'Šťastlivec', icon: '🍀', tier: 4, levelReq: 18, x: 550, y: 980, requires: ['p14'], effects: { luck: 12, dexterity: 3 }, desc: 'Štěstí ti vždy přeje. +12 Štěstí, +3 Obratnost' },
    { id: 'p20', name: 'Podzemní Král', icon: '👑', tier: 4, levelReq: 20, x: 375, y: 1220, requires: ['p15', 'p17', 'p18'], effects: { strength: 5, intelligence: 5, luck: 5 }, desc: 'Vládneš podsvětí. +5 ke všemu kromě Obrany' },
    
    // TIER 5 (Level 20-30)
    { id: 'p21', name: 'Titan Síly', icon: '🗿', tier: 5, levelReq: 22, x: 250, y: 1340, requires: ['p16', 'p20'], effects: { strength: 10, constitution: 6 }, desc: 'Nadlidská síla. +10 Síla, +6 Výdrž' },
    { id: 'p22', name: 'Duch Noci', icon: '🌙', tier: 5, levelReq: 23, x: 500, y: 1340, requires: ['p17', 'p20'], effects: { dexterity: 10, intelligence: 6 }, desc: 'Neviditelný v noci. +10 Obratnost, +6 Inteligence' },
    { id: 'p23', name: 'Železný Kolos', icon: '🏛️', tier: 5, levelReq: 24, x: 375, y: 1460, requires: ['p18', 'p21'], effects: { defense: 12, constitution: 8 }, desc: 'Jako žulová skála. +12 Obrana, +8 Výdrž' },
    { id: 'p24', name: 'Osudový Bojovník', icon: '🎲', tier: 5, levelReq: 25, x: 625, y: 1340, requires: ['p19'], effects: { luck: 15, strength: 4 }, desc: 'Osud tě miluje. +15 Štěstí, +4 Síla' },
    { id: 'p25', name: 'Legendární Padouch', icon: '💀', tier: 5, levelReq: 28, x: 375, y: 1580, requires: ['p20', 'p21', 'p22', 'p23'], effects: { strength: 8, defense: 8, dexterity: 8, intelligence: 8 }, desc: 'Legendární status. +8 ke všem hlavním statům' },
    
    // TIER 6 (Level 30-40) - Bonusové perky
    { id: 'p26', name: 'Smrtící Úder', icon: '☠️', tier: 6, levelReq: 30, x: 225, y: 1700, requires: ['p21', 'p25'], effects: { strength: 12, dexterity: 5 }, desc: 'Jeden úder, jeden vyřízený. +12 Síla, +5 Obratnost' },
    { id: 'p27', name: 'Nesmrtelnost', icon: '♾️', tier: 6, levelReq: 32, x: 475, y: 1700, requires: ['p23', 'p25'], effects: { constitution: 15, defense: 10 }, desc: 'Téměř nesmrtelný. +15 Výdrž, +10 Obrana' },
    { id: 'p28', name: 'Perfektní Technika', icon: '🎯', tier: 6, levelReq: 34, x: 600, y: 1700, requires: ['p22', 'p25'], effects: { dexterity: 12, intelligence: 8 }, desc: 'Dokonalé provedení. +12 Obratnost, +8 Inteligence' },
    { id: 'p29', name: 'Božská Přízeň', icon: '✨', tier: 6, levelReq: 35, x: 725, y: 1580, requires: ['p24'], effects: { luck: 20, strength: 5, defense: 5 }, desc: 'Bohové tě chrání. +20 Štěstí, +5 Síla, +5 Obrana' },
    { id: 'p30', name: 'Vládce Chaosu', icon: '🌪️', tier: 6, levelReq: 38, x: 375, y: 1820, requires: ['p25', 'p26', 'p27', 'p28'], effects: { strength: 10, defense: 10, dexterity: 10, intelligence: 10, luck: 10 }, desc: 'Absolutní moc. +10 ke všem statům' },
    
    // Bonusové utility perky (Level 5+)
    { id: 'p31', name: 'Cigaretový Pašerák', icon: '🚬', tier: 2, levelReq: 5, x: 700, y: 300, requires: ['p2'], effects: { cigarettesBonus: 5 }, desc: 'Bonusové cigarety z misí. +5% cigarety' },
    { id: 'p32', name: 'Zlaté Ruce', icon: '💰', tier: 2, levelReq: 6, x: 825, y: 300, requires: ['p31'], effects: { moneyBonus: 5 }, desc: 'Bonusové peníze. +5% peníze' },
    { id: 'p33', name: 'Energetický Ruch', icon: '⚡', tier: 2, levelReq: 7, x: 762, y: 420, requires: ['p31'], effects: { energyBonus: 10 }, desc: 'Více energie. +10 max energie' },
    { id: 'p34', name: 'XP Magnet', icon: '📈', tier: 3, levelReq: 10, x: 762, y: 640, requires: ['p32', 'p33'], effects: { xpBonus: 10 }, desc: 'Rychlejší levelování. +10% XP' },
    { id: 'p35', name: 'Obchodní Talent', icon: '🤝', tier: 3, levelReq: 12, x: 887, y: 640, requires: ['p32'], effects: { shopDiscount: 5 }, desc: 'Lepší ceny v shopu. -5% cena' },
    { id: 'p36', name: 'Adrenalinový Expert', icon: '💉', tier: 4, levelReq: 15, x: 825, y: 980, requires: ['p34', 'p35'], effects: { energyRegen: 5 }, desc: 'Rychlejší regenerace energie. +5 energie/hod' },
    { id: 'p37', name: 'Kingpin', icon: '💎', tier: 5, levelReq: 25, x: 762, y: 1340, requires: ['p36'], effects: { moneyBonus: 15, cigarettesBonus: 10 }, desc: 'Velký boss. +15% peníze, +10% cigarety' },
    { id: 'p38', name: 'Arenový Šampion', icon: '🏆', tier: 3, levelReq: 11, x: 25, y: 640, requires: ['p6'], effects: { arenaBonus: 10 }, desc: 'Dominance v aréně. +10% damage v aréně' },
    { id: 'p39', name: 'Mise Specialista', icon: '🎯', tier: 3, levelReq: 13, x: 650, y: 740, requires: ['p14'], effects: { missionBonus: 10 }, desc: 'Efektivnější mise. +10% odměny z misí' },
    { id: 'p40', name: 'Veterán', icon: '🎖️', tier: 4, levelReq: 20, x: 25, y: 980, requires: ['p38'], effects: { strength: 5, defense: 5, arenaBonus: 5 }, desc: 'Zkušený bojovník. +5 Síla, +5 Obrana, +5% arena' },
    
    // Extra advanced perks (Level 25+)
    { id: 'p41', name: 'Cigaretový Baron', icon: '🚬', tier: 5, levelReq: 26, x: 950, y: 1340, requires: ['p37'], effects: { cigarettesBonus: 20 }, desc: 'Vládce cigaretového trhu. +20% cigarety' },
    { id: 'p42', name: 'Peněžní Tok', icon: '💸', tier: 5, levelReq: 27, x: 887, y: 1460, requires: ['p37'], effects: { moneyBonus: 25 }, desc: 'Peníze tečou proudem. +25% peníze' },
    { id: 'p43', name: 'Nekonečná Energie', icon: '♾️', tier: 5, levelReq: 28, x: 1012, y: 1460, requires: ['p36'], effects: { energyBonus: 30, energyRegen: 10 }, desc: 'Nevyčerpatelný. +30 max energie, +10 energie/hod' },
    { id: 'p44', name: 'Kritický Expert', icon: '💢', tier: 4, levelReq: 18, x: 725, y: 1100, requires: ['p19'], effects: { critChance: 10 }, desc: 'Častější kritické zásahy. +10% crit šance' },
    { id: 'p45', name: 'Dodger', icon: '🌪️', tier: 4, levelReq: 19, x: 650, y: 860, requires: ['p14'], effects: { dodgeChance: 10 }, desc: 'Uhýbání úderům. +10% dodge šance' },
    { id: 'p46', name: 'Kontroverzní', icon: '⚔️', tier: 6, levelReq: 33, x: 762, y: 1700, requires: ['p44', 'p45'], effects: { critChance: 15, dodgeChance: 15 }, desc: 'Mistr boje. +15% crit, +15% dodge' },
    { id: 'p47', name: 'Konečná Forma', icon: '👹', tier: 6, levelReq: 40, x: 500, y: 1940, requires: ['p30'], effects: { strength: 15, defense: 15, dexterity: 15, intelligence: 15, constitution: 15, luck: 15 }, desc: 'Ultimátní transformace. +15 ke všem statům' },
    { id: 'p48', name: 'Božský Bojovník', icon: '⚡', tier: 6, levelReq: 42, x: 375, y: 2060, requires: ['p47'], effects: { strength: 20, dexterity: 20 }, desc: 'Božská síla a rychlost. +20 Síla, +20 Obratnost' },
    { id: 'p49', name: 'Absolutní Obrana', icon: '🛡️', tier: 6, levelReq: 43, x: 625, y: 2060, requires: ['p47'], effects: { defense: 25, constitution: 20 }, desc: 'Absolutní ochrana. +25 Obrana, +20 Výdrž' },
    { id: 'p50', name: 'OMNIPOTENCE', icon: '👁️', tier: 6, levelReq: 50, x: 500, y: 2180, requires: ['p47', 'p48', 'p49'], effects: { strength: 30, defense: 30, dexterity: 30, intelligence: 30, constitution: 30, luck: 30 }, desc: 'Naprostá všemohoucnost. +30 ke všem statům' }
  ],
  
  kriminalita: [
    // Similar 50+ perk tree for Kriminalita class
    { id: 'k1', name: 'Drsný Začátek', icon: '🔫', tier: 1, levelReq: 1, x: 200, y: 50, requires: [], effects: { strength: 3 }, desc: 'Základy kriminální kariéry. +3 Síla' },
    { id: 'k2', name: 'Rychlá Ruka', icon: '🤚', tier: 1, levelReq: 1, x: 400, y: 50, requires: [], effects: { dexterity: 3 }, desc: 'Rychlost při činu. +3 Obratnost' },
    { id: 'k3', name: 'Pouliční Kredibilita', icon: '💯', tier: 1, levelReq: 2, x: 300, y: 150, requires: ['k1'], effects: { intelligence: 2, strength: 2 }, desc: 'Respekt na ulici. +2 Inteligence, +2 Síla' },
    { id: 'k4', name: 'Zbraňový Expert', icon: '🔫', tier: 2, levelReq: 5, x: 200, y: 250, requires: ['k1', 'k3'], effects: { strength: 5, dexterity: 3 }, desc: 'Mistr ve zbrani. +5 Síla, +3 Obratnost' },
    { id: 'k5', name: 'Taktik', icon: '🧠', tier: 2, levelReq: 6, x: 400, y: 250, requires: ['k2', 'k3'], effects: { intelligence: 6 }, desc: 'Strategické myšlení. +6 Inteligence' },
    { id: 'k6', name: 'Bezcitnost', icon: '😈', tier: 2, levelReq: 7, x: 300, y: 350, requires: ['k4', 'k5'], effects: { strength: 4, constitution: 4 }, desc: 'Bez empatie. +4 Síla, +4 Výdrž' },
    { id: 'k7', name: 'Gang Leader', icon: '👑', tier: 3, levelReq: 10, x: 250, y: 500, requires: ['k6'], effects: { intelligence: 8, strength: 4 }, desc: 'Vůdce gangu. +8 Inteligence, +4 Síla' },
    { id: 'k8', name: 'Bezohledný', icon: '💀', tier: 3, levelReq: 12, x: 350, y: 500, requires: ['k6'], effects: { strength: 8, dexterity: 4 }, desc: 'Bez limitů. +8 Síla, +4 Obratnost' },
    { id: 'k9', name: 'Organizovaný Zločin', icon: '🏢', tier: 3, levelReq: 14, x: 300, y: 600, requires: ['k7', 'k8'], effects: { intelligence: 6, luck: 6 }, desc: 'Strukturovaná kriminalita. +6 Inteligence, +6 Štěstí' },
    { id: 'k10', name: 'Dealer Armádních Zbraní', icon: '💣', tier: 4, levelReq: 15, x: 200, y: 780, requires: ['k7', 'k9'], effects: { strength: 10, intelligence: 5 }, desc: 'Těžký arzenál. +10 Síla, +5 Inteligence' },
    { id: 'k11', name: 'Král Podsvětí', icon: '👹', tier: 4, levelReq: 18, x: 400, y: 780, requires: ['k8', 'k9'], effects: { strength: 7, intelligence: 7, luck: 6 }, desc: 'Vládce temnoty. +7 Síla, +7 Inteligence, +6 Štěstí' },
    { id: 'k12', name: 'Neporazitelný Boss', icon: '🏆', tier: 5, levelReq: 20, x: 300, y: 960, requires: ['k10', 'k11'], effects: { strength: 12, intelligence: 10, defense: 8 }, desc: 'Nikdo tě neporazí. +12 Síla, +10 Inteligence, +8 Obrana' },
    { id: 'k13', name: 'Impérium Zločinu', icon: '🌍', tier: 5, levelReq: 25, x: 300, y: 1140, requires: ['k12'], effects: { strength: 10, intelligence: 15, luck: 10 }, desc: 'Globální síť. +10 Síla, +15 Inteligence, +10 Štěstí' },
    { id: 'k14', name: 'Pán Války', icon: '⚔️', tier: 6, levelReq: 30, x: 200, y: 1340, requires: ['k13'], effects: { strength: 18, dexterity: 10 }, desc: 'Válečný lordDominátor. +18 Síla, +10 Obratnost' },
    { id: 'k15', name: 'Godfather', icon: '👴', tier: 6, levelReq: 35, x: 400, y: 1340, requires: ['k13'], effects: { intelligence: 20, luck: 15 }, desc: 'Kmotr všech kmotrů. +20 Inteligence, +15 Štěstí' },
    // Adding 35 more perks for kriminalita...
    { id: 'k16', name: 'Rychlé Prsty', icon: '✋', tier: 1, levelReq: 3, x: 500, y: 150, requires: ['k2'], effects: { dexterity: 2, luck: 1 }, desc: 'Šikovné ruce. +2 Obratnost, +1 Štěstí' },
    { id: 'k17', name: 'Zastř Vše', icon: '🎯', tier: 2, levelReq: 8, x: 150, y: 350, requires: ['k4'], effects: { dexterity: 5, strength: 2 }, desc: 'Přesná mířidla. +5 Obratnost, +2 Síla' },
    { id: 'k18', name: 'Pancéřový Plát', icon: '🛡️', tier: 2, levelReq: 9, x: 450, y: 350, requires: ['k5'], effects: { defense: 7 }, desc: 'Těžká ochrana. +7 Obrana' },
    { id: 'k19', name: 'Stínový Operátor', icon: '🌑', tier: 3, levelReq: 11, x: 450, y: 500, requires: ['k5', 'k16'], effects: { dexterity: 7, intelligence: 3 }, desc: 'Operace ve tmě. +7 Obratnost, +3 Inteligence' },
    { id: 'k20', name: 'Ruthless', icon: '😠', tier: 3, levelReq: 13, x: 150, y: 600, requires: ['k7', 'k17'], effects: { strength: 9 }, desc: 'Bez slitování. +9 Síla' },
    { id: 'k21', name: 'Mastermind', icon: '🎓', tier: 4, levelReq: 16, x: 500, y: 780, requires: ['k11', 'k18', 'k19'], effects: { intelligence: 12 }, desc: 'Génius stratég. +12 Inteligence' },
    { id: 'k22', name: 'Dealer Network', icon: '🕸️', tier: 4, levelReq: 17, x: 300, y: 860, requires: ['k10', 'k11'], effects: { luck: 8, intelligence: 6 }, desc: 'Síť kontaktů. +8 Štěstí, +6 Inteligence' },
    { id: 'k23', name: 'Mobster', icon: '🤵', tier: 5, levelReq: 22, x: 200, y: 1060, requires: ['k12', 'k20'], effects: { strength: 11, defense: 9 }, desc: 'Mafiánská síla. +11 Síla, +9 Obrana' },
    { id: 'k24', name: 'Cartel Boss', icon: '💼', tier: 5, levelReq: 24, x: 400, y: 1060, requires: ['k12', 'k21'], effects: { intelligence: 13, luck: 8 }, desc: 'Šéf kartelu. +13 Inteligence, +8 Štěstí' },
    { id: 'k25', name: 'Vrchní Velitel', icon: '⭐', tier: 5, levelReq: 28, x: 300, y: 1240, requires: ['k13', 'k23', 'k24'], effects: { strength: 10, intelligence: 10, defense: 10 }, desc: 'Absolutní velení. +10 Síla, +10 Inteligence, +10 Obrana' },
    { id: 'k26', name: 'Smrtící Preciznost', icon: '🎯', tier: 6, levelReq: 32, x: 150, y: 1440, requires: ['k14'], effects: { dexterity: 20, strength: 8 }, desc: 'Dokonalá mířidla. +20 Obratnost, +8 Síla' },
    { id: 'k27', name: 'Imunita', icon: '💊', tier: 6, levelReq: 34, x: 450, y: 1440, requires: ['k15'], effects: { constitution: 18, defense: 12 }, desc: 'Neproniknutelný. +18 Výdrž, +12 Obrana' },
    { id: 'k28', name: 'Černá Mamba', icon: '🐍', tier: 6, levelReq: 36, x: 300, y: 1540, requires: ['k25'], effects: { dexterity: 15, intelligence: 12, luck: 10 }, desc: 'Smrtící rychlost. +15 Obratnost, +12 Inteligence, +10 Štěstí' },
    { id: 'k29', name: 'Peněžní Magnát', icon: '💰', tier: 2, levelReq: 6, x: 600, y: 250, requires: ['k2'], effects: { moneyBonus: 10 }, desc: 'Víc peněz z krádeží. +10% peníze' },
    { id: 'k30', name: 'Zbrojní Dealer', icon: '🔫', tier: 3, levelReq: 11, x: 600, y: 500, requires: ['k29'], effects: { shopDiscount: 8 }, desc: 'Zbrojní kontakty. -8% cena zbraní' },
    { id: 'k31', name: 'Šmuglerská Sít', icon: '🚢', tier: 4, levelReq: 16, x: 650, y: 780, requires: ['k30'], effects: { moneyBonus: 15, cigarettesBonus: 10 }, desc: 'Pašování zboží. +15% peníze, +10% cigarety' },
    { id: 'k32', name: 'Black Market King', icon: '👑', tier: 5, levelReq: 23, x: 650, y: 1060, requires: ['k31'], effects: { moneyBonus: 25, shopDiscount: 15 }, desc: 'Černý trh pod kontrolou. +25% peníze, -15% shop' },
    { id: 'k33', name: 'Blood Money', icon: '💸', tier: 6, levelReq: 33, x: 600, y: 1340, requires: ['k32'], effects: { moneyBonus: 40, arenaBonus: 20 }, desc: 'Krvavé peníze. +40% peníze, +20% arena' },
    { id: 'k34', name: 'Execútor', icon: '🔪', tier: 4, levelReq: 19, x: 100, y: 860, requires: ['k17', 'k20'], effects: { strength: 12, critChance: 15 }, desc: 'Popravčí úder. +12 Síla, +15% crit' },
    { id: 'k35', name: 'Těžká Pancéř', icon: '🛡️', tier: 4, levelReq: 20, x: 550, y: 860, requires: ['k18', 'k21'], effects: { defense: 15, constitution: 8 }, desc: 'Neproniknutelná zbroj. +15 Obrana, +8 Výdrž' },
    { id: 'k36', name: 'Assassin', icon: '🗡️', tier: 5, levelReq: 26, x: 550, y: 1140, requires: ['k19', 'k24'], effects: { dexterity: 14, critChance: 20 }, desc: 'Tichý vrah. +14 Obratnost, +20% crit' },
    { id: 'k37', name: 'Brnění Titána', icon: '🏛️', tier: 5, levelReq: 27, x: 150, y: 1140, requires: ['k23', 'k34', 'k35'], effects: { defense: 18, constitution: 12 }, desc: 'Titanská výdrž. +18 Obrana, +12 Výdrž' },
    { id: 'k38', name: 'Kritický Vrah', icon: '💀', tier: 6, levelReq: 37, x: 500, y: 1440, requires: ['k26', 'k36'], effects: { critChance: 30, strength: 15 }, desc: 'Každý úder kritický. +30% crit, +15 Síla' },
    { id: 'k39', name: 'Konečný Boss', icon: '👹', tier: 6, levelReq: 40, x: 300, y: 1640, requires: ['k28'], effects: { strength: 20, intelligence: 20, defense: 20 }, desc: 'Nejvyšší boss. +20 Síla, +20 Inteligence, +20 Obrana' },
    { id: 'k40', name: 'Ultimátní Mafián', icon: '🔱', tier: 6, levelReq: 45, x: 200, y: 1740, requires: ['k39'], effects: { strength: 25, dexterity: 20, intelligence: 20 }, desc: 'Dokonalý kriminálník. +25 Síla, +20 Obratnost, +20 Inteligence' },
    { id: 'k41', name: 'Nesmrtelný Kmotr', icon: '👑', tier: 6, levelReq: 48, x: 400, y: 1740, requires: ['k39'], effects: { constitution: 30, defense: 25, luck: 20 }, desc: 'Nesmrtelná legenda. +30 Výdrž, +25 Obrana, +20 Štěstí' },
    { id: 'k42', name: 'OMNIPOTENT BOSS', icon: '👁️', tier: 6, levelReq: 50, x: 300, y: 1840, requires: ['k40', 'k41'], effects: { strength: 30, defense: 30, dexterity: 30, intelligence: 30, constitution: 30, luck: 30 }, desc: 'Absolutní moc kriminality. +30 ke všem statům' },
    // More bonus perks
    { id: 'k43', name: 'Rychlý Výstřel', icon: '💥', tier: 3, levelReq: 12, x: 50, y: 500, requires: ['k4', 'k17'], effects: { dexterity: 8 }, desc: 'Bleskový výstřel. +8 Obratnost' },
    { id: 'k44', name: 'Arenový Teror', icon: '😱', tier: 4, levelReq: 18, x: 50, y: 780, requires: ['k20', 'k43'], effects: { arenaBonus: 15, strength: 7 }, desc: 'Hrůza arény. +15% arena, +7 Síla' },
    { id: 'k45', name: 'Mise Ruthless', icon: '🎯', tier: 5, levelReq: 21, x: 50, y: 1060, requires: ['k44'], effects: { missionBonus: 20 }, desc: 'Brutální mise. +20% odměny z misí' },
    { id: 'k46', name: 'Veterán Války', icon: '🎖️', tier: 5, levelReq: 29, x: 700, y: 1140, requires: ['k32'], effects: { strength: 12, defense: 12, arenaBonus: 10 }, desc: 'Zkušený válečník. +12 Síla, +12 Obrana, +10% arena' },
    { id: 'k47', name: 'Energie Zločinu', icon: '⚡', tier: 3, levelReq: 14, x: 700, y: 500, requires: ['k30'], effects: { energyBonus: 20 }, desc: 'Extra energie. +20 max energie' },
    { id: 'k48', name: 'XP Hustler', icon: '📊', tier: 4, levelReq: 17, x: 750, y: 780, requires: ['k31', 'k47'], effects: { xpBonus: 15 }, desc: 'Rapid levelování. +15% XP' },
    { id: 'k49', name: 'Neúnavný', icon: '♾️', tier: 5, levelReq: 30, x: 750, y: 1060, requires: ['k48'], effects: { energyBonus: 40, energyRegen: 15 }, desc: 'Nikdy neúnavný. +40 max energie, +15 energie/hod' },
    { id: 'k50', name: 'Dodger Master', icon: '🌪️', tier: 4, levelReq: 19, x: 550, y: 600, requires: ['k19'], effects: { dodgeChance: 15 }, desc: 'Mistr uhýbání. +15% dodge' }
  ],
  
  dealer: [
    // 50+ perks for Dealer class
    { id: 'd1', name: 'První Balíček', icon: '💊', tier: 1, levelReq: 1, x: 200, y: 50, requires: [], effects: { intelligence: 3 }, desc: 'Začátek dealeřské kariéry. +3 Inteligence' },
    { id: 'd2', name: 'Rychlý Prodej', icon: '💸', tier: 1, levelReq: 1, x: 400, y: 50, requires: [], effects: { dexterity: 2, luck: 1 }, desc: 'Rychle prodat a zmizet. +2 Obratnost, +1 Štěstí' },
    { id: 'd3', name: 'Klientská Síť', icon: '📱', tier: 1, levelReq: 2, x: 300, y: 150, requires: ['d1'], effects: { intelligence: 2, luck: 2 }, desc: 'Základ kontaktů. +2 Inteligence, +2 Štěstí' },
    { id: 'd4', name: 'Kvalitní Produkt', icon: '💎', tier: 2, levelReq: 5, x: 200, y: 250, requires: ['d1', 'd3'], effects: { intelligence: 5, luck: 3 }, desc: 'Nejlepší zboží na trhu. +5 Inteligence, +3 Štěstí' },
    { id: 'd5', name: 'Street Chemist', icon: '🧪', tier: 2, levelReq: 6, x: 400, y: 250, requires: ['d2', 'd3'], effects: { intelligence: 6, dexterity: 2 }, desc: 'Vlastní výroba. +6 Inteligence, +2 Obratnost' },
    { id: 'd6', name: 'Teritorium', icon: '🏘️', tier: 2, levelReq: 7, x: 300, y: 350, requires: ['d4', 'd5'], effects: { intelligence: 4, strength: 3, luck: 3 }, desc: 'Vlastní oblast. +4 Inteligence, +3 Síla, +3 Štěstí' },
    { id: 'd7', name: 'Podplácení', icon: '🤝', tier: 3, levelReq: 10, x: 250, y: 500, requires: ['d6'], effects: { intelligence: 8, luck: 5 }, desc: 'Korumpovaná policie. +8 Inteligence, +5 Štěstí' },
    { id: 'd8', name: 'Laboratorní Expert', icon: '🔬', tier: 3, levelReq: 12, x: 350, y: 500, requires: ['d5', 'd6'], effects: { intelligence: 10, dexterity: 4 }, desc: 'Chemický génius. +10 Inteligence, +4 Obratnost' },
    { id: 'd9', name: 'Distribuční Síť', icon: '🕸️', tier: 3, levelReq: 14, x: 300, y: 600, requires: ['d7', 'd8'], effects: { intelligence: 7, luck: 7 }, desc: 'Rozsáhlá distribuce. +7 Inteligence, +7 Štěstí' },
    { id: 'd10', name: 'Cartel Spojení', icon: '🌎', tier: 4, levelReq: 15, x: 200, y: 780, requires: ['d7', 'd9'], effects: { intelligence: 12, luck: 8 }, desc: 'Mezinárodní kontakty. +12 Inteligence, +8 Štěstí' },
    { id: 'd11', name: 'Čistá Droga', icon: '💉', tier: 4, levelReq: 18, x: 400, y: 780, requires: ['d8', 'd9'], effects: { intelligence: 14, dexterity: 6 }, desc: 'Perfektní chemie. +14 Inteligence, +6 Obratnost' },
    { id: 'd12', name: 'Drogový Král', icon: '👑', tier: 5, levelReq: 20, x: 300, y: 960, requires: ['d10', 'd11'], effects: { intelligence: 18, luck: 12, dexterity: 5 }, desc: 'Pánem drogového trhu. +18 Inteligence, +12 Štěstí, +5 Obratnost' },
    { id: 'd13', name: 'Globální Империum', icon: '🌍', tier: 5, levelReq: 25, x: 300, y: 1140, requires: ['d12'], effects: { intelligence: 22, luck: 15 }, desc: 'Světová dominance. +22 Inteligence, +15 Štěstí' },
    { id: 'd14', name: 'Chemický Mistr', icon: '⚗️', tier: 6, levelReq: 30, x: 200, y: 1340, requires: ['d13'], effects: { intelligence: 28, dexterity: 12 }, desc: 'Absolutní znalost chemie. +28 Inteligence, +12 Obratnost' },
    { id: 'd15', name: 'Narco Boss', icon: '💼', tier: 6, levelReq: 35, x: 400, y: 1340, requires: ['d13'], effects: { intelligence: 25, luck: 20 }, desc: 'Narkobaron. +25 Inteligence, +20 Štěstí' },
    // Adding 35 more perks for dealer...
    { id: 'd16', name: 'Rychlé Nohy', icon: '👟', tier: 1, levelReq: 3, x: 500, y: 150, requires: ['d2'], effects: { dexterity: 3 }, desc: 'Rychlý únik. +3 Obratnost' },
    { id: 'd17', name: 'Manipulátor', icon: '🎭', tier: 2, levelReq: 8, x: 500, y: 350, requires: ['d2', 'd16'], effects: { intelligence: 5, luck: 4 }, desc: 'Manipulace s klienty. +5 Inteligence, +4 Štěstí' },
    { id: 'd18', name: 'Skrýše Expert', icon: '🕳️', tier: 2, levelReq: 9, x: 150, y: 350, requires: ['d4'], effects: { dexterity: 6, intelligence: 2 }, desc: 'Dokonalé úkryty. +6 Obratnost, +2 Inteligence' },
    { id: 'd19', name: 'Noční Operace', icon: '🌙', tier: 3, levelReq: 11, x: 450, y: 500, requires: ['d17'], effects: { dexterity: 7, intelligence: 4 }, desc: 'Prodej ve tmě. +7 Obratnost, +4 Inteligence' },
    { id: 'd20', name: 'Money Laundering', icon: '💰', tier: 3, levelReq: 13, x: 150, y: 600, requires: ['d7', 'd18'], effects: { intelligence: 9, luck: 5 }, desc: 'Praní špinavých peněz. +9 Inteligence, +5 Štěstí' },
    { id: 'd21', name: 'Vědecký Přístup', icon: '🎓', tier: 4, levelReq: 16, x: 500, y: 780, requires: ['d11', 'd19'], effects: { intelligence: 15 }, desc: 'Vědecká metoda. +15 Inteligence' },
    { id: 'd22', name: 'Bezpečná Dodávka', icon: '🚚', tier: 4, levelReq: 17, x: 300, y: 860, requires: ['d10', 'd11'], effects: { dexterity: 10, luck: 6 }, desc: 'Bezpečná distribuce. +10 Obratnost, +6 Štěstí' },
    { id: 'd23', name: 'Cocaine Empire', icon: '❄️', tier: 5, levelReq: 22, x: 200, y: 1060, requires: ['d12', 'd20'], effects: { intelligence: 20, luck: 10 }, desc: 'Kokainové impérium. +20 Inteligence, +10 Štěstí' },
    { id: 'd24', name: 'Meth King', icon: '💎', tier: 5, levelReq: 24, x: 400, y: 1060, requires: ['d12', 'd21'], effects: { intelligence: 24 }, desc: 'Král pervitinu. +24 Inteligence' },
    { id: 'd25', name: 'Untouchable', icon: '🛡️', tier: 5, levelReq: 28, x: 300, y: 1240, requires: ['d13', 'd23', 'd24'], effects: { intelligence: 18, luck: 15, defense: 10 }, desc: 'Nedotknutelný zákon. +18 Inteligence, +15 Štěstí, +10 Obrana' },
    { id: 'd26', name: 'Super Lab', icon: '🏭', tier: 6, levelReq: 32, x: 150, y: 1440, requires: ['d14'], effects: { intelligence: 30, dexterity: 15 }, desc: 'Nejmodernější lab. +30 Inteligence, +15 Obratnost' },
    { id: 'd27', name: 'Fortune Teller', icon: '🔮', tier: 6, levelReq: 34, x: 450, y: 1440, requires: ['d15'], effects: { luck: 28, intelligence: 12 }, desc: 'Vidíš budoucnost. +28 Štěstí, +12 Inteligence' },
    { id: 'd28', name: 'Phantom', icon: '👻', tier: 6, levelReq: 36, x: 300, y: 1540, requires: ['d25'], effects: { dexterity: 20, intelligence: 15, luck: 12 }, desc: 'Neviditelný pro zákon. +20 Obratnost, +15 Inteligence, +12 Štěstí' },
    { id: 'd29', name: 'Peněžní Tok', icon: '💸', tier: 2, levelReq: 6, x: 600, y: 250, requires: ['d2'], effects: { moneyBonus: 15 }, desc: 'Více peněz z prodeje. +15% peníze' },
    { id: 'd30', name: 'VIP Klienti', icon: '💎', tier: 3, levelReq: 11, x: 600, y: 500, requires: ['d29'], effects: { moneyBonus: 20, luck: 5 }, desc: 'Bohatí klienti. +20% peníze, +5 Štěstí' },
    { id: 'd31', name: 'Cigaretová Směna', icon: '🚬', tier: 4, levelReq: 16, x: 650, y: 780, requires: ['d30'], effects: { cigarettesBonus: 25 }, desc: 'Obchod s cigaretami. +25% cigarety' },
    { id: 'd32', name: 'Monopol', icon: '👑', tier: 5, levelReq: 23, x: 650, y: 1060, requires: ['d31'], effects: { moneyBonus: 35, cigarettesBonus: 20 }, desc: 'Monopolní postavení. +35% peníze, +20% cigarety' },
    { id: 'd33', name: 'Gold Rush', icon: '🏆', tier: 6, levelReq: 33, x: 600, y: 1340, requires: ['d32'], effects: { moneyBonus: 50, luck: 15 }, desc: 'Zlatá horečka. +50% peníze, +15 Štěstí' },
    { id: 'd34', name: 'Skrytá Síla', icon: '🤐', tier: 4, levelReq: 19, x: 100, y: 860, requires: ['d18', 'd20'], effects: { dexterity: 12, defense: 8 }, desc: 'Skrytá ochrana. +12 Obratnost, +8 Obrana' },
    { id: 'd35', name: 'Diplomatický Imunita', icon: '📜', tier: 4, levelReq: 20, x: 550, y: 860, requires: ['d21', 'd22'], effects: { intelligence: 13, luck: 10 }, desc: 'Právní ochrana. +13 Inteligence, +10 Štěstí' },
    { id: 'd36', name: 'Stealth Master', icon: '🥷', tier: 5, levelReq: 26, x: 550, y: 1140, requires: ['d19', 'd24'], effects: { dexterity: 18 }, desc: 'Mistr nenápadnosti. +18 Obratnost' },
    { id: 'd37', name: 'Bohatství Států', icon: '💵', tier: 5, levelReq: 27, x: 150, y: 1140, requires: ['d23', 'd34', 'd35'], effects: { intelligence: 16, luck: 16 }, desc: 'Neomezené bohatství. +16 Inteligence, +16 Štěstí' },
    { id: 'd38', name: 'Geniální Chemik', icon: '👨‍🔬', tier: 6, levelReq: 37, x: 500, y: 1440, requires: ['d26', 'd36'], effects: { intelligence: 35 }, desc: 'Chemický génius. +35 Inteligence' },
    { id: 'd39', name: 'Drogový Impérium', icon: '🏰', tier: 6, levelReq: 40, x: 300, y: 1640, requires: ['d28'], effects: { intelligence: 25, luck: 25 }, desc: 'Impérium drog. +25 Inteligence, +25 Štěstí' },
    { id: 'd40', name: 'Nedotknutelný Král', icon: '👑', tier: 6, levelReq: 45, x: 200, y: 1740, requires: ['d39'], effects: { intelligence: 30, luck: 25, defense: 15 }, desc: 'Absolutní ochrana. +30 Inteligence, +25 Štěstí, +15 Obrana' },
    { id: 'd41', name: 'Perfect Chemistry', icon: '⚗️', tier: 6, levelReq: 48, x: 400, y: 1740, requires: ['d39'], effects: { intelligence: 40, dexterity: 20 }, desc: 'Dokonalá chemie. +40 Inteligence, +20 Obratnost' },
    { id: 'd42', name: 'ULTIMATE DEALER', icon: '💎', tier: 6, levelReq: 50, x: 300, y: 1840, requires: ['d40', 'd41'], effects: { intelligence: 50, luck: 30, dexterity: 20 }, desc: 'Ultimátní dealer. +50 Inteligence, +30 Štěstí, +20 Obratnost' },
    { id: 'd43', name: 'Rychlá Reakce', icon: '⚡', tier: 3, levelReq: 12, x: 50, y: 500, requires: ['d4', 'd18'], effects: { dexterity: 9 }, desc: 'Bleskové reakce. +9 Obratnost' },
    { id: 'd44', name: 'Mise Dealer', icon: '🎯', tier: 4, levelReq: 18, x: 50, y: 780, requires: ['d20', 'd43'], effects: { missionBonus: 18, intelligence: 6 }, desc: 'Efektivní mise. +18% mise, +6 Inteligence' },
    { id: 'd45', name: 'Narco Misija', icon: '🎯', tier: 5, levelReq: 21, x: 50, y: 1060, requires: ['d44'], effects: { missionBonus: 25, moneyBonus: 10 }, desc: 'Narkomise. +25% mise, +10% peníze' },
    { id: 'd46', name: 'Lab Rat', icon: '🐭', tier: 5, levelReq: 29, x: 700, y: 1140, requires: ['d32'], effects: { intelligence: 18, xpBonus: 15 }, desc: 'Laboratorní zkušenost. +18 Inteligence, +15% XP' },
    { id: 'd47', name: 'Energetický Produkt', icon: '⚡', tier: 3, levelReq: 14, x: 700, y: 500, requires: ['d30'], effects: { energyBonus: 25 }, desc: 'Vlastní stimulanty. +25 max energie' },
    { id: 'd48', name: 'XP Formula', icon: '📊', tier: 4, levelReq: 17, x: 750, y: 780, requires: ['d31', 'd47'], effects: { xpBonus: 20 }, desc: 'Experimentální růst. +20% XP' },
    { id: 'd49', name: 'Neomezeně Energie', icon: '♾️', tier: 5, levelReq: 30, x: 750, y: 1060, requires: ['d48'], effects: { energyBonus: 50, energyRegen: 20 }, desc: 'Nekonečné stimulanty. +50 max energie, +20 energie/hod' },
    { id: 'd50', name: 'Lucky Batch', icon: '🍀', tier: 4, levelReq: 19, x: 550, y: 600, requires: ['d19'], effects: { luck: 12 }, desc: 'Štěstí v obchodech. +12 Štěstí' }
  ]
  
  // Note: For brevity, I'm showing 3 full class trees. In production, you'd want all 8 classes (zlodej, stvac, boss, hacker, teroristka) with 50+ perks each
  // Each additional class follows the same pattern with unique perks themed to that class
};

// Simplified versions for other classes (you can expand these)
PERK_TREES.zlodej = generateGenericPerkTree('zlodej', '🥷', 'dexterity', 'luck');
PERK_TREES.stvac = generateGenericPerkTree('stvac', '🐕', 'dexterity', 'intelligence');
PERK_TREES.boss = generateGenericPerkTree('boss', '👔', 'intelligence', 'luck');
PERK_TREES.hacker = generateGenericPerkTree('hacker', '💻', 'intelligence', 'dexterity');
PERK_TREES.teroristka = generateGenericPerkTree('teroristka', '💣', 'strength', 'constitution');

function generateGenericPerkTree(classId, classIcon, primaryStat, secondaryStat) {
  const perks = [];
  const statIcons = {
    strength: '💪', defense: '🛡️', dexterity: '⚡', 
    intelligence: '🧠', constitution: '❤️', luck: '🍀'
  };
  
  let perkId = 0;
  let y = 60;
  
  // Generate 50 perks across 6 tiers with compact spacing
  for (let tier = 1; tier <= 6; tier++) {
    const perksInTier = tier === 6 ? 10 : 8;
    const startLevel = (tier - 1) * 8 + 1;
    
    for (let i = 0; i < perksInTier; i++) {
      perkId++;
      const level = startLevel + i;
      const x = 150 + (i % 4) * 250; // Compact horizontal spacing
      const requires = perkId === 1 ? [] : [`${classId}${perkId - 1}`];
      
      const effects = {};
      effects[primaryStat] = tier * 3 + i;
      if (i % 2 === 0) effects[secondaryStat] = tier * 2;
      
      perks.push({
        id: `${classId}${perkId}`,
        name: `${CLASS_NAMES[classId]} Perk ${perkId}`,
        icon: classIcon,
        tier,
        levelReq: level,
        x,
        y,
        requires,
        effects,
        desc: `Tier ${tier} perk pro ${CLASS_NAMES[classId]}. Level ${level} required.`
      });
      
      if ((i + 1) % 4 === 0) y += 120; // Compact vertical spacing
    }
    y += 100; // Compact spacing between tiers
  }
  
  return perks;
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  dbg('🌳 Perky system loading...');
  
  try {
    await loadGameState();
    renderUI();
    renderPerkTree();
    setupEventListeners();
  } catch (e) {
    dbg('❌ Error loading perky:', e);
    alert('Chyba při načítání perk systému: ' + e.message);
  }
});

async function loadGameState() {
  const sb = await ensureOnline();
  const { data: { user } } = await sb.auth.getUser();
  
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  
  gameState.userId = user.id;
  
  // Load from Supabase
  const { data, error } = await sb
    .from('player_stats')
    .select('*')
    .eq('user_id', user.id)
    .single();
  
  if (error) throw error;
  
  if (data && data.stats) {
    gameState.level = data.stats.level || 1;
    gameState.xp = data.stats.xp || 0;
    gameState.money = data.stats.money || 3170;
    gameState.cigarettes = data.stats.cigarettes || 42;
    gameState.energy = data.stats.energy || 100;
    gameState.stats = { ...gameState.stats, ...data.stats };
    gameState.unlockedPerks = data.stats.unlocked_perks || [];
    
    // Calculate perk points (1 per 2 levels, minus spent perks)
    gameState.perkPoints = Math.floor(gameState.level / 2) - gameState.unlockedPerks.length;
  }
}

async function saveGameState() {
  const sb = await ensureOnline();
  
  const { error } = await sb
    .from('player_stats')
    .update({
      stats: {
        ...gameState.stats,
        money: gameState.money,
        cigarettes: gameState.cigarettes,
        energy: gameState.energy,
        unlocked_perks: gameState.unlockedPerks
      }
    })
    .eq('user_id', gameState.userId);
  
  if (error) throw error;
}

function renderUI() {
  // Update character info
  const playerClass = gameState.stats.player_class || 'padouch';
  document.getElementById('charAvatar').src = gameState.stats.avatar_url || 'avatar.jpg';
  document.getElementById('charClassBadge').textContent = CLASS_ICONS[playerClass] || '👻';
  document.getElementById('charName').textContent = gameState.stats.character_name || 'BORIS GOPNIKOV';
  document.getElementById('charClassName').textContent = CLASS_NAMES[playerClass] || 'PADOUCH';
  document.getElementById('charLevel').textContent = gameState.level;
  document.getElementById('perkPoints').textContent = gameState.perkPoints;
  
  // Update perk counts
  const perks = getCurrentPerks();
  document.getElementById('unlockedPerksCount').textContent = gameState.unlockedPerks.length;
  document.getElementById('totalPerksCount').textContent = perks.length;
  
  // Update stats
  document.getElementById('statStr').textContent = gameState.stats.strength || 18;
  document.getElementById('statDef').textContent = gameState.stats.defense || 14;
  document.getElementById('statDex').textContent = gameState.stats.dexterity || 12;
  document.getElementById('statInt').textContent = gameState.stats.intelligence || 12;
  document.getElementById('statCon').textContent = gameState.stats.constitution || 16;
  document.getElementById('statLuck').textContent = gameState.stats.luck || 9;
  
  // Update top bar
  document.getElementById('levelDisplay').textContent = gameState.level;
  document.getElementById('money').textContent = gameState.money.toLocaleString();
  document.getElementById('cigarettes').textContent = gameState.cigarettes;
  document.getElementById('energy').textContent = gameState.energy;
  
  const xpNeeded = gameState.level * 100;
  const xpPercent = (gameState.xp / xpNeeded) * 100;
  document.getElementById('xpFill').style.width = `${xpPercent}%`;
  document.getElementById('xpText').textContent = `${gameState.xp} / ${xpNeeded}`;
  
  const energyPercent = (gameState.energy / 100) * 100;
  document.getElementById('energyFill').style.width = `${energyPercent}%`;
  document.getElementById('energyText').textContent = `${gameState.energy} / 100`;
}

function renderPerkTree() {
  const playerClass = gameState.stats.player_class || 'padouch';
  const perks = PERK_TREES[playerClass] || PERK_TREES.padouch;
  
  const className = CLASS_NAMES[playerClass] || 'PADOUCH';
  document.getElementById('treeTitle').textContent = `🌳 ${className} - STROM PERKŮ`;
  
  const canvas = document.getElementById('treeCanvas');
  canvas.innerHTML = '';
  
  // Calculate canvas size
  const maxX = Math.max(...perks.map(p => p.x)) + 200;
  const maxY = Math.max(...perks.map(p => p.y)) + 200;
  canvas.style.width = `${maxX}px`;
  canvas.style.height = `${maxY}px`;
  
  // Render connections first (so they appear behind nodes)
  perks.forEach(perk => {
    perk.requires.forEach(reqId => {
      const reqPerk = perks.find(p => p.id === reqId);
      if (reqPerk) {
        renderConnection(canvas, reqPerk, perk);
      }
    });
  });
  
  // Render perk nodes
  perks.forEach(perk => {
    renderPerkNode(canvas, perk);
  });
}

function renderConnection(canvas, from, to) {
  const isUnlocked = gameState.unlockedPerks.includes(from.id) && 
                     gameState.unlockedPerks.includes(to.id);
  
  const line = document.createElement('div');
  line.className = `perk-connection ${isUnlocked ? 'unlocked' : ''}`;
  
  const fromCenterX = from.x + 55; // 110px width / 2
  const fromCenterY = from.y + 55; // approximate center
  const toCenterX = to.x + 55;
  const toCenterY = to.y + 55;
  
  // Vertical connection
  if (from.x === to.x) {
    line.classList.add('vertical');
    line.style.left = `${fromCenterX}px`;
    line.style.top = `${fromCenterY}px`;
    line.style.height = `${toCenterY - fromCenterY}px`;
  }
  // Horizontal connection
  else if (from.y === to.y) {
    line.classList.add('horizontal');
    line.style.left = `${Math.min(fromCenterX, toCenterX)}px`;
    line.style.top = `${fromCenterY}px`;
    line.style.width = `${Math.abs(toCenterX - fromCenterX)}px`;
  }
  // Diagonal (simple L-shape with two lines)
  else {
    // Vertical part
    const vLine = document.createElement('div');
    vLine.className = `perk-connection vertical ${isUnlocked ? 'unlocked' : ''}`;
    vLine.style.left = `${fromCenterX}px`;
    vLine.style.top = `${fromCenterY}px`;
    vLine.style.height = `${Math.abs(toCenterY - fromCenterY) / 2}px`;
    canvas.appendChild(vLine);
    
    // Horizontal part
    const hLine = document.createElement('div');
    hLine.className = `perk-connection horizontal ${isUnlocked ? 'unlocked' : ''}`;
    hLine.style.left = `${Math.min(fromCenterX, toCenterX)}px`;
    hLine.style.top = `${(fromCenterY + toCenterY) / 2}px`;
    hLine.style.width = `${Math.abs(toCenterX - fromCenterX)}px`;
    canvas.appendChild(hLine);
    
    return;
  }
  
  canvas.appendChild(line);
}

function renderPerkNode(canvas, perk) {
  const unlocked = gameState.unlockedPerks.includes(perk.id);
  const requirementsMet = checkRequirements(perk);
  const levelMet = gameState.level >= perk.levelReq;
  const available = requirementsMet && levelMet && !unlocked;
  const locked = !requirementsMet || !levelMet;
  
  const node = document.createElement('div');
  node.className = 'perk-node';
  if (unlocked) node.classList.add('unlocked');
  if (available) node.classList.add('available');
  if (locked) node.classList.add('locked');
  node.style.left = `${perk.x}px`;
  node.style.top = `${perk.y}px`;
  node.dataset.perkId = perk.id;
  
  node.innerHTML = `
    <div class="perk-node-inner">
      <div class="perk-level-req">${perk.levelReq}</div>
      <div class="perk-icon">${perk.icon}</div>
      <div class="perk-name">${perk.name}</div>
    </div>
  `;
  
  node.addEventListener('click', () => showPerkDetail(perk));
  
  canvas.appendChild(node);
}

function checkRequirements(perk) {
  if (perk.requires.length === 0) return true;
  return perk.requires.every(reqId => gameState.unlockedPerks.includes(reqId));
}

function showPerkDetail(perk) {
  const unlocked = gameState.unlockedPerks.includes(perk.id);
  const requirementsMet = checkRequirements(perk);
  const levelMet = gameState.level >= perk.levelReq;
  const available = requirementsMet && levelMet && !unlocked;
  const locked = !requirementsMet || !levelMet;
  
  let statusClass = 'locked';
  let statusText = 'ZAMČENO';
  if (unlocked) {
    statusClass = 'unlocked';
    statusText = 'ODEMČENO';
  } else if (available) {
    statusClass = 'available';
    statusText = 'DOSTUPNÉ';
  }
  
  const detailHTML = `
    <div class="perk-detail-card">
      <div class="perk-detail-header ${statusClass}">
        <div class="perk-detail-icon-wrapper">
          <div class="perk-detail-icon">${perk.icon}</div>
        </div>
        <div class="perk-detail-info">
          <div class="perk-detail-name">${perk.name}</div>
          <div class="perk-detail-tier">Tier ${perk.tier} • Level ${perk.levelReq}</div>
          <div class="perk-detail-status ${statusClass}">${statusText}</div>
        </div>
      </div>
      
      <div class="perk-detail-description">
        <p>${perk.desc}</p>
      </div>
      
      <div class="perk-detail-effects">
        <div class="perk-detail-effects-title">⚡ EFEKTY</div>
        ${Object.entries(perk.effects).map(([stat, value]) => {
          const icons = {
            strength: '⚔️', defense: '🛡️', dexterity: '🎯',
            intelligence: '🧠', constitution: '💪', luck: '🍀',
            moneyBonus: '💰', cigarettesBonus: '🚬', energyBonus: '⚡',
            xpBonus: '📈', shopDiscount: '🛒', energyRegen: '♻️',
            arenaBonus: '🏆', missionBonus: '🎯', critChance: '💢',
            dodgeChance: '🌪️'
          };
          const statNames = {
            strength: 'Síla', defense: 'Obrana', dexterity: 'Obratnost',
            intelligence: 'Inteligence', constitution: 'Výdrž', luck: 'Štěstí',
            moneyBonus: 'Bonus peníze', cigarettesBonus: 'Bonus cigarety',
            energyBonus: 'Max energie', xpBonus: 'Bonus XP',
            shopDiscount: 'Sleva shop', energyRegen: 'Regenerace energie',
            arenaBonus: 'Bonus arena', missionBonus: 'Bonus mise',
            critChance: 'Crit šance', dodgeChance: 'Dodge šance'
          };
          return `
            <div class="perk-effect-item">
              <span class="perk-effect-icon">${icons[stat] || '✨'}</span>
              <span class="perk-effect-text">${statNames[stat] || stat}</span>
              <span class="perk-effect-value">+${value}${stat.includes('Bonus') || stat.includes('Chance') || stat.includes('Discount') ? '%' : ''}</span>
            </div>
          `;
        }).join('')}
      </div>
      
      ${perk.requires.length > 0 ? `
        <div class="perk-detail-requirements">
          <div class="perk-detail-requirements-title">📋 POŽADAVKY</div>
          ${perk.requires.map(reqId => {
            const reqPerk = getCurrentPerks().find(p => p.id === reqId);
            const met = gameState.unlockedPerks.includes(reqId);
            return `
              <div class="perk-requirement-item ${met ? 'met' : ''}">
                <span class="perk-requirement-icon">${reqPerk?.icon || '❓'}</span>
                <span class="perk-requirement-text">${reqPerk?.name || reqId}</span>
                <span class="perk-requirement-check">${met ? '✅' : '❌'}</span>
              </div>
            `;
          }).join('')}
          <div class="perk-requirement-item ${levelMet ? 'met' : ''}">
            <span class="perk-requirement-icon">📊</span>
            <span class="perk-requirement-text">Level ${perk.levelReq}</span>
            <span class="perk-requirement-check">${levelMet ? '✅' : '❌'}</span>
          </div>
        </div>
      ` : ''}
      
      <div class="perk-detail-actions">
        ${unlocked ? `
          <button class="perk-unlock-btn unlocked" disabled>✅ ODEMČENO</button>
        ` : available ? `
          <button class="perk-unlock-btn" onclick="unlockPerk('${perk.id}')">
            🔓 ODEMKNOUT (1 bod)
          </button>
        ` : `
          <button class="perk-unlock-btn" disabled>🔒 NESPLNĚNÉ POŽADAVKY</button>
        `}
      </div>
    </div>
  `;
  
  document.getElementById('perkModalBody').innerHTML = detailHTML;
  document.getElementById('perkModal').classList.add('active');
}

function getCurrentPerks() {
  const playerClass = gameState.stats.player_class || 'padouch';
  return PERK_TREES[playerClass] || PERK_TREES.padouch;
}

window.unlockPerk = async function(perkId) {
  if (gameState.perkPoints <= 0) {
    alert('Nemáš dostatek bodů perků!');
    return;
  }
  
  const perks = getCurrentPerks();
  const perk = perks.find(p => p.id === perkId);
  if (!perk) return;
  
  if (!checkRequirements(perk) || gameState.level < perk.levelReq) {
    alert('Nesplňuješ požadavky pro tento perk!');
    return;
  }
  
  if (gameState.unlockedPerks.includes(perkId)) {
    alert('Tento perk už máš odemčený!');
    return;
  }
  
  // Apply perk effects
  Object.entries(perk.effects).forEach(([stat, value]) => {
    if (gameState.stats[stat] !== undefined) {
      gameState.stats[stat] += value;
    }
  });
  
  gameState.unlockedPerks.push(perkId);
  gameState.perkPoints--;
  
  try {
    await saveGameState();
    renderUI();
    renderPerkTree();
    
    // Close modal
    document.getElementById('perkModal').classList.remove('active');
    
    // Show success message
    alert(`✅ Perk "${perk.name}" byl odemčen!`);
  } catch (e) {
    dbg('❌ Error unlocking perk:', e);
    alert('Chyba při odemykání perku: ' + e.message);
  }
};

function setupEventListeners() {
  // Reset perks button
  document.getElementById('resetPerksBtn').addEventListener('click', async () => {
    if (gameState.cigarettes < 10) {
      alert('Nemáš dostatek cigaret! Potřebuješ 10 cigaret.');
      return;
    }
    
    if (!confirm('Opravdu chceš resetovat všechny perky za 10 cigaret?')) {
      return;
    }
    
    // Reverse all perk effects
    const perks = getCurrentPerks();
    gameState.unlockedPerks.forEach(perkId => {
      const perk = perks.find(p => p.id === perkId);
      if (perk) {
        Object.entries(perk.effects).forEach(([stat, value]) => {
          if (gameState.stats[stat] !== undefined) {
            gameState.stats[stat] -= value;
          }
        });
      }
    });
    
    gameState.unlockedPerks = [];
    gameState.perkPoints = Math.floor(gameState.level / 2);
    gameState.cigarettes -= 10;
    
    try {
      await saveGameState();
      renderUI();
      renderPerkTree();
      alert('✅ Všechny perky byly resetovány!');
    } catch (e) {
      dbg('❌ Error resetting perks:', e);
      alert('Chyba při resetování perků: ' + e.message);
    }
  });
  
  // Zoom controls
  let currentZoom = 1;
  const treeWrapper = document.getElementById('treeScrollWrapper');
  const treeCanvas = document.getElementById('treeCanvas');
  
  document.getElementById('zoomInBtn').addEventListener('click', () => {
    currentZoom = Math.min(currentZoom + 0.2, 2);
    treeCanvas.style.transform = `scale(${currentZoom})`;
    treeCanvas.style.transformOrigin = 'top left';
  });
  
  document.getElementById('zoomOutBtn').addEventListener('click', () => {
    currentZoom = Math.max(currentZoom - 0.2, 0.5);
    treeCanvas.style.transform = `scale(${currentZoom})`;
    treeCanvas.style.transformOrigin = 'top left';
  });
  
  document.getElementById('resetViewBtn').addEventListener('click', () => {
    currentZoom = 1;
    treeCanvas.style.transform = 'scale(1)';
    treeWrapper.scrollTop = 0;
    treeWrapper.scrollLeft = 0;
  });
  
  // Modal close buttons
  const modal = document.getElementById('perkModal');
  const closeBtn = document.getElementById('perkModalClose');
  const overlay = document.getElementById('perkModalOverlay');
  
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
  overlay.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
  // Close on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      modal.classList.remove('active');
    }
  });
}
