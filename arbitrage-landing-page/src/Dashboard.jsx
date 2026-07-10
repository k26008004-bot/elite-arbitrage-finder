import React, { useState, useEffect, useMemo } from 'react';
import { ExternalLink, RefreshCw, AlertCircle, TrendingUp, DollarSign, Activity } from 'lucide-react';

const Dashboard = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('roi'); // 'roi', 'profit', 'cost'
  const [minRoi, setMinRoi] = useState(0);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch('/winning_products.json');
      if (!res.ok) throw new Error("Failed to fetch fresh leads");
      const data = await res.json();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(() => {
      fetchLeads();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="dashboard-container" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 style={{ fontSize: '32px', margin: '0 0 8px 0', background: 'linear-gradient(to right, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Live Arbitrage Leads
          </h2>
          <p style={{ color: '#94a3b8', margin: 0 }}>AutoGLM Scraper continuously sources high-margin products daily.</p>
        </div>
        <button 
          onClick={fetchLeads} 
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
          <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>No leads match your current filters.</p>
        </div>
      )}

      {/* Sourcing Toolkit */}
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

      <div style={{ display: 'grid', gap: '20px' }}>
        {displayedProducts.map((p, i) => (
          <div key={i} style={{ 
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', 
            padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>ASIN: {p.asin}</div>
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
              
              <a 
                href={`https://www.amazon.com/dp/${p.asin}`} 
                target="_blank" 
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px', 
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', padding: '10px 20px', 
                  borderRadius: '8px', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem'
                }}
              >
                Source Deal <ExternalLink size={16} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
