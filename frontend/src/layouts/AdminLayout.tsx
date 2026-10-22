import React, { useState } from 'react';
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
  FolderOpen,
  Menu,
  X,
  ArrowLeft
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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

  const handleSelect = (id: string) => {
    onSelectTab(id);
    setIsMobileOpen(false);
  };

  const currentTabLabel = menuItems.find(m => m.id === currentTab)?.label || 'Administration';

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex text-[#1E2A38] relative overflow-x-hidden">
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-[#0B192C]/75 backdrop-blur-xs z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop static, Mobile slide-over drawer) */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64 bg-[#0B192C] text-white flex flex-col justify-between shrink-0 border-r border-navy-800 transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0 pointer-events-none md:pointer-events-auto'}
        `}
      >
        <div className="overflow-y-auto">
          {/* Logo & Header */}
          <div className="p-4 md:p-5 border-b border-navy-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded bg-blue-700 flex items-center justify-center font-serif font-bold text-xl text-white shadow-md">
                T
              </div>
              <div>
                <h1 className="font-serif font-bold text-base leading-tight">ThinkSpace</h1>
                <p className="text-xs text-blue-300 font-sans tracking-wide">Administration</p>
              </div>
            </div>
            {/* Close button for mobile drawer */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-navy-800 md:hidden"
              title="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-2 text-[11px] text-gray-400 font-serif italic border-l-2 border-blue-500 mx-4 mt-3">
            SIEM • UWED Academic Evaluation
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-gray-300 hover:bg-navy-800/80 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Area with Switcher & User info */}
        <div className="p-3.5 border-t border-navy-800 bg-navy-950/60 space-y-2.5">
          {/* Fast Return to Mini App */}
          <button
            onClick={() => { setIsMobileOpen(false); onSwitchToMiniApp(); }}
            className="w-full flex items-center justify-center space-x-2 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold transition"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mini App rejimiga qaytish</span>
          </button>

          {/* Fast Role Simulator */}
          <div className="bg-navy-900/80 p-2 rounded border border-navy-700 text-xs">
            <div className="flex items-center justify-between text-gray-400 mb-1 font-sans">
              <span className="flex items-center space-x-1 text-[11px]">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Simulate Role:</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
              {(['super_admin', 'moderator', 'evaluator', 'member'] as RoleName[]).map((r) => (
                <button
                  key={r}
                  onClick={() => loginAs(r)}
                  className={`px-1 py-1 rounded text-center truncate ${
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
              onClick={logout}
              title="Logout"
              className="p-1.5 text-gray-400 hover:text-red-400 rounded transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">
        {/* Top Navbar */}
        <header className="h-14 md:h-16 bg-white border-b border-gray-200 px-3.5 md:px-8 flex items-center justify-between shrink-0 shadow-xs z-10">
          <div className="flex items-center space-x-2.5 truncate mr-2">
            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 -ml-1 text-gray-700 hover:bg-gray-100 rounded-lg md:hidden shrink-0 transition"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-navy-950" />
            </button>

            <div>
              <h2 className="text-sm md:text-lg font-serif font-bold text-navy-950 truncate capitalize">
                {currentTabLabel}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Quick Switch to Mini App button in Header */}
            <button
              onClick={onSwitchToMiniApp}
              title="Return to Member Mini App"
              className="flex items-center space-x-1 text-xs bg-navy-900 hover:bg-navy-800 text-white font-medium px-2.5 py-1.5 rounded-lg shadow-xs transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mini App</span>
            </button>

            {/* Language Switch */}
            <button
              onClick={() => setLanguage(language === 'uz' ? 'en' : 'uz')}
              className="flex items-center space-x-1 text-xs bg-gray-100 hover:bg-gray-200 text-navy-900 px-2 py-1.5 rounded border border-gray-300 font-medium transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span className="uppercase text-[11px] font-bold">{language}</span>
            </button>

            {/* Logout button (Desktop) */}
            <button
              onClick={logout}
              title="Logout"
              className="hidden md:inline-flex p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
