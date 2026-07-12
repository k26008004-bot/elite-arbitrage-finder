/**
 * ebay_scraper.js — Playwright eBay Sold/Active Listings Scraper
 *
 * Navigates to eBay sold+completed listings page and extracts:
 *   - Individual sold prices and dates
 *   - Average and median sold price
 *   - Active listing count (competition analysis)
 *   - UPC/EAN from item specifics (for exact match verification)
 *   - Seller metrics (top competitor feedback score)
 *   - Shipping costs and item condition
 *
 * Search strategy:
 *   1. UPC search: eBay.com/sch/i.html?_nkw={UPC}&LH_Sold=1&LH_Complete=1
 *   2. Title search: eBay.com/sch/i.html?_nkw={encoded_title}&LH_Sold=1&LH_Complete=1
 */

const config = require('./config');

class EbayScraper {
  constructor(page) {
    this.page = page;
    this.sel = config.EBAY_SELECTORS;
  }

  /**
   * Search eBay sold listings by UPC (exact match).
   */
  async searchByUpc(upc) {
    const query = encodeURIComponent(upc);
    const url = `${config.EBAY_SEARCH_URL}?_nkw=${query}&${config.EBAY_SEARCH_PARAMS_SOLD}`;
    return this._scrapeMarketData(url, 'UPC');
  }

  /**
   * Search eBay sold listings by product title (fuzzy match fallback).
   */
  async searchByTitle(title) {
    // Clean title: remove common Amazon noise, keep core product name
    const cleaned = this._cleanTitle(title);
    const query = encodeURIComponent(cleaned);
    const url = `${config.EBAY_SEARCH_URL}?_nkw=${query}&${config.EBAY_SEARCH_PARAMS_SOLD}`;
    return this._scrapeMarketData(url, 'TITLE');
  }

  /**
   * Search active (current) listings to measure competition.
   */
  async searchActive(upcOrTitle) {
    const query = encodeURIComponent(upcOrTitle);
    const url = `${config.EBAY_SEARCH_URL}?_nkw=${query}`;
    return this._scrapeActiveData(url);
  }

  // ── Private: Core sold-listings scrape ────────────────
  async _scrapeMarketData(url, searchType) {
    console.log(`  [eBay] Searching sold listings (${searchType})...`);

    try {
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait for results or empty state
      await this.page.waitForTimeout(2000);

      const data = await this.page.evaluate((sel) => {
        const items = [...document.querySelectorAll(sel.SOLD_ITEMS)];

        // Check for CAPTCHA
        const isCaptcha = document.title.includes('Security Measure')
          || document.title.includes('robot')
          || !!document.querySelector('#captcha_center, [data-testid="captcha"]');

        if (isCaptcha) {
          return { captchaBlocked: true, soldListings: [], totalResults: 0 };
        }

        // Check if no results
        const noResults = !!document.querySelector('.srp-save-null-search__heading')
          || items.length === 0;
        if (noResults) {
          return { soldListings: [], totalResults: 0, noResults: true };
        }

        // Parse total result count
        const countEl = document.querySelector('.srp-controls__count-heading, h1.srp-controls__count-heading');
        let totalResults = 0;
        if (countEl) {
          const match = countEl.textContent.match(/[\d,]+/);
          totalResults = match ? parseInt(match[0].replace(/,/g, ''), 10) : items.length;
        } else {
          totalResults = items.length;
        }

        // ── Extract each sold listing ────────────
        const soldListings = [];
        for (const item of items) {
          // Skip header / ad rows
          if (
            item.classList.contains('s-item--watch-at-corner')
            || item.querySelector('.s-item__sep')
            || item.querySelector('[data-view="mi:1686|iid:1"]')
          ) {
            continue;
          }

          const priceEl = item.querySelector('.s-item__price');
          const priceText = priceEl ? priceEl.textContent.trim() : '';
          // Handle price ranges: "$14.99 to $24.99" — take the lower
          const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
          const price = priceMatch
            ? parseFloat(priceMatch[1].replace(/,/g, ''))
            : null;

          const shippingEl = item.querySelector('.s-item__shipping, .s-item__logisticsCost');
          let shipping = 0;
          if (shippingEl) {
            const shipText = shippingEl.textContent.trim();
            if (/free/i.test(shipText)) {
              shipping = 0;
            } else {
              const shipMatch = shipText.match(/\$?([\d,]+\.?\d*)/);
              shipping = shipMatch ? parseFloat(shipMatch[1].replace(/,/g, '')) : 0;
            }
          }

          const titleEl = item.querySelector('.s-item__title');
          const title = titleEl ? titleEl.textContent.trim() : '';

          const subtitleEl = item.querySelector('.s-item__subtitle, .SECONDARY_INFO');
          const conditionText = subtitleEl ? subtitleEl.textContent.trim() : 'Unknown';
          let condition = 'Unknown';
          if (/brand new|new\b/i.test(conditionText)) condition = 'New';
          else if (/used/i.test(conditionText)) condition = 'Used';
          else if (/refurbished/i.test(conditionText)) condition = 'Refurbished';
          else if (/open box/i.test(conditionText)) condition = 'Open Box';

          // Date sold
          const dateEl = item.querySelector(
            '.s-item__title--tagblock .POSITIVE, .s-item__caption--signal'
          );
          const dateText = dateEl ? dateEl.textContent.trim() : '';

          // Listing format
          const formatEl = item.querySelector('.s-item__format, .s-item__purchaseOptions');
          const format = formatEl
            ? formatEl.textContent.trim()
            : 'Unknown';

          // Seller feedback
          const sellerEl = item.querySelector('.s-item__seller-info-text');
          const sellerFeedback = sellerEl
            ? parseInt((sellerEl.textContent.match(/[\d,]+/) || ['0'])[0].replace(/,/g, ''), 10) || 0
            : 0;

          // Item link for deep-dive UPC extraction
          const linkEl = item.querySelector('.s-item__link');
          const itemUrl = linkEl ? linkEl.href : null;

          if (price) {
            soldListings.push({
              title,
              price,
              shipping,
              condition,
              dateText,
              format,
              sellerFeedback,
              itemUrl,
            });
          }
        }

        return { soldListings, totalResults, captchaBlocked: false };
      }, this.sel);

      return this._processResults(data, searchType);
    } catch (err) {
      console.error(`  [eBay] Scrape error: ${err.message}`);
      return {
        found: false,
        error: err.message,
        soldListings: [],
        captchaBlocked: err.message.includes('captcha') || err.message.includes('block'),
      };
    }
  }

