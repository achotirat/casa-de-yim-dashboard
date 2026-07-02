import { useEffect, useState } from 'react';
import AuthGate from './AuthGate';
import UploadPage from './UploadPage';
import Dashboard from './Dashboard';
import HousekeepingView from './components/HousekeepingView';
import { loadSnapshots, type LoadedSnapshots } from './dashboardData';
import { getSnapshot, logout, type Role } from '../lib/api';
import type { ArrivalsReport } from '../types';

function OwnerShell() {
  const [tab, setTab] = useState<'dashboard' | 'housekeeping' | 'upload'>('dashboard');
  const [data, setData] = useState<LoadedSnapshots | null>(null);

  useEffect(() => {
    loadSnapshots().then(setData);
  }, []);

  const TAB_LABEL: Record<typeof tab, string> = {
    dashboard: 'Dashboard',
    housekeeping: 'แม่บ้าน',
    upload: 'อัปโหลด',
  };

  function refetch() {
    setData(null);
    loadSnapshots().then(setData);
  }

  return (
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
          {(['dashboard', 'housekeeping', 'upload'] as const).map((t) => (
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
              {TAB_LABEL[t]}
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
          {!data && <div className="text-slate-500">กำลังโหลด…</div>}
          {data && tab === 'dashboard' && <Dashboard data={data} />}
          {data && tab === 'housekeeping' && <HousekeepingView arrivals={data.latest?.arrivals} />}
          {tab === 'upload' && <UploadPage onSaved={() => { setTab('dashboard'); refetch(); }} />}
        </div>
      </main>
    </div>
  );
}

function HousekeeperShell() {
  const [arrivals, setArrivals] = useState<ArrivalsReport | undefined>(undefined);

  useEffect(() => {
    // housekeeper role: /api/snapshots ignores the key param and always returns the latest snapshot, pre-stripped (see Task 5)
    getSnapshot('latest').then((data) => setArrivals(data.arrivals));
  }, []);

  async function onLogout() {
    await logout();
    window.location.reload();
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand)', padding: 16 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <HousekeepingView arrivals={arrivals} onLogout={onLogout} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      {(role: Role) => (role === 'owner' ? <OwnerShell /> : <HousekeeperShell />)}
    </AuthGate>
  );
}
