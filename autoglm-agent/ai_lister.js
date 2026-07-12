const { GoogleGenAI } = require('@google/genai');
const config = require('./config');

class AILister {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.initialized = !!this.apiKey;
    
    if (this.initialized) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    } else {
      console.warn('[AILister] ⚠️ GEMINI_API_KEY is not set in .env. AI listing generation is disabled.');
    }
  }

  /**
   * Generates an SEO-optimized eBay title and a high-converting HTML description
   * @param {Object} product - Product details (title, category, features, etc.)
   * @returns {Promise<Object>} - { seoTitle, htmlDescription }
   */
  async generateListing(product) {
    if (!this.initialized) {
      return {
        seoTitle: product.title.substring(0, 80),
        htmlDescription: `<h1>${product.title}</h1><p>Buy now for a great price.</p>`
      };
    }

    try {
      console.log(`[AILister] 🧠 Generating Elite Listing for: ${product.asin}...`);
      
      const prompt = `
        You are a Beyond Legendary Elite Mastery Level eBay SEO Specialist.
        I am giving you a product from Amazon that we are dropshipping/arbitraging to eBay.
        
        Product Title: ${product.title}
        Category: ${product.category || 'General'}
        Brand: ${product.brand || 'Unbranded'}
        Features/Condition: New
        
        Task 1: Generate the ultimate SEO-optimized eBay Title (max 80 characters). Use high-volume search keywords. Do NOT use symbols like !, ?, or quotes.
        Task 2: Generate a highly converting, premium HTML Product Description. Use modern, clean styling with inline CSS (no external stylesheets). Include sections for: Description, Key Features, Shipping Policy (Fast & Free), and Return Policy (30 Days).
        
        Respond ONLY with a valid JSON object in this exact format:
        {
          "seoTitle": "...",
          "htmlDescription": "..."
        }
      `;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
      });

      const result = JSON.parse(response.text);
      console.log(`[AILister] ✅ AI Listing Generated Successfully for ${product.asin}`);
      return result;

    } catch (error) {
      console.error(`[AILister] ❌ Failed to generate listing: ${error.message}`);
      return {
        seoTitle: product.title.substring(0, 80),
        htmlDescription: `<p>${product.title}</p>`
      };
    }
  }
}

module.exports = new AILister();
