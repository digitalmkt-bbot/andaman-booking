import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.js';
import { Card, Spinner, Empty, Modal, Field, Badge } from '../../components/ui.jsx';
import { fmtDateTime, toBangkokISO } from '../../lib/format.js';

export default function Blocks() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: resData } = useQuery({ queryKey: ['resources'], queryFn: async () => (await api.get('/resources')).data });
  const { data, isLoading } = useQuery({ queryKey: ['blocks'], queryFn: async () => (await api.get('/blocks')).data });

  async function cancelBlock(id) {
    await api.post(`/blocks/${id}/cancel`);
    qc.invalidateQueries();
  }

  const blocks = data?.blocks || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('admin.blocksTitle')}</h1>
        <button className="btn-primary text-sm" onClick={() => setOpen(true)}>
          + {t('admin.addBlock')}
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : blocks.length === 0 ? (
        <Empty />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-ink-750 text-slate-500 dark:text-zinc-400 text-left">
              <tr>
                <th className="px-4 py-3">{t('booking.resource')}</th>
                <th className="px-4 py-3">{t('admin.blockType')}</th>
                <th className="px-4 py-3">{t('booking.period')}</th>
                <th className="px-4 py-3">{t('common.reason')}</th>
                <th className="px-4 py-3">{t('common.status')}</th>
                <th className="px-4 py-3">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.id} className="border-t border-slate-100 dark:border-zinc-800">
                  <td className="px-4 py-3">{b.resource?.resourceName}</td>
                  <td className="px-4 py-3">{t(`blockType.${b.blockType}`)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {fmtDateTime(b.startDatetime, i18n.language)} — {fmtDateTime(b.endDatetime, i18n.language)}
                  </td>
                  <td className="px-4 py-3">{b.reason || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={b.status === 'ACTIVE' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-500'}>{b.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {b.status === 'ACTIVE' && (
                      <button className="btn-ghost text-xs text-red-600" onClick={() => cancelBlock(b.id)}>
                        {t('common.cancel')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {open && <BlockModal resources={resData?.resources || []} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); qc.invalidateQueries(); }} />}
    </div>
  );
}

function BlockModal({ resources, onClose, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    resourceId: resources[0]?.id || '',
    startDate: '',
    startTime: '00:00',
    endDate: '',
    endTime: '23:59',
    blockType: 'MAINTENANCE',
    reason: '',
  });
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setErr(null);
    try {
      await api.post('/blocks', {
        resourceId: Number(form.resourceId),
        start: toBangkokISO(form.startDate, form.startTime),
        end: toBangkokISO(form.endDate, form.endTime),
        blockType: form.blockType,
        reason: form.reason,
      });
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.error || t('common.error'));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('admin.addBlock')}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn-primary" onClick={save}>{t('common.save')}</button>
        </>
      }
    >
      <Field label={t('booking.resource')} required>
        <select className="input" value={form.resourceId} onChange={(e) => set('resourceId', e.target.value)}>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.resourceName}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('admin.blockType')} required>
        <select className="input" value={form.blockType} onChange={(e) => set('blockType', e.target.value)}>
          {['MAINTENANCE', 'CLEANING', 'INTERNAL', 'UNAVAILABLE', 'OTHER'].map((x) => (
            <option key={x} value={x}>
              {t(`blockType.${x}`)}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('booking.startDate')} required>
          <input type="date" className="input" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label={t('booking.startTime')} required>
          <input type="time" className="input" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
        </Field>
        <Field label={t('booking.endDate')} required>
          <input type="date" className="input" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
        </Field>
        <Field label={t('booking.endTime')} required>
          <input type="time" className="input" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
        </Field>
      </div>
      <Field label={t('common.reason')}>
        <textarea className="input" rows={2} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
      </Field>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </Modal>
  );
}
