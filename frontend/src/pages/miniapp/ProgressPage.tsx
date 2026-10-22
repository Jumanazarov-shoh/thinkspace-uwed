import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { api } from '../../services/api';
import { MemberProgress } from '../../types';
import { 
  TrendingUp, 
  Award, 
  CheckCircle, 
  Clock, 
  BookOpen, 
  MessageSquare, 
  BarChart, 
  Users, 
  Lightbulb, 
  Share2,
  FileText,
  AlertTriangle,
  History,
  Sparkles,
  Calendar,
  CheckCircle2
} from 'lucide-react';

export const ProgressPage: React.FC = () => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<MemberProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      setLoading(true);
      try {
        const data = await api.getMyProgress();
        setProgress(data);
      } catch (e) {
        console.error('Failed to load member progress:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, []);

  const dirIcons: Record<string, any> = {
    'Think & Read': BookOpen,
    'Think & Discuss': MessageSquare,
    'Think & Analyze': BarChart,
    'Think & Lead': Users,
    'Think & Create': Lightbulb,
    'Think & Connect': Share2,
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-2">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-gray-500">{t.common.loading}</p>
      </div>
    );
  }

  const hasActivity = progress && (
    (progress.assignments_submitted_count ?? 0) > 0 || 
    progress.graded_assignments_count > 0 || 
    (progress.draft_submissions_count ?? 0) > 0
  );

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div>
        <h2 className="font-serif font-bold text-lg text-navy-950 leading-tight">
          Shaxsiy Ilmiy Natijalar (My Progress)
        </h2>
        <p className="text-xs text-gray-500 font-sans mt-0.5">
          ThinkSpace topshiriqlari bo'yicha shaxsiy faolligingiz va akademik ko'rsatkichlaringiz
        </p>
      </div>

      {/* KPI 4-Grid Cards */}
      {progress && (
        <div className="grid grid-cols-2 gap-2.5">
          {/* Total Points */}
          <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-2xs space-y-1">
            <div className="flex items-center space-x-1.5 text-blue-700 text-xs font-semibold">
              <Award className="w-4 h-4" />
              <span>To'plangan Ball</span>
            </div>
            <p className="text-2xl font-serif font-bold text-navy-950">
              {progress.total_points}
            </p>
            <p className="text-[10px] text-gray-400">
              {progress.graded_assignments_count} ta baholangan ish bo'yicha
            </p>
          </div>

          {/* Average Score & Percentage */}
          <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-2xs space-y-1">
            <div className="flex items-center space-x-1.5 text-emerald-700 text-xs font-semibold">
              <TrendingUp className="w-4 h-4" />
              <span>O'rtacha Baho</span>
            </div>
            <p className="text-2xl font-serif font-bold text-navy-950">
              {progress.average_percentage}%
            </p>
            <p className="text-[10px] text-gray-400">
              O'rtacha: {progress.average_score ?? 0} ball
            </p>
          </div>

          {/* Completion Rate */}
          <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-2xs space-y-1">
            <div className="flex items-center space-x-1.5 text-purple-700 text-xs font-semibold">
              <CheckCircle className="w-4 h-4" />
              <span>Bajarilish Ko'rsatkichi</span>
            </div>
            <p className="text-2xl font-serif font-bold text-navy-950">
              {progress.completion_rate}%
            </p>
            <p className="text-[10px] text-gray-400">
              Mavjud barcha topshiriqlardan
            </p>
          </div>

          {/* Submitted vs Available */}
          <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-2xs space-y-1">
            <div className="flex items-center space-x-1.5 text-amber-700 text-xs font-semibold">
              <BookOpen className="w-4 h-4" />
              <span>Topshirilgan Ishlar</span>
            </div>
            <p className="text-2xl font-serif font-bold text-navy-950">
              {progress.assignments_submitted_count ?? 0} <span className="text-xs font-normal text-gray-400">/ {progress.total_assignments_available ?? 0}</span>
            </p>
            <p className="text-[10px] text-gray-400">
              {progress.pending_reviews_count > 0 ? `${progress.pending_reviews_count} ta tekshiruvda` : "Tekshiruv navbati yo'q"}
            </p>
          </div>
        </div>
      )}

      {/* Submissions Status Pill Bar */}
      {progress && (
        <div className="bg-white rounded-2xl p-3.5 border border-gray-200/90 shadow-2xs space-y-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Topshiriqlar statusi
          </span>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-medium">
              Topshirilgan: <strong>{progress.assignments_submitted_count ?? 0}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium">
              Baholangan: <strong>{progress.graded_assignments_count}</strong>
            </span>
            {(progress.pending_reviews_count > 0) && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium flex items-center space-x-1">
                <Clock className="w-3 h-3 text-amber-600" />
                <span>Tekshiruvda: <strong>{progress.pending_reviews_count}</strong></span>
              </span>
            )}
            {((progress.draft_submissions_count ?? 0) > 0) && (
              <span className="px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 font-medium">
                Qoralama: <strong>{progress.draft_submissions_count}</strong>
              </span>
            )}
            {((progress.late_submissions_count ?? 0) > 0) && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span>Kechikkan: <strong>{progress.late_submissions_count}</strong></span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ThinkSpace Direction Breakdown */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-3">
        <div>
          <h3 className="font-serif font-bold text-sm text-navy-950">
            Yo'nalishlar bo'yicha tahlil (Directions Breakdown)
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            ThinkSpace'ning 6 ta intellektual yo'nalishi bo'yicha natijalaringiz
          </p>
        </div>

        <div className="space-y-3 pt-1">
          {progress && progress.directions && progress.directions.map((d) => {
            const Icon = dirIcons[d.direction] || BarChart;
            return (
              <div key={d.direction} className="p-3 bg-gray-50/70 rounded-xl border border-gray-200/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center text-blue-700 shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold text-navy-900">{d.direction}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-navy-950">
                      {d.assignments_completed} <span className="text-gray-400 font-normal">/ {d.assignments_available ?? 0}</span>
                    </span>
                    <span className="text-[11px] text-gray-500 ml-1.5 font-medium">
                      ({d.average_percentage}%)
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-navy-900 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.max(0, d.average_percentage))}%` }} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Finalized Results */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif font-bold text-sm text-navy-950 flex items-center space-x-1.5">
            <Award className="w-4 h-4 text-gold-500" />
            <span>So'nggi baholangan ishlar</span>
          </h3>
          {progress?.recent_results && progress.recent_results.length > 0 && (
            <span className="text-[11px] text-gray-500">
              {progress.recent_results.length} ta natija
            </span>
          )}
        </div>

        {progress?.recent_results && progress.recent_results.length > 0 ? (
          <div className="space-y-2">
            {progress.recent_results.map((res) => (
              <div 
                key={res.assignment_id}
                className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between"
              >
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="font-semibold text-xs text-navy-900 truncate">
                    {res.assignment_title}
                  </h4>
                  <p className="text-[10px] text-gray-500">
                    {res.direction} • {res.finalized_at ? new Date(res.finalized_at).toLocaleDateString('uz-UZ') : 'Tasdiqlangan'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-serif font-bold text-navy-950">
                    {res.score} <span className="text-[10px] font-sans font-normal text-gray-400">/ {res.max_score}</span>
                  </div>
                  <span className="inline-block px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    {res.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center space-y-1.5">
            <p className="text-xs text-gray-500 font-medium">
              Hozircha rasman baholangan topshiriqlar mavjud emas
            </p>
            <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
              Birinchi topshirig'ingiz hakamlar tomonidan baholanib tasdiqlangach, uning to'liq natijasi shu yerda chiqadi.
            </p>
          </div>
        )}
      </div>

      {/* Recent Activity Timeline */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-3">
        <h3 className="font-serif font-bold text-sm text-navy-950 flex items-center space-x-1.5">
          <History className="w-4 h-4 text-blue-600" />
          <span>So'nggi harakatlar (Activity Feed)</span>
        </h3>

        {progress?.recent_activity && progress.recent_activity.length > 0 ? (
          <div className="space-y-2.5 pt-1">
            {progress.recent_activity.map((act, idx) => (
              <div key={idx} className="flex items-start space-x-2.5 text-xs">
                <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                <div className="flex-1 space-y-0.5">
                  <p className="font-semibold text-navy-900 leading-snug">{act.title}</p>
                  <p className="text-[11px] text-gray-500">{act.description}</p>
                  <span className="text-[10px] text-gray-400 block">
                    {new Date(act.timestamp).toLocaleString('uz-UZ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-gray-400">
            Hozircha faollik qayd etilmagan
          </div>
        )}
      </div>
    </div>
  );
};
