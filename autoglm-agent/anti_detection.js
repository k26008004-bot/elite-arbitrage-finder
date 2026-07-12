/**
 * anti_detection.js — Elite 6-Layer Anti-Detection Manager
 *
 * Wraps Playwright Browser Context with military-grade stealth:
 *   Layer 1 — Residential Proxy Rotation (round-robin, health-tracked, auto-banning)
 *   Layer 2 — Fingerprint Randomization (Canvas, WebGL, AudioContext, fonts, screen, tz)
 *   Layer 3 — Intelligent Delays (gamma-distributed, human-like, non-linear)
 *   Layer 4 — 2Captcha Integration (detect → freeze → solve → inject → proceed)
 *   Layer 5 — Session Cookie Recycling (save trusted cookies, inject on next boot)
 *   Layer 6 — Unified Health Monitor (per-proxy stats, auto-quarantine on 3+ fails)
 *
 * Dependencies:
 *   npm install 2captcha   (optional — engine degrades gracefully without it)
 */

const fs = require('fs');
const path = require('path');

// ── Optional 2captcha ──────────────────────────────────
let CaptchaSolver = null;
try { CaptchaSolver = require('2captcha'); } catch { /* optional */ }

const config = require('./config');

// ═══════════════════════════════════════════════════════════
//  LAYER 1 — PROXY POOL MANAGER
// ═══════════════════════════════════════════════════════════

class ProxyPool {
  /**
   * @param {string[]} proxyUrls — e.g. ['http://user:pass@res.proxy.com:9000']
   * @param {string}   stateFile — path for persisting health state across runs
   */
  constructor(proxyUrls = [], stateFile = null) {
    this.proxies = proxyUrls
      .filter(Boolean)
      .map(url => url.trim())
      .map((url, i) => ({
        id: `p${i}`,
        url,
        success: 0,
        fail: 0,
        consecutiveFails: 0,
        captchaHits: 0,
        blockedUntil: null,
        lastUsed: null,
      }));
    this.stateFile = stateFile;
    this.totalServed = 0;

    if (stateFile && fs.existsSync(stateFile)) {
      try {
        const saved = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        this.proxies = this.proxies.map(p => {
          const match = saved.find(s => s.id === p.id || s.url === p.url);
          return match ? { ...p, ...match } : p;
        });
      } catch { /* ignore */ }
    }
  }

  /** Get next available proxy. Returns null if all banned/exhausted. */
  getNext() {
    const now = Date.now();
    const available = this.proxies.filter(p => {
      if (p.blockedUntil && p.blockedUntil > now) return false;
      return true;
    });

    if (available.length === 0) {
      // Find the proxy with the soonest unblock time
      const soonest = this.proxies.reduce((best, p) =>
        (!best || (p.blockedUntil || 0) < (best.blockedUntil || 0)) ? p : best
      , null);
      const waitMs = soonest?.blockedUntil ? soonest.blockedUntil - now : 60000;
      console.warn(`[ProxyPool] ALL EXHAUSTED (${this.proxies.length} total). Next available in ${Math.round(waitMs/1000)}s`);
      return null;
    }

    // Least-recently-used among available
    available.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
    const proxy = available[0];
    proxy.lastUsed = now;
    this.totalServed++;
    return proxy;
  }

  /** Report a successful scrape on this proxy. */
  reportSuccess(proxy) {
    if (!proxy) return;
    const p = this.proxies.find(x => x.id === proxy.id);
    if (!p) return;
    p.success++;
    p.consecutiveFails = 0;
    p.blockedUntil = null;
    this._save();
  }

  /** Report a failed request. Escalating bans: 3→5min, 5→30min, 10→2hr. */
  reportFailure(proxy) {
    if (!proxy) return;
    const p = this.proxies.find(x => x.id === proxy.id);
    if (!p) return;
    p.fail++;
    p.consecutiveFails++;

    if (p.consecutiveFails >= 10) {
      p.blockedUntil = Date.now() + 2 * 60 * 60 * 1000;
      console.warn(`[ProxyPool] ${p.id} BANNED 2hr — ${p.consecutiveFails} consecutive fails`);
    } else if (p.consecutiveFails >= 5) {
      p.blockedUntil = Date.now() + 30 * 60 * 1000;
      console.warn(`[ProxyPool] ${p.id} banned 30min`);
    } else if (p.consecutiveFails >= 3) {
      p.blockedUntil = Date.now() + 5 * 60 * 1000;
      console.warn(`[ProxyPool] ${p.id} banned 5min`);
    }
    this._save();
  }

