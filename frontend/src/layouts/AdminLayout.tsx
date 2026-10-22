import React from 'react';
import { useTranslation } from '../locales';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  FileCheck2, 
  Layers, 
  SlidersHorizontal, 
  Users, 
  BarChart3, 
  Smartphone, 
  LogOut, 
  Globe,
  Sparkles,
  FolderOpen
} from 'lucide-react';
import { RoleName } from '../types';

interface AdminLayoutProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onSwitchToMiniApp: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  onSelectTab,
  onSwitchToMiniApp,
  children
}) => {
  const { t, language, setLanguage } = useTranslation();
  const { user, loginAs, logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: t.nav.adminDashboard, icon: LayoutDashboard },
    { id: 'assignments', label: t.nav.adminAssignments, icon: Layers },
    { id: 'submissions', label: "Topshirilgan ishlar", icon: FolderOpen },
    { id: 'workspace', label: t.nav.adminWorkspace, icon: FileCheck2 },
    { id: 'moderation', label: t.nav.adminModeration, icon: SlidersHorizontal },
    { id: 'members', label: t.nav.adminMembers, icon: Users },
    { id: 'analytics', label: t.nav.adminAnalytics, icon: BarChart3 },
  ];

  const roleBadges: Record<string, string> = {
    super_admin: 'Super Admin',
    moderator: 'Moderator',
    senior_reviewer: 'Senior Reviewer',
    evaluator: 'Evaluator',
    member: 'Member',
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex text-[#1E2A38]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0B192C] text-white flex flex-col justify-between shrink-0 shadow-xl border-r border-navy-800">
        <div>
          {/* Logo & Header */}
          <div className="p-5 border-b border-navy-800">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded bg-blue-700 flex items-center justify-center font-serif font-bold text-xl text-white shadow-md">
                T
              </div>
              <div>
                <h1 className="font-serif font-bold text-base leading-tight">ThinkSpace</h1>
                <p className="text-xs text-blue-300 font-sans tracking-wide">Administration</p>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-gray-400 font-serif italic border-l-2 border-blue-500 pl-2">
              SIEM • UWED Academic Evaluation
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-gray-300 hover:bg-navy-800/80 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Area with Switcher & User info */}
        <div className="p-4 border-t border-navy-800 bg-navy-950/40 space-y-3">
          {/* Fast Role Simulator */}
          <div className="bg-navy-900/80 p-2.5 rounded border border-navy-700 text-xs">
            <div className="flex items-center justify-between text-gray-400 mb-1.5 font-sans">
              <span className="flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Simulate Role:</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 font-mono text-[11px]">
              {(['super_admin', 'moderator', 'evaluator', 'member'] as RoleName[]).map((r) => (
                <button
                  key={r}
                  onClick={() => loginAs(r)}
                  className={`px-1.5 py-1 rounded text-center truncate ${
                    user?.roles.some(ur => ur.role_name === r)
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-navy-800 text-gray-300 hover:bg-navy-700'
                  }`}
                >
                  {r.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* User info */}
          <div className="flex items-center justify-between pt-1">
            <div className="truncate mr-2">
              <p className="text-xs font-semibold text-white truncate">{user?.display_name || 'Staff'}</p>
              <p className="text-[10px] text-gray-400 truncate">
                {user?.roles.map(r => roleBadges[r.role_name] || r.role_name).join(', ') || 'Staff'}
              </p>
            </div>
            <button
              onClick={onSwitchToMiniApp}
              title="Open Mobile Mini App View"
              className="flex items-center space-x-1 text-xs bg-navy-800 hover:bg-navy-700 text-blue-300 px-2.5 py-1.5 rounded transition-all"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mini App</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between shrink-0 shadow-sm">
          <div>
            <h2 className="text-lg font-serif font-semibold text-navy-900 capitalize">
              {menuItems.find(m => m.id === currentTab)?.label || 'Administration'}
            </h2>
          </div>

          <div className="flex items-center space-x-4">
            {/* Language Switch */}
            <button
              onClick={() => setLanguage(language === 'uz' ? 'en' : 'uz')}
              className="flex items-center space-x-1 text-xs bg-gray-100 hover:bg-gray-200 text-navy-900 px-2.5 py-1.5 rounded border border-gray-300 font-medium transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span className="uppercase">{language}</span>
            </button>

            {/* Logout button */}
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
