'use client';

import { useEffect, useState } from 'react';
import { Settings, Lock, User, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface Me { id: string; email: string; name: string; role: string }

const inputCls =
  'w-full h-11 rounded-xl bg-slate-800 border border-slate-700 px-3 text-sm text-slate-100 ' +
  'placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block';

export default function SettingsPage() {
  const { toast } = useToast();
  const [me, setMe] = useState<Me | null>(null);

  // Profile form
  const [profile, setProfile] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Voucher secret form
  const [voucherSecret, setVoucherSecret] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [savingSecret, setSavingSecret] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setMe(j.data);
          setProfile((p) => ({ ...p, name: j.data.name ?? '', email: j.data.email ?? '' }));
        }
      });

    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setVoucherSecret(j.data.voucher_secret ?? '');
      });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (profile.password && profile.password !== profile.confirmPassword) {
      toast('Passwords do not match', 'error');
      return;
    }
    setSavingProfile(true);
    const body: Record<string, string> = {};
    if (profile.name) body.name = profile.name;
    if (profile.email) body.email = profile.email;
    if (profile.password) body.password = profile.password;

    const res = await fetch(`/api/admin/users/${me!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSavingProfile(false);
    if (json.success) {
      toast('Profile updated', 'success');
      setProfile((p) => ({ ...p, password: '', confirmPassword: '' }));
    } else {
      toast(json.error, 'error');
    }
  }

  async function saveVoucherSecret(e: React.FormEvent) {
    e.preventDefault();
    setSavingSecret(true);
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voucher_secret: newSecret }),
    });
    const json = await res.json();
    setSavingSecret(false);
    if (json.success) {
      setVoucherSecret(newSecret);
      setNewSecret('');
      toast(newSecret ? 'Voucher secret updated' : 'Voucher secret cleared', 'success');
    } else {
      toast(json.error, 'error');
    }
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-2xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Settings size={20} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-100">Settings</h1>
          <p className="text-sm text-slate-500">Manage your account and system configuration</p>
        </div>
      </div>

      {/* My Profile */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <User size={16} className="text-slate-400" />
          <h2 className="font-bold text-slate-200">My Profile</h2>
          {me?.role && (
            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {me.role}
            </span>
          )}
        </div>
        <form onSubmit={saveProfile} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Display Name</label>
              <input
                className={inputCls}
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                className={inputCls}
                value={profile.email}
                onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                placeholder="admin@example.com"
              />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
              <Lock size={12} /> Leave blank to keep current password
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>New Password</label>
                <input
                  type="password"
                  className={inputCls}
                  value={profile.password}
                  onChange={(e) => setProfile((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className={labelCls}>Confirm Password</label>
                <input
                  type="password"
                  className={inputCls}
                  value={profile.confirmPassword}
                  onChange={(e) => setProfile((p) => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={savingProfile} size="sm">
              Save Profile
            </Button>
          </div>
        </form>
      </div>

      {/* Voucher Secret Key – superadmin only */}
      {me?.role === 'superadmin' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-amber-400" />
            <h2 className="font-bold text-slate-200">Voucher Security Key</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Admins must enter this secret passphrase to generate new vouchers. Leave blank to disable the
            requirement (not recommended in production).
          </p>
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <span>Current status:</span>
            {voucherSecret ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                Secret key is set
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-semibold">
                No secret key
              </span>
            )}
          </div>
          <form onSubmit={saveVoucherSecret} className="flex flex-col gap-4">
            <div>
              <label className={labelCls}>New Secret Passphrase</label>
              <input
                type="password"
                className={inputCls}
                value={newSecret}
                onChange={(e) => setNewSecret(e.target.value)}
                placeholder="Enter a strong passphrase…"
                autoComplete="new-password"
              />
              <p className="text-xs text-slate-600 mt-1.5">
                Set to empty to remove the secret key (any admin can then generate vouchers).
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                loading={savingSecret}
                variant={newSecret ? 'primary' : 'ghost'}
                size="sm"
                className={!newSecret ? 'border border-red-500/30 text-red-400 hover:bg-red-500/10' : ''}
              >
                {newSecret ? 'Update Secret Key' : 'Clear Secret Key'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
