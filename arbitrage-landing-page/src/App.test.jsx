import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('Red/Green Loop: Elite Arbitrage Landing Page', () => {
  it('renders the core hero headline', () => {
    render(<App />);
    // Green Loop validation: Ensure the headline is rendered
    const headlineElement = screen.getByText(/Elite Precision/i);
    expect(headlineElement).toBeInTheDocument();
  });

  it('renders the profit calculator mockup', () => {
    render(<App />);
    // Ensure deterministic handoff for the mockup presence
    const profitElement = screen.getByText(/Target eBay Sale/i);
    expect(profitElement).toBeInTheDocument();
  });

  it('renders the three core sourcing superpower features', () => {
    render(<App />);
    expect(screen.getByText('Live Profit Calculator')).toBeInTheDocument();
    expect(screen.getByText('1-Click Sold Search')).toBeInTheDocument();
    expect(screen.getByText('TOS Compliant Setup')).toBeInTheDocument();
  });
});
