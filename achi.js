// achi.js - ACHIEVEMENT SYSTEM (2026-01-15)
(() => {
  'use strict';

  let supabase = null;

  // ====== CONFIG ======
  const CONFIG = {
    MAX_BONUS_PER_STAT: 40, // Max 40% bonus per stat
    ACHIEVEMENTS: [
      {
        id: 'first_steps',
        name: 'PRVNÍ KROKY',
        desc: 'Dosáhni 5. levelu',
        icon: '👶',
        type: 'level',
        requirement: 5,
        reward_cigs: 50,
        bonus: { type: 'xp', value: 5 }
      },
      {
        id: 'gopnik_junior',
        name: 'GOPNIK JUNIOR',
        desc: 'Dosáhni 10. levelu',
        icon: '🧒',
        type: 'level',
        requirement: 10,
        reward_cigs: 100,
        bonus: { type: 'attack', value: 5 }
      },
      {
        id: 'true_slav',
        name: 'PRAVÝ SLAV',
        desc: 'Dosáhni 25. levelu',
        icon: '💪',
        type: 'level',
        requirement: 25,
        reward_cigs: 250,
        bonus: { type: 'defense', value: 5 }
      },
      {
        id: 'gopnik_master',
        name: 'GOPNIK MASTER',
        desc: 'Dosáhni 50. levelu',
        icon: '👑',
        type: 'level',
        requirement: 50,
        reward_cigs: 500,
        bonus: { type: 'all', value: 10 }
      },
      {
        id: 'rich_slav',
        name: 'BOHATÝ SLAV',
        desc: 'Získej 10,000 rublů',
        icon: '💰',
        type: 'money',
        requirement: 10000,
        reward_cigs: 100,
        bonus: { type: 'money', value: 5 }
      },
      {
        id: 'oligarch',
        name: 'OLIGARCHA',
        desc: 'Získej 100,000 rublů',
        icon: '💎',
        type: 'money',
        requirement: 100000,
        reward_cigs: 500,
        bonus: { type: 'money', value: 10 }
      },
      {
        id: 'smoker',
        name: 'KUŘÁK',
        desc: 'Získej 100 grošů',
        icon: '🚬',
        type: 'cigarettes',
        requirement: 100,
        reward_cigs: 50,
        bonus: { type: 'cigs', value: 5 }
      },
      {
        id: 'chain_smoker',
        name: 'ŘETĚZOVÝ KUŘÁK',
        desc: 'Získej 1,000 grošů',
        icon: '💨',
        type: 'cigarettes',
        requirement: 1000,
        reward_cigs: 200,
        bonus: { type: 'cigs', value: 10 }
      },
      {
        id: 'first_blood',
        name: 'PRVNÍ KREV',
        desc: 'Vyhrај 10 soubojů v aréně',
        icon: '⚔️',
        type: 'arena_wins',
        requirement: 10,
        reward_cigs: 100,
        bonus: { type: 'attack', value: 5 }
      },
      {
        id: 'gladiator',
        name: 'GLADIÁTOR',
        desc: 'Vyhraj 50 soubojů v aréně',
        icon: '🏆',
        type: 'arena_wins',
        requirement: 50,
        reward_cigs: 300,
        bonus: { type: 'attack', value: 10 }
      },
      {
        id: 'guild_member',
        name: 'ČLEN GUILDY',
        desc: 'Připoj se k guildě',
        icon: '👥',
        type: 'guild_join',
        requirement: 1,
        reward_cigs: 100,
        bonus: { type: 'xp', value: 5 }
      },
      {
        id: 'guild_master',
        name: 'GUILD MASTER',
        desc: 'Založ vlastní guildu',
        icon: '🗝️',
        type: 'guild_create',
        requirement: 1,
        reward_cigs: 200,
        bonus: { type: 'all', value: 5 }
      },
      {
        id: 'boss_slayer',
        name: 'VRAH BOSSŮ',
        desc: 'Poraz prvního bosse v guild cryptě',
        icon: '💀',
        type: 'boss_kills',
        requirement: 1,
        reward_cigs: 500,
        bonus: { type: 'attack', value: 10 }
      },
      {
        id: 'boss_hunter',
        name: 'LOVEC BOSSŮ',
        desc: 'Poraz 3 bossy v guild cryptě',
        icon: '🔥',
        type: 'boss_kills',
        requirement: 3,
        reward_cigs: 1000,
        bonus: { type: 'all', value: 10 }
      },
      {
        id: 'mission_rookie',
        name: 'MISIONÁŘ',
        desc: 'Splň 10 misí',
        icon: '🎯',
        type: 'missions',
        requirement: 10,
        reward_cigs: 150,
        bonus: { type: 'xp', value: 5 }
      },
      {
        id: 'mission_master',
        name: 'MISTR MISÍ',
        desc: 'Splň 50 misí',
        icon: '🎖️',
        type: 'missions',
        requirement: 50,
        reward_cigs: 400,
        bonus: { type: 'xp', value: 10 }
      },
      {
        id: 'lucky_gopnik',
        name: 'ŠŤASTNÝ GOPNIK',
        desc: 'Vyber si 10x ze štěstí',
        icon: '🍀',
        type: 'wheel_spins',
        requirement: 10,
        reward_cigs: 100,
        bonus: { type: 'money', value: 5 }
      },
      {
        id: 'shopper',
        name: 'NAKUPUJÍCÍ',
        desc: 'Kup 20 itemů v shopu',
        icon: '🛒',
        type: 'shop_purchases',
        requirement: 20,
        reward_cigs: 200,
        bonus: { type: 'money', value: 5 }
      },
      {
        id: 'crypta_explorer',
        name: 'PRŮZKUMNÍK',
        desc: 'Navštiv cryptu 5x',
        icon: '🚗',
        type: 'crypta_visits',
        requirement: 5,
        reward_cigs: 100,
        bonus: { type: 'xp', value: 5 }
      },
      {
        id: 'ultimate_gopnik',
        name: 'ULTIMÁTNÍ GOPNIK',
        desc: 'Dosáhni 100. levelu',
        icon: '⭐',
        type: 'level',
        requirement: 100,
        reward_cigs: 2000,
        bonus: { type: 'all', value: 20 }
      },
      // ===== DALŠÍ 30 ACHIEVEMENTŮ =====
      {
        id: 'millionaire',
        name: 'MILIONÁŘ',
        desc: 'Získej 1,000,000 rublů',
        icon: '💸',
        type: 'money',
        requirement: 1000000,
        reward_cigs: 2000,
        bonus: { type: 'money', value: 15 }
      },
      {
        id: 'legendary_fighter',
        name: 'LEGENDÁRNÍ BOJOVNÍK',
        desc: 'Vyhraj 100 soubojů v aréně',
        icon: '🥇',
        type: 'arena_wins',
        requirement: 100,
        reward_cigs: 800,
        bonus: { type: 'attack', value: 15 }
      },
      {
        id: 'arena_champion',
        name: 'ŠAMPION ARÉNY',
        desc: 'Vyhraj 500 soubojů v aréně',
        icon: '👑',
        type: 'arena_wins',
        requirement: 500,
        reward_cigs: 3000,
        bonus: { type: 'attack', value: 20 }
      },
      {
        id: 'defender',
        name: 'OBRÁNCE',
        desc: 'Prohraj 20 soubojů (ale přežij)',
        icon: '🛡️',
        type: 'arena_losses',
        requirement: 20,
        reward_cigs: 150,
        bonus: { type: 'defense', value: 10 }
      },
      {
        id: 'iron_wall',
        name: 'ŽELEZNÁ ZEĎ',
        desc: 'Prohraj 100 soubojů',
        icon: '🏰',
        type: 'arena_losses',
        requirement: 100,
        reward_cigs: 500,
        bonus: { type: 'defense', value: 15 }
      },
      {
        id: 'smoke_lord',
        name: 'PÁN KOUŘE',
        desc: 'Získej 10,000 grošů',
        icon: '👺',
        type: 'cigarettes',
        requirement: 10000,
        reward_cigs: 1000,
        bonus: { type: 'cigs', value: 15 }
      },
      {
        id: 'guild_veteran',
        name: 'VETERÁN GUILDY',
        desc: 'Buď v guildě 30 dní',
        icon: '🎖️',
        type: 'guild_days',
        requirement: 30,
        reward_cigs: 500,
        bonus: { type: 'xp', value: 10 }
      },
      {
        id: 'guild_donor',
        name: 'DÁRCE GUILDY',
        desc: 'Přispěj 10,000 grošů do guild trezoru',
        icon: '🎁',
        type: 'guild_donations',
        requirement: 10000,
        reward_cigs: 800,
        bonus: { type: 'all', value: 5 }
      },
      {
        id: 'boss_destroyer',
        name: 'NIČITEL BOSSŮ',
        desc: 'Poraz všech 5 bossů',
        icon: '☠️',
        type: 'boss_kills',
        requirement: 5,
        reward_cigs: 2500,
        bonus: { type: 'attack', value: 20 }
      },
      {
        id: 'pvp_warrior',
        name: 'PVP VÁLEČNÍK',
        desc: 'Vyhraj 10 guild PvP bitev',
        icon: '⚔️',
        type: 'pvp_wins',
        requirement: 10,
        reward_cigs: 1000,
        bonus: { type: 'all', value: 10 }
      },
      {
        id: 'mission_legend',
        name: 'LEGENDÁRNÍ MISIONÁŘ',
        desc: 'Splň 200 misí',
        icon: '🏅',
        type: 'missions',
        requirement: 200,
        reward_cigs: 1500,
        bonus: { type: 'xp', value: 15 }
      },
      {
        id: 'daily_grinder',
        name: 'DENNÍ DŘINA',
        desc: 'Přihlas se 7 dní v řadě',
        icon: '📅',
        type: 'daily_streak',
        requirement: 7,
        reward_cigs: 300,
        bonus: { type: 'xp', value: 5 }
      },
      {
        id: 'loyal_player',
        name: 'VĚRNÝ HRÁČ',
        desc: 'Přihlas se 30 dní v řadě',
        icon: '🎯',
        type: 'daily_streak',
        requirement: 30,
        reward_cigs: 1200,
        bonus: { type: 'all', value: 10 }
      },
      {
        id: 'wheel_master',
        name: 'MISTR ŠTĚSTÍ',
        desc: 'Vyber si 100x ze štěstí',
        icon: '🎰',
        type: 'wheel_spins',
        requirement: 100,
        reward_cigs: 800,
        bonus: { type: 'money', value: 10 }
      },
      {
        id: 'shop_addict',
        name: 'ZÁVISLÁK NA SHOPU',
        desc: 'Kup 100 itemů v shopu',
        icon: '🛍️',
        type: 'shop_purchases',
        requirement: 100,
        reward_cigs: 1000,
        bonus: { type: 'money', value: 10 }
      },
      {
        id: 'crypta_veteran',
        name: 'VETERÁN CRYPTY',
        desc: 'Navštiv cryptu 50x',
        icon: '🚙',
        type: 'crypta_visits',
        requirement: 50,
        reward_cigs: 600,
        bonus: { type: 'xp', value: 10 }
      },
      {
        id: 'energy_master',
        name: 'MISTR ENERGIE',
        desc: 'Utratil 1,000 energie',
        icon: '⚡',
        type: 'energy_spent',
        requirement: 1000,
        reward_cigs: 500,
        bonus: { type: 'xp', value: 10 }
      },
      {
        id: 'speed_leveler',
        name: 'RYCHLÝ LEVELOVAČ',
        desc: 'Dosáhni 20. levelu za méně než 3 dny',
        icon: '🚀',
        type: 'speed_level',
        requirement: 20,
        reward_cigs: 800,
        bonus: { type: 'xp', value: 15 }
      },
      {
        id: 'item_collector',
        name: 'SBĚRATEL',
        desc: 'Vlastni 50 různých itemů',
        icon: '📦',
        type: 'unique_items',
        requirement: 50,
        reward_cigs: 700,
        bonus: { type: 'all', value: 5 }
      },
      {
        id: 'full_equipment',
        name: 'PLNÁ VÝBAVA',
        desc: 'Měj equipnutých všech 6 slotů',
        icon: '⚙️',
        type: 'equipment_slots',
        requirement: 6,
        reward_cigs: 400,
        bonus: { type: 'defense', value: 10 }
      },
      {
        id: 'epic_collector',
        name: 'EPICKÝ SBĚRATEL',
        desc: 'Vlastni 10 epic itemů',
        icon: '💜',
        type: 'epic_items',
        requirement: 10,
        reward_cigs: 1500,
        bonus: { type: 'all', value: 10 }
      },
      {
        id: 'legendary_collector',
        name: 'LEGENDÁRNÍ SBĚRATEL',
        desc: 'Vlastni 5 legendary itemů',
        icon: '🧡',
        type: 'legendary_items',
        requirement: 5,
        reward_cigs: 3000,
        bonus: { type: 'all', value: 15 }
      },
      {
        id: 'social_butterfly',
        name: 'SPOLEČENSKÝ MOTÝL',
        desc: 'Pozvěš 10 přátel',
        icon: '🦋',
        type: 'referrals',
        requirement: 10,
        reward_cigs: 1000,
        bonus: { type: 'money', value: 10 }
      },
      {
        id: 'mail_sender',
        name: 'PISATEL',
        desc: 'Pošli 50 mailů',
        icon: '📬',
        type: 'mails_sent',
        requirement: 50,
        reward_cigs: 300,
        bonus: { type: 'xp', value: 5 }
      },
      {
        id: 'top_ten',
        name: 'ТОПОВОЙ',
        desc: 'Dostaň se do TOP 10 žebříčku',
        icon: '🔟',
        type: 'ranking',
        requirement: 10,
        reward_cigs: 2000,
        bonus: { type: 'all', value: 15 }
      },
      {
        id: 'number_one',
        name: 'ČÍSLO JEDNA',
        desc: 'Dostaň se na 1. místo žebříčku',
        icon: '🥇',
        type: 'ranking',
        requirement: 1,
        reward_cigs: 5000,
        bonus: { type: 'all', value: 25 }
      },
      {
        id: 'dungeon_explorer',
        name: 'PRŮZKUMNÍK DUNGEONŮ',
        desc: 'Dokonči 20 dungeonů',
        icon: '🗺️',
        type: 'dungeons',
        requirement: 20,
        reward_cigs: 800,
        bonus: { type: 'xp', value: 10 }
      },
      {
        id: 'treasure_hunter',
        name: 'LOVEC POKLADŮ',
        desc: 'Najdi 50 pokladů',
        icon: '💎',
        type: 'treasures',
        requirement: 50,
        reward_cigs: 1200,
        bonus: { type: 'money', value: 15 }
      },
      {
        id: 'crafting_master',
        name: 'MISTR CRAFTINGU',
        desc: 'Vyrob 100 itemů',
        icon: '🔨',
        type: 'crafted_items',
        requirement: 100,
        reward_cigs: 900,
        bonus: { type: 'all', value: 5 }
      },
      {
        id: 'achievement_hunter',
        name: 'LOVEC ACHIEVEMENTŮ',
        desc: 'Odemkni 25 achievementů',
        icon: '🎯',
        type: 'achievements_unlocked',
        requirement: 25,
        reward_cigs: 1500,
        bonus: { type: 'all', value: 10 }
      },
      // ===== DALŠÍ 70 ACHIEVEMENTŮ (51-120) =====
      // LEVEL ACHIEVEMENTY (10 nových)
      {
        id: 'baby_gopnik',
        name: 'BABY GOPNIK',
        desc: 'Dosáhni 3. levelu',
        icon: '👼',
        type: 'level',
        requirement: 3,
        reward_cigs: 30,
        bonus: { type: 'xp', value: 3 }
      },
      {
        id: 'teenager',
        name: 'TEENAGER',
        desc: 'Dosáhni 15. levelu',
        icon: '🧑',
        type: 'level',
        requirement: 15,
        reward_cigs: 150,
        bonus: { type: 'xp', value: 5 }
      },
      {
        id: 'adult_gopnik',
        name: 'DOSPĚLÝ GOPNIK',
        desc: 'Dosáhni 30. levelu',
        icon: '🧔',
        type: 'level',
        requirement: 30,
        reward_cigs: 300,
        bonus: { type: 'attack', value: 7 }
      },
      {
        id: 'veteran',
        name: 'VETERÁN',
        desc: 'Dosáhni 40. levelu',
        icon: '👴',
        type: 'level',
        requirement: 40,
        reward_cigs: 400,
        bonus: { type: 'defense', value: 8 }
      },
      {
        id: 'elite_gopnik',
        name: 'ELITNÍ GOPNIK',
        desc: 'Dosáhni 60. levelu',
        icon: '🎩',
        type: 'level',
        requirement: 60,
        reward_cigs: 700,
        bonus: { type: 'all', value: 12 }
      },
      {
        id: 'legendary_gopnik',
        name: 'LEGENDÁRNÍ GOPNIK',
        desc: 'Dosáhni 75. levelu',
        icon: '🌟',
        type: 'level',
        requirement: 75,
        reward_cigs: 1000,
        bonus: { type: 'all', value: 15 }
      },
      {
        id: 'mythic_gopnik',
        name: 'MÝTICKÝ GOPNIK',
        desc: 'Dosáhni 90. levelu',
        icon: '✨',
        type: 'level',
        requirement: 90,
        reward_cigs: 1500,
        bonus: { type: 'all', value: 18 }
      },
      {
        id: 'demigod',
        name: 'POLOBŮH',
        desc: 'Dosáhni 120. levelu',
        icon: '🔱',
        type: 'level',
        requirement: 120,
        reward_cigs: 3000,
        bonus: { type: 'all', value: 25 }
      },
      {
        id: 'god_gopnik',
        name: 'BŮH GOPNIK',
        desc: 'Dosáhni 150. levelu',
        icon: '⚡',
        type: 'level',
        requirement: 150,
        reward_cigs: 5000,
        bonus: { type: 'all', value: 30 }
      },
      {
        id: 'max_level',
        name: 'MAXIMUM',
        desc: 'Dosáhni 200. levelu',
        icon: '🌌',
        type: 'level',
        requirement: 200,
        reward_cigs: 10000,
        bonus: { type: 'all', value: 40 }
      },
      // ARENA ACHIEVEMENTY (10 nových)
      {
        id: 'arena_rookie',
        name: 'NOVÁČEK ARÉNY',
        desc: 'Vyhraj 5 soubojů',
        icon: '🥉',
        type: 'arena_wins',
        requirement: 5,
        reward_cigs: 50,
        bonus: { type: 'attack', value: 3 }
      },
      {
        id: 'arena_veteran',
        name: 'VETERÁN ARÉNY',
        desc: 'Vyhraj 200 soubojů',
        icon: '🎖️',
        type: 'arena_wins',
        requirement: 200,
        reward_cigs: 1500,
        bonus: { type: 'attack', value: 18 }
      },
      {
        id: 'arena_destroyer',
        name: 'NIČITEL ARÉNY',
        desc: 'Vyhraj 1000 soubojů',
        icon: '💥',
        type: 'arena_wins',
        requirement: 1000,
        reward_cigs: 5000,
        bonus: { type: 'attack', value: 25 }
      },
      {
        id: 'unbeatable',
        name: 'NEPORAZITELNÝ',
        desc: 'Vyhraj 10 soubojů v řadě',
        icon: '🔥',
        type: 'arena_win_streak',
        requirement: 10,
        reward_cigs: 800,
        bonus: { type: 'attack', value: 10 }
      },
      {
        id: 'win_streak_master',
        name: 'MISTR VÍTĚZNÝCH SÉRIÍ',
        desc: 'Vyhraj 25 soubojů v řadě',
        icon: '🌪️',
        type: 'arena_win_streak',
        requirement: 25,
        reward_cigs: 2000,
        bonus: { type: 'attack', value: 15 }
      },
      {
        id: 'tank',
        name: 'TANK',
        desc: 'Prohraj 50 soubojů ale přežij',
        icon: '🚛',
        type: 'arena_losses',
        requirement: 50,
        reward_cigs: 300,
        bonus: { type: 'defense', value: 12 }
      },
      {
        id: 'immortal_wall',
        name: 'NESMRTELNÁ ZEĎ',
        desc: 'Prohraj 500 soubojů',
        icon: '🗿',
        type: 'arena_losses',
        requirement: 500,
        reward_cigs: 2000,
        bonus: { type: 'defense', value: 20 }
      },
      {
        id: 'arena_master',
        name: 'MISTR ARÉNY',
        desc: 'Měj win rate přes 80%',
        icon: '👑',
        type: 'arena_winrate',
        requirement: 80,
        reward_cigs: 3000,
        bonus: { type: 'all', value: 15 }
      },
      {
        id: 'quick_killer',
        name: 'RYCHLÝ VRAH',
        desc: 'Vyhraj souboj do 10 sekund (100x)',
        icon: '⚡',
        type: 'quick_kills',
        requirement: 100,
        reward_cigs: 1200,
        bonus: { type: 'attack', value: 12 }
      },
      {
        id: 'comeback_king',
        name: 'KRÁL COMEBACKŮ',
        desc: 'Vyhraj s méně než 10% HP (50x)',
        icon: '💪',
        type: 'comebacks',
        requirement: 50,
        reward_cigs: 1500,
        bonus: { type: 'defense', value: 15 }
      },
      // PENÍZE & GROŠE (10 nových)
      {
        id: 'penny_pincher',
        name: 'ŠETŘITEL',
        desc: 'Měј 50,000 rublů najednou',
        icon: '🐷',
        type: 'money_held',
        requirement: 50000,
        reward_cigs: 300,
        bonus: { type: 'money', value: 5 }
      },
      {
        id: 'money_hoarder',
        name: 'HAMIŽNÝ',
        desc: 'Měј 500,000 rublů najednou',
        icon: '💰',
        type: 'money_held',
        requirement: 500000,
        reward_cigs: 1500,
        bonus: { type: 'money', value: 10 }
      },
      {
        id: 'billionaire',
        name: 'MILIARDÁŘ',
        desc: 'Získej celkem 10M rublů',
        icon: '💵',
        type: 'money',
        requirement: 10000000,
        reward_cigs: 8000,
        bonus: { type: 'money', value: 25 }
      },
      {
        id: 'money_printer',
        name: 'TISKÁRNA PENĚZ',
        desc: 'Získej 100k rublů za den',
        icon: '🖨️',
        type: 'daily_money',
        requirement: 100000,
        reward_cigs: 2000,
        bonus: { type: 'money', value: 15 }
      },
      {
        id: 'big_spender',
        name: 'VELKÝ UTRÁCEČ',
        desc: 'Utratil celkem 1M rublů',
        icon: '💸',
        type: 'money_spent',
        requirement: 1000000,
        reward_cigs: 1000,
        bonus: { type: 'money', value: 8 }
      },
      {
        id: 'cigarette_hoarder',
        name: 'HAMIŽNÍK GROŠŮ',
        desc: 'Měј 5,000 grošů najednou',
        icon: '🚬',
        type: 'cigs_held',
        requirement: 5000,
        reward_cigs: 500,
        bonus: { type: 'cigs', value: 8 }
      },
      {
        id: 'smoke_factory',
        name: 'TOVÁRNA NA KOUŘ',
        desc: 'Získej 50k grošů celkem',
        icon: '🏭',
        type: 'cigarettes',
        requirement: 50000,
        reward_cigs: 3000,
        bonus: { type: 'cigs', value: 20 }
      },
      {
        id: 'cigs_per_day',
        name: 'DENNÍ KUŘÁK',
        desc: 'Získej 1,000 grošů za den',
        icon: '📅',
        type: 'daily_cigs',
        requirement: 1000,
        reward_cigs: 1500,
        bonus: { type: 'cigs', value: 12 }
      },
      {
        id: 'never_smoke',
        name: 'NEKUŘÁK',
        desc: 'Neutratil ani jeden groš 7 dní',
        icon: '🚭',
        type: 'no_cigs_spent',
        requirement: 7,
        reward_cigs: 1000,
        bonus: { type: 'cigs', value: 10 }
      },
      {
        id: 'economic_master',
        name: 'EKONOMICKÝ MISTR',
        desc: 'Měј 1M rublů a 10k grošů zároveň',
        icon: '📊',
        type: 'economic',
        requirement: 1,
        reward_cigs: 5000,
        bonus: { type: 'all', value: 20 }
      },
      // GUILD ACHIEVEMENTY (10 nových)
      {
        id: 'guild_newbie',
        name: 'NOVIC GUILDY',
        desc: 'Buď v guildě 7 dní',
        icon: '🆕',
        type: 'guild_days',
        requirement: 7,
        reward_cigs: 200,
        bonus: { type: 'xp', value: 5 }
      },
      {
        id: 'guild_loyalist',
        name: 'LOAJÁLNÍ ČLEN',
        desc: 'Buď v guildě 60 dní',
        icon: '💎',
        type: 'guild_days',
        requirement: 60,
        reward_cigs: 1000,
        bonus: { type: 'xp', value: 12 }
      },
      {
        id: 'guild_legend',
        name: 'LEGENDA GUILDY',
        desc: 'Buď v guildě 180 dní',
        icon: '🏆',
        type: 'guild_days',
        requirement: 180,
        reward_cigs: 3000,
        bonus: { type: 'all', value: 15 }
      },
      {
        id: 'generous_donor',
        name: 'ŠTĚDRÝ DÁRCE',
        desc: 'Daruj 50k grošů do trezoru',
        icon: '💝',
        type: 'guild_donations',
        requirement: 50000,
        reward_cigs: 2500,
        bonus: { type: 'all', value: 10 }
      },
      {
        id: 'guild_supporter',
        name: 'PODPOROVATEL GUILDY',
        desc: 'Daruj 100k grošů do trezoru',
        icon: '🎖️',
        type: 'guild_donations',
        requirement: 100000,
        reward_cigs: 5000,
        bonus: { type: 'all', value: 15 }
      },
      {
        id: 'guild_hopper',
        name: 'SKÁKAČ GUILD',
        desc: 'Připoj se k 5 různým guildám',
        icon: '🦘',
        type: 'guilds_joined',
        requirement: 5,
        reward_cigs: 500,
        bonus: { type: 'xp', value: 5 }
      },
      {
        id: 'guild_founder',
        name: 'ZAKLADATEL',
        desc: 'Založ 3 guildy',
        icon: '🏗️',
        type: 'guilds_created',
        requirement: 3,
        reward_cigs: 1500,
        bonus: { type: 'all', value: 10 }
      },
      {
        id: 'boss_annihilator',
        name: 'ANIHILÁTOR BOSSŮ',
        desc: 'Poraz 10 bossů celkem',
        icon: '💀',
        type: 'boss_kills',
        requirement: 10,
        reward_cigs: 4000,
        bonus: { type: 'attack', value: 25 }
      },
      {
        id: 'boss_speedrun',
        name: 'SPEEDRUN BOSS',
        desc: 'Poraz bosse do 60 sekund',
        icon: '⏱️',
        type: 'boss_speedrun',
        requirement: 1,
        reward_cigs: 2000,
        bonus: { type: 'attack', value: 15 }
      },
      {
        id: 'pvp_dominator',
        name: 'PVP DOMINÁTOR',
        desc: 'Vyhraj 50 guild PvP',
        icon: '👊',
        type: 'pvp_wins',
        requirement: 50,
        reward_cigs: 4000,
        bonus: { type: 'all', value: 20 }
      },
      // MISE & QUESTY (8 nových)
      {
        id: 'quest_starter',
        name: 'ZAČÁTEČNÍK QUESTŮ',
        desc: 'Splň 5 misí',
        icon: '🎯',
        type: 'missions',
        requirement: 5,
        reward_cigs: 80,
        bonus: { type: 'xp', value: 3 }
      },
      {
        id: 'mission_veteran',
        name: 'VETERÁN MISÍ',
        desc: 'Splň 100 misí',
        icon: '🎖️',
        type: 'missions',
        requirement: 100,
        reward_cigs: 800,
        bonus: { type: 'xp', value: 12 }
      },
      {
        id: 'mission_god',
        name: 'BŮH MISÍ',
        desc: 'Splň 500 misí',
        icon: '👼',
        type: 'missions',
        requirement: 500,
        reward_cigs: 3000,
        bonus: { type: 'xp', value: 20 }
      },
      {
        id: 'daily_quester',
        name: 'DENNÍ QUESTAŘ',
        desc: 'Splň denní quest 30x',
        icon: '📆',
        type: 'daily_quests',
        requirement: 30,
        reward_cigs: 1200,
        bonus: { type: 'xp', value: 10 }
      },
      {
        id: 'weekly_warrior',
        name: 'TÝDENNÍ VÁLEČNÍK',
        desc: 'Splň týdenní quest 10x',
        icon: '📅',
        type: 'weekly_quests',
        requirement: 10,
        reward_cigs: 1500,
        bonus: { type: 'xp', value: 12 }
      },
      {
        id: 'perfect_mission',
        name: 'PERFEKTNÍ MISE',
        desc: 'Dokončií misi na 100%',
        icon: '💯',
        type: 'perfect_missions',
        requirement: 1,
        reward_cigs: 500,
        bonus: { type: 'xp', value: 8 }
      },
      {
        id: 'speed_quester',
        name: 'RYCHLÝ QUESTAŘ',
        desc: 'Splň misi do 5 minut (50x)',
        icon: '⚡',
        type: 'speed_missions',
        requirement: 50,
        reward_cigs: 1000,
        bonus: { type: 'xp', value: 10 }
      },
      {
        id: 'epic_quest',
        name: 'EPICKÝ QUEST',
        desc: 'Dokončí epic quest',
        icon: '🌟',
        type: 'epic_quests',
        requirement: 1,
        reward_cigs: 2000,
        bonus: { type: 'all', value: 10 }
      },
      // DENNÍ AKTIVITA & STREAK (7 nových)
      {
        id: 'three_day_streak',
        name: 'TŘI DNY',
        desc: 'Přihlas se 3 dny v řadě',
        icon: '3️⃣',
        type: 'daily_streak',
        requirement: 3,
        reward_cigs: 100,
        bonus: { type: 'xp', value: 3 }
      },
      {
        id: 'two_week_streak',
        name: 'DVA TÝDNY',
        desc: 'Přihlas se 14 dní v řadě',
        icon: '🔥',
        type: 'daily_streak',
        requirement: 14,
        reward_cigs: 500,
        bonus: { type: 'xp', value: 8 }
      },
      {
        id: 'month_streak',
        name: 'MĚSÍC',
        desc: 'Přihlas se 60 dní v řadě',
        icon: '📅',
        type: 'daily_streak',
        requirement: 60,
        reward_cigs: 2000,
        bonus: { type: 'all', value: 12 }
      },
      {
        id: 'three_months',
        name: 'TŘI MĚSÍCE',
        desc: 'Přihlas se 90 dní v řadě',
        icon: '💎',
        type: 'daily_streak',
        requirement: 90,
        reward_cigs: 4000,
        bonus: { type: 'all', value: 18 }
      },
      {
        id: 'half_year',
        name: 'PŮL ROKU',
        desc: 'Přihlas se 180 dní v řadě',
        icon: '👑',
        type: 'daily_streak',
        requirement: 180,
        reward_cigs: 8000,
        bonus: { type: 'all', value: 25 }
      },
      {
        id: 'full_year',
        name: 'CELÝ ROK',
        desc: 'Přihlas se 365 dní v řadě',
        icon: '🌟',
        type: 'daily_streak',
        requirement: 365,
        reward_cigs: 20000,
        bonus: { type: 'all', value: 40 }
      },
      {
        id: 'active_player',
        name: 'AKTIVNÍ HRÁČ',
        desc: 'Hraj 10 hodin celkem',
        icon: '⏰',
        type: 'playtime_hours',
        requirement: 10,
        reward_cigs: 500,
        bonus: { type: 'xp', value: 5 }
      },
      // SHOP & WHEEL (7 nových)
      {
        id: 'lucky_spin',
        name: 'ŠŤASTNÝ SPIN',
        desc: 'Získej jackpot ze štěstí',
        icon: '🎰',
        type: 'jackpots',
        requirement: 1,
        reward_cigs: 1000,
        bonus: { type: 'money', value: 10 }
      },
      {
        id: 'wheel_addict',
        name: 'ZÁVISLÁK NA KOLE',
        desc: 'Vyber si 500x ze štěstí',
        icon: '🎡',
        type: 'wheel_spins',
        requirement: 500,
        reward_cigs: 3000,
        bonus: { type: 'money', value: 15 }
      },
      {
        id: 'shopaholic',
        name: 'SHOPAHOLIC',
        desc: 'Kup 500 itemů',
        icon: '🛍️',
        type: 'shop_purchases',
        requirement: 500,
        reward_cigs: 4000,
        bonus: { type: 'money', value: 18 }
      },
      {
        id: 'bargain_hunter',
        name: 'LOVEC SLEV',
        desc: 'Kup 50 itemů ve slevě',
        icon: '💰',
        type: 'discounted_purchases',
        requirement: 50,
        reward_cigs: 1500,
        bonus: { type: 'money', value: 10 }
      },
      {
        id: 'premium_buyer',
        name: 'PRÉMIOVÝ KUPEC',
        desc: 'Kup 20 legendary itemů',
        icon: '👑',
        type: 'legendary_purchases',
        requirement: 20,
        reward_cigs: 3000,
        bonus: { type: 'all', value: 15 }
      },
      {
        id: 'black_market',
        name: 'ČERNÝ TRH',
        desc: 'Kup z černého trhu 50x',
        icon: '🎴',
        type: 'black_market',
        requirement: 50,
        reward_cigs: 2000,
        bonus: { type: 'money', value: 12 }
      },
      {
        id: 'merchant',
        name: 'OBCHODNÍK',
        desc: 'Prodej 100 itemů',
        icon: '🏪',
        type: 'items_sold',
        requirement: 100,
        reward_cigs: 1200,
        bonus: { type: 'money', value: 10 }
      },
      // CRYPTA & DUNGEONS (6 nových)
      {
        id: 'crypta_master',
        name: 'MISTR CRYPTY',
        desc: 'Navštiv cryptu 100x',
        icon: '🚗',
        type: 'crypta_visits',
        requirement: 100,
        reward_cigs: 1500,
        bonus: { type: 'xp', value: 12 }
      },
      {
        id: 'dungeon_master',
        name: 'MISTR DUNGEONŮ',
        desc: 'Dokončí 50 dungeonů',
        icon: '🗝️',
        type: 'dungeons',
        requirement: 50,
        reward_cigs: 2000,
        bonus: { type: 'xp', value: 15 }
      },
      {
        id: 'dungeon_speedrun',
        name: 'DUNGEON SPEEDRUN',
        desc: 'Dokončí dungeon do 10 minut',
        icon: '⏱️',
        type: 'dungeon_speedruns',
        requirement: 1,
        reward_cigs: 1500,
        bonus: { type: 'xp', value: 10 }
      },
      {
        id: 'treasure_master',
        name: 'MISTR POKLADŮ',
        desc: 'Najdi 100 pokladů',
        icon: '💰',
        type: 'treasures',
        requirement: 100,
        reward_cigs: 2500,
        bonus: { type: 'money', value: 18 }
      },
      {
        id: 'rare_treasure',
        name: 'VZÁCNÝ POKLAD',
        desc: 'Najdi legendary poklad',
        icon: '💎',
        type: 'rare_treasures',
        requirement: 1,
        reward_cigs: 3000,
        bonus: { type: 'money', value: 15 }
      },
      {
        id: 'secret_room',
        name: 'TAJNÁ MÍSTNOST',
        desc: 'Najdi 10 tajných místností',
        icon: '🚪',
        type: 'secret_rooms',
        requirement: 10,
        reward_cigs: 2000,
        bonus: { type: 'all', value: 10 }
      },
      // CRAFTING & ITEMS (8 nových)
      {
        id: 'apprentice_crafter',
        name: 'UČEŇ CRAFTU',
        desc: 'Vyrob 50 itemů',
        icon: '🔧',
        type: 'crafted_items',
        requirement: 50,
        reward_cigs: 500,
        bonus: { type: 'xp', value: 5 }
      },
      {
        id: 'master_crafter',
        name: 'MISTR CRAFTU',
        desc: 'Vyrob 500 itemů',
        icon: '⚒️',
        type: 'crafted_items',
        requirement: 500,
        reward_cigs: 3000,
        bonus: { type: 'all', value: 15 }
      },
      {
        id: 'epic_crafter',
        name: 'EPICKÝ CRAFTAŘ',
        desc: 'Vyrob 10 epic itemů',
        icon: '💜',
        type: 'epic_crafts',
        requirement: 10,
        reward_cigs: 2000,
        bonus: { type: 'all', value: 10 }
      },
      {
        id: 'legendary_crafter',
        name: 'LEGENDÁRNÍ CRAFTAŘ',
        desc: 'Vyrob legendary item',
        icon: '🧡',
        type: 'legendary_crafts',
        requirement: 1,
        reward_cigs: 4000,
        bonus: { type: 'all', value: 15 }
      },
      {
        id: 'enchanter',
        name: 'KOUZELNÍK',
        desc: 'Enchantuj 50 itemů',
        icon: '✨',
        type: 'enchants',
        requirement: 50,
        reward_cigs: 1500,
        bonus: { type: 'all', value: 8 }
      },
      {
        id: 'upgrader',
        name: 'VYLEPŠOVAČ',
        desc: 'Upgraduj item na +10',
        icon: '⬆️',
        type: 'max_upgrade',
        requirement: 10,
        reward_cigs: 2000,
        bonus: { type: 'all', value: 12 }
      },
      {
        id: 'full_set',
        name: 'KOMPLETNÍ SET',
        desc: 'Měј kompletní set (6 itemů)',
        icon: '👔',
        type: 'complete_sets',
        requirement: 1,
        reward_cigs: 2500,
        bonus: { type: 'all', value: 15 }
      },
      {
        id: 'item_destroyer',
        name: 'NIČITEL ITEMŮ',
        desc: 'Rozbij 100 itemů',
        icon: '🔨',
        type: 'items_destroyed',
        requirement: 100,
        reward_cigs: 800,
        bonus: { type: 'xp', value: 5 }
      },
      // SOCIÁLNÍ & OSTATNÍ (15 nových)
      {
        id: 'friend_maker',
        name: 'TVŮRCE PŘÁTEL',
        desc: 'Měј 50 přátel',
        icon: '👥',
        type: 'friends',
        requirement: 50,
        reward_cigs: 1000,
        bonus: { type: 'xp', value: 8 }
      },
      {
        id: 'popular',
        name: 'POPULÁRNÍ',
        desc: 'Měј 100 přátel',
        icon: '🌟',
        type: 'friends',
        requirement: 100,
        reward_cigs: 2500,
        bonus: { type: 'all', value: 10 }
      },
      {
        id: 'referral_master',
        name: 'MISTR POZVÁNEK',
        desc: 'Pozvi 50 přátel',
        icon: '📨',
        type: 'referrals',
        requirement: 50,
        reward_cigs: 5000,
        bonus: { type: 'money', value: 20 }
      },
      {
        id: 'mail_veteran',
        name: 'VETERÁN POŠTY',
        desc: 'Pošli 200 mailů',
        icon: '📮',
        type: 'mails_sent',
        requirement: 200,
        reward_cigs: 1000,
        bonus: { type: 'xp', value: 8 }
      },
      {
        id: 'chat_master',
        name: 'MISTR CHATU',
        desc: 'Napiš 1000 zpráv v chatu',
        icon: '💬',
        type: 'chat_messages',
        requirement: 1000,
        reward_cigs: 1500,
        bonus: { type: 'xp', value: 10 }
      },
      {
        id: 'emoji_lover',
        name: 'MILOVNÍK EMOJI',
        desc: 'Použij 500 emoji',
        icon: '😄',
        type: 'emojis_used',
        requirement: 500,
        reward_cigs: 500,
        bonus: { type: 'xp', value: 5 }
      },
      {
        id: 'top_five',
        name: 'TOP 5',
        desc: 'Dostaň se do TOP 5',
        icon: '🥈',
        type: 'ranking',
        requirement: 5,
        reward_cigs: 3000,
        bonus: { type: 'all', value: 18 }
      },
      {
        id: 'top_three',
        name: 'TOP 3',
        desc: 'Dostaň se do TOP 3',
        icon: '🥉',
        type: 'ranking',
        requirement: 3,
        reward_cigs: 4000,
        bonus: { type: 'all', value: 22 }
      },
      {
        id: 'energy_efficient',
        name: 'EFEKTIVNÍ ENERGIE',
        desc: 'Utratil 5,000 energie',
        icon: '⚡',
        type: 'energy_spent',
        requirement: 5000,
        reward_cigs: 2000,
        bonus: { type: 'xp', value: 15 }
      },
      {
        id: 'energy_master_pro',
        name: 'PROFESIONÁLNÍ ENERGETIK',
        desc: 'Utratil 10,000 energie',
        icon: '🔋',
        type: 'energy_spent',
        requirement: 10000,
        reward_cigs: 4000,
        bonus: { type: 'xp', value: 20 }
      },
      {
        id: 'achievement_addict',
        name: 'ZÁVISLÁK NA ACHIEVEMENTECH',
        desc: 'Odemkni 50 achievementů',
        icon: '🏅',
        type: 'achievements_unlocked',
        requirement: 50,
        reward_cigs: 3000,
        bonus: { type: 'all', value: 15 }
      },
      {
        id: 'achievement_collector',
        name: 'SBĚRATEL ACHIEVEMENTŮ',
        desc: 'Odemkni 75 achievementů',
        icon: '🎖️',
        type: 'achievements_unlocked',
        requirement: 75,
        reward_cigs: 5000,
        bonus: { type: 'all', value: 20 }
      },
      {
        id: 'achievement_god',
        name: 'BŮH ACHIEVEMENTŮ',
        desc: 'Odemkni 100 achievementů',
        icon: '👑',
        type: 'achievements_unlocked',
        requirement: 100,
        reward_cigs: 10000,
        bonus: { type: 'all', value: 30 }
      },
      {
        id: 'completionist',
        name: 'COMPLETIONISTA',
        desc: 'Odemkni VŠECHNY achievementy',
        icon: '💯',
        type: 'achievements_unlocked',
        requirement: 120,
        reward_cigs: 20000,
        bonus: { type: 'all', value: 40 }
      },
      {
        id: 'true_gopnik_legend',
        name: 'PRAVÁ GOPNIK LEGENDA',
        desc: 'Měј všechny bonusy na max (40%)',
        icon: '🌌',
        type: 'max_bonuses',
        requirement: 1,
        reward_cigs: 50000,
        bonus: { type: 'all', value: 40 }
      }
    ]
  };

  // ====== PLAYER UTILS ======
  class Player {
    static getUserId() {
      const id = (window.SF?.user?.id || window.SF?.stats?.user_id || null);
      if (id) return id;

      // Fallback (offline / bez přihlášení): lokální stabilní ID
      const key = 'sf_local_user_id';
      let localId = localStorage.getItem(key);
      if (!localId) {
        localId = (crypto?.randomUUID ? crypto.randomUUID() : `local_${Date.now()}_${Math.random().toString(16).slice(2)}`);
        localStorage.setItem(key, localId);
      }
      return localId;
    }

    static getName() {
      return (
        sessionStorage.getItem('playerName') ||
        sessionStorage.getItem('nickname') ||
        sessionStorage.getItem('nick') ||
        'PLAYER'
      );
    }

    static getMoney() {
      const el = document.getElementById('money');
      if (!el) return 0;
      return Number(el.textContent.replace(/\s|,/g, '')) || 0;
    }

    static getCigs() {
      const el = document.getElementById('cigarettes');
      if (!el) return 0;
      return Number(el.textContent.replace(/\s|,/g, '')) || 0;
    }

    static setMoney(amount) {
      const el = document.getElementById('money');
      if (el) el.textContent = Math.max(0, amount).toLocaleString('cs-CZ');

      if (window.SF && window.SF.setMoney) {
        window.SF.setMoney(Math.max(0, amount));
      }
    }

    static setCigs(amount) {
      const el = document.getElementById('cigarettes');
      if (el) el.textContent = Math.max(0, amount).toLocaleString('cs-CZ');

      if (window.SF && window.SF.setCigarettes) {
        window.SF.setCigarettes(Math.max(0, amount));
      }
    }

    static getLevel() {
      const el = document.getElementById('levelDisplay');
      if (!el) return 1;
      return Number(el.textContent) || 1;
    }
  }

  // ====== UI MANAGER ======
  class UI {
    static showModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add('show');
    }

    static hideModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    }

    static toast(text, type = 'ok', timeout = 3200) {
      const t = document.createElement('div');
      t.className = `achi-toast ${type}`;
      t.textContent = text;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), timeout);
    }

    static formatNumber(num) {
      return Number(num || 0).toLocaleString('cs-CZ');
    }
  }

  // ====== SUPABASE MANAGER ======
  let sb = null;

  class SupabaseManager {
    static async init() {
      if (window.SFReady) {
        try { await window.SFReady; } catch (e) {
          console.warn('[achi] SFReady failed:', e);
        }
      }
      sb = window.SF?.sb || null;
      if (!sb) {
        console.warn('[achi] Supabase client není dostupný – přepínám na lokální režim.');
      }
      return sb;
    }

    static _ensure() {
      if (!sb) throw new Error('Supabase client není inicializovaný');
    }

    static async getPlayerStats(userId) {
      try {
        this._ensure();
        const { data, error } = await sb
          .from('player_stats')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (error) throw error;
        return data?.stats || {};
      } catch (e) {
        console.warn('[achi] getPlayerStats failed:', e);
        return {};
      }
    }

    static async getAchievements(userId) {
      try {
        this._ensure();
        const { data, error } = await sb
          .from('player_achievements')
          .select('*')
          .eq('user_id', userId);
        
        if (error && error.code !== 'PGRST116') throw error;
        return data || [];
      } catch (e) {
        console.warn('[achi] getAchievements failed:', e);
        return [];
      }
    }

    static async unlockAchievement(userId, achievementId) {
      try {
        this._ensure();
        const { error } = await sb
          .from('player_achievements')
          .insert([{
            user_id: userId,
            achievement_id: achievementId,
            unlocked_at: new Date().toISOString(),
            claimed: false
          }]);
        
        if (error) throw error;
      } catch (e) {
        console.warn('[achi] unlockAchievement failed:', e);
        throw e;
      }
    }

    static async claimAchievement(userId, achievementId) {
      try {
        this._ensure();
        const { error } = await sb
          .from('player_achievements')
          .update({ claimed: true })
          .eq('user_id', userId)
          .eq('achievement_id', achievementId);
        
        if (error) throw error;
      } catch (e) {
        console.warn('[achi] claimAchievement failed:', e);
        throw e;
      }
    }

    static async updatePlayerStats(userId, statsObj) {
      try {
        this._ensure();
        const { error } = await sb
          .from('player_stats')
          .update({ stats: statsObj })
          .eq('user_id', userId);
        
        if (error) throw error;
      } catch (e) {
        console.warn('[achi] updatePlayerStats failed:', e);
        throw e;
      }
    }
  }

  // ====== LOCAL STORAGE MANAGER (fallback) ======
  class LocalManager {
    static _k(uid, suffix) { return `achi_${uid}_${suffix}`; }

    static async init() { return true; }

    static async getPlayerStats(userId) {
      try {
        const raw = localStorage.getItem(this._k(userId, 'playerStats'));
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }

    static async getAchievements(userId) {
      try {
        const raw = localStorage.getItem(this._k(userId, 'playerAchi'));
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }

    static async unlockAchievement(userId, achievementId) {
      const list = await this.getAchievements(userId);
      if (list.some(a => a.achievement_id === achievementId)) return;
      list.push({ achievement_id: achievementId, unlocked_at: new Date().toISOString(), claimed: false });
      localStorage.setItem(this._k(userId, 'playerAchi'), JSON.stringify(list));
    }

    static async claimAchievement(userId, achievementId) {
      const list = await this.getAchievements(userId);
      const it = list.find(a => a.achievement_id === achievementId);
      if (!it) return;
      it.claimed = true;
      it.claimed_at = new Date().toISOString();
      localStorage.setItem(this._k(userId, 'playerAchi'), JSON.stringify(list));
    }

    static async updatePlayerStats(userId, statsObj) {
      localStorage.setItem(this._k(userId, 'playerStats'), JSON.stringify(statsObj || {}));
    }
  }

  // ====== ACHIEVEMENT MANAGER ======
  class AchievementManager {
    constructor() {
      this.achievements = CONFIG.ACHIEVEMENTS;
      this.playerAchievements = [];
      this.playerStats = {};
      this.currentFilter = 'all';
      this.selectedAchievement = null;
      this.store = SupabaseManager;
    }

    async init() {
      console.log('🏅 Initializing Achievement Manager...');

      const supabaseOk = await SupabaseManager.init();
      this.store = supabaseOk ? SupabaseManager : LocalManager;

      await this.loadData();
      this.setupEventListeners();
      this.checkNewAchievements();
      this.render();

      console.log('✅ Achievement Manager initialized');
    }

    async loadData() {
      const userId = Player.getUserId();

      this.playerStats = await this.store.getPlayerStats(userId);
      this.playerAchievements = await this.store.getAchievements(userId);
    }

    setupEventListeners() {
      // Filter buttons
      const filterAll = document.getElementById('filterAll');
      const filterUnlocked = document.getElementById('filterUnlocked');
      const filterLocked = document.getElementById('filterLocked');

      if (filterAll) {
        filterAll.addEventListener('click', () => this.setFilter('all'));
      }
      if (filterUnlocked) {
        filterUnlocked.addEventListener('click', () => this.setFilter('unlocked'));
      }
      if (filterLocked) {
        filterLocked.addEventListener('click', () => this.setFilter('locked'));
      }

      // Modal buttons
      const btnCloseAchi = document.getElementById('btnCloseAchi');
      const btnClaimAchi = document.getElementById('btnClaimAchi');

      if (btnCloseAchi) {
        btnCloseAchi.addEventListener('click', () => UI.hideModal('achiModal'));
      }

      if (btnClaimAchi) {
        btnClaimAchi.addEventListener('click', () => this.claimAchievement());
      }
    }

    setFilter(filter) {
      this.currentFilter = filter;

      // Update button states
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });

      const activeBtn = document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`);
      if (activeBtn) {
        activeBtn.classList.add('active');
      }

      this.renderAchievements();
    }

    render() {
      this.renderStats();
      this.renderAchievements();
    }

    renderStats() {
      const unlockedCount = this.playerAchievements.length;
      const totalCount = this.achievements.length;
      
      const totalCigs = this.playerAchievements
        .filter(pa => pa.claimed)
        .reduce((sum, pa) => {
          const achi = this.achievements.find(a => a.id === pa.achievement_id);
          return sum + (achi?.reward_cigs || 0);
        }, 0);

      const totalBonus = this.calculateTotalBonus();

      const unlockedEl = document.getElementById('unlockedCount');
      if (unlockedEl) {
        unlockedEl.textContent = `${unlockedCount} / ${totalCount}`;
      }

      const cigsEl = document.getElementById('totalCigsReward');
      if (cigsEl) {
        cigsEl.textContent = UI.formatNumber(totalCigs);
      }

      const bonusEl = document.getElementById('totalBonus');
      if (bonusEl) {
        bonusEl.textContent = `+${totalBonus}%`;
      }
    }

    calculateTotalBonus() {
      let total = 0;
      
      this.playerAchievements
        .filter(pa => pa.claimed)
        .forEach(pa => {
          const achi = this.achievements.find(a => a.id === pa.achievement_id);
          if (achi && achi.bonus) {
            if (achi.bonus.type === 'all') {
              total += achi.bonus.value * 4; // all means 4 stats
            } else {
              total += achi.bonus.value;
            }
          }
        });

      return Math.min(total, CONFIG.MAX_BONUS_PER_STAT * 4);
    }

    renderAchievements() {
      const listEl = document.getElementById('achiList');
      if (!listEl) return;

      listEl.innerHTML = '';

      let filteredAchievements = [...this.achievements];

      if (this.currentFilter === 'unlocked') {
        filteredAchievements = this.achievements.filter(a => 
          this.playerAchievements.some(pa => pa.achievement_id === a.id)
        );
      } else if (this.currentFilter === 'locked') {
        filteredAchievements = this.achievements.filter(a => 
          !this.playerAchievements.some(pa => pa.achievement_id === a.id)
        );
      }

      filteredAchievements.forEach(achi => {
        const card = this.createAchievementCard(achi);
        listEl.appendChild(card);
      });
    }

    createAchievementCard(achi) {
      const playerAchi = this.playerAchievements.find(pa => pa.achievement_id === achi.id);
      const isUnlocked = !!playerAchi;
      const isClaimed = playerAchi?.claimed || false;
      const isClaimable = isUnlocked && !isClaimed;

      const progress = this.getProgress(achi);
      const progressPercent = Math.min((progress / achi.requirement) * 100, 100);

      const card = document.createElement('div');
      card.className = `achi-card ${isUnlocked ? 'unlocked' : 'locked'} ${isClaimable ? 'claimable' : ''}`;

      card.innerHTML = `
        <div class="achi-icon-wrapper">
          <div class="achi-icon">${achi.icon}</div>
        </div>
        <div class="achi-name">${achi.name}</div>
        <div class="achi-desc">${achi.desc}</div>
        ${!isUnlocked ? `
          <div class="achi-progress-bar">
            <div class="achi-progress-fill" style="width: ${progressPercent}%"></div>
            <div class="achi-progress-text">${UI.formatNumber(progress)} / ${UI.formatNumber(achi.requirement)}</div>
          </div>
        ` : ''}
        <div class="achi-rewards">
          <div class="achi-reward">
            <span class="achi-reward-icon">🚬</span>
            <span class="achi-reward-value">${achi.reward_cigs}</span>
          </div>
          <div class="achi-reward">
            <span class="achi-reward-icon">${this.getBonusIcon(achi.bonus.type)}</span>
            <span class="achi-reward-value">+${achi.bonus.value}%</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => this.showAchievementModal(achi));

      return card;
    }

    getBonusIcon(type) {
      const icons = {
        'xp': '⭐',
        'attack': '⚔️',
        'defense': '🛡️',
        'money': '💰',
        'cigs': '🚬',
        'all': '🎁'
      };
      return icons[type] || '🎁';
    }

    getProgress(achi) {
      const stats = this.playerStats;
      
      switch (achi.type) {
        case 'level':
          return Player.getLevel();
        case 'money':
          return stats.total_money_earned || 0;
        case 'money_held':
          return Player.getMoney();
        case 'daily_money':
          return stats.daily_money_earned || 0;
        case 'money_spent':
          return stats.total_money_spent || 0;
        case 'cigarettes':
          return stats.total_cigs_earned || 0;
        case 'cigs_held':
          return Player.getCigs();
        case 'daily_cigs':
          return stats.daily_cigs_earned || 0;
        case 'no_cigs_spent':
          return stats.days_no_cigs_spent || 0;
        case 'economic':
          return (Player.getMoney() >= 1000000 && Player.getCigs() >= 10000) ? 1 : 0;
        case 'arena_wins':
          return stats.arena_wins || 0;
        case 'arena_losses':
          return stats.arena_losses || 0;
        case 'arena_win_streak':
          return stats.arena_best_win_streak || 0;
        case 'arena_winrate':
          const wins = stats.arena_wins || 0;
          const total = wins + (stats.arena_losses || 0);
          return total > 0 ? Math.floor((wins / total) * 100) : 0;
        case 'quick_kills':
          return stats.quick_kills || 0;
        case 'comebacks':
          return stats.comebacks || 0;
        case 'guild_join':
          return stats.guilds_joined || 0;
        case 'guild_create':
          return stats.guilds_created || 0;
        case 'guild_days':
          return stats.guild_days || 0;
        case 'guild_donations':
          return stats.guild_donations_total || 0;
        case 'boss_kills':
          return stats.boss_kills || 0;
        case 'boss_speedrun':
          return stats.boss_speedruns || 0;
        case 'pvp_wins':
          return stats.pvp_wins || 0;
        case 'missions':
          return stats.missions_completed || 0;
        case 'daily_quests':
          return stats.daily_quests_completed || 0;
        case 'weekly_quests':
          return stats.weekly_quests_completed || 0;
        case 'perfect_missions':
          return stats.perfect_missions || 0;
        case 'speed_missions':
          return stats.speed_missions || 0;
        case 'epic_quests':
          return stats.epic_quests_completed || 0;
        case 'daily_streak':
          return stats.daily_streak || 0;
        case 'playtime_hours':
          return stats.playtime_hours || 0;
        case 'jackpots':
          return stats.jackpots_won || 0;
        case 'wheel_spins':
          return stats.wheel_spins || 0;
        case 'shop_purchases':
          return stats.shop_purchases || 0;
        case 'discounted_purchases':
          return stats.discounted_purchases || 0;
        case 'legendary_purchases':
          return stats.legendary_purchases || 0;
        case 'black_market':
          return stats.black_market_purchases || 0;
        case 'items_sold':
          return stats.items_sold || 0;
        case 'crypta_visits':
          return stats.crypta_visits || 0;
        case 'dungeons':
          return stats.dungeons_completed || 0;
        case 'dungeon_speedruns':
          return stats.dungeon_speedruns || 0;
        case 'treasures':
          return stats.treasures_found || 0;
        case 'rare_treasures':
          return stats.rare_treasures_found || 0;
        case 'secret_rooms':
          return stats.secret_rooms_found || 0;
        case 'crafted_items':
          return stats.items_crafted || 0;
        case 'epic_crafts':
          return stats.epic_crafted || 0;
        case 'legendary_crafts':
          return stats.legendary_crafted || 0;
        case 'enchants':
          return stats.items_enchanted || 0;
        case 'max_upgrade':
          return stats.max_item_upgrade || 0;
        case 'complete_sets':
          return stats.complete_sets || 0;
        case 'items_destroyed':
          return stats.items_destroyed || 0;
        case 'friends':
          return stats.friends_count || 0;
        case 'referrals':
          return stats.referrals || 0;
        case 'mails_sent':
          return stats.mails_sent || 0;
        case 'chat_messages':
          return stats.chat_messages || 0;
        case 'emojis_used':
          return stats.emojis_used || 0;
        case 'energy_spent':
          return stats.energy_spent || 0;
        case 'speed_level':
          const accountAge = stats.account_age_days || 999;
          const currentLevel = Player.getLevel();
          return (currentLevel >= 20 && accountAge <= 3) ? 20 : Math.min(currentLevel, 19);
        case 'unique_items':
          return stats.unique_items_owned || 0;
        case 'equipment_slots':
          return stats.equipment_slots_filled || 0;
        case 'epic_items':
          return stats.epic_items_owned || 0;
        case 'legendary_items':
          return stats.legendary_items_owned || 0;
        case 'ranking':
          const ranking = stats.best_ranking || 999;
          if (achi.requirement === 1) return ranking === 1 ? 1 : 0;
          if (achi.requirement === 3) return ranking <= 3 ? 3 : Math.max(0, 4 - ranking);
          if (achi.requirement === 5) return ranking <= 5 ? 5 : Math.max(0, 6 - ranking);
          if (achi.requirement === 10) return ranking <= 10 ? 10 : Math.max(0, 11 - ranking);
          return 0;
        case 'achievements_unlocked':
          return this.playerAchievements.length;
        case 'max_bonuses':
          const bonuses = stats.achievement_bonuses || {};
          return ['xp', 'attack', 'defense', 'money', 'cigs'].every(t => (bonuses[t] || 0) >= CONFIG.MAX_BONUS_PER_STAT) ? 1 : 0;
        default:
          return 0;
      }
    }

    showAchievementModal(achi) {
      this.selectedAchievement = achi;

      const playerAchi = this.playerAchievements.find(pa => pa.achievement_id === achi.id);
      const isUnlocked = !!playerAchi;
      const isClaimed = playerAchi?.claimed || false;
      const isClaimable = isUnlocked && !isClaimed;

      const progress = this.getProgress(achi);
      const progressPercent = Math.min((progress / achi.requirement) * 100, 100);

      const modalHeader = document.getElementById('achiModalHeader');
      const modalBody = document.getElementById('achiModalBody');
      const btnClaim = document.getElementById('btnClaimAchi');

      if (modalHeader) {
        modalHeader.innerHTML = `${achi.icon} ${achi.name}`;
      }

      if (modalBody) {
        modalBody.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 80px; margin-bottom: 16px; filter: ${!isUnlocked ? 'grayscale(100%) opacity(0.4)' : ''}">${achi.icon}</div>
            <div style="font-size: 20px; font-weight: 900; color: ${isUnlocked ? '#f1d27a' : '#888'}; margin-bottom: 8px; text-transform: uppercase;">
              ${achi.name}
            </div>
            <div style="font-size: 13px; color: ${isUnlocked ? '#c9a44a' : '#666'}; margin-bottom: 20px;">
              ${achi.desc}
            </div>
            
            ${!isUnlocked ? `
              <div style="margin-bottom: 20px;">
                <div style="width: 100%; height: 30px; background: rgba(0,0,0,0.5); border-radius: 15px; border: 2px solid #5a4520; position: relative; overflow: hidden;">
                  <div style="height: 100%; width: ${progressPercent}%; background: linear-gradient(90deg, #4a9eff, #2563eb); transition: width 0.5s ease;"></div>
                  <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 13px; font-weight: 900; color: #fff;">
                    ${UI.formatNumber(progress)} / ${UI.formatNumber(achi.requirement)}
                  </div>
                </div>
              </div>
            ` : ''}

            ${isUnlocked && isClaimed ? `
              <div style="padding: 12px; background: rgba(74, 158, 255, 0.2); border: 2px solid #4a9eff; border-radius: 10px; margin-bottom: 16px;">
                <div style="font-size: 14px; font-weight: 900; color: #4a9eff;">✅ ODMĚNA VYZVEDNUTA</div>
              </div>
            ` : ''}

            ${isClaimable ? `
              <div style="padding: 12px; background: rgba(255, 215, 0, 0.2); border: 2px solid #ffd700; border-radius: 10px; margin-bottom: 16px; animation: claimPulse 2s ease-in-out infinite;">
                <div style="font-size: 14px; font-weight: 900; color: #ffd700;">🎁 PŘIPRAVENO K VYZVEDNUTÍ!</div>
              </div>
            ` : ''}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px;">
              <div style="padding: 16px; background: rgba(0,0,0,0.4); border: 2px solid #5a4520; border-radius: 10px;">
                <div style="font-size: 11px; color: #c9a44a; margin-bottom: 8px; font-weight: 900;">ODMĚNA</div>
                <div style="font-size: 24px; margin-bottom: 4px;">🚬</div>
                <div style="font-size: 18px; font-weight: 900; color: #f1d27a;">${achi.reward_cigs}</div>
              </div>
              <div style="padding: 16px; background: rgba(0,0,0,0.4); border: 2px solid #5a4520; border-radius: 10px;">
                <div style="font-size: 11px; color: #c9a44a; margin-bottom: 8px; font-weight: 900;">BONUS</div>
                <div style="font-size: 24px; margin-bottom: 4px;">${this.getBonusIcon(achi.bonus.type)}</div>
                <div style="font-size: 18px; font-weight: 900; color: #f1d27a;">+${achi.bonus.value}%</div>
              </div>
            </div>

            <div style="margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px;">
              <div style="font-size: 11px; color: #c9a44a; line-height: 1.6;">
                ${this.getBonusDescription(achi.bonus)}
              </div>
            </div>
          </div>
        `;
      }

      if (btnClaim) {
        btnClaim.style.display = isClaimable ? 'block' : 'none';
      }

      UI.showModal('achiModal');
    }

    getBonusDescription(bonus) {
      const descriptions = {
        'xp': `Bonus +${bonus.value}% k získávání XP`,
        'attack': `Bonus +${bonus.value}% k útoku`,
        'defense': `Bonus +${bonus.value}% k obraně`,
        'money': `Bonus +${bonus.value}% k získávání rublů`,
        'cigs': `Bonus +${bonus.value}% k získávání grošů`,
        'all': `Bonus +${bonus.value}% ke všem statistikám (útok, obrana, rubly, groše)`
      };
      return descriptions[bonus.type] || 'Bonus ke statistikám';
    }

    async checkNewAchievements() {
      for (const achi of this.achievements) {
        const alreadyUnlocked = this.playerAchievements.some(pa => pa.achievement_id === achi.id);
        if (alreadyUnlocked) continue;

        const progress = this.getProgress(achi);
        if (progress >= achi.requirement) {
          try {
            const userId = Player.getUserId();
            await this.store.unlockAchievement(userId, achi.id);
            
            UI.toast(`🎉 ACHIEVEMENT ODEMČEN: ${achi.name}!`, 'unlocked', 4000);
            
            await this.loadData();
            this.render();
          } catch (err) {
            console.error('Failed to unlock achievement:', err);
          }
        }
      }
    }

    async claimAchievement() {
      if (!this.selectedAchievement) return;

      const playerAchi = this.playerAchievements.find(pa => pa.achievement_id === this.selectedAchievement.id);
      if (!playerAchi || playerAchi.claimed) return;

      try {
        const userId = Player.getUserId();
        
        // Claim achievement
        await this.store.claimAchievement(userId, this.selectedAchievement.id);
        
        // Give rewards
        const currentCigs = Player.getCigs();
        Player.setCigs(currentCigs + this.selectedAchievement.reward_cigs);

        // Update stats with bonus
        const stats = { ...this.playerStats };
        const bonus = this.selectedAchievement.bonus;
        
        if (!stats.achievement_bonuses) {
          stats.achievement_bonuses = {};
        }

        if (bonus.type === 'all') {
          ['attack', 'defense', 'money', 'cigs'].forEach(type => {
            stats.achievement_bonuses[type] = (stats.achievement_bonuses[type] || 0) + bonus.value;
          });
        } else {
          stats.achievement_bonuses[bonus.type] = (stats.achievement_bonuses[bonus.type] || 0) + bonus.value;
        }

        // Cap at 40%
        Object.keys(stats.achievement_bonuses).forEach(key => {
          stats.achievement_bonuses[key] = Math.min(stats.achievement_bonuses[key], CONFIG.MAX_BONUS_PER_STAT);
        });

        await this.store.updatePlayerStats(userId, stats);

        UI.toast(`✅ Vyzvednuto: ${this.selectedAchievement.reward_cigs} 🚬 + ${this.selectedAchievement.bonus.value}% bonus!`, 'ok', 4000);

        await this.loadData();
        this.render();
        
        UI.hideModal('achiModal');
      } catch (err) {
        UI.toast('Chyba při vyzvedávání odměny', 'err');
        console.error(err);
      }
    }
  }

  // ====== INITIALIZATION ======
  const manager = new AchievementManager();
  window.achiManager = manager;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => manager.init(), { once: true });
  } else {
    manager.init();
  }
})();