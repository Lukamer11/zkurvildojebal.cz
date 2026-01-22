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
    reward: { type: "special", id: "wrench", name: "Mechanikův Klíč", icon: "🔧", bonuses: { strength: 30, defense: 15 } }
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
    reward: { type: "armor", id: "gopnik_tracksuit", name: "Krālovskā Teplākovka", icon: "👕", bonuses: { defense: 25, luck: 20 } }
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
    reward: { type: "special", id: "laptop", name: "Hackerský Laptop", icon: "💻", bonuses: { luck: 40, defense: 20 } }
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
    reward: { type: "weapon", id: "death_ak", name: "AK-47 Smrti", icon: "🔫", bonuses: { strength: 50, defense: 30 } }
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
    reward: { type: "special", id: "kremlin_crown", name: "Koruna Kremlu", icon: "👑", bonuses: { strength: 50, defense: 50, luck: 50 } }
  },
  {
    level: 11,
    name: "Sergej – Železná ruka",
    icon: "🦾",
    hp: 10000,
    avatar: "boss11.jpg",
    story: "Sergej – Železná ruka hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Sergej – Železná ruka jde po tobě.",
    background: "boss11.jpg",
    reward: { type: "special", id: "trophy_11", name: "Trofej: Sergej – Železná ruka", icon: "🏆", bonuses: { strength: 22, defense: 5, luck: 3 } }
  },
  {
    level: 12,
    name: "Andrej – Krypto šmelinář",
    icon: "🪙",
    hp: 12500,
    avatar: "boss12.jpg",
    story: "Andrej – Krypto šmelinář hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Andrej – Krypto šmelinář jde po tobě.",
    background: "boss12.jpg",
    reward: { type: "special", id: "trophy_12", name: "Trofej: Andrej – Krypto šmelinář", icon: "🏆", bonuses: { strength: 24, defense: 6, luck: 4 } }
  },
  {
    level: 13,
    name: "Oleg Černý – Tržní boss",
    icon: "🕶️",
    hp: 15000,
    avatar: "boss13.jpg",
    story: "Oleg Černý – Tržní boss hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Oleg Černý – Tržní boss jde po tobě.",
    background: "boss13.jpg",
    reward: { type: "special", id: "trophy_13", name: "Trofej: Oleg Černý – Tržní boss", icon: "🏆", bonuses: { strength: 26, defense: 6, luck: 4 } }
  },
  {
    level: 14,
    name: "Boris – Noční taxikář",
    icon: "🚕",
    hp: 17500,
    avatar: "boss14.jpg",
    story: "Boris – Noční taxikář hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Boris – Noční taxikář jde po tobě.",
    background: "boss14.jpg",
    reward: { type: "special", id: "trophy_14", name: "Trofej: Boris – Noční taxikář", icon: "🏆", bonuses: { strength: 28, defense: 7, luck: 4 } }
  },
  {
    level: 15,
    name: "Maksim – Král paneláků",
    icon: "🏢",
    hp: 20000,
    avatar: "boss15.jpg",
    story: "Maksim – Král paneláků hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Maksim – Král paneláků jde po tobě.",
    background: "boss15.jpg",
    reward: { type: "special", id: "trophy_15", name: "Trofej: Maksim – Král paneláků", icon: "🏆", bonuses: { strength: 30, defense: 7, luck: 5 } }
  },
  {
    level: 16,
    name: "Ivan – Správce uzlu",
    icon: "🖧",
    hp: 22500,
    avatar: "boss16.jpg",
    story: "Ivan – Správce uzlu hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Ivan – Správce uzlu jde po tobě.",
    background: "boss16.jpg",
    reward: { type: "special", id: "trophy_16", name: "Trofej: Ivan – Správce uzlu", icon: "🏆", bonuses: { strength: 32, defense: 8, luck: 5 } }
  },
  {
    level: 17,
    name: "Roman – Otec gangu",
    icon: "🚬",
    hp: 25000,
    avatar: "boss17.jpg",
    story: "Roman – Otec gangu hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Roman – Otec gangu jde po tobě.",
    background: "boss17.jpg",
    reward: { type: "special", id: "trophy_17", name: "Trofej: Roman – Otec gangu", icon: "🏆", bonuses: { strength: 34, defense: 8, luck: 5 } }
  },
  {
    level: 18,
    name: "Viktor – Architekt pádu",
    icon: "🧨",
    hp: 27500,
    avatar: "boss18.jpg",
    story: "Viktor – Architekt pádu hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Viktor – Architekt pádu jde po tobě.",
    background: "boss18.jpg",
    reward: { type: "special", id: "trophy_18", name: "Trofej: Viktor – Architekt pádu", icon: "🏆", bonuses: { strength: 36, defense: 9, luck: 6 } }
  },
  {
    level: 19,
    name: "Neznámý – Bez záznamu",
    icon: "❓",
    hp: 30000,
    avatar: "boss19.jpg",
    story: "Neznámý – Bez záznamu hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Neznámý – Bez záznamu jde po tobě.",
    background: "boss19.jpg",
    reward: { type: "special", id: "trophy_19", name: "Trofej: Neznámý – Bez záznamu", icon: "🏆", bonuses: { strength: 38, defense: 9, luck: 6 } }
  },
  {
    level: 20,
    name: "První gopnik",
    icon: "👟",
    hp: 32500,
    avatar: "boss20.jpg",
    story: "První gopnik hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a První gopnik jde po tobě.",
    background: "boss20.jpg",
    reward: { type: "special", id: "trophy_20", name: "Trofej: První gopnik", icon: "🏆", bonuses: { strength: 40, defense: 10, luck: 6 } }
  },
  {
    level: 21,
    name: "Tonda – Král vrakoviště",
    icon: "🛠️",
    hp: 35000,
    avatar: "boss21.jpg",
    story: "Tonda – Král vrakoviště hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Tonda – Král vrakoviště jde po tobě.",
    background: "boss21.jpg",
    reward: { type: "special", id: "trophy_21", name: "Trofej: Tonda – Král vrakoviště", icon: "🏆", bonuses: { strength: 42, defense: 10, luck: 7 } }
  },
  {
    level: 22,
    name: "Luboš – Mistr ruční brzdy",
    icon: "🧱",
    hp: 37500,
    avatar: "boss22.jpg",
    story: "Luboš – Mistr ruční brzdy hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Luboš – Mistr ruční brzdy jde po tobě.",
    background: "boss22.jpg",
    reward: { type: "special", id: "trophy_22", name: "Trofej: Luboš – Mistr ruční brzdy", icon: "🏆", bonuses: { strength: 44, defense: 11, luck: 7 } }
  },
  {
    level: 23,
    name: "Míša – Sběratel katalyzátorů",
    icon: "🔩",
    hp: 40000,
    avatar: "boss23.jpg",
    story: "Míša – Sběratel katalyzátorů hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Míša – Sběratel katalyzátorů jde po tobě.",
    background: "boss23.jpg",
    reward: { type: "special", id: "trophy_23", name: "Trofej: Míša – Sběratel katalyzátorů", icon: "🏆", bonuses: { strength: 46, defense: 11, luck: 7 } }
  },
  {
    level: 24,
    name: "Gena – Lovec pojistek",
    icon: "🧯",
    hp: 42500,
    avatar: "boss24.jpg",
    story: "Gena – Lovec pojistek hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Gena – Lovec pojistek jde po tobě.",
    background: "boss24.jpg",
    reward: { type: "special", id: "trophy_24", name: "Trofej: Gena – Lovec pojistek", icon: "🏆", bonuses: { strength: 48, defense: 12, luck: 8 } }
  },
  {
    level: 25,
    name: "Karel – Pán garáží",
    icon: "🔑",
    hp: 45000,
    avatar: "boss25.jpg",
    story: "Karel – Pán garáží hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Karel – Pán garáží jde po tobě.",
    background: "boss25.jpg",
    reward: { type: "special", id: "trophy_25", name: "Trofej: Karel – Pán garáží", icon: "🏆", bonuses: { strength: 50, defense: 12, luck: 8 } }
  },
  {
    level: 26,
    name: "Jura – Vůdce šroťáku",
    icon: "🗑️",
    hp: 47500,
    avatar: "boss26.jpg",
    story: "Jura – Vůdce šroťáku hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Jura – Vůdce šroťáku jde po tobě.",
    background: "boss26.jpg",
    reward: { type: "special", id: "trophy_26", name: "Trofej: Jura – Vůdce šroťáku", icon: "🏆", bonuses: { strength: 52, defense: 13, luck: 8 } }
  },
  {
    level: 27,
    name: "Pavel – Směnárník z podchodu",
    icon: "💱",
    hp: 50000,
    avatar: "boss27.jpg",
    story: "Pavel – Směnárník z podchodu hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Pavel – Směnárník z podchodu jde po tobě.",
    background: "boss27.jpg",
    reward: { type: "special", id: "trophy_27", name: "Trofej: Pavel – Směnárník z podchodu", icon: "🏆", bonuses: { strength: 54, defense: 13, luck: 9 } }
  },
  {
    level: 28,
    name: "Radek – Dealer oktanů",
    icon: "⛽",
    hp: 52500,
    avatar: "boss28.jpg",
    story: "Radek – Dealer oktanů hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Radek – Dealer oktanů jde po tobě.",
    background: "boss28.jpg",
    reward: { type: "special", id: "trophy_28", name: "Trofej: Radek – Dealer oktanů", icon: "🏆", bonuses: { strength: 56, defense: 14, luck: 9 } }
  },
  {
    level: 29,
    name: "Sasha – Přepínač VIN",
    icon: "🧾",
    hp: 55000,
    avatar: "boss29.jpg",
    story: "Sasha – Přepínač VIN hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Sasha – Přepínač VIN jde po tobě.",
    background: "boss29.jpg",
    reward: { type: "special", id: "trophy_29", name: "Trofej: Sasha – Přepínač VIN", icon: "🏆", bonuses: { strength: 58, defense: 14, luck: 9 } }
  },
  {
    level: 30,
    name: "Ilja – Pán checkpointu",
    icon: "🚧",
    hp: 57500,
    avatar: "boss30.jpg",
    story: "Ilja – Pán checkpointu hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Ilja – Pán checkpointu jde po tobě.",
    background: "boss30.jpg",
    reward: { type: "special", id: "trophy_30", name: "Trofej: Ilja – Pán checkpointu", icon: "🏆", bonuses: { strength: 60, defense: 15, luck: 10 } }
  },
  {
    level: 31,
    name: "Matěj – Přízrak z liftu",
    icon: "🛗",
    hp: 60000,
    avatar: "boss31.jpg",
    story: "Matěj – Přízrak z liftu hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Matěj – Přízrak z liftu jde po tobě.",
    background: "boss31.jpg",
    reward: { type: "special", id: "trophy_31", name: "Trofej: Matěj – Přízrak z liftu", icon: "🏆", bonuses: { strength: 62, defense: 15, luck: 10 } }
  },
  {
    level: 32,
    name: "Denis – Vládce výfuků",
    icon: "💨",
    hp: 62500,
    avatar: "boss32.jpg",
    story: "Denis – Vládce výfuků hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Denis – Vládce výfuků jde po tobě.",
    background: "boss32.jpg",
    reward: { type: "special", id: "trophy_32", name: "Trofej: Denis – Vládce výfuků", icon: "🏆", bonuses: { strength: 64, defense: 16, luck: 10 } }
  },
  {
    level: 33,
    name: "Žaneta – Královna parkoviště",
    icon: "🅿️",
    hp: 65000,
    avatar: "boss33.jpg",
    story: "Žaneta – Královna parkoviště hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Žaneta – Královna parkoviště jde po tobě.",
    background: "boss33.jpg",
    reward: { type: "special", id: "trophy_33", name: "Trofej: Žaneta – Královna parkoviště", icon: "🏆", bonuses: { strength: 66, defense: 16, luck: 11 } }
  },
  {
    level: 34,
    name: "Rita – Zlodějka klíčů",
    icon: "🗝️",
    hp: 67500,
    avatar: "boss34.jpg",
    story: "Rita – Zlodějka klíčů hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Rita – Zlodějka klíčů jde po tobě.",
    background: "boss34.jpg",
    reward: { type: "special", id: "trophy_34", name: "Trofej: Rita – Zlodějka klíčů", icon: "🏆", bonuses: { strength: 68, defense: 17, luck: 11 } }
  },
  {
    level: 35,
    name: "Arťom – Šéf odtahovky",
    icon: "🚛",
    hp: 70000,
    avatar: "boss35.jpg",
    story: "Arťom – Šéf odtahovky hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Arťom – Šéf odtahovky jde po tobě.",
    background: "boss35.jpg",
    reward: { type: "special", id: "trophy_35", name: "Trofej: Arťom – Šéf odtahovky", icon: "🏆", bonuses: { strength: 70, defense: 17, luck: 11 } }
  },
  {
    level: 36,
    name: "Standa – Kárkař",
    icon: "🛒",
    hp: 72500,
    avatar: "boss36.jpg",
    story: "Standa – Kárkař hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Standa – Kárkař jde po tobě.",
    background: "boss36.jpg",
    reward: { type: "special", id: "trophy_36", name: "Trofej: Standa – Kárkař", icon: "🏆", bonuses: { strength: 72, defense: 18, luck: 12 } }
  },
  {
    level: 37,
    name: "Nikolaj – Oligarcha 2.0",
    icon: "💰",
    hp: 75000,
    avatar: "boss37.jpg",
    story: "Nikolaj – Oligarcha 2.0 hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Nikolaj – Oligarcha 2.0 jde po tobě.",
    background: "boss37.jpg",
    reward: { type: "special", id: "trophy_37", name: "Trofej: Nikolaj – Oligarcha 2.0", icon: "🏆", bonuses: { strength: 74, defense: 18, luck: 12 } }
  },
  {
    level: 38,
    name: "Svetlana – Tichá střelkyně",
    icon: "🎯",
    hp: 77500,
    avatar: "boss38.jpg",
    story: "Svetlana – Tichá střelkyně hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Svetlana – Tichá střelkyně jde po tobě.",
    background: "boss38.jpg",
    reward: { type: "special", id: "trophy_38", name: "Trofej: Svetlana – Tichá střelkyně", icon: "🏆", bonuses: { strength: 76, defense: 19, luck: 12 } }
  },
  {
    level: 39,
    name: "Dmitrij – Hacker 2.0",
    icon: "🧠",
    hp: 80000,
    avatar: "boss39.jpg",
    story: "Dmitrij – Hacker 2.0 hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Dmitrij – Hacker 2.0 jde po tobě.",
    background: "boss39.jpg",
    reward: { type: "special", id: "trophy_39", name: "Trofej: Dmitrij – Hacker 2.0", icon: "🏆", bonuses: { strength: 78, defense: 19, luck: 13 } }
  },
  {
    level: 40,
    name: "Klon – Finální servis",
    icon: "👑",
    hp: 82500,
    avatar: "boss40.jpg",
    story: "Klon – Finální servis hlídá další patro Auto Crypty. Všude smrdí benzín, semínka a starý olej — ale kořist stojí za to.",
    encounterText: "Kov zaskřípe, světla probliknou… a Klon – Finální servis jde po tobě.",
    background: "boss40.jpg",
    reward: { type: "special", id: "trophy_40", name: "Trofej: Klon – Finální servis", icon: "🏆", bonuses: { strength: 80, defense: 20, luck: 13 } }
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

    constitution: 16,
    luck: 9
  },
  equipped: {},
  inventory: []
};

