'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, TrendingUp, AlertCircle, ShieldAlert, BadgeCheck, 
  Filter, X, Copy, ExternalLink, Activity, DollarSign, Target, Zap
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

export default function Home() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Advanced Features State
  const [selectedOpp, setSelectedOpp] = useState<any | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'profit' | 'roi' | 'velocity'>('score');
  const [filterTier, setFilterTier] = useState<string>('All');

  useEffect(() => {
    try {
      const q = query(
        collection(db, 'opportunities'),
        orderBy('compositeScore', 'desc'),
        limit(50)
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
          asin: 'B08FC5L3RG',
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
            htmlDescription: "<h1>Brand New PS5</h1><p>Fast Shipping!</p>"
          },
          breakdown: { Margin: 40, Velocity: 30, Competition: 15, Risk: 7.5 }
        },
        {
          id: '2',
          asin: 'B09G9D7K6S',
          tierEmoji: '🥈',
          tier: 'Strong',
          title: 'Apple AirPods Pro (2nd Generation)',
          amazonPrice: 199.00,
          ebayAvgSoldPrice: 245.00,
          netProfit: 15.10,
          roiPct: 18.2,
          compositeScore: 81.0,
          matchMethod: 'pHash Image Match',
          breakdown: { Margin: 30, Velocity: 25, Competition: 10, Risk: 15 }
        }
      ]);
      setLoading(false);
    }
  }, []);

  // Compute Dynamic Stats
  const stats = useMemo(() => {
    let totalProfit = 0;
    let eliteCount = 0;
    opportunities.forEach(o => {
      totalProfit += (o.netProfit || 0);
      if (o.tier === 'Elite') eliteCount++;
    });
    return { totalProfit, eliteCount, totalScanned: opportunities.length * 15 }; // Estimated multiplier for scanned
  }, [opportunities]);

  // Apply Sorting and Filtering
  const filteredAndSorted = useMemo(() => {
    let result = [...opportunities];
    
    if (filterTier !== 'All') {
      result = result.filter(o => o.tier === filterTier);
    }
    
    result.sort((a, b) => {
      if (sortBy === 'score') return (b.compositeScore || 0) - (a.compositeScore || 0);
      if (sortBy === 'profit') return (b.netProfit || 0) - (a.netProfit || 0);
      if (sortBy === 'roi') return (b.roiPct || 0) - (a.roiPct || 0);
      if (sortBy === 'velocity') return (b.breakdown?.Velocity || 0) - (a.breakdown?.Velocity || 0);
      return 0;
    });
    
    return result;
  }, [opportunities, filterTier, sortBy]);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    alert('Listing details copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white p-4 md:p-8 font-sans overflow-x-hidden">
      {/* Background Glow */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 blur-[150px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">
              Elite Empire Control Center
            </h1>
            <p className="text-gray-400 mt-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Real-Time Amazon → eBay Arbitrage Engine
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-gray-800/50 backdrop-blur-md border border-gray-700 rounded-xl px-4 py-2 flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium">Engine Active</span>
            </div>
          </div>
        </motion.div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Feed */}
          <div className="col-span-1 lg:col-span-2 space-y-6">
            
            {/* Filter & Sort Controls */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row justify-between items-center bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4 gap-4"
            >
              <div className="flex flex-wrap gap-2">
                {['All', 'Elite', 'Strong', 'Watch'].map(tier => (
                  <button
                    key={tier}
                    onClick={() => setFilterTier(tier)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      filterTier === tier 
                        ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] scale-105' 
                        : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-gray-800 border border-gray-700 text-sm rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white w-full sm:w-auto cursor-pointer transition-colors hover:border-gray-500"
                >
                  <option value="score">Sort by Composite Score</option>
                  <option value="profit">Sort by Net Profit</option>
                  <option value="roi">Sort by ROI %</option>
                  <option value="velocity">Sort by Sales Velocity</option>
                </select>
              </div>
            </motion.div>

            {loading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-40 bg-gray-800/40 rounded-2xl border border-gray-700/50" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAndSorted.map((opp, idx) => (
                  <motion.div 
                    key={opp.id || idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => setSelectedOpp(opp)}
                    className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 rounded-2xl p-6 cursor-pointer group hover:shadow-[0_0_30px_rgba(37,99,235,0.1)] hover:-translate-y-1"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl drop-shadow-md">{opp.tierEmoji}</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                            opp.tier === 'Elite' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 
                            opp.tier === 'Strong' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                            'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}>
                            {opp.tier} TIER
                          </span>
                          <span className="text-gray-400 text-sm flex items-center gap-1 bg-gray-900/50 px-2 py-1 rounded-md border border-gray-800">
                            <BadgeCheck className="w-3 h-3 text-emerald-400" />
                            {opp.matchMethod}
                          </span>
                        </div>
                        <h3 className="text-lg font-medium leading-tight truncate pr-4 group-hover:text-blue-400 transition-colors" title={opp.title}>
                          {opp.title}
                        </h3>
                      </div>
                      
                      <div className="text-right bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
                        <div className="text-2xl font-bold text-emerald-400">+${opp.netProfit?.toFixed(2)}</div>
                        <div className="text-sm font-medium text-emerald-500/80">{opp.roiPct}% ROI</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-gray-700/30">
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Target className="w-3 h-3"/> Score</div>
                        <div className="text-lg font-semibold">{opp.compositeScore?.toFixed(1)}/100</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><ShoppingBag className="w-3 h-3"/> Amazon</div>
                        <div className="text-lg">${opp.amazonPrice?.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> eBay</div>
                        <div className="text-lg">${opp.ebayAvgSoldPrice?.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Activity className="w-3 h-3"/> Velocity</div>
                        <div className="text-lg font-medium text-blue-400">{opp.breakdown?.Velocity || 0} pts</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {filteredAndSorted.length === 0 && !loading && (
                  <div className="text-center py-12 bg-gray-800/20 rounded-2xl border border-gray-700/30 border-dashed">
                    <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-400">No opportunities found</h3>
                    <p className="text-sm text-gray-500">Try adjusting your filters.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            
            {/* Dynamic Empire Stats */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(79,70,229,0.1)] relative overflow-hidden"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                Empire Stats (24h)
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-900/40 rounded-xl border border-gray-700/50">
                  <span className="text-gray-400 text-sm">Estimated Scans</span>
                  <span className="font-mono font-bold text-lg">{stats.totalScanned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-900/40 rounded-xl border border-gray-700/50">
                  <span className="text-gray-400 text-sm">Elite Deals</span>
                  <span className="font-mono font-bold text-lg text-amber-400">{stats.eliteCount}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-indigo-900/40 rounded-xl border border-indigo-500/30">
                  <span className="text-indigo-200 text-sm">Available Profit</span>
                  <span className="font-mono font-bold text-2xl text-emerald-400 drop-shadow-md">
                    ${stats.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Repricer Alerts */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Repricer Alerts
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 transition-colors cursor-pointer">
                  <div className="text-sm font-medium text-rose-300">Amazon Out of Stock</div>
                  <div className="text-xs text-gray-400 mt-1">ASIN: B08FC5L3RG (AirTags)</div>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition-colors cursor-pointer">
                  <div className="text-sm font-medium text-amber-300">Price Increased +$5</div>
                  <div className="text-xs text-gray-400 mt-1">ASIN: B09G9D7K6S (AirPods Pro)</div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>

      {/* Interactive Detail Modal */}
      <AnimatePresence>
        {selectedOpp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedOpp(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#111827] border border-gray-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative z-10 shadow-2xl"
            >
              <button 
                onClick={() => setSelectedOpp(null)}
                className="absolute top-4 right-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-8 space-y-8">
                {/* Modal Header */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{selectedOpp.tierEmoji}</span>
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                      {selectedOpp.tier} Tier Opportunity
                    </span>
                  </div>
                  <h2 className="text-2xl font-medium leading-tight pr-8">{selectedOpp.title}</h2>
                  <p className="text-gray-400 text-sm mt-2 flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 text-blue-400" /> Match Method: {selectedOpp.matchMethod}
                  </p>
                </div>

                {/* Financials Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                    <div className="text-sm text-gray-400 mb-1">Amazon Cost</div>
                    <div className="text-xl font-bold">${selectedOpp.amazonPrice?.toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                    <div className="text-sm text-gray-400 mb-1">eBay Avg Sold</div>
                    <div className="text-xl font-bold">${selectedOpp.ebayAvgSoldPrice?.toFixed(2)}</div>
                  </div>
                  <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/30">
                    <div className="text-sm text-emerald-400 mb-1">Net Profit</div>
                    <div className="text-xl font-bold text-emerald-400">+${selectedOpp.netProfit?.toFixed(2)}</div>
                  </div>
                  <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/30">
                    <div className="text-sm text-blue-400 mb-1">ROI</div>
                    <div className="text-xl font-bold text-blue-400">{selectedOpp.roiPct}%</div>
                  </div>
                </div>

                {/* Algorithmic Breakdown */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    Engine Breakdown Score: {selectedOpp.compositeScore?.toFixed(1)}/100
                  </h3>
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex flex-wrap gap-6">
                    <div><span className="text-gray-500 text-sm">Margin:</span> <span className="font-medium text-emerald-400">{selectedOpp.breakdown?.Margin || 0} pts</span></div>
                    <div><span className="text-gray-500 text-sm">Velocity:</span> <span className="font-medium text-blue-400">{selectedOpp.breakdown?.Velocity || 0} pts</span></div>
                    <div><span className="text-gray-500 text-sm">Competition:</span> <span className="font-medium text-amber-400">{selectedOpp.breakdown?.Competition || 0} pts</span></div>
                    <div><span className="text-gray-500 text-sm">Risk Deductions:</span> <span className="font-medium text-rose-400">-{selectedOpp.breakdown?.Risk || 0} pts</span></div>
                  </div>
                </div>

                {/* AI Listing Section */}
                {selectedOpp.aiListing && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-400" />
                        AI-Generated eBay SEO Listing
                      </span>
                      <button 
                        onClick={() => copyToClipboard(`${selectedOpp.aiListing?.seoTitle}\n\n${selectedOpp.aiListing?.htmlDescription}`)}
                        className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors text-gray-300"
                      >
                        <Copy className="w-4 h-4" /> Copy All
                      </button>
                    </h3>
                    <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-5 space-y-4">
                      <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Optimized Title</div>
                        <div className="font-medium text-white">{selectedOpp.aiListing.seoTitle || 'Title pending...'}</div>
                      </div>
                      <div className="h-px bg-gray-800 w-full" />
                      <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">HTML Description snippet</div>
                        <div className="text-sm text-gray-400 font-mono whitespace-pre-wrap">
                          {selectedOpp.aiListing.htmlDescription?.substring(0, 150) || 'Description pending...'}...
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                  <a 
                    href={`https://amazon.com/dp/${selectedOpp.asin || ''}`}
                    target="_blank" rel="noreferrer"
                    className="bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors border border-gray-700"
                  >
                    <ExternalLink className="w-4 h-4" /> View on Amazon
                  </a>
                  <button 
                    onClick={() => copyToClipboard(selectedOpp.aiListing?.seoTitle || selectedOpp.title)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                  >
                    <ShoppingBag className="w-4 h-4" /> Draft on eBay
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
