import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.js';
import { Card, Spinner, Empty, Modal, Field, Badge } from '../../components/ui.jsx';

export default function Departments() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['departments'], queryFn: async () => (await api.get('/departments')).data });
  const depts = data?.departments || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('admin.deptsTitle')}</h1>
        <button className="btn-primary text-sm" onClick={() => setModal({})}>
          + {t('admin.addDept')}
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : depts.length === 0 ? (
        <Empty />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-ink-750 text-slate-500 dark:text-zinc-400 text-left">
              <tr>
                <th className="px-4 py-3">{t('admin.deptCode')}</th>
                <th className="px-4 py-3">{t('admin.deptName')}</th>
                <th className="px-4 py-3">{t('common.status')}</th>
                <th className="px-4 py-3">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {depts.map((d) => (
                <tr key={d.id} className="border-t border-slate-100 dark:border-zinc-800">
                  <td className="px-4 py-3">{d.departmentCode}</td>
                  <td className="px-4 py-3">{d.departmentName}</td>
                  <td className="px-4 py-3">
                    <Badge className={d.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                      {d.status === 'ACTIVE' ? t('common.active') : t('common.inactive')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button className="btn-ghost text-xs" onClick={() => setModal(d)}>
                      {t('common.edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {modal && <DeptModal dept={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); qc.invalidateQueries(); }} />}
    </div>
  );
}

function DeptModal({ dept, onClose, onSaved }) {
  const { t } = useTranslation();
  const editing = !!dept;
  const [form, setForm] = useState({
    departmentCode: dept?.departmentCode || '',
    departmentName: dept?.departmentName || '',
    status: dept?.status || 'ACTIVE',
  });
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setErr(null);
    try {
      if (editing) await api.patch(`/departments/${dept.id}`, { departmentName: form.departmentName, status: form.status });
      else await api.post('/departments', form);
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || t('common.error'));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? t('common.edit') : t('admin.addDept')}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn-primary" onClick={save}>{t('common.save')}</button>
        </>
      }
    >
      {!editing && (
        <Field label={t('admin.deptCode')} required>
          <input className="input" value={form.departmentCode} onChange={(e) => set('departmentCode', e.target.value)} />
        </Field>
      )}
      <Field label={t('admin.deptName')} required>
        <input className="input" value={form.departmentName} onChange={(e) => set('departmentName', e.target.value)} />
      </Field>
      <Field label={t('common.status')}>
        <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
          <option value="ACTIVE">{t('common.active')}</option>
          <option value="INACTIVE">{t('common.inactive')}</option>
        </select>
      </Field>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </Modal>
  );
}
