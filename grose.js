// grose.js - Premium Cigarettes Shop

const supabaseClient = () => window.supabaseClient;

async function ensureOnline() {
  if (window.SFReady) await window.SFReady;
  const sb = supabaseClient();
  if (!sb) throw new Error('Supabase client není inicializovaný (načti menu.js před tímto skriptem)');
  return sb;
}

// ===== GROSE PACKAGES =====
const GROSE_PACKAGES = {
  starter: [
    {
      id: 'starter_1',
      name: 'MINI PACK',
      cigarettes: 100,
      price: 10,
      originalPrice: 15,
      icon: '🚬',
      description: 'Ideální pro začátečníky',
      bonus: null,
      category: 'starter',
      discount: 33,
      firstTimerBonus: '+20 cigaret NAVÍC při prvním nákupu!'
    },
    {
      id: 'starter_2',
      name: 'BASIC PACK',
      cigarettes: 250,
      price: 20,
      originalPrice: 30,
      icon: '📦',
      description: 'Základní balíček',
      bonus: '+10 cigaret ZDARMA',
      category: 'starter',
      discount: 33,
      limitedOffer: 'POUZE 50 KS!'
    },
    {
      id: 'starter_3',
      name: 'STARTER PACK',
      cigarettes: 500,
      price: 35,
      originalPrice: 55,
      icon: '🎁',
      description: 'Dobrý start do hry',
      bonus: '+30 cigaret ZDARMA',
      category: 'starter',
      popular: true,
      discount: 36,
      flashSale: true
    }
  ],
  monthly: [
    {
      id: 'monthly_20',
      type: 'monthly',
      name: 'STARTER PASS',
      dailyCigs: 40,
      durationDays: 30,
      price: 20,
      icon: '🎫',
      description: '+40 cigaret denně po dobu 30 dní',
      category: 'monthly',
      popular: true
    },
    {
      id: 'monthly_50',
      type: 'monthly',
      name: 'SMOKER PASS',
      dailyCigs: 50,
      durationDays: 30,
      price: 50,
      icon: '🎫',
      description: '+50 cigaret denně po dobu 30 dní',
      category: 'monthly'
    },
    {
      id: 'monthly_250',
      type: 'monthly',
      name: 'KING PASS',
      dailyCigs: 100,
      durationDays: 30,
      price: 250,
      icon: '👑',
      description: '+100 cigaret denně po dobu 30 dní',
      category: 'monthly',
      bestValue: true
    }
  ],
  standard: [
    {
      id: 'standard_1',
      name: 'STANDARD',
      cigarettes: 750,
      price: 50,
      originalPrice: 75,
      icon: '📦',
      description: 'Standardní balíček',
      bonus: '+50 cigaret ZDARMA',
      category: 'standard',
      discount: 33
    },
    {
      id: 'standard_2',
      name: 'MEGA PACK',
      cigarettes: 1000,
      price: 65,
      originalPrice: 100,
      icon: '📦',
      description: 'Velký balíček pro pravidelné hráče',
      bonus: '+100 cigaret ZDARMA',
      category: 'standard',
      popular: true,
      discount: 35,
      limitedOffer: 'POUZE 30 KS!'
    },
    {
      id: 'standard_3',
      name: 'GIANT PACK',
      cigarettes: 1500,
      price: 90,
      originalPrice: 140,
      icon: '📦',
      description: 'Obří balíček',
      bonus: '+200 cigaret ZDARMA',
      category: 'standard',
      discount: 36
    },
    {
      id: 'standard_4',
      name: 'SUPER PACK',
      cigarettes: 2000,
      price: 110,
      originalPrice: 180,
      icon: '📦',
      description: 'Super balíček pro náročné',
      bonus: '+300 cigaret ZDARMA',
      category: 'standard',
      bestValue: true,
      discount: 39,
      flashSale: true
    }
  ],
  premium: [
    {
      id: 'premium_1',
      name: 'ULTRA PACK',
      cigarettes: 2500,
      price: 130,
      originalPrice: 220,
      icon: '💎',
      description: 'Ultra prémiový balíček',
      bonus: '+500 cigaret ZDARMA',
      category: 'premium',
      discount: 41,
      vipBonus: '+100 cigaret navíc pro VIP!'
    },
    {
      id: 'premium_2',
      name: 'MASTER PACK',
      cigarettes: 3500,
      price: 175,
      originalPrice: 300,
      icon: '💎',
      description: 'Pro mistry hry',
      bonus: '+750 cigaret ZDARMA',
      category: 'premium',
      bestValue: true,
      discount: 42,
      limitedOffer: 'POUZE 20 KS!'
    },
    {
      id: 'premium_3',
      name: 'ELITE PACK',
      cigarettes: 5000,
      price: 240,
      originalPrice: 420,
      icon: '💎',
      description: 'Elitní balíček',
      bonus: '+1200 cigaret ZDARMA',
      category: 'premium',
      discount: 43,
      flashSale: true
    }
  ],
  legendary: [
    {
      id: 'legendary_1',
      name: 'LEGENDARY PACK',
      cigarettes: 7500,
      price: 340,
      originalPrice: 600,
      icon: '👑',
      description: 'Legendární balíček pro VIP hráče',
      bonus: '+2000 cigaret ZDARMA',
      category: 'legendary',
      discount: 43,
      vipBonus: '+500 cigaret navíc!',
      limitedOffer: 'POUZE 10 KS!'
    },
    {
      id: 'legendary_2',
      name: 'ULTIMATE PACK',
      cigarettes: 10000,
      price: 420,
      originalPrice: 750,
      icon: '👑',
      description: 'Ultimátní balíček',
      bonus: '+3000 cigaret ZDARMA',
      category: 'legendary',
      bestValue: true,
      discount: 44,
      flashSale: true
    },
    {
      id: 'legendary_3',
      name: 'GODLIKE PACK',
      cigarettes: 15000,
      price: 600,
      originalPrice: 1100,
      icon: '👑',
      description: 'Pro bohy mezi gopníky',
      bonus: '+5000 cigaret ZDARMA',
      category: 'legendary',
      discount: 45,
      vipBonus: '+1000 cigaret navíc!',
      exclusive: 'EXKLUZIVNÍ NABÍDKA!'
    }
  ]
};

