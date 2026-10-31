import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Assignment, MemberProgress } from '../../types';
import { 
  ArrowRight, 
  Calendar, 
  Award, 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  MessageSquare, 
  BarChart2, 
  Users, 
  Lightbulb, 
  Share2 
} from 'lucide-react';

interface HomePageProps {
  onNavigateToTasks: () => void;
  onSelectAssignment: (assignmentId: number) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToTasks,
  onSelectAssignment
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [upcomingTask, setUpcomingTask] = useState<Assignment | null>(null);
  const [progress, setProgress] = useState<MemberProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHomeData = async () => {
      setLoading(true);
      try {
        const assignments = await api.getAssignments({ status: 'open' });
        if (assignments.length > 0) {
          // Find closest deadline
          const sorted = [...assignments].sort(
            (a, b) => new Date(a.deadline_at || a.created_at).getTime() - new Date(b.deadline_at || b.created_at).getTime()
          );
          setUpcomingTask(sorted[0]);
        }

        if (user) {
          const prog = await api.getMyProgress();
          setProgress(prog);
        }
      } catch (e) {
        console.error('Failed to load homepage data:', e);
      } finally {
        setLoading(false);
      }
    };

    loadHomeData();
  }, [user]);

  return (
    <div className="space-y-4">
      {/* Welcome Banner - Editorial, Quiet */}
      <div className="bg-white rounded-lg p-4 border border-slate-200/90 shadow-xs">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-blue-800 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-200/50">
            SIEM • UWED
          </span>
          <span className="text-[11px] text-slate-400 font-sans">
            Akademik platforma
          </span>
        </div>
        <h2 className="font-serif font-semibold text-lg text-slate-900 mt-2 tracking-tight">
          {t.home.welcome}, {user?.first_name || 'Member'}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 font-sans leading-relaxed">
          {t.common.tagline}
        </p>
      </div>

      {/* Personal Progress Summary Bar - Tabular figures, Crisp */}
      {progress && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white p-3 rounded-lg border border-slate-200/90 text-center shadow-xs">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{t.home.totalPoints}</p>
            <p className="text-base font-serif font-semibold text-blue-900 mt-0.5 tabular-nums">{progress.total_points}</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200/90 text-center shadow-xs">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{t.progress.avgScore}</p>
            <p className="text-base font-serif font-semibold text-slate-900 mt-0.5 tabular-nums">{progress.average_percentage}%</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200/90 text-center shadow-xs">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{t.home.completionRate}</p>
            <p className="text-base font-serif font-semibold text-emerald-700 mt-0.5 tabular-nums">{progress.completion_rate}%</p>
          </div>
        </div>
      )}

      {/* Featured / Next Upcoming Task Card */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-600">
            <Clock className="w-3.5 h-3.5 text-blue-700 stroke-[1.75]" />
            <span>{t.home.nextDeadline}</span>
          </div>
          {upcomingTask && (
            <span className="text-[11px] font-mono bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs">
              {upcomingTask.direction}
            </span>
          )}
        </div>

        <div className="p-4">
          {upcomingTask ? (
            <div>
              <h3 className="font-serif font-semibold text-base text-slate-900 leading-snug">
                {upcomingTask.title}
              </h3>
              <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                {upcomingTask.description}
              </p>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center space-x-1.5 text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 stroke-[1.75]" />
                  <span className="tabular-nums">
                    {upcomingTask.deadline_at ? new Date(upcomingTask.deadline_at).toLocaleDateString() : 'Faol'}
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-amber-800 font-medium">
                  <Award className="w-3.5 h-3.5 stroke-[1.75]" />
                  <span className="tabular-nums">{upcomingTask.max_score} {t.common.points}</span>
                </div>
              </div>

              <button
                onClick={() => onSelectAssignment(upcomingTask.id)}
                className="w-full mt-3.5 bg-navy-900 hover:bg-navy-800 text-white text-xs font-medium py-2.5 px-3 rounded-md flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
              >
                <span>{t.tasks.submitWork}</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
              </button>
            </div>
          ) : (
            <div className="py-6 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-2 stroke-[1.75]" />
              <p>{t.home.noUpcomingTasks}</p>
            </div>
          )}
        </div>
      </div>

      {/* The 6 Directions Grid - Unified, Restrained */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <h4 className="font-serif font-semibold text-sm text-slate-900">
            {t.common.direction}
          </h4>
          <button
            onClick={onNavigateToTasks}
            className="text-xs text-blue-700 hover:text-blue-900 font-medium flex items-center space-x-1 transition-colors"
          >
            <span>{t.home.viewAllTasks}</span>
            <ArrowRight className="w-3 h-3 stroke-[1.75]" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { name: 'Think & Read', desc: t.directions.readDesc, icon: BookOpen },
            { name: 'Think & Discuss', desc: t.directions.discussDesc, icon: MessageSquare },
            { name: 'Think & Analyze', desc: t.directions.analyzeDesc, icon: BarChart2 },
            { name: 'Think & Lead', desc: t.directions.leadDesc, icon: Users },
            { name: 'Think & Create', desc: t.directions.createDesc, icon: Lightbulb },
            { name: 'Think & Connect', desc: t.directions.connectDesc, icon: Share2 },
          ].map((d) => {
            const Icon = d.icon;
            return (
              <div
                key={d.name}
                onClick={onNavigateToTasks}
                className="bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs hover:border-slate-400/80 transition-colors cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center mb-2 text-slate-700">
                    <Icon className="w-3.5 h-3.5 stroke-[1.75]" />
                  </div>
                  <h5 className="font-serif font-semibold text-xs text-slate-900 leading-tight">
                    {d.name}
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {d.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
