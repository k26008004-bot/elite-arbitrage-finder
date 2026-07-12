/**
 * discord_webhook.js — Tiered Discord Alert System
 *
 * Only sends alerts for 🥇 Elite and 🥈 Strong tier products.
 * Watch and Skip tiers are logged but do NOT trigger notifications.
 *
 * Alert format: Rich embed with profit breakdown, score, and action call-to-action.
 */

const https = require('https');
const http = require('http');
const config = require('./config');

class DiscordWebhook {
  constructor() {
    this.webhookUrl = config.DISCORD.WEBHOOK_URL;
    this.alertTiers = config.DISCORD.ALERT_TIERS;
  }

  get isConfigured() {
    return !!this.webhookUrl && this.webhookUrl.startsWith('http');
  }

  /**
   * Send an opportunity alert. Only fires for Elite and Strong tiers.
   * @param {Object} opportunity — Full scored opportunity object
   * @returns {boolean} whether alert was sent
   */
  async sendAlert(opportunity) {
    if (!this.isConfigured) {
      console.log('  [Discord] Webhook not configured. Skipping alert.');
      return false;
    }

    const tier = opportunity.scoring?.tier || opportunity.tier;
    if (!this.alertTiers.includes(tier)) {
      // Watch/Skip tiers — silently skip
      return false;
    }

    const embed = this._buildEmbed(opportunity);
    const payload = {
      username: config.DISCORD.USERNAME,
      avatar_url: config.DISCORD.AVATAR_URL || undefined,
      embeds: [embed],
    };

    const success = await this._post(payload);

    if (success) {
      const emoji = opportunity.scoring?.tierEmoji || opportunity.tierEmoji || '';
      console.log(`  [Discord] ${emoji} Alert sent: ${opportunity.title?.substring(0, 60)}...`);
    }

    return success;
  }

  /**
   * Send a daily summary digest.
   */
  async sendDailyDigest(opportunities, stats) {
    if (!this.isConfigured) return false;

    const elite = opportunities.filter(o =>
      (o.scoring?.tier || o.tier) === 'Elite'
    );
    const strong = opportunities.filter(o =>
      (o.scoring?.tier || o.tier) === 'Strong'
    );

    const embed = {
      title: '📊 Daily Arbitrage Digest',
      description: `**${stats.totalScanned}** products scanned | **${opportunities.length}** opportunities found`,
      color: 0x00B4D8,
      fields: [
        {
          name: '🥇 Elite Picks',
          value: elite.length > 0
            ? elite.slice(0, 5).map(o =>
                `• **${o.title?.substring(0, 40)}** — $${o.profit?.netProfit || o.netProfit} profit (${o.profit?.roiPct || o.roiPct}% ROI)`
              ).join('\n')
            : 'No elite picks today',
          inline: false,
        },
        {
          name: '🥈 Strong Picks',
          value: strong.length > 0
            ? strong.slice(0, 5).map(o =>
                `• **${o.title?.substring(0, 40)}** — $${o.profit?.netProfit || o.netProfit} profit (${o.profit?.roiPct || o.roiPct}% ROI)`
              ).join('\n')
            : 'No strong picks today',
          inline: false,
        },
      ],
      footer: { text: `${config.APP_NAME} • ${new Date().toISOString().split('T')[0]}` },
      timestamp: new Date().toISOString(),
    };

    return this._post({
      username: config.DISCORD.USERNAME,
      embeds: [embed],
    });
  }

  /**
   * Send an error or status notification.
   */
  async sendStatus(message, isError = false) {
    if (!this.isConfigured) return false;
    return this._post({
      username: config.DISCORD.USERNAME,
      content: isError ? `⚠️ **Alert:** ${message}` : `ℹ️ ${message}`,
    });
  }

