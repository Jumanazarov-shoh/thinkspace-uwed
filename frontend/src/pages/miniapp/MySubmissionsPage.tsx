import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { MySubmissionSummary } from '../../types';
import { 
  ArrowLeft, 
  FileText, 
  Link as LinkIcon, 
  Paperclip, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  RotateCw,
  FolderOpen
} from 'lucide-react';

interface MySubmissionsPageProps {
  onBack: () => void;
  onSelectAssignment: (assignmentId: number) => void;
}

export const MySubmissionsPage: React.FC<MySubmissionsPageProps> = ({
  onBack,
  onSelectAssignment,
}) => {
  const [submissions, setSubmissions] = useState<MySubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'draft' | 'late'>('all');

  const fetchMySubmissions = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getMySubmissions();
      setSubmissions(data);
    } catch (err: any) {
      console.error('Failed to load my submissions:', err);
      setErrorMsg(err.message || 'Mening topshiriqlarimni yuklab bo\'lmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMySubmissions();
  }, []);

  const filtered = submissions.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'submitted') return item.status === 'submitted';
    if (filter === 'draft') return item.status === 'draft';
    if (filter === 'late') return item.status === 'late' || item.is_late;
    return true;
  });

  const getStatusBadge = (status: string, isLate: boolean) => {
    if (status === 'draft') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          📝 Qoralama
        </span>
      );
    }
    if (status === 'late' || isLate) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          ⏰ Kechikkan
        </span>
      );
    }
    if (status === 'submitted') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          ✅ Topshirilgan
        </span>
      );
    }
    if (status === 'locked') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-200">
          🔒 Qulflangan
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1 text-xs text-navy-900 font-semibold hover:text-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Topshiriqlarga qaytish</span>
        </button>
      </div>

      <div>
        <h2 className="font-serif font-bold text-lg text-navy-950 leading-tight">
          Mening topshiriqlarim
        </h2>
        <p className="text-xs text-gray-500 font-sans mt-0.5">
          Siz qoralama qilgan va rasman topshirgan barcha intellektual ishlaringiz
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-xl font-medium transition ${
            filter === 'all'
              ? 'bg-navy-900 text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Barchasi ({submissions.length})
        </button>
        <button
          onClick={() => setFilter('submitted')}
          className={`px-3 py-1.5 rounded-xl font-medium transition ${
            filter === 'submitted'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Topshirilgan ({submissions.filter(s => s.status === 'submitted').length})
        </button>
        <button
          onClick={() => setFilter('draft')}
          className={`px-3 py-1.5 rounded-xl font-medium transition ${
            filter === 'draft'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Qoralama ({submissions.filter(s => s.status === 'draft').length})
        </button>
        <button
          onClick={() => setFilter('late')}
          className={`px-3 py-1.5 rounded-xl font-medium transition ${
            filter === 'late'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Kechikkan ({submissions.filter(s => s.status === 'late' || s.is_late).length})
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-gray-500 space-y-2">
          <RotateCw className="w-5 h-5 text-blue-600 animate-spin mx-auto" />
          <p>Topshiriqlaringiz yuklanmoqda...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-xs text-red-700">{errorMsg}</p>
          <button
            onClick={fetchMySubmissions}
            className="px-4 py-2 bg-navy-900 text-white rounded-xl text-xs font-semibold hover:bg-navy-800 transition"
          >
            Qayta urinish
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 space-y-2">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
            <FolderOpen className="w-5 h-5" />
          </div>
          <h3 className="font-serif font-bold text-sm text-navy-950">
            Hozircha topshirilgan ishlar yo'q
          </h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
            Faol topshiriqlar ro'yxatidan o'zingizga yoqqan yo'nalish bo'yicha vazifani tanlab javob yuboring.
          </p>
          <div className="pt-2">
            <button
              onClick={onBack}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
            >
              Topshiriqlarni ko'rish
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <div
              key={item.id}
              onClick={() => onSelectAssignment(item.assignment_id)}
              className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    {item.assignment_direction}
                  </span>
                  {getStatusBadge(item.status, item.is_late)}
                </div>

                <h3 className="font-serif font-bold text-sm text-navy-950 leading-snug">
                  {item.assignment_title}
                </h3>
              </div>

              {/* Badges / Included Types */}
              <div className="flex items-center space-x-2 text-[11px] text-gray-500">
                {item.has_text && (
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    <FileText className="w-3 h-3" />
                    <span>Matn</span>
                  </span>
                )}
                {item.has_link && (
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    <LinkIcon className="w-3 h-3" />
                    <span>Havola</span>
                  </span>
                )}
                {item.attachment_count > 0 && (
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                    <Paperclip className="w-3 h-3" />
                    <span>{item.attachment_count} ta fayl</span>
                  </span>
                )}
              </div>

              {/* Timestamps */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span>
                    {item.submitted_at 
                      ? `Topshirildi: ${new Date(item.submitted_at).toLocaleDateString('uz-UZ')}`
                      : `Saqlandi: ${new Date(item.updated_at).toLocaleDateString('uz-UZ')}`}
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-blue-700 font-semibold">
                  <span>Ochish</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
