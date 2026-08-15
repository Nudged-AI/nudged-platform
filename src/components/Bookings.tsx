import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Copy, Plus, Trash2, Loader2, X, Search, Tag, ChevronLeft, ChevronRight, Pencil, Eye, Ban } from 'lucide-react';
import { supabase } from '../supabase';

interface Coach { id: string; coach_name: string; }
interface AvailabilitySlot { id: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean; }
interface Booking {
  id: string;
  coachee_name: string | null;
  coachee_email: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  capsule_id: string | null;
  session_id: string | null;
  is_standalone: boolean;
  remarks: string | null;
  session_topic?: string | null;
  session_number?: number | null;
}
interface Capsule { id: string; name: string; }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export default function Bookings({ coach, coachEmail, onEditSession }: { coach: Coach; coachEmail: string; onEditSession?: (sessionId: string | null, bookingId?: string) => void }) {
  const [tab, setTab] = useState<'availability' | 'bookings' | 'sessionlist'>('sessionlist');
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSlotDay, setNewSlotDay] = useState(1);
  const [newSlotStart, setNewSlotStart] = useState('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState('17:00');
  const [copyFromDay, setCopyFromDay] = useState(1);
  const [copyToDays, setCopyToDays] = useState<number[]>([]);
  const [calMonth, setCalMonth] = useState(new Date());
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'capsule' | 'standalone' | 'scheduled'>('all');
  const [taggingBooking, setTaggingBooking] = useState<Booking | null>(null);
  const [tagCapsuleId, setTagCapsuleId] = useState('');
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [slotsRes, bookingsRes, capsRes, sessionsRes] = await Promise.all([
      supabase.from('coach_availability').select('*').eq('coach_id', coach.id).order('day_of_week'),
      supabase.from('coach_bookings').select('*').eq('coach_id', coach.id).order('booking_date', { ascending: false }),
      supabase.from('capsules').select('id,name').eq('coach_id', coach.id).order('name'),
      supabase.from('coaching_sessions').select('id,topic,session_number,session_date,session_from_dt,session_to_dt,capsule_id,status').eq('coach_id', coach.id).order('session_date', { ascending: false }),
    ]);
    setSlots((slotsRes.data as any[]) ?? []);
    setCapsules((capsRes.data as any[]) ?? []);
    const capMap: Record<string, string> = {};
    (capsRes.data as any[])?.forEach(c => capMap[c.id] = c.name);

    // Build unified list from coach_bookings + coaching_sessions (merge by session_id)
    const bookingList: Booking[] = [];
    const bookedSessionIds = new Set<string>();
    for (const b of (bookingsRes.data as any[]) ?? []) {
      bookingList.push({
        id: b.id, coachee_name: b.coachee_name, coachee_email: b.coachee_email,
        booking_date: b.booking_date, start_time: b.start_time, end_time: b.end_time,
        status: b.status, capsule_id: b.capsule_id, session_id: b.session_id,
        is_standalone: b.is_standalone, remarks: b.remarks,
      });
      if (b.session_id) bookedSessionIds.add(b.session_id);
    }
    // Add coaching_sessions that don't have a booking entry yet
    for (const s of (sessionsRes.data as any[]) ?? []) {
      if (bookedSessionIds.has(s.id)) {
        // Enrich existing booking with session info
        const ex = bookingList.find(b => b.session_id === s.id);
        if (ex) { ex.session_topic = s.topic; ex.session_number = s.session_number; }
        continue;
      }
      const dt = s.session_from_dt ? new Date(s.session_from_dt) : null;
      const dtTo = s.session_to_dt ? new Date(s.session_to_dt) : null;
      bookingList.push({
        id: `sess-${s.id}`, coachee_name: null, coachee_email: null,
        booking_date: s.session_date ?? (dt ? fmtDate(dt) : ''),
        start_time: dt ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '',
        end_time: dtTo ? `${String(dtTo.getHours()).padStart(2, '0')}:${String(dtTo.getMinutes()).padStart(2, '0')}` : '',
        status: s.status || 'Draft', capsule_id: s.capsule_id, session_id: s.id,
        is_standalone: false, remarks: null,
        session_topic: s.topic, session_number: s.session_number,
      });
    }
    // Sort by date desc
    bookingList.sort((a, b) => (b.booking_date || '').localeCompare(a.booking_date || ''));
    setBookings(bookingList);
    setLoading(false);
  }, [coach.id]);

  useEffect(() => { load(); }, [load]);

  const addSlot = async () => {
    await supabase.from('coach_availability').insert({ coach_id: coach.id, day_of_week: newSlotDay, start_time: newSlotStart, end_time: newSlotEnd, is_active: true });
    load();
  };

  const deleteSlot = async (id: string) => {
    await supabase.from('coach_availability').delete().eq('id', id);
    load();
  };

  const copySlots = async () => {
    const sourceSlots = slots.filter(s => s.day_of_week === copyFromDay);
    for (const targetDay of copyToDays) {
      for (const s of sourceSlots) {
        await supabase.from('coach_availability').insert({ coach_id: coach.id, day_of_week: targetDay, start_time: s.start_time, end_time: s.end_time, is_active: true });
      }
    }
    setCopyToDays([]);
    load();
  };

  const copyCalUrl = () => {
    const slug = (coach.coach_name || 'coach').toLowerCase().replace(/[^a-z0-9]/g, '');
    const url = `${window.location.origin}/#calendar/${slug}${coach.id.slice(0, 8)}`;
    navigator.clipboard.writeText(url).then(() => alert('Public calendar URL copied: ' + url)).catch(() => alert('Public calendar URL: ' + url));
  };

  const cancelBooking = async (b: Booking) => {
    if (!confirm('Cancel this session? This will mark it as cancelled.')) return;
    if (b.session_id && !b.id.startsWith('sess-')) {
      await supabase.from('coach_bookings').update({ status: 'cancelled' }).eq('id', b.id);
      await supabase.from('coaching_sessions').update({ status: 'Cancelled' }).eq('id', b.session_id);
    } else if (b.session_id) {
      await supabase.from('coaching_sessions').update({ status: 'Cancelled' }).eq('id', b.session_id);
    } else {
      await supabase.from('coach_bookings').update({ status: 'cancelled' }).eq('id', b.id);
    }
    load();
  };

  const deleteBooking = async (b: Booking) => {
    if (!confirm('Delete this session permanently?')) return;
    if (b.session_id && !b.id.startsWith('sess-')) {
      await supabase.from('coach_bookings').delete().eq('id', b.id);
    } else if (b.session_id) {
      await supabase.from('coaching_sessions').delete().eq('id', b.session_id);
    } else {
      await supabase.from('coach_bookings').delete().eq('id', b.id);
    }
    load();
  };

  const tagToCapsule = async () => {
    if (!taggingBooking || !tagCapsuleId) return;
    await supabase.from('coach_bookings').update({ capsule_id: tagCapsuleId, is_standalone: false }).eq('id', taggingBooking.id);
    setTaggingBooking(null);
    setTagCapsuleId('');
    load();
  };

  const calDays: Date[] = [];
  const firstDay = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
  const startOffset = firstDay.getDay();
  for (let i = -startOffset; i < 42 - startOffset; i++) {
    calDays.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), i + 1));
  }

  const bookingsForDate = (date: Date) => bookings.filter(b => b.booking_date === fmtDate(date) && b.status !== 'cancelled');
  const slotsForDay = (dow: number) => slots.filter(s => s.day_of_week === dow && s.is_active);

  const filteredBookings = bookings.filter(b => {
    if (b.status === 'cancelled') return false;
    if (sessionFilter === 'capsule' && b.is_standalone) return false;
    if (sessionFilter === 'standalone' && !b.is_standalone) return false;
    if (sessionFilter === 'scheduled' && b.status !== 'confirmed' && b.status !== 'Scheduled') return false;
    if (sessionSearch) {
      const q = sessionSearch.toLowerCase();
      return (b.coachee_name?.toLowerCase().includes(q) || b.coachee_email?.toLowerCase().includes(q) || b.booking_date.includes(q) || b.session_topic?.toLowerCase().includes(q));
    }
    return true;
  });

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Bookings</h2>
      <div className="flex gap-2">
        <button onClick={() => setTab('availability')} className={`text-xs px-3 py-2 rounded-lg ${tab === 'availability' ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>Availability Calendar</button>
        <button onClick={() => setTab('bookings')} className={`text-xs px-3 py-2 rounded-lg ${tab === 'bookings' ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>Calendar View</button>
        <button onClick={() => setTab('sessionlist')} className={`text-xs px-3 py-2 rounded-lg ${tab === 'sessionlist' ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>Session List</button>
      </div>

      {/* AVAILABILITY */}
      {tab === 'availability' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">Your Availability</h3>
              <button onClick={copyCalUrl} className="flex items-center gap-1 text-xs text-sky-600 hover:underline"><Copy className="w-3 h-3" /> Copy public calendar URL</button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <select value={newSlotDay} onChange={e => setNewSlotDay(Number(e.target.value))} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <input type="time" value={newSlotStart} onChange={e => setNewSlotStart(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
              <span className="text-xs text-gray-400">to</span>
              <input type="time" value={newSlotEnd} onChange={e => setNewSlotEnd(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
              <button onClick={addSlot} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg"><Plus className="w-3 h-3" /> Add</button>
            </div>

            <div className="flex items-center gap-2 mb-4 bg-sky-50 rounded-lg p-2">
              <span className="text-xs font-semibold text-sky-700">Copy from:</span>
              <select value={copyFromDay} onChange={e => setCopyFromDay(Number(e.target.value))} className="text-xs border border-sky-200 rounded-lg px-2 py-1 bg-white">
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <span className="text-xs text-sky-700">to:</span>
              {DAYS.map((d, i) => (
                <label key={i} className="flex items-center gap-0.5 text-xs text-sky-700">
                  <input type="checkbox" checked={copyToDays.includes(i)} onChange={e => setCopyToDays(prev => e.target.checked ? [...prev, i] : prev.filter(x => x !== i))} /> {d}
                </label>
              ))}
              <button onClick={copySlots} disabled={copyToDays.length === 0} className="text-xs text-white bg-sky-600 hover:bg-sky-700 px-2 py-1 rounded-lg disabled:opacity-50">Copy</button>
            </div>

            <div className="space-y-1">
              {DAYS.map((d, dow) => {
                const daySlots = slotsForDay(dow);
                if (daySlots.length === 0) return null;
                return (
                  <div key={dow} className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-gray-700 w-10">{d}</span>
                    {daySlots.map(s => (
                      <span key={s.id} className="flex items-center gap-1 bg-teal-50 text-teal-700 px-2 py-1 rounded-full">
                        {s.start_time} - {s.end_time}
                        <button onClick={() => deleteSlot(s.id)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                );
              })}
              {slots.length === 0 && <p className="text-xs text-gray-400 py-2">No availability set. Add your first slot above.</p>}
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR VIEW */}
      {tab === 'bookings' && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">Calendar Overview</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="p-1 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-xs font-semibold text-gray-700">{calMonth.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="p-1 rounded-lg hover:bg-gray-100"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS.map(d => <div key={d} className="text-xs font-bold text-gray-500 py-1">{d}</div>)}
            {calDays.map((date, i) => {
              const isCurrentMonth = date.getMonth() === calMonth.getMonth();
              const isToday = fmtDate(date) === fmtDate(new Date());
              const dayBookings = bookingsForDate(date);
              const hasAvailability = slotsForDay(date.getDay()).length > 0;
              return (
                <div key={i} className={`min-h-[60px] rounded-lg p-1 text-xs ${isCurrentMonth ? 'bg-gray-50' : 'bg-gray-100/50'} ${isToday ? 'ring-1 ring-teal-400' : ''}`}>
                  <span className={`font-semibold ${isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}`}>{date.getDate()}</span>
                  {hasAvailability && isCurrentMonth && <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mx-auto mt-0.5" />}
                  {dayBookings.map(b => (
                    <div key={b.id} className={`mt-0.5 text-[10px] px-1 py-0.5 rounded truncate ${b.is_standalone ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'}`}>
                      {b.start_time} {b.coachee_name || b.session_topic?.slice(0, 10) || 'Coach'}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SESSION LIST */}
      {tab === 'sessionlist' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={sessionSearch} onChange={e => setSessionSearch(e.target.value)} placeholder="Search by name, email, date, or topic..." className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg" />
            </div>
            <select value={sessionFilter} onChange={e => setSessionFilter(e.target.value as any)} className="text-xs border border-gray-200 rounded-lg px-3 py-2">
              <option value="all">All sessions</option>
              <option value="scheduled">Scheduled only</option>
              <option value="capsule">Capsule sessions</option>
              <option value="standalone">Standalone sessions</option>
            </select>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-50 border border-teal-200" /> Capsule session</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200" /> Standalone session</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-50 border border-sky-200" /> Scheduled</span>
          </div>

          {filteredBookings.length === 0 ? <p className="text-xs text-gray-400 text-center py-8">No sessions found.</p> : (
            <div className="space-y-2">
              {filteredBookings.map(b => {
                const capsule = capsules.find(c => c.id === b.capsule_id);
                const isScheduled = b.status === 'confirmed' || b.status === 'Scheduled';
                return (
                  <div key={b.id} className={`bg-white rounded-xl border p-3 flex items-center gap-3 ${b.is_standalone ? 'border-amber-200' : 'border-teal-200'}`}>
                    <Calendar className={`w-5 h-5 flex-shrink-0 ${b.is_standalone ? 'text-amber-500' : isScheduled ? 'text-sky-500' : 'text-teal-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {b.booking_date} · {b.start_time}{b.end_time ? ` - ${b.end_time}` : ''}
                        {b.session_number && <span className="text-xs text-gray-400 ml-1">S{b.session_number}</span>}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {b.session_topic ? `${b.session_topic} · ` : ''}{b.coachee_name || '—'} · {b.coachee_email || '—'}
                      </p>
                      {capsule && <p className="text-xs text-teal-600 font-medium">{capsule.name}</p>}
                      {b.is_standalone && !capsule && <p className="text-xs text-amber-600 font-medium">Standalone (no capsule)</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isScheduled && <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">Scheduled</span>}
                      {b.status === 'completed' && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Completed</span>}
                      {b.status === 'Draft' && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500">Draft</span>}
                      <button onClick={() => setViewingBooking(b)} className="p-1.5 rounded-lg hover:bg-gray-100" title="View details"><Eye className="w-3.5 h-3.5 text-teal-600" /></button>
                      {onEditSession && (b.session_id || b.capsule_id) && (
                        <button onClick={() => onEditSession(b.session_id ?? null, b.id.startsWith('sess-') ? undefined : b.id)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Edit session"><Pencil className="w-3.5 h-3.5 text-teal-600" /></button>
                      )}
                      {b.is_standalone && (
                        <button onClick={() => { setTaggingBooking(b); setTagCapsuleId(''); }} className="p-1.5 rounded-lg hover:bg-gray-100" title="Tag to capsule"><Tag className="w-3.5 h-3.5 text-teal-600" /></button>
                      )}
                      <button onClick={() => cancelBooking(b)} className="p-1.5 rounded-lg hover:bg-amber-50" title="Cancel session"><Ban className="w-3.5 h-3.5 text-amber-500" /></button>
                      <button onClick={() => deleteBooking(b)} className="p-1.5 rounded-lg hover:bg-red-50" title="Delete permanently"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* View details modal */}
          {viewingBooking && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setViewingBooking(null)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
                <h3 className="text-sm font-bold text-gray-800 mb-3">Session Details</h3>
                <div className="space-y-2 text-xs">
                  <div><span className="text-gray-500">Date:</span> <span className="font-semibold text-gray-800">{viewingBooking.booking_date}</span></div>
                  <div><span className="text-gray-500">Time:</span> <span className="font-semibold text-gray-800">{viewingBooking.start_time}{viewingBooking.end_time ? ` - ${viewingBooking.end_time}` : ''}</span></div>
                  {viewingBooking.session_topic && <div><span className="text-gray-500">Topic:</span> <span className="font-semibold text-gray-800">{viewingBooking.session_topic}</span></div>}
                  {viewingBooking.session_number && <div><span className="text-gray-500">Session #:</span> <span className="font-semibold text-gray-800">{viewingBooking.session_number}</span></div>}
                  <div><span className="text-gray-500">Coachee:</span> <span className="font-semibold text-gray-800">{viewingBooking.coachee_name || '—'}</span></div>
                  <div><span className="text-gray-500">Email:</span> <span className="font-semibold text-gray-800">{viewingBooking.coachee_email || '—'}</span></div>
                  {viewingBooking.capsule_id && <div><span className="text-gray-500">Capsule:</span> <span className="font-semibold text-gray-800">{capsules.find(c => c.id === viewingBooking.capsule_id)?.name || '—'}</span></div>}
                  <div><span className="text-gray-500">Status:</span> <span className="font-semibold text-gray-800">{viewingBooking.status}</span></div>
                  {viewingBooking.remarks && <div><span className="text-gray-500">Remarks:</span> <span className="text-gray-700">{viewingBooking.remarks}</span></div>}
                </div>
                <div className="flex justify-end mt-4">
                  <button onClick={() => setViewingBooking(null)} className="text-xs text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100">Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Tag to capsule modal */}
          {taggingBooking && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setTaggingBooking(null)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
                <h3 className="text-sm font-bold text-gray-800 mb-3">Tag Session to Capsule</h3>
                <p className="text-xs text-gray-500 mb-3">Select a capsule to link this standalone session.</p>
                <select value={tagCapsuleId} onChange={e => setTagCapsuleId(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3">
                  <option value="">Select capsule...</option>
                  {capsules.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setTaggingBooking(null)} className="text-xs text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100">Cancel</button>
                  <button onClick={tagToCapsule} disabled={!tagCapsuleId} className="text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg disabled:opacity-50">Tag Session</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
