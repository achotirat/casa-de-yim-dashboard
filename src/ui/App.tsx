import { useState } from 'react';
import AuthGate from './AuthGate';
import UploadPage from './UploadPage';
import Dashboard from './Dashboard';

export default function App() {
  const [tab, setTab] = useState<'dashboard' | 'upload'>('dashboard');

  return (
    <AuthGate>
      <div style={{ minHeight: '100vh', background: 'var(--sand)' }}>
        {/* Dark header bar */}
        <header className="cdy-header" style={{
          background: 'linear-gradient(150deg, var(--shell-1), var(--shell-2))',
          padding: '0 24px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}>
          {/* Brandmark */}
          <div style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(140deg, var(--accent), var(--accent-2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 22,
            fontFamily: "'Cormorant Garamond', serif", fontWeight: 700,
            boxShadow: '0 6px 16px -8px rgba(0,0,0,.5)',
          }}>Y</div>
          {/* Wordmark */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 20, color: '#fff', lineHeight: 1 }}>
              Casa de Yim
            </span>
            <span className="cdy-wordmark-sub" style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>
              Krabi · Dashboard
            </span>
          </div>
          {/* Tab nav */}
          <nav className="cdy-tab-nav" style={{ display: 'flex', gap: 20, marginLeft: 20 }}>
            {(['dashboard', 'upload'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '4px 0',
                  fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 700,
                  letterSpacing: '1.2px', textTransform: 'uppercase',
                  color: tab === t ? '#fff' : 'rgba(255,255,255,.45)',
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'color .15s',
                }}
              >
                {t === 'dashboard' ? 'Dashboard' : 'อัปโหลด'}
              </button>
            ))}
          </nav>
        </header>

        {/* Content panel */}
        <main className="cdy-main" style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
          <div className="cdy-panel" style={{
            background: 'var(--panel)',
            borderRadius: 28,
            padding: '24px 28px 32px',
            minHeight: 'calc(100vh - 92px)',
          }}>
            {tab === 'dashboard'
              ? <Dashboard />
              : <UploadPage onSaved={() => setTab('dashboard')} />}
          </div>
        </main>
      </div>
    </AuthGate>
  );
}
