import React, { useState } from 'react';
import { ShoppingCart, Calculator, Target, Activity, ShieldCheck, ChevronRight, LayoutDashboard } from 'lucide-react';
import Dashboard from './Dashboard';
import './index.css';

function App() {
  const [view, setView] = useState('landing');

  return (
    <div className="app">
      <div className="container">
        <nav>
          <div className="logo" onClick={() => setView('landing')} style={{cursor:'pointer'}}>
            <Target size={28} className="text-gradient" />
            Elite Arbitrage
          </div>
          <div style={{display: 'flex', gap: '16px'}}>
            <button className="nav-cta" onClick={() => setView(view === 'landing' ? 'dashboard' : 'landing')} style={{background: 'transparent', border: '1px solid var(--glass-border)'}}>
              <LayoutDashboard size={16} style={{marginRight: '8px', display: 'inline-block', verticalAlign: 'text-bottom'}} />
              {view === 'landing' ? 'Live Dashboard' : 'Back to Home'}
            </button>
            <button className="nav-cta bg-gradient">Download Extension</button>
          </div>
        </nav>

        {view === 'dashboard' ? (
          <Dashboard />
        ) : (
          <section className="hero">
            <div className="hero-glow"></div>
            <h1>Arbitrage with <span className="text-gradient">Elite Precision.</span></h1>
            <p>
              The production-grade Chrome Extension that automatically calculates exact Amazon-to-eBay profit margins, 
              identifies hidden fees, and links directly to eBay sold listings in one click.
            </p>
            
            <button className="cta-button bg-gradient">
              Install to Chrome <ChevronRight size={20} />
            </button>

            <div className="mockup-container">
              <div className="browser-mock">
                <div className="browser-header">
                  <div className="dot red"></div>
                  <div className="dot yellow"></div>
                  <div className="dot green"></div>
                </div>
                <div className="browser-content">
                  <div className="amazon-mock-bg"></div>
                  <div className="extension-overlay">
                    <div className="ext-title">
                      <Activity size={16} className="text-gradient" />
                      Elite Arbitrage Finder
                    </div>
                    <div className="ext-calc-row">
                      <span>Amazon Price</span>
                      <span style={{color: '#fff', fontWeight: 600}}>$49.99</span>
                    </div>
                    <div className="ext-calc-row">
                      <span>Target eBay Sale</span>
                      <span style={{color: '#fff', fontWeight: 600}}>$89.99</span>
                    </div>
                    <div className="ext-calc-row">
                      <span>Fees & Shipping</span>
                      <span>-$18.72</span>
                    </div>
                    <div className="ext-profit text-gradient">
                      +$21.28 Net
                      <span style={{display: 'block', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500}}>ROI: 42.5%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {view === 'landing' && (
        <section className="features">
          <div className="container">
            <div style={{textAlign: 'center', marginBottom: '40px'}}>
              <h2 style={{fontSize: '36px', fontWeight: 800}}>Sourcing Superpowers.</h2>
              <p style={{color: 'var(--text-secondary)'}}>Built for the modern retail arbitrage workflow.</p>
            </div>
            
            <div className="features-grid">
              <div className="feature-card glass-panel">
                <div className="feature-icon">
                  <Calculator size={24} />
                </div>
                <h3>Live Profit Calculator</h3>
                <p>Instantly calculates the complex 13.25% eBay FVF + $0.30 payment processing fees. Never guess your margins again.</p>
              </div>
              
              <div className="feature-card glass-panel">
                <div className="feature-icon">
                  <ShoppingCart size={24} />
                </div>
                <h3>1-Click Sold Search</h3>
                <p>Automatically cleans Amazon product titles and searches eBay Terapeak/Sold listings to verify real sales velocity.</p>
              </div>
              
              <div className="feature-card glass-panel">
                <div className="feature-icon">
                  <ShieldCheck size={24} />
                </div>
                <h3>TOS Compliant Setup</h3>
                <p>Designed for the Retail Arbitrage hold-and-ship model, keeping your accounts safe from automated dropshipping flags.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <footer style={{textAlign: 'center', padding: '40px 0', borderTop: '1px solid var(--glass-border)', marginTop: '80px', color: 'var(--text-secondary)'}}>
        <p>© 2026 Elite Arbitrage. For Professional Specialists.</p>
      </footer>
    </div>
  );
}

export default App;
