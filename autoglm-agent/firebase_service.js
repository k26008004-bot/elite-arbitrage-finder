/**
 * firebase_service.js — Firebase/Firestore Data Layer
 *
 * Mirrors the PostgreSQL schema from the master architecture:
 *   products        → ASIN/UPC catalog with full metadata
 *   price_snapshots → Time-series price history per platform
 *   opportunities   → Scored arbitrage opportunities
 *   proxy_pool      → Proxy health tracking
 *   brand_blacklist → VERO/takedown-risk brands
 *   scan_logs       → Execution history and error tracking
 *
 * Dependency: npm install firebase-admin
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var or serviceAccount JSON
 */

const admin = require('firebase-admin');
const config = require('./config');

class FirebaseService {
  constructor() {
    this.initialized = false;
    this.db = null;
    this._collections = config.FIREBASE.COLLECTIONS;
  }

  /**
   * Initialize Firebase Admin SDK.
   * Uses GOOGLE_APPLICATION_CREDENTIALS by default.
   */
  async init(serviceAccountPath = null) {
    if (this.initialized) return;

    try {
      if (admin.apps.length === 0) {
        const options = {};
        if (serviceAccountPath) {
          options.credential = admin.credential.cert(serviceAccountPath);
        }
        // Otherwise uses GOOGLE_APPLICATION_CREDENTIALS env var
        admin.initializeApp(options);
      }

      this.db = admin.firestore();
      this.initialized = true;
      console.log('[Firebase] Connected successfully');
    } catch (err) {
      console.error(`[Firebase] Init failed: ${err.message}`);
      // Run in offline mode — products stored locally, no Firestore writes
      this.initialized = false;
      this.db = null;
    }
  }

  get isConnected() { return this.initialized && !!this.db; }

  // ═══════════════════════════════════════════════════════
  //  PRODUCTS
  // ═══════════════════════════════════════════════════════

