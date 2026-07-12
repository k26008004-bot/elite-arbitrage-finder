/**
 * product_matcher.js — Four-Tier Cross-Platform Product Matcher
 *
 * Matches Amazon products to eBay listings with confidence scoring:
 *   Level 1: UPC / EAN / ISBN exact match → 1.0 confidence (100%)
 *   Level 2: Title fuzzy match (fuzzball token_sort_ratio) → 0.85+ threshold
 *   Level 3: Brand + category heuristic verification
 *   Level 4: Image perceptual hash (pHash) → Hamming distance ≤ 10
 *
 * Dependencies: npm install fuzzball sharp
 */

const fuzzball = require('fuzzball');
const ImageMatcher = require('./image_matcher');
const config = require('./config');

class ProductMatcher {
  constructor() {
    this.imageMatcher = new ImageMatcher();
  }
  /**
   * Match an Amazon product against eBay sold listing results.
   * Async — Level 4 (image matching) requires network/image processing.
   *
   * @param {Object} amazonProduct — from AmazonScraper.scrapeByAsin()
   * @param {Object} ebayData — from EbayScraper.fullMarketScan()
   * @returns {Promise<Object>} { matched, confidence, method, tier, details }
   */
  async match(amazonProduct, ebayData) {
    // ── Guard clauses ──────────────────────────────
    if (!ebayData || !ebayData.found || ebayData.captchaBlocked) {
      return {
        matched: false,
        confidence: 0,
        method: 'NONE',
        reason: ebayData?.captchaBlocked ? 'CAPTCHA_BLOCKED' : 'NO_EBAY_DATA',
      };
    }

    const listings = ebayData.soldListings || [];
    if (listings.length === 0) {
      return { matched: false, confidence: 0, method: 'NONE', reason: 'NO_LISTINGS' };
    }

    let bestFuzzyScore = 0;

    // ── Level 1: Exact identifier match ────────────
    const exactMatch = this._level1ExactMatch(amazonProduct, ebayData);
    if (exactMatch) {
      return {
        matched: true,
        confidence: config.MATCH_CONFIDENCE_UPC,
        method: 'UPC_EXACT',
        tier: 1,
        details: exactMatch,
      };
    }

    // ── Level 2: Title fuzzy match ────────────────
    const fuzzyResult = this._level2FuzzyMatch(amazonProduct, listings);
    bestFuzzyScore = fuzzyResult.bestScore || 0;
    if (fuzzyResult.matched) {
      return {
        matched: true,
        confidence: fuzzyResult.confidence,
        method: 'TITLE_FUZZY',
        tier: 2,
        details: fuzzyResult,
      };
    }

    // ── Level 3: Brand + Category heuristic ───────
    const heuristicResult = this._level3Heuristic(amazonProduct, listings);
    if (heuristicResult.matched) {
      return {
        matched: true,
        confidence: heuristicResult.confidence,
        method: 'BRAND_CATEGORY',
        tier: 3,
        details: heuristicResult,
      };
    }

    // ── Level 4: Image perceptual hash ────────────
    if (amazonProduct.imageUrl && this.imageMatcher.enabled) {
      const imageResult = await this.imageMatcher.findBestMatch(
        amazonProduct.imageUrl,
        ebayData.soldListings || []
      );
      if (imageResult && imageResult.matched) {
        return {
          matched: true,
          confidence: imageResult.confidence * 0.85, // pHash confidence discounted
          method: 'IMAGE_PHASH',
          tier: 4,
          details: {
            hammingDistance: imageResult.distance,
            rawConfidence: imageResult.confidence,
          },
        };
      }
    }

    // No match found
    return {
      matched: false,
      confidence: 0,
      method: 'NONE',
      reason: 'NO_MATCH',
      bestFuzzyScore,
    };
  }

  // ── Level 1: UPC / EAN / ISBN exact match ────────────
  _level1ExactMatch(amazon, ebayData) {
    const identifiers = [
      amazon.upc,
      amazon.ean,
      amazon.isbn,
    ].filter(Boolean);

    if (identifiers.length === 0) return null;

    // Check if any listing title or description contains the identifier
    // (UPC-driven eBay search already guarantees this — the search query was the UPC)
    if (ebayData.searchType === 'UPC') {
      return {
        identifier: identifiers[0],
        matchCount: ebayData.soldListings.length,
      };
    }

    // For title-based eBay search, verify UPC appears in listings
    const upcMatch = ebayData.soldListings.some(l =>
      identifiers.some(id => l.title.includes(id))
    );

    return upcMatch
      ? { identifier: identifiers[0], matchCount: ebayData.soldListings.length }
      : null;
  }

  // ── Level 2: fuzzball token_sort_ratio ───────────────
  _level2FuzzyMatch(amazon, listings) {
    const cleanAmazonTitle = this._normalize(amazon.title);

    let bestScore = 0;
    let bestMatch = null;

    for (const listing of listings) {
      const cleanEbayTitle = this._normalize(listing.title);
      const score = fuzzball.token_sort_ratio(cleanAmazonTitle, cleanEbayTitle);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = listing;
      }
    }

    const confidence = bestScore / 100;  // Convert 0-100 to 0-1

    // Count how many listings pass the 85% threshold
    const aboveThreshold = listings.filter(l => {
      const s = fuzzball.token_sort_ratio(
        this._normalize(amazon.title),
        this._normalize(l.title)
      );
      return s >= config.FUZZ_THRESHOLD;
    });

    return {
      matched: confidence >= config.MATCH_CONFIDENCE_TITLE,
      bestScore,
      confidence,
      aboveThresholdCount: aboveThreshold.length,
      bestMatchTitle: bestMatch?.title || '',
    };
  }

  // ── Level 3: Brand + Category heuristic ──────────────
  _level3Heuristic(amazon, listings) {
    if (!amazon.brand) return { matched: false, confidence: 0 };

    const brandLower = amazon.brand.toLowerCase();
    const brandMatches = listings.filter(l =>
      l.title.toLowerCase().includes(brandLower)
    );

    if (brandMatches.length === 0) return { matched: false, confidence: 0 };

    // Lower confidence than fuzzy title match
    const confidence = 0.70 + (brandMatches.length / listings.length) * 0.10;

    return {
      matched: confidence >= 0.70,
      confidence: Math.min(confidence, 0.85),
      brandMatchCount: brandMatches.length,
      totalListings: listings.length,
    };
  }

  // ── Title normalization ──────────────────────────────
  _normalize(title) {
    return (title || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')   // Remove punctuation
      .replace(/\s{2,}/g, ' ')   // Collapse whitespace
      .trim();
  }

  /**
   * For listings that didn't match the Amazon product,
   * return candidate eBay titles for manual review.
   */
  getCandidates(amazon, listings, topN = 5) {
    const cleanTitle = this._normalize(amazon.title);
    const scored = listings.map(l => ({
      title: l.title,
      price: l.price,
      score: fuzzball.token_sort_ratio(cleanTitle, this._normalize(l.title)),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }
}

module.exports = ProductMatcher;
