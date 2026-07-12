/**
 * profit_calculator.js — True Profit Formula Engine
 *
 * Replaces: estimatedEbayPrice = amazonPrice * 1.6
 * With:     estimatedEbayPrice = averageSoldPriceOnEbay
 *
 * Full fee breakdown:
 *   eBay Final Value Fee:      13.25% + $0.40
 *   eBay Store Listing Fee:    $0.30 (if applicable)
 *   Managed Payments / PayPal: 2.9%  + $0.30
 *   Shipping Cost:             Weight-based or actual
 *   Packaging Materials:       $1.00/item estimated
 *   Returns Buffer:            3% of gross revenue
 */

const config = require('./config');

class ProfitCalculator {
  /**
   * Calculate true net profit and ROI using REAL eBay sold data.
   *
   * @param {Object} params
   * @param {number} params.amazonPrice      — Amazon purchase price
   * @param {number} params.ebaySoldPrice    — Average sold price on eBay
   * @param {number} [params.shippingCollected] — Shipping paid by buyer (default: 0)
   * @param {number} [params.actualShippingCost] — Your cost to ship
   * @param {number} [params.weightLbs]       — Item weight for shipping estimate
   * @param {boolean}[params.isStore]         — Has eBay store subscription?
   * @param {number} [params.packagingCost]   — Override packaging estimate
   * @param {string} [params.ebayCategory]    — Category for FVF lookup
   * @returns {Object} Complete fee and profit breakdown
   */
  calculate({
    amazonPrice,
    ebaySoldPrice,
    shippingCollected = 0,
    actualShippingCost = null,
    weightLbs = null,
    isStore = false,
    packagingCost = null,
    ebayCategory = 'default',
  }) {
    // ── Guard ─────────────────────────────────────
    if (!amazonPrice || !ebaySoldPrice) {
      return { valid: false, error: 'Missing amazonPrice or ebaySoldPrice' };
    }

    // ── 1. Revenue ────────────────────────────────
    const grossRevenue = ebaySoldPrice + shippingCollected;

    // ── 2. eBay Fees ──────────────────────────────
    const ebayFvfRate = this._getCategoryFvfRate(ebayCategory);
    const ebayFvf = (ebaySoldPrice * ebayFvfRate) + config.EBAY_FVF_FIXED;
    const storeFee = isStore ? config.EBAY_STORE_FEE : 0;

    // ── 3. Payment Processing ─────────────────────
    const paymentFee = (grossRevenue * config.PAYMENT_RATE) + config.PAYMENT_FIXED;

    // ── 4. Shipping Cost ──────────────────────────
    const shippingCost = actualShippingCost !== null
      ? actualShippingCost
      : this._estimateShipping(weightLbs);

    // ── 5. Packaging ──────────────────────────────
    const packaging = packagingCost !== null
      ? packagingCost
      : config.PACKAGING_COST;

    // ── 6. Source Cost ────────────────────────────
    const amazonCost = amazonPrice; // + tax calculated separately if needed

    // ── 7. Returns Buffer ─────────────────────────
    const returnsBuffer = grossRevenue * config.RETURNS_BUFFER;

    // ── 8. Total Costs ────────────────────────────
    const totalFees = ebayFvf + storeFee + paymentFee + shippingCost + packaging + returnsBuffer;
    const totalCost = amazonCost + totalFees;

    // ── 9. Net Profit ─────────────────────────────
    const netProfit = grossRevenue - totalCost;

    // ── 10. ROI ───────────────────────────────────
    const roiPct = amazonCost > 0
      ? (netProfit / amazonCost) * 100
      : 0;

    // ── 11. Break-even price ──────────────────────
    const breakEvenPrice = amazonCost + totalFees - shippingCollected;

    return {
      valid: true,
      revenue: {
        ebaySoldPrice,
        shippingCollected,
        grossRevenue,
      },
      fees: {
        ebayFvfRate,
        ebayFvf: parseFloat(ebayFvf.toFixed(2)),
        storeFee: parseFloat(storeFee.toFixed(2)),
        paymentFee: parseFloat(paymentFee.toFixed(2)),
        shippingCost: parseFloat(shippingCost.toFixed(2)),
        packaging: parseFloat(packaging.toFixed(2)),
        returnsBuffer: parseFloat(returnsBuffer.toFixed(2)),
        totalFees: parseFloat(totalFees.toFixed(2)),
      },
      costs: {
        amazonCost: parseFloat(amazonCost.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2)),
      },
      profit: {
        netProfit: parseFloat(netProfit.toFixed(2)),
        roiPct: parseFloat(roiPct.toFixed(2)),
        breakEvenPrice: parseFloat(breakEvenPrice.toFixed(2)),
        isProfitable: netProfit > 0,
      },
    };
  }

  /**
   * Quick batch calculation for an array of opportunities.
   */
  batchCalculate(opportunities) {
    return opportunities.map(opp => ({
      ...opp,
      calc: this.calculate({
        amazonPrice: opp.amazonPrice,
        ebaySoldPrice: opp.ebaySoldPrice,
        weightLbs: opp.weightLbs,
        shippingCollected: opp.shippingCollected || 0,
        actualShippingCost: opp.actualShippingCost || null,
      }),
    }));
  }

  // ── Private: Category-specific FVF rates ─────────────
  _getCategoryFvfRate(category) {
    const rates = {
      default:                   0.1325,  // Most categories
      'Books':                   0.1495,  // 14.95%
      'Movies & TV':             0.1495,
      'Music':                   0.1495,
      'Coins & Paper Money':     0.1325,
      'Trading Cards':           0.1325,
      'Jewelry & Watches':       0.1500,  // 15% up to $5k
      'Art':                     0.1325,
      'Fashion':                 0.1325,
      'Electronics':             0.1325,
      'Musical Instruments':     0.0735,  // 7.35% for guitars ≥ $2k
    };

    // Partial match on category string
    const key = Object.keys(rates).find(k =>
      category && category.toLowerCase().includes(k.toLowerCase())
    );

    return key ? rates[key] : rates.default;
  }

  // ── Private: Shipping cost estimator ─────────────────
  _estimateShipping(weightLbs) {
    if (!weightLbs || weightLbs <= 0) return 7.00;  // default flat estimate

    if (weightLbs <= 1)     return 5.00;
    if (weightLbs <= 2)     return 7.50;
    if (weightLbs <= 5)     return 12.00;
    if (weightLbs <= 10)    return 18.00;
    if (weightLbs <= 20)    return 28.00;
    return 45.00; // Freight estimate for heavy items
  }

  /**
   * Format a profit calculation for display.
   */
  formatForDisplay(calc) {
    if (!calc.valid) return '⚠️ Calculation not available';

    const emoji = calc.profit.isProfitable ? '✅' : '❌';
    return [
      `${emoji} Net Profit: $${calc.profit.netProfit} | ROI: ${calc.profit.roiPct}%`,
      `   Revenue: $${calc.revenue.grossRevenue} (sold $${calc.revenue.ebaySoldPrice})`,
      `   Fees: $${calc.fees.totalFees} (eBay $${calc.fees.ebayFvf} + MP $${calc.fees.paymentFee} + Ship $${calc.fees.shippingCost})`,
      `   Cost: $${calc.costs.totalCost} | Break-even: $${calc.profit.breakEvenPrice}`,
    ].join('\n');
  }
}

module.exports = ProfitCalculator;
