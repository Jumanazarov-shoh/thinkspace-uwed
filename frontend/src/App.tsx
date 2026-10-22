import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useTranslation } from './locales';
import { MiniAppLayout } from './layouts/MiniAppLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Mini App Pages
import { HomePage } from './pages/miniapp/HomePage';
import { TasksPage } from './pages/miniapp/TasksPage';
import { TaskDetailPage } from './pages/miniapp/TaskDetailPage';
import { MySubmissionsPage } from './pages/miniapp/MySubmissionsPage';
import { LeaderboardPage } from './pages/miniapp/LeaderboardPage';
import { ProgressPage } from './pages/miniapp/ProgressPage';
import { ProfilePage } from './pages/miniapp/ProfilePage';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminAssignmentsPage } from './pages/admin/AdminAssignmentsPage';
import { AdminSubmissionsPage } from './pages/admin/AdminSubmissionsPage';
import { AdminReviewWorkspacePage } from './pages/admin/AdminReviewWorkspacePage';
import { AdminModerationPage } from './pages/admin/AdminModerationPage';
import { AdminMembersPage } from './pages/admin/AdminMembersPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';

import { ShieldAlert, ArrowLeft, Sparkles } from 'lucide-react';
import { RoleName } from './types';

export const App: React.FC = () => {
  const { user, loading, authError, clearAuthError, isStaff, loginAs } = useAuth();
  const { t } = useTranslation();

  // Navigation State
  const [viewMode, setViewMode] = useState<'miniapp' | 'admin'>('miniapp');
  const [miniAppTab, setMiniAppTab] = useState<string>('home');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);

  const [adminTab, setAdminTab] = useState<string>('dashboard');
  const [workspaceSubmissionId, setWorkspaceSubmissionId] = useState<number | undefined>(undefined);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B192C] flex flex-col items-center justify-center text-white p-4">
        <div className="w-12 h-12 rounded-xl bg-blue-700 flex items-center justify-center font-serif font-bold text-2xl shadow-xl animate-pulse">
          T
        </div>
        <h1 className="mt-4 font-serif font-bold text-lg tracking-wide">ThinkSpace | UWED</h1>
        <p className="text-xs text-blue-300 mt-1">Connecting intellectual academic platform...</p>
      </div>
    );
  }

  // Authentication Error Screen
  if (authError) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="font-serif font-bold text-lg text-navy-950 mb-1">
          Autentifikatsiya xatosi (Authentication Error)
        </h2>
        <p className="text-xs text-gray-600 mb-5 leading-relaxed">
          {authError}
        </p>
        <button
          onClick={() => { localStorage.clear(); clearAuthError(); window.location.reload(); }}
          className="px-5 py-2.5 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
        >
          Qayta urinish (Retry)
        </button>
      </div>
    );
  }

  // Handle Mini App Navigation
  const handleSelectAssignment = (id: number) => {
    setSelectedAssignmentId(id);
    setMiniAppTab('task_detail');
  };

  const handleBackToTasks = () => {
    setSelectedAssignmentId(null);
    setMiniAppTab('tasks');
  };

  // Handle Admin Navigation from Dashboard
  const handleAdminNavigate = (tab: string, subId?: number) => {
    if (subId) {
      setWorkspaceSubmissionId(subId);
    }
    setAdminTab(tab);
  };

  // --- ADMIN VIEW ---
  if (viewMode === 'admin') {
    // Role check guard: If not staff, show access warning with role switcher for dev testing
    if (!isStaff) {
      return (
        <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-gray-200 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="font-serif font-bold text-lg text-navy-950">
              Staff Authorization Required
            </h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              The Web Admin Panel is restricted to ThinkSpace Evaluators, Moderators, and Super Administrators.
            </p>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-left space-y-2">
              <span className="font-medium text-gray-700 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Developer Mode: Simulate Staff Role</span>
              </span>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                {(['super_admin', 'moderator', 'evaluator'] as RoleName[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => loginAs(r)}
                    className="px-2 py-1.5 bg-navy-900 text-white rounded hover:bg-navy-800 transition capitalize"
                  >
                    Log in as {r.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setViewMode('miniapp')}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-gray-100 hover:bg-gray-200 text-navy-900 rounded-lg text-xs font-semibold transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Mini App</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <AdminLayout
        currentTab={adminTab}
        onSelectTab={setAdminTab}
        onSwitchToMiniApp={() => setViewMode('miniapp')}
      >
        {adminTab === 'dashboard' && (
          <AdminDashboardPage onNavigateTab={handleAdminNavigate} />
        )}
        {adminTab === 'assignments' && (
          <AdminAssignmentsPage />
        )}
        {adminTab === 'submissions' && (
          <AdminSubmissionsPage />
        )}
        {adminTab === 'workspace' && (
          <AdminReviewWorkspacePage initialSubmissionId={workspaceSubmissionId} />
        )}
        {adminTab === 'moderation' && (
          <AdminModerationPage />
        )}
        {adminTab === 'members' && (
          <AdminMembersPage />
        )}
        {adminTab === 'analytics' && (
          <AdminAnalyticsPage />
        )}
      </AdminLayout>
    );
  }

  // --- TELEGRAM MINI APP VIEW ---
  return (
    <MiniAppLayout
      currentTab={miniAppTab}
      onSelectTab={(tab) => {
        setSelectedAssignmentId(null);
        setMiniAppTab(tab);
      }}
      onOpenAdmin={() => setViewMode('admin')}
      onSelectAssignment={handleSelectAssignment}
    >
      {miniAppTab === 'home' && (
        <HomePage
          onNavigateToTasks={() => setMiniAppTab('tasks')}
          onSelectAssignment={handleSelectAssignment}
        />
      )}

      {miniAppTab === 'tasks' && (
        <TasksPage 
          onSelectAssignment={handleSelectAssignment} 
          onViewMySubmissions={() => setMiniAppTab('my_submissions')}
        />
      )}

      {miniAppTab === 'my_submissions' && (
        <MySubmissionsPage
          onBack={handleBackToTasks}
          onSelectAssignment={handleSelectAssignment}
        />
      )}

      {miniAppTab === 'task_detail' && selectedAssignmentId && (
        <TaskDetailPage
          assignmentId={selectedAssignmentId}
          onBack={handleBackToTasks}
          onViewMySubmissions={() => setMiniAppTab('my_submissions')}
        />
      )}

      {miniAppTab === 'leaderboard' && (
        <LeaderboardPage />
      )}

      {miniAppTab === 'progress' && (
        <ProgressPage />
      )}

      {miniAppTab === 'profile' && (
        <ProfilePage />
      )}
    </MiniAppLayout>
  );
};
