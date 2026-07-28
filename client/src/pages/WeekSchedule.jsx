import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Bell, MessageSquare, Gift, Settings, Plus, ChevronLeft, ChevronRight,
  LayoutGrid, CalendarDays, ChevronDown, Car, Building2, Construction,
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const GRID_START = 7; // 7am
const GRID_END = 22; // 10pm
const HOUR_H = 78;

// Event colors by type
const TYPE_STYLE = {
  VEHICLE: { bg: '#3b82f6', soft: 'rgba(59,130,246,0.85)' },
  MEETING_ROOM: { bg: '#7c6cf0', soft: 'rgba(124,108,240,0.85)' },
  BLOCK: { bg: '#f59e0b', soft: 'rgba(245,158,11,0.9)' },
};

function bkkParts(date) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}
const keyOf = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function WeekSchedule() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState('week');
  const [filters, setFilters] = useState({ VEHICLE: true, MEETING_ROOM: true, BLOCK: true });

  // Build the visible week (Mon..Sun) from anchor, in Bangkok time
  const days = useMemo(() => {
    const a = bkkParts(anchor);
    const base = new Date(Date.UTC(a.y, a.mo - 1, a.d));
    const dow = (base.getUTCDay() + 6) % 7; // 0 = Monday
    const monday = new Date(base); monday.setUTCDate(base.getUTCDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(monday); dd.setUTCDate(monday.getUTCDate() + i);
      return {
        key: keyOf(dd.getUTCFullYear(), dd.getUTCMonth() + 1, dd.getUTCDate()),
        dayNum: dd.getUTCDate(),
        dow: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][i],
        month: dd.getUTCMonth() + 1,
        year: dd.getUTCFullYear(),
      };
    });
  }, [anchor]);

  const todayKey = useMemo(() => { const n = bkkParts(new Date()); return keyOf(n.y, n.mo, n.d); }, []);
  const visibleDays = view === 'day'
    ? days.filter((d) => d.key === (function () { const a = bkkParts(anchor); return keyOf(a.y, a.mo, a.d); })()) || [days[0]]
    : days;
  const shownDays = visibleDays.length ? visibleDays : [days[0]];

  const fromISO = `${days[0].key}T00:00:00+07:00`;
  const toISO = `${days[6].key}T23:59:59+07:00`;

  const { data } = useQuery({
    queryKey: ['week-cal', days[0].key, days[6].key],
    queryFn: async () => (await api.get('/bookings/calendar', { params: { from: fromISO, to: toISO } })).data,
  });
  const { data: notif } = useQuery({ queryKey: ['notif-count'], queryFn: async () => (await api.get('/notifications')).data });

  // Build events
  const events = useMemo(() => {
    const list = [];
    for (const b of data?.bookings || []) {
      list.push({ id: `b${b.id}`, bid: b.id, type: b.bookingType, title: b.resource?.resourceName || '', sub: b.requester?.fullName?.split(' / ')[0] || '', start: new Date(b.startDatetime), end: new Date(b.endDatetime), status: b.status });
    }
    for (const bl of data?.blocks || []) {
      list.push({ id: `bl${bl.id}`, type: 'BLOCK', title: bl.resource?.resourceName || '', sub: t(`blockType.${bl.blockType}`), start: new Date(bl.startDatetime), end: new Date(bl.endDatetime) });
    }
    return list.filter((e) => filters[e.type]);
  }, [data, filters, t]);

  // Group events by day key with lane packing
  const eventsByDay = useMemo(() => {
    const map = {};
    for (const ev of events) {
      const s = bkkParts(ev.start); const e = bkkParts(ev.end);
      const dayKey = keyOf(s.y, s.mo, s.d);
      const startH = Math.max(GRID_START, s.h + s.mi / 60);
      let endH = e.h + e.mi / 60; if (endH <= startH) endH = startH + 0.5;
      endH = Math.min(GRID_END, Math.max(endH, startH + 0.5));
      (map[dayKey] = map[dayKey] || []).push({ ...ev, startH, endH });
    }
    for (const k of Object.keys(map)) {
      const arr = map[k].sort((a, b) => a.startH - b.startH);
      const laneEnds = [];
      for (const ev of arr) {
        let placed = false;
        for (let i = 0; i < laneEnds.length; i++) { if (laneEnds[i] <= ev.startH) { ev.lane = i; laneEnds[i] = ev.endH; placed = true; break; } }
        if (!placed) { ev.lane = laneEnds.length; laneEnds.push(ev.endH); }
      }
      const lanes = Math.max(1, laneEnds.length);
      arr.forEach((ev) => { ev.lanes = lanes; });
    }
    return map;
  }, [events]);

  const monthLabel = new Intl.DateTimeFormat(i18n.language === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(anchor);
  const hours = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);
  const shiftWeek = (n) => { const d = new Date(anchor); d.setDate(d.getDate() + n * 7); setAnchor(d); };

  // Next upcoming booking for the highlight card
  const nextEv = useMemo(() => {
    const now = Date.now();
    return events.filter((e) => e.type !== 'BLOCK' && e.start.getTime() > now).sort((a, b) => a.start - b.start)[0];
  }, [events]);

  const fmtRange = (s, e) => {
    const f = (d) => { const p = bkkParts(d); return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`; };
    return `${f(s)}-${f(e)}`;
  };

  const catCounts = useMemo(() => {
    const c = { VEHICLE: 0, MEETING_ROOM: 0, BLOCK: 0 };
    for (const e of events) c[e.type] = (c[e.type] || 0) + 1;
    const total = Math.max(1, c.VEHICLE + c.MEETING_ROOM + c.BLOCK);
    return { ...c, total };
  }, [events]);

  const firstName = user?.fullName?.split(' / ')[0] || '';

  return (
    <div className="min-h-screen bg-[#dfe2ea] p-2 sm:p-4 flex justify-center">
      <div className="w-full max-w-[1640px] rounded-[28px] bg-[#0b0b10] text-white p-3 sm:p-4 flex flex-col gap-4 shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex-1 flex items-center gap-3 bg-[#15151d] rounded-2xl px-4 py-3">
            <Search className="w-4 h-4 text-zinc-500" />
            <input placeholder={`${t('common.search')}...`} className="flex-1 bg-transparent text-sm outline-none placeholder-zinc-500" />
          </div>
          <div className="hidden sm:flex items-center gap-2.5">
            {[
              { icon: Bell, n: notif?.unread || 0, color: 'text-sky-400', onClick: () => navigate('/notifications') },
              { icon: MessageSquare, n: 0, color: 'text-sky-400' },
              { icon: Gift, n: 0, color: 'text-violet-400' },
              { icon: Settings, n: 0, color: 'text-rose-400', onClick: () => navigate(isAdmin ? '/admin/settings' : '/profile') },
            ].map((b, i) => {
              const Icon = b.icon;
              return (
                <button key={i} onClick={b.onClick} className="relative w-11 h-11 rounded-2xl bg-[#15151d] flex items-center justify-center hover:bg-[#1d1d27]">
                  <Icon className={`w-4 h-4 ${b.color}`} />
                  {b.n > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-sky-500 text-[10px] font-bold flex items-center justify-center">{b.n}</span>}
                </button>
              );
            })}
          </div>
          <div className="h-8 w-px bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block leading-tight">
              <div className="text-sm text-zinc-400">Hello,</div>
              <div className="text-sm font-bold">{firstName}</div>
            </div>
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-sm font-bold">
              {firstName.slice(0, 1) || 'U'}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Icon rail */}
          <div className="hidden md:flex w-14 flex-col items-center gap-3 shrink-0">
            <button onClick={() => navigate('/')} title={t('nav.dashboard')} className="w-12 h-12 rounded-2xl bg-violet-500 flex items-center justify-center hover:bg-violet-600">
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button title={t('nav.calendar')} className="w-12 h-12 rounded-2xl bg-[#15151d] flex items-center justify-center text-zinc-300">
              <CalendarDays className="w-5 h-5" />
            </button>
            <div className="w-6 h-px bg-white/10 my-1" />
            {(data?.bookings || []).slice(0, 4).map((b, i) => (
              <div key={i} className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold ${['bg-sky-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500'][i % 4]}`}>
                {(b.requester?.fullName || '?').slice(0, 1)}
              </div>
            ))}
            <button onClick={() => navigate('/book/vehicle')} className="w-11 h-11 rounded-full bg-[#15151d] flex items-center justify-center text-zinc-400 hover:text-white">
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Middle panel */}
          <div className="hidden lg:flex w-[300px] flex-col gap-4 shrink-0 overflow-y-auto custom-scrollbar">
            <MiniCal anchor={anchor} setAnchor={setAnchor} monthLabel={monthLabel} lang={i18n.language} todayKey={todayKey} />

            <Panel title={monthLabel}>
              {[
                { key: 'VEHICLE', label: t('resourceType.VEHICLE'), icon: Car },
                { key: 'MEETING_ROOM', label: t('resourceType.MEETING_ROOM'), icon: Building2 },
                { key: 'BLOCK', label: t('nav.blocks'), icon: Construction },
              ].map((row) => (
                <label key={row.key} className="flex items-center gap-3 py-1.5 cursor-pointer text-sm text-zinc-300">
                  <input type="checkbox" checked={filters[row.key]} onChange={() => setFilters((f) => ({ ...f, [row.key]: !f[row.key] }))} className="accent-violet-500 w-4 h-4" />
                  {row.label}
                </label>
              ))}
            </Panel>

            <Panel title={t('admin.reportsTitle')}>
              {[
                { key: 'VEHICLE', label: t('resourceType.VEHICLE'), color: '#3b82f6' },
                { key: 'MEETING_ROOM', label: t('resourceType.MEETING_ROOM'), color: '#7c6cf0' },
                { key: 'BLOCK', label: t('nav.blocks'), color: '#f59e0b' },
              ].map((row) => (
                <div key={row.key} className="py-1.5">
                  <div className="flex items-center gap-2 text-sm text-zinc-300 mb-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                    {row.label}
                    <span className="ml-auto text-zinc-500 text-xs">{catCounts[row.key]}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#22222c] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(catCounts[row.key] / catCounts.total) * 100}%`, background: row.color }} />
                  </div>
                </div>
              ))}
            </Panel>

            {nextEv && (
              <div className="rounded-2xl bg-[#101017] p-4">
                <div className="text-xs text-zinc-400 mb-1">{fmtRange(nextEv.start, nextEv.end)}</div>
                <div className="font-bold leading-snug mb-3">{nextEv.title}</div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 rounded-lg border border-white/15 text-xs font-semibold text-zinc-300">{t('myBookings.upcoming')}</button>
                  <button onClick={() => navigate(`/bookings/${nextEv.bid}`)} className="px-3 py-1.5 rounded-lg bg-violet-500 text-xs font-semibold">{t('common.details')}</button>
                </div>
              </div>
            )}
          </div>

          {/* Week grid */}
          <div className="flex-1 min-w-0 rounded-3xl overflow-hidden flex flex-col bg-white">
            {/* Gradient header */}
            <div className="bg-gradient-to-r from-violet-500 via-fuchsia-400 to-pink-400 p-5 text-white">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold">{monthLabel}</span>
                  <button onClick={() => setAnchor(new Date())} className="px-3 py-1 rounded-full bg-black/25 text-xs font-semibold">{t('common.today')}</button>
                  <button onClick={() => shiftWeek(-1)} className="w-7 h-7 rounded-full bg-black/15 flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
                  <button onClick={() => shiftWeek(1)} className="w-7 h-7 rounded-full bg-black/15 flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-1 bg-black/15 rounded-full p-1 text-sm">
                  {['month', 'week', 'day'].map((v) => (
                    <button key={v} onClick={() => setView(v)} className={`px-4 py-1 rounded-full font-semibold capitalize ${view === v ? 'bg-white text-slate-800' : 'text-white/90'}`}>
                      {v === 'month' ? (i18n.language === 'th' ? 'เดือน' : 'Month') : v === 'week' ? (i18n.language === 'th' ? 'สัปดาห์' : 'Week') : (i18n.language === 'th' ? 'วัน' : 'Day')}
                    </button>
                  ))}
                </div>
              </div>
              {/* Day columns header */}
              <div className="flex mt-4">
                <div className="w-14 shrink-0 text-[11px] text-white/70 flex items-end pb-1">GMT+7</div>
                {shownDays.map((d) => (
                  <div key={d.key} className={`flex-1 rounded-2xl mx-1 py-2 text-center ${d.key === todayKey ? 'bg-white/25' : 'bg-white/10'}`}>
                    <div className="text-[11px] text-white/80 lowercase">{d.dow}</div>
                    <div className="text-2xl font-bold leading-none mt-0.5">{d.dayNum}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time grid */}
            <div className="flex-1 overflow-auto bg-gradient-to-b from-[#fdf1f2] to-[#eef0fb]">
              <div className="flex min-h-full">
                {/* hour gutter */}
                <div className="w-14 shrink-0">
                  {hours.map((h) => (
                    <div key={h} style={{ height: HOUR_H }} className="text-[11px] text-slate-400 text-right pr-2 -translate-y-2">
                      {h === 12 ? '12 pm' : h > 12 ? `${h - 12} pm` : `${h} am`}
                    </div>
                  ))}
                </div>
                {/* day columns */}
                {shownDays.map((d) => (
                  <div key={d.key} className="flex-1 relative border-l border-slate-200/50" style={{ height: hours.length * HOUR_H }}>
                    {hours.map((h) => <div key={h} style={{ height: HOUR_H }} className="border-b border-slate-200/40" />)}
                    {(eventsByDay[d.key] || []).map((ev) => {
                      const top = (ev.startH - GRID_START) * HOUR_H;
                      const height = Math.max(38, (ev.endH - ev.startH) * HOUR_H - 6);
                      const width = `calc(${100 / ev.lanes}% - 8px)`;
                      const left = `calc(${(100 / ev.lanes) * ev.lane}% + 4px)`;
                      const st = TYPE_STYLE[ev.type] || TYPE_STYLE.VEHICLE;
                      return (
                        <button
                          key={ev.id}
                          onClick={() => ev.bid && navigate(`/bookings/${ev.bid}`)}
                          className="absolute rounded-xl p-2 text-left text-white overflow-hidden shadow-sm"
                          style={{ top: top + 2, height, left, width, background: st.bg }}
                        >
                          <div className="text-[10px] font-medium text-white/85 leading-tight">{fmtRange(ev.start, ev.end)}</div>
                          <div className="text-[12px] font-bold leading-tight line-clamp-2">{ev.title}</div>
                          {ev.sub && height > 60 && (
                            <div className="mt-1 flex items-center gap-1">
                              <span className="w-4 h-4 rounded-full bg-white/30 text-[8px] flex items-center justify-center font-bold">{ev.sub.slice(0, 1)}</span>
                              <span className="text-[9px] text-white/80 truncate">{ev.sub}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl bg-[#101017] p-4">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between mb-2">
        <span className="font-bold text-sm">{title}</span>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function MiniCal({ anchor, setAnchor, monthLabel, lang, todayKey }) {
  const a = bkkParts(anchor);
  const y = a.y; const m = a.mo;
  const first = new Date(Date.UTC(y, m - 1, 1));
  const startDay = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => { const dd = new Date(Date.UTC(y, m - 1, 1 - startDay + i)); return dd; });
  const anchorKey = keyOf(a.y, a.mo, a.d);
  const dows = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  return (
    <div className="rounded-2xl bg-[#101017] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-sm">{monthLabel}</span>
        <div className="flex gap-1.5">
          <button onClick={() => { const d = new Date(anchor); d.setMonth(d.getMonth() - 1); setAnchor(d); }} className="p-1 rounded-full bg-[#1c1c25] text-zinc-400"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <button onClick={() => { const d = new Date(anchor); d.setMonth(d.getMonth() + 1); setAnchor(d); }} className="p-1 rounded-full bg-[#1c1c25] text-zinc-400"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-zinc-500 mb-1">{dows.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {cells.map((dd, i) => {
          const inMonth = dd.getUTCMonth() + 1 === m;
          const k = keyOf(dd.getUTCFullYear(), dd.getUTCMonth() + 1, dd.getUTCDate());
          const isAnchor = k === anchorKey;
          const isToday = k === todayKey;
          return (
            <button key={i} onClick={() => { setAnchor(new Date(Date.UTC(dd.getUTCFullYear(), dd.getUTCMonth(), dd.getUTCDate(), 5))); }}
              className={`py-1 rounded-full ${isAnchor ? 'bg-violet-500 text-white font-bold' : isToday ? 'text-violet-400 font-bold' : inMonth ? 'text-zinc-300' : 'text-zinc-600'}`}>
              {dd.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