let currentBoss = null;

// ===== S&F-LIKE SCALING HELPERS =====
// V arena2 se HP počítá takto; držíme stejnou formuli, aby seděl UI i fight.
function calculateMaxHP(constitution, level) {
  const con = Math.max(0, Number(constitution) || 0);
  const lvl = Math.max(1, Number(level) || 1);
  return Math.round(250 + lvl * 35 + con * 22);
}

function clampInt(n, min = 1) {
  const v = Math.floor(Number(n) || 0);
  return Math.max(min, v);
}

function scaleStatsFromPlayer(mult, extraCon = 1.08) {
  const p = gameState.stats || {};
  return {
    strength: clampInt((p.strength || 10) * mult, 1),
    defense: clampInt((p.defense || 10) * mult, 1),

    constitution: clampInt((p.constitution || 10) * mult * extraCon, 1),
    luck: clampInt((p.luck || 10) * (0.95 * mult), 1),
  };
}

function getScaledBoss(bossIndex) {
  const base = BOSSES[bossIndex];
  if (!base) return null;

  const playerLevel = clampInt(gameState.level || 1, 1);
  // Crypta patro roste podobně jako dungeon v S&F: boss je vždy o něco před hráčem.
  const bossLevel = clampInt(Math.round(playerLevel + (base.level - 1) * 0.6), 1);

  // Síla bosse postupně roste; pozdější patra jsou brutálnější.
  const mult = 1.10 + (base.level - 1) * 0.05; // lvl1 ~1.10, lvl40 ~3.05

  const stats = scaleStatsFromPlayer(mult, 1.12);
  const hpMult = 1.00 + (base.level - 1) * 0.012; // mírné přifouknutí HP
  const maxHP = clampHp(Math.round(calculateMaxHP(stats.constitution, bossLevel) * hpMult));

  return {
    name: base.name,
    level: bossLevel,
    hp: maxHP,
    maxHP,
    stats, // arena2 si vezme přímo stats (lepší než odvozovat z hp)
    bossNumber: base.level,
    background: base.background,
    avatar: base.avatar,
    icon: base.icon,
  };
}

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
    const scaled = getScaledBoss(index);
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
        <span>🎚️ LVL:</span>
        <b>${fmtInt(scaled?.level ?? boss.level)}</b>
      </div>
      <div class="crypta-hp">
        <span>💀 HP:</span>
        <b>${fmtInt(scaled?.hp ?? boss.hp)}</b>
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

