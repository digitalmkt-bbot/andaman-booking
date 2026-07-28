import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api.js';
import { Card, Badge } from '../../components/ui.jsx';

export default function Settings() {
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: ['health'], queryFn: async () => (await api.get('/health')).data });

  const channels = [
    { key: 'IN_APP', label: 'In-app Notification', always: true },
    { key: 'EMAIL', label: 'Email (SMTP)', env: 'EMAIL_ENABLED' },
    { key: 'LINE', label: 'LINE Messaging API', env: 'LINE_ENABLED' },
    { key: 'GOOGLE', label: 'Google Calendar', env: 'GOOGLE_CALENDAR_ENABLED' },
    { key: 'OUTLOOK', label: 'Microsoft Outlook', env: 'OUTLOOK_ENABLED' },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('admin.settingsTitle')}</h1>

      <Card>
        <h2 className="font-semibold text-slate-700 mb-3">{t('admin.integrations')}</h2>
        <p className="text-sm text-slate-500 mb-4">
          {t('common.status')}: การเปิดใช้งานช่องทางแจ้งเตือนภายนอกกำหนดผ่านไฟล์ <code className="bg-slate-100 px-1 rounded">server/.env</code>.
          External notification channels are configured via <code className="bg-slate-100 px-1 rounded">server/.env</code>.
        </p>
        <div className="space-y-2">
          {channels.map((c) => (
            <div key={c.key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div>
                <div className="text-sm font-medium text-slate-700">{c.label}</div>
                {c.env && <code className="text-xs text-slate-400">{c.env}=true</code>}
              </div>
              <Badge className={c.always ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                {c.always ? t('common.active') : 'env'}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-700 mb-3">System</h2>
        <div className="flex justify-between text-sm py-1">
          <span className="text-slate-500">API</span>
          <Badge className={data?.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
            {data?.ok ? 'Online' : 'Offline'}
          </Badge>
        </div>
        <div className="flex justify-between text-sm py-1">
          <span className="text-slate-500">Timezone</span>
          <span className="text-slate-700">Asia/Bangkok (UTC+7)</span>
        </div>
      </Card>
    </div>
  );
}
