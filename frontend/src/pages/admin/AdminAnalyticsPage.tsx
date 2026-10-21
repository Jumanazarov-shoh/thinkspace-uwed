import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { api } from '../../services/api';
import { Assignment, Submission, LeaderboardEntry, DirectionType } from '../../types';
import { 
  BarChart3, 
  TrendingUp, 
  Award, 
  FileCheck2, 
  CheckCircle2, 
  Compass, 
  BookOpen, 
  MessageSquare, 
  BarChart2, 
  Zap, 
  Lightbulb, 
  Network 
} from 'lucide-react';

export const AdminAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [assList, subList, leadList] = await Promise.all([
          api.getAssignments(),
          api.getSubmissionsList(),
          api.getLeaderboard(10)
        ]);
        setAssignments(assList);
        setSubmissions(subList);
        setLeaderboard(leadList);
      } catch (err) {
        console.error('Error fetching analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalPublished = submissions.filter(s => s.status === 'published').length;
  const totalEvaluated = submissions.filter(s => s.status === 'evaluated' || s.status === 'published').length;
  const totalSubmissions = submissions.length;

  const directionsData: Array<{ id: DirectionType; label: string; icon: any; color: string }> = [
    { id: 'think_read', label: 'Think & Read', icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
    { id: 'think_discuss', label: 'Think & Discuss', icon: MessageSquare, color: 'text-teal-600 bg-teal-50' },
    { id: 'think_analyze', label: 'Think & Analyze', icon: BarChart2, color: 'text-indigo-600 bg-indigo-50' },
    { id: 'think_lead', label: 'Think & Lead', icon: Zap, color: 'text-amber-600 bg-amber-50' },
    { id: 'think_create', label: 'Think & Create', icon: Lightbulb, color: 'text-purple-600 bg-purple-50' },
    { id: 'think_connect', label: 'Think & Connect', icon: Network, color: 'text-emerald-600 bg-emerald-50' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              Academic Intelligence
            </span>
            <span className="text-xs text-gray-400">• Performance & Distribution</span>
          </div>
          <h1 className="text-xl font-serif font-bold text-navy-950 mt-1">
            ThinkSpace Club Progress Analytics
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
          Loading analytics metrics...
        </div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Total Submissions
              </span>
              <div className="text-3xl font-serif font-bold text-navy-950 mt-2">
                {totalSubmissions}
              </div>
              <p className="text-xs text-gray-400 mt-1">All member drafts & submissions</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Evaluation Rate
              </span>
              <div className="text-3xl font-serif font-bold text-navy-950 mt-2">
                {totalSubmissions > 0 ? Math.round((totalEvaluated / totalSubmissions) * 100) : 0}%
              </div>
              <p className="text-xs text-gray-400 mt-1">{totalEvaluated} of {totalSubmissions} evaluated</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Published Final Grades
              </span>
              <div className="text-3xl font-serif font-bold text-navy-950 mt-2">
                {totalPublished}
              </div>
              <p className="text-xs text-gray-400 mt-1">Officially impacting rankings</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Ranked Members
              </span>
              <div className="text-3xl font-serif font-bold text-navy-950 mt-2">
                {leaderboard.length}
              </div>
              <p className="text-xs text-gray-400 mt-1">Members with verified scores</p>
            </div>
          </div>

          {/* Direction Distribution */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-base font-serif font-bold text-navy-950">
                Activity Distribution Across 6 ThinkSpace Directions
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Task distribution and intellectual focus across academic club pillars
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {directionsData.map((d) => {
                const Icon = d.icon;
                const assCount = assignments.filter(a => a.direction === d.id).length;
                const subCount = submissions.filter(s => s.assignment?.direction === d.id).length;

                return (
                  <div key={d.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${d.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-navy-950 text-xs">{d.label}</h3>
                        <p className="text-[11px] text-gray-400">{assCount} assignment(s) created</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs">
                      <span className="text-gray-500">Submissions:</span>
                      <span className="font-bold font-mono text-navy-950">{subCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Performers Preview */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-serif font-bold text-navy-950">
                  Current Official Top Performers
                </h2>
                <p className="text-xs text-gray-400">
                  Calculated purely from published and moderated grades
                </p>
              </div>
            </div>

            {leaderboard.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No published grades yet. Leaderboard activates as soon as evaluations are finalized and published.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {leaderboard.slice(0, 5).map((entry) => (
                  <div key={entry.user_id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="font-serif font-bold text-navy-900 w-6">#{entry.rank}</span>
                      <div>
                        <div className="font-semibold text-navy-950">{entry.display_name}</div>
                        <div className="text-[11px] text-gray-400">{entry.faculty || 'SIEM / UWED'}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-navy-950 text-sm">
                        {entry.total_score} pts
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {entry.completed_tasks_count ?? entry.completed_assignments ?? 0} tasks • {(entry.average_score ?? entry.average_percentage ?? 0).toFixed(1)}% avg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
