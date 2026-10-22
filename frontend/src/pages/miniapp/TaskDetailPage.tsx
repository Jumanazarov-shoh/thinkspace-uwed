import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from '../../locales';
import { api } from '../../services/api';
import { Assignment, Submission, StoredFile, MemberResultResponse } from '../../types';
import { 
  ArrowLeft, 
  Clock, 
  Award, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  Info,
  UploadCloud,
  FileCheck,
  Send,
  Save,
  Trash2,
  Paperclip,
  Link as LinkIcon,
  File as FileIcon,
  Image as ImageIcon,
  Lock,
  RefreshCw,
  Check
} from 'lucide-react';

interface TaskDetailPageProps {
  assignmentId: number;
  onBack: () => void;
  onViewMySubmissions?: () => void;
}

export const TaskDetailPage: React.FC<TaskDetailPageProps> = ({
  assignmentId,
  onBack,
  onViewMySubmissions,
}) => {
  const { t } = useTranslation();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [memberResult, setMemberResult] = useState<MemberResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Form states
  const [textContent, setTextContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [a, sub, res] = await Promise.all([
        api.getAssignment(assignmentId),
        api.getMySubmission(assignmentId).catch(() => null),
        api.getMemberAssignmentResult(assignmentId).catch(() => null),
      ]);
      setAssignment(a);
      setSubmission(sub);
      setMemberResult(res);

      if (sub && sub.latest_version) {
        setTextContent(sub.latest_version.text_content || '');
        setLinkUrl(sub.latest_version.link_url || '');
      }
    } catch (e: any) {
      console.error('Failed to load assignment details:', e);
      setErrorMsg(e.message || 'Topshiriq ma\'lumotlarini yuklab bo\'lmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [assignmentId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      // Validate 10MB per file
      const oversized = filesArray.find(f => f.size > 10 * 1024 * 1024);
      if (oversized) {
        alert(`"${oversized.name}" fayli 10MB dan katta. Iltimos, kichikroq hajmda yuklang.`);
        return;
      }
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const removeSelectedFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDeleteExistingAttachment = async (fileId: number) => {
    if (!submission) return;
    if (!confirm("Haqiqatan ham ushbu biriktirilgan faylni o'chirmoqchimisiz?")) return;
    try {
      await api.deleteSubmissionAttachment(submission.id, fileId);
      setActionSuccessMsg("Fayl o'chirildi");
      setTimeout(() => setActionSuccessMsg(null), 3000);
      loadData();
    } catch (err: any) {
      alert(err.message || "Faylni o'chirishda xatolik yuz berdi");
    }
  };

  const handleSaveDraft = async () => {
    if (!textContent.trim() && !linkUrl.trim() && selectedFiles.length === 0) {
      alert("Qoralama sifatida saqlash uchun kamida matn, havola yoki fayl kiriting.");
      return;
    }

    setIsSavingDraft(true);
    setActionSuccessMsg(null);
    try {
      const fd = new FormData();
      if (textContent.trim()) fd.append('text_content', textContent.trim());
      if (linkUrl.trim()) fd.append('link_url', linkUrl.trim());
      selectedFiles.forEach(file => {
        fd.append('files', file);
      });

      const updated = await api.saveSubmissionDraft(assignmentId, fd);
      setSubmission(updated);
      setSelectedFiles([]);
      setActionSuccessMsg("Qoralama muvaffaqiyatli saqlandi! Ishingiz yo'qolmaydi.");
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (e: any) {
      alert(e.message || "Qoralamani saqlashda xatolik yuz berdi");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleFinalSubmit = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    setActionSuccessMsg(null);
    try {
      const fd = new FormData();
      if (textContent.trim()) fd.append('text_content', textContent.trim());
      if (linkUrl.trim()) fd.append('link_url', linkUrl.trim());
      selectedFiles.forEach(file => {
        fd.append('files', file);
      });

      const res = await api.submitAssignmentWork(assignmentId, fd);
      setSubmission(res);
      setSelectedFiles([]);
      const isLate = res.status === 'late' || res.is_late;
      setActionSuccessMsg(
        isLate
          ? "Topshiriq qabul qilindi, ammo muddat o'tganligi sababli 'Kechikkan' deb qayd etildi."
          : "Topshiriq muvaffaqiyatli topshirildi!"
      );
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (e: any) {
      alert(e.message || "Topshiriqni topshirishda xatolik yuz berdi");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-10 h-10 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
        <p className="text-xs text-gray-500 font-sans">Topshiriq ma'lumotlari yuklanmoqda...</p>
      </div>
    );
  }

  if (errorMsg || !assignment) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-serif font-bold text-base text-navy-950">Topshiriq topilmadi</h3>
          <p className="text-xs text-gray-600 mt-1 max-w-xs mx-auto">
            {errorMsg || 'Ushbu topshiriq mavjud emas yoki kirish huquqingiz cheklangan.'}
          </p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-navy-900 text-white rounded-xl text-xs font-semibold hover:bg-navy-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Topshiriqlarga qaytish</span>
        </button>
      </div>
    );
  }

  const isClosed = assignment.status === 'closed';
  const deadlineDate = assignment.deadline_at || assignment.deadline;
  const isPastDeadline = deadlineDate ? new Date() > new Date(deadlineDate) : false;
  const formattedDeadline = deadlineDate 
    ? new Date(deadlineDate).toLocaleString('uz-UZ', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }) 
    : 'Belgilanmagan';

  const isLocked = submission?.status === 'locked';
  const isSubmitted = submission && (submission.status === 'submitted' || submission.status === 'late');
  const isDraft = submission && submission.status === 'draft';

  const getDifficultyText = (diff?: string) => {
    switch (diff) {
      case 'beginner': return "Boshlang'ich (Beginner)";
      case 'advanced': return "Yuqori (Advanced)";
      case 'intermediate':
      default: return "O'rtacha (Intermediate)";
    }
  };

  const existingFiles = submission?.latest_version?.files || [];

  return (
    <div className="space-y-4 pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1 text-xs text-navy-900 font-semibold hover:text-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Barcha topshiriqlar</span>
        </button>
        {onViewMySubmissions && (
          <button
            onClick={onViewMySubmissions}
            className="text-xs text-blue-700 font-semibold hover:underline"
          >
            Mening topshiriqlarim
          </button>
        )}
      </div>

      {/* Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] uppercase font-bold tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
            {assignment.direction}
          </span>
          <div className="flex items-center gap-1.5">
            {submission && (
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                submission.status === 'submitted'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : submission.status === 'late'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : submission.status === 'draft'
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-gray-100 text-gray-800 border border-gray-200'
              }`}>
                {submission.status === 'submitted' && '✅ Topshirilgan'}
                {submission.status === 'late' && '⏰ Kechikkan'}
                {submission.status === 'draft' && '📝 Qoralama'}
                {submission.status === 'locked' && '🔒 Qulflangan'}
              </span>
            )}
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
              isClosed
                ? 'bg-gray-100 text-gray-700 border border-gray-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}>
              {isClosed ? 'Yopilgan' : 'Faol'}
            </span>
          </div>
        </div>

        <h1 className="font-serif font-bold text-lg text-navy-950 leading-tight">
          {assignment.title}
        </h1>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 text-xs">
          <div className="flex items-center space-x-1 text-gray-600">
            <Award className="w-4 h-4 text-amber-600" />
            <span>Maksimal ball: <strong className="text-navy-950">{assignment.max_score}</strong></span>
          </div>
          <div className="flex items-center space-x-1 text-gray-600">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
              {getDifficultyText(assignment.difficulty)}
            </span>
          </div>
        </div>
      </div>

      {/* Deadline Info Banner */}
      <div className={`p-4 rounded-2xl border flex items-center space-x-3 text-xs ${
        isClosed 
          ? 'bg-gray-50 border-gray-200 text-gray-700' 
          : isPastDeadline
          ? 'bg-amber-50/80 border-amber-200 text-amber-950'
          : 'bg-blue-50/70 border-blue-200 text-navy-950'
      }`}>
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-2xs">
          <Clock className={`w-4 h-4 ${isPastDeadline ? 'text-amber-600' : 'text-blue-600'}`} />
        </div>
        <div>
          <p className="font-semibold">
            {isPastDeadline ? "Topshirish muddati o'tib ketgan" : "Topshirish muddati (Deadline)"}
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">
            {formattedDeadline} {isPastDeadline && "(Kechikkan topshiriq sifatida qabul qilinadi)"}
          </p>
        </div>
      </div>

      {/* Full Instructions */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span>Topshiriq shartlari va ko'rsatmalar</span>
        </div>
        <div className="text-xs text-gray-800 font-sans leading-relaxed whitespace-pre-line bg-gray-50/50 p-4 rounded-xl border border-gray-100">
          {assignment.instructions || assignment.description}
        </div>
      </div>

      {/* Attachment / Reference link if any */}
      {assignment.attachment_url && (
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-1.5">
          <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
            <span>Biriktirilgan ilmiy manba</span>
          </div>
          <a
            href={assignment.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 text-xs text-blue-700 hover:text-blue-900 font-semibold underline break-all"
          >
            <span>{assignment.attachment_url}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>
      )}

      {/* Active Rubric Criteria Preview */}
      {assignment.active_rubric && assignment.active_rubric.criteria.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <FileCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Baholash mezonlari (Rubric)</span>
          </div>
          <div className="space-y-2">
            {assignment.active_rubric.criteria.map((crit, idx) => (
              <div 
                key={crit.id || idx}
                className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs"
              >
                <div>
                  <h4 className="font-semibold text-navy-950">{crit.title}</h4>
                  {crit.description && (
                    <p className="text-[11px] text-gray-500 mt-0.5">{crit.description}</p>
                  )}
                </div>
                <span className="font-bold text-navy-900 bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-2xs ml-3 shrink-0">
                  {crit.max_points} ball
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Banner */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center space-x-2 text-xs animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{actionSuccessMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MILESTONE 5: OFFICIAL ACADEMIC EVALUATION RESULTS & STATUS               */}
      {/* ========================================================================= */}
      {memberResult && memberResult.is_finalized ? (
        <div className="bg-gradient-to-br from-navy-900 to-navy-950 text-white rounded-2xl p-6 shadow-xl border border-gold-500/30 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gold-500/20 flex items-center justify-center border border-gold-400/40">
                <Award className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-gold-300">
                  Rasmiy Baholash Natijasi
                </h3>
                <p className="text-[11px] text-gray-400">
                  {memberResult.finalized_at 
                    ? `${new Date(memberResult.finalized_at).toLocaleDateString('uz-UZ')} da tasdiqlangan`
                    : 'Tasdiqlangan baho'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-serif font-black text-gold-300">
                {memberResult.score ?? memberResult.final_score} <span className="text-sm font-sans font-normal text-gray-400">/ {memberResult.max_score}</span>
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-gold-400/20 text-gold-300 text-[11px] font-bold border border-gold-400/30">
                {memberResult.percentage != null ? memberResult.percentage.toFixed(1) : 0}%
              </span>
            </div>
          </div>

          {/* Official Feedback */}
          {(memberResult.feedback || memberResult.overall_feedback) && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-1.5">
              <span className="text-[11px] font-bold text-gold-400 uppercase tracking-wider">
                Ekspertlar xulosasi va rasmiy tavsiyalar:
              </span>
              <p className="text-xs text-gray-200 leading-relaxed italic">
                "{memberResult.feedback || memberResult.overall_feedback}"
              </p>
            </div>
          )}

          {/* Criteria Breakdown */}
          {((memberResult.criteria_scores && memberResult.criteria_scores.length > 0) || 
            (memberResult.criteria_breakdown && memberResult.criteria_breakdown.length > 0)) && (
            <div className="space-y-3 pt-1">
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Mezonlar bo'yicha tahlil (Rubric Breakdown):
              </h4>
              <div className="space-y-2.5">
                {(memberResult.criteria_scores || memberResult.criteria_breakdown || []).map((crit: any) => {
                  const scoreVal = crit.score ?? 0;
                  const maxPts = Math.max(crit.max_points ?? 1, 1);
                  const pct = Math.round((scoreVal / maxPts) * 100);
                  return (
                    <div key={crit.criterion_id} className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-200">{crit.title}</span>
                        <span className="font-bold text-gold-400">
                          {scoreVal} / {crit.max_points} ball ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-gold-400 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} 
                        />
                      </div>
                      {crit.comment && (
                        <p className="text-[11px] text-gray-400 italic pt-0.5">
                          Tavsiya: {crit.comment}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
            <span>Holat: <strong>Yakunlangan (Finalized)</strong></span>
            <span className="text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Rasmiy tasdiqlandi
            </span>
          </div>
        </div>
      ) : isSubmitted ? (
        <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-2xl p-5 border border-blue-200/80 text-blue-950 flex items-start space-x-3.5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center border border-blue-300/50 shrink-0 text-blue-700">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif font-bold text-sm text-navy-950">
              Topshiriq ko'rib chiqilmoqda (Under Evaluation)
            </h3>
            <p className="text-xs text-blue-900 leading-relaxed">
              Sizning javobingiz qabul qilindi va ayni paytda ThinkSpace baholovchilari tomonidan baholash mezonlari (rubric) asosida xolisona tekshirilmoqda. Moderator tasdiqlaganidan so'ng rasmiy natijalar shu yerda e'lon qilinadi.
            </p>
            <div className="pt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-300">
                Holati: Baholash jarayonida
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* MILESTONE 4: MEMBER SUBMISSION WORKSPACE                                  */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-2">
            <UploadCloud className="w-5 h-5 text-blue-600" />
            <h2 className="font-serif font-bold text-sm text-navy-950">
              Sizning javobingiz (Submission)
            </h2>
          </div>
          {submission && (
            <span className="text-[11px] text-gray-500 font-medium">
              Versiya #{submission.latest_version?.version_number || 1}
            </span>
          )}
        </div>

        {/* Status Callout if already submitted */}
        {isSubmitted && (
          <div className={`p-4 rounded-xl border text-xs space-y-1 ${
            submission?.is_late 
              ? 'bg-amber-50/70 border-amber-200 text-amber-950' 
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex items-center space-x-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {submission?.is_late ? "Topshiriq kechikib topshirilgan" : "Topshiriq rasman topshirilgan"}
              </span>
            </div>
            {submission?.submitted_at && (
              <p className="text-[11px] text-gray-600">
                Topshirilgan vaqt: {new Date(submission.submitted_at).toLocaleString('uz-UZ')}
              </p>
            )}
            {!isLocked && !isClosed && (
              <p className="text-[11px] text-gray-500 pt-1">
                Topshiriq hali yopilmagan. Kerak bo'lsa javobingizni tahrirlab qayta yuborishingiz mumkin.
              </p>
            )}
          </div>
        )}

        {isDraft && (
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-950 text-xs flex items-center space-x-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Bu topshiriq hozirda <strong>Qoralama (Draft)</strong> holatida. Rasman tekshiruvga yuborish uchun pastdagi <strong>"Topshiriqni topshirish"</strong> tugmasini bosing.
            </span>
          </div>
        )}

        {isLocked && (
          <div className="p-3.5 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 text-xs flex items-center space-x-2">
            <Lock className="w-4 h-4 text-gray-500 shrink-0" />
            <span>Ushbu topshiriq qulflangan. Javobni o'zgartirish yoki qayta topshirish taqiqlangan.</span>
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          {/* 1. Text Content */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-gray-700 flex items-center space-x-1">
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                <span>Yozma javob (Matn)</span>
              </label>
              <span className="text-[11px] text-gray-400">
                {textContent.length} / 25 000 belgi
              </span>
            </div>
            <textarea
              disabled={isLocked || isClosed}
              rows={5}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Javobingizni, tahlil xulosalarini yoki topshiriq yechimini bu yerga yozing..."
              className="w-full text-xs font-sans rounded-xl border border-gray-200 p-3 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 transition leading-relaxed"
            />
          </div>

          {/* 2. Link URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 flex items-center space-x-1">
              <LinkIcon className="w-3.5 h-3.5 text-gray-400" />
              <span>Havola / Manba (URL)</span>
            </label>
            <input
              type="url"
              disabled={isLocked || isClosed}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://google.com/... yoki https://github.com/..."
              className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 transition"
            />
            <p className="text-[10px] text-gray-400">
              Google Drive, Notion, GitHub yoki maqola havolasini qoldirishingiz mumkin.
            </p>
          </div>

          {/* 3. Existing Attachments List */}
          {existingFiles.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700">
                Yuklangan fayllar ({existingFiles.length}):
              </p>
              <div className="space-y-1.5">
                {existingFiles.map((f: StoredFile) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <FileIcon className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-medium text-gray-800 truncate">
                        {f.original_filename || f.file_name}
                      </span>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        ({Math.round((f.file_size_bytes || f.file_size || 0) / 1024)} KB)
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 ml-2 shrink-0">
                      <a
                        href={f.download_url || `/api/submissions/files/${f.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="p-1 text-blue-600 hover:text-blue-800"
                        title="Yuklab olish"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      {!isLocked && !isClosed && (
                        <button
                          type="button"
                          onClick={() => handleDeleteExistingAttachment(f.id)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Faylni o'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. New Files to Upload */}
          {!isLocked && !isClosed && (
            <div className="space-y-2 pt-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                accept=".pdf,.docx,.xlsx,.pptx,.txt,.doc,.jpg,.jpeg,.png,.webp"
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition space-y-1"
              >
                <UploadCloud className="w-6 h-6 text-blue-600 mx-auto" />
                <p className="text-xs font-semibold text-navy-950">
                  Fayl yoki rasm biriktirish
                </p>
                <p className="text-[10px] text-gray-400">
                  PDF, DOCX, XLSX, PPTX, TXT yoki rasmlar (Maksimal 10 MB)
                </p>
              </div>

              {/* Selected Files Ready for Upload */}
              {selectedFiles.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-semibold text-gray-600">
                    Yuklashga tanlangan fayllar ({selectedFiles.length}):
                  </p>
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-blue-50/50 border border-blue-100 text-xs"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Paperclip className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-medium text-navy-950 truncate">{file.name}</span>
                        <span className="text-[10px] text-gray-500 shrink-0">
                          ({Math.round(file.size / 1024)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(idx)}
                        className="text-red-500 hover:text-red-700 p-1 ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isLocked && !isClosed ? (
          <div className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-gray-100">
            <button
              type="button"
              disabled={isSavingDraft || isSubmitting}
              onClick={handleSaveDraft}
              className="flex-1 inline-flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 transition shadow-2xs"
            >
              {isSavingDraft ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-600" />
                  <span>Saqlanmoqda...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-gray-600" />
                  <span>Qoralama sifatida saqlash</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isSubmitting || isSavingDraft}
              onClick={() => {
                if (!textContent.trim() && !linkUrl.trim() && selectedFiles.length === 0 && existingFiles.length === 0) {
                  alert("Topshiriqni yuborish uchun kamida bitta javob turini (matn, havola yoki fayl) taqdim eting.");
                  return;
                }
                setShowConfirmModal(true);
              }}
              className="flex-1 inline-flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Yuborilmoqda...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitted ? "Qayta topshirish" : "Topshiriqni topshirish"}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 rounded-xl">
            {isClosed ? "Topshiriq qabul qilish yakunlangan." : "Topshiriq qulflangan."}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Send className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-serif font-bold text-base text-navy-950">
                Topshiriqni topshirasizmi?
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {isPastDeadline ? (
                  <span className="text-amber-700 font-semibold block">
                    Diqqat! Topshirish muddati o'tgan. Ishingiz "Kechikkan" holatida qayd etiladi.
                  </span>
                ) : (
                  "Javobingiz tekshirish uchun yuboriladi."
                )}
                Davom etishni tasdiqlaysizmi?
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2 px-3 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="flex-1 py-2 px-3 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition"
              >
                Ha, topshirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
