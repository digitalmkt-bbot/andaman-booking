import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api.js';
import { Card, Spinner, Empty, Badge } from '../../components/ui.jsx';
import { fmtDateTime } from '../../lib/format.js';
import { exportXLSX } from '../../lib/export.js';

export default function AuditLog() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ['audit'], queryFn: async () => (await api.get('/audit')).data });
  const logs = data?.logs || [];

  function doExport() {
    exportXLSX(
      'audit-log',
      logs.map((l) => ({
        Time: fmtDateTime(l.actionDatetime, 'en'),
        User: l.user?.fullName || '',
        Module: l.module,
        Action: l.action,
        Record: l.recordId || '',
        IP: l.ipAddress || '',
      }))
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('admin.auditTitle')}</h1>
        <button className="btn-secondary text-sm" onClick={doExport}>
          {t('common.export')} Excel
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : logs.length === 0 ? (
        <Empty />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-ink-750 text-slate-500 dark:text-zinc-400 text-left">
              <tr>
                <th className="px-4 py-3">{t('common.time')}</th>
                <th className="px-4 py-3">{t('booking.requester')}</th>
                <th className="px-4 py-3">{t('admin.module')}</th>
                <th className="px-4 py-3">{t('admin.action')}</th>
                <th className="px-4 py-3">Record</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-slate-100 dark:border-zinc-800">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(l.actionDatetime, i18n.language)}</td>
                  <td className="px-4 py-3">{l.user?.fullName || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className="bg-slate-100 text-slate-600">{l.module}</Badge>
                  </td>
                  <td className="px-4 py-3">{l.action}</td>
                  <td className="px-4 py-3">{l.recordId || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{l.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
