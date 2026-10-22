import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { api } from '../../services/api';
import { Assignment } from '../../types';
import { 
  Calendar, 
  Award, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  RotateCw, 
  Layers, 
  AlertCircle,
  FileCheck2,
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

  // Format deadline date nicely
  const formatDeadline = (dateString?: string) => {
    if (!dateString) return 'Muddatsiz';
    const date = new Date(dateString);
    return date.toLocaleDateString('uz-UZ', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
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
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            ✅ Topshirilgan
          </span>
        );
      case 'late':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            ⏰ Kechikkan
          </span>
        );
      case 'draft':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            📝 Qoralama
          </span>
        );
      case 'locked':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
            🔒 Qulflangan
          </span>
        );
      case 'not_started':
      default:
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
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
          <h2 className="font-serif font-bold text-lg text-navy-950 leading-tight">
            {t.tasks.title}
          </h2>
          <p className="text-xs text-gray-500 font-sans mt-0.5">
            {t.tasks.subtitle}
          </p>
        </div>
        {onViewMySubmissions && (
          <button
            onClick={onViewMySubmissions}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition shadow-2xs"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Mening ishlarim</span>
          </button>
        )}
      </div>

      {/* Direction Pills (horizontal scrolling) */}
      <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {directions.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelectedDirection(d.id)}
            className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
              selectedDirection === d.id
                ? 'bg-navy-900 text-white shadow-xs'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Status Filter Sub-Bar */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-0.5">
        <span className="font-medium text-navy-900">
          {filteredTasks.length} ta topshiriq
        </span>
        <div className="flex space-x-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
              statusFilter === 'all'
                ? 'bg-white text-navy-950 shadow-2xs font-semibold'
                : 'text-gray-600 hover:text-navy-900'
            }`}
          >
            Barchasi
          </button>
          <button
            onClick={() => setStatusFilter('published')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
              statusFilter === 'published'
                ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
                : 'text-gray-600 hover:text-navy-900'
            }`}
          >
            Faol
          </button>
          <button
            onClick={() => setStatusFilter('closed')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
              statusFilter === 'closed'
                ? 'bg-white text-gray-800 shadow-2xs font-semibold'
                : 'text-gray-600 hover:text-navy-900'
            }`}
          >
            Yopilgan
          </button>
        </div>
      </div>

      {/* Task List / States */}
      {loading ? (
        <div className="py-16 text-center text-xs text-gray-500 space-y-2">
          <RotateCw className="w-5 h-5 text-blue-600 animate-spin mx-auto" />
          <p>Topshiriqlar yuklanmoqda...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-xs text-red-700">{errorMsg}</p>
          <button
            onClick={fetchTasks}
            className="px-4 py-2 bg-navy-900 text-white rounded-xl text-xs font-semibold hover:bg-navy-800 transition"
          >
            Qayta urinish
          </button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 space-y-2">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="font-serif font-bold text-sm text-navy-950">
            Hozircha topshiriqlar mavjud emas
          </h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
            Tanlangan mezonlar bo'yicha e'lon qilingan topshiriqlar topilmadi. Tez orada yangi intellektual vazifalar e'lon qilinadi.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const isClosed = task.status === 'closed';
            const deadlineFormatted = formatDeadline(task.deadline_at || task.deadline);

            return (
              <div
                key={task.id}
                onClick={() => onSelectAssignment(task.id)}
                className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      {task.direction}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      {getSubmissionStatusBadge(task.my_submission_status)}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isClosed 
                          ? 'bg-gray-100 text-gray-600 border border-gray-200' 
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        {isClosed ? 'Yopilgan' : 'Faol'}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-serif font-bold text-sm text-navy-950 leading-snug">
                    {task.title}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                    {task.short_description || task.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 text-xs">
                  <div className="flex items-center space-x-1.5 text-gray-500 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>{deadlineFormatted}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">
                      {getDifficultyLabel(task.difficulty)}
                    </span>
                    <span className="font-bold text-navy-950">
                      {task.max_score} ball
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
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
