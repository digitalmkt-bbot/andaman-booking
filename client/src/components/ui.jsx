import { useTranslation } from 'react-i18next';
import { ArrowUpRight } from 'lucide-react';

export function Card({ children, className = '' }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function Badge({ children, className = '' }) {
  return <span className={`badge ${className}`}>{children}</span>;
}

export function StatusBadge({ status, colors, label }) {
  return <Badge className={colors[status] || 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300'}>{label || status}</Badge>;
}

export function Field({ label, children, error, required }) {
  return (
    <div className="mb-4 min-w-0">
      {label && (
        <label className="label">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-white dark:bg-ink-800 rounded-3xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-auto border border-slate-100 dark:border-zinc-800`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 px-5 py-4">
          <h3 className="font-bold text-slate-800 dark:text-zinc-100">{title}</h3>
          <button className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="border-t border-slate-100 dark:border-zinc-800 px-5 py-3 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Spinner() {
  const { t } = useTranslation();
  return <div className="p-8 text-center text-slate-400 dark:text-zinc-500">{t('common.loading')}</div>;
}

export function Empty({ text }) {
  const { t } = useTranslation();
  return <div className="p-8 text-center text-slate-400 dark:text-zinc-500 text-sm">{text || t('common.noData')}</div>;
}

export function StatTile({ label, value, sub, accent = 'text-slate-900 dark:text-white', icon, link }) {
  return (
    <div className="card p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">{label}</span>
        {icon || (link && <ArrowUpRight className="w-4 h-4 text-slate-400" />)}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className={`text-3xl font-bold tracking-tight ${accent}`}>{value}</span>
        {sub}
      </div>
    </div>
  );
}
