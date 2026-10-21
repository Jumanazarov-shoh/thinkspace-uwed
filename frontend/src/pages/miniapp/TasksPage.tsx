import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { api } from '../../services/api';
import { Assignment, AssignmentDirection } from '../../types';
import { Calendar, Award, CheckCircle2, ChevronRight, Filter } from 'lucide-react';

interface TasksPageProps {
  onSelectAssignment: (assignmentId: number) => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({ onSelectAssignment }) => {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDirection, setSelectedDirection] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const directions: Array<{ id: string; label: string }> = [
    { id: 'all', label: t.common.all },
    { id: 'Think & Read', label: 'Read' },
    { id: 'Think & Discuss', label: 'Discuss' },
    { id: 'Think & Analyze', label: 'Analyze' },
    { id: 'Think & Lead', label: 'Lead' },
    { id: 'Think & Create', label: 'Create' },
    { id: 'Think & Connect', label: 'Connect' },
  ];

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const data = await api.getAssignments();
        setAssignments(data);
      } catch (e) {
        console.error('Failed to load assignments:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const filteredTasks = assignments.filter((task) => {
    if (selectedDirection !== 'all' && task.direction !== selectedDirection) {
      return false;
    }
    if (statusFilter !== 'all' && task.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-3.5">
      {/* Header */}
      <div>
        <h2 className="font-serif font-bold text-lg text-navy-900 leading-tight">
          {t.tasks.title}
        </h2>
        <p className="text-xs text-gray-500 font-sans mt-0.5">
          {t.tasks.subtitle}
        </p>
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
      <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
        <span className="font-medium text-gray-700">{filteredTasks.length} {t.nav.tasks.toLowerCase()}</span>
        <div className="flex space-x-2">
          {['all', 'open', 'closed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`capitalize px-2 py-0.5 rounded text-[11px] ${
                statusFilter === st
                  ? 'bg-blue-100 text-blue-800 font-semibold'
                  : 'hover:text-gray-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-500">{t.common.loading}</div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200 text-gray-500 text-xs">
          <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p>Hozircha ushbu yo'nalishda topshiriqlar mavjud emas.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onSelectAssignment(task.id)}
              className="bg-white rounded-xl p-3.5 border border-gray-200/90 shadow-2xs hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    {task.direction}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded capitalize ${
                    task.status === 'open' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {task.status}
                  </span>
                </div>

                <h3 className="font-serif font-bold text-sm text-navy-900 leading-snug">
                  {task.title}
                </h3>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {task.description}
                </p>
              </div>

              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 text-xs">
                <div className="flex items-center space-x-1 text-gray-500">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>{task.deadline_at ? new Date(task.deadline_at).toLocaleDateString() : 'Ongoing'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-amber-700">
                    {task.max_score} {t.common.points}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