// ===== GAME STATE =====
let gameState = {
  userId: null,
  cigarettes: 0,
  groseStats: {
    totalPurchased: 0,
    totalSpent: 0,
    purchaseCount: 0,
    lastPurchase: null,
    biggestPurchase: 0
  }
};

let currentCategory = 'starter';

// ===== SYNC FROM SERVER =====
async function syncFromServer() {
  if (window.SFReady) await window.SFReady;
  const stats = window.SF?.stats;
  if (!stats) return;

  gameState.cigarettes = stats.cigarettes ?? gameState.cigarettes;
  
  // Load grose stats
  if (stats.grose_stats) {
    gameState.groseStats = { ...gameState.groseStats, ...stats.grose_stats };
  }

  updateUI();
}

// Listen for stats changes
document.addEventListener('sf:stats', async (e) => {
  await syncFromServer();
});

// ===== INIT USER =====
async function initUser() {
  const sb = await ensureOnline();
  
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) {
    location.href = 'login.html';
    return;
  }

  gameState.userId = session.user.id;
  
  // Load player stats
  const { data: playerStats } = await sb
    .from('player_stats')
    .select('*')
    .eq('user_id', gameState.userId)
    .single();

  if (playerStats) {
    gameState.cigarettes = playerStats.cigarettes ?? 0;
    
    if (playerStats.grose_stats) {
      gameState.groseStats = { ...gameState.groseStats, ...playerStats.grose_stats };
    }
  }

  await syncFromServer();
}

