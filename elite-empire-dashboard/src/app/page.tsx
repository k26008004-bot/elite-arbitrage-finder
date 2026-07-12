'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, TrendingUp, AlertCircle, ShieldAlert, BadgeCheck } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

export default function Home() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to real-time opportunities from Firebase
    try {
      const q = query(
        collection(db, 'opportunities'),
        orderBy('compositeScore', 'desc'),
        limit(20)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const opps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOpportunities(opps);
        setLoading(false);
      }, (error) => {
        console.error("Firebase error:", error);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('Firebase is likely unconfigured. Showing mock data.');
      setOpportunities([
        {
          id: '1',
          tierEmoji: '🥇',
          tier: 'Elite',
          title: 'Sony PlayStation 5 Console - Disk Edition',
          amazonPrice: 499.00,
          ebayAvgSoldPrice: 650.00,
          netProfit: 45.20,
          roiPct: 22.4,
          compositeScore: 92.5,
          matchMethod: 'UPC Match',
          aiListing: {
            seoTitle: "Sony PlayStation 5 PS5 Console Disk Edition NEW FAST SHIP",
          }
        },
        {
          id: '2',
          tierEmoji: '🥈',
          tier: 'Strong',
          title: 'Apple AirPods Pro (2nd Generation)',
          amazonPrice: 199.00,
          ebayAvgSoldPrice: 245.00,
          netProfit: 15.10,
          roiPct: 18.2,
          compositeScore: 81.0,
          matchMethod: 'pHash Image Match',
        }
      ]);
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center"
        >
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              Elite Empire Control Center
            </h1>
            <p className="text-gray-400 mt-2">Real-Time Amazon → eBay Arbitrage Engine</p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-gray-800/50 backdrop-blur-md border border-gray-700 rounded-xl px-4 py-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium">Scraping Active</span>
            </div>
          </div>
        </motion.div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Feed */}
          <div className="col-span-1 lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Live Opportunities
            </h2>

            {loading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-gray-800/40 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {opportunities.map((opp, idx) => (
                  <motion.div 
                    key={opp.id || idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 hover:border-blue-500/50 transition-all rounded-2xl p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{opp.tierEmoji}</span>
                          <span className={\`px-3 py-1 rounded-full text-xs font-bold \${
                            opp.tier === 'Elite' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 
                            'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }\`}>
                            {opp.tier} TIER
                          </span>
                          <span className="text-gray-400 text-sm flex items-center gap-1">
                            <BadgeCheck className="w-4 h-4 text-emerald-400" />
                            {opp.matchMethod}
                          </span>
                        </div>
                        <h3 className="text-lg font-medium leading-tight truncate pr-4" title={opp.title}>
                          {opp.title}
                        </h3>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-400">+${opp.netProfit?.toFixed(2)}</div>
                        <div className="text-sm text-gray-400">{opp.roiPct}% ROI</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-gray-700/30">
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Score</div>
                        <div className="text-lg font-semibold">{opp.compositeScore?.toFixed(1)}/100</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Amazon Buy</div>
                        <div className="text-lg">${opp.amazonPrice?.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">eBay Sold</div>
                        <div className="text-lg">${opp.ebayAvgSoldPrice?.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">AI SEO Title</div>
                        <div className="text-sm text-gray-300 truncate" title={opp.aiListing?.seoTitle || 'Generating...'}>
                          {opp.aiListing?.seoTitle || 'Generating...'}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-2">
                      <button className="flex-1 bg-blue-600 hover:bg-blue-500 transition-colors py-2 rounded-lg font-medium flex items-center justify-center gap-2">
                        <ShoppingBag className="w-4 h-4" />
                        Buy on Amazon
                      </button>
                      <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 transition-colors py-2 rounded-lg font-medium">
                        Export to eBay
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            
            {/* Empire Stats */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold mb-4">Empire Stats (24h)</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Scanned Items</span>
                  <span className="font-mono font-bold text-xl">12,408</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Elite Deals Found</span>
                  <span className="font-mono font-bold text-xl text-amber-400">34</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Projected Profit</span>
                  <span className="font-mono font-bold text-xl text-emerald-400">$1,420.50</span>
                </div>
              </div>
            </motion.div>

            {/* Repricer Monitor Alerts */}
            <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Repricer Alerts
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <div className="text-sm font-medium text-rose-300">Amazon Out of Stock</div>
                  <div className="text-xs text-gray-400">ASIN: B08FC5L3RG (AirTags)</div>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="text-sm font-medium text-amber-300">Price Increased +$5</div>
                  <div className="text-xs text-gray-400">ASIN: B09G9D7K6S (AirPods Pro)</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
