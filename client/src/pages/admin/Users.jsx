import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.js';
import { Card, Spinner, Empty, Modal, Field, Badge } from '../../components/ui.jsx';

export default function Users() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);

  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get('/users')).data });
  const { data: deptData } = useQuery({ queryKey: ['departments'], queryFn: async () => (await api.get('/departments')).data });
  const users = data?.users || [];
  const depts = deptData?.departments || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('admin.usersTitle')}</h1>
        <button className="btn-primary text-sm" onClick={() => setModal({})}>
          + {t('admin.addUser')}
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : users.length === 0 ? (
        <Empty />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-ink-750 text-slate-500 dark:text-zinc-400 text-left">
              <tr>
                <th className="px-4 py-3">{t('profile.employeeCode')}</th>
                <th className="px-4 py-3">{t('admin.fullName')}</th>
                <th className="px-4 py-3">{t('login.email')}</th>
                <th className="px-4 py-3">{t('booking.department')}</th>
                <th className="px-4 py-3">{t('profile.role')}</th>
                <th className="px-4 py-3">{t('common.status')}</th>
                <th className="px-4 py-3">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 dark:border-zinc-800">
                  <td className="px-4 py-3">{u.employeeCode}</td>
                  <td className="px-4 py-3">{u.fullName}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.department?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                      {u.status === 'ACTIVE' ? t('common.active') : t('common.inactive')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button className="btn-ghost text-xs" onClick={() => setModal(u)}>
                      {t('common.edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {modal && <UserModal user={modal.id ? modal : null} depts={depts} onClose={() => setModal(null)} onSaved={() => { setModal(null); qc.invalidateQueries(); }} />}
    </div>
  );
}

function UserModal({ user, depts, onClose, onSaved }) {
  const { t } = useTranslation();
  const editing = !!user;
  const [form, setForm] = useState({
    employeeCode: user?.employeeCode || '',
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
    role: user?.role || 'USER',
    status: user?.status || 'ACTIVE',
    departmentId: user?.departmentId || '',
  });
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setErr(null);
    try {
      const payload = {
        fullName: form.fullName,
        phone: form.phone,
        role: form.role,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
      };
      if (editing) {
        payload.status = form.status;
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${user.id}`, payload);
      } else {
        await api.post('/users', {
          ...payload,
          employeeCode: form.employeeCode,
          email: form.email,
          password: form.password,
        });
      }
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || t('common.error'));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? t('common.edit') : t('admin.addUser')}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn-primary" onClick={save}>{t('common.save')}</button>
        </>
      }
    >
      {!editing && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('profile.employeeCode')} required>
            <input className="input" value={form.employeeCode} onChange={(e) => set('employeeCode', e.target.value)} />
          </Field>
          <Field label={t('login.email')} required>
            <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
        </div>
      )}
      <Field label={t('admin.fullName')} required>
        <input className="input" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('profile.phone')}>
          <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label={t('profile.role')}>
          <select className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </Field>
      </div>
      <Field label={t('booking.department')}>
        <select className="input" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
          <option value="">—</option>
          {depts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.departmentName}
            </option>
          ))}
        </select>
      </Field>
      <Field label={editing ? t('profile.newPassword') : t('login.password')} required={!editing}>
        <input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder={editing ? '••••••' : ''} />
      </Field>
      {editing && (
        <Field label={t('common.status')}>
          <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="ACTIVE">{t('common.active')}</option>
            <option value="INACTIVE">{t('common.inactive')}</option>
          </select>
        </Field>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </Modal>
  );
}
