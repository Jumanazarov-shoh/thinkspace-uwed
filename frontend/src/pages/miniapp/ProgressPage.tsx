import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { api } from '../../services/api';
import { MemberProgress } from '../../types';
import { TrendingUp, Award, CheckCircle, Clock, BookOpen, MessageSquare, BarChart, Users, Lightbulb, Share2 } from 'lucide-react';

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
    return <div className="py-16 text-center text-xs text-gray-500">{t.common.loading}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-serif font-bold text-lg text-navy-900 leading-tight">
          {t.progress.title}
        </h2>
        <p className="text-xs text-gray-500 font-sans mt-0.5">
          {t.progress.subtitle}
        </p>
      </div>

      {/* KPI Cards */}
      {progress && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white p-3.5 rounded-xl border border-gray-200/90 shadow-2xs">
            <div className="flex items-center space-x-1.5 text-blue-700 text-xs font-semibold">
              <Award className="w-4 h-4" />
              <span>{t.home.totalPoints}</span>
            </div>
            <p className="text-2xl font-serif font-bold text-navy-900 mt-1">
              {progress.total_points}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {progress.graded_assignments_count} {t.progress.gradedCount.toLowerCase()}
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200/90 shadow-2xs">
            <div className="flex items-center space-x-1.5 text-emerald-700 text-xs font-semibold">
              <TrendingUp className="w-4 h-4" />
              <span>{t.progress.avgScore}</span>
            </div>
            <p className="text-2xl font-serif font-bold text-navy-900 mt-1">
              {progress.average_percentage}%
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {t.home.completionRate}: {progress.completion_rate}%
            </p>
          </div>
        </div>
      )}

      {/* Pending Reviews Pill */}
      {progress && progress.pending_reviews_count > 0 && (
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{t.progress.pendingCount}:</span>
          </div>
          <span className="font-bold bg-white px-2 py-0.5 rounded border border-amber-300">
            {progress.pending_reviews_count} ta ish
          </span>
        </div>
      )}

      {/* Direction-by-Direction Breakdown */}
      <div className="bg-white rounded-xl p-4 border border-gray-200/90 shadow-sm space-y-3">
        <h3 className="font-serif font-bold text-sm text-navy-900">
          {t.progress.directionBreakdown}
        </h3>

        <div className="space-y-3 pt-1">
          {progress?.directions.map((d) => {
            const Icon = dirIcons[d.direction] || BookOpen;
            return (
              <div key={d.direction} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5">
                    <Icon className="w-3.5 h-3.5 text-blue-700" />
                    <span className="font-semibold text-gray-800">{d.direction}</span>
                  </div>
                  <div className="space-x-1.5 text-[11px]">
                    <span className="text-gray-500">{d.assignments_completed} ta topshiriq</span>
                    <span className="font-bold text-navy-900">{d.total_score} ball</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-700 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(d.average_percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
