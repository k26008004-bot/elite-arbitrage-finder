import React, { useState, useEffect, useMemo } from 'react';
import { ExternalLink, RefreshCw, AlertCircle, TrendingUp, DollarSign, Activity, Download, Search, BarChart2, Cloud } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ref, onValue } from 'firebase/database';
import { db } from './firebase_config';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'vault'
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('roi'); // 'roi', 'profit', 'cost'
  const [minRoi, setMinRoi] = useState(0);
  const [toastMsg, setToastMsg] = useState(null);

  const fetchLeads = async (tab = activeTab) => {
    try {
      setLoading(true);
      const url = tab === 'live' ? '/winning_products.json' : '/archive.json';
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      
      // Check for new deals to trigger toast (only in live mode)
      if (tab === 'live' && products.length > 0 && data.length > 0 && products[0].asin !== data[0].asin) {
        setToastMsg(`🚀 New Deal Found: ${data[0].title.substring(0, 40)}...`);
        setTimeout(() => setToastMsg(null), 5000);
      }
      
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Run fetch when tab changes
  useEffect(() => {
    // If Firebase is configured, use it
    if (db) {
      setLoading(true);
      const dbPath = activeTab === 'live' ? 'winning_products' : 'archive';
      const dealsRef = ref(db, dbPath);
      
      const unsubscribe = onValue(dealsRef, (snapshot) => {
        const data = snapshot.val();
        let parsedData = [];
        
        if (data) {
          // If data is an array
          if (Array.isArray(data)) {
            parsedData = data;
          } else {
            // If data is an object, convert to array
            parsedData = Object.values(data);
          }
        }
        
        // Trigger Toast for new deals in live mode
        if (activeTab === 'live' && products.length > 0 && parsedData.length > 0 && products[0].asin !== parsedData[0].asin) {
          setToastMsg(`🚀 Cloud Deal Found: ${parsedData[0].title.substring(0, 40)}...`);
          setTimeout(() => setToastMsg(null), 5000);
        }
        
        setProducts(parsedData);
        setLoading(false);
        setError(null);
      }, (err) => {
        setError("Firebase Sync Error: " + err.message);
        setLoading(false);
      });
      
      return () => unsubscribe();
    } else {
      // Fallback to local JSON polling if Firebase is not configured
      fetchLeads(activeTab);
      const interval = setInterval(() => {
        if (activeTab === 'live') {
          fetchLeads('live');
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Compute Analytics
  const parseROI = (roiStr) => parseFloat(roiStr.replace('%', ''));
  const parseProfit = (profitStr) => parseFloat(profitStr);
  
  const analytics = useMemo(() => {
    if (products.length === 0) return { avgRoi: 0, maxProfit: 0, total: 0 };
    const total = products.length;
    const avgRoi = products.reduce((acc, p) => acc + parseROI(p.roi), 0) / total;
    const maxProfit = Math.max(...products.map(p => parseProfit(p.netProfit)));
    return { avgRoi: avgRoi.toFixed(2), maxProfit: maxProfit.toFixed(2), total };
  }, [products]);

  // CSV Export Engine
  const downloadCSV = () => {
    if (products.length === 0) return;
    const headers = ['ASIN', 'Title', 'Amazon Price', 'Est eBay Price', 'Net Profit', 'ROI'];
    const rows = products.map(p => [
      p.asin, `"${p.title.replace(/"/g, '""')}"`, p.price, p.estimatedEbayPrice, p.netProfit, p.roi
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `elite_arbitrage_leads_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter and Sort Engine
  const displayedProducts = useMemo(() => {
    let filtered = products.filter(p => parseROI(p.roi) >= minRoi);
    
    return filtered.sort((a, b) => {
      if (sortBy === 'roi') return parseROI(b.roi) - parseROI(a.roi);
      if (sortBy === 'profit') return parseProfit(b.netProfit) - parseProfit(a.netProfit);
      if (sortBy === 'cost') return parseFloat(a.price) - parseFloat(b.price);
      return 0;
    });
  }, [products, sortBy, minRoi]);

  // Prepare Chart Data
  const chartData = useMemo(() => {
    if (activeTab !== 'vault' || products.length === 0) return [];
    // Sort archive ascending by time to show trend over time
    const sorted = [...products].reverse();
    return sorted.map((p, i) => ({
      name: `Deal ${i+1}`,
      profit: parseFloat(p.netProfit),
      title: p.title.substring(0, 20) + '...'
    }));
  }, [products, activeTab]);

  return (
    <div className="dashboard-container" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity size={36} className="text-gradient" /> 
          Dashboard 
          {db && <Cloud size={24} color="#4ade80" title="Connected to Firebase Cloud" style={{ marginLeft: '10px' }} />}
        </h1>
        <div>
          <h2 style={{ fontSize: '32px', margin: '0 0 8px 0', background: 'linear-gradient(to right, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {activeTab === 'live' ? 'Live Arbitrage Leads' : 'Permanent Deals Vault'}
          </h2>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            {activeTab === 'live' ? 'AutoGLM Scraper continuously sources high-margin products daily.' : 'Historical archive of all profitable products discovered by AutoGLM.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={downloadCSV} 
            disabled={products.length === 0}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)',
              color: '#4ade80', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 
            }}
          >
            <Download size={18} />
            Export CSV
          </button>
          <button 
            onClick={() => fetchLeads(activeTab)} 
            disabled={loading}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
              color: 'white', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' 
            }}
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs UI */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
        <button 
          onClick={() => setActiveTab('live')}
          style={{
            background: activeTab === 'live' ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
            border: activeTab === 'live' ? '1px solid rgba(96, 165, 250, 0.5)' : '1px solid transparent',
            color: activeTab === 'live' ? '#60a5fa' : '#94a3b8',
            padding: '12px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <Activity size={18} /> Live Radar
        </button>
        <button 
          onClick={() => setActiveTab('vault')}
          style={{
            background: activeTab === 'vault' ? 'rgba(192, 132, 252, 0.2)' : 'transparent',
            border: activeTab === 'vault' ? '1px solid rgba(192, 132, 252, 0.5)' : '1px solid transparent',
            color: activeTab === 'vault' ? '#c084fc' : '#94a3b8',
            padding: '12px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <TrendingUp size={18} /> Deals Vault
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(96, 165, 250, 0.1)', padding: '12px', borderRadius: '50%' }}><Activity color="#60a5fa" size={24}/></div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total Active Leads</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{analytics.total}</div>
          </div>
        </div>
        <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(192, 132, 252, 0.1)', padding: '12px', borderRadius: '50%' }}><TrendingUp color="#c084fc" size={24}/></div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Average ROI</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{analytics.avgRoi}%</div>
          </div>
        </div>
        <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(74, 222, 128, 0.1)', padding: '12px', borderRadius: '50%' }}><DollarSign color="#4ade80" size={24}/></div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Highest Profit Margin</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>+${analytics.maxProfit}</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', background: 'var(--glass-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '8px' }}>Sort By</label>
          <select 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value)}
            style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '6px' }}
          >
            <option value="roi">Highest ROI</option>
            <option value="profit">Highest Net Profit</option>
            <option value="cost">Lowest Buy Cost</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '8px' }}>Minimum ROI Filter: {minRoi}%</label>
          <input 
            type="range" 
            min="0" max="100" 
            value={minRoi} 
            onChange={e => setMinRoi(parseInt(e.target.value))}
            style={{ width: '100%', marginTop: '8px' }}
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {!loading && displayedProducts.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '60px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', marginBottom: '24px' }}>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>{activeTab === 'live' ? 'No leads match your current filters.' : 'The Deals Vault is currently empty.'}</p>
        </div>
      )}

      {/* Sourcing Toolkit (Only visible in Live mode) */}
      {activeTab === 'live' && (
      <div style={{ marginBottom: '32px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '24px', borderRadius: '12px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} /> Professional Sourcing Toolkit
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <a href="https://keepa.com/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} className="tool-card">
            <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Keepa <ExternalLink size={14} color="#94a3b8" /></div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Amazon price history charts & alerts</div>
          </a>
          <a href="https://camelcamelcamel.com/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} className="tool-card">
            <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>CamelCamelCamel <ExternalLink size={14} color="#94a3b8" /></div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Free Amazon price tracker alternative</div>
          </a>
          <a href="https://www.terapeak.com/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} className="tool-card">
            <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>eBay Terapeak <ExternalLink size={14} color="#94a3b8" /></div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>eBay sold price data & insights</div>
          </a>
          <a href="https://www.zikanalytics.com/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} className="tool-card">
            <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>ZIK Analytics <ExternalLink size={14} color="#94a3b8" /></div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Arbitrage-specific product finder</div>
          </a>
          <a href="https://tacticalarbitrage.com/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} className="tool-card">
            <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>TacticalArbitrage <ExternalLink size={14} color="#94a3b8" /></div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Scans Amazon vs eBay for price gaps</div>
          </a>
          <a href="https://www.reddit.com/r/Flipping/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} className="tool-card">
            <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>r/Flipping <ExternalLink size={14} color="#94a3b8" /></div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Community intelligence on trending flips</div>
          </a>
          <a href="https://www.reddit.com/r/legodeal/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} className="tool-card">
            <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>r/legodeal <ExternalLink size={14} color="#94a3b8" /></div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>LEGO-specific deal alerts & tracking</div>
          </a>
        </div>
      </div>
      )}

      {/* Analytics Chart (Only visible in Vault mode) */}
      {activeTab === 'vault' && products.length > 0 && (
        <div style={{ marginBottom: '32px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '24px', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={20} /> Vault Profitability Trends
          </h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <Tooltip 
                  contentStyle={{ background: 'rgba(18, 18, 20, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#4ade80', fontWeight: 600 }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="profit" name="Net Profit" stroke="#4ade80" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: '20px' }}>
        {displayedProducts.map((p, i) => (
          <div key={i} style={{ 
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', 
            padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>ASIN: {p.asin}</div>
                {p.timestamp && <div style={{ fontSize: '0.8rem', color: '#60a5fa' }}>Found: {new Date(p.timestamp).toLocaleString()}</div>}
              </div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', fontWeight: 600 }}>{p.title}</h3>
              <div style={{ display: 'flex', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Buy (Amazon)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171' }}>${parseFloat(p.price).toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Sell (eBay)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ade80' }}>${parseFloat(p.estimatedEbayPrice).toFixed(2)}</div>
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '32px', minWidth: '180px' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Estimated Profit</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#60a5fa', marginBottom: '4px' }}>+${parseFloat(p.netProfit).toFixed(2)}</div>
              <div style={{ fontSize: '1rem', color: '#c084fc', fontWeight: 600, marginBottom: '16px' }}>{p.roi} ROI</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <a 
                  href={`https://www.amazon.com/dp/${p.asin}`} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', padding: '10px 20px', 
                    borderRadius: '8px', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem'
                  }}
                >
                  Source Deal <ExternalLink size={16} />
                </a>
                <a 
                  href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(p.title)}+sold&_sacat=0&LH_Sold=1&LH_Complete=1`} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 20px', 
                    borderRadius: '8px', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                  eBay Comps <Search size={16} />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: '30px', right: '30px', 
          background: 'rgba(18, 18, 20, 0.9)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(96, 165, 250, 0.5)', borderRadius: '12px',
          padding: '16px 24px', color: 'white', fontWeight: 600,
          boxShadow: '0 20px 40px rgba(0, 201, 255, 0.2), 0 0 20px rgba(96, 165, 250, 0.1)',
          animation: 'slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          zIndex: 9999
        }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
