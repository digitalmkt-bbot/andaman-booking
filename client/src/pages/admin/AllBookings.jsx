import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Card, Spinner, Empty, StatusBadge } from '../../components/ui.jsx';
import { fmtDateTime, STATUS_COLORS } from '../../lib/format.js';
import { exportXLSX } from '../../lib/export.js';

export default function AllBookings() {
  const { t, i18n } = useTranslation();
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['all-bookings', type, status, from, to],
    queryFn: async () => {
      const params = {};
      if (type) params.bookingType = type;
      if (status) params.status = status;
      if (from) params.from = `${from}T00:00:00+07:00`;
      if (to) params.to = `${to}T23:59:59+07:00`;
      return (await api.get('/bookings', { params })).data;
    },
  });

  const bookings = data?.bookings || [];

  function doExport() {
    exportXLSX(
      'all-bookings',
      bookings.map((b) => ({
        BookingNo: b.bookingNumber,
        Type: b.bookingType,
        Resource: b.resource?.resourceName,
        Requester: b.requester?.fullName,
        Department: b.department?.departmentName || '',
        Start: fmtDateTime(b.startDatetime, 'en'),
        End: fmtDateTime(b.endDatetime, 'en'),
        Status: b.status,
        Purpose: b.purpose || '',
      }))
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('admin.allBookingsTitle')}</h1>
        <button className="btn-secondary text-sm" onClick={doExport}>
          {t('common.export')} Excel
        </button>
      </div>

      <Card>
        <div className="grid sm:grid-cols-4 gap-3">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t('common.all')} ({t('booking.resource')})</option>
            <option value="VEHICLE">{t('resourceType.VEHICLE')}</option>
            <option value="MEETING_ROOM">{t('resourceType.MEETING_ROOM')}</option>
          </select>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('common.all')} ({t('common.status')})</option>
            {['CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'].map((s) => (
              <option key={s} value={s}>
                {t(`bookingStatus.${s}`)}
              </option>
            ))}
          </select>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : bookings.length === 0 ? (
        <Empty />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-ink-750 text-slate-500 dark:text-zinc-400 text-left">
              <tr>
                <th className="px-4 py-3">{t('booking.bookingNumber')}</th>
                <th className="px-4 py-3">{t('booking.resource')}</th>
                <th className="px-4 py-3">{t('booking.requester')}</th>
                <th className="px-4 py-3">{t('booking.period')}</th>
                <th className="px-4 py-3">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-ink-750/40">
                  <td className="px-4 py-3">
                    <Link to={`/bookings/${b.id}`} className="text-brand-600 hover:underline">
                      {b.bookingNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{b.resource?.resourceName}</td>
                  <td className="px-4 py-3">{b.requester?.fullName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {fmtDateTime(b.startDatetime, i18n.language)}
                    <br />
                    {fmtDateTime(b.endDatetime, i18n.language)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} colors={STATUS_COLORS} label={t(`bookingStatus.${b.status}`)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
