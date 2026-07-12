/**
 * image_matcher.js — Level 3 Image Perceptual Hash (pHash)
 *
 * Implements the third tier of product matching using perceptual image hashing
 * to match Amazon product images against eBay listing images, even when UPC
 * is missing and titles differ significantly.
 *
 * Algorithm: Average Hash (aHash) + Hamming distance comparison
 *   - Resize image to 8×8 grayscale
 *   - Compare each pixel to the mean → 64-bit hash
 *   - Hamming distance ≤ 10 → considered a match
 *
 * Dependency: npm install sharp
 *   sharp is used for image resizing and grayscale conversion.
 */

let sharp = null;
try { sharp = require('sharp'); } catch { /* optional — image matching disabled without sharp */ }

class ImageMatcher {
  constructor() {
    this.enabled = !!sharp;
    this.threshold = 10; // Max Hamming distance for a match (lower = stricter)
    this.hashSize = 8;   // 8×8 = 64-bit hash
  }

  /**
   * Compute the perceptual hash (aHash) of an image buffer.
   * @param {Buffer|string} imageSource — Image buffer or URL/file path
   * @returns {string|null} 64-bit hex hash, or null if sharp isn't available
   */
  async computeHash(imageSource) {
    if (!this.enabled) return null;

    try {
      let pipeline = sharp(imageSource)
        .resize(this.hashSize, this.hashSize, { fit: 'fill' })
        .grayscale();

      const { data } = await pipeline.raw().toBuffer({ resolveWithObject: true });

      // Compute mean pixel value
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
      }
      const mean = sum / data.length;

      // Build hash: each pixel > mean → 1, else 0
      let hash = 0n;
      for (let i = 0; i < data.length; i++) {
        if (data[i] > mean) {
          hash |= (1n << BigInt(data.length - 1 - i));
        }
      }

      return hash.toString(16).padStart(16, '0');
    } catch (err) {
      console.warn(`  [ImageMatcher] Hash error: ${err.message}`);
      return null;
    }
  }

  /**
   * Compute Hamming distance between two hex hash strings.
   * @returns {number} Number of differing bits (0 = identical, 64 = completely different)
   */
  hammingDistance(hash1, hash2) {
    if (!hash1 || !hash2) return Infinity;

    const big1 = BigInt('0x' + hash1);
    const big2 = BigInt('0x' + hash2);
    let xor = big1 ^ big2;
    let distance = 0;

    while (xor > 0n) {
      distance++;
      xor &= (xor - 1n); // Clear lowest set bit
    }

    return distance;
  }

  /**
   * Compare two images and return true if they match.
   */
  async compare(imageA, imageB) {
    if (!this.enabled) return null;

    const hashA = await this.computeHash(imageA);
    const hashB = await this.computeHash(imageB);

    if (!hashA || !hashB) return null;

    const dist = this.hammingDistance(hashA, hashB);
    return {
      matched: dist <= this.threshold,
      distance: dist,
      confidence: Math.max(0, (this.hashSize * this.hashSize - dist) / (this.hashSize * this.hashSize)),
      hashA,
      hashB,
    };
  }

  /**
   * Compare an Amazon product image against multiple eBay listing images.
   * Returns the best match if any passes the threshold.
   */
  async findBestMatch(amazonImageUrl, ebayListings) {
    if (!this.enabled || !amazonImageUrl) return null;

    // Filter listings that have image URLs
    const listingsWithImages = ebayListings.filter(l => l.imageUrl);
    if (listingsWithImages.length === 0) return null;

    // First, hash the Amazon image
    const amazonHash = await this.computeHash(amazonImageUrl);
    if (!amazonHash) return null;

    let bestDistance = Infinity;
    let bestListing = null;

    // Compare against each eBay listing image (limit to 10 for performance)
    for (const listing of listingsWithImages.slice(0, 10)) {
      const ebayHash = await this.computeHash(listing.imageUrl);
      if (!ebayHash) continue;

      const dist = this.hammingDistance(amazonHash, ebayHash);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestListing = listing;
      }
    }

    if (!bestListing || bestDistance > this.threshold) return null;

    return {
      matched: true,
      distance: bestDistance,
      confidence: Math.max(0, (64 - bestDistance) / 64),
      listing: bestListing,
    };
  }
}

module.exports = ImageMatcher;
