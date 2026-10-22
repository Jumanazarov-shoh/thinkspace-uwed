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
  ExternalLink,
  Plus,
  RefreshCw,
  Bell,
  Send,
  Sparkles,
  Check,
  X,
  Radio,
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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Welcome */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
              UWED SIEM Operations
            </span>
            <span className="text-xs text-gray-400">• Academic Year 2026</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-navy-950 mt-1">
            ThinkSpace Evaluation Hub
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome, {user?.display_name || 'Staff Member'}. Manage academic submissions, rubric evaluations, and grade moderation.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={fetchData}
            title="Refresh Data"
            className="p-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button
            onClick={() => onNavigateTab('assignments')}
            className="flex items-center space-x-2 bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t.admin.createAssignment}</span>
          </button>
        </div>
      </div>

      {/* Action Success Alert */}
      {actionSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium">{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Approved Members */}
        <div 
          onClick={() => onNavigateTab('members')}
          className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t.admin.totalMembers}
            </span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-serif font-bold text-navy-950">{members.length}</span>
            {pendingRequestsCount > 0 && (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                +{pendingRequestsCount} pending
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">Verified SIEM students & members</p>
        </div>

        {/* Open Assignments */}
        <div 
          onClick={() => onNavigateTab('assignments')}
          className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t.admin.openAssignments}
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-serif font-bold text-navy-950">{openAssignmentsCount}</span>
            <span className="text-xs text-gray-400">of {assignments.length} total</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Active tasks accepting submissions</p>
        </div>

        {/* Pending Evaluations */}
        <div 
          onClick={() => onNavigateTab('workspace')}
          className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t.admin.pendingReviews}
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-serif font-bold text-navy-950">{pendingReviewsCount}</span>
            <span className="text-xs text-amber-600 font-medium">Needs evaluation</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Submissions waiting for rubric scoring</p>
        </div>

        {/* Awaiting Moderation */}
        <div 
          onClick={() => onNavigateTab('moderation')}
          className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t.admin.awaitingModeration}
            </span>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-serif font-bold text-navy-950">{awaitingModerationCount}</span>
            <span className="text-xs text-indigo-600 font-medium">Ready to publish</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Evaluated works awaiting final sign-off</p>
        </div>
      </div>

      {/* Main Split: Submissions Queue & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Submissions Queue */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-base font-serif font-bold text-navy-950">Recent Submission Queue</h2>
              <p className="text-xs text-gray-400">Incoming academic submissions across all 6 directions</p>
            </div>
            <button
              onClick={() => onNavigateTab('workspace')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>Open Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading queue...</div>
          ) : submissions.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              No submissions found yet. Once members submit work via Mini App, they will appear here.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {submissions.slice(0, 7).map((sub) => {
                const ass = assignments.find(a => a.id === sub.assignment_id);
                return (
                  <div key={sub.id} className="py-3.5 flex items-center justify-between hover:bg-gray-50/80 px-2 rounded-lg transition">
                    <div className="space-y-1 min-w-0 pr-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm text-navy-900 truncate">
                          {sub.user?.display_name || `Member #${sub.user_id}`}
                        </span>
                        <span className="text-xs text-gray-400">
                          {sub.user?.student_id && `(${sub.user.student_id})`}
                        </span>
                        <span className="text-[11px] font-mono text-gray-400">v{sub.version_number}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {ass?.title || `Assignment #${sub.assignment_id}`}
                      </p>
                      <div className="flex items-center space-x-2 text-[11px] text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Recent'}</span>
                        <span>•</span>
                        <span>{sub.submission_type}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                        sub.status === 'published' ? 'bg-emerald-100 text-emerald-800' :
                        sub.status === 'evaluated' ? 'bg-indigo-100 text-indigo-800' :
                        sub.status === 'revision_requested' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {sub.status.replace('_', ' ')}
                      </span>

                      <button
                        onClick={() => onNavigateTab('workspace', sub.id)}
                        className="text-xs bg-navy-50 hover:bg-navy-100 text-navy-900 font-medium px-3 py-1.5 rounded border border-navy-200 transition"
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

        {/* Right Col: Direction Distribution & Academic Rules */}
        <div className="space-y-6">
          {/* Quick Guidance Box */}
          <div className="bg-gradient-to-br from-[#0B192C] to-[#1E3E62] text-white rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-serif font-bold text-base text-blue-200">
              UWED Multi-Admin Protocol
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              Assignments use rubric-based scoring. If score discrepancy between evaluators exceeds 15%, senior review or moderator intervention is automatically required before publishing grades.
            </p>
            <div className="pt-2 border-t border-navy-700/60 text-xs text-blue-300 flex items-center justify-between font-mono">
              <span>Discrepancy Threshold:</span>
              <span className="font-bold text-white bg-blue-900/60 px-2 py-0.5 rounded">15%</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <h3 className="font-serif font-bold text-sm text-navy-900">
              Administrative Workflows
            </h3>
            <div className="space-y-2 text-sm">
              <button
                onClick={() => onNavigateTab('assignments')}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-900 transition flex items-center justify-between"
              >
                <span>Draft New Rubric</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => onNavigateTab('moderation')}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-900 transition flex items-center justify-between"
              >
                <span>Publish Pending Grades</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => onNavigateTab('members')}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-900 transition flex items-center justify-between"
              >
                <span>Review Membership Requests</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => onNavigateTab('analytics')}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-900 transition flex items-center justify-between"
              >
                <span>Export Progress & Metrics</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Notification & Reminder Operations */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-navy-900">
                    Notifications & Reminders
                  </h3>
                  <p className="text-[11px] text-gray-400">Telegram & In-App dispatch status</p>
                </div>
              </div>
              <span className="text-[11px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active</span>
              </span>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Jami Bildirishnoma</span>
                <span className="text-base font-bold text-navy-950 font-serif">
                  {notifStatus?.total_notifications ?? 0}
                </span>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Telegram Yetkazilgan</span>
                <span className="text-base font-bold text-emerald-600 font-serif">
                  {notifStatus?.telegram_sent_count ?? 0}
                </span>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">O'qilmagan (In-App)</span>
                <span className="text-base font-bold text-amber-600 font-serif">
                  {notifStatus?.unread_notifications ?? 0}
                </span>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Yetkazilmadi / O'chirilgan</span>
                <span className="text-base font-bold text-gray-700 font-serif">
                  {(notifStatus?.telegram_failed_count ?? 0) + (notifStatus?.telegram_disabled_count ?? 0)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2 border-t border-gray-100">
              <button
                onClick={handleProcessReminders}
                disabled={processingReminders}
                className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-lg text-xs font-semibold transition border border-blue-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${processingReminders ? 'animate-spin' : ''}`} />
                <span>{processingReminders ? 'Eslatmalar tekshirilmoqda...' : 'Eslatmalarni tekshirish (24h/3h)'}</span>
              </button>

              {isSuperAdmin && (
                <button
                  onClick={() => setShowAnnouncementModal(true)}
                  className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Rasmiy e'lon yuborish</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Super Admin Broadcast Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center text-navy-900">
                  <SendHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-navy-950 text-base">
                    Barcha a'zolarga rasmiy e'lon
                  </h3>
                  <p className="text-xs text-gray-400">Telegram va In-App tizimi orqali tarqatiladi</p>
                </div>
              </div>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                  E'lon sarlavhasi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Muhim seminar yoki muddat o'zgarishi"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-800 focus:border-navy-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                  Xabar matni
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Hurmatli ThinkSpace a'zolari, ..."
                  value={announcementMsg}
                  onChange={(e) => setAnnouncementMsg(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-800 focus:border-navy-800 outline-none resize-none"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Ushbu e'lon tasdiqlangan barcha ThinkSpace a'zolariga mini-app bildirishnomalarida va Telegram botida yetkaziladi.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSendingAnnouncement || !announcementTitle.trim() || !announcementMsg.trim()}
                  className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 rounded-lg transition shadow-sm flex items-center space-x-2 disabled:opacity-50"
                >
                  {isSendingAnnouncement ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Yuborilmoqda...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
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
