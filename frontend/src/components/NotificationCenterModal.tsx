import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  Check, 
  CheckCheck, 
  Clock, 
  BookOpen, 
  Award, 
  Send, 
  AlertTriangle, 
  Sparkles, 
  Settings, 
  ExternalLink,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { NotificationItem, NotificationPreference } from '../types';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToAssignment?: (assignmentId: number) => void;
  onNotificationsUpdated?: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  onNavigateToAssignment,
  onNotificationsUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'prefs'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [savingPrefs, setSavingPrefs] = useState<boolean>(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications(false, 50);
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
      if (onNotificationsUpdated) onNotificationsUpdated();
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const prefs = await api.getNotificationPreferences();
      setPreferences(prefs);
    } catch (e) {
      console.error('Failed to load preferences:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
      loadPreferences();
    }
  }, [isOpen]);

  const handleMarkAsRead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      if (onNotificationsUpdated) onNotificationsUpdated();
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      if (onNotificationsUpdated) onNotificationsUpdated();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleTogglePref = async (key: 'telegram_notifications_enabled' | 'deadline_reminders_enabled') => {
    if (!preferences || savingPrefs) return;
    setSavingPrefs(true);
    const updatedVal = !preferences[key];
    try {
      const updated = await api.updateNotificationPreferences({ [key]: updatedVal });
      setPreferences(updated);
    } catch (err) {
      console.error('Failed to update preference:', err);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.is_read) {
      handleMarkAsRead(item.id);
    }
    if (item.related_entity_type === 'assignment' && item.related_entity_id && onNavigateToAssignment) {
      onClose();
      onNavigateToAssignment(parseInt(item.related_entity_id, 10));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'assignment_published':
        return <BookOpen className="w-4 h-4 text-blue-600" />;
      case 'deadline_reminder':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'submission_received':
        return <Send className="w-4 h-4 text-emerald-600" />;
      case 'submission_late':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'evaluation_finalized':
      case 'feedback_available':
        return <Award className="w-4 h-4 text-gold-500" />;
      case 'system_announcement':
        return <Sparkles className="w-4 h-4 text-purple-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const displayedNotifications = notifications.filter(n => {
    if (activeTab === 'unread') return !n.is_read;
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-navy-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm text-white">
                Xabarnomalar markazi
              </h3>
              <p className="text-[10px] text-gray-300">
                {unreadCount > 0 ? `${unreadCount} ta yangi xabar` : "Yangi xabarlar yo'q"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex items-center justify-between bg-gray-50/80 shrink-0">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                activeTab === 'all'
                  ? 'bg-navy-900 text-white shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-200/60'
              }`}
            >
              Barchasi ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center space-x-1 ${
                activeTab === 'unread'
                  ? 'bg-navy-900 text-white shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-200/60'
              }`}
            >
              <span>O'qilmagan</span>
              {unreadCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('prefs')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center space-x-1 ${
                activeTab === 'prefs'
                  ? 'bg-navy-900 text-white shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-200/60'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Sozlamalar</span>
            </button>
          </div>

          {activeTab !== 'prefs' && unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              title="Barchasini o'qilgan deb belgilash"
              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>O'qildi</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {activeTab === 'prefs' ? (
            /* Preferences Panel */
            <div className="p-2 space-y-4">
              <div className="space-y-1">
                <h4 className="font-serif font-bold text-xs text-navy-900">
                  Xabarnoma sozlamalari (Notification Preferences)
                </h4>
                <p className="text-[11px] text-gray-500">
                  ThinkSpace tizimidagi eslatmalar va muhim xabarlarni qabul qilish kanallarini boshqaring.
                </p>
              </div>

              {preferences ? (
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 flex items-center justify-between">
                    <div className="space-y-0.5 max-w-[80%]">
                      <p className="text-xs font-semibold text-navy-900">
                        Telegram xabarnomalari
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Yangi topshiriqlar, baholar va rasmiy e'lonlar haqida Telegram bot orqali tezkor xabar olish.
                      </p>
                    </div>
                    <button
                      onClick={() => handleTogglePref('telegram_notifications_enabled')}
                      disabled={savingPrefs}
                      className="text-navy-900 p-1"
                    >
                      {preferences.telegram_notifications_enabled ? (
                        <ToggleRight className="w-8 h-8 text-blue-600" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-gray-400" />
                      )}
                    </button>
                  </div>

                  <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 flex items-center justify-between">
                    <div className="space-y-0.5 max-w-[80%]">
                      <p className="text-xs font-semibold text-navy-900">
                        Topshiriq muddati eslatmalari (Deadline Reminders)
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Muddat tugashiga 24 soat va 3 soat qolganda eslatma olish (faqat hali topshirilmagan bo'lsa).
                      </p>
                    </div>
                    <button
                      onClick={() => handleTogglePref('deadline_reminders_enabled')}
                      disabled={savingPrefs}
                      className="text-navy-900 p-1"
                    >
                      {preferences.deadline_reminders_enabled ? (
                        <ToggleRight className="w-8 h-8 text-blue-600" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-gray-400" />
                      )}
                    </button>
                  </div>

                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-blue-900 text-[11px] flex items-start space-x-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      Muhim ma'muriy e'lonlar va tizim xabarlari xavfsizlik va rasmiylik yuzasidan doimo ilova ichida saqlanadi.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-gray-400">
                  Yuklanmoqda...
                </div>
              )}
            </div>
          ) : displayedNotifications.length > 0 ? (
            /* Notifications List */
            displayedNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                  notif.is_read
                    ? 'bg-white border-gray-200/80 hover:border-gray-300'
                    : 'bg-blue-50/40 border-blue-200 shadow-2xs hover:bg-blue-50/70'
                }`}
              >
                {!notif.is_read && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-600" />
                )}

                <div className="flex items-start space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5 border border-gray-200">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="flex-1 space-y-1 pr-3">
                    <h5 className="font-serif font-bold text-xs text-navy-900 leading-snug">
                      {notif.title}
                    </h5>
                    <p className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-line">
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-gray-400">
                      <span>{new Date(notif.created_at).toLocaleString('uz-UZ')}</span>
                      {notif.related_entity_type === 'assignment' && (
                        <span className="text-blue-600 font-medium flex items-center space-x-0.5">
                          <span>Ochish</span>
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            /* Empty State */
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto border border-gray-200">
                <Bell className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-serif font-bold text-sm text-navy-900">
                  {activeTab === 'unread' ? "Barcha xabarlar o'qilgan" : "Hozircha xabarnomalar yo'q"}
                </h4>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Yangi topshiriqlar, yaqinlashayotgan muddatlar va baholash natijalari e'lon qilinganda shu yerda ko'rinadi.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-100 text-center shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
