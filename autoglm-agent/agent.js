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

const config = require('./config');
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
    this.context = null;
    this.amazonScraper = null;
    this.ebayScraper = null;
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

    // Launch Playwright with anti-detection
    console.log('[Browser] Launching Playwright (stealth mode)...');
    this.browser = await chromium.launch({
      headless: config.ENV === 'production',   // Show browser in dev
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-size=1920,1080',
      ],
    });

    this.context = await this.browser.newContext({
      userAgent: this._randomUA(),
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });

    // Inject stealth scripts
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    const page = await this.context.newPage();
    this.amazonScraper = new AmazonScraper(page);
    this.ebayScraper = new EbayScraper(page);

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

      // ── Rate limiting between products ────────
      await this._delay(2000, 4000);
    }

    this.stats.durationMs = Date.now() - this.stats.startTime;

    // Sort by score descending
    results.sort((a, b) => b.scoring.score - a.scoring.score);

    await this._finalize(results);
    return results;
  }

  /**
   * Process a single product through the full pipeline.
   */
  async _processProduct(asin) {
    // ════ PHASE 1: Amazon scrape ════════════════
    console.log(`  🔍 Phase 1/4: Scraping Amazon...`);
    const amazonData = await this.amazonScraper.scrapeByAsin(asin);
    this.stats.totalScanned++;

    if (amazonData.isCaptcha) {
      console.log('  ⚠️ Amazon CAPTCHA detected — skipping');
      return this._failedResult(asin, 'AMAZON_CAPTCHA');
    }

    if (!amazonData.title) {
      console.log('  ⚠️ No product title extracted — product page may be inaccessible');
      return this._failedResult(asin, 'NO_AMAZON_DATA');
    }

    console.log(`  ✅ Amazon: "${amazonData.title.substring(0, 50)}..." — $${amazonData.price}`);

    // Save to Firebase
    await this.firebase.upsertProduct(amazonData);
    await this.firebase.recordPriceSnapshot('amazon', {
      asin,
      price: amazonData.price,
      listPrice: amazonData.listPrice,
    });

    // ════ PHASE 2: eBay market scan ════════════
    console.log(`  🔍 Phase 2/4: Searching eBay market data...`);

    let ebayData;
    const useRealEbay = !config.DRY_RUN;

    if (useRealEbay) {
      ebayData = await this.ebayScraper.fullMarketScan(
        amazonData.title,
        amazonData.upc || amazonData.ean || amazonData.isbn
      );

      if (ebayData.captchaBlocked) {
        console.log('  ⚠️ eBay CAPTCHA blocked — falling back to simulator');
        ebayData = this.simulator.simulate(amazonData);
      }
    } else {
      // Dev mode: use simulator
      ebayData = this.simulator.simulate(amazonData);
    }

    // eBay price snapshot
    if (ebayData.avgSoldPrice) {
      await this.firebase.recordPriceSnapshot('ebay', {
        asin,
        price: ebayData.avgSoldPrice,
        shippingCost: ebayData.shippingCostAvg || 0,
      });
    }

    if (!ebayData.found || !ebayData.avgSoldPrice) {
      console.log('  ℹ️ No eBay market data available — skipping');
      return this._failedResult(asin, 'NO_EBAY_DATA');
    }

    console.log(`  ✅ eBay: Avg Sold $${ebayData.avgSoldPrice} | Median $${ebayData.medianSoldPrice} | ${ebayData.monthlyVolume} sold/mo | ${ebayData.activeListings} active`);

    // ════ PHASE 3: Match + Profit ══════════════
    console.log(`  🔍 Phase 3/4: Matching & calculating profit...`);

    const match = this.matcher.match(amazonData, ebayData);
    if (!match.matched) {
      console.log(`  ⚠️ No match (best fuzzy score: ${match.bestFuzzyScore || 0}%)`);
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

  async _delay(minMs, maxMs) {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  _randomUA() {
    const ua = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    ];
    return ua[Math.floor(Math.random() * ua.length)];
  }

  // ═══════════════════════════════════════════════════════
  //  EXPORT TO CSV
  // ═══════════════════════════════════════════════════════

  exportCsv(results) {
    const headers = [
      'ASIN', 'Title', 'AmazonPrice', 'eBayAvgSold', 'NetProfit',
      'ROI%', 'Score', 'Tier', 'MonthlySales', 'ActiveListings',
      'MatchMethod', 'MatchConfidence',
    ];
    const rows = results
      .filter(r => r.found !== false)
      .map(r => [
        r.asin,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        r.amazonPrice,
        r.ebayAvgSoldPrice,
        r.netProfit,
        r.roiPct,
        r.compositeScore,
        r.scoring?.tier || r.tier,
        r.ebayMonthlyVolume,
        r.ebayActiveListings,
        r.matchMethod,
        r.matchConfidence,
      ].join(','));

    return [headers.join(',')].concat(rows).join('\n');
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

  // ── Export CSV if requested ──────────────────
  if (args.export) {
    const csv = engine.exportCsv(results);
    const fs = require('fs');
    const path = require('path');
    const outPath = path.join(__dirname, '..', 'exports', `arbitrage_${Date.now()}.csv`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, csv);
    console.log(`\n📄 CSV exported to: ${outPath}`);
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
