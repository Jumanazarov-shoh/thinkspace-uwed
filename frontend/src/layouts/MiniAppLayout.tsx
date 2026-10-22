import React, { useState, useEffect } from 'react';
import { useTranslation } from '../locales';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { NotificationCenterModal } from '../components/NotificationCenterModal';
import { 
  Home, 
  BookOpen, 
  Trophy, 
  TrendingUp, 
  User as UserIcon, 
  ShieldCheck, 
  Globe,
  Bell
} from 'lucide-react';

interface MiniAppLayoutProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAdmin?: () => void;
  onSelectAssignment?: (id: number) => void;
  children: React.ReactNode;
}

export const MiniAppLayout: React.FC<MiniAppLayoutProps> = ({
  currentTab,
  onSelectTab,
  onOpenAdmin,
  onSelectAssignment,
  children
}) => {
  const { t, language, setLanguage } = useTranslation();
  const { user, isStaff, loginAs } = useAuth();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = async () => {
    try {
      const data = await api.getNotifications(false, 1);
      setUnreadCount(data.unread_count);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 30000); // 30s poll
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'tasks', label: t.nav.tasks, icon: BookOpen },
    { id: 'leaderboard', label: t.nav.leaderboard, icon: Trophy },
    { id: 'progress', label: t.nav.progress, icon: TrendingUp },
    { id: 'profile', label: t.nav.profile, icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0B192C] flex flex-col justify-between max-w-md mx-auto shadow-2xl relative border-x border-gray-200">
      {/* Top Academic Header */}
      <header className="sticky top-0 z-30 bg-[#0B192C] text-white px-4 py-3 shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center font-serif font-bold text-lg text-white border border-blue-400/30">
            T
          </div>
          <div>
            <h1 className="font-serif font-semibold text-sm tracking-wide leading-tight">
              ThinkSpace | UWED
            </h1>
            <p className="text-[10px] text-gray-300 font-sans tracking-tight">
              SIEM • JIDU Intellektual Klubi
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Notification Bell */}
          <button
            onClick={() => setIsNotificationOpen(true)}
            title="Xabarnomalar"
            className="relative p-1.5 rounded-lg bg-navy-800/80 hover:bg-navy-700 text-gray-200 hover:text-white border border-gray-600/50 transition"
          >
            <Bell className="w-4 h-4 text-gray-200" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse border border-navy-950">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'uz' ? 'en' : 'uz')}
            className="flex items-center space-x-1 text-xs bg-navy-800/80 hover:bg-navy-700 px-2 py-1 rounded border border-gray-600/50 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold uppercase">{language}</span>
          </button>

          {/* Switch to Admin if Staff */}
          {isStaff && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              title="Admin Panel"
              className="flex items-center space-x-1 text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium px-2 py-1 rounded shadow-sm transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 px-3.5 pt-3">
        {children}
      </main>

      {/* Bottom Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-200 py-1.5 px-3 z-40 flex justify-around items-center shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center py-1 px-2.5 rounded-lg transition-all ${
                isActive
                  ? 'text-navy-900 font-semibold scale-105'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-700 stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-700" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Notification Center Modal */}
      <NotificationCenterModal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onNavigateToAssignment={onSelectAssignment}
        onNotificationsUpdated={refreshUnreadCount}
      />
    </div>
  );
};
