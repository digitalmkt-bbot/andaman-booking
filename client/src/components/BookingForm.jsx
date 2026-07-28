import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../api.js';
import { Card, Field } from './ui.jsx';
import { toBangkokISO, fmtDate } from '../lib/format.js';

/**
 * Shared booking form used for both vehicles and meeting rooms.
 * props.type: 'VEHICLE' | 'MEETING_ROOM'
 */
export default function BookingForm({ type }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isVehicle = type === 'VEHICLE';

  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('11:00');
  const [purpose, setPurpose] = useState('');
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState(null);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState(null);

  // recurring
  const [recurrenceType, setRecurrenceType] = useState('NONE');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');

  const effectiveEndDate = isVehicle ? endDate : startDate;

  function validWindow() {
    const s = toBangkokISO(startDate, startTime);
    const e = toBangkokISO(effectiveEndDate, endTime);
    if (!s || !e) return null;
    if (new Date(e) <= new Date(s)) {
      setMsg({ type: 'error', text: t('booking.endMustBeAfterStart') });
      return null;
    }
    if (new Date(s) < new Date()) {
      setMsg({ type: 'error', text: t('booking.noBackdate') });
      return null;
    }
    return { s, e };
  }

  async function checkAvailability() {
    setMsg(null);
    setSelected(null);
    const w = validWindow();
    if (!w) return;
    setChecking(true);
    try {
      const r = await api.post('/bookings/availability', { bookingType: type, start: w.s, end: w.e });
      setResults(r.data.results);
      if (!isVehicle) {
        // Auto-select the single room if available.
        const room = r.data.results[0];
        if (room?.available) setSelected(room.resourceId);
      }
    } catch (e) {
      setMsg({ type: 'error', text: t('common.error') });
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    setMsg(null);
    const w = validWindow();
    if (!w) return;
    if (!selected) {
      setMsg({ type: 'error', text: t('booking.selectResourceFirst') });
      return;
    }
    const base = {
      bookingType: type,
      resourceId: selected,
      start: w.s,
      end: w.e,
      purpose: isVehicle ? purpose : null,
    };
    try {
      if (recurrenceType !== 'NONE') {
        if (!recurrenceEnd) {
          setMsg({ type: 'error', text: t('booking.recurrenceEnd') + ' ' + t('common.required') });
          return;
        }
        const r = await api.post('/bookings/recurring', {
          ...base,
          recurrenceType,
          recurrenceEndDate: toBangkokISO(recurrenceEnd, '23:59'),
        });
        setMsg({ type: 'success', text: t('booking.createdCount', { count: r.data.count }) });
      } else {
        const r = await api.post('/bookings', base);
        setMsg({ type: 'success', text: `${t('booking.bookingSuccess')} · ${r.data.booking.bookingNumber}` });
      }
      qc.invalidateQueries();
      setTimeout(() => navigate('/my-bookings'), 1200);
    } catch (e) {
      const err = apiError(e);
      if (err.error === 'BOOKING_OVERLAP') setMsg({ type: 'error', text: t('booking.overlap') });
      else if (err.error === 'RESOURCE_BLOCKED') setMsg({ type: 'error', text: t('booking.blocked') });
      else if (err.error === 'RECURRING_CONFLICT') {
        const dates = (err.conflicts || []).map((c) => fmtDate(c.start, i18n.language)).join(', ');
        setMsg({ type: 'error', text: `${t('booking.recurringConflict')} (${t('booking.conflictDates')}: ${dates})` });
      } else if (err.error === 'NO_BACKDATING') setMsg({ type: 'error', text: t('booking.noBackdate') });
      else if (err.error === 'INVALID_RANGE') setMsg({ type: 'error', text: t('booking.endMustBeAfterStart') });
      else setMsg({ type: 'error', text: err.message || t('common.error') });
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{isVehicle ? t('booking.newVehicle') : t('booking.newRoom')}</h1>

      <Card>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={isVehicle ? t('booking.startDate') : t('booking.useDate')} required>
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label={t('booking.startTime')} required>
            <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          {isVehicle && (
            <Field label={t('booking.endDate')} required>
              <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          )}
          <Field label={t('booking.endTime')} required>
            <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>

        {/* Recurring */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t('booking.recurrenceType')}>
            <select className="input" value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)}>
              <option value="NONE">{t('booking.once')}</option>
              <option value="DAILY">{t('booking.daily')}</option>
              <option value="WEEKLY">{t('booking.weekly')}</option>
              <option value="MONTHLY">{t('booking.monthly')}</option>
            </select>
          </Field>
          {recurrenceType !== 'NONE' && (
            <Field label={t('booking.recurrenceEnd')} required>
              <input type="date" className="input" value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)} />
            </Field>
          )}
        </div>

        <button className="btn-secondary" onClick={checkAvailability} disabled={checking}>
          {checking ? '...' : isVehicle ? t('booking.checkAvailability') : t('booking.checkRoom')}
        </button>
      </Card>

      {/* Results */}
      {results && (
        <Card>
          {isVehicle ? (
            <>
              <h2 className="font-semibold text-slate-700 mb-3">{t('booking.selectVehicle')}</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {results.map((r) => (
                  <button
                    key={r.resourceId}
                    disabled={!r.available}
                    onClick={() => setSelected(r.resourceId)}
                    className={`text-left p-4 rounded-lg border-2 transition ${
                      selected === r.resourceId
                        ? 'border-brand-600 bg-brand-50'
                        : r.available
                        ? 'border-slate-200 hover:border-brand-300'
                        : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">{r.name}</span>
                      <span className={`badge ${r.available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {r.available ? t('booking.available') : t('booking.unavailable')}
                      </span>
                    </div>
                    {r.vehicle && (
                      <div className="text-xs text-slate-500 mt-1">
                        {r.vehicle.licensePlate} · {r.vehicle.color}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm">
              <p className="text-slate-500 mb-2">{t('booking.roomAuto')}</p>
              {results[0] && (
                <div className={`p-4 rounded-lg border-2 ${results[0].available ? 'border-brand-600 bg-brand-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{results[0].name}</span>
                    <span className={`badge ${results[0].available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {results[0].available ? t('booking.available') : t('booking.unavailable')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {isVehicle && (
            <Field label={t('booking.purpose')} required={false}>
              <textarea className="input" rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </Field>
          )}

          <div className="mt-4">
            <button className="btn-primary" onClick={submit} disabled={!selected}>
              {t('booking.confirmBooking')}
            </button>
          </div>
        </Card>
      )}

      {msg && (
        <div className={`p-4 rounded-lg text-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
