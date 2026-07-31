import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, Spinner, StatusBadge, Modal, Field } from '../components/ui.jsx';
import { fmtDateTime, STATUS_COLORS, toBangkokISO } from '../lib/format.js';

export default function BookingDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['booking', id],
    queryFn: async () => (await api.get(`/bookings/${id}`)).data,
  });

  if (isLoading) return <Spinner />;
  const b = data?.booking;
  if (!b) return <Card>{t('common.noData')}</Card>;

  const isOwner = b.requesterId === user?.id;
  const editable = (isOwner || isAdmin) && ['CONFIRMED'].includes(b.status) && (isAdmin || new Date(b.startDatetime) > new Date());
  const cancellable = (isOwner || isAdmin) && ['CONFIRMED', 'ACTIVE'].includes(b.status) && (isAdmin || new Date(b.startDatetime) > new Date());

  async function doCancel() {
    setMsg(null);
    try {
      await api.post(`/bookings/${id}/cancel`, { reason });
      setShowCancel(false);
      qc.invalidateQueries();
      refetch();
    } catch (e) {
      setMsg({ type: 'error', text: apiError(e).message || t('common.error') });
    }
  }

  const Row = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-700 text-right">{value}</span>
    </div>
  );

  return (
    <div className="space-y-4 max-w-2xl">
      <button className="btn-ghost text-sm" onClick={() => navigate(-1)}>
        ← {t('common.back')}
      </button>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('detail.title')}</h1>
        <StatusBadge status={b.status} colors={STATUS_COLORS} label={t(`bookingStatus.${b.status}`)} />
      </div>

      <Card>
        <Row label={t('booking.bookingNumber')} value={b.bookingNumber} />
        <Row label={t('booking.resource')} value={`${b.resource?.resourceName} (${t(`resourceType.${b.bookingType}`)})`} />
        <Row label={t('booking.requester')} value={b.requesterName || b.requester?.fullName} />
        <Row label={t('booking.department')} value={b.department?.departmentName || b.requester?.department?.departmentName || '—'} />
        <Row label={t('booking.startTime')} value={fmtDateTime(b.startDatetime, i18n.language)} />
        <Row label={t('booking.endTime')} value={fmtDateTime(b.endDatetime, i18n.language)} />
        {b.purpose && <Row label={t('booking.purpose')} value={b.purpose} />}
        {b.status === 'CANCELLED' && (
          <>
            <Row label={t('detail.cancelReason')} value={b.cancellationReason} />
            <Row label={t('detail.cancelledAt')} value={fmtDateTime(b.cancelledAt, i18n.language)} />
          </>
        )}
      </Card>

      {(editable || cancellable) && (
        <div className="flex gap-2">
          {editable && (
            <button className="btn-secondary" onClick={() => setShowEdit(true)}>
              {t('detail.editBooking')}
            </button>
          )}
          {cancellable && (
            <button className="btn-danger" onClick={() => setShowCancel(true)}>
              {t('detail.cancelBooking')}
            </button>
          )}
        </div>
      )}
      {!editable && !cancellable && ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(b.status) === false && (
        <p className="text-xs text-slate-400">{t('detail.cannotEdit')}</p>
      )}

      {msg && <div className="p-3 rounded bg-red-50 text-red-700 text-sm">{msg.text}</div>}

      {/* Cancel modal */}
      <Modal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title={t('detail.cancelBooking')}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowCancel(false)}>
              {t('common.close')}
            </button>
            <button className="btn-danger" onClick={doCancel} disabled={!reason.trim()}>
              {t('detail.confirmCancel')}
            </button>
          </>
        }
      >
        <Field label={t('detail.cancelReason')} required>
          <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>

      {/* Edit modal */}
      <EditModal open={showEdit} onClose={() => setShowEdit(false)} booking={b} onSaved={() => { setShowEdit(false); qc.invalidateQueries(); refetch(); }} />
    </div>
  );
}

function EditModal({ open, onClose, booking, onSaved }) {
  const { t } = useTranslation();
  const isVehicle = booking.bookingType === 'VEHICLE';
  const startD = new Date(booking.startDatetime);
  const endD = new Date(booking.endDatetime);
  const toDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d);
  const toTime = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

  const [startDate, setStartDate] = useState(toDate(startD));
  const [startTime, setStartTime] = useState(toTime(startD));
  const [endDate, setEndDate] = useState(toDate(endD));
  const [endTime, setEndTime] = useState(toTime(endD));
  const [purpose, setPurpose] = useState(booking.purpose || '');
  const [resources, setResources] = useState([]);
  const [resourceId, setResourceId] = useState(booking.resourceId);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (open && isVehicle) {
      api.get('/resources', { params: { type: 'VEHICLE' } }).then((r) => setResources(r.data.resources));
    }
  }, [open, isVehicle]);

  async function save() {
    setErr(null);
    const s = toBangkokISO(startDate, startTime);
    const e = toBangkokISO(isVehicle ? endDate : startDate, endTime);
    try {
      await api.patch(`/bookings/${booking.id}`, { resourceId, start: s, end: e, purpose: isVehicle ? purpose : undefined });
      onSaved();
    } catch (ex) {
      const d = apiError(ex);
      if (d.error === 'BOOKING_OVERLAP') setErr(t('booking.overlap'));
      else if (d.error === 'RESOURCE_BLOCKED') setErr(t('booking.blocked'));
      else setErr(d.message || t('common.error'));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('detail.editBooking')}
      wide
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
      <div className="grid sm:grid-cols-2 gap-3">
        {isVehicle && (
          <Field label={t('booking.selectVehicle')}>
            <select className="input" value={resourceId} onChange={(e) => setResourceId(Number(e.target.value))}>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.resourceName}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={isVehicle ? t('booking.startDate') : t('booking.useDate')}>
          <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label={t('booking.startTime')}>
          <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </Field>
        {isVehicle && (
          <Field label={t('booking.endDate')}>
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        )}
        <Field label={t('booking.endTime')}>
          <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
        {isVehicle && (
          <div className="sm:col-span-2">
            <Field label={t('booking.purpose')}>
              <textarea className="input" rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </Field>
          </div>
        )}
      </div>
      {err && <div className="p-3 rounded bg-red-50 text-red-700 text-sm">{err}</div>}
    </Modal>
  );
}
