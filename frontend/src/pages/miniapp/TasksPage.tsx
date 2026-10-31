import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { api } from '../../services/api';
import { Assignment } from '../../types';
import { 
  Award, 
  ChevronRight, 
  Clock, 
  RotateCw, 
  Layers, 
  AlertCircle,
  FolderOpen
} from 'lucide-react';

interface TasksPageProps {
  onSelectAssignment: (assignmentId: number) => void;
  onViewMySubmissions?: () => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({ 
  onSelectAssignment, 
  onViewMySubmissions 
}) => {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'closed'>('all');

  const directions = [
    { id: 'all', label: 'Barchasi' },
    { id: 'Think & Read', label: 'Read' },
    { id: 'Think & Discuss', label: 'Discuss' },
    { id: 'Think & Analyze', label: 'Analyze' },
    { id: 'Think & Lead', label: 'Lead' },
    { id: 'Think & Create', label: 'Create' },
    { id: 'Think & Connect', label: 'Connect' },
  ];

  const fetchTasks = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getAssignments();
      setAssignments(data);
    } catch (e: any) {
      console.error('Failed to load assignments:', e);
      setErrorMsg(e.message || 'Topshiriqlarni yuklashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Filter tasks
  const filteredTasks = assignments.filter((task) => {
    if (selectedDirection !== 'all' && task.direction !== selectedDirection) {
      return false;
    }
    if (statusFilter !== 'all') {
      const isTaskPublished = task.status === 'published' || task.status === 'open';
      if (statusFilter === 'published' && !isTaskPublished) return false;
      if (statusFilter === 'closed' && task.status !== 'closed') return false;
    }
    return true;
  });

  const formatDeadline = (dateString?: string) => {
    if (!dateString) return 'Muddatsiz';
    const date = new Date(dateString);
    return date.toLocaleDateString('uz-UZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDifficultyLabel = (diff?: string) => {
    switch (diff) {
      case 'beginner': return "Boshlang'ich";
      case 'advanced': return "Yuqori";
      case 'intermediate':
      default: return "O'rtacha";
    }
  };

  const getSubmissionStatusBadge = (status?: string) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5" />
            Topshirilgan
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mr-1.5" />
            Kechikkan
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded border bg-blue-50 text-blue-800 border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1.5" />
            Qoralama
          </span>
        );
      case 'locked':
        return (
          <span className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded border bg-slate-100 text-slate-700 border-slate-200">
            Qulflangan
          </span>
        );
      case 'not_started':
      default:
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500">
            Boshlanmagan
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with My Submissions shortcut */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-serif font-semibold text-lg text-slate-900 leading-tight">
            {t.tasks.title}
          </h2>
          <p className="text-xs text-slate-500 font-sans mt-0.5">
            {t.tasks.subtitle}
          </p>
        </div>
        {onViewMySubmissions && (
          <button
            onClick={onViewMySubmissions}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-700 stroke-[1.75]" />
            <span>Mening ishlarim</span>
          </button>
        )}
      </div>

      {/* Direction Pills (horizontal scrolling) */}
      <div className="flex space-x-1.5 overflow-x-auto pb-1 text-xs">
        {directions.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelectedDirection(d.id)}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              selectedDirection === d.id
                ? 'bg-navy-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Status Filter Sub-Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
        <span className="font-medium text-slate-800 tabular-nums">
          {filteredTasks.length} ta topshiriq
        </span>
        <div className="flex space-x-1 bg-slate-100 p-0.5 rounded-md border border-slate-200">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Barchasi
          </button>
          <button
            onClick={() => setStatusFilter('published')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              statusFilter === 'published'
                ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Faol
          </button>
          <button
            onClick={() => setStatusFilter('closed')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              statusFilter === 'closed'
                ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Yopilgan
          </button>
        </div>
      </div>

      {/* Task List / States */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-500 space-y-2">
          <RotateCw className="w-4 h-4 text-blue-700 animate-spin mx-auto stroke-[1.75]" />
          <p>Topshiriqlar yuklanmoqda...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50/80 border border-red-200 rounded-lg p-5 text-center space-y-2.5">
          <AlertCircle className="w-6 h-6 text-red-600 mx-auto stroke-[1.75]" />
          <p className="text-xs text-red-800">{errorMsg}</p>
          <button
            onClick={fetchTasks}
            className="px-3.5 py-1.5 bg-navy-900 text-white rounded-md text-xs font-medium hover:bg-navy-800 transition-colors"
          >
            Qayta urinish
          </button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center border border-slate-200 space-y-2">
          <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
            <Layers className="w-4 h-4 stroke-[1.75]" />
          </div>
          <h3 className="font-serif font-semibold text-sm text-slate-900">
            Hozircha topshiriqlar mavjud emas
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Tanlangan mezonlar bo'yicha topshiriqlar topilmadi. Tez orada yangi intellektual vazifalar e'lon qilinadi.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => {
            const isClosed = task.status === 'closed';
            const deadlineFormatted = formatDeadline(task.deadline_at || task.deadline);

            return (
              <div
                key={task.id}
                onClick={() => onSelectAssignment(task.id)}
                className="bg-white rounded-lg p-4 border border-slate-200/90 shadow-2xs hover:border-slate-400/80 transition-colors cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {task.direction}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      {getSubmissionStatusBadge(task.my_submission_status)}
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-medium ${
                        isClosed 
                          ? 'bg-slate-100 text-slate-600 border-slate-200' 
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        {isClosed ? 'Yopilgan' : 'Faol'}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-serif font-semibold text-sm text-slate-900 leading-snug">
                    {task.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                    {task.short_description || task.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                  <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-400 stroke-[1.75]" />
                    <span className="tabular-nums">{deadlineFormatted}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600">
                      {getDifficultyLabel(task.difficulty)}
                    </span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {task.max_score} ball
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 stroke-[1.75]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
