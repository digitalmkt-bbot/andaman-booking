import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth.jsx';
import { setLang } from '../i18n.js';

export default function Login() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@loveandaman.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(t('login.invalid'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-600 to-brand-900 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex justify-end mb-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            {['th', 'en'].map((lng) => (
              <button
                key={lng}
                onClick={() => setLang(lng)}
                className={`px-3 py-1 font-medium ${i18n.language === lng ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
              >
                {lng.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-brand-700">{t('appName')}</div>
          <p className="text-sm text-slate-500 mt-1">{t('login.subtitle')}</p>
        </div>
        <form onSubmit={submit}>
          <div className="mb-4">
            <label className="label">{t('login.email')}</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="mb-4">
            <label className="label">{t('login.password')}</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? '...' : t('login.signIn')}
          </button>
        </form>
        <div className="mt-6 text-xs text-slate-400 border-t pt-4">
          <p className="font-medium text-slate-500 mb-1">{t('login.demo')}:</p>
          <p>admin@loveandaman.com / admin123</p>
          <p>user@loveandaman.com / user123</p>
        </div>
      </div>
    </div>
  );
}
