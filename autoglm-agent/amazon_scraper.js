/**
 * amazon_scraper.js — Playwright Amazon Product Detail Scraper
 *
 * Navigates to an Amazon product page (by ASIN or URL) and extracts:
 *   title, price, list price, rating, review count, BSR, UPC/EAN,
 *   item weight, dimensions, category, brand, FBA status, availability.
 */

const config = require('./config');

class AmazonScraper {
  constructor(page) {
    this.page = page;
    this.selectors = config.AMAZON_SELECTORS;
  }

  /**
   * Scrape a single Amazon product by ASIN.
   * @param {string} asin — Amazon Standard Identification Number
   * @returns {Object} extracted product data
   */
  async scrapeByAsin(asin) {
    const url = `https://www.amazon.com/dp/${asin}`;
    return this._scrape(url, asin);
  }

  /**
   * Scrape a single Amazon product by full URL.
   * @param {string} url
   * @returns {Object} extracted product data
   */
  async scrapeByUrl(url) {
    const asin = this._extractAsin(url);
    return this._scrape(url, asin);
  }

  // ── Private: Core scrape logic ───────────────────────
  async _scrape(url, asin) {
    console.log(`  [Amazon] Navigating to: ${asin || url}`);

    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for the key element to appear
    try {
      await this.page.waitForSelector(this.selectors.TITLE, { timeout: 15000 });
    } catch {
      // Could be a CAPTCHA page or a page that requires JS rendering
      await this.page.waitForTimeout(3000);
    }

    const data = await this.page.evaluate((sel) => {
      const safeText = (selector, fallback = null) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : fallback;
      };

      const safeAttr = (selector, attr, fallback = null) => {
        const el = document.querySelector(selector);
        return el ? el.getAttribute(attr) : fallback;
      };

      // ── Price extraction ──────────────────────────
      const priceEl = document.querySelector('.a-price .a-offscreen');
      const price = priceEl
        ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, ''))
        : null;

      const listPriceEl = document.querySelector(
        '.basisPrice .a-offscreen, .a-text-price span.a-offscreen'
      );
      const listPrice = listPriceEl
        ? parseFloat(listPriceEl.textContent.replace(/[^0-9.]/g, ''))
        : null;

      // ── Rating ────────────────────────────────────
      const ratingEl = document.querySelector(
        '#acrPopover .a-icon-alt, #averageCustomerReviews .a-icon-alt'
      );
      const rating = ratingEl
        ? parseFloat(ratingEl.textContent.match(/[\d.]+/)?.[0] || '0')
        : null;

      // ── Review count ──────────────────────────────
      const reviewText = safeText('#acrCustomerReviewText', '');
      const reviewCount = parseInt((reviewText.match(/[\d,]+/) || ['0'])[0].replace(/,/g, ''), 10) || 0;

      // ── BSR (Best Seller Rank) ────────────────────
      const detailsTable = safeText(
        '#productDetails_detailBullets_sections1, #detailBulletsWrapper_feature_div',
        ''
      );
      const bsrMatch = detailsTable.match(/Best Sellers Rank[:\s]*#([\d,]+)/);
      const bsr = bsrMatch ? parseInt(bsrMatch[1].replace(/,/g, ''), 10) : null;

      // ── UPC / EAN ─────────────────────────────────
      const upcMatch = detailsTable.match(/(?:UPC|Universal Product Code)[:\s]*(\d+)/i);
      const eanMatch = detailsTable.match(/(?:EAN|European Article Number)[:\s]*(\d+)/i);
      const isbnMatch = detailsTable.match(/(?:ISBN-10|ISBN-13)[:\s]*([\d-]+)/i);
      const upc = upcMatch ? upcMatch[1] : null;
      const ean = eanMatch ? eanMatch[1] : null;
      const isbn = isbnMatch ? isbnMatch[1].replace(/-/g, '') : null;

      // ── Weight & Dimensions ───────────────────────
      const weightMatch = detailsTable.match(
        /(?:Item Weight|Product Weight)[:\s]*([\d.]+)\s*(pounds|lbs|ounces|oz)/i
      );
      let weightLbs = null;
      if (weightMatch) {
        const w = parseFloat(weightMatch[1]);
        weightLbs = weightMatch[2].toLowerCase().startsWith('o')
          ? w / 16  // ounces → lbs
          : w;
      }

      const dimMatch = detailsTable.match(
        /(?:Product Dimensions|Item Dimensions)[:\s]*([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s*inches/i
      );
      const dimensions = dimMatch
        ? `${dimMatch[1]}x${dimMatch[2]}x${dimMatch[3]} in`
        : null;

      // ── Category ──────────────────────────────────
      const breadcrumbs = [...document.querySelectorAll(
        '#wayfinding-breadcrumbs_feature_div li a, #wayfinding-breadcrumbs_container li a'
      )];
      const category = breadcrumbs.map(el => el.textContent.trim()).join(' > ') || null;

      // ── Brand ─────────────────────────────────────
      const brand = safeText('#bylineInfo', null);

      // ── FBA Detection ─────────────────────────────
      const merchantText = safeText('#merchant-info', '');
      const isFba = /fulfilled by amazon|sold by amazon/i.test(merchantText)
        || !!document.querySelector('#fulfillerInfoFeature_feature_div')
        || !!document.querySelector('#SSOFpopoverLink');

      // ── Availability ──────────────────────────────
      const availabilityText = safeText('#availability span', '');
      const inStock = !availabilityText.includes('unavailable')
        && !availabilityText.includes('out of stock');

      // ── Image ─────────────────────────────────────
      const imageUrl = safeAttr('#landingImage', 'src', null)
        || safeAttr('#imgTagWrapperId img', 'src', null);

      return {
        title: safeText('#productTitle', ''),
        price,
        listPrice,
        rating,
        reviewCount,
        bsr,
        upc,
        ean,
        isbn,
        weightLbs,
        dimensions,
        category: category || safeText('#nav-subnav .nav-a', ''),
        brand,
        isFba,
        inStock,
        imageUrl,
        isCaptcha: document.title.includes('Robot Check')
          || !!document.querySelector('form[action*="validateCaptcha"]'),
      };
    }, this.selectors);

    data.asin = asin;
    data.scrapedAt = new Date().toISOString();
    data.url = url;

    return data;
  }

  // ── Helper: Extract ASIN from URL ────────────────────
  _extractAsin(url) {
    const match = url.match(/\/(?:dp|gp\/product|ASIN)\/([A-Z0-9]{10})/i);
    return match ? match[1] : null;
  }
}

module.exports = AmazonScraper;
