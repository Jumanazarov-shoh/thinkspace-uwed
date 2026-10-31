import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Assignment, Submission, User, AdminNotificationStatus } from '../../types';
import { 
  Users, 
  Layers, 
  FileCheck2, 
  SlidersHorizontal, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  RefreshCw,
  Bell,
  Send,
  X,
  SendHorizontal
} from 'lucide-react';

interface AdminDashboardPageProps {
  onNavigateTab: (tab: string, subId?: number) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigateTab }) => {
  const { t } = useTranslation();
  const { user, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [notifStatus, setNotifStatus] = useState<AdminNotificationStatus | null>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);
  const [processingReminders, setProcessingReminders] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assList, subList, memList, reqList, notif] = await Promise.all([
        api.getAssignments(),
        api.getSubmissionsList(),
        api.listMembers('approved'),
        api.listMembershipRequests('pending').catch(() => []),
        api.getAdminNotificationStatus().catch(() => null)
      ]);
      setAssignments(assList);
      setSubmissions(subList);
      setMembers(memList);
      setPendingRequestsCount(reqList.length);
      setNotifStatus(notif);
    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProcessReminders = async () => {
    setProcessingReminders(true);
    setActionSuccessMsg(null);
    try {
      const res = await api.processDeadlineReminders();
      setActionSuccessMsg(
        `Eslatmalar tekshirildi: ${res.reminders_sent} ta yangi bildirishnoma yuborildi, ${res.assignments_checked} ta topshiriq ko'rib chiqildi (${res.skipped_duplicates} ta takroriy eslatma chetlab o'tildi).`
      );
      fetchData();
    } catch (err: any) {
      alert(err?.message || 'Eslatmalarni tekshirishda xatolik yuz berdi');
    } finally {
      setProcessingReminders(false);
    }
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementMsg.trim()) return;
    setIsSendingAnnouncement(true);
    setActionSuccessMsg(null);
    try {
      const res = await api.sendAdminAnnouncement({
        title: announcementTitle.trim(),
        message: announcementMsg.trim(),
        send_telegram: true,
      });
      setActionSuccessMsg(`Rasmiy e'lon muvaffaqiyatli ${res.recipients_count} ta a'zoga yuborildi!`);
      setShowAnnouncementModal(false);
      setAnnouncementTitle('');
      setAnnouncementMsg('');
      fetchData();
    } catch (err: any) {
      alert(err?.message || "E'lon yuborishda xatolik yuz berdi");
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  const openAssignmentsCount = assignments.filter(a => a.status === 'open').length;
  const pendingReviewsCount = submissions.filter(s => s.status === 'submitted' || s.status === 'under_review').length;
  const awaitingModerationCount = submissions.filter(s => s.status === 'evaluated').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Welcome - Quiet Craft */}
      <div className="bg-white rounded-lg p-5 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              UWED SIEM Operations
            </span>
            <span className="text-xs text-slate-400 font-sans">• 2026 Academic Year</span>
          </div>
          <h1 className="text-xl md:text-2xl font-serif font-semibold text-slate-900 mt-1.5 tracking-tight">
            ThinkSpace Evaluation Hub
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5 font-sans leading-relaxed">
            Welcome, {user?.display_name || 'Staff'}. Manage academic submissions, rubric evaluations, and grade moderation.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={fetchData}
            title="Refresh Data"
            className="p-2 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 stroke-[1.75] ${loading ? 'animate-spin text-blue-700' : ''}`} />
          </button>
          <button
            onClick={() => onNavigateTab('assignments')}
            className="flex items-center space-x-1.5 bg-navy-900 hover:bg-navy-800 text-white text-xs font-medium px-3.5 py-2 rounded-md shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>{t.admin.createAssignment}</span>
          </button>
        </div>
      </div>

      {/* Action Success Alert */}
      {actionSuccessMsg && (
        <div className="bg-emerald-50/80 border border-emerald-200 text-emerald-900 rounded-lg p-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 stroke-[1.75]" />
            <span className="text-xs font-medium">{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid - Tabular Figures, Muted Accents */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Approved Members */}
        <div 
          onClick={() => onNavigateTab('members')}
          className="bg-white rounded-lg p-4 border border-slate-200/90 shadow-xs hover:border-slate-400/80 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-tight">
              {t.admin.totalMembers}
            </span>
            <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-700">
              <Users className="w-4 h-4 stroke-[1.75]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-serif font-semibold text-slate-900 tabular-nums">{members.length}</span>
            {pendingRequestsCount > 0 && (
              <span className="text-[11px] font-mono font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                +{pendingRequestsCount} pending
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-sans">Verified SIEM students & members</p>
        </div>

        {/* Open Assignments */}
        <div 
          onClick={() => onNavigateTab('assignments')}
          className="bg-white rounded-lg p-4 border border-slate-200/90 shadow-xs hover:border-slate-400/80 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-tight">
              {t.admin.openAssignments}
            </span>
            <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-700">
              <Layers className="w-4 h-4 stroke-[1.75]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-serif font-semibold text-slate-900 tabular-nums">{openAssignmentsCount}</span>
            <span className="text-xs text-slate-400 font-sans tabular-nums">of {assignments.length} total</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-sans">Active tasks accepting work</p>
        </div>

        {/* Pending Reviews */}
        <div 
          onClick={() => onNavigateTab('workspace')}
          className="bg-white rounded-lg p-4 border border-slate-200/90 shadow-xs hover:border-slate-400/80 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-tight">
              {t.admin.pendingReviews}
            </span>
            <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-700">
              <FileCheck2 className="w-4 h-4 stroke-[1.75]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-serif font-semibold text-slate-900 tabular-nums">{pendingReviewsCount}</span>
            <span className="text-xs text-amber-700 font-medium font-sans">Needs review</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-sans">Submissions awaiting rubric evaluation</p>
        </div>

        {/* Awaiting Moderation */}
        <div 
          onClick={() => onNavigateTab('moderation')}
          className="bg-white rounded-lg p-4 border border-slate-200/90 shadow-xs hover:border-slate-400/80 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-tight">
              {t.admin.awaitingModeration}
            </span>
            <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-700">
              <SlidersHorizontal className="w-4 h-4 stroke-[1.75]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-serif font-semibold text-slate-900 tabular-nums">{awaitingModerationCount}</span>
            <span className="text-xs text-blue-700 font-medium font-sans">Ready to publish</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-sans">Evaluated works awaiting final sign-off</p>
        </div>
      </div>

      {/* Main Split: Submissions Queue & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Submissions Queue */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200/90 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm md:text-base font-serif font-semibold text-slate-900">Recent Submission Queue</h2>
              <p className="text-xs text-slate-400 font-sans">Incoming academic works across all 6 directions</p>
            </div>
            <button
              onClick={() => onNavigateTab('workspace')}
              className="text-xs font-medium text-blue-700 hover:text-blue-900 flex items-center space-x-1 transition-colors"
            >
              <span>Open Workspace</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs font-sans">Loading queue...</div>
          ) : submissions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-sans">
              No submissions found yet. Once members submit work via Mini App, they will appear here.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {submissions.slice(0, 7).map((sub) => {
                const ass = assignments.find(a => a.id === sub.assignment_id);
                return (
                  <div key={sub.id} className="py-3 flex items-center justify-between hover:bg-slate-50/70 px-2 rounded-md transition-colors">
                    <div className="space-y-0.5 min-w-0 pr-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-xs text-slate-900 truncate">
                          {sub.user?.display_name || `Member #${sub.user_id}`}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {sub.user?.student_id && `(${sub.user.student_id})`}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">v{sub.version_number}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate font-sans">
                        {ass?.title || `Assignment #${sub.assignment_id}`}
                      </p>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-sans">
                        <Clock className="w-3 h-3 stroke-[1.75]" />
                        <span className="tabular-nums">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Recent'}</span>
                        <span>•</span>
                        <span>{sub.submission_type}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-medium ${
                        sub.status === 'published' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        sub.status === 'evaluated' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                        sub.status === 'revision_requested' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {sub.status.replace('_', ' ')}
                      </span>

                      <button
                        onClick={() => onNavigateTab('workspace', sub.id)}
                        className="text-xs bg-white hover:bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded border border-slate-200 transition-colors"
                      >
                        Evaluate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Academic Protocol & Management */}
        <div className="space-y-4">
          {/* Quick Guidance Box - Quiet Academic Slate */}
          <div className="bg-[#0B192C] text-white rounded-lg p-4 border border-white/10 shadow-xs space-y-2.5">
            <h3 className="font-serif font-semibold text-sm text-slate-200">
              UWED Multi-Admin Protocol
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Assignments use rubric-based scoring. If score discrepancy between evaluators exceeds 15%, senior review or moderator intervention is automatically required before publishing grades.
            </p>
            <div className="pt-2 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between font-mono">
              <span>Discrepancy Threshold:</span>
              <span className="font-medium text-white bg-white/10 px-2 py-0.5 rounded border border-white/10">15%</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-lg border border-slate-200/90 shadow-xs p-4 space-y-2.5">
            <h3 className="font-serif font-semibold text-xs uppercase tracking-wide text-slate-500">
              Administrative Workflows
            </h3>
            <div className="space-y-1.5 text-xs font-sans">
              <button
                onClick={() => onNavigateTab('assignments')}
                className="w-full text-left px-3 py-2 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors flex items-center justify-between"
              >
                <span>Draft New Rubric</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 stroke-[1.75]" />
              </button>
              <button
                onClick={() => onNavigateTab('moderation')}
                className="w-full text-left px-3 py-2 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors flex items-center justify-between"
              >
                <span>Publish Pending Grades</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 stroke-[1.75]" />
              </button>
              <button
                onClick={() => onNavigateTab('members')}
                className="w-full text-left px-3 py-2 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors flex items-center justify-between"
              >
                <span>Review Membership Requests</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 stroke-[1.75]" />
              </button>
              <button
                onClick={() => onNavigateTab('analytics')}
                className="w-full text-left px-3 py-2 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors flex items-center justify-between"
              >
                <span>Export Progress & Metrics</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 stroke-[1.75]" />
              </button>
            </div>
          </div>

          {/* Notification & Reminder Operations */}
          <div className="bg-white rounded-lg border border-slate-200/90 shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-700">
                  <Bell className="w-3.5 h-3.5 stroke-[1.75]" />
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-xs text-slate-900">
                    Notifications & Reminders
                  </h3>
                  <p className="text-[10px] text-slate-400 font-sans">Telegram & In-App dispatch</p>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 font-medium px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                <span>Active</span>
              </span>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2 rounded-md border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-medium">Jami</span>
                <span className="text-sm font-semibold text-slate-900 font-serif tabular-nums">
                  {notifStatus?.total_notifications ?? 0}
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-md border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-medium">Telegram</span>
                <span className="text-sm font-semibold text-emerald-700 font-serif tabular-nums">
                  {notifStatus?.telegram_sent_count ?? 0}
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-md border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-medium">O'qilmagan</span>
                <span className="text-sm font-semibold text-amber-700 font-serif tabular-nums">
                  {notifStatus?.unread_notifications ?? 0}
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-md border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-medium">Yetkazilmadi</span>
                <span className="text-sm font-semibold text-slate-700 font-serif tabular-nums">
                  {(notifStatus?.telegram_failed_count ?? 0) + (notifStatus?.telegram_disabled_count ?? 0)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-1.5 border-t border-slate-100">
              <button
                onClick={handleProcessReminders}
                disabled={processingReminders}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md text-xs font-medium transition-colors border border-slate-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 stroke-[1.75] ${processingReminders ? 'animate-spin' : ''}`} />
                <span>{processingReminders ? 'Tekshirilmoqda...' : 'Eslatmalarni tekshirish (24h/3h)'}</span>
              </button>

              {isSuperAdmin && (
                <button
                  onClick={() => setShowAnnouncementModal(true)}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-navy-900 hover:bg-navy-800 text-white rounded-md text-xs font-medium transition-colors shadow-xs"
                >
                  <Send className="w-3 h-3 stroke-[1.75]" />
                  <span>Rasmiy e'lon yuborish</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Super Admin Broadcast Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-800">
                  <SendHorizontal className="w-4 h-4 stroke-[1.75]" />
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-slate-900 text-sm">
                    Barcha a'zolarga rasmiy e'lon
                  </h3>
                  <p className="text-xs text-slate-400">Telegram va Mini App bildirishnomalari orqali yetkaziladi</p>
                </div>
              </div>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">
                  E'lon sarlavhasi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Muhim seminar yoki muddat o'zgarishi"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-navy-800 focus:border-navy-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1">
                  Xabar matni
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Hurmatli ThinkSpace a'zolari..."
                  value={announcementMsg}
                  onChange={(e) => setAnnouncementMsg(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-navy-800 focus:border-navy-800 outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="bg-amber-50/80 border border-amber-200/80 rounded-md p-3 text-xs text-amber-900 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 stroke-[1.75]" />
                <span className="leading-relaxed">
                  Ushbu e'lon tasdiqlangan barcha ThinkSpace a'zolariga mini-app bildirishnomalarida va Telegram botida yetkaziladi.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSendingAnnouncement || !announcementTitle.trim() || !announcementMsg.trim()}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 rounded-md transition-colors shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isSendingAnnouncement ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Yuborilmoqda...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 stroke-[1.75]" />
                      <span>Barchaga yuborish</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
