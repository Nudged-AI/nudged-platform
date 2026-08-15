import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, Check, Clock } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';

interface Notif {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  parked_item_id: string | null;
}

interface Props { user: User; }

export default function NotificationBell({ user }: Props) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const unread = notifs.filter(n => !n.is_read).length;

  const loadNotifs = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setNotifs((data as Notif[]) ?? []);
  }, [user.id]);

  const checkSchedules = useCallback(async () => {
    const now = new Date();
    const { data: schedules } = await supabase
      .from('thought_schedules')
      .select('*, parked_items(content)')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (!schedules?.length) return;

    for (const s of schedules) {
      if (s.end_date && new Date(s.end_date) < now) continue;
      const last = s.last_notified_at ? new Date(s.last_notified_at) : null;
      const [h, m] = (s.time_of_day || '09:00').split(':').map(Number);
      const dueTime = new Date(); dueTime.setHours(h, m, 0, 0);
      if (now < dueTime) continue;

      let isDue = false;
      if (s.frequency === 'daily') {
        isDue = !last || last.toDateString() !== now.toDateString();
      } else if (s.frequency === 'weekly') {
        isDue = now.getDay() === (s.day_of_week ?? 1) && (!last ||
          now.getTime() - last.getTime() > 6 * 24 * 60 * 60 * 1000);
      } else if (s.frequency === 'monthly') {
        isDue = now.getDate() === (s.date_of_month ?? 1) && (!last ||
          last.getMonth() !== now.getMonth() || last.getFullYear() !== now.getFullYear());
      }

      if (isDue) {
        const content = (s.parked_items as any)?.content ?? 'A thought';
        await supabase.from('notifications').insert({
          user_id: user.id,
          parked_item_id: s.parked_item_id,
          message: `Reminder: ${content.slice(0, 100)}`,
        });
        await supabase.from('thought_schedules')
          .update({ last_notified_at: now.toISOString() })
          .eq('id', s.id);
      }
    }
    await loadNotifs();
  }, [user.id, loadNotifs]);

  useEffect(() => {
    loadNotifs();
    checkSchedules();
    const interval = setInterval(checkSchedules, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadNotifs, checkSchedules]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotif = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(p => !p); if (!open) loadNotifs(); }}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-500"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <span className="text-sm font-semibold text-gray-800">Notifications</span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-teal-600 hover:underline">Mark all read</button>
                )}
                <button onClick={() => setOpen(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">No notifications yet</p>
              ) : notifs.map(n => (
                <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition ${n.is_read ? 'opacity-60' : ''}`}>
                  <Clock className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-relaxed">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!n.is_read && <button onClick={() => markRead(n.id)} title="Mark read"><Check className="w-3.5 h-3.5 text-teal-500 hover:text-teal-700" /></button>}
                    <button onClick={() => deleteNotif(n.id)} title="Delete"><X className="w-3.5 h-3.5 text-gray-300 hover:text-red-500" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
