import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiError } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, Field } from '../components/ui.jsx';

export default function Profile() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState(null);

  async function change(e) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post('/auth/change-password', { currentPassword: cur, newPassword: next });
      setMsg({ type: 'success', text: t('common.success') });
      setCur('');
      setNext('');
    } catch (ex) {
      setMsg({ type: 'error', text: apiError(ex).error === 'WRONG_PASSWORD' ? t('common.error') : apiError(ex).message || t('common.error') });
    }
  }

  const Row = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-700">{value}</span>
    </div>
  );

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('profile.title')}</h1>
      <Card>
        <Row label={t('admin.fullName')} value={user?.fullName} />
        <Row label={t('profile.employeeCode')} value={user?.employeeCode} />
        <Row label={t('login.email')} value={user?.email} />
        <Row label={t('profile.phone')} value={user?.phone || '—'} />
        <Row label={t('booking.department')} value={user?.department?.name || '—'} />
        <Row label={t('profile.role')} value={user?.role} />
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-700 mb-3">{t('profile.changePassword')}</h2>
        <form onSubmit={change}>
          <Field label={t('profile.currentPassword')} required>
            <input type="password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} required />
          </Field>
          <Field label={t('profile.newPassword')} required>
            <input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} minLength={6} required />
          </Field>
          <button className="btn-primary">{t('common.save')}</button>
          {msg && <p className={`text-sm mt-3 ${msg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}
        </form>
      </Card>
    </div>
  );
}
