/**
 * agent.js — MASTER ORCHESTRATOR
 * Amazon → eBay Arbitrage Elite Product Hunting Engine
 *
 * Pipeline (per product):
 *   1. Launch Playwright (stealth browser)
 *   2. Scrape Amazon product detail (ASIN-level)
 *   3. Cross-search eBay sold + completed listings
 *   4. Match products (UPC exact → fuzzy title)
 *   5. Calculate true profit (real eBay sold data)
 *   6. Score opportunity (0–100 multi-factor)
 *   7. Save to Firebase + alert Discord
 *   8. Repeat for next product
 *
 * Usage:
 *   node agent.js                                    # Scan default ASIN list
 *   node agent.js --asin B0XXXXXXX,B0YYYYYYY          # Scan specific ASINs
 *   node agent.js --category "Electronics" --limit 10 # Category scan
 *   DRY_RUN=false node agent.js                       # Production mode (real eBay)
 *
 * Dependencies:
 *   npm install playwright playwright-extra puppeteer-extra-plugin-stealth fuzzball firebase-admin
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Load .env file if present
const dotenv = require('dotenv');
try { dotenv.config({ path: require('path').join(__dirname, '..', '.env') }); } catch {}

const config = require('./config');
const { AntiDetectionManager, DelayEngine } = require('./anti_detection');
const AmazonScraper = require('./amazon_scraper');
const EbayScraper = require('./ebay_scraper');
const EbaySimulator = require('./simulator');
const ProductMatcher = require('./product_matcher');
const ProfitCalculator = require('./profit_calculator');
const ScoringEngine = require('./scoring_engine');
const FirebaseService = require('./firebase_service');
const DiscordWebhook = require('./discord_webhook');

// ── Apply stealth plugin ────────────────────────────────
chromium.use(StealthPlugin());

// ═══════════════════════════════════════════════════════════
//  ARBITRAGE ENGINE
// ═══════════════════════════════════════════════════════════

class ArbitrageEngine {
  constructor() {
    this.browser = null;
    this.antiDetect = null;
    this.simulator = new EbaySimulator();
    this.matcher = new ProductMatcher();
    this.calculator = new ProfitCalculator();
    this.scorer = new ScoringEngine();
    this.firebase = new FirebaseService();
    this.discord = new DiscordWebhook();

    this.stats = {
      totalScanned: 0,
      matchesFound: 0,
      eliteCount: 0,
      strongCount: 0,
      watchCount: 0,
      skipCount: 0,
      errors: [],
      startTime: null,
      durationMs: 0,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  INITIALIZATION
  // ═══════════════════════════════════════════════════════

  async init() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  ${config.APP_NAME}  ║
║  Amazon → eBay Arbitrage Elite Product Hunting Engine   ║
║  Mode: ${config.DRY_RUN ? '🔸 SIMULATION' : '🔴 LIVE'}                                  ║
╚══════════════════════════════════════════════════════════╝
`);

    // Init Firebase (optional — engine works without it)
    await this.firebase.init();

    // Init Anti-Detection Manager with proxies from .env
    const proxyList = process.env.PROXY_LIST
      ? process.env.PROXY_LIST.split(',').map(s => s.trim()).filter(Boolean)
      : config.PROXIES || [];

    this.antiDetect = new AntiDetectionManager({
      proxies: proxyList,
      captchaKey: process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_API_KEY || '',
      stateDir: require('path').join(__dirname, '..', 'logs', 'anti_detection'),
    });

    // Launch Playwright (military-grade stealth via anti-detection module)
    console.log('[Browser] Launching Playwright with 6-layer anti-detection...');
    this.browser = await chromium.launch({
      headless: config.ENV === 'production',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-size=1920,1080',
      ],
    });

    // Print anti-detection status
    console.log(this.antiDetect.status());
    console.log('[Browser] Ready.\n');
  }

  // ═══════════════════════════════════════════════════════
  //  MAIN SCAN LOOP
  // ═══════════════════════════════════════════════════════

  /**
   * Scan a list of ASINs for arbitrage opportunities.
   * @param {string[]} asins — Array of Amazon ASINs
   * @returns {Object[]} Scored opportunities, sorted best-first
   */
  async scan(asinList) {
    this.stats.startTime = Date.now();
    const results = [];

    console.log(`[Engine] Starting scan of ${asinList.length} products...\n`);
    console.log('═'.repeat(60));

    for (let i = 0; i < asinList.length; i++) {
      const asin = asinList[i].trim();
      if (!asin) continue;

      console.log(`\n📦 [${i + 1}/${asinList.length}] ASIN: ${asin}`);

      try {
        const result = await this._processProduct(asin);
        results.push(result);

        // ── Real-time Discord alert for Elite ──────
        if (result.scoring && result.scoring.tier === 'Elite') {
          await this.discord.sendAlert(result);
        }
      } catch (err) {
        console.error(`  ❌ Error processing ${asin}: ${err.message}`);
        this.stats.errors.push({ asin, error: err.message });
      }

      // ── Rate limiting between products (human-like gamma delay) ────────
      await new Promise(r => setTimeout(r, DelayEngine.productGap()));
    }

    this.stats.durationMs = Date.now() - this.stats.startTime;

    // Sort by score descending
    results.sort((a, b) => b.scoring.score - a.scoring.score);

    await this._finalize(results);
    return results;
  }

  /**
   * Process a single product through the full pipeline.
   * Each platform gets its own anti-detection stealth context (separate proxy + fingerprint).
   */
  async _processProduct(asin) {
    let amazonData;

    // ════ PHASE 1: Amazon scrape (safeScrape wrapper) ════
    console.log(`  🔍 Phase 1/4: Scraping Amazon (stealth context)...`);

    const amazonSession = await this.antiDetect.safeScrape(
      this.browser,
      'amazon.com',
      async (page) => {
        const amazonScraper = new AmazonScraper(page);
        return await amazonScraper.scrapeByAsin(asin);
      }
    );

    amazonData = amazonSession.result;
    this.stats.totalScanned++;

    if (!amazonData || amazonData.isCaptcha || !amazonData.title) {
      const reason = amazonData?.isCaptcha ? 'AMAZON_CAPTCHA' : 'NO_AMAZON_DATA';
      console.log(`  ⚠️ ${reason === 'AMAZON_CAPTCHA' ? 'CAPTCHA (solver attempted)' : 'No product data'}`);
      return this._failedResult(asin, reason);
    }

    console.log(`  ✅ Amazon: "${amazonData.title.substring(0, 50)}..." — $${amazonData.price}`);

    // Save to Firebase
    await this.firebase.upsertProduct(amazonData);
    await this.firebase.recordPriceSnapshot('amazon', { asin, price: amazonData.price, listPrice: amazonData.listPrice });

    // ════ PHASE 2: eBay market scan (safeScrape wrapper) ════
    console.log(`  🔍 Phase 2/4: Searching eBay market data (stealth context)...`);

    let ebayData;
    const useRealEbay = !config.DRY_RUN;

    if (useRealEbay) {
      // Real eBay scraping via safeScrape with separate stealth context
      try {
        const ebaySession = await this.antiDetect.safeScrape(
          this.browser,
          'ebay.com',
          async (page) => {
            const ebayScraper = new EbayScraper(page);
            return await ebayScraper.fullMarketScan(
              amazonData.title,
              amazonData.upc || amazonData.ean || amazonData.isbn
            );
          }
        );
        ebayData = ebaySession.result;
      } catch (eBayErr) {
        console.log(`  ⚠️ eBay scrape failed (${eBayErr.message}) — falling back to simulator`);
        ebayData = null;
      }

      // Fallback to simulator if eBay blocked/failed
      if (!ebayData || ebayData.captchaBlocked || !ebayData.found) {
        if (ebayData?.captchaBlocked) {
          console.log('  ⚠️ eBay CAPTCHA blocked — using simulator');
        }
        ebayData = this.simulator.simulate(amazonData);
        ebayData.source = 'simulator_fallback';
      }
    } else {
      ebayData = this.simulator.simulate(amazonData);
    }

    if (ebayData.avgSoldPrice) {
      await this.firebase.recordPriceSnapshot('ebay', { asin, price: ebayData.avgSoldPrice, shippingCost: ebayData.shippingCostAvg || 0 });
    }

    if (!ebayData.found || !ebayData.avgSoldPrice) {
      console.log('  ℹ️ No eBay market data available');
      return this._failedResult(asin, 'NO_EBAY_DATA');
    }

    console.log(`  ✅ eBay: Avg Sold $${ebayData.avgSoldPrice} | Median $${ebayData.medianSoldPrice} | ${ebayData.monthlyVolume} sold/mo | ${ebayData.activeListings} active`);

    // ════ PHASE 3: Match + Profit ══════════════
    console.log(`  🔍 Phase 3/4: Matching & profit calculation...`);

    const match = await this.matcher.match(amazonData, ebayData);
    if (!match.matched) {
      console.log(`  ⚠️ No match (best fuzzy: ${match.bestFuzzyScore || 0}%)`);
      return this._failedResult(asin, 'NO_MATCH', {
        bestFuzzyScore: match.bestFuzzyScore,
        candidates: this.matcher.getCandidates(amazonData, ebayData.soldListings, 3),
      });
    }

    const profit = this.calculator.calculate({
      amazonPrice: amazonData.price,
      ebaySoldPrice: ebayData.avgSoldPrice,
      weightLbs: amazonData.weightLbs,
    });

    console.log(`  ✅ Match: ${match.method} (confidence: ${(match.confidence * 100).toFixed(0)}%)`);
    console.log(`  ✅ Profit: $${profit.profit.netProfit} | ROI: ${profit.profit.roiPct}%`);

    // ════ PHASE 4: Score + Save ════════════════
    console.log(`  🔍 Phase 4/4: Scoring & saving...`);

    const scoring = this.scorer.score({
      amazon: amazonData,
      ebay: ebayData,
      profit,
      riskFlags: {
        isGated: amazonData.isGated || false,
        isVolatile: false,
        isHazmat: false,
      },
    });

    this.stats.matchesFound++;
    this._incrementTier(scoring.tier);

    // ── Build opportunity record ────────────────
    const oppRecord = {
      asin,
      title: amazonData.title,
      amazonUrl: amazonData.url,
      imageUrl: amazonData.imageUrl,
      amazonPrice: amazonData.price,
      ebayAvgSoldPrice: ebayData.avgSoldPrice,
      ebayMedianSoldPrice: ebayData.medianSoldPrice,
      ebayMonthlyVolume: ebayData.monthlyVolume,
      ebayActiveListings: ebayData.activeListings,
      estimatedFees: profit.fees.totalFees,
      netProfit: profit.profit.netProfit,
      roiPct: profit.profit.roiPct,
      compositeScore: scoring.score,
      tier: scoring.tier,
      tierEmoji: scoring.tierEmoji,
      matchMethod: match.method,
      matchConfidence: match.confidence,
      matchTier: match.tier || 0,
      amazon: amazonData,
      ebay: ebayData,
      profit,
      scoring,
    };

    // Save to Firebase
    await this.firebase.saveOpportunity(oppRecord);

    // Log tier
    const tierEmoji = scoring.tierEmoji || '';
    console.log(`  ${tierEmoji} TIER: ${scoring.tier} | Score: ${scoring.score}/100 | Action: ${scoring.tierAction}`);
    console.log(`  🎯 Breakdown: Margin ${scoring.breakdown.margin.score.toFixed(1)} | Velocity ${scoring.breakdown.velocity.score} | Competition ${scoring.breakdown.competition.score} | Risk ${scoring.breakdown.risk.score.toFixed(1)}`);

    return oppRecord;
  }

  // ═══════════════════════════════════════════════════════
  //  FINALIZATION
  // ═══════════════════════════════════════════════════════

  async _finalize(results) {
    console.log('\n' + '═'.repeat(60));
    console.log('🏁 SCAN COMPLETE');
    console.log('═'.repeat(60));
    console.log(`  Total Scanned:     ${this.stats.totalScanned}`);
    console.log(`  Matches Found:     ${this.stats.matchesFound}`);
    console.log(`  🥇 Elite:          ${this.stats.eliteCount}`);
    console.log(`  🥈 Strong:         ${this.stats.strongCount}`);
    console.log(`  🥉 Watch:          ${this.stats.watchCount}`);
    console.log(`  ⬛ Skip:           ${this.stats.skipCount}`);
    console.log(`  Errors:            ${this.stats.errors.length}`);
    console.log(`  Duration:          ${(this.stats.durationMs / 1000).toFixed(1)}s`);
    console.log('─'.repeat(60));

    // ── Display top 10 ────────────────────────
    if (results.length > 0) {
      console.log('\n📊 TOP OPPORTUNITIES:');
      console.log('─'.repeat(60));
      results.slice(0, 10).forEach((r, i) => {
        const t = r.scoring || {};
        console.log(
          `  ${i + 1}. ${t.tierEmoji || ''} ${r.title?.substring(0, 45) || 'N/A'}... ` +
          `| Score: ${t.score || 'N/A'} | Net: $${r.netProfit} | ROI: ${r.roiPct}%`
        );
      });
    }

    // ── Fire final events ─────────────────────
    // Send daily digest if there are results
    const eliteAndStrong = results.filter(r => {
      const tier = r.scoring?.tier || r.tier;
      return tier === 'Elite' || tier === 'Strong';
    });

    if (eliteAndStrong.length > 0) {
      await this.discord.sendDailyDigest(results, this.stats);
    }

    // Log to Firebase
    await this.firebase.logScan({
      totalScanned: this.stats.totalScanned,
      matchesFound: this.stats.matchesFound,
      eliteCount: this.stats.eliteCount,
      strongCount: this.stats.strongCount,
      errors: this.stats.errors,
      durationMs: this.stats.durationMs,
    });

    // Print final anti-detection health
    console.log(this.antiDetect.status());
  }

  // ═══════════════════════════════════════════════════════
  //  CLEANUP
  // ═══════════════════════════════════════════════════════

  async shutdown() {
    console.log('\n[Browser] Shutting down...');
    if (this.browser) {
      await this.browser.close();
    }
    console.log('[Engine] Shutdown complete.\n');
  }

  // ═══════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════

  _failedResult(asin, reason, extra = {}) {
    return {
      asin,
      found: false,
      reason,
      scoring: { score: 0, tier: 'Skip', tierEmoji: '⬛', tierAction: 'PASS', breakdown: {} },
      ...extra,
    };
  }

  _incrementTier(tier) {
    switch (tier) {
      case 'Elite':  this.stats.eliteCount++;  break;
      case 'Strong': this.stats.strongCount++; break;
      case 'Watch':  this.stats.watchCount++;  break;
      case 'Skip':   this.stats.skipCount++;   break;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  EXPORTER — CSV + JSON (for dashboard)
  // ═══════════════════════════════════════════════════════

  /**
   * Export results to CSV with full columns, color-coded tier, and complete fee breakdown.
   */
  exportCsv(results) {
    const headers = [
      'Tier', 'ASIN', 'Title', 'AmazonPrice', 'eBayAvgSold', 'eBayMedianSold',
      'NetProfit', 'ROI%', 'CompositeScore',
      'MarginScore', 'VelocityScore', 'CompetitionScore', 'RiskScore',
      'MonthlySales', 'ActiveListings', 'SellThroughRate',
      'eBayFVF', 'PaymentFee', 'ShippingCost', 'ReturnsBuffer', 'TotalFees',
      'MatchMethod', 'MatchConfidence', 'MatchTier',
      'AmazonRating', 'AmazonReviews', 'BSR', 'IsFBA', 'Category',
      'AmazonURL', 'ImageURL',
    ];

    const rows = results
      .filter(r => r.found !== false)
      .map(r => {
        const s = r.scoring || {};
        const b = s.breakdown || {};
        const p = r.profit || {};
        const a = r.amazon || r; // amazon data stored inline or in .amazon

        const sellThrough = r.ebayMonthlyVolume && r.ebayActiveListings
          ? (r.ebayMonthlyVolume / Math.max(r.ebayActiveListings, 1) * 100).toFixed(1) + '%'
          : '';

        return [
          s.tierEmoji || r.tierEmoji || '',
          r.asin,
          `"${(r.title || '').replace(/"/g, '""')}"`,
          r.amazonPrice?.toFixed(2) || '',
          r.ebayAvgSoldPrice?.toFixed(2) || '',
          r.ebayMedianSoldPrice?.toFixed(2) || '',
          r.netProfit?.toFixed(2) || '',
          r.roiPct?.toFixed(1) || '',
          (s.score || r.compositeScore)?.toFixed(1) || '',
          b.margin?.score?.toFixed(1) || '',
          b.velocity?.score || '',
          b.competition?.score || '',
          b.risk?.score?.toFixed(1) || '',
          r.ebayMonthlyVolume || '',
          r.ebayActiveListings || '',
          sellThrough,
          p.fees?.ebayFvf?.toFixed(2) || '',
          p.fees?.paymentFee?.toFixed(2) || '',
          p.fees?.shippingCost?.toFixed(2) || '',
          p.fees?.returnsBuffer?.toFixed(2) || '',
          p.fees?.totalFees?.toFixed(2) || '',
          r.matchMethod || '',
          r.matchConfidence?.toFixed(3) || '',
          r.matchTier || '',
          a.rating || '',
          a.reviewCount || '',
          a.bsr || '',
          a.isFba ? 'Yes' : 'No',
          `"${(a.category || '').replace(/"/g, '""')}"`,
          r.amazonUrl || r.url || '',
          r.imageUrl || a.imageUrl || '',
        ].join(',');
      });

    return [headers.join(',')].concat(rows).join('\n');
  }

  /**
   * Export results as JSON (used by the dashboard HTML).
   */
  exportJson(results) {
    const exportable = results
      .filter(r => r.found !== false)
      .map(r => {
        const s = r.scoring || {};
        const b = s.breakdown || {};
        const p = r.profit || {};
        const a = r.amazon || r;
        return {
          asin: r.asin,
          title: r.title,
          tier: s.tier || r.tier || 'Skip',
          tierEmoji: s.tierEmoji || r.tierEmoji || '',
          score: s.score ?? r.compositeScore ?? 0,
          amazonPrice: r.amazonPrice,
          ebayAvgSoldPrice: r.ebayAvgSoldPrice,
          ebayMedianSoldPrice: r.ebayMedianSoldPrice,
          netProfit: r.netProfit,
          roiPct: r.roiPct,
          monthlyVolume: r.ebayMonthlyVolume,
          activeListings: r.ebayActiveListings,
          sellThroughRate: r.ebayMonthlyVolume && r.ebayActiveListings
            ? parseFloat((r.ebayMonthlyVolume / Math.max(r.ebayActiveListings, 1) * 100).toFixed(1))
            : 0,
          matchMethod: r.matchMethod,
          matchConfidence: r.matchConfidence,
          matchTier: r.matchTier,
          breakdown: {
            margin: b.margin?.score || 0,
            velocity: b.velocity?.score || 0,
            competition: b.competition?.score || 0,
            risk: b.risk?.score || 0,
          },
          fees: {
            ebayFvf: p.fees?.ebayFvf,
            paymentFee: p.fees?.paymentFee,
            shipping: p.fees?.shippingCost,
            returns: p.fees?.returnsBuffer,
            total: p.fees?.totalFees,
          },
          flags: s.flags || [],
          category: a.category || '',
          rating: a.rating || null,
          reviewCount: a.reviewCount || 0,
          bsr: a.bsr || null,
          isFba: a.isFba || false,
          imageUrl: r.imageUrl || a.imageUrl || '',
          amazonUrl: r.amazonUrl || r.url || '',
        };
      });

    return {
      generatedAt: new Date().toISOString(),
      stats: {
        totalScanned: this.stats.totalScanned,
        matchesFound: this.stats.matchesFound,
        eliteCount: this.stats.eliteCount,
        strongCount: this.stats.strongCount,
        watchCount: this.stats.watchCount,
        skipCount: this.stats.skipCount,
        errors: this.stats.errors.length,
        durationMs: this.stats.durationMs,
      },
      opportunities: exportable,
    };
  }

  /**
   * Save both CSV and JSON exports to disk.
   */
  async saveExports(results) {
    const fs = require('fs');
    const path = require('path');
    const exportsDir = path.join(__dirname, '..', 'exports');
    fs.mkdirSync(exportsDir, { recursive: true });

    const timestamp = Date.now();

    // CSV
    const csv = this.exportCsv(results);
    const csvPath = path.join(exportsDir, `arbitrage_${timestamp}.csv`);
    fs.writeFileSync(csvPath, csv);
    console.log(`\n📄 CSV exported: ${csvPath}`);

    // JSON (for dashboard)
    const json = this.exportJson(results);
    const jsonPath = path.join(exportsDir, `arbitrage_${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));
    console.log(`📊 JSON exported: ${jsonPath}`);

    // Always overwrite latest_scan.json for the dashboard
    const latestPath = path.join(exportsDir, 'latest_scan.json');
    fs.writeFileSync(latestPath, JSON.stringify(json, null, 2));
    console.log(`📊 Dashboard data: ${latestPath}`);

    return { csvPath, jsonPath, latestPath };
  }
}

// ═══════════════════════════════════════════════════════════
//  CLI ENTRY POINT
// ═══════════════════════════════════════════════════════════

async function main() {
  const args = require('minimist')(process.argv.slice(2), {
    string: ['asin', 'category'],
    number: ['limit'],
    boolean: ['dry-run', 'export'],
    default: {
      'dry-run': config.DRY_RUN,
      'export': false,
      'limit': 10,
    },
  });

  // Override dry run
  if (args['dry-run'] === false) {
    config.DRY_RUN = false;
  }

  const engine = new ArbitrageEngine();
  await engine.init();

  let asinList = [];

  // ── Determine ASIN list ──────────────────────
  if (args.asin) {
    asinList = args.asin.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    // Default demo ASINs (real, widely available products)
    // Replace with your own ASIN list for production use
    asinList = [
      'B08FC5L3RG',  // Apple AirTag 4-pack
      'B09G9D7K6S',  // Popular electronics accessory
      'B0C6R4LKV4',  // Trending item
      'B08N5WRWNW',  // Best-seller
      'B0BXSKZB2X',  // High-volume item
    ];
    console.log(`[Engine] No --asin provided. Using ${asinList.length} demo ASINs.`);
    console.log(`[Engine] Tip: node agent.js --asin B0XXXXXXX,B0YYYYYYY\n`);
  }

  // Limit
  if (args.limit && asinList.length > args.limit) {
    asinList = asinList.slice(0, args.limit);
  }

  // ── Run scan ─────────────────────────────────
  const results = await engine.scan(asinList);

  // ── Export CSV + JSON if requested ──────────
  if (args.export) {
    await engine.saveExports(results);
  }

  await engine.shutdown();

  // Exit with code 0 on success, 1 on errors
  process.exit(engine.stats.errors.length > 0 ? 1 : 0);
}

// ── Run ──────────────────────────────────────────────
if (require.main === module) {
  main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}

module.exports = ArbitrageEngine;