  /** Report a CAPTCHA hit (counts double toward ban threshold). */
  reportCaptcha(proxy) {
    if (!proxy) return;
    const p = this.proxies.find(x => x.id === proxy.id);
    if (!p) return;
    p.captchaHits++;
    p.consecutiveFails += 2;
    p.blockedUntil = Date.now() + 15 * 60 * 1000;
    console.warn(`[ProxyPool] ${p.id} CAPTCHA — 15min cooldown`);
    this._save();
  }

  get stats() {
    const now = Date.now();
    return {
      total: this.proxies.length,
      available: this.proxies.filter(p => !p.blockedUntil || p.blockedUntil <= now).length,
      banned: this.proxies.filter(p => p.blockedUntil && p.blockedUntil > now).length,
      totalServed: this.totalServed,
      successRate: this.totalServed > 0
        ? (this.proxies.reduce((s, p) => s + p.success, 0) / this.totalServed * 100).toFixed(0) + '%'
        : 'N/A',
    };
  }

  _save() {
    if (!this.stateFile) return;
    try {
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      fs.writeFileSync(this.stateFile, JSON.stringify(this.proxies, null, 2));
    } catch { /* best effort */ }
  }
}

// ═══════════════════════════════════════════════════════════
//  LAYER 2 — FINGERPRINT RANDOMIZER
// ═══════════════════════════════════════════════════════════

class FingerprintRandomizer {
  /** Generate a randomized fingerprint for one browser session. */
  generate() {
    const tz = this._pickTimezone();
    return {
      viewport: this._pickViewport(),
      timezone: tz,
      tzOffset: this._tzToOffset(tz),
      locale: this._pickLocale(),
      platform: this._pickPlatform(),
      hardwareConcurrency: [4, 8, 12, 16][Math.floor(Math.random() * 4)],
      deviceMemory: [4, 8, 16][Math.floor(Math.random() * 3)],
      colorDepth: [24, 30, 32][Math.floor(Math.random() * 3)],
      webglVendor: this._pickWebGL(),
      webglRenderer: this._pickWebGLRenderer(),
      audioFingerprint: this._randomAudioNoise(),
      fonts: this._pickFonts(),
    };
  }

  /** Generate the Playwright addInitScript payload. */
  toInitScript(fp) {
    return `
      // ── Navigator overrides ──────────────────
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${fp.hardwareConcurrency} });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => ${fp.deviceMemory} });
      Object.defineProperty(navigator, 'platform', { get: () => '${fp.platform}' });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
      Object.defineProperty(navigator, 'languages', { get: () => ['${fp.locale}', 'en'] });
      Object.defineProperty(navigator, 'language', { get: () => '${fp.locale}' });

      // ── Screen overrides ─────────────────────
      Object.defineProperty(screen, 'colorDepth', { get: () => ${fp.colorDepth} });
      Object.defineProperty(screen, 'pixelDepth', { get: () => ${fp.colorDepth} });

      // ── Timezone ─────────────────────────────
      const origOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = () => ${fp.tzOffset};
      try {
        Intl.DateTimeFormat = new Proxy(Intl.DateTimeFormat, {
          construct(target, args) {
            if (!args[0]) args[0] = '${fp.locale}';
            return new target(...args);
          }
        });
      } catch(e) {}

      // ── WebGL fingerprint poisoning ──────────
      try {
        const getParam = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(p) {
          if (p === 37445) return '${fp.webglVendor}';
          if (p === 37446) return '${fp.webglRenderer}';
          if (p === 7937) return '${fp.webglVendor}'; // UNMASKED_VENDOR
          if (p === 7938) return '${fp.webglRenderer}'; // UNMASKED_RENDERER
          return getParam.call(this, p);
        };
      } catch(e) {}

      // ── Canvas fingerprint noise (0.01% perturbation) ──
      try {
        const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function() {
          const ctx = this.getContext('2d');
          if (ctx) {
            const r = (Math.random() * 0.0001).toFixed(8);
            ctx.fillStyle = 'rgba(255,255,255,' + r + ')';
            ctx.fillRect(0, 0, 1, 1);
          }
          return origToDataURL.apply(this, arguments);
        };
        const origToBlob = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function(cb, type, quality) {
          const ctx = this.getContext('2d');
          if (ctx) {
            ctx.fillStyle = 'rgba(255,255,255,' + (Math.random()*0.0001) + ')';
            ctx.fillRect(0, 0, 1, 1);
          }
          return origToBlob.call(this, cb, type, quality);
        };
      } catch(e) {}

      // ── AudioContext fingerprint noise ───────
      try {
        const _getChannelData = AudioBuffer.prototype.getChannelData;
        AudioBuffer.prototype.getChannelData = function(channel) {
          const data = _getChannelData.call(this, channel);
          const noise = ${fp.audioFingerprint};
          for (let i = 0; i < Math.min(data.length, 500); i++) {
            data[i] += noise * (Math.random() - 0.5);
          }
          return data;
        };
      } catch(e) {}

      // ── Plugins array (non-empty) ────────────
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const arr = new Array(5);
          for (let i = 0; i < 5; i++) {
            arr[i] = { name: '${fp.fonts[0]}', filename: '${fp.fonts[0]}.dll', description: 'Plugin ' + i };
          }
          arr.item = i => arr[i];
          arr.namedItem = n => arr[0];
          arr.refresh = () => {};
          return arr;
        }
      });

      // ── Permissions spoofing ─────────────────
      if (navigator.permissions) {
        const origQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (params) => (
          params.name === 'notifications'
            ? Promise.resolve({ state: 'prompt', onchange: null })
            : origQuery(params)
        );
      }

      // ── Batch & connection hints ──────────────
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50,
          downlink: 10,
          saveData: false,
        })
      });

      // ── Media devices ────────────────────────
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const origEnumerate = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
        navigator.mediaDevices.enumerateDevices = () => origEnumerate().then(devices =>
          devices.map(d => ({ ...d, label: '' }))
        );
      }
    `;
  }

