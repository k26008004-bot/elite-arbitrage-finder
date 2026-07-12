/**
 * simulator.js — Simulated eBay Marketplace Data
 *
 * When CAPTCHA blocks real eBay scraping, this module generates
 * realistic mock data so the pipeline never stops. In production,
 * DRY_RUN / SIMULATOR.ENABLED should be false.
 *
 * The simulator mimics real eBay sold-listing distributions:
 *   - ~15% chance item doesn't exist on eBay (no match)
 *   - ~25% chance eBay price < Amazon price (negative arbitrage)
 *   - ~35% chance moderate markup (1.0x–1.5x)
 *   - ~20% chance strong markup (1.5x–2.5x) ← money makers
 *   - ~5%  chance massive markup (2.5x+) ← jackpot
 */

const config = require('./config');

class EbaySimulator {
  constructor(seed = null) {
    this.rng = seed ? this._seededRandom(seed) : Math.random;
  }

  /**
   * Generate simulated eBay data for an Amazon product.
   * @param {Object} amazonProduct — { asin, title, price, upc, rating, weight_lbs, category }
   * @returns {Object} simulated eBay market data
   */
  simulate(amazonProduct) {
    const { SIMULATOR } = config;

    // ── 15% chance: item simply doesn't sell on eBay ──
    const exists = this._chance(0.85);
    if (!exists) {
      return {
        found: false,
        reason: 'NO_EBAY_PRESENCE',
        soldListings: [],
        activeListings: 0,
        avgSoldPrice: null,
        medianSoldPrice: null,
        monthlyVolume: 0,
      };
    }

    // ── Generate sold listings ──
    const volume = this._randomInt(
      SIMULATOR.SOLD_VOLUME_MIN,
      SIMULATOR.SOLD_VOLUME_MAX
    );
    const active = this._randomInt(
      SIMULATOR.ACTIVE_LISTINGS_MIN,
      SIMULATOR.ACTIVE_LISTINGS_MAX
    );

    // Price distribution: random multiplier with realistic spread
    const multiplier = this._randomFloat(
      SIMULATOR.EBAY_MULTIPLIER_MIN,
      SIMULATOR.EBAY_MULTIPLIER_MAX
    );
    const baseEbayPrice = amazonProduct.price * multiplier;

    // Generate individual sale prices (normal distribution around base)
    const soldPrices = [];
    for (let i = 0; i < volume; i++) {
      const variation = this._randomFloat(0.85, 1.15);  // ±15% around mean
      soldPrices.push(parseFloat((baseEbayPrice * variation).toFixed(2)));
    }

    // Sort for median calculation
    soldPrices.sort((a, b) => a - b);
    const median = volume > 0
      ? (volume % 2 === 0
          ? (soldPrices[volume / 2 - 1] + soldPrices[volume / 2]) / 2
          : soldPrices[Math.floor(volume / 2)])
      : baseEbayPrice;

    const avg = volume > 0
      ? parseFloat((soldPrices.reduce((a, b) => a + b, 0) / volume).toFixed(2))
      : baseEbayPrice;

    // ── Shipping: free or calculated ──
    const shippingCost = this._chance(0.4) ? 0 : this._randomFloat(3.99, 12.99);

    // ── Sold listing entries ──
    const soldListings = soldPrices.slice(0, 20).map((price) => ({
      title: amazonProduct.title,
      price,
      shipping: parseFloat(shippingCost.toFixed(2)),
      condition: this._chance(0.7) ? 'New' : 'Used',
      date: this._randomPastDate(90),
      format: 'BIN',
      sellerFeedback: this._randomInt(50, 50000),
    }));

    return {
      found: true,
      source: 'simulator',
      upcVerified: !!amazonProduct.upc,
      soldListings,
      soldPrices,
      activeListings: active,
      avgSoldPrice: avg,
      medianSoldPrice: median,
      monthlyVolume: volume,
      shippingCostAvg: parseFloat(shippingCost.toFixed(2)),
      shippingFreePct: shippingCost === 0 ? 100 : 0,
      conditionBreakdown: {
        New: Math.round(volume * 0.7),
        Used: Math.round(volume * 0.25),
        Refurbished: Math.round(volume * 0.05),
      },
    };
  }

  // ── Private helpers ──────────────────────────────────
  _chance(probability) {
    return this.rng() < probability;
  }

  _randomFloat(min, max) {
    return this.rng() * (max - min) + min;
  }

  _randomInt(min, max) {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  _randomPastDate(maxDaysAgo) {
    const days = this._randomInt(0, maxDaysAgo);
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }

  _seededRandom(seed) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
}

module.exports = EbaySimulator;
