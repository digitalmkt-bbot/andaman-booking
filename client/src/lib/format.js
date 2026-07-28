// Datetime helpers. Uses Asia/Bangkok display but native Date under the hood.

export function fmtDateTime(d, lang = 'th') {
  if (!d) return '—';
  const date = new Date(d);
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

export function fmtDate(d, lang = 'th') {
  if (!d) return '—';
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', {
    dateStyle: 'medium',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(d));
}

export function fmtTime(d, lang = 'th') {
  if (!d) return '—';
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', {
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(d));
}

// Build an ISO string with the Asia/Bangkok (+07:00) offset from date + time inputs.
export function toBangkokISO(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  return `${dateStr}T${timeStr}:00+07:00`;
}

export const STATUS_COLORS = {
  CONFIRMED: 'bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  ACTIVE: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  COMPLETED: 'bg-slate-200 text-slate-600 dark:bg-zinc-700/50 dark:text-zinc-300',
  CANCELLED: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  EXPIRED: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
};

export const RESOURCE_STATUS_COLORS = {
  AVAILABLE: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  BOOKED: 'bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  IN_USE: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  DISABLED: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  UNAVAILABLE: 'bg-slate-200 text-slate-600 dark:bg-zinc-700/50 dark:text-zinc-300',
};

export const CALENDAR_EVENT_COLORS = {
  CONFIRMED: '#4f86f7',
  ACTIVE: '#10b981',
  COMPLETED: '#94a3b8',
  BLOCK: '#f472b6',
};

// Categorical palette for charts (reference-derived)
export const CHART_PALETTE = ['#4f86f7', '#10b981', '#f472b6', '#f59e0b', '#7ca5f5', '#a78bfa', '#22d3ee'];
