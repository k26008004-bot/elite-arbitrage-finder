// Elite Arbitrage Finder - Content Script
// Injects the UI and handles calculations

(function() {
  // Prevent multiple injections
  if (document.getElementById('elite-arbitrage-panel')) return;

  let CONFIG = {
    ebayFeeRate: 0.1325, // 13.25%
    paymentProcessingFee: 0.029, // 2.9%
    paymentFixedFee: 0.30, // $0.30
    defaultShipping: 6.00,
    defaultPackaging: 1.00,
    targetMultiplier: 1.6
  };

  let productData = {
    title: '',
    price: 0,
    asin: ''
  };

  // 1. Scrape Amazon Page Data
  function scrapeAmazonData() {
    // Title
    const titleEl = document.getElementById('productTitle');
    if (titleEl) {
      productData.title = titleEl.innerText.trim();
    }

    // Price
    // Amazon DOM for prices is messy, try a few common selectors
    const priceSelectors = [
      '#corePrice_desktop .a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price.a-text-price.a-size-medium .a-offscreen'
    ];

    for (let selector of priceSelectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText) {
        const priceStr = el.innerText.replace(/[^0-9.]/g, '');
        const priceNum = parseFloat(priceStr);
        if (!isNaN(priceNum) && priceNum > 0) {
          productData.price = priceNum;
          break;
        }
      }
    }

    // ASIN from URL or hidden input
    const asinInput = document.getElementById('ASIN');
    if (asinInput) {
      productData.asin = asinInput.value;
    } else {
      const match = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
      if (match) productData.asin = match[1];
    }
  }

  // 2. Build UI Panel
  function injectPanel() {
    const panel = document.createElement('div');
    panel.id = 'elite-arbitrage-panel';
    
    // Create Ebay Search Link based on title
    // Clean title (remove common Amazon junk, keep first 50 chars approx)
    let cleanTitle = productData.title.split('-')[0].split(',')[0].substring(0, 60);
    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(cleanTitle)}&LH_Sold=1&LH_Complete=1`;

    panel.innerHTML = `
      <div class="eap-header">
        <div class="eap-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
          Elite Arbitrage
        </div>
        <button class="eap-close" id="eap-close-btn">&times;</button>
      </div>
      
      <div class="eap-content">
        <div class="eap-row">
          <span class="eap-label">Amazon Price:</span>
          <span class="eap-value">$${productData.price > 0 ? productData.price.toFixed(2) : '0.00'}</span>
        </div>
        
        <div class="eap-divider"></div>
        
        <div class="eap-input-group">
          <label class="eap-label">Target eBay Sale Price</label>
          <div class="eap-input-wrapper">
            <span class="eap-currency">$</span>
            <input type="number" id="eap-ebay-price" class="eap-input" placeholder="e.g. 50.00" step="0.01">
          </div>
        </div>

        <div class="eap-row" style="gap: 12px;">
          <div class="eap-input-group" style="flex: 1;">
            <label class="eap-label">Shipping Cost</label>
            <div class="eap-input-wrapper">
              <span class="eap-currency">$</span>
              <input type="number" id="eap-shipping" class="eap-input" value="${CONFIG.defaultShipping.toFixed(2)}" step="0.01">
            </div>
          </div>
          <div class="eap-input-group" style="flex: 1;">
            <label class="eap-label">Packaging</label>
            <div class="eap-input-wrapper">
              <span class="eap-currency">$</span>
              <input type="number" id="eap-packaging" class="eap-input" value="${CONFIG.defaultPackaging.toFixed(2)}" step="0.01">
            </div>
          </div>
        </div>
        
        <div class="eap-result">
          <div class="eap-label" style="color: rgba(255,255,255,0.7);">Estimated Net Profit</div>
          <div class="eap-profit-val" id="eap-profit-display">$0.00</div>
          <div class="eap-roi-val" id="eap-roi-display">ROI: 0.00%</div>
        </div>
        
        <a href="${ebayUrl}" target="_blank" class="eap-btn">
          Search eBay Sold Listings
        </a>
      </div>
    `;

    document.body.appendChild(panel);

    // Event Listeners
    document.getElementById('eap-close-btn').addEventListener('click', () => {
      panel.classList.add('hidden');
    });

    const inputs = ['eap-ebay-price', 'eap-shipping', 'eap-packaging'];
    inputs.forEach(id => {
      document.getElementById(id).addEventListener('input', calculateProfit);
    });
  }

  // 3. Calculation Logic
  function calculateProfit() {
    const ebayPriceStr = document.getElementById('eap-ebay-price').value;
    const shippingStr = document.getElementById('eap-shipping').value;
    const packagingStr = document.getElementById('eap-packaging').value;
    
    if (!ebayPriceStr) return; // Wait for user input

    const ebayPrice = parseFloat(ebayPriceStr) || 0;
    const shipping = parseFloat(shippingStr) || 0;
    const packaging = parseFloat(packagingStr) || 0;
    const amazonPrice = productData.price;

    // Fees: 13.25% eBay FVF + 2.9% Payment + $0.30 fixed
    const totalPercentageFee = CONFIG.ebayFeeRate + CONFIG.paymentProcessingFee;
    const ebayFees = (ebayPrice * totalPercentageFee) + CONFIG.paymentFixedFee;
    
    const netProfit = ebayPrice - ebayFees - shipping - packaging - amazonPrice;
    
    let roi = 0;
    if (amazonPrice > 0) {
      roi = (netProfit / amazonPrice) * 100;
    }

    // Update UI
    const profitDisplay = document.getElementById('eap-profit-display');
    const roiDisplay = document.getElementById('eap-roi-display');

    profitDisplay.innerText = `$${netProfit.toFixed(2)}`;
    roiDisplay.innerText = `ROI: ${roi.toFixed(2)}%`;

    if (netProfit < 0) {
      profitDisplay.classList.add('eap-negative');
      roiDisplay.classList.add('eap-negative-roi');
    } else {
      profitDisplay.classList.remove('eap-negative');
      roiDisplay.classList.remove('eap-negative-roi');
    }
  }

  // 4. Initialize
  // Only initialize on product pages
  if (document.getElementById('productTitle') || document.getElementById('dp')) {
    chrome.storage.sync.get(
      {
        ebayFeeRate: 0.1325,
        shippingCost: 6.00,
        packagingCost: 1.00,
        targetMultiplier: 1.6
      },
      (items) => {
        CONFIG.ebayFeeRate = items.ebayFeeRate;
        CONFIG.defaultShipping = items.shippingCost;
        CONFIG.defaultPackaging = items.packagingCost;
        CONFIG.targetMultiplier = items.targetMultiplier;
        
        scrapeAmazonData();
        injectPanel();
      }
    );
  }

})();
