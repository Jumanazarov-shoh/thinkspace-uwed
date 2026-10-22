import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { api } from '../../services/api';
import { Assignment, Rubric, RubricCriterion } from '../../types';
import { 
  Plus, 
  Layers, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Trash2, 
  Edit3,
  Send,
  Archive,
  Lock,
  RotateCcw,
  Sparkles,
  Filter,
  Search,
  ExternalLink,
  HelpCircle,
  BarChart2,
  FileCheck2,
  Scale
} from 'lucide-react';

const DIRECTIONS = [
  'Think & Read',
  'Think & Discuss',
  'Think & Analyze',
  'Think & Lead',
  'Think & Create',
  'Think & Connect'
];

export const AdminAssignmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDirection, setFilterDirection] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Confirmation Modal
  const [confirmAction, setConfirmAction] = useState<{
    type: 'publish' | 'close' | 'archive' | 'draft' | 'delete';
    assignmentId: number;
    title: string;
  } | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [direction, setDirection] = useState<string>('Think & Read');
  const [difficulty, setDifficulty] = useState<string>('intermediate');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [deadline, setDeadline] = useState('');
  const [maxScore, setMaxScore] = useState<number>(100);
  const [attachmentUrl, setAttachmentUrl] = useState('');

  // Rubric Modal States
  const [rubricModalAssignment, setRubricModalAssignment] = useState<Assignment | null>(null);
  const [rubricData, setRubricData] = useState<Rubric | null>(null);
  const [rubricLoading, setRubricLoading] = useState(false);
  const [newCritTitle, setNewCritTitle] = useState('');
  const [newCritDesc, setNewCritDesc] = useState('');
  const [newCritGuidance, setNewCritGuidance] = useState('');
  const [newCritMaxPoints, setNewCritMaxPoints] = useState<number>(20);
  const [isAddingCrit, setIsAddingCrit] = useState(false);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const data = await api.getAssignments();
      setAssignments(data);
    } catch (err: any) {
      console.error('Error fetching assignments:', err);
      setErrorMsg(err.message || 'Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const openCreateModal = () => {
    setEditingAssignment(null);
    setTitle('');
    setDirection('Think & Read');
    setDifficulty('intermediate');
    setDescription('');
    setInstructions('');
    setAttachmentUrl('');
    setMaxScore(100);
    
    // Default deadline: 7 days from now formatted for datetime-local
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    defaultDate.setHours(23, 59, 0, 0);
    const isoString = new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDeadline(isoString);

    setErrorMsg(null);
    setShowModal(true);
  };

  const openEditModal = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setTitle(assignment.title);
    setDirection(assignment.direction);
    setDifficulty(assignment.difficulty || 'intermediate');
    setDescription(assignment.description || assignment.short_description || '');
    setInstructions(assignment.instructions || '');
    setAttachmentUrl(assignment.attachment_url || '');
    setMaxScore(assignment.max_score || 100);

    const d = assignment.deadline_at || assignment.deadline;
    if (d) {
      const dateObj = new Date(d);
      const isoString = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setDeadline(isoString);
    } else {
      setDeadline('');
    }

    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSave = async (submitStatus: 'draft' | 'published') => {
    setErrorMsg(null);
    if (!title.trim()) {
      setErrorMsg('Topshiriq sarlavhasi kiritilishi shart (Title is required).');
      return;
    }
    if (!description.trim() || description.trim().length < 5) {
      setErrorMsg('Qisqa tavsif kamida 5 ta belgidan iborat bo\'lishi shart (Short description is required).');
      return;
    }
    if (!instructions.trim() || instructions.trim().length < 5) {
      setErrorMsg('To\'liq shartlar va ko\'rsatmalar kiritilishi shart (Instructions are required).');
      return;
    }
    if (!deadline) {
      setErrorMsg('Topshirish muddati (deadline) ko\'rsatilishi shart.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title: title.trim(),
        direction,
        difficulty,
        short_description: description.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        deadline_at: new Date(deadline).toISOString(),
        max_score: Number(maxScore),
        attachment_url: attachmentUrl.trim() || undefined,
        status: submitStatus,
      };

      if (editingAssignment) {
        await api.updateAssignment(editingAssignment.id, payload);
        setSuccessMsg(`"${title}" topshirig'i muvaffaqiyatli tahrirlandi.`);
      } else {
        await api.createAssignment(payload);
        setSuccessMsg(`"${title}" topshirig'i muvaffaqiyatli yaratildi.`);
      }

      setShowModal(false);
      await fetchAssignments();
    } catch (err: any) {
      setErrorMsg(err.message || 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!confirmAction) return;
    const { type, assignmentId, title } = confirmAction;
    try {
      if (type === 'publish') {
        await api.publishAssignment(assignmentId);
        setSuccessMsg(`"${title}" topshirig'i rasman e'lon qilindi.`);
      } else if (type === 'close') {
        await api.closeAssignment(assignmentId);
        setSuccessMsg(`"${title}" topshirig'i yopildi.`);
      } else if (type === 'archive') {
        await api.archiveAssignment(assignmentId);
        setSuccessMsg(`"${title}" topshirig'i arxivlandi.`);
      } else if (type === 'draft') {
        await api.revertAssignmentToDraft(assignmentId);
        setSuccessMsg(`"${title}" topshirig'i qoralamaga qaytarildi.`);
      } else if (type === 'delete') {
        await api.deleteAssignment(assignmentId);
        setSuccessMsg(`"${title}" topshirig'i o'chirildi.`);
      }
      setConfirmAction(null);
      await fetchAssignments();
    } catch (err: any) {
      alert(`Xatolik: ${err.message || 'Amalni bajarib bo\'lmadi'}`);
      setConfirmAction(null);
    }
  };

  const openRubricModal = async (assignment: Assignment) => {
    setRubricModalAssignment(assignment);
    setRubricLoading(true);
    try {
      const r = await api.getAssignmentRubric(assignment.id);
      setRubricData(r);
    } catch (e: any) {
      alert(e.message || "Rubrika ma'lumotlarini yuklab bo'lmadi");
    } finally {
      setRubricLoading(false);
    }
  };

  const handleAddCriterion = async () => {
    if (!rubricModalAssignment || !newCritTitle.trim() || newCritMaxPoints <= 0) {
      alert("Iltimos, mezon nomi va to'g'ri maksimal ballni kiriting.");
      return;
    }
    setIsAddingCrit(true);
    try {
      const crit = await api.addRubricCriterion(rubricModalAssignment.id, {
        title: newCritTitle.trim(),
        description: newCritDesc.trim() || undefined,
        guidance: newCritGuidance.trim() || undefined,
        max_points: Number(newCritMaxPoints)
      });
      setRubricData(prev => prev ? { ...prev, criteria: [...(prev.criteria || []), crit] } : null);
      setNewCritTitle('');
      setNewCritDesc('');
      setNewCritGuidance('');
      setNewCritMaxPoints(20);
      setSuccessMsg("Yangi baholash mezoni qo'shildi.");
    } catch (e: any) {
      alert(e.message || "Mezon qo'shishda xatolik yuz berdi");
    } finally {
      setIsAddingCrit(false);
    }
  };

  const handleDeleteCriterion = async (critId: number) => {
    if (!rubricModalAssignment) return;
    if (!window.confirm("Haqiqatan ham ushbu mezonni o'chirmoqchimisiz?")) return;
    try {
      await api.deleteRubricCriterion(rubricModalAssignment.id, critId);
      setRubricData(prev => prev ? { ...prev, criteria: prev.criteria.filter(c => c.id !== critId) } : null);
      setSuccessMsg("Mezon o'chirildi.");
    } catch (e: any) {
      alert(e.message || "Mezonni o'chirishda xatolik");
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    if (filterDirection !== 'all' && a.direction !== filterDirection) return false;
    if (filterStatus !== 'all') {
      if (filterStatus === 'published' && a.status !== 'published' && a.status !== 'open') return false;
      if (filterStatus !== 'published' && a.status !== filterStatus) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = a.title.toLowerCase().includes(q);
      const matchDesc = (a.description || a.short_description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
      case 'open':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Faol / E'lon qilingan</span>;
      case 'draft':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Qoralama (Draft)</span>;
      case 'closed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">Yopilgan (Closed)</span>;
      case 'archived':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">Arxivlangan</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const getDirectionBadge = (dir: string) => {
    return (
      <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-900 border border-blue-200">
        {dir}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-serif font-bold text-navy-950">Topshiriqlar Boshqaruvi</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800">Milestone 3</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
            ThinkSpace | UWED 6 yo'nalishi bo'yicha intellektual topshiriqlarni yaratish, qoralama holatida saqlash, e'lon qilish, muddatlarni boshqarish va arxivlash.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Yangi topshiriq yaratish</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-gray-500 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold text-gray-700">Filtrlar:</span>
          </div>

          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-navy-900 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
          >
            <option value="all">Barcha yo'nalishlar (All)</option>
            {DIRECTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-navy-900 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
          >
            <option value="all">Barcha holatlar (All Statuses)</option>
            <option value="published">Faol / E'lon qilingan</option>
            <option value="draft">Qoralamalar (Drafts)</option>
            <option value="closed">Yopilgan topshiriqlar</option>
            <option value="archived">Arxivlanganlar</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Topshiriq qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Assignment List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-xs text-gray-500">
          Topshiriqlar yuklanmoqda...
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-sm text-navy-950">Hech qanday topshiriq topilmadi</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Tanlangan filtrlar bo'yicha hech qanday topshiriq mavjud emas. Yangi topshiriq qo'shish uchun yuqoridagi tugmani bosing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssignments.map((a) => {
            const isClosed = a.status === 'closed';
            const isArchived = a.status === 'archived';
            const isDraft = a.status === 'draft';
            const isPublished = a.status === 'published' || a.status === 'open';

            const deadlineDate = a.deadline_at || a.deadline;
            const formattedDeadline = deadlineDate 
              ? new Date(deadlineDate).toLocaleString('uz-UZ', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                }) 
              : 'Belgilanmagan';

            return (
              <div 
                key={a.id} 
                className="bg-white rounded-2xl border border-gray-200 hover:border-blue-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between p-5 space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    {getDirectionBadge(a.direction)}
                    {getStatusBadge(a.status)}
                  </div>

                  <div>
                    <h3 className="font-serif font-bold text-base text-navy-950 leading-snug line-clamp-2">
                      {a.title}
                    </h3>
                    <p className="text-xs text-gray-600 font-sans mt-1.5 line-clamp-2 leading-relaxed">
                      {a.short_description || a.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between text-[11px] text-gray-500 gap-y-1">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>{formattedDeadline}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-navy-900">{a.max_score} ball</span>
                      {a.difficulty && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-gray-100 text-gray-600">
                          {a.difficulty}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditModal(a)}
                      className="flex items-center space-x-1 text-gray-600 hover:text-navy-900 bg-gray-50 hover:bg-gray-100 px-2 py-1.5 rounded-lg border border-gray-200 transition"
                      title="Tahrirlash"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Tahrir</span>
                    </button>
                    <button
                      onClick={() => openRubricModal(a)}
                      className="flex items-center space-x-1 text-blue-700 hover:bg-blue-50 px-2 py-1.5 rounded-lg border border-blue-200 transition font-medium"
                      title="Baholash mezonlari (Rubric)"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Rubrika</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-1">
                    {isDraft && (
                      <button
                        onClick={() => setConfirmAction({ type: 'publish', assignmentId: a.id, title: a.title })}
                        className="flex items-center space-x-1 text-emerald-700 hover:bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-200 transition font-medium"
                        title="E'lon qilish"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>E'lon qilish</span>
                      </button>
                    )}

                    {isPublished && (
                      <button
                        onClick={() => setConfirmAction({ type: 'close', assignmentId: a.id, title: a.title })}
                        className="flex items-center space-x-1 text-amber-700 hover:bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-200 transition font-medium"
                        title="Yopish"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Yopish</span>
                      </button>
                    )}

                    {(isPublished || isClosed) && (
                      <button
                        onClick={() => setConfirmAction({ type: 'archive', assignmentId: a.id, title: a.title })}
                        className="p-1.5 text-purple-700 hover:bg-purple-50 rounded-lg border border-purple-200 transition"
                        title="Arxivlash"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isArchived && (
                      <button
                        onClick={() => setConfirmAction({ type: 'draft', assignmentId: a.id, title: a.title })}
                        className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition"
                        title="Qoralamaga qaytarish"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isDraft && (
                      <button
                        onClick={() => setConfirmAction({ type: 'delete', assignmentId: a.id, title: a.title })}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition"
                        title="O'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl border border-gray-200 overflow-hidden my-8">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-[#F8F9FA]">
              <div>
                <h2 className="font-serif font-bold text-base text-navy-950">
                  {editingAssignment ? "Topshiriqni tahrirlash" : "Yangi intellektual topshiriq"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  ThinkSpace | UWED standart akademik topshirig'i
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-navy-900 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Topshiriq sarlavhasi (Title) *
                </label>
                <input
                  type="text"
                  placeholder="masalan: 'Why Nations Fail': Institutsional tahlil"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* Direction & Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    ThinkSpace Yo'nalishi (Direction) *
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white font-medium"
                  >
                    {DIRECTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Murakkablik darajasi (Difficulty)
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white font-medium"
                  >
                    <option value="beginner">Boshlang'ich (Beginner)</option>
                    <option value="intermediate">O'rtacha (Intermediate)</option>
                    <option value="advanced">Yuqori (Advanced)</option>
                  </select>
                </div>
              </div>

              {/* Deadline & Max Score */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Topshirish muddati (Deadline) *
                  </label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Maksimal ball (Max Score)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={maxScore}
                    onChange={(e) => setMaxScore(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white"
                  />
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Qisqa tavsif (Short Description) *
                </label>
                <textarea
                  rows={2}
                  placeholder="Mini App kartochkasida ko'rinadigan qisqacha mazmun..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none resize-none"
                />
              </div>

              {/* Full Instructions */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  To'liq topshiriq shartlari va ko'rsatmalar (Instructions) *
                </label>
                <textarea
                  rows={5}
                  placeholder="Talabalar nima qilishi kerak, qanday mezonlar asosida baholanadi, format qanday bo'lishi lozim..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* Attachment URL */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Qo'shimcha ilmiy material havolasi (Attachment / Reading Link)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/article.pdf yoki Google Drive havolasi"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition font-medium text-xs"
              >
                Bekor qilish
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSave('draft')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition font-semibold text-xs disabled:opacity-50"
                >
                  {submitting ? 'Saqlanmoqda...' : 'Qoralama (Draft) sifatida saqlash'}
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSave('published')}
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl shadow-xs transition font-semibold text-xs disabled:opacity-50"
                >
                  {submitting ? 'Saqlanmoqda...' : 'Darhol e\'lon qilish (Publish)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl border border-gray-200 p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
              <HelpCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-serif font-bold text-base text-navy-950">
                {confirmAction.type === 'publish' && "Topshiriqni e'lon qilishni tasdiqlaysizmi?"}
                {confirmAction.type === 'close' && "Topshiriqni yopishni tasdiqlaysizmi?"}
                {confirmAction.type === 'archive' && "Topshiriqni arxivlashni tasdiqlaysizmi?"}
                {confirmAction.type === 'draft' && "Qoralamaga qaytarishni tasdiqlaysizmi?"}
                {confirmAction.type === 'delete' && "Topshiriqni butunlay o'chirishni tasdiqlaysizmi?"}
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                "{confirmAction.title}"
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition font-medium text-xs"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleExecuteAction}
                className="flex-1 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl shadow-xs transition font-semibold text-xs"
              >
                Tasdiqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rubric Management Modal */}
      {rubricModalAssignment && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-serif font-bold text-base text-navy-950 flex items-center space-x-2">
                  <Scale className="w-5 h-5 text-blue-600" />
                  <span>Baholash mezonlari (Rubrika)</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  "{rubricModalAssignment.title}" — Maksimal ball: {rubricModalAssignment.max_score}
                </p>
              </div>
              <button
                onClick={() => setRubricModalAssignment(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {rubricLoading ? (
                <div className="py-12 text-center text-gray-400">
                  <RotateCcw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  <p>Mezonlar yuklanmoqda...</p>
                </div>
              ) : (
                <>
                  {/* Criteria List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-navy-950">Mavjud mezonlar:</h4>
                      <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                        Jami mezonlar yig'indisi: {(rubricData?.criteria || []).reduce((acc, c) => acc + c.max_points, 0)} ball
                      </span>
                    </div>

                    {(rubricData?.criteria || []).length === 0 ? (
                      <p className="text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center">
                        Ushbu topshiriq uchun alohida mezonlar belgilanmagan. Standart mezonlar qo'shishingiz mumkin.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {(rubricData?.criteria || []).map((crit, idx) => (
                          <div key={crit.id} className="p-3.5 rounded-xl border border-gray-200 bg-white shadow-2xs flex items-center justify-between">
                            <div className="space-y-0.5">
                              <p className="font-semibold text-navy-900 text-xs">
                                {idx + 1}. {crit.title}
                              </p>
                              {crit.description && (
                                <p className="text-gray-500 text-[11px]">{crit.description}</p>
                              )}
                              {crit.guidance && (
                                <p className="text-blue-600 text-[10px] italic">Ko'rsatma: {crit.guidance}</p>
                              )}
                            </div>
                            <div className="flex items-center space-x-3 shrink-0">
                              <span className="font-bold text-navy-950 text-xs bg-gray-100 px-2 py-1 rounded-lg">
                                {crit.max_points} ball
                              </span>
                              <button
                                onClick={() => handleDeleteCriterion(crit.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition"
                                title="O'chirish"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add New Criterion Section */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                    <h4 className="font-semibold text-navy-950 text-xs">Yangi mezon qo'shish:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-gray-600 block mb-0.5">Mezon nomi *</label>
                        <input
                          type="text"
                          placeholder="Masalan: Tahliliy chuqurlik (Analytical Depth)"
                          value={newCritTitle}
                          onChange={(e) => setNewCritTitle(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-gray-300 text-xs bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-600 block mb-0.5">Maks. ball *</label>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={newCritMaxPoints}
                          onChange={(e) => setNewCritMaxPoints(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-xl border border-gray-300 text-xs bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none text-center font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Tavsif (ixtiyoriy)</label>
                      <input
                        type="text"
                        placeholder="Ushbu mezon bo'yicha talabadan nima talab etiladi..."
                        value={newCritDesc}
                        onChange={(e) => setNewCritDesc(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-gray-300 text-xs bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Baholovchi uchun ko'rsatma (Guidance)</label>
                      <input
                        type="text"
                        placeholder="Masalan: 0-15: yuzaki, 16-25: asosli, 26-30: yuqori akademik daraja"
                        value={newCritGuidance}
                        onChange={(e) => setNewCritGuidance(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-gray-300 text-xs bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        disabled={isAddingCrit}
                        onClick={handleAddCriterion}
                        className="px-4 py-2 rounded-xl bg-navy-900 text-white font-semibold hover:bg-navy-800 transition text-xs flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Mezonni qo'shish</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50/50 rounded-b-3xl">
              <button
                onClick={() => setRubricModalAssignment(null)}
                className="px-5 py-2 bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold hover:bg-gray-300 transition"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