  /**
   * Upsert an Amazon product.
   */
  async upsertProduct(product) {
    if (!this.isConnected) return this._noop('upsertProduct');
    const ref = this.db.collection(this._collections.PRODUCTS).doc(product.asin);
    await ref.set({
      asin: product.asin,
      upc: product.upc || null,
      ean: product.ean || null,
      isbn: product.isbn || null,
      title: product.title,
      brand: product.brand || null,
      category: product.category || null,
      imageUrl: product.imageUrl || null,
      weightLbs: product.weightLbs || null,
      dimensions: product.dimensions || null,
      rating: product.rating || null,
      reviewCount: product.reviewCount || 0,
      bsr: product.bsr || null,
      isFba: product.isFba || false,
      isGated: product.isGated || false,
      amazonUrl: product.url || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      firstSeenAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  /**
   * Get a product by ASIN.
   */
  async getProduct(asin) {
    if (!this.isConnected) return null;
    const doc = await this.db.collection(this._collections.PRODUCTS).doc(asin).get();
    return doc.exists ? doc.data() : null;
  }

  // ═══════════════════════════════════════════════════════
  //  PRICE SNAPSHOTS (time-series)
  // ═══════════════════════════════════════════════════════

  /**
   * Record a price snapshot for a platform.
   * @param {'amazon'|'ebay'} platform
   * @param {Object} data — { asin, price, listPrice, shippingCost, condition, ... }
   */
  async recordPriceSnapshot(platform, data) {
    if (!this.isConnected) return;
    await this.db.collection(this._collections.PRICE_SNAPSHOTS).add({
      asin: data.asin,
      platform,
      price: data.price,
      listPrice: data.listPrice || null,
      shippingCost: data.shippingCost || 0,
      condition: data.condition || 'New',
      listingFormat: data.listingFormat || null,
      quantityAvailable: data.quantityAvailable || null,
      snapshottedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  /**
   * Get price history for a product over a time range.
   */
  async getPriceHistory(asin, days = 30) {
    if (!this.isConnected) return [];
    const since = new Date();
    since.setDate(since.getDate() - days);

    const snap = await this.db
      .collection(this._collections.PRICE_SNAPSHOTS)
      .where('asin', '==', asin)
      .where('snapshottedAt', '>=', since)
      .orderBy('snapshottedAt', 'asc')
      .get();

    return snap.docs.map(d => d.data());
  }

  // ═══════════════════════════════════════════════════════
  //  OPPORTUNITIES (scored arbitrage finds)
  // ═══════════════════════════════════════════════════════

  /**
   * Save a scored opportunity.
   */
  async saveOpportunity(opportunity) {
    if (!this.isConnected) return;
    const docId = `${opportunity.asin}_${Date.now()}`;
    await this.db.collection(this._collections.OPPORTUNITIES).doc(docId).set({
      asin: opportunity.asin,
      title: opportunity.title,
      amazonPrice: opportunity.amazonPrice,
      ebayAvgSoldPrice: opportunity.ebayAvgSoldPrice,
      ebayMedianSoldPrice: opportunity.ebayMedianSoldPrice,
      ebayMonthlyVolume: opportunity.ebayMonthlyVolume,
      ebayActiveListings: opportunity.ebayActiveListings,
      estimatedFees: opportunity.estimatedFees,
      netProfit: opportunity.netProfit,
      roiPct: opportunity.roiPct,
      compositeScore: opportunity.compositeScore,
      tier: opportunity.tier,
      tierEmoji: opportunity.tierEmoji,
      matchConfidence: opportunity.matchConfidence,
      currency: 'USD',
      calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  /**
   * Query top opportunities (for dashboard / export).
   */
  async getTopOpportunities(limit = 50, minScore = 50) {
    if (!this.isConnected) return [];
    const snap = await this.db
      .collection(this._collections.OPPORTUNITIES)
      .where('compositeScore', '>=', minScore)
      .orderBy('compositeScore', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  /**
   * Get scan statistics.
   */
  async getScanStats(hoursBack = 24) {
    if (!this.isConnected) return { total: 0, elite: 0, strong: 0, watch: 0, skip: 0, avgRoi: 0 };

    const since = new Date();
    since.setHours(since.getHours() - hoursBack);

    const snap = await this.db
      .collection(this._collections.OPPORTUNITIES)
      .where('calculatedAt', '>=', since)
      .get();

    const docs = snap.docs.map(d => d.data());
    return {
      total: docs.length,
      elite: docs.filter(d => d.tier === 'Elite').length,
      strong: docs.filter(d => d.tier === 'Strong').length,
      watch: docs.filter(d => d.tier === 'Watch').length,
      skip: docs.filter(d => d.tier === 'Skip').length,
      avgRoi: docs.length > 0
        ? parseFloat((docs.reduce((s, d) => s + d.roiPct, 0) / docs.length).toFixed(1))
        : 0,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  BRAND BLACKLIST (VERO protection)
  // ═══════════════════════════════════════════════════════

  async isBrandBlacklisted(brand) {
    if (!this.isConnected || !brand) return false;
    const doc = await this.db
      .collection(this._collections.BRAND_BLACKLIST)
      .doc(brand.toLowerCase())
      .get();
    return doc.exists;
  }

  async blacklistBrand(brand, reason = '') {
    if (!this.isConnected) return;
    await this.db
      .collection(this._collections.BRAND_BLACKLIST)
      .doc(brand.toLowerCase())
      .set({ brand, reason, addedAt: admin.firestore.FieldValue.serverTimestamp() });
  }

  // ═══════════════════════════════════════════════════════
  //  SCAN LOGS
  // ═══════════════════════════════════════════════════════

  async logScan(results) {
    if (!this.isConnected) return;
    await this.db.collection(this._collections.SCAN_LOGS).add({
      totalScanned: results.totalScanned || 0,
      matchesFound: results.matchesFound || 0,
      eliteCount: results.eliteCount || 0,
      strongCount: results.strongCount || 0,
      errors: results.errors || [],
      durationMs: results.durationMs || 0,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // ── No-op for disconnected mode ──────────────────────
  _noop(method) {
    // Silent no-op when Firebase is not connected
    return null;
  }
}

module.exports = FirebaseService;
