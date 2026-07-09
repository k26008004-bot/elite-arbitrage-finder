import React, { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';

const Dashboard = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      // Fetches the JSON file written by the GitHub Actions scraper
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
  }, []);

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

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {!loading && products.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '60px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>No high-margin products found in the latest scan. AutoGLM will run again tonight.</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: '20px' }}>
        {products.map((p, i) => (
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
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171' }}>${p.price.toFixed(2)}</div>
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
