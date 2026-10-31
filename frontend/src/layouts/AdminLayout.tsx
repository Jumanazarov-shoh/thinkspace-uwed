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
    <div className="min-h-screen bg-[#F8F9FA] flex text-[#0F172A] relative overflow-x-hidden">
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-[#0B192C]/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop static, Mobile slide-over drawer) */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64 bg-[#0B192C] text-white flex flex-col justify-between shrink-0 border-r border-white/10 transition-transform duration-200 ease-out
          ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0 pointer-events-none md:pointer-events-auto'}
        `}
      >
        <div className="overflow-y-auto">
          {/* Logo & Header */}
          <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-md bg-navy-800 border border-white/15 flex items-center justify-center font-serif font-semibold text-base text-white shadow-xs relative">
                <span>T</span>
                <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
              </div>
              <div>
                <h1 className="font-serif font-semibold text-sm tracking-tight leading-tight text-slate-100">
                  ThinkSpace
                </h1>
                <p className="text-[11px] text-slate-400 font-sans tracking-tight">
                  Academic Administration
                </p>
              </div>
            </div>
            {/* Close button for mobile drawer */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 md:hidden transition-colors"
              title="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-2 mx-4 mt-3 text-[11px] text-slate-400 border-l border-blue-500/60 font-sans">
            UWED • SIEM Evaluation Hub
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
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 stroke-[1.75] ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Area with Switcher & User info */}
        <div className="p-3.5 border-t border-white/10 bg-navy-950/40 space-y-2.5">
          {/* Fast Return to Mini App */}
          <button
            onClick={() => { setIsMobileOpen(false); onSwitchToMiniApp(); }}
            className="w-full flex items-center justify-center space-x-2 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-md text-xs font-medium transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5 text-slate-400 stroke-[1.75]" />
            <span>Mini App rejimiga qaytish</span>
          </button>

          {/* Role Switcher */}
          <div className="bg-white/5 p-2 rounded-md border border-white/10 text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1.5 font-sans">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Rol simulyatori:</span>
            </div>
            <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
              {(['super_admin', 'moderator', 'evaluator', 'member'] as RoleName[]).map((r) => (
                <button
                  key={r}
                  onClick={() => loginAs(r)}
                  className={`px-1.5 py-1 rounded text-center truncate transition-colors ${
                    user?.roles.some(ur => ur.role_name === r)
                      ? 'bg-blue-600 text-white font-medium shadow-xs'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
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
              <p className="text-xs font-medium text-slate-200 truncate">{user?.display_name || 'Staff'}</p>
              <p className="text-[10px] text-slate-400 truncate">
                {user?.roles.map(r => roleBadges[r.role_name] || r.role_name).join(', ') || 'Staff'}
              </p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded transition-colors"
            >
              <LogOut className="w-4 h-4 stroke-[1.75]" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">
        {/* Top Navbar */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0 shadow-xs z-10">
          <div className="flex items-center space-x-2.5 truncate mr-2">
            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 -ml-1 text-slate-700 hover:bg-slate-100 rounded-md md:hidden shrink-0 transition-colors"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-navy-950 stroke-[1.75]" />
            </button>

            <div>
              <h2 className="text-sm md:text-base font-serif font-semibold text-navy-950 truncate capitalize">
                {currentTabLabel}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Quick Switch to Mini App button in Header */}
            <button
              onClick={onSwitchToMiniApp}
              title="Return to Member Mini App"
              className="flex items-center space-x-1.5 text-xs bg-navy-900 hover:bg-navy-800 text-white font-medium px-3 py-1.5 rounded-md shadow-xs transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[1.75]" />
              <span className="hidden sm:inline">Mini App</span>
            </button>

            {/* Language Switch */}
            <button
              onClick={() => setLanguage(language === 'uz' ? 'en' : 'uz')}
              className="flex items-center space-x-1 text-xs bg-slate-100 hover:bg-slate-200 text-navy-900 px-2.5 py-1.5 rounded-md border border-slate-200 font-mono transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-blue-700 stroke-[1.75]" />
              <span className="uppercase text-[11px] font-semibold">{language}</span>
            </button>

            {/* Logout button (Desktop) */}
            <button
              onClick={logout}
              title="Logout"
              className="hidden md:inline-flex p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4 stroke-[1.75]" />
            </button>
          </div>
        </header>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
