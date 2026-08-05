import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, ArrowUpRight, TrendingUp, CalendarDays } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Spinner, Empty } from '../components/ui.jsx';
import { fmtDate, fmtTime } from '../lib/format.js';

const CARD_COLORS = ['bg-[#FED8B1]', 'bg-[#E9D5FF]', 'bg-[#D9F99D]', 'bg-[#BAE6FD]'];
const STATUS_PROGRESS = { CONFIRMED: 30, ACTIVE: 70, COMPLETED: 100, CANCELLED: 0, EXPIRED: 100 };

function bkkParts(date) {
  const dt = date instanceof Date ? date : new Date(date);
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(dt).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}
const keyOf = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('ALL');

  // Week (Mon..Sun) in Bangkok
  const days = useMemo(() => {
    const a = bkkParts(new Date());
    const base = new Date(Date.UTC(a.y, a.mo - 1, a.d));
    const dow = (base.getUTCDay() + 6) % 7;
    const monday = new Date(base); monday.setUTCDate(base.getUTCDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(monday); dd.setUTCDate(monday.getUTCDate() + i);
      return { key: keyOf(dd.getUTCFullYear(), dd.getUTCMonth() + 1, dd.getUTCDate()), dayNum: dd.getUTCDate(), dow: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][i] };
    });
  }, []);
  const todayKey = useMemo(() => { const n = bkkParts(new Date()); return keyOf(n.y, n.mo, n.d); }, []);
  const [selDay, setSelDay] = useState(todayKey);

  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: async () => (await api.get('/dashboard')).data, refetchInterval: 60000 });
  const { data: week } = useQuery({
    queryKey: ['week-cal-dash', days[0].key, days[6].key],
    queryFn: async () => (await api.get('/bookings/calendar', { params: { from: `${days[0].key}T00:00:00+07:00`, to: `${days[6].key}T23:59:59+07:00` } })).data,
  });

  if (isLoading) return <Spinner />;
  const d = data || {};
  const upcoming = [...(d.currentBookings || []), ...(d.upcoming || [])];
  const cards = upcoming.filter((b) => tab === 'ALL' || b.bookingType === tab).slice(0, 4);

  // Weekly chart: hours booked per weekday
  const weekBookings = week?.bookings || [];
  const perDay = days.map((day) => {
    const hrs = weekBookings.filter((b) => { const s = bkkParts(b.startDatetime); return keyOf(s.y, s.mo, s.d) === day.key; })
      .reduce((sum, b) => sum + (new Date(b.endDatetime) - new Date(b.startDatetime)) / 3600000, 0);
    return { ...day, hrs: Math.round(hrs * 10) / 10 };
  });
  const maxHrs = Math.max(4, ...perDay.map((x) => x.hrs));
  const totalHrs = Math.round(perDay.reduce((s, x) => s + x.hrs, 0));
  const completedWeek = weekBookings.filter((b) => b.status === 'COMPLETED').length;

  const dayList = weekBookings.filter((b) => { const s = bkkParts(b.startDatetime); return keyOf(s.y, s.mo, s.d) === selDay; })
    .sort((a, b) => new Date(a.startDatetime) - new Date(b.startDatetime));

  const tabs = [{ k: 'ALL', label: t('common.all') }, { k: 'VEHICLE', label: t('resourceType.VEHICLE') }, { k: 'MEETING_ROOM', label: t('resourceType.MEETING_ROOM') }];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{t('dashboard.title')}</h1>

      {/* My Bookings */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mr-2">{t('dashboard.myBookings')}</h2>
            {tabs.map((x) => (
              <button key={x.k} onClick={() => setTab(x.k)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${tab === x.k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-ink-750 dark:text-zinc-300'}`}>
                {x.label}
              </button>
            ))}
          </div>
          <Link to="/my-bookings" className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white">{t('dashboard.viewAll')}</Link>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 dark:border-zinc-700 py-12 text-center text-slate-400 text-sm">{t('dashboard.noUpcoming')}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((b, i) => (
              <button key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}
                className={`group text-left p-5 rounded-3xl min-h-[210px] flex flex-col justify-between transition hover:-translate-y-1 hover:shadow-xl ${CARD_COLORS[i % CARD_COLORS.length]}`}>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/85 text-slate-900 shadow-sm">
                      <Clock className="w-3 h-3 opacity-70" />{fmtDate(b.startDatetime, lang)}
                    </span>
                    <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition text-slate-800" />
                  </div>
                  <h3 className="font-black text-lg leading-snug text-slate-900 mb-1.5">{b.resource?.resourceName?.split(' / ')[0]}</h3>
                  <p className="text-xs font-medium text-slate-800/80 line-clamp-2">{b.purpose || t(`resourceType.${b.bookingType}`)}</p>
                </div>
                <div className="pt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-800">{t(`bookingStatus.${b.status}`)}</span>
                    <span className="text-xs font-black text-slate-900">{fmtTime(b.startDatetime, lang)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/60 overflow-hidden">
                    <div className="h-full rounded-full bg-slate-900" style={{ width: `${STATUS_PROGRESS[b.status] ?? 20}%` }} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Vehicle status today */}
      {(d.vehicleStatus?.length > 0) && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{t('dashboard.vehicleStatusToday')}</h2>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{d.availableVehicles ?? 0}/{d.vehicleTotal ?? 0} {t('booking.available')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {d.vehicleStatus.map((v) => {
              const inUse = !!v.current;
              const badge = v.disabled
                ? 'bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300'
                : inUse
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
              const label = v.disabled ? t('dashboard.disabled') : inUse ? t('dashboard.inUse') : t('booking.available');
              return (
                <div key={v.id} className="p-4 rounded-3xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/70 dark:bg-ink-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-slate-900 dark:text-white truncate">{v.name}</span>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badge}`}>{label}</span>
                  </div>
                  {inUse ? (
                    <p className="text-xs font-medium text-slate-600 dark:text-zinc-300 mt-1.5">
                      {fmtTime(v.current.start, lang)}–{fmtTime(v.current.end, lang)}
                      {v.current.requester ? ` · ${v.current.requester.split(' / ')[0]}` : ''}
                    </p>
                  ) : v.next ? (
                    <p className="text-xs text-slate-400 mt-1.5">
                      {t('dashboard.nextAt')} {fmtTime(v.next.start, lang)}–{fmtTime(v.next.end, lang)}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1.5">{t('dashboard.freeAllDay')}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Weekly usage + Next bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly usage */}
        <div className="lg:col-span-6 p-6 rounded-3xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/70 dark:bg-ink-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('dashboard.weeklyUsage')}</h2>
            <span className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-ink-750 text-slate-500"><CalendarDays className="w-4 h-4" /></span>
          </div>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalHrs} <span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{t('dashboard.hoursBooked')}</span></span>
          </div>

          <div className="h-44 flex items-end justify-between gap-2">
            {perDay.map((x) => {
              const active = x.key === todayKey;
              return (
                <div key={x.key} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="opacity-0 group-hover:opacity-100 transition text-[10px] font-bold mb-1 text-slate-500">{x.hrs}h</div>
                  <div className="w-8 md:w-10 rounded-t-xl transition-all" style={{ height: `${Math.max(4, (x.hrs / maxHrs) * 100)}%`, background: active ? '#FDBA74' : undefined }}>
                    {!active && <div className="w-full h-full rounded-t-xl bg-slate-200 dark:bg-zinc-700 group-hover:bg-slate-300" />}
                  </div>
                  <span className={`text-[11px] font-bold mt-2 ${active ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{x.dow}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-200/70 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: t('dashboard.weekTotal'), value: weekBookings.length },
              { label: t('dashboard.inUse'), value: d.inUseCount ?? 0 },
              { label: t('dashboard.availableVehicles'), value: `${d.availableVehicles ?? 0}/${d.vehicleTotal ?? 0}` },
              { label: t('dashboard.completedWeek'), value: completedWeek },
            ].map((m) => (
              <div key={m.label}>
                <p className="text-[11px] text-slate-400 font-semibold mb-1">{m.label}</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Next bookings */}
        <div className="lg:col-span-6 p-6 rounded-3xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/70 dark:bg-ink-800">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('dashboard.nextBookings')}</h2>
            <Link to="/calendar" className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400">{t('dashboard.viewAll')}</Link>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-5">
            {days.map((x) => {
              const active = selDay === x.key;
              return (
                <button key={x.key} onClick={() => setSelDay(x.key)}
                  className={`flex flex-col items-center py-2.5 rounded-2xl transition ${active ? 'bg-lime-300 text-slate-900 shadow-sm dark:bg-lime-400 dark:text-slate-950' : 'text-slate-500 hover:bg-slate-200/60 dark:text-zinc-400 dark:hover:bg-ink-750'}`}>
                  <span className="text-[10px] font-bold opacity-70">{x.dow}</span>
                  <span className="text-sm font-extrabold mt-0.5">{x.dayNum}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {dayList.length === 0 ? (
              <Empty text={t('dashboard.noBookingsDay')} />
            ) : dayList.map((b) => (
              <button key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}
                className="w-full p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-700 bg-white dark:bg-ink-750 hover:border-slate-300 flex items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{b.resource?.resourceName?.split(' / ')[0]}</h4>
                  <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${b.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : b.status === 'COMPLETED' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>{t(`bookingStatus.${b.status}`)}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-white text-[10px] font-bold flex items-center justify-center">{(b.requesterName || b.requester?.fullName || '?').slice(0, 1)}</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 hidden sm:inline">{(b.requesterName || b.requester?.fullName || '').split(' / ')[0]}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900 dark:text-white">{fmtTime(b.startDatetime, lang)}</p>
                    <p className="text-[10px] text-slate-400">{Math.round((new Date(b.endDatetime) - new Date(b.startDatetime)) / 60000)} min</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