  _pickTimezone() {
    return [
      'America/New_York', 'America/Chicago', 'America/Denver',
      'America/Los_Angeles', 'America/Phoenix', 'America/Chicago',
      'Europe/London', 'Europe/Berlin',
    ][Math.floor(Math.random() * 8)];
  }

  _tzToOffset(tz) {
    const m = {
      'America/New_York': 300, 'America/Chicago': 360,
      'America/Denver': 420, 'America/Los_Angeles': 480,
      'America/Phoenix': 420, 'Europe/London': -60,
      'Europe/Berlin': -120,
    };
    return m[tz] || 300;
  }

  _pickViewport() {
    return [
      { width: 1920, height: 1080 }, { width: 2560, height: 1440 },
      { width: 1680, height: 1050 }, { width: 1440, height: 900 },
      { width: 1366, height: 768 },
    ][Math.floor(Math.random() * 5)];
  }

  _pickLocale() { return ['en-US', 'en-US', 'en-US', 'en-GB', 'en-CA'][Math.floor(Math.random() * 5)]; }
  _pickPlatform() { return ['Win32', 'Win32', 'Win32', 'MacIntel', 'Linux x86_64'][Math.floor(Math.random() * 5)]; }

  _pickWebGL() {
    return ['Google Inc. (NVIDIA)', 'Google Inc. (Intel)', 'Google Inc. (AMD)', 'Apple Inc.'][Math.floor(Math.random() * 4)];
  }

  _pickWebGLRenderer() {
    return [
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0)',
      'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00003E9B) Direct3D11 vs_5_0 ps_5_0)',
      'ANGLE (AMD, AMD Radeon RX 6800 (0x000073BF) Direct3D11 vs_5_0 ps_5_0)',
      'ANGLE (Apple, Apple M1, OpenGL 4.1)',
    ][Math.floor(Math.random() * 4)];
  }

  _randomAudioNoise() {
    return (Math.random() * 0.0000002).toFixed(10);
  }

  _pickFonts() {
    const sets = [
      ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF'],
      ['Chrome PDF Plugin', 'Native Client', 'Widevine Content Decryption Module'],
    ];
    return sets[Math.floor(Math.random() * sets.length)];
  }
}

// ═══════════════════════════════════════════════════════════
//  LAYER 3 — INTELLIGENT DELAY ENGINE
// ═══════════════════════════════════════════════════════════

