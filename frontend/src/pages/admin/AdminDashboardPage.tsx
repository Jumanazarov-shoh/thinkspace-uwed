import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Assignment, Submission, User } from '../../types';
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
  RefreshCw
} from 'lucide-react';

interface AdminDashboardPageProps {
  onNavigateTab: (tab: string, subId?: number) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigateTab }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assList, subList, memList, reqList] = await Promise.all([
        api.getAssignments(),
        api.getSubmissionsList(),
        api.listMembers('approved'),
        api.listMembershipRequests('pending').catch(() => [])
      ]);
      setAssignments(assList);
      setSubmissions(subList);
      setMembers(memList);
      setPendingRequestsCount(reqList.length);
    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
        </div>
      </div>
    </div>
  );
};
