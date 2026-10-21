import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Assignment, MemberProgress, AssignmentDirection } from '../../types';
import { 
  ArrowRight, 
  Calendar, 
  Award, 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  MessageSquare, 
  BarChart, 
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

  const directionIcons: Record<string, any> = {
    'Think & Read': BookOpen,
    'Think & Discuss': MessageSquare,
    'Think & Analyze': BarChart,
    'Think & Lead': Users,
    'Think & Create': Lightbulb,
    'Think & Connect': Share2,
  };

  return (
    <div className="space-y-4">
      {/* Welcome Banner */}
      <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
            SIEM • UWED
          </span>
          <h2 className="font-serif font-bold text-lg text-navy-900 mt-1.5">
            {t.home.welcome}, {user?.first_name || 'Member'}!
          </h2>
          <p className="text-xs text-gray-600 mt-0.5 font-sans">
            {t.common.tagline}
          </p>
        </div>
        <div className="absolute -right-3 -bottom-5 w-24 h-24 bg-navy-50 rounded-full opacity-60 pointer-events-none" />
      </div>

      {/* Personal Progress Summary Bar */}
      {progress && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white p-3 rounded-lg border border-gray-200 text-center shadow-xs">
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">{t.home.totalPoints}</p>
            <p className="text-base font-serif font-bold text-blue-800 mt-0.5">{progress.total_points}</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200 text-center shadow-xs">
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">{t.progress.avgScore}</p>
            <p className="text-base font-serif font-bold text-navy-900 mt-0.5">{progress.average_percentage}%</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200 text-center shadow-xs">
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">{t.home.completionRate}</p>
            <p className="text-base font-serif font-bold text-emerald-700 mt-0.5">{progress.completion_rate}%</p>
          </div>
        </div>
      )}

      {/* Featured / Next Upcoming Task Card */}
      <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm overflow-hidden">
        <div className="bg-navy-900 text-white px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-xs font-medium text-blue-300">
            <Clock className="w-3.5 h-3.5" />
            <span>{t.home.nextDeadline}</span>
          </div>
          {upcomingTask && (
            <span className="text-[10px] bg-blue-800/80 text-white px-2 py-0.5 rounded font-medium">
              {upcomingTask.direction}
            </span>
          )}
        </div>

        <div className="p-4">
          {upcomingTask ? (
            <div>
              <h3 className="font-serif font-bold text-base text-navy-900 leading-snug">
                {upcomingTask.title}
              </h3>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                {upcomingTask.description}
              </p>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 text-xs">
                <div className="flex items-center space-x-1 text-gray-500">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>{upcomingTask.deadline_at ? new Date(upcomingTask.deadline_at).toLocaleDateString() : 'Active'}</span>
                </div>
                <div className="flex items-center space-x-1 text-amber-700 font-semibold">
                  <Award className="w-3.5 h-3.5" />
                  <span>{upcomingTask.max_score} {t.common.points}</span>
                </div>
              </div>

              <button
                onClick={() => onSelectAssignment(upcomingTask.id)}
                className="w-full mt-3.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 shadow-sm transition-all"
              >
                <span>{t.tasks.submitWork}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="py-6 text-center text-gray-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
              <p>{t.home.noUpcomingTasks}</p>
            </div>
          )}
        </div>
      </div>

      {/* The 6 Directions Grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-serif font-bold text-sm text-navy-900">
            {t.common.direction}
          </h4>
          <button
            onClick={onNavigateToTasks}
            className="text-xs text-blue-700 hover:text-blue-900 font-medium flex items-center space-x-0.5"
          >
            <span>{t.home.viewAllTasks}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { name: 'Think & Read', desc: t.directions.readDesc, icon: BookOpen, color: 'text-blue-700 bg-blue-50' },
            { name: 'Think & Discuss', desc: t.directions.discussDesc, icon: MessageSquare, color: 'text-purple-700 bg-purple-50' },
            { name: 'Think & Analyze', desc: t.directions.analyzeDesc, icon: BarChart, color: 'text-emerald-700 bg-emerald-50' },
            { name: 'Think & Lead', desc: t.directions.leadDesc, icon: Users, color: 'text-amber-700 bg-amber-50' },
            { name: 'Think & Create', desc: t.directions.createDesc, icon: Lightbulb, color: 'text-rose-700 bg-rose-50' },
            { name: 'Think & Connect', desc: t.directions.connectDesc, icon: Share2, color: 'text-cyan-700 bg-cyan-50' },
          ].map((d) => {
            const Icon = d.icon;
            return (
              <div
                key={d.name}
                onClick={onNavigateToTasks}
                className="bg-white p-3 rounded-lg border border-gray-200/90 shadow-2xs hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className={`w-7 h-7 rounded flex items-center justify-center mb-2 ${d.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h5 className="font-serif font-bold text-xs text-navy-900 leading-tight">
                    {d.name}
                  </h5>
                  <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">
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
