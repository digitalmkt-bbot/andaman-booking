import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.js';
import { Card, Spinner, StatusBadge, Modal, Field } from '../../components/ui.jsx';
import { RESOURCE_STATUS_COLORS } from '../../lib/format.js';

export default function Resources() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState('VEHICLE');
  const [modal, setModal] = useState(null); // {mode, resource}

  const { data, isLoading } = useQuery({
    queryKey: ['resources-admin'],
    queryFn: async () => (await api.get('/resources')).data,
  });

  const resources = (data?.resources || []).filter((r) => r.resourceType === tab);

  async function toggleActive(r) {
    await api.patch(`/resources/${r.id}/active`, { active: !r.active });
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('admin.resourcesTitle')}</h1>
        <button className="btn-primary text-sm" onClick={() => setModal({ mode: tab === 'VEHICLE' ? 'vehicle' : 'room' })}>
          + {tab === 'VEHICLE' ? t('admin.addVehicle') : t('admin.addRoom')}
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-zinc-800">
        {['VEHICLE', 'MEETING_ROOM'].map((x) => (
          <button
            key={x}
            onClick={() => setTab(x)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === x ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 dark:text-zinc-400'
            }`}
          >
            {t(`resourceType.${x}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-slate-800">{r.resourceName}</div>
                  <div className="text-xs text-slate-400">{r.resourceCode}</div>
                </div>
                <StatusBadge status={r.status} colors={RESOURCE_STATUS_COLORS} label={t(`resourceStatus.${r.status}`)} />
              </div>
              {r.vehicle && (
                <div className="text-xs text-slate-500 mt-2">
                  {t('admin.licensePlate')}: {r.vehicle.licensePlate || '—'} · {t('admin.color')}: {r.vehicle.color || '—'}
                </div>
              )}
              {r.meetingRoom && (
                <div className="text-xs text-slate-500 mt-2">
                  {r.meetingRoom.location} · {r.meetingRoom.openingTime}–{r.meetingRoom.closingTime}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button className="btn-secondary text-xs" onClick={() => setModal({ mode: r.vehicle ? 'vehicle' : 'room', resource: r })}>
                  {t('common.edit')}
                </button>
                <button className={`text-xs ${r.active ? 'btn-danger' : 'btn-primary'}`} onClick={() => toggleActive(r)}>
                  {r.active ? t('admin.disable') : t('admin.enable')}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && <ResourceModal modal={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); qc.invalidateQueries(); }} />}
    </div>
  );
}

function ResourceModal({ modal, onClose, onSaved }) {
  const { t } = useTranslation();
  const isVehicle = modal.mode === 'vehicle';
  const r = modal.resource;
  const editing = !!r;
  const [form, setForm] = useState(
    isVehicle
      ? {
          resourceCode: r?.resourceCode || '',
          vehicleName: r?.vehicle?.vehicleName || r?.resourceName || '',
          licensePlate: r?.vehicle?.licensePlate || '',
          color: r?.vehicle?.color || '',
          note: r?.vehicle?.note || '',
        }
      : {
          resourceCode: r?.resourceCode || '',
          roomName: r?.meetingRoom?.roomName || r?.resourceName || '',
          location: r?.meetingRoom?.location || '',
          openingTime: r?.meetingRoom?.openingTime || '08:00',
          closingTime: r?.meetingRoom?.closingTime || '18:00',
          note: r?.meetingRoom?.note || '',
        }
  );
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setErr(null);
    try {
      if (isVehicle) {
        if (editing) await api.patch(`/resources/vehicles/${r.id}`, form);
        else await api.post('/resources/vehicles', form);
      } else {
        if (editing) await api.patch(`/resources/rooms/${r.id}`, form);
        else await api.post('/resources/rooms', form);
      }
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || t('common.error'));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isVehicle ? t('admin.vehicles') : t('admin.rooms')}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={save}>
            {t('common.save')}
          </button>
        </>
      }
    >
      {!editing && (
        <Field label="Code" required>
          <input className="input" value={form.resourceCode} onChange={(e) => set('resourceCode', e.target.value)} />
        </Field>
      )}
      {isVehicle ? (
        <>
          <Field label={t('admin.vehicles')} required>
            <input className="input" value={form.vehicleName} onChange={(e) => set('vehicleName', e.target.value)} />
          </Field>
          <Field label={t('admin.licensePlate')}>
            <input className="input" value={form.licensePlate} onChange={(e) => set('licensePlate', e.target.value)} />
          </Field>
          <Field label={t('admin.color')}>
            <input className="input" value={form.color} onChange={(e) => set('color', e.target.value)} />
          </Field>
        </>
      ) : (
        <>
          <Field label={t('admin.rooms')} required>
            <input className="input" value={form.roomName} onChange={(e) => set('roomName', e.target.value)} />
          </Field>
          <Field label={t('admin.location')}>
            <input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('admin.openingTime')}>
              <input type="time" className="input" value={form.openingTime} onChange={(e) => set('openingTime', e.target.value)} />
            </Field>
            <Field label={t('admin.closingTime')}>
              <input type="time" className="input" value={form.closingTime} onChange={(e) => set('closingTime', e.target.value)} />
            </Field>
          </div>
        </>
      )}
      <Field label={t('admin.note')}>
        <textarea className="input" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
      </Field>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </Modal>
  );
}