// ===== SAVE TO SUPABASE =====
async function saveToSupabase() {
  try {
    const sb = await ensureOnline();
    
    const { error } = await sb
      .from('player_stats')
      .update({
        cigarettes: gameState.cigarettes,
        grose_stats: gameState.groseStats,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', gameState.userId);

    if (error) {
      console.error('❌ Save error:', error);
      showNotification('Chyba při ukládání!', 'error');
      return false;
    }

    console.log('💾 Grose stats saved');
    return true;
  } catch (err) {
    console.error('❌ Save exception:', err);
    showNotification('Chyba při ukládání!', 'error');
    return false;
  }
}

// ===== RENDER PACKAGES =====
function renderPackages() {
  const grid = document.getElementById('groseGrid');
  if (!grid) return;

  const packages = GROSE_PACKAGES[currentCategory] || [];
  
  grid.innerHTML = packages.map(pkg => {
    const isMonthly = pkg.type === 'monthly';
    const totalCigs = isMonthly
      ? null
      : (pkg.cigarettes + (pkg.bonus ? parseInt(pkg.bonus.match(/\d+/)[0]) : 0));
    const pricePerCig = (!isMonthly && totalCigs)
      ? (pkg.price / totalCigs).toFixed(2)
      : null;
    
    let badgeClass = '';
    if (pkg.popular) badgeClass = 'popular';
    if (pkg.bestValue) badgeClass = 'best-value';
    if (pkg.flashSale) badgeClass = 'flash-sale';

    // Discount badge
    let discountBadge = '';
    if (pkg.discount) {
      discountBadge = `<div class="discount-badge">-${pkg.discount}%</div>`;
    }

    // Limited offer badge
    let limitedBadge = '';
    if (pkg.limitedOffer) {
      limitedBadge = `<div class="limited-badge">⏰ ${pkg.limitedOffer}</div>`;
    }

    // Exclusive badge
    let exclusiveBadge = '';
    if (pkg.exclusive) {
      exclusiveBadge = `<div class="exclusive-badge">⭐ ${pkg.exclusive}</div>`;
    }

    // Price display with strikethrough
    let priceHTML = '';
    if (isMonthly) {
      priceHTML = `
        <div class="price-container">
          <div class="current-price">${pkg.price} Kč <span style="font-size: 11px; color: #ddd;">/ měsíc</span></div>
          <div class="price-per-cig" style="color:#ffd;">+${pkg.dailyCigs} cig/den</div>
        </div>
      `;
    } else if (pkg.originalPrice) {
      priceHTML = `
        <div class="price-container">
          <div class="original-price">${pkg.originalPrice} Kč</div>
          <div class="current-price">${pkg.price} Kč</div>
          <div class="price-per-cig">${pricePerCig} Kč/cig</div>
        </div>
      `;
    } else {
      priceHTML = `
        <div class="price">${pkg.price} Kč <span style="font-size: 10px; color: #888;">(${pricePerCig} Kč/cig)</span></div>
      `;
    }

    return `
      <div class="shop-item ${badgeClass}">
        ${discountBadge}
        ${limitedBadge}
        ${exclusiveBadge}
        <div class="item-icon">
          ${pkg.icon}
        </div>
        <div class="item-details">
          <h3>${pkg.name}</h3>
          <div class="item-desc">${pkg.description}</div>
          ${isMonthly ? `<div class="item-bonus">📅 Platnost: ${pkg.durationDays} dní</div>` : ''}
          ${pkg.bonus ? `<div class="item-bonus">🎁 ${pkg.bonus}</div>` : ''}
          ${pkg.vipBonus ? `<div class="item-bonus vip-bonus">👑 ${pkg.vipBonus}</div>` : ''}
          ${pkg.firstTimerBonus ? `<div class="item-bonus first-timer">🌟 ${pkg.firstTimerBonus}</div>` : ''}
          <div class="item-price">
            ${priceHTML}
            <button class="buy-btn ${pkg.flashSale ? 'flash-sale-btn' : ''}" onclick="buyPackage('${pkg.id}')">
              ${pkg.flashSale ? '⚡ FLASH SALE!' : '💳 KOUPIT'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== BUY PACKAGE =====
async function buyPackage(packageId) {
  // Find package
  let pkg = null;
  for (const category in GROSE_PACKAGES) {
    const found = GROSE_PACKAGES[category].find(p => p.id === packageId);
    if (found) {
      pkg = found;
      break;
    }
  }

  if (!pkg) return;

  // Show coming soon message
  showNotification('🚧 Platební brána je ve vývoji! Brzy bude k dispozici.', 'error');
  
  // TODO: Implement payment gateway
  // For now, just log the purchase attempt
  console.log('💰 Purchase attempt:', pkg);
  
  // In production, this would:
  // 1. Create payment session
  // 2. Redirect to payment gateway
  // 3. Handle callback
  // 4. Add cigarettes to account
}

// ===== UPDATE UI =====
function updateUI() {
  // Update stats
  const totalPurchased = document.getElementById('totalPurchased');
  const totalSpent = document.getElementById('totalSpent');
  const purchaseCount = document.getElementById('purchaseCount');
  const lastPurchase = document.getElementById('lastPurchase');
  const biggestPurchase = document.getElementById('biggestPurchase');
  const avgPurchase = document.getElementById('avgPurchase');

  if (totalPurchased) {
    totalPurchased.textContent = gameState.groseStats.totalPurchased.toLocaleString('cs-CZ');
  }
  
  if (totalSpent) {
    totalSpent.textContent = gameState.groseStats.totalSpent.toLocaleString('cs-CZ');
  }
  
  if (purchaseCount) {
    purchaseCount.textContent = gameState.groseStats.purchaseCount.toLocaleString('cs-CZ');
  }
  
  if (lastPurchase) {
    if (gameState.groseStats.lastPurchase) {
      const date = new Date(gameState.groseStats.lastPurchase);
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      
      if (days > 0) {
        lastPurchase.textContent = `Před ${days}d`;
      } else if (hours > 0) {
        lastPurchase.textContent = `Před ${hours}h`;
      } else {
        lastPurchase.textContent = 'Dnes';
      }
    } else {
      lastPurchase.textContent = 'Nikdy';
    }
  }
  
  if (biggestPurchase) {
    biggestPurchase.textContent = gameState.groseStats.biggestPurchase.toLocaleString('cs-CZ');
  }
  
  if (avgPurchase) {
    const avg = gameState.groseStats.purchaseCount > 0 
      ? Math.floor(gameState.groseStats.totalPurchased / gameState.groseStats.purchaseCount)
      : 0;
    avgPurchase.textContent = avg.toLocaleString('cs-CZ');
  }
}

// ===== SWITCH CATEGORY =====
function switchCategory(category) {
  currentCategory = category;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeBtn = document.querySelector(`[data-category="${category}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  
  renderPackages();
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
  console.log('🚀 Initializing Grose Shop...');
  
  showNotification('Načítání Grose Shopu...', 'success');
  
  await initUser();
  
  renderPackages();
  updateUI();
  
  // Setup tab listeners
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchCategory(btn.dataset.category);
    });
  });

  // Start flash sale timer
  startFlashSaleTimer();

  // Start live purchases feed
  startLivePurchasesFeed();
  
  showNotification('Grose Shop načten!', 'success');
  
  console.log('✅ Grose Shop initialized!', gameState);
});