async function startBossFight(bossIndex) {
  const baseBoss = BOSSES[bossIndex];
  const scaledBoss = getScaledBoss(bossIndex);
  const boss = scaledBoss || {
    name: baseBoss?.name,
    level: baseBoss?.level,
    hp: baseBoss?.hp,
    avatar: baseBoss?.avatar,
    background: baseBoss?.background,
    icon: baseBoss?.icon,
    bossNumber: baseBoss?.level,
  };
  
  const bossData = {
    fromCrypta: true,
    bossIndex: bossIndex,
    autoStart: true, // DŮLEŽITÉ: řekne aréně aby automaticky začala
    boss: {
      name: boss.name,
      level: boss.level,
      hp: boss.hp,
      maxHP: boss.maxHP,
      stats: boss.stats,
      bossNumber: boss.bossNumber,
      background: boss.background,
      avatar: boss.avatar,
      icon: boss.icon
    },
    reward: baseBoss?.reward,
    story: baseBoss?.story
  };

  // Fallback pro arena2: i kdyby DB upsert nestihl doběhnout, máme payload lokálně
  try { sessionStorage.setItem('arenaFromCrypta', JSON.stringify(bossData)); } catch {}
  
  if (window.SFReady) await window.SFReady;
  const sb = window.SF?.sb;
  const uid = window.SF?.user?.id || window.SF?.stats?.user_id;
  if (sb && uid) {
    await sb.from('crypta_fights').upsert({ user_id: uid, payload: bossData }, { onConflict: 'user_id' });
  }
  const qs = new URLSearchParams();
  qs.set('fromCrypta', '1');
  window.location.href = 'arena2.html?' + qs.toString();
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