  // ── Private: Build rich embed ────────────────────────
  _buildEmbed(opp) {
    const scoring = opp.scoring || {};
    const profit = opp.profit || opp.calc || {};
    const isElite = (scoring.tier || opp.tier) === 'Elite';

    // Color per tier
    let color = config.DISCORD.COLOR_WATCH;
    if (isElite) color = config.DISCORD.COLOR_ELITE;
    else if ((scoring.tier || opp.tier) === 'Strong') color = config.DISCORD.COLOR_STRONG;

    const emoji = scoring.tierEmoji || opp.tierEmoji || '';

    const fields = [
      {
        name: '💰 Profit Breakdown',
        value: [
          `**Net Profit:** $${profit.netProfit || opp.netProfit || 'N/A'}`,
          `**ROI:** ${profit.roiPct || opp.roiPct || 'N/A'}%`,
          `**Amazon:** $${opp.amazonPrice || profit.costs?.amazonCost || 'N/A'}`,
          `**eBay Avg Sold:** $${opp.ebayAvgSoldPrice || profit.revenue?.ebaySoldPrice || 'N/A'}`,
          `**Total Fees:** $${profit.fees?.totalFees || opp.estimatedFees || 'N/A'}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '📊 Market Data',
        value: [
          `**Score:** ${scoring.score || opp.compositeScore || 'N/A'}/100`,
          `**Monthly Sales:** ${opp.ebay?.monthlyVolume || opp.ebayMonthlyVolume || 'N/A'}`,
          `**Active Listings:** ${opp.ebay?.activeListings || opp.ebayActiveListings || 'N/A'}`,
          `**Match Confidence:** ${(opp.matchConfidence || 0) * 100}%`,
          `**Matched By:** ${opp.matchMethod || 'N/A'}`,
        ].join('\n'),
        inline: true,
      },
    ];

    // Add risk flags if any
    if (scoring.flags && scoring.flags.length > 0) {
      fields.push({
        name: '⚠️ Risk Flags',
        value: scoring.flags.map(f => `• ${f}`).join('\n'),
        inline: false,
      });
    }

    // Add score breakdown
    if (scoring.breakdown) {
      const bd = scoring.breakdown;
      const breakdownLines = [
        `Margin: **${bd.margin?.score?.toFixed(1) || 0}/${bd.margin?.weight || 40}** (${bd.margin?.roiPct || 0}% ROI)`,
        `Velocity: **${bd.velocity?.score || 0}/${bd.velocity?.weight || 30}** (${bd.velocity?.monthlyVolume || 0} sales/mo)`,
        `Competition: **${bd.competition?.score || 0}/${bd.competition?.weight || 15}** (${bd.competition?.activeListings || 0} listings)`,
        `Risk: **${bd.risk?.score?.toFixed(1) || 0}/${bd.risk?.weight || 15}**`,
      ];
      fields.push({
        name: '🎯 Score Breakdown',
        value: breakdownLines.join('\n'),
        inline: false,
      });
    }

    return {
      title: `${emoji} ${scoring.tier || opp.tier || 'Unknown'} Opportunity: $${profit.netProfit || opp.netProfit || 'N/A'} Profit`,
      description: opp.title || 'Untitled Product',
      url: opp.amazonUrl || opp.url || undefined,
      color,
      fields,
      footer: {
        text: `${config.APP_NAME} • ASIN: ${opp.asin || 'N/A'} • ${new Date().toLocaleTimeString()}`,
      },
      timestamp: new Date().toISOString(),
      thumbnail: opp.imageUrl ? { url: opp.imageUrl } : undefined,
    };
  }

  // ── Private: HTTP POST ───────────────────────────────
  async _post(payload) {
    try {
      const url = new URL(this.webhookUrl);
      const body = JSON.stringify(payload);

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const transport = url.protocol === 'https:' ? https : http;

      return new Promise((resolve) => {
        const req = transport.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 204 || res.statusCode === 200) {
              resolve(true);
            } else {
              console.error(`  [Discord] HTTP ${res.statusCode}: ${data}`);
              resolve(false);
            }
          });
        });

        req.on('error', (err) => {
          console.error(`  [Discord] Request error: ${err.message}`);
          resolve(false);
        });

        req.write(body);
        req.end();
      });
    } catch (err) {
      console.error(`  [Discord] Error: ${err.message}`);
      return false;
    }
  }
}

module.exports = DiscordWebhook;