  // ── Process & Aggregate ──────────────────────────────
  _processResults(raw, searchType) {
    const { soldListings, totalResults, captchaBlocked, noResults } = raw;

    if (captchaBlocked) {
      return {
        found: false,
        captchaBlocked: true,
        soldListings: [],
        avgSoldPrice: null,
        monthlyVolume: 0,
      };
    }

    if (noResults || soldListings.length === 0) {
      return {
        found: false,
        soldListings: [],
        avgSoldPrice: null,
        medianSoldPrice: null,
        monthlyVolume: 0,
        totalResults: 0,
      };
    }

    // ── Price statistics ────────────────────────
    const prices = soldListings.map(l => l.price).sort((a, b) => a - b);
    const n = prices.length;
    const avg = parseFloat((prices.reduce((a, b) => a + b, 0) / n).toFixed(2));
    const median = n % 2 === 0
      ? parseFloat(((prices[n / 2 - 1] + prices[n / 2]) / 2).toFixed(2))
      : prices[Math.floor(n / 2)];
    const min = prices[0];
    const max = prices[n - 1];

    // ── Shipping ────────────────────────────────
    const shippingCosts = soldListings.map(l => l.shipping);
    const avgShipping = parseFloat(
      (shippingCosts.reduce((a, b) => a + b, 0) / n).toFixed(2)
    );
    const freeShippingPct = parseFloat(
      ((shippingCosts.filter(s => s === 0).length / n) * 100).toFixed(1)
    );

    // ── Condition breakdown ─────────────────────
    const conditions = {};
    soldListings.forEach(l => {
      conditions[l.condition] = (conditions[l.condition] || 0) + 1;
    });

    // ── Top seller ──────────────────────────────
    const topSeller = soldListings.reduce(
      (best, curr) => (curr.sellerFeedback > best.sellerFeedback ? curr : best),
      soldListings[0]
    );

    return {
      found: true,
      searchType,
      soldListings,
      totalResults,
      avgSoldPrice: avg,
      medianSoldPrice: median,
      minSoldPrice: min,
      maxSoldPrice: max,
      monthlyVolume: n,                // Number of sold items found in search
      priceRange: { min, max },
      shippingCostAvg: avgShipping,
      shippingFreePct: freeShippingPct,
      conditionBreakdown: conditions,
      topSellerFeedback: topSeller?.sellerFeedback || 0,
    };
  }

  // ── Private: Active listings (competition check) ─────
  async _scrapeActiveData(url) {
    try {
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 25000,
      });
      await this.page.waitForTimeout(1500);

      const data = await this.page.evaluate(() => {
        const countEl = document.querySelector(
          '.srp-controls__count-heading, h1.srp-controls__count-heading'
        );
        let activeCount = 0;
        if (countEl) {
          const match = countEl.textContent.match(/[\d,]+/);
          activeCount = match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
        }

        // Count visible listings as fallback
        if (activeCount === 0) {
          activeCount = document.querySelectorAll('.s-item:not(.s-item--watch-at-corner)').length;
        }

        return { activeListings: activeCount };
      });

      return data;
    } catch (err) {
      console.error(`  [eBay] Active search error: ${err.message}`);
      return { activeListings: 0 };
    }
  }

  /**
   * Full market scan: sold prices + active competition in one pass.
   */
  async fullMarketScan(title, upc = null) {
    // Step 1: Try UPC search first (exact match)
    let soldData = null;
    if (upc) {
      soldData = await this.searchByUpc(upc);
    }

    // Step 2: UPC failed or not provided → title search
    if (!soldData || !soldData.found) {
      soldData = await this.searchByTitle(title);
    }

    // Step 3: Get active listings for competition score
    const searchQuery = upc || this._cleanTitle(title);
    const activeData = await this.searchActive(searchQuery);

    return {
      ...soldData,
      activeListings: activeData.activeListings || 0,
    };
  }

  // ── Title cleaning for eBay search ───────────────────
  _cleanTitle(title) {
    // Remove Amazon-specific noise: ASIN, "pack of X", variant info in parens
    return title
      .replace(/\b[B0][A-Z0-9]{9}\b/g, '')            // Remove ASIN
      .replace(/\([^)]*(?:pack|color|size|style)[^)]*\)/gi, '') // Remove variant parens
      .replace(/\b\d+\s*(pack|count|set|pieces)\b/gi, '')       // Remove pack size
      .replace(/\s{2,}/g, ' ')                                   // Collapse spaces
      .trim()
      .substring(0, 200); // eBay search limit
  }
}

module.exports = EbayScraper;