class DelayEngine {
  /**
   * Gamma-distribution delay (human-like: clusters near mean, occasional long pauses).
   * @param {number} minMs
   * @param {number} maxMs
   * @returns {number}
   */
  static humanDelay(minMs, maxMs) {
    const range = maxMs - minMs;
    // Sum of 2 uniforms → triangular-ish distribution biased toward lower half
    let d = 0;
    for (let i = 0; i < 2; i++) d += Math.random();
    return Math.round((d / 2) * range + minMs);
  }

  /** Between-product delay with 15% chance of longer pause ("getting coffee"). */
  static productGap() {
    if (Math.random() < 0.15) return this.humanDelay(8000, 15000);
    return this.humanDelay(config.AMAZON_DELAY_MIN * 1000, config.AMAZON_DELAY_MAX * 1000);
  }

  /** Between-page delay — Amazon→eBay transition. */
  static pageTransition() {
    return this.humanDelay(
      Math.max(config.AMAZON_DELAY_MIN, config.EBAY_DELAY_MIN) * 1000,
      Math.max(config.AMAZON_DELAY_MAX, config.EBAY_DELAY_MAX) * 1000
    );
  }

  /** Simulate human scrolling behavior. */
  static async humanScroll(page) {
    const scrolls = Math.floor(Math.random() * 4) + 1;
    for (let i = 0; i < scrolls; i++) {
      const y = Math.floor(Math.random() * 300) + 80;
      await page.mouse.wheel(0, y);
      await new Promise(r => setTimeout(r, this.humanDelay(200, 900)));
    }
  }

