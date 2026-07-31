import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, ChevronDown, Car, Building2, Construction,
} from 'lucide-react';
import { api } from '../api.js';

const GRID_START = 7; // 7am
const GRID_END = 22; // 10pm
const HOUR_H = 78;

// Event colors by type (kept consistent with the rest of the app)
const TYPE_STYLE = {
  VEHICLE: { bg: '#4f86f7' },
  MEETING_ROOM: { bg: '#7c6cf0' },
  BLOCK: { bg: '#f472b6' },
};
const LEGEND = { VEHICLE: '#4f86f7', MEETING_ROOM: '#7c6cf0', BLOCK: '#f472b6' };

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
        dow: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][i],
        month: dd.getUTCMonth() + 1,
        year: dd.getUTCFullYear(),
      };
    });
  }, [anchor]);

  const todayKey = useMemo(() => { const n = bkkParts(new Date()); return keyOf(n.y, n.mo, n.d); }, []);
  const anchorKey = (function () { const a = bkkParts(anchor); return keyOf(a.y, a.mo, a.d); })();
  const visibleDays = view === 'day' ? days.filter((d) => d.key === anchorKey) : days;
  const shownDays = visibleDays.length ? visibleDays : [days[0]];

  const fromISO = `${days[0].key}T00:00:00+07:00`;
  const toISO = `${days[6].key}T23:59:59+07:00`;

  const { data } = useQuery({
    queryKey: ['week-cal', days[0].key, days[6].key],
    queryFn: async () => (await api.get('/bookings/calendar', { params: { from: fromISO, to: toISO } })).data,
  });

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

  const viewLabel = (v) => (i18n.language === 'th'
    ? { month: 'เดือน', week: 'สัปดาห์', day: 'วัน' }[v]
    : { month: 'Month', week: 'Week', day: 'Day' }[v]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{t('nav.calendar')}</h1>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-ink-750 rounded-full p-1 text-sm">
          {['month', 'week', 'day'].map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-full font-semibold transition ${view === v ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'}`}>
              {viewLabel(v)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-3 space-y-6 order-2 lg:order-1">
          <MiniCal anchor={anchor} setAnchor={setAnchor} monthLabel={monthLabel} todayKey={todayKey} />

          <Panel title={t('common.filter')}>
            {[
              { key: 'VEHICLE', label: t('resourceType.VEHICLE'), icon: Car },
              { key: 'MEETING_ROOM', label: t('resourceType.MEETING_ROOM'), icon: Building2 },
              { key: 'BLOCK', label: t('nav.blocks'), icon: Construction },
            ].map((row) => (
              <label key={row.key} className="flex items-center gap-3 py-1.5 cursor-pointer text-sm text-slate-600 dark:text-zinc-300">
                <input type="checkbox" checked={filters[row.key]} onChange={() => setFilters((f) => ({ ...f, [row.key]: !f[row.key] }))} className="accent-brand-500 w-4 h-4" />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: LEGEND[row.key] }} />
                {row.label}
              </label>
            ))}
          </Panel>

          <Panel title={t('admin.reportsTitle')}>
            {[
              { key: 'VEHICLE', label: t('resourceType.VEHICLE') },
              { key: 'MEETING_ROOM', label: t('resourceType.MEETING_ROOM') },
              { key: 'BLOCK', label: t('nav.blocks') },
            ].map((row) => (
              <div key={row.key} className="py-1.5">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: LEGEND[row.key] }} />
                  {row.label}
                  <span className="ml-auto text-slate-400 text-xs font-bold">{catCounts[row.key]}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200/70 dark:bg-ink-750 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(catCounts[row.key] / catCounts.total) * 100}%`, background: LEGEND[row.key] }} />
                </div>
              </div>
            ))}
          </Panel>

          {nextEv && (
            <div className="rounded-3xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/70 dark:bg-ink-800 p-5">
              <div className="text-xs font-semibold text-slate-400 mb-1">{fmtRange(nextEv.start, nextEv.end)}</div>
              <div className="font-extrabold leading-snug text-slate-900 dark:text-white mb-3">{nextEv.title}</div>
              <button onClick={() => navigate(`/bookings/${nextEv.bid}`)} className="px-3.5 py-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold">{t('common.details')}</button>
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="lg:col-span-9 order-1 lg:order-2">
          <div className="rounded-3xl border border-slate-200/70 dark:border-zinc-800 bg-white dark:bg-ink-800 overflow-hidden flex flex-col">
            {/* Header: month + navigation */}
            <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-lg font-bold text-slate-900 dark:text-white">{monthLabel}</span>
                <button onClick={() => setAnchor(new Date())} className="px-3 py-1 rounded-full bg-slate-100 dark:bg-ink-750 text-slate-600 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-200">{t('common.today')}</button>
                <button onClick={() => shiftWeek(-1)} className="w-7 h-7 rounded-full bg-slate-100 dark:bg-ink-750 flex items-center justify-center text-slate-500 hover:bg-slate-200"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => shiftWeek(1)} className="w-7 h-7 rounded-full bg-slate-100 dark:bg-ink-750 flex items-center justify-center text-slate-500 hover:bg-slate-200"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Day columns header */}
            <div className="flex px-3 pt-3">
              <div className="w-14 shrink-0 text-[11px] text-slate-400 flex items-end pb-1 pl-1">GMT+7</div>
              {shownDays.map((d) => (
                <div key={d.key} className={`flex-1 rounded-2xl mx-1 py-2 text-center ${d.key === todayKey ? 'bg-lime-300 text-slate-900 dark:bg-lime-400 dark:text-slate-950' : 'bg-slate-100 text-slate-600 dark:bg-ink-750 dark:text-zinc-300'}`}>
                  <div className="text-[11px] opacity-70 font-semibold">{d.dow}</div>
                  <div className="text-2xl font-bold leading-none mt-0.5">{d.dayNum}</div>
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div className="flex-1 overflow-auto p-3" style={{ maxHeight: '68vh' }}>
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
                  <div key={d.key} className="flex-1 relative border-l border-slate-100 dark:border-zinc-800" style={{ height: hours.length * HOUR_H }}>
                    {hours.map((h) => <div key={h} style={{ height: HOUR_H }} className="border-b border-slate-100 dark:border-zinc-800/60" />)}
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
                          className="absolute rounded-xl p-2 text-left text-white overflow-hidden shadow-sm hover:brightness-105 transition"
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
    <div className="rounded-3xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/70 dark:bg-ink-800 p-5">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between mb-2">
        <span className="font-bold text-sm text-slate-900 dark:text-white">{title}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function MiniCal({ anchor, setAnchor, monthLabel, todayKey }) {
  const a = bkkParts(anchor);
  const y = a.y; const m = a.mo;
  const first = new Date(Date.UTC(y, m - 1, 1));
  const startDay = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => { const dd = new Date(Date.UTC(y, m - 1, 1 - startDay + i)); return dd; });
  const anchorKey = keyOf(a.y, a.mo, a.d);
  const dows = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  return (
    <div className="rounded-3xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/70 dark:bg-ink-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-sm text-slate-900 dark:text-white">{monthLabel}</span>
        <div className="flex gap-1.5">
          <button onClick={() => { const d = new Date(anchor); d.setMonth(d.getMonth() - 1); setAnchor(d); }} className="p-1 rounded-full bg-slate-100 dark:bg-ink-750 text-slate-500"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <button onClick={() => { const d = new Date(anchor); d.setMonth(d.getMonth() + 1); setAnchor(d); }} className="p-1 rounded-full bg-slate-100 dark:bg-ink-750 text-slate-500"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-slate-400 mb-1">{dows.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {cells.map((dd, i) => {
          const inMonth = dd.getUTCMonth() + 1 === m;
          const k = keyOf(dd.getUTCFullYear(), dd.getUTCMonth() + 1, dd.getUTCDate());
          const isAnchor = k === anchorKey;
          const isToday = k === todayKey;
          return (
            <button key={i} onClick={() => { setAnchor(new Date(Date.UTC(dd.getUTCFullYear(), dd.getUTCMonth(), dd.getUTCDate(), 5))); }}
              className={`py-1 rounded-full ${isAnchor ? 'bg-slate-900 text-white font-bold dark:bg-white dark:text-slate-900' : isToday ? 'text-brand-600 font-bold' : inMonth ? 'text-slate-600 dark:text-zinc-300' : 'text-slate-300 dark:text-zinc-600'}`}>
              {dd.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
