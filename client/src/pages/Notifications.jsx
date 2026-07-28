import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { Card, Spinner, Empty } from '../components/ui.jsx';
import { fmtDateTime } from '../lib/format.js';

export default function Notifications() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications')).data,
  });

  async function markAll() {
    await api.post('/notifications/read-all');
    qc.invalidateQueries();
  }
  async function markOne(id) {
    await api.post(`/notifications/${id}/read`);
    qc.invalidateQueries();
  }

  if (isLoading) return <Spinner />;
  const list = data?.notifications || [];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('notifications.title')}</h1>
        {data?.unread > 0 && (
          <button className="btn-secondary text-sm" onClick={markAll}>
            {t('notifications.markAllRead')}
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <Empty text={t('notifications.empty')} />
      ) : (
        <div className="space-y-2">
          {list.map((n) => (
            <Card key={n.id} className={`${!n.readAt ? 'border-l-4 border-l-brand-500' : ''} cursor-pointer`} >
              <div onClick={() => !n.readAt && markOne(n.id)} className="flex justify-between gap-3">
                <div>
                  <p className={`text-sm ${!n.readAt ? 'font-medium text-slate-800' : 'text-slate-600'}`}>{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{fmtDateTime(n.sentAt, i18n.language)}</p>
                </div>
                {!n.readAt && <span className="h-2 w-2 rounded-full bg-brand-500 mt-1 flex-shrink-0" />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
