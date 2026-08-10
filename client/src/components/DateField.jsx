import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

// A locale-independent date field that ALWAYS displays DD/MM/YYYY and stores the
// value as an ISO 'YYYY-MM-DD' string (same shape the native <input type="date">
// produced), so the rest of the form keeps working unchanged. Includes a small
// calendar popover for picking, so behaviour is consistent on every device.
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
function toDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function DateField({ value, onChange, min, placeholder = 'วว/ดด/ปปปป' }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => (value ? new Date(`${value}T00:00:00`) : new Date()));
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  useEffect(() => { if (value) setView(new Date(`${value}T00:00:00`)); }, [value]);

  const y = view.getFullYear();
  const m = view.getMonth();
  const first = new Date(y, m, 1);
  const startDay = (first.getDay() + 6) % 7; // Monday-first
  const cells = Array.from({ length: 42 }, (_, i) => new Date(y, m, 1 - startDay + i));
  const monthLabel = view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const dows = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const todayIso = isoOf(new Date());

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="input flex items-center justify-between text-left">
        <span className={value ? 'text-slate-800 dark:text-zinc-100' : 'text-slate-400'}>{value ? toDisplay(value) : placeholder}</span>
        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-ink-800 shadow-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setView(new Date(y, m - 1, 1))} className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-750"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-bold text-slate-900 dark:text-white">{monthLabel}</span>
            <button type="button" onClick={() => setView(new Date(y, m + 1, 1))} className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-750"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-slate-400 mb-1">{dows.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
            {cells.map((dt, i) => {
              const iso = isoOf(dt);
              const inMonth = dt.getMonth() === m;
              const sel = iso === value;
              const isToday = iso === todayIso;
              const disabled = min && iso < min;
              return (
                <button
                  type="button"
                  key={i}
                  disabled={disabled}
                  onClick={() => { onChange(iso); setOpen(false); }}
                  className={`py-1.5 rounded-full transition ${
                    sel
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                      : isToday
                      ? 'text-brand-600 font-bold'
                      : inMonth
                      ? 'text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-ink-750'
                      : 'text-slate-300 dark:text-zinc-600'
                  } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  {dt.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
