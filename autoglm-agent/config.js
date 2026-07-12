/**
 * config.js — Master Configuration
 * All tunables, thresholds, selectors, and Firebase paths in one place.
 */

module.exports = {
  // ── General ──────────────────────────────────────────
  APP_NAME: 'AmazonToEbayArbitrageEngine',
  ENV: process.env.NODE_ENV || 'development',          // 'development' | 'production'
  DRY_RUN: process.env.DRY_RUN !== 'false',             // true in dev → uses simulator

  // ── Rate Limits (seconds) ────────────────────────────
  AMAZON_DELAY_MIN: 3,      // Min seconds between Amazon requests
  AMAZON_DELAY_MAX: 8,      // Max seconds between Amazon requests
  EBAY_DELAY_MIN: 4,        // Min seconds between eBay requests
  EBAY_DELAY_MAX: 10,       // Max seconds between eBay requests
  MAX_AMAZON_PER_HOUR: 50,  // Per IP
  MAX_EBAY_PER_HOUR: 40,    // Per IP

  // ── Amazon Selectors ─────────────────────────────────
  AMAZON_SELECTORS: {
    TITLE: '#productTitle',
    PRICE: '.a-price .a-offscreen',
    LIST_PRICE: '.basisPrice .a-offscreen, .a-text-price span.a-offscreen',
    RATING: '#acrPopover .a-icon-alt, #averageCustomerReviews .a-icon-alt',
    REVIEW_COUNT: '#acrCustomerReviewText',
    BSR_RANK: '#productDetails_detailBullets_sections1, #detailBulletsWrapper_feature_div',
    UPC_EAN: '#productDetails_detailBullets_sections1',
    ITEM_WEIGHT: '#productDetails_detailBullets_sections1',
    DIMENSIONS: '#productDetails_detailBullets_sections1',
    IMAGE: '#landingImage',
    AVAILABILITY: '#availability span',
    MERCHANT_INFO: '#merchant-info',
    CATEGORY: '#wayfinding-breadcrumbs_feature_div',
    BRAND: '#bylineInfo',
  },

  // ── eBay Selectors ───────────────────────────────────
  EBAY_SELECTORS: {
    SOLD_ITEMS: '.s-item',
    SOLD_PRICE: '.s-item__price',
    SOLD_DATE: '.s-item__title--tagblock .POSITIVE, .s-item__caption--signal',
    SHIPPING_COST: '.s-item__shipping, .s-item__logisticsCost',
    CONDITION: '.s-item__subtitle, .SECONDARY_INFO',
    TITLE: '.s-item__title',
    ITEM_LINK: '.s-item__link',
    LISTING_FORMAT: '.s-item__format, .s-item__purchaseOptions',
    SELLER_INFO: '.s-item__seller-info-text',
  },

  // ── eBay Search URLs ─────────────────────────────────
  EBAY_SEARCH_URL: 'https://www.ebay.com/sch/i.html',
  EBAY_SEARCH_PARAMS_SOLD: 'LH_Sold=1&LH_Complete=1',   // Sold + Completed
  EBAY_SEARCH_PARAMS_ACTIVE: '',                          // Active listings

  // ── Matching ─────────────────────────────────────────
  MATCH_CONFIDENCE_UPC: 1.0,      // UPC exact match = 100% confidence
  MATCH_CONFIDENCE_TITLE: 0.85,   // fuzzball token_sort_ratio minimum
  MATCH_CONFIDENCE_EAN: 1.0,      // EAN exact match = 100%
  FUZZ_THRESHOLD: 85,             // fuzzball minimum score (0-100)

  // ── Profit Calculation ───────────────────────────────
  EBAY_FVF_RATE: 0.1325,          // 13.25% Final Value Fee (most categories)
  EBAY_FVF_FIXED: 0.40,           // $0.40 per-order fee
  EBAY_STORE_FEE: 0.30,           // Per-listing store fee (if applicable)
  PAYMENT_RATE: 0.029,            // 2.9% Managed Payments / PayPal
  PAYMENT_FIXED: 0.30,            // $0.30 per transaction
  RETURNS_BUFFER: 0.03,           // 3% buffer for returns/refunds
  PACKAGING_COST: 1.00,           // Estimated per-item packaging
  SHIPPING_ESTIMATE_PER_LB: 5.50, // Rough shipping estimate per pound

  // ── Scoring Weights (must sum to 100) ─────────────────
  SCORE_WEIGHTS: {
    PROFIT_MARGIN: 40,   // 40% weight
    SALES_VELOCITY: 30,  // 30% weight
    COMPETITION: 15,     // 15% weight
    RISK: 15,            // 15% weight
  },

  // ── Tier Thresholds ──────────────────────────────────
  TIERS: {
    ELITE: { min: 85, max: 100, emoji: '🥇', label: 'Elite',   action: 'BUY_IMMEDIATELY' },
    STRONG:{ min: 70, max: 84,  emoji: '🥈', label: 'Strong',  action: 'BUY_MODERATE'    },
    WATCH: { min: 50, max: 69,  emoji: '🥉', label: 'Watch',   action: 'MONITOR'         },
    SKIP:  { min: 0,  max: 49,  emoji: '⬛', label: 'Skip',    action: 'PASS'            },
  },

  // ── Sales Velocity Scoring ───────────────────────────
  VELOCITY_SCORES: [
    { minSales: 30, score: 30  },   // 1+ per day  → full 30 pts
    { minSales: 15, score: 25  },   // every 2 days
    { minSales: 10, score: 18  },   // every 3 days
    { minSales: 5,  score: 12  },   // weekly
    { minSales: 1,  score: 6   },   // monthly
    { minSales: 0,  score: 0   },   // no sales
  ],

  // ── Competition Scoring ──────────────────────────────
  COMPETITION_SCORES: [
    { maxListings: 3,   score: 15  },  // Barely any competition
    { maxListings: 10,  score: 12  },
    { maxListings: 25,  score: 8   },
    { maxListings: 50,  score: 4   },
    { maxListings: 9999,score: 1   },  // Saturated
  ],

  // ── Risk Deductions ──────────────────────────────────
  RISK_DEDUCTIONS: {
    LOW_RATING:        { threshold: 4.0,  deduct: 5 },  // Below 4-star Amazon
    GATED_CATEGORY:    { deduct: 5 },
    HIGH_VOLATILITY:   { deduct: 4 },
    HAZMAT:            { deduct: 3 },
    HEAVY_ITEM:        { threshold_lbs: 10, deduct: 2 },
    LOW_REVIEW_COUNT:  { threshold: 50,   deduct: 3 },
  },

  // ── Firebase ─────────────────────────────────────────
  FIREBASE: {
    // Set via GOOGLE_APPLICATION_CREDENTIALS or service account JSON
    COLLECTIONS: {
      PRODUCTS:       'products',
      PRICE_SNAPSHOTS:'price_snapshots',
      OPPORTUNITIES:  'opportunities',
      PROXY_POOL:     'proxy_pool',
      BRAND_BLACKLIST:'brand_blacklist',
      SCAN_LOGS:      'scan_logs',
    },
  },

  // ── Discord Webhook ──────────────────────────────────
  DISCORD: {
    WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL || '',
    ALERT_TIERS: ['Elite', 'Strong'],   // Only ping for these tiers
    COLOR_ELITE:  0xFFD700,    // Gold
    COLOR_STRONG: 0x00C9A7,    // Teal
    COLOR_WATCH:  0x7C5CFC,    // Purple (log only, no ping)
    USERNAME: 'Arbitrage Hunter',
    AVATAR_URL: '',
  },

  // ── Proxy ────────────────────────────────────────────
  PROXIES: (process.env.PROXY_LIST || '')
    .split(',')
    .filter(Boolean),

  // ── Simulator (dev fallback) ─────────────────────────
  SIMULATOR: {
    ENABLED: process.env.SIMULATOR_ENABLED !== 'false',  // true by default in dev
    // Price multiplier range for simulated eBay data
    EBAY_MULTIPLIER_MIN: 0.9,   // Sometimes eBay is cheaper (skip)
    EBAY_MULTIPLIER_MAX: 2.5,   // Max realistic markup
    SOLD_VOLUME_MIN: 0,
    SOLD_VOLUME_MAX: 50,
    ACTIVE_LISTINGS_MIN: 1,
    ACTIVE_LISTINGS_MAX: 100,
  },

  // ── Logging ──────────────────────────────────────────
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',   // 'debug' | 'info' | 'warn' | 'error'
  LOG_DIR: './logs',
};
