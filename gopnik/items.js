// ===== SHOP ITEMS DATABASE =====
// Tento soubor obsahuje všechny itemy ve hře

const SHOP_ITEMS = {
  weapons: [
    {
      id: 'ak47',
      name: 'AK-47',
      description: 'Legendární útočná puška. +25 síla, +10 obratnost',
      price: 8500,
      icon: '🔫',
      slot: 'weapon',
      bonuses: { strength: 25, dexterity: 10 }
    },
    {
      id: 'm249',
      name: 'M249 SAW',
      description: 'Těžký kulomet. +40 síla, +15 obrana, -5 obratnost',
      price: 15000,
      icon: '🔫',
      slot: 'weapon',
      bonuses: { strength: 40, defense: 15, dexterity: -5 }
    },
    {
      id: 'palka',
      name: 'Baseball pálka',
      description: 'Klasická dřevěná pálka. +8 síla, +5 štěstí',
      price: 350,
      icon: '⚾',
      slot: 'weapon',
      bonuses: { strength: 8, luck: 5 }
    },
    {
      id: 'nuz',
      name: 'Taktický nůž',
      description: 'Ostrý bojový nůž. +12 síla, +15 obratnost',
      price: 600,
      icon: '🔪',
      slot: 'weapon',
      bonuses: { strength: 12, dexterity: 15 }
    },
    {
      id: 'taser',
      name: 'Taser X26',
      description: 'Elektrická obušek. +5 síla, +20 inteligence',
      price: 1200,
      icon: '⚡',
      slot: 'weapon',
      bonuses: { strength: 5, intelligence: 20 }
    },
    {
      id: 'glock',
      name: 'Glock 19',
      description: 'Spolehlivá pistole. +18 síla, +12 obratnost',
      price: 4500,
      icon: '🔫',
      slot: 'weapon',
      bonuses: { strength: 18, dexterity: 12 }
    },
    {
      id: 'shotgun',
      name: 'Brokovnice',
      description: 'Devastující na krátkou vzdálenost. +35 síla',
      price: 7000,
      icon: '🔫',
      slot: 'weapon',
      bonuses: { strength: 35 }
    },
    {
      id: 'sniper',
      name: 'Odstřelovačka',
      description: 'Přesnost na dlouhou vzdálenost. +28 síla, +20 obratnost',
      price: 12000,
      icon: '🔫',
      slot: 'weapon',
      bonuses: { strength: 28, dexterity: 20 }
    }
    ,
    { id:'uzi', name:'Uzi', description:'Kompaktní samopal. +16 síla, +18 obratnost', price:5200, icon:'🔫', slot:'weapon', bonuses:{ strength:16, dexterity:18 } },
    { id:'mp5', name:'MP5', description:'Tichý samopal. +14 síla, +22 obratnost', price:6100, icon:'🔫', slot:'weapon', bonuses:{ strength:14, dexterity:22 } },
    { id:'deagle', name:'Desert Eagle', description:'Těžká pistole. +24 síla, -4 obratnost', price:7800, icon:'🔫', slot:'weapon', bonuses:{ strength:24, dexterity:-4 } },
    { id:'revolver', name:'Revolver .357', description:'Klasika. +20 síla, +6 štěstí', price:6400, icon:'🔫', slot:'weapon', bonuses:{ strength:20, luck:6 } },
    { id:'katana', name:'Katana', description:'Slav katana. +22 síla, +12 obratnost', price:9000, icon:'🗡️', slot:'weapon', bonuses:{ strength:22, dexterity:12 } },
    { id:'machete', name:'Mačeta', description:'Jungle vibe. +18 síla, +8 obratnost', price:4200, icon:'🗡️', slot:'weapon', bonuses:{ strength:18, dexterity:8 } },
    { id:'crowbar', name:'Páčidlo', description:'Když dojdou argumenty. +15 síla, +10 obrana', price:1800, icon:'🪓', slot:'weapon', bonuses:{ strength:15, defense:10 } },
    { id:'axe', name:'Sekera', description:'Sekera z trhu. +26 síla, -6 obratnost', price:5500, icon:'🪓', slot:'weapon', bonuses:{ strength:26, dexterity:-6 } },
    { id:'bat_metal', name:'Ocelová pálka', description:'Těžší než dřevo. +14 síla, +6 obrana', price:2400, icon:'🏏', slot:'weapon', bonuses:{ strength:14, defense:6 } },
    { id:'pipe', name:'Trubka', description:'Trubka z paneláku. +12 síla, +4 štěstí', price:1200, icon:'🔧', slot:'weapon', bonuses:{ strength:12, luck:4 } },
    { id:'molotov', name:'Molotov', description:'Hořlavá “special”. +10 inteligence, +12 síla', price:3200, icon:'🍾', slot:'weapon', bonuses:{ intelligence:10, strength:12 } },
    { id:'crossbow', name:'Kuše', description:'Tichá smrt. +20 síla, +16 obratnost', price:8200, icon:'🏹', slot:'weapon', bonuses:{ strength:20, dexterity:16 } },
    { id:'sks', name:'SKS', description:'Dlouhá puška. +27 síla, +10 obratnost', price:9800, icon:'🔫', slot:'weapon', bonuses:{ strength:27, dexterity:10 } },
    { id:'famas', name:'FAMAS', description:'Francouzská rychlost. +23 síla, +14 obratnost', price:11000, icon:'🔫', slot:'weapon', bonuses:{ strength:23, dexterity:14 } },
    { id:'scar', name:'SCAR-H', description:'Moderní puška. +32 síla, +8 obrana', price:16000, icon:'🔫', slot:'weapon', bonuses:{ strength:32, defense:8 } },
    { id:'rpk', name:'RPK', description:'Lehký kulomet. +34 síla, +10 obrana, -5 obratnost', price:14500, icon:'🔫', slot:'weapon', bonuses:{ strength:34, defense:10, dexterity:-5 } },
    { id:'ppsh', name:'PPSh-41', description:'Bubnový zásobník. +19 síla, +20 obratnost', price:7200, icon:'🔫', slot:'weapon', bonuses:{ strength:19, dexterity:20 } },
    { id:'fnfal', name:'FN FAL', description:'Battle rifle. +30 síla, +6 obrana', price:13500, icon:'🔫', slot:'weapon', bonuses:{ strength:30, defense:6 } },
    { id:'saiga', name:'Saiga-12', description:'Brokovnice na steroidy. +38 síla, -6 obratnost', price:14000, icon:'🔫', slot:'weapon', bonuses:{ strength:38, dexterity:-6 } },
    { id:'knife_gold', name:'Zlatý nůž', description:'Flex. +14 síla, +14 obratnost, +10 štěstí', price:12500, icon:'🔪', slot:'weapon', bonuses:{ strength:14, dexterity:14, luck:10 } }

  ],
  armor: [
    {
      id: 'vest',
      name: 'Neprůstřelná vesta',
      description: 'Kevlarová ochrana. +35 obrana, +10 výdrž',
      price: 6000,
      icon: '🦺',
      slot: 'armor',
      bonuses: { defense: 35, constitution: 10 }
    },
    {
      id: 'helmet',
      name: 'Taktická helma',
      description: 'Bojová přilba. +20 obrana, +5 inteligence',
      price: 3500,
      icon: '⛑️',
      slot: 'helmet',
      bonuses: { defense: 20, intelligence: 5 }
    },
    {
      id: 'boots',
      name: 'Vojenské boty',
      description: 'Těžké boty. +15 obrana, +8 výdrž',
      price: 2000,
      icon: '👢',
      slot: 'boots',
      bonuses: { defense: 15, constitution: 8 }
    },
    {
      id: 'gloves',
      name: 'Taktické rukavice',
      description: 'Posílené rukavice. +10 síla, +12 obratnost',
      price: 1500,
      icon: '🧤',
      slot: 'gloves',
      bonuses: { strength: 10, dexterity: 12 }
    },
    {
      id: 'vest_heavy',
      name: 'Těžká vesta',
      description: 'Maximální ochrana. +50 obrana, +15 výdrž, -10 obratnost',
      price: 11000,
      icon: '🦺',
      slot: 'armor',
      bonuses: { defense: 50, constitution: 15, dexterity: -10 }
    },
    {
      id: 'helmet_riot',
      name: 'Výtržnická helma',
      description: 'Plná ochrana hlavy. +30 obrana',
      price: 5500,
      icon: '⛑️',
      slot: 'helmet',
      bonuses: { defense: 30 }
    }
  ],
  special: [
    {
      id: 'ring_power',
      name: 'Prsten síly',
      description: 'Magický artefakt. +30 síla',
      price: 12000,
      icon: '💍',
      slot: 'ring',
      bonuses: { strength: 30 }
    },
    {
      id: 'ring_wisdom',
      name: 'Prsten moudrosti',
      description: 'Zvyšuje inteligenci. +25 inteligence',
      price: 10000,
      icon: '💍',
      slot: 'ring',
      bonuses: { intelligence: 25 }
    },
    {
      id: 'ring_luck',
      name: 'Prsten štěstí',
      description: 'Přináší štěstí. +20 štěstí',
      price: 15000,
      icon: '💍',
      slot: 'ring',
      bonuses: { luck: 20 }
    },
    {
      id: 'backpack',
      name: 'Taktický batoh',
      description: 'Vojenský batoh. +20 výdrž, +10 štěstí',
      price: 3000,
      icon: '🎒',
      slot: 'backpack',
      bonuses: { constitution: 20, luck: 10 }
    },
    {
      id: 'backpack_large',
      name: 'Velký batoh',
      description: 'Obří nosnost. +35 výdrž',
      price: 6000,
      icon: '🎒',
      slot: 'backpack',
      bonuses: { constitution: 35 }
    },
    {
      id: 'shield',
      name: 'Policejní štít',
      description: 'Ochranný štít. +40 obrana',
      price: 7500,
      icon: '🛡️',
      slot: 'shield',
      bonuses: { defense: 40 }
    },
    {
      id: 'shield_riot',
      name: 'Výtržnický štít',
      description: 'Neproniknutelná ochrana. +60 obrana, -5 obratnost',
      price: 13000,
      icon: '🛡️',
      slot: 'shield',
      bonuses: { defense: 60, dexterity: -5 }
    }
  ]
};

// Export pro použití v jiných souborech
if (typeof window !== 'undefined') {
  window.SHOP_ITEMS = SHOP_ITEMS;
}