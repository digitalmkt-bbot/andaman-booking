import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Spinner, Empty, StatusBadge } from '../components/ui.jsx';
import { fmtDateTime, STATUS_COLORS } from '../lib/format.js';

const TABS = [
  { key: 'upcoming', statuses: ['CONFIRMED'] },
  { key: 'active', statuses: ['ACTIVE'] },
  { key: 'completed', statuses: ['COMPLETED', 'EXPIRED'] },
  { key: 'cancelled', statuses: ['CANCELLED'] },
  { key: 'history', statuses: null },
];

export default function MyBookings() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState('upcoming');
  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: async () => (await api.get('/bookings', { params: { scope: 'mine' } })).data,
  });

  const active = TABS.find((x) => x.key === tab);
  const bookings = (data?.bookings || []).filter((b) => !active.statuses || active.statuses.includes(b.status));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('myBookings.title')}</h1>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-zinc-800">
        {TABS.map((x) => (
          <button
            key={x.key}
            onClick={() => setTab(x.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === x.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
            }`}
          >
            {t(`myBookings.${x.key}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : bookings.length === 0 ? (
        <Empty />
      ) : (
        <div className="grid gap-3">
          {bookings.map((b) => (
            <Link key={b.id} to={`/bookings/${b.id}`}>
              <Card className="hover:shadow-md transition">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-medium text-slate-800">
                      {b.resource?.resourceName}
                      <span className="text-slate-400 text-sm ml-2">{b.bookingNumber}</span>
                      <span className="badge bg-slate-100 text-slate-600 ml-2">{t(`resourceType.${b.bookingType}`)}</span>
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {fmtDateTime(b.startDatetime, i18n.language)} — {fmtDateTime(b.endDatetime, i18n.language)}
                    </div>
                    {b.purpose && <div className="text-xs text-slate-400 mt-1">{b.purpose}</div>}
                  </div>
                  <StatusBadge status={b.status} colors={STATUS_COLORS} label={t(`bookingStatus.${b.status}`)} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
