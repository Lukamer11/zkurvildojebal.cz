// ===== SHOP ITEMS DATABASE =====
// Tento soubor obsahuje všechny itemy ve hře

const SHOP_ITEMS = {
  weapons: [
    {
      id: 'ak47',
      name: 'AK-47',
      description: 'Legendární útočná puška. +25 síla, +10 štěstí',
      price: 8500,
      icon: 'zbranshop1.jpg',
      slot: 'weapon',
      bonuses: { strength: 25, luck: 10 }
    },
    {
      id: 'm249',
      name: 'M249 SAW',
      description: 'Těžký kulomet. +40 síla, +15 obrana, -5 štěstí',
      price: 15000,
      icon: 'zbranshop2.jpg',
      slot: 'weapon',
      bonuses: { strength: 40, defense: 15, luck: -5 }
    },
    {
      id: 'palka',
      name: 'Baseball pálka',
      description: 'Klasická dřevěná pálka. +8 síla, +5 štěstí',
      price: 350,
      icon: 'zbranshop3.jpg',
      slot: 'weapon',
      bonuses: { strength: 8, luck: 5 }
    },
    {
      id: 'nuz',
      name: 'Taktický nůž',
      description: 'Ostrý bojový nůž. +12 síla, +15 štěstí',
      price: 600,
      icon: '🔪',
      slot: 'weapon',
      bonuses: { strength: 12, luck: 15 }
    },
    {
      id: 'taser',
      name: 'Taser X26',
      description: 'Elektrický paralyzér. +20 síla, +8 štěstí',
      price: 1200,
      icon: '⚡',
      slot: 'weapon',
      bonuses: { strength: 20, luck: 8 }
    },
    {
      id: 'glock',
      name: 'Glock 19',
      description: 'Spolehlivá pistole. +18 síla, +12 štěstí',
      price: 4500,
      icon: '🔫',
      slot: 'weapon',
      bonuses: { strength: 18, luck: 12 }
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
      description: 'Přesnost na dlouhou vzdálenost. +28 síla, +20 štěstí',
      price: 12000,
      icon: '🔫',
      slot: 'weapon',
      bonuses: { strength: 28, luck: 20 }
    }
    ,
    { id:'uzi', name:'Uzi', description:'Kompaktní samopal. +16 síla, +18 štěstí', price:5200, icon:'🔫', slot:'weapon', bonuses:{ strength:16, luck:18 } },
    { id:'mp5', name:'MP5', description:'Tichý samopal. +14 síla, +22 štěstí', price:6100, icon:'🔫', slot:'weapon', bonuses:{ strength:14, luck:22 } },
    { id:'deagle', name:'Desert Eagle', description:'Těžká pistole. +24 síla, -4 štěstí', price:7800, icon:'🔫', slot:'weapon', bonuses:{ strength:24, luck:-4 } },
    { id:'revolver', name:'Revolver .357', description:'Klasika. +20 síla, +6 štěstí', price:6400, icon:'🔫', slot:'weapon', bonuses:{ strength:20, luck:6 } },
    { id:'katana', name:'Katana', description:'Slav katana. +22 síla, +12 štěstí', price:9000, icon:'🗡️', slot:'weapon', bonuses:{ strength:22, luck:12 } },
    { id:'machete', name:'Mačeta', description:'Jungle vibe. +18 síla, +8 štěstí', price:4200, icon:'🗡️', slot:'weapon', bonuses:{ strength:18, luck:8 } },
    { id:'crowbar', name:'Páčidlo', description:'Když dojdou argumenty. +15 síla, +10 obrana', price:1800, icon:'🪓', slot:'weapon', bonuses:{ strength:15, defense:10 } },
    { id:'axe', name:'Sekera', description:'Sekera z trhu. +26 síla, -6 štěstí', price:5500, icon:'🪓', slot:'weapon', bonuses:{ strength:26, luck:-6 } },
    { id:'bat_metal', name:'Ocelová pálka', description:'Těžší než dřevo. +14 síla, +6 obrana', price:2400, icon:'🏏', slot:'weapon', bonuses:{ strength:14, defense:6 } },
    { id:'pipe', name:'Trubka', description:'Trubka z paneláku. +12 síla, +4 štěstí', price:1200, icon:'🔧', slot:'weapon', bonuses:{ strength:12, luck:4 } },
    { id:'molotov', name:'Molotov', description:'Hořlavá “special”. +10 síla, +12 síla', price:3200, icon:'🍾', slot:'weapon', bonuses:{ strength:10, strength:12 } },
    { id:'crossbow', name:'Kuše', description:'Tichá smrt. +20 síla, +16 štěstí', price:8200, icon:'🏹', slot:'weapon', bonuses:{ strength:20, luck:16 } },
    { id:'sks', name:'SKS', description:'Dlouhá puška. +27 síla, +10 štěstí', price:9800, icon:'🔫', slot:'weapon', bonuses:{ strength:27, luck:10 } },
    { id:'famas', name:'FAMAS', description:'Francouzská rychlost. +23 síla, +14 štěstí', price:11000, icon:'🔫', slot:'weapon', bonuses:{ strength:23, luck:14 } },
    { id:'scar', name:'SCAR-H', description:'Moderní puška. +32 síla, +8 obrana', price:16000, icon:'🔫', slot:'weapon', bonuses:{ strength:32, defense:8 } },
    { id:'rpk', name:'RPK', description:'Lehký kulomet. +34 síla, +10 obrana, -5 štěstí', price:14500, icon:'🔫', slot:'weapon', bonuses:{ strength:34, defense:10, luck:-5 } },
    { id:'ppsh', name:'PPSh-41', description:'Bubnový zásobník. +19 síla, +20 štěstí', price:7200, icon:'🔫', slot:'weapon', bonuses:{ strength:19, luck:20 } },
    { id:'fnfal', name:'FN FAL', description:'Battle rifle. +30 síla, +6 obrana', price:13500, icon:'🔫', slot:'weapon', bonuses:{ strength:30, defense:6 } },
    { id:'saiga', name:'Saiga-12', description:'Brokovnice na steroidy. +38 síla, -6 štěstí', price:14000, icon:'🔫', slot:'weapon', bonuses:{ strength:38, luck:-6 } },
    { id:'knife_gold', name:'Zlatý nůž', description:'Flex. +14 síla, +24 štěstí', price:12500, icon:'🔪', slot:'weapon', bonuses:{ strength:14, luck:24 } },

    /* ===== Dodatečné zbraně (1–43) – konkrétní názvy pro snadné další úpravy ===== */
    { id:'w29', name:'M4A1', description:'Útočná puška (5.56). +26 síla, +10 štěstí', price:11500, icon:'zbran29.jpg', slot:'weapon', bonuses:{ strength:26, luck:10 } },
    { id:'w30', name:'AKS-74U', description:'Krátká AK varianta. +22 síla, +14 štěstí', price:9800, icon:'zbran30.jpg', slot:'weapon', bonuses:{ strength:22, luck:14 } },
    { id:'w31', name:'G36C', description:'Kompaktní karabina. +24 síla, +12 obrana', price:12300, icon:'zbran31.jpg', slot:'weapon', bonuses:{ strength:24, defense:12 } },
    { id:'w32', name:'Mosin-Nagant', description:'Starý bolt-action. +28 síla, +6 štěstí', price:8900, icon:'zbran32.jpg', slot:'weapon', bonuses:{ strength:28, luck:6 } },
    { id:'w33', name:'SVD Dragunov', description:'Poloautomatická DMR. +31 síla, +14 štěstí', price:15500, icon:'zbran33.jpg', slot:'weapon', bonuses:{ strength:31, luck:14 } },
    { id:'w34', name:'VSS Vintorez', description:'Tichá DMR. +27 síla, +18 štěstí', price:16200, icon:'zbran34.jpg', slot:'weapon', bonuses:{ strength:27, luck:18 } },
    { id:'w35', name:'Remington 870', description:'Pumpovací brokovnice. +33 síla, -4 štěstí', price:9200, icon:'zbran35.jpg', slot:'weapon', bonuses:{ strength:33, luck:-4 } },
    { id:'w36', name:'M1911', description:'Klasická pistole. +19 síla, +9 štěstí', price:5200, icon:'zbran36.jpg', slot:'weapon', bonuses:{ strength:19, luck:9 } },
    { id:'w37', name:'Beretta 92FS', description:'Služební pistole. +18 síla, +12 štěstí', price:5400, icon:'zbran37.jpg', slot:'weapon', bonuses:{ strength:18, luck:12 } },
    { id:'w38', name:'CZ 75', description:'Česká klasika. +20 síla, +10 štěstí', price:5600, icon:'zbran38.jpg', slot:'weapon', bonuses:{ strength:20, luck:10 } },
    { id:'w39', name:'Bojová dýka', description:'Rychlá zbraň na blízko. +16 síla, +16 štěstí', price:2600, icon:'zbran39.jpg', slot:'weapon', bonuses:{ strength:16, luck:16 } },
    { id:'w40', name:'Boxer', description:'Kovové klouby. +14 síla, +6 obrana', price:1400, icon:'zbran40.jpg', slot:'weapon', bonuses:{ strength:14, defense:6 } },
    { id:'w41', name:'Teleskopický obušek', description:'Kompaktní a rychlý. +17 síla, +8 obrana', price:3100, icon:'zbran41.jpg', slot:'weapon', bonuses:{ strength:17, defense:8 } },
    { id:'w42', name:'Samopal Vector', description:'Rychlá kadence. +25 síla, +16 štěstí', price:17500, icon:'zbranshop1.jpg', slot:'weapon', bonuses:{ strength:25, luck:16 } },
    { id:'w43', name:'P90', description:'Kompaktní PDW. +23 síla, +18 štěstí', price:16800, icon:'zbranshop2.jpg', slot:'weapon', bonuses:{ strength:23, luck:18 } }

  ],
  armor: [
    {
      id: 'vest',
      name: 'Neprůstřelná vesta',
      description: 'Kevlarová ochrana. +35 obrana, +10 výdrž',
      price: 6000,
      icon: 'vyb1.jpg',
      slot: 'armor',
      bonuses: { defense: 35, constitution: 10 }
    },
    {
      id: 'helmet',
      name: 'Taktická helma',
      description: 'Bojová přilba. +20 obrana, +5 síla',
      price: 3500,
      icon: 'vyb2.jpg',
      slot: 'helmet',
      bonuses: { defense: 20, strength: 5 }
    },
    {
      id: 'boots',
      name: 'Vojenské boty',
      description: 'Těžké boty. +15 obrana, +8 výdrž',
      price: 2000,
      icon: 'vyb3.jpg',
      slot: 'boots',
      bonuses: { defense: 15, constitution: 8 }
    },
    {
      id: 'gloves',
      name: 'Taktické rukavice',
      description: 'Posílené rukavice. +10 síla, +12 štěstí',
      price: 1500,
      icon: '🧤',
      slot: 'gloves',
      bonuses: { strength: 10, luck: 12 }
    },
    {
      id: 'vest_heavy',
      name: 'Těžká vesta',
      description: 'Maximální ochrana. +50 obrana, +15 výdrž, -10 štěstí',
      price: 11000,
      icon: '🦺',
      slot: 'armor',
      bonuses: { defense: 50, constitution: 15, luck: -10 }
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
      description: 'Těžší hlava = tvrdší rána. +25 síla',
      price: 10000,
      icon: '💍',
      slot: 'ring',
      bonuses: { strength: 25 }
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
      description: 'Neproniknutelná ochrana. +60 obrana, -5 štěstí',
      price: 13000,
      icon: '🛡️',
      slot: 'shield',
      bonuses: { defense: 60, luck: -5 }
    }
  ]
};

// Export pro použití v jiných souborech
if (typeof window !== 'undefined') {
  window.SHOP_ITEMS = SHOP_ITEMS;
}
// ===== AUTO RARITY (kdyz item nema rarity, dopocte se z ceny) =====
(function applyAutoRarity(){
  try {
    const toRarity = (price) => {
      const p = Number(price || 0);
      if (p >= 14000) return 'legendary';
      if (p >= 9000)  return 'epic';
      if (p >= 3500)  return 'rare';
      if (p >= 1500)  return 'uncommon';
      return 'common';
    };

    Object.keys(SHOP_ITEMS || {}).forEach(cat => {
      const arr = SHOP_ITEMS[cat];
      if (!Array.isArray(arr)) return;
      arr.forEach(it => {
        if (!it || typeof it !== 'object') return;
        if (!it.rarity) it.rarity = toRarity(it.price);
      });
    });

    if (typeof window !== 'undefined') {
      window.SF = window.SF || {};
      window.SF.getAutoRarity = (item) => {
        if (!item) return 'common';
        return item.rarity || toRarity(item.price);
      };
    }
  } catch (e) {
    // ticho – jen UI cukr
  }
})();
