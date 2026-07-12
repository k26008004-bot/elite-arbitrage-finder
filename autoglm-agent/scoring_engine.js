/**
 * scoring_engine.js — Elite Multi-Factor Scoring Engine (0–100)
 *
 * Implements the exact algorithm from the master architecture:
 *   Profit Margin   (40 pts) — ROI-driven, maxed at 30% ROI
 *   Sales Velocity  (30 pts) — eBay monthly sold volume
 *   Competition     (15 pts) — Active listing count (inverse)
 *   Risk Assessment (15 pts) — Deductions for Amazon rating, gating, volatility
 *
 * Tier Classification:
 *   🥇 Elite  85–100 → Buy immediately, high volume
 *   🥈 Strong 70–84  → Buy, moderate volume
 *   🥉 Watch  50–69  → Monitor, small test buy
 *   ⬛ Skip    0–49  → Pass
 */

const config = require('./config');

class ScoringEngine {
  /**
   * Score an arbitrage opportunity on a 0–100 scale.
   *
   * @param {Object} params
   * @param {Object} params.amazon    — Amazon product data
   * @param {Object} params.ebay      — eBay market data
   * @param {Object} params.profit    — ProfitCalculator result
   * @param {Object} [params.riskFlags] — Additional risk flags
   * @returns {Object} { score, tier, breakdown, flags }
   */
  score({ amazon, ebay, profit, riskFlags = {} }) {
    if (!profit || !profit.valid) {
      return {
        score: 0,
        tier: 'Skip',
        tierEmoji: '⬛',
        breakdown: {},
        flags: ['INVALID_PROFIT_DATA'],
      };
    }

    // ── 1. Profit Margin Score (40 pts) ────────────
    const marginScore = this._scoreMargin(profit.profit.roiPct);

    // ── 2. Sales Velocity Score (30 pts) ───────────
    const velocityScore = this._scoreVelocity(ebay?.monthlyVolume || 0);

    // ── 3. Competition Score (15 pts, inverse) ─────
    const competitionScore = this._scoreCompetition(ebay?.activeListings || 9999);

    // ── 4. Risk Score (15 pts, deductions) ─────────
    const riskResult = this._scoreRisk(amazon, ebay, profit, riskFlags);
    const riskScore = riskResult.score;

    // ── Total ─────────────────────────────────────
    const total = marginScore + velocityScore + competitionScore + riskScore;

    // ── Tier classification ───────────────────────
    const tier = this._classifyTier(total);

    return {
      score: parseFloat(total.toFixed(1)),
      tier: tier.label,
      tierEmoji: tier.emoji,
      tierAction: tier.action,
      breakdown: {
        margin: { score: marginScore, weight: config.SCORE_WEIGHTS.PROFIT_MARGIN, roiPct: profit.profit.roiPct },
        velocity: { score: velocityScore, weight: config.SCORE_WEIGHTS.SALES_VELOCITY, monthlyVolume: ebay?.monthlyVolume || 0 },
        competition: { score: competitionScore, weight: config.SCORE_WEIGHTS.COMPETITION, activeListings: ebay?.activeListings || 0 },
        risk: { score: riskScore, weight: config.SCORE_WEIGHTS.RISK, deductions: riskResult.deductions },
      },
      flags: riskResult.flags,
    };
  }

  // ── Margin: Linear scale, max at 30% ROI ─────────────
  _scoreMargin(roiPct) {
    const maxRoi = 30;  // 30% ROI → full 40 points
    const weight = config.SCORE_WEIGHTS.PROFIT_MARGIN;
    if (roiPct <= 0) return 0;
    return Math.min((roiPct / maxRoi) * weight, weight);
  }

  // ── Velocity: Tiered, based on monthly sales ──────────
  _scoreVelocity(monthlyVolume) {
    const tiers = config.VELOCITY_SCORES;
    for (const tier of tiers) {
      if (monthlyVolume >= tier.minSales) {
        return tier.score;
      }
    }
    return 0;
  }

