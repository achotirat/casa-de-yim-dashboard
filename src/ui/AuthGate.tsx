import { useEffect, useState } from 'react';
import { whoami, type Role } from '../lib/api';
import LoginPage from './LoginPage';

export default function AuthGate({ children }: { children: (role: Role) => React.ReactNode }) {
  const [role, setRole] = useState<Role | null | 'checking'>('checking');

  useEffect(() => {
    whoami().then(setRole);
  }, []);

  if (role === 'checking') return <div className="p-8 text-slate-500">กำลังโหลด…</div>;
  if (role === null) return <LoginPage onSuccess={setRole} />;
  return <>{children(role)}</>;
}
