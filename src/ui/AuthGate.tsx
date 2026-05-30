import { useEffect, useState } from 'react';
import { listSnapshotKeys } from '../lib/api';
import LoginPage from './LoginPage';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking');

  async function check() {
    try {
      await listSnapshotKeys();
      setState('in');
    } catch (_e) {
      setState('out');
    }
  }

  useEffect(() => {
    check();
  }, []);

  if (state === 'checking') return <div className="p-8 text-slate-500">กำลังโหลด…</div>;
  if (state === 'out') return <LoginPage onSuccess={() => setState('in')} />;
  return <>{children}</>;
}
