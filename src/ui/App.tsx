import { useState } from 'react';
import AuthGate from './AuthGate';
import UploadPage from './UploadPage';
import Dashboard from './Dashboard';

export default function App() {
  const [tab, setTab] = useState<'dashboard' | 'upload'>('dashboard');
  return (
    <AuthGate>
      <div className="min-h-screen bg-slate-100">
        <header className="bg-white border-b px-6 py-3 flex items-center gap-4">
          <h1 className="font-bold text-slate-800">Casa de Yim</h1>
          <nav className="flex gap-2 text-sm">
            <button onClick={() => setTab('dashboard')} className={tab === 'dashboard' ? 'font-semibold text-slate-900' : 'text-slate-500'}>Dashboard</button>
            <button onClick={() => setTab('upload')} className={tab === 'upload' ? 'font-semibold text-slate-900' : 'text-slate-500'}>อัปโหลด</button>
          </nav>
        </header>
        <main className="p-6">
          {tab === 'dashboard' ? <Dashboard /> : <UploadPage onSaved={() => setTab('dashboard')} />}
        </main>
      </div>
    </AuthGate>
  );
}
