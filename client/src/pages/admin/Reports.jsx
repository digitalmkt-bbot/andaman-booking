import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { api } from '../../api.js';
import { Card, Spinner, StatTile, Empty } from '../../components/ui.jsx';
import { exportXLSX, exportPDF, exportCSV, printTable } from '../../lib/export.js';

const PIE = ['#1b6ff5', '#059669', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#ec4899'];

export default function Reports() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('vehicles');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params = {};
  if (from) params.from = `${from}T00:00:00+07:00`;
  if (to) params.to = `${to}T23:59:59+07:00`;

  const { data: veh, isLoading: l1 } = useQuery({
    queryKey: ['report-veh', from, to],
    queryFn: async () => (await api.get('/reports/vehicles', { params })).data,
  });
  const { data: room, isLoading: l2 } = useQuery({
    queryKey: ['report-room', from, to],
    queryFn: async () => (await api.get('/reports/rooms', { params })).data,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('admin.reportsTitle')}</h1>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">{t('common.from')}</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('common.to')}</label>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="flex gap-2 border-b border-slate-200 dark:border-zinc-800">
        {[
          { k: 'vehicles', label: t('admin.vehicleReport') },
          { k: 'rooms', label: t('admin.roomReport') },
        ].map((x) => (
          <button
            key={x.k}
            onClick={() => setTab(x.k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === x.k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 dark:text-zinc-400'}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'vehicles' ? (
        l1 ? <Spinner /> : <VehicleReport data={veh} />
      ) : l2 ? (
        <Spinner />
      ) : (
        <RoomReport data={room} />
      )}
    </div>
  );
}

function ExportBar({ filename, title, columns, rows, objectRows }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-secondary text-xs" onClick={() => exportXLSX(filename, objectRows)}>
        {t('common.export')} Excel
      </button>
      <button className="btn-secondary text-xs" onClick={() => exportCSV(filename, objectRows)}>
        CSV
      </button>
      <button className="btn-secondary text-xs" onClick={() => exportPDF(filename, title, columns, rows)}>
        PDF
      </button>
      <button className="btn-secondary text-xs" onClick={() => printTable(title, columns, rows)}>
        {t('common.print')}
      </button>
    </div>
  );
}

function VehicleReport({ data }) {
  const { t } = useTranslation();
  if (!data) return <Empty />;
  const objectRows = data.byVehicle.map((v) => ({ Vehicle: v.name, Bookings: v.count, Hours: v.hours }));
  const columns = ['Vehicle', 'Bookings', 'Hours'];
  const rows = data.byVehicle.map((v) => [v.name, v.count, v.hours]);

  return (
    <div className="space-y-4">
      <ExportBar filename="vehicle-report" title="Vehicle Booking Report" columns={columns} rows={rows} objectRows={objectRows} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t('admin.totalBookings')} value={data.total} />
        <StatTile label={t('admin.mostBooked')} value={data.mostBooked || '—'} accent="text-emerald-600" />
        <StatTile label={t('admin.leastBooked')} value={data.leastBooked || '—'} accent="text-amber-600" />
        <StatTile label={t('myBookings.cancelled')} value={data.cancelledCount} accent="text-red-600" />
      </div>

      <Card>
        <h3 className="font-semibold text-slate-700 mb-3">{t('admin.vehicleReport')}</h3>
        {data.byVehicle.length ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.byVehicle}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#1b6ff5" radius={[4, 4, 0, 0]} name="Bookings" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <GroupPie title={t('admin.byDept')} data={data.byDepartment} />
        <GroupPie title={t('admin.byPurpose')} data={data.byPurpose} />
      </div>
      <GroupList title={t('admin.byUser')} data={data.byUser} />
    </div>
  );
}

function RoomReport({ data }) {
  const { t } = useTranslation();
  if (!data) return <Empty />;
  const objectRows = data.byHour.map((h) => ({ Hour: h.hour, Bookings: h.count }));
  const columns = ['Hour', 'Bookings'];
  const rows = data.byHour.map((h) => [h.hour, h.count]);

  return (
    <div className="space-y-4">
      <ExportBar filename="room-report" title="Meeting Room Report" columns={columns} rows={rows} objectRows={objectRows} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t('admin.totalBookings')} value={data.total} />
        <StatTile label={t('admin.totalHours')} value={data.totalHours} accent="text-emerald-600" />
        <StatTile label={t('admin.byHour')} value={data.busiestHour || '—'} accent="text-amber-600" />
        <StatTile label={t('myBookings.cancelled')} value={data.cancelledCount} accent="text-red-600" />
      </div>

      <Card>
        <h3 className="font-semibold text-slate-700 mb-3">{t('admin.byHour')}</h3>
        {data.byHour.length ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.byHour}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} name="Bookings" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <GroupPie title={t('admin.byDept')} data={data.byDepartment} />
        <GroupList title={t('admin.byUser')} data={data.byUser} />
      </div>
    </div>
  );
}

function GroupPie({ title, data }) {
  if (!data?.length) return null;
  return (
    <Card>
      <h3 className="font-semibold text-slate-700 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={(e) => e.label}>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE[i % PIE.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}

function GroupList({ title, data }) {
  if (!data?.length) return null;
  return (
    <Card>
      <h3 className="font-semibold text-slate-700 mb-3">{title}</h3>
      <div className="space-y-1">
        {data.map((r) => (
          <div key={r.label} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
            <span className="text-slate-600">{r.label}</span>
            <span className="font-medium text-slate-800">{r.count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
