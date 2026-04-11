import { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { SenderPanel } from './components/SenderPanel';
import { ReceiverPanel } from './components/ReceiverPanel';
import { ForensicPanel } from './components/ForensicPanel';
import { ActivityLog } from './components/ActivityLog';
import { StatusBar } from './components/StatusBar';

type Tab = 'sender' | 'receiver' | 'analysis' | 'log';

const TABS: { id: Tab; label: string; icon: string; accentVar: string }[] = [
  { id: 'sender',   label: 'Command: Encode',    icon: '🔒', accentVar: 'var(--primary)'   },
  { id: 'receiver', label: 'Command: Decode',    icon: '🔓', accentVar: 'var(--secondary)' },
  { id: 'analysis', label: 'Forensic Analysis', icon: '🕵️', accentVar: 'var(--accent)'    },
  { id: 'log',      label: 'Activity Log',      icon: '📋', accentVar: '#ffd700'          },
];

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('sender');

  return (
    <div className="app-container" style={{ paddingBottom: '3.5rem' }}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <header style={{ textAlign: 'center', padding: '2.5rem 0 1.5rem' }}>
        <h1 style={{
          fontSize: '2.8rem',
          fontWeight: 800,
          letterSpacing: '-1px',
          background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 12px rgba(0,242,255,0.4))',
          marginBottom: '0.4rem',
        }}>
          STEGANO<span style={{ fontFamily: 'Fira Code, monospace' }}>VAULT</span> v2
        </h1>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'Fira Code, monospace', fontSize: '0.85rem', letterSpacing: '2px' }}>
          ADVANCED CYBER-SECURITY STEGANOGRAPHY SUITE
        </p>
      </header>

      {/* ── Tab Navigation ─────────────────────────────────────────── */}
      <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="mono"
            style={{
              padding: '0.65rem 1.4rem',
              cursor: 'pointer',
              background: activeTab === tab.id ? `rgba(${tab.id === 'sender' ? '0,242,255' : tab.id === 'receiver' ? '188,0,255' : tab.id === 'analysis' ? '0,255,65' : '255,215,0'},0.1)` : 'transparent',
              border: `1px solid ${activeTab === tab.id ? tab.accentVar : 'var(--border)'}`,
              color: activeTab === tab.id ? tab.accentVar : 'var(--text-muted)',
              borderRadius: '4px',
              fontSize: '0.8rem',
              letterSpacing: '0.5px',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === tab.id ? `0 0 10px rgba(${tab.id === 'sender' ? '0,242,255' : tab.id === 'receiver' ? '188,0,255' : tab.id === 'analysis' ? '0,255,65' : '255,215,0'},0.2)` : 'none',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Main Panel ─────────────────────────────────────────────── */}
      <main
        style={{
          background: 'rgba(15,15,22,0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '2rem',
          minHeight: '62vh',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div hidden={activeTab !== 'sender'}><SenderPanel /></div>
        <div hidden={activeTab !== 'receiver'}><ReceiverPanel /></div>
        <div hidden={activeTab !== 'analysis'}><ForensicPanel /></div>
        <div hidden={activeTab !== 'log'}><ActivityLog /></div>
      </main>

      {/* ── Status Bar ─────────────────────────────────────────────── */}
      <StatusBar />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
