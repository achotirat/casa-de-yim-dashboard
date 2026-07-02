import { useState } from 'react';
import { login, type Role } from '../lib/api';

export default function LoginPage({ onSuccess }: { onSuccess: (role: Role) => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const result = await login(pw);
    setBusy(false);
    if (result.ok && result.role) onSuccess(result.role);
    else setError(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl shadow w-80 space-y-4">
        <h1 className="text-xl font-bold text-slate-800">Casa de Yim</h1>
        <p className="text-sm text-slate-500">ใส่รหัสผ่านเพื่อเข้าใช้งาน</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="รหัสผ่าน"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">รหัสผ่านไม่ถูกต้อง</p>}
        <button disabled={busy} className="w-full bg-slate-800 text-white rounded py-2 disabled:opacity-50">
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  );
}
