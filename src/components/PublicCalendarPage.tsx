import React, { useState, useEffect } from 'react';
import { Loader2, Calendar, Clock, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../supabase';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PublicCalendarPage({ coachId, slug, coacheeName, coacheeEmail, capsuleId, sessionId, onBooked }: { coachId?: string; slug?: string; coacheeName?: string; coacheeEmail?: string; capsuleId?: string; sessionId?: string; onBooked?: () => void }) {
  const [coach, setCoach] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [name, setName] = useState(coacheeName || '');
  const [email, setEmail] = useState(coacheeEmail || '');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState('');
  const [resolvedCoachId, setResolvedCoachId] = useState(coachId || '');

  useEffect(() => {
    (async () => {
      let cid = coachId || '';
      // If slug provided, resolve to full coach ID
      if (!cid && slug && slug.length >= 8) {
        const idPrefix = slug.slice(-8);
        const { data: coaches } = await supabase.from('coaches').select('id').like('id', idPrefix + '%');
        cid = (coaches as any[])?.[0]?.id || '';
      }
      if (!cid) { setLoading(false); return; }
      setResolvedCoachId(cid);
      const [coachRes, slotsRes, bookingsRes] = await Promise.all([
        supabase.from('coaches').select('coach_name,profile_image_url').eq('id', cid).maybeSingle(),
        supabase.from('coach_availability').select('*').eq('coach_id', cid).eq('is_active', true),
        supabase.from('coach_bookings').select('*').eq('coach_id', cid).neq('status', 'cancelled'),
      ]);
      setCoach(coachRes.data);
      setSlots((slotsRes.data as any[]) ?? []);
      setBookings((bookingsRes.data as any[]) ?? []);
      setLoading(false);
    })();
  }, [coachId, slug]);

  const refreshBookings = async () => {
    const { data } = await supabase.from('coach_bookings').select('*').eq('coach_id', resolvedCoachId).neq('status', 'cancelled');
    setBookings((data as any[]) ?? []);
  };

  const calDays: Date[] = [];
  const firstDay = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
  const startOffset = firstDay.getDay();
  for (let i = -startOffset; i < 42 - startOffset; i++) calDays.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), i + 1));

  const slotsForDate = (date: Date) => {
    const dow = date.getDay();
    return slots.filter(s => s.day_of_week === dow);
  };

  const fmtDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const bookingsForDate = (date: Date) => bookings.filter(b => b.booking_date === fmtDate(date));
  const isSlotBooked = (date: string, startTime: string) => bookings.some(b => b.booking_date === date && b.start_time === startTime);

  const handleBook = async () => {
    setError('');
    if (!selectedDate || !selectedSlot) { setError('Please select a date and time slot.'); return; }
    if (!coacheeName && !name) { setError('Name is required.'); return; }
    if (!coacheeEmail && !email) { setError('Email is required.'); return; }

    setSubmitting(true);
    const bookingDate = selectedDate;
    const slotParts = selectedSlot.split('-');
    const startTime = slotParts[0];
    const endTime = slotParts[1] || slotParts[0];

    // Check slot not already booked
    if (isSlotBooked(bookingDate, startTime)) { setError('This slot was just booked. Please select another.'); setSubmitting(false); return; }

    const { error: insErr, data } = await supabase.from('coach_bookings').insert({
      coach_id: resolvedCoachId,
      coachee_name: coacheeName || name,
      coachee_email: coacheeEmail || email,
      booking_date: bookingDate,
      start_time: startTime,
      end_time: endTime,
      status: 'confirmed',
      remarks: remarks || null,
      capsule_id: capsuleId || null,
      session_id: sessionId && sessionId.length >= 8 ? sessionId : null,
      is_standalone: !capsuleId,
    }).select().single();

    setSubmitting(false);
    if (insErr) { setError('Booking failed: ' + insErr.message); return; }

    // Ensure a coaching_sessions row exists for this booking (creates one if needed)
    if (data?.id) {
      const { data: newSessId } = await supabase.rpc('ensure_session_for_booking', { p_booking_id: (data as any).id });
      // Fix timezone: set session_from_dt/to_dt using local time conversion (same as coach's persist)
      if (newSessId) {
        const fromISO = new Date(`${bookingDate}T${startTime}:00`).toISOString();
        const toISO = endTime && endTime !== startTime ? new Date(`${bookingDate}T${endTime}:00`).toISOString() : null;
        await supabase.from('coaching_sessions').update({
          session_from_dt: fromISO,
          session_to_dt: toISO,
        }).eq('id', newSessId as string);
      }
    }

    // Send email with .ics via edge function
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-email`;
      await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ booking: data, coachEmail: '', coachName: coach?.coach_name || 'Coach' }),
      });
    } catch { /* email is best-effort */ }

    setBooked(true);
    await refreshBookings();
    if (onBooked) onBooked();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>;

  const isEmbedded = !!coacheeName;

  if (booked) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-800">Booking Confirmed!</h2>
        <p className="text-sm text-gray-500 mt-2">Your session on {selectedDate} at {selectedSlot.split('-')[0]} has been booked. A calendar invite has been sent to your email.</p>
      </div>
    );
  }

  return (
    <div className={isEmbedded ? '' : 'min-h-screen bg-gray-50'}>
      {!isEmbedded && (
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {coach?.profile_image_url && <img src={coach.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover" />}
            <p className="text-sm font-bold text-gray-800">{coach?.coach_name || 'Coach'}</p>
          </div>
          <p className="text-xs text-teal-600 font-semibold">Powered by Nudged</p>
        </div>
      )}

      <div className={isEmbedded ? 'space-y-4' : 'max-w-3xl mx-auto px-4 py-8 space-y-4'}>
        <h2 className="text-base font-bold text-gray-800">Book a Session</h2>

        {/* Calendar */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="p-1 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold text-gray-700">{calMonth.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="p-1 rounded-lg hover:bg-gray-100"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS.map(d => <div key={d} className="text-xs font-bold text-gray-500 py-1">{d}</div>)}
            {calDays.map((date, i) => {
              const isCurrentMonth = date.getMonth() === calMonth.getMonth();
              const isToday = fmtDate(date) === fmtDate(new Date());
              const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
              const daySlots = slotsForDate(date);
              const dayBookings = bookingsForDate(date);
              const hasOpenSlots = daySlots.some(s => !isSlotBooked(fmtDate(date), s.start_time));
              const isSelected = selectedDate === fmtDate(date);
              return (
                <button key={i} disabled={!isCurrentMonth || isPast || !hasOpenSlots} onClick={() => { setSelectedDate(fmtDate(date)); setSelectedSlot(''); }}
                  className={`min-h-[50px] rounded-lg p-1 text-xs transition ${isSelected ? 'ring-2 ring-teal-400 bg-teal-50' : isCurrentMonth && hasOpenSlots ? 'bg-teal-50/50 hover:bg-teal-50' : 'bg-gray-50 text-gray-400'} ${isToday ? 'font-bold' : ''} ${isPast || !hasOpenSlots ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <span className={isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}>{date.getDate()}</span>
                  {dayBookings.length > 0 && <span className="block text-[10px] text-amber-500">{dayBookings.length} booked</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slot selection */}
        {selectedDate && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Available slots for {selectedDate}</h3>
            <div className="grid grid-cols-3 gap-2">
              {slots.filter(s => s.day_of_week === new Date(selectedDate + 'T00:00:00').getDay()).sort((a, b) => a.start_time.localeCompare(b.start_time)).map(s => {
                const booked = isSlotBooked(selectedDate, s.start_time);
                return (
                  <button key={s.id} disabled={booked} onClick={() => setSelectedSlot(`${s.start_time}-${s.end_time}`)}
                    className={`text-xs px-3 py-2 rounded-lg border transition ${selectedSlot === `${s.start_time}-${s.end_time}` ? 'border-teal-500 bg-teal-50 text-teal-700 font-semibold' : booked ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-200 text-gray-600 hover:border-teal-300'}`}>
                    {s.start_time} - {s.end_time}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Booking form */}
        {selectedSlot && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            {!coacheeName && (
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
              </div>
            )}
            {!coacheeEmail && (
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Email (Gmail)</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
              </div>
            )}
            {isEmbedded && (
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Remarks (optional)</label>
                <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder="Any queries or topics you'd like to discuss..." />
              </div>
            )}
            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button onClick={handleBook} disabled={submitting} className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white rounded-xl px-5 py-3 text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {submitting ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