  // ── Competition: Fewer = better (inverse) ─────────────
  _scoreCompetition(activeListings) {
    const tiers = config.COMPETITION_SCORES;
    for (const tier of tiers) {
      if (activeListings <= tier.maxListings) {
        return tier.score;
      }
    }
    return 1; // Fully saturated
  }

  // ── Risk: Start at 15 and deduct ─────────────────────
  _scoreRisk(amazon, ebay, profit, riskFlags) {
    const D = config.RISK_DEDUCTIONS;
    let score = config.SCORE_WEIGHTS.RISK;
    const deductions = [];
    const flags = [];

    // 1. Low Amazon rating
    if (amazon && amazon.rating !== null && amazon.rating < D.LOW_RATING.threshold) {
      const take = Math.min(D.LOW_RATING.deduct, score);
      score -= take;
      deductions.push({ reason: 'LOW_RATING', amount: take, detail: `Rating ${amazon.rating}` });
      flags.push(`Low Amazon rating: ${amazon.rating}★`);
    }

    // 2. Gated category
    if (riskFlags.isGated || amazon?.isGated) {
      const take = Math.min(D.GATED_CATEGORY.deduct, score);
      score -= take;
      deductions.push({ reason: 'GATED_CATEGORY', amount: take });
      flags.push('Gated category — may require ungating');
    }

    // 3. Price volatility
    if (riskFlags.isVolatile) {
      const take = Math.min(D.HIGH_VOLATILITY.deduct, score);
      score -= take;
      deductions.push({ reason: 'HIGH_VOLATILITY', amount: take });
      flags.push('High price volatility detected');
    }

    // 4. HAZMAT / dangerous goods
    if (riskFlags.isHazmat) {
      const take = Math.min(D.HAZMAT.deduct, score);
      score -= take;
      deductions.push({ reason: 'HAZMAT', amount: take });
      flags.push('Hazmat item — restricted shipping');
    }

    // 5. Heavy item
    if (amazon && amazon.weightLbs && amazon.weightLbs > D.HEAVY_ITEM.threshold_lbs) {
      const take = Math.min(D.HEAVY_ITEM.deduct, score);
      score -= take;
      deductions.push({
        reason: 'HEAVY_ITEM',
        amount: take,
        detail: `${amazon.weightLbs} lbs`,
      });
      flags.push(`Heavy item: ${amazon.weightLbs} lbs — high shipping cost`);
    }

    // 6. Low review count
    if (amazon && amazon.reviewCount !== null && amazon.reviewCount < D.LOW_REVIEW_COUNT.threshold) {
      const take = Math.min(D.LOW_REVIEW_COUNT.deduct, score);
      score -= take;
      deductions.push({
        reason: 'LOW_REVIEW_COUNT',
        amount: take,
        detail: `${amazon.reviewCount} reviews`,
      });
      flags.push(`Low review count: ${amazon.reviewCount} reviews`);
    }

    // 7. Negative profit (overrides everything)
    if (profit && !profit.profit.isProfitable) {
      const take = score; // Deduct all remaining risk points
      score -= take;
      deductions.push({ reason: 'NEGATIVE_PROFIT', amount: take });
      flags.push('Negative profit — losing money on this item');
    }

    return {
      score: Math.max(0, parseFloat(score.toFixed(1))),
      deductions,
      flags,
    };
  }

  // ── Tier classification ─────────────────────────────
  _classifyTier(score) {
    const tiers = config.TIERS;
    for (const [key, tier] of Object.entries(tiers)) {
      if (score >= tier.min && score <= tier.max) {
        return tier;
      }
    }
    return tiers.SKIP;
  }

  /**
   * Get all tier definitions for display.
   */
  getTiers() {
    return config.TIERS;
  }

  /**
   * Batch score multiple opportunities.
   */
  batchScore(opportunities) {
    return opportunities.map(opp => ({
      ...opp,
      scoring: this.score({
        amazon: opp.amazon,
        ebay: opp.ebay,
        profit: opp.calc || opp.profit,
        riskFlags: opp.riskFlags || {},
      }),
    })).sort((a, b) => b.scoring.score - a.scoring.score);
  }
}

module.exports = ScoringEngine;
