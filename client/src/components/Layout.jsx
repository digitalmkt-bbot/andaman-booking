import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutGrid, CalendarDays, Car, Building2, ClipboardList, Bell, User, ChevronDown,
  FileText, Boxes, Construction, Users, Building, BarChart3, History, Settings,
  LogOut, Search, Sun, Moon, Menu, X,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useTheme } from '../theme.jsx';
import { api } from '../api.js';
import { setLang } from '../i18n.js';

const mainNav = [
  { to: '/', key: 'dashboard', icon: LayoutGrid, end: true },
  { to: '/calendar', key: 'calendar', icon: CalendarDays },
  { to: '/book/vehicle', key: 'bookVehicle', icon: Car },
  { to: '/book/room', key: 'bookRoom', icon: Building2 },
  { to: '/my-bookings', key: 'myBookings', icon: ClipboardList },
  { to: '/notifications', key: 'notifications', icon: Bell, badge: true },
];

const adminNav = [
  { to: '/admin/bookings', key: 'allBookings', icon: FileText },
  { to: '/admin/resources', key: 'resources', icon: Boxes },
  { to: '/admin/blocks', key: 'blocks', icon: Construction },
  { to: '/admin/users', key: 'users', icon: Users },
  { to: '/admin/departments', key: 'departments', icon: Building },
  { to: '/admin/reports', key: 'reports', icon: BarChart3 },
  { to: '/admin/audit', key: 'audit', icon: History },
  { to: '/admin/settings', key: 'settings', icon: Settings },
];

export default function Layout({ children }) {
  const { t, i18n } = useTranslation();
  const { user, logout, isAdmin } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data: notif } = useQuery({ queryKey: ['notif-count'], queryFn: async () => (await api.get('/notifications')).data, refetchInterval: 30000 });
  const unread = notif?.unread || 0;

  const isActive = (item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));
  const firstName = user?.fullName?.split(' / ')[0] || '';

  async function onSearch(e) {
    e.preventDefault();
    const q = query.trim(); if (!q) return;
    try {
      const r = await api.get('/bookings', { params: isAdmin ? {} : { scope: 'mine' } });
      const low = q.toLowerCase();
      const m = (r.data.bookings || []).find((b) => b.bookingNumber?.toLowerCase().includes(low) || (b.resource?.resourceName || '').toLowerCase().includes(low));
      navigate(m ? `/bookings/${m.id}` : isAdmin ? '/admin/bookings' : '/my-bookings');
      setQuery(''); setOpen(false);
    } catch { /* ignore */ }
  }

  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const active = isActive(item);
    return (
      <button
        onClick={() => { navigate(item.to); setOpen(false); }}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-sm font-semibold transition ${
          active
            ? 'bg-lime-300/90 text-slate-900 shadow-sm dark:bg-lime-400 dark:text-slate-950'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-ink-750'
        }`}
      >
        <span className="flex items-center gap-3">
          <Icon className={`w-[18px] h-[18px] ${active ? '' : 'text-slate-400 dark:text-zinc-500'}`} />
          {t(`nav.${item.key}`)}
        </span>
        {item.badge && unread > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[11px] font-bold flex items-center justify-center">{unread}</span>
        )}
      </button>
    );
  };

  const Sidebar = (
    <aside className="w-64 shrink-0 flex flex-col justify-between p-5 border-r border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-ink-850 h-full overflow-y-auto custom-scrollbar">
      <div>
        <div className="flex items-center justify-between mb-8 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-violet-500 flex items-center justify-center">
              <div className="grid grid-cols-2 gap-0.5">{[0, 1, 2, 3].map((k) => <span key={k} className="w-2 h-2 rounded-full bg-white" />)}</div>
            </div>
            <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Love Andaman</span>
          </div>
          <button className="lg:hidden text-slate-400" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
        </div>

        <nav className="space-y-1">
          {mainNav.map((item) => <NavItem key={item.to} item={item} />)}
          {isAdmin && (
            <>
              <div className="px-4 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-600">{t('nav.admin')}</div>
              {adminNav.map((item) => <NavItem key={item.to} item={item} />)}
            </>
          )}
        </nav>
      </div>

      <div className="pt-5 mt-5 border-t border-slate-200/70 dark:border-zinc-800 space-y-3">
        <div className="flex items-center bg-slate-100 dark:bg-ink-750 p-1 rounded-2xl">
          <button onClick={() => dark && toggle()} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold ${!dark ? 'bg-white text-slate-900 shadow-sm' : 'text-zinc-400'}`}>
            <Sun className="w-3.5 h-3.5" /> Light
          </button>
          <button onClick={() => !dark && toggle()} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold ${dark ? 'bg-ink-700 text-white shadow-sm' : 'text-slate-500'}`}>
            <Moon className="w-3.5 h-3.5" /> Dark
          </button>
        </div>
        <div className="flex items-center rounded-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden text-xs">
          {['th', 'en'].map((lng) => (
            <button key={lng} onClick={() => setLang(lng)} className={`flex-1 py-1.5 font-semibold ${i18n.language === lng ? 'bg-brand-500 text-white' : 'text-slate-500 dark:text-zinc-400'}`}>{lng.toUpperCase()}</button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 dark:text-zinc-600 px-1">© 2026 Love Andaman</p>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#cfe0ef] dark:bg-ink-900 p-2 sm:p-4 lg:p-6 flex justify-center">
      <div className="w-full max-w-[1500px] min-h-[calc(100vh-3rem)] rounded-[28px] overflow-hidden shadow-2xl flex bg-white dark:bg-ink-850 dark:border dark:border-zinc-800">
        {/* Desktop sidebar */}
        <div className="hidden lg:block h-auto">{Sidebar}</div>
        {/* Mobile drawer */}
        {open && (
          <>
            <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />
            <div className="fixed inset-y-0 left-0 z-40 lg:hidden">{Sidebar}</div>
          </>
        )}

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="flex items-center gap-3 px-4 sm:px-8 py-4 border-b border-slate-100 dark:border-zinc-800">
            <button className="lg:hidden text-slate-500" onClick={() => setOpen(true)}><Menu className="w-5 h-5" /></button>
            <form onSubmit={onSearch} className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${t('common.search')}...`}
                className="w-full pl-11 pr-4 py-2.5 rounded-2xl text-sm bg-slate-50 dark:bg-ink-750 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder-slate-400 outline-none focus:bg-white dark:focus:bg-ink-700" />
            </form>
            <div className="flex-1" />
            <button className="p-2.5 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-ink-750 text-slate-700 dark:text-zinc-200" onClick={toggle} title={dark ? 'Light' : 'Dark'}>
              {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>
            <button className="relative p-2.5 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-ink-750 text-slate-700 dark:text-zinc-200" onClick={() => navigate('/notifications')}>
              <Bell className="w-4 h-4" />
              {unread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-900 dark:bg-lime-400 text-white dark:text-slate-950 text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-ink-850">{unread}</span>}
            </button>
            <button onClick={() => navigate('/profile')} className="flex items-center gap-2.5 p-1.5 pl-2 pr-3 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-ink-750">
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">{firstName.slice(0, 1) || 'U'}</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 hidden sm:inline">{firstName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
