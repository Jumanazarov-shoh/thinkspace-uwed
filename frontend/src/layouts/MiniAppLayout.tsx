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
  const { user, isStaff } = useAuth();
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
    <div className="min-h-screen bg-[#F8F9FA] text-[#0F172A] flex flex-col justify-between max-w-md mx-auto shadow-[0_4px_24px_rgba(15,23,42,0.06)] relative border-x border-slate-200/80">
      {/* Top Academic Header - Quiet Chrome */}
      <header className="sticky top-0 z-30 bg-[#0B192C] text-white px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-md bg-navy-800 border border-white/15 flex items-center justify-center font-serif font-semibold text-base text-white shadow-xs relative">
            <span>T</span>
            <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
          </div>
          <div>
            <h1 className="font-serif font-semibold text-sm tracking-tight leading-tight text-slate-100">
              ThinkSpace
            </h1>
            <p className="text-[11px] text-slate-400 font-sans tracking-tight">
              SIEM • UWED Intellectual Club
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* Notification Bell */}
          <button
            onClick={() => setIsNotificationOpen(true)}
            title="Xabarnomalar"
            className="relative p-2 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
          >
            <Bell className="w-4 h-4 stroke-[1.75]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-semibold flex items-center justify-center tabular-nums border border-[#0B192C]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'uz' ? 'en' : 'uz')}
            className="flex items-center space-x-1 text-xs bg-white/5 hover:bg-white/10 text-slate-300 px-2 py-1.5 rounded-md border border-white/10 font-mono transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400 stroke-[1.75]" />
            <span className="font-medium uppercase">{language}</span>
          </button>

          {/* Switch to Admin if Staff */}
          {isStaff && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              title="Admin Panel"
              className="flex items-center space-x-1 text-xs bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-medium px-2.5 py-1.5 rounded-md border border-amber-500/30 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>Admin</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 px-4 pt-4">
        {children}
      </main>

      {/* Bottom Navigation - Quiet, Craft-Oriented */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-3 z-40 flex justify-around items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center py-1 px-3 rounded-md transition-colors ${
                isActive
                  ? 'text-navy-950 font-medium'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-700 stroke-[2]' : 'text-slate-400 stroke-[1.75]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-blue-700" />
                )}
              </div>
              <span className={`text-[11px] mt-1 tracking-tight ${isActive ? 'text-navy-950 font-semibold' : 'text-slate-500'}`}>
                {item.label}
              </span>
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
