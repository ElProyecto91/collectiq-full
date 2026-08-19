import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Heart, UserPlus, Trophy, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data: Record<string, any>;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'new_follower': return <UserPlus size={16} className="text-blue-400" />;
    case 'deck_vote': return <Heart size={16} className="text-pink-400" />;
    case 'achievement': return <Trophy size={16} className="text-yellow-400" />;
    case 'price_alert': return <Star size={16} className="text-green-400" />;
    default: return <Bell size={16} className="text-gray-400" />;
  }
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return mins + 'm';
  if (hours < 24) return hours + 'h';
  return days + 'd';
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadNotifications();
  }, [telegramUser?.id]);

  const loadNotifications = async () => {
    if (!telegramUser?.id) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('telegram_user_id', telegramUser.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications(data ?? []);
      // Marcar todas como leídas
      await supabase.from('user_notifications')
        .update({ read: true })
        .eq('telegram_user_id', telegramUser.id)
        .eq('read', false);
    } finally {
      setIsLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-lg font-bold">Notificaciones</h1>
        </div>
        {unreadCount > 0 && (
          <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {unreadCount}
          </span>
        )}
      </div>

      <div className="px-4 space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500 text-sm">Cargando...</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <Bell size={28} className="text-gray-600" />
            </div>
            <div>
              <p className="text-white font-semibold">Sin notificaciones</p>
              <p className="text-sm text-gray-500 mt-1">Aqui apareceran tus notificaciones cuando alguien vote tu mazo, te siga o desbloquees un logro.</p>
            </div>
          </div>
        ) : (
          notifications.map(notif => (
            <div key={notif.id}
              className={'flex items-start gap-3 rounded-2xl p-4 border transition-all ' + (
                notif.read ? 'bg-[#111118] border-white/8' : 'bg-blue-500/5 border-blue-500/20'
              )}>
              <div className={'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ' + (
                notif.read ? 'bg-white/5' : 'bg-blue-500/10'
              )}>
                {getNotificationIcon(notif.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{notif.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{notif.body}</p>
              </div>
              <p className="text-[10px] text-gray-600 shrink-0">{timeAgo(notif.created_at)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}