// ===== FLASH SALE TIMER =====
function startFlashSaleTimer() {
  const timerElement = document.getElementById('timerCountdown');
  if (!timerElement) return;

  // Set flash sale end time (24 hours from now, reset daily)
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  
  function updateTimer() {
    const now = new Date();
    const diff = tomorrow - now;
    
    if (diff <= 0) {
      // Reset to next day
      tomorrow.setDate(tomorrow.getDate() + 1);
      return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    timerElement.textContent = 
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  updateTimer();
  setInterval(updateTimer, 1000);
}

// ===== LIVE PURCHASES FEED =====
function startLivePurchasesFeed() {
  const feedElement = document.getElementById('liveFeed');
  if (!feedElement) return;

  const names = [
    'xXGopnikXx', 'Slavko69', 'CykaBlyat', 'Vadim420', 'Boris_Pro',
    'AddidasKing', 'SemechkiLover', 'Kvass_Master', 'Hardbass_DJ',
    'Tracksuit_Boss', 'Squat_Legend', 'Putin_Fan', 'Vodka_Warrior',
    'Cheeki_Breeki', 'Slav_Sniper', 'Gopnik_God', 'Blyat_Man',
    'Kompot_King', 'Mayonez_Hero', 'Tripoloski_Pro'
  ];

  const packages = [
    'MINI PACK', 'BASIC PACK', 'STARTER PACK', 'STANDARD',
    'MEGA PACK', 'GIANT PACK', 'SUPER PACK', 'ULTRA PACK',
    'MASTER PACK', 'ELITE PACK', 'LEGENDARY PACK',
    'ULTIMATE PACK', 'GODLIKE PACK'
  ];

  const emojis = ['😎', '🔥', '💪', '👑', '⚡', '💎', '🚀', '🎯', '🏆', '⭐'];

  let purchases = [];

  function addPurchase() {
    const name = names[Math.floor(Math.random() * names.length)];
    const pkg = packages[Math.floor(Math.random() * packages.length)];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const timeAgo = Math.floor(Math.random() * 30) + 1;

    const purchase = {
      name,
      package: pkg,
      emoji,
      timeAgo: `${timeAgo}s`,
      id: Date.now() + Math.random()
    };

    purchases.unshift(purchase);
    if (purchases.length > 5) purchases.pop();

    renderPurchases();
  }

  function renderPurchases() {
    feedElement.innerHTML = purchases.map(p => `
      <div class="live-purchase-item">
        <div class="live-purchase-avatar">${p.emoji}</div>
        <div class="live-purchase-details">
          <div class="live-purchase-name">${p.name}</div>
          <div class="live-purchase-package">koupil ${p.package}</div>
        </div>
        <div class="live-purchase-time">${p.timeAgo}</div>
      </div>
    `).join('');
  }

  // Add initial purchases
  for (let i = 0; i < 5; i++) {
    setTimeout(() => addPurchase(), i * 1000);
  }

  // Add new purchase every 8-15 seconds
  setInterval(() => {
    addPurchase();
  }, Math.random() * 7000 + 8000);
}

// ===== EXPOSE FOR HTML =====
window.buyPackage = buyPackage;

console.log('✅ Grose system loaded!');