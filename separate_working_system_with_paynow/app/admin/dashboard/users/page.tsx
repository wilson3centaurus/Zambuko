'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Shield, User, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils/format';
import type { Admin } from '@/lib/types';

type Tab = 'all' | 'superadmin' | 'admin';

interface FormState {
  name: string;
  email: string;
  password: string;
  avatar_url: string;
}

const EMPTY_FORM: FormState = { name: '', email: '', password: '', avatar_url: '' };

function Avatar({ admin, size = 'md' }: { admin: Admin; size?: 'sm' | 'md' }) {
  const initials = admin.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';

  if (admin.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={admin.avatar_url} alt={admin.name}
        className={`${dim} rounded-full object-cover ring-2 ring-slate-700`} />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white shrink-0`}>
      {initials}
    </div>
  );
}

export default function UsersPage() {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Admin | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((j) => { if (j.success) setMe(j.data); });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/users').then((r) => r.json());
    if (res.success) setAdmins(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = admins.filter((a) => tab === 'all' || a.role === tab);
  const countAll = admins.length;
  const countSuper = admins.filter((a) => a.role === 'superadmin').length;
  const countAdmin = admins.filter((a) => a.role === 'admin').length;
  const countActive = admins.filter((a) => a.active).length;

  function openCreate() { setForm(EMPTY_FORM); setCreateOpen(true); }
  function openEdit(a: Admin) { setForm({ name: a.name, email: a.email, password: '', avatar_url: a.avatar_url ?? '' }); setEditTarget(a); }

  async function handleCreate() {
    setSaving(true);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then((r) => r.json());
    setSaving(false);
    if (res.success) { toast('Admin created', 'success'); setCreateOpen(false); load(); }
    else toast(res.error, 'error');
  }

  async function handleEdit() {
    if (!editTarget) return;
    setSaving(true);
    const payload: Partial<FormState> = { name: form.name, email: form.email, avatar_url: form.avatar_url };
    if (form.password) payload.password = form.password;
    const res = await fetch(`/api/admin/users/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => r.json());
    setSaving(false);
    if (res.success) { toast('Admin updated', 'success'); setEditTarget(null); load(); }
    else toast(res.error, 'error');
  }

  async function handleToggleActive(a: Admin) {
    const res = await fetch(`/api/admin/users/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !a.active }),
    }).then((r) => r.json());
    if (res.success) { toast(`Admin ${a.active ? 'deactivated' : 'activated'}`, 'success'); load(); }
    else toast(res.error, 'error');
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' }).then((r) => r.json());
    if (res.success) { toast('Admin deleted', 'success'); setDeleteTarget(null); load(); }
    else toast(res.error, 'error');
  }

  const isSuperAdmin = me?.role === 'superadmin';

  const inputCls = 'w-full h-10 rounded-xl bg-slate-800 border border-slate-700 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="p-6 flex flex-col gap-6 max-w-7xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">Dashboard / Users</p>
          <h1 className="text-2xl font-black text-slate-100">Admin Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage administrator accounts</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openCreate} size="sm">
            <Plus size={16} /> Add Admin
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Admins', value: countAll, icon: Shield, color: 'bg-purple-500/10 text-purple-400' },
          { label: 'Active',       value: countActive, icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-400' },
          { label: 'Super Admins', value: countSuper, icon: User, color: 'bg-blue-500/10 text-blue-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${color}`}><Icon size={20} /></div>
            <div>
              <p className="text-2xl font-black text-slate-100">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 pb-0">
        {([
          { key: 'all',        label: 'All',         count: countAll   },
          { key: 'superadmin', label: 'Super Admins', count: countSuper },
          { key: 'admin',      label: 'Admins',      count: countAdmin },
        ] as { key: Tab; label: string; count: number }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
              tab === t.key ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {['#', 'User', 'Role', 'Status', 'Last Login', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-600">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-600">No admins found</td></tr>
              ) : filtered.map((a, idx) => (
                <tr key={a.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-slate-600 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar admin={a} size="sm" />
                      <div>
                        <p className="font-semibold text-slate-200">{a.name}</p>
                        <p className="text-xs text-slate-500">{a.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                      a.role === 'superadmin'
                        ? 'bg-purple-500/10 text-purple-400'
                        : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      <Shield size={10} />
                      {a.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      a.active ? 'text-emerald-400' : 'text-slate-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${a.active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      {a.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {a.last_login_at ? formatDate(a.last_login_at) : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(a)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition">
                        <Pencil size={13} />
                      </button>
                      {isSuperAdmin && me?.id !== a.id && (
                        <>
                          <button onClick={() => handleToggleActive(a)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition">
                            {a.active ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
                          </button>
                          <button onClick={() => setDeleteTarget(a)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Admin">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Full Name</label>
            <input className={inputCls} placeholder="Jane Doe" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Email</label>
            <input type="email" className={inputCls} placeholder="jane@company.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Password</label>
            <input type="password" className={inputCls} placeholder="Min 8 characters" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Avatar URL (optional)</label>
            <input className={inputCls} placeholder="https://..." value={form.avatar_url} onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))} />
          </div>
          <Button className="w-full mt-2" loading={saving} disabled={!form.name || !form.email || !form.password} onClick={handleCreate}>
            Create Admin
          </Button>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Admin">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Full Name</label>
            <input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Email</label>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">New Password (leave blank to keep)</label>
            <input type="password" className={inputCls} placeholder="Leave blank to keep current" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Avatar URL</label>
            <input className={inputCls} placeholder="https://..." value={form.avatar_url} onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))} />
          </div>
          <Button className="w-full mt-2" loading={saving} onClick={handleEdit}>
            Save Changes
          </Button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Admin">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-400">
            Are you sure you want to delete <strong className="text-slate-200">{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <button onClick={handleDelete} className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition">
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