  /** Simulate reading + random mouse movement. */
  static async lookHuman(page) {
    await new Promise(r => setTimeout(r, this.humanDelay(800, 3500)));
    if (Math.random() < 0.35) {
      const x = Math.floor(Math.random() * 600) + 100;
      const y = Math.floor(Math.random() * 400) + 100;
      await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 2 });
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  LAYER 4 — CAPTCHA SOLVER (2Captcha)
// ═══════════════════════════════════════════════════════════

class CaptchaSolverService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.CAPTCHA_API_KEY || '';
    this.solver = null;
    this.solveCount = 0;
    this.cost = 0;
    this.enabled = !!(this.apiKey && CaptchaSolver);
    if (this.enabled) {
      this.solver = new CaptchaSolver(this.apiKey);
    }
  }

  /** Detect CAPTCHA type on the current page. */
  static async detect(page) {
    try {
      return await page.evaluate(() => {
        const t = document.title.toLowerCase();
        if (t.includes('robot check') || document.querySelector('form[action*="validateCaptcha"]')) return 'AMAZON';
        if (t.includes('security measure') || document.querySelector('#captcha_center')) return 'EBAY_PERIMETERX';
        if (document.querySelector('.g-recaptcha, iframe[src*="recaptcha"]')) return 'RECAPTCHA';
        return null;
      });
    } catch { return null; }
  }

  /** Attempt to solve the CAPTCHA. Returns true if solved. */
  async solve(page, captchaType) {
    if (!this.enabled) {
      console.log(`  [Captcha] ${captchaType} detected — solver not configured (skip)`);
      return false;
    }

    console.log(`  [Captcha] ${captchaType} — solving via 2Captcha...`);

    try {
      let token;

      if (captchaType === 'RECAPTCHA') {
        const siteKey = await page.evaluate(() => {
          const el = document.querySelector('.g-recaptcha');
          return el ? el.getAttribute('data-sitekey') : null;
        });
        if (!siteKey) return false;
        const result = await this.solver.recaptcha(siteKey, page.url());
        token = result.data;
        await page.evaluate((t) => {
          const ta = document.getElementById('g-recaptcha-response');
          if (ta) { ta.style.display = 'block'; ta.value = t; }
          const form = document.querySelector('form');
          if (form) form.submit();
        }, token);
      } else {
        // Image-based captcha (Amazon/eBay)
        const imgEl = await page.$('img[src*="captcha"], .a-box img');
        if (!imgEl) return false;
        const imgBase64 = await imgEl.screenshot({ type: 'png', encoding: 'base64' });
        const result = await this.solver.imageCaptcha(imgBase64);
        token = result.data;
        const input = await page.$('#captchacharacters, input[name="field-keywords"], #captchaInput');
        if (input) {
          await input.click();
          await input.fill(token);
          await page.click('input[type="submit"], button[type="submit"]');
        }
      }

      await page.waitForTimeout(3000);
      this.solveCount++;
      this.cost += captchaType === 'RECAPTCHA' ? 0.003 : 0.002;
      console.log(`  [Captcha] ✅ Solved (#${this.solveCount}, ~$${this.cost.toFixed(3)} total)`);
      return true;
    } catch (err) {
      console.error(`  [Captcha] ❌ Solve failed: ${err.message}`);
      return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  LAYER 5 — SESSION COOKIE RECYCLER
// ═══════════════════════════════════════════════════════════

class CookieRecycler {
  constructor(storageDir = null) {
    this.dir = storageDir || path.join(config.LOG_DIR || './logs', 'cookies');
    this.cache = new Map(); // domain → cookies[]
  }

  /** Save cookies from a browser context for later reuse. */
  async save(context, domain) {
    try {
      const cookies = await context.cookies();
      if (!cookies.length) return;
      cookies.forEach(c => { c._savedAt = Date.now(); });
      this.cache.set(domain, cookies);
      fs.mkdirSync(this.dir, { recursive: true });
      const fname = `${domain.replace(/[^a-z0-9]/gi, '_')}.json`;
      fs.writeFileSync(path.join(this.dir, fname), JSON.stringify(cookies, null, 2));
      console.log(`  [Cookies] Saved ${cookies.length} cookies → ${domain}`);
    } catch (err) {
      // Non-critical — continue without cookie persistence
    }
  }

  /** Load saved cookies into a context. Returns count loaded. */
  async load(context, domain) {
    try {
      let cookies = this.cache.get(domain);
      if (!cookies || !cookies.length) {
        const fname = `${domain.replace(/[^a-z0-9]/gi, '_')}.json`;
        const fp = path.join(this.dir, fname);
        if (fs.existsSync(fp)) {
          cookies = JSON.parse(fs.readFileSync(fp, 'utf-8'));
          this.cache.set(domain, cookies);
        }
      }
      if (cookies && cookies.length > 0) {
        // Strip Playwright-internal keys before injection
        const clean = cookies.map(({ _savedAt, sameSite, ...c }) => c);
        await context.addCookies(clean);
        console.log(`  [Cookies] Loaded ${cookies.length} cookies → ${domain}`);
        return cookies.length;
      }
    } catch { /* best effort */ }
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════
//  LAYER 6 — UNIFIED HEALTH MONITOR
// ═══════════════════════════════════════════════════════════

class HealthMonitor {
  constructor() {
    this.sessions = [];
    this.startTime = Date.now();
  }

  record(session) {
    this.sessions.push({ ...session, ts: Date.now() });
    if (this.sessions.length > 1000) this.sessions = this.sessions.slice(-500);
  }

  get summary() {
    const now = Date.now();
    const recent = this.sessions.filter(s => now - s.ts < 3600_000); // last hour

    return {
      uptime: now - this.startTime,
      lastHour: {
        total: recent.length,
        ok: recent.filter(s => s.ok).length,
        captcha: recent.filter(s => s.captcha).length,
        banned: recent.filter(s => s.banned).length,
        avgMs: recent.length ? recent.reduce((s, r) => s + (r.durationMs || 0), 0) / recent.length : 0,
      },
      successRate: recent.length
        ? (recent.filter(s => s.ok).length / recent.length * 100).toFixed(1) + '%'
        : 'N/A',
    };
  }

  get isHealthy() {
    const s = this.summary;
    return s.lastHour.total < 3 || parseFloat(s.successRate) > 45;
  }
}

// ═══════════════════════════════════════════════════════════
//  ANTI-DETECTION MANAGER (FACADE)
// ═══════════════════════════════════════════════════════════

class AntiDetectionManager {
  /**
   * @param {Object} opts
   * @param {string[]} opts.proxies       — proxy URL list
   * @param {string}   opts.captchaKey    — 2Captcha API key
   * @param {string}   opts.stateDir      — directory for proxy state & cookies
   */
  constructor(opts = {}) {
    const stateDir = opts.stateDir || path.join(config.LOG_DIR || './logs', 'anti_detection');
    this.proxyPool = new ProxyPool(
      opts.proxies || config.PROXIES || [],
      path.join(stateDir, 'proxy_state.json')
    );
    this.fingerprinter = new FingerprintRandomizer();
    this.captchaSolver = new CaptchaSolverService(opts.captchaKey);
    this.cookieRecycler = new CookieRecycler(path.join(stateDir, 'cookies'));
    this.health = new HealthMonitor();
  }

  /**
   * Create a fully-stealth Playwright context.
   * @param {import('playwright').Browser} browser
   * @param {string} domain — 'amazon.com' or 'ebay.com'
   * @returns {{ context, fingerprint, proxy }}
   */
  async createStealthContext(browser, domain) {
    const fp = this.fingerprinter.generate();
    const proxy = this.proxyPool.getNext();

    const opts = {
      viewport: fp.viewport,
      locale: fp.locale,
      timezoneId: fp.timezone,
      colorScheme: 'light',
      userAgent: this._randomUA(),
      geolocation: { latitude: 40.7128, longitude: -74.006 },
    };

    if (proxy) opts.proxy = { server: proxy.url };

    const ctx = await browser.newContext(opts);
    await ctx.addInitScript(this.fingerprinter.toInitScript(fp));

    const rootDomain = domain.replace('www.', '').split('.')[0]; // 'amazon.com' → 'amazon'
    await this.cookieRecycler.load(ctx, rootDomain);

    return { context: ctx, fingerprint: fp, proxy };
  }

  /**
   * Wrap a scrape operation with full anti-detection lifecycle.
   *
   * @param {Browser}  browser
   * @param {string}   domain    — 'amazon.com' | 'ebay.com'
   * @param {Function} operation — async (page, { proxyUrl }) => result
   * @returns {{ result, session }}
   */
  async safeScrape(browser, domain, operation) {
    const t0 = Date.now();
    const session = { domain, ok: false, captcha: false, banned: false, durationMs: 0 };

    let ctx = null, page = null, proxy = null;

    try {
      const stealth = await this.createStealthContext(browser, domain);
      ctx = stealth.context;
      proxy = stealth.proxy;
      page = await ctx.newPage();

      await DelayEngine.lookHuman(page);

      const result = await operation(page, {
        proxyUrl: proxy ? proxy.url : null,
        fingerprint: stealth.fingerprint,
      });

      // ── Success ────────────────────
      session.ok = true;
      await this.cookieRecycler.save(ctx, domain.replace('www.', '').split('.')[0]);
      if (proxy) this.proxyPool.reportSuccess(proxy);

      return { result, session };
    } catch (err) {
      const msg = (err.message || '').toLowerCase();

      if (msg.includes('captcha') || msg.includes('robot') || msg.includes('blocked')) {
        session.captcha = true;
        if (proxy) this.proxyPool.reportCaptcha(proxy);
        // Attempt solve + retry once
        if (page) {
          const captchaType = await CaptchaSolverService.detect(page);
          if (captchaType) {
            const solved = await this.captchaSolver.solve(page, captchaType);
            if (solved) {
              await page.waitForTimeout(2000);
              const retry = await operation(page, { proxyUrl: proxy?.url || null });
              session.ok = true;
              if (proxy) this.proxyPool.reportSuccess(proxy);
              return { result: retry, session };
            }
          }
        }
      } else if (msg.includes('proxy') || msg.includes('err_proxy')) {
        session.banned = true;
        if (proxy) this.proxyPool.reportFailure(proxy);
      } else if (msg.includes('timeout') || msg.includes('econnrefused')) {
        if (proxy) this.proxyPool.reportFailure(proxy);
      }

      throw err;
    } finally {
      session.durationMs = Date.now() - t0;
      this.health.record(session);
      if (ctx) { try { await ctx.close(); } catch {} }
    }
  }

  /** Print status card. */
  status() {
    const ps = this.proxyPool.stats;
    const h = this.health.summary;
    const cs = this.captchaSolver;
    return [
      `╔════ Anti-Detection Status ════════╗`,
      `║ Proxies:    ${ps.available}/${ps.total} avail (${ps.banned} banned)`,
      `║ Success:    ${ps.successRate}`,
      `║ Captcha:    ${cs.enabled ? `✓ ${cs.solveCount} solved ($${cs.cost.toFixed(3)})` : '✗ disabled'}`,
      `║ Cookies:    ${this.cookieRecycler.cache.size} domains cached`,
      `║ Health:     ${h.successRate} success (1hr), ${h.lastHour.total} sessions`,
      `╚═══════════════════════════════════╝`,
    ].join('\n');
  }

  _randomUA() {
    return [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    ][Math.floor(Math.random() * 5)];
  }
}

module.exports = {
  AntiDetectionManager,
  ProxyPool,
  FingerprintRandomizer,
  DelayEngine,
  CaptchaSolverService,
  CookieRecycler,
  HealthMonitor,
};
