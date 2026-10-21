import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { api } from '../../services/api';
import { Assignment, Submission } from '../../types';
import { 
  ArrowLeft, 
  Calendar, 
  Award, 
  Upload, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  MessageSquare,
  History,
  Send
} from 'lucide-react';

interface TaskDetailPageProps {
  assignmentId: number;
  onBack: () => void;
}

export const TaskDetailPage: React.FC<TaskDetailPageProps> = ({
  assignmentId,
  onBack,
}) => {
  const { t } = useTranslation();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  // Submission Form State
  const [textContent, setTextContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Appeal State
  const [appealReason, setAppealReason] = useState('');
  const [isAppealing, setIsAppealing] = useState(false);
  const [appealSent, setAppealSent] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const a = await api.getAssignment(assignmentId);
      setAssignment(a);
      const s = await api.getMySubmission(assignmentId);
      setSubmission(s);
    } catch (e) {
      console.error('Failed to load assignment details:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [assignmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!textContent && !linkUrl && !selectedFile) {
      setSubmitError('Iltimos, matn, havola yoki fayl kiriting.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      if (textContent) formData.append('text_content', textContent);
      if (linkUrl) formData.append('link_url', linkUrl);
      if (selectedFile) formData.append('files', selectedFile);

      await api.submitWork(assignmentId, formData);
      setSubmitSuccess(true);
      setTextContent('');
      setLinkUrl('');
      setSelectedFile(null);
      await loadData();
    } catch (err: any) {
      setSubmitError(err.message || 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAppeal = async (publishedGradeId: number) => {
    if (!appealReason || appealReason.length < 10) {
      alert('Apellyatsiya sababi kamida 10 ta belgidan iborat bo\'lishi shart.');
      return;
    }
    try {
      await api.appealGrade(publishedGradeId, appealReason);
      setAppealSent(true);
      setIsAppealing(false);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Apellyatsiya yuborishda xatolik');
    }
  };

  if (loading || !assignment) {
    return <div className="py-16 text-center text-xs text-gray-500">{t.common.loading}</div>;
  }

  const isGraded = submission?.status === 'published';
  const publishedGrade = submission?.published_grade;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center space-x-1.5 text-xs text-blue-700 hover:text-blue-900 font-semibold"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t.nav.tasks}</span>
      </button>

      {/* Assignment Header Card */}
      <div className="bg-white rounded-xl p-4 border border-gray-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
            {assignment.direction}
          </span>
          <span className="text-[11px] font-semibold text-amber-700 flex items-center space-x-1">
            <Award className="w-3.5 h-3.5" />
            <span>{assignment.max_score} {t.common.points}</span>
          </span>
        </div>

        <h1 className="font-serif font-bold text-lg text-navy-900 leading-snug">
          {assignment.title}
        </h1>

        <div className="flex items-center space-x-2 text-xs text-gray-500 pt-1 border-t border-gray-100">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span>{t.common.deadline}: <b>{assignment.deadline_at ? new Date(assignment.deadline_at).toLocaleString() : 'No strict deadline'}</b></span>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-tight">{t.tasks.instructions}</h4>
          <p className="text-xs text-gray-600 mt-1 whitespace-pre-line leading-relaxed font-sans">
            {assignment.instructions}
          </p>
        </div>

        {/* Reference Links if any */}
        {assignment.reference_links && assignment.reference_links.length > 0 && (
          <div className="pt-2">
            <h4 className="text-[11px] font-semibold text-gray-700 uppercase">{t.tasks.referenceLinks}</h4>
            <div className="space-y-1 mt-1">
              {assignment.reference_links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 text-xs text-blue-700 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{link.title || link.url}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rubric Criteria Table */}
      {assignment.active_rubric && (
        <div className="bg-white rounded-xl p-4 border border-gray-200/90 shadow-sm space-y-2">
          <h3 className="font-serif font-bold text-sm text-navy-900">
            {t.tasks.rubricTitle}
          </h3>
          <div className="space-y-2 pt-1">
            {assignment.active_rubric.criteria.map((crit) => (
              <div key={crit.id} className="p-2.5 rounded-lg bg-gray-50/80 border border-gray-200/60 flex items-start justify-between">
                <div className="pr-3">
                  <p className="font-serif font-semibold text-xs text-navy-900">{crit.title}</p>
                  {crit.description && (
                    <p className="text-[11px] text-gray-500 mt-0.5">{crit.description}</p>
                  )}
                </div>
                <span className="text-xs font-bold text-blue-800 shrink-0 bg-white px-2 py-0.5 rounded border border-blue-200">
                  {crit.max_points} {t.common.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Published Grade & Official Feedback Card */}
      {isGraded && publishedGrade && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-emerald-800 font-serif font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t.tasks.alreadyGraded}</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-serif font-extrabold text-emerald-900">
                {publishedGrade.final_score}
              </span>
              <span className="text-xs text-emerald-700 font-semibold">
                /{publishedGrade.max_score} ({publishedGrade.percentage}%)
              </span>
            </div>
          </div>

          {publishedGrade.overall_feedback && (
            <div className="bg-white/80 p-3 rounded-lg border border-emerald-100 text-xs text-gray-700">
              <p className="font-semibold text-gray-800 mb-1">{t.home.recentFeedback}:</p>
              <p className="whitespace-pre-line leading-relaxed">{publishedGrade.overall_feedback}</p>
            </div>
          )}

          {/* Appeal Section */}
          <div className="pt-1">
            {!isAppealing && !appealSent && (
              <button
                onClick={() => setIsAppealing(true)}
                className="text-xs text-emerald-800 hover:text-emerald-950 font-medium underline"
              >
                {t.tasks.appealGrade}
              </button>
            )}

            {isAppealing && (
              <div className="space-y-2 pt-2 border-t border-emerald-200/60">
                <textarea
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder={t.tasks.appealPlaceholder}
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleSendAppeal(publishedGrade.id)}
                    className="bg-emerald-800 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-900"
                  >
                    {t.tasks.sendAppeal}
                  </button>
                  <button
                    onClick={() => setIsAppealing(false)}
                    className="bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg font-medium"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              </div>
            )}

            {appealSent && (
              <p className="text-xs text-emerald-800 font-medium">
                ✅ Apellyatsiyangiz moderatorlarga yuborildi.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Submission Form (if not officially graded yet) */}
      {!isGraded && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 border border-gray-200/90 shadow-sm space-y-3">
          <h3 className="font-serif font-bold text-sm text-navy-900 flex items-center justify-between">
            <span>{submission ? t.tasks.resubmitWork : t.tasks.submitWork}</span>
            {submission && (
              <span className="text-[10px] font-mono text-gray-500 font-normal">
                {t.tasks.version} {submission.versions?.length || 1}
              </span>
            )}
          </h3>

          {submitError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {submitSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Ishingiz muvaffaqiyatli qabul qilindi!</span>
            </div>
          )}

          {/* Text input */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Matn / Insho / Tahlil:
            </label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder={t.tasks.textContentPlaceholder}
              rows={4}
              className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-700 font-sans"
            />
          </div>

          {/* External link input */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Tashqi havola (Google Docs, Drive, GitHub, maqola):
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={t.tasks.linkUrlPlaceholder}
              className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-700 font-sans"
            />
          </div>

          {/* File Upload Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Fayl yuklash (PDF, Word, Rasm):
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
              <input
                type="file"
                id="file-upload"
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
              />
              <label htmlFor="file-upload" className="cursor-pointer block">
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                <p className="text-xs font-medium text-gray-700">
                  {selectedFile ? selectedFile.name : t.tasks.dragDropText}
                </p>
                {selectedFile && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                )}
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center space-x-1.5 shadow-sm transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? t.common.loading : t.tasks.submitWork}</span>
          </button>
        </form>
      )}

      {/* Version History */}
      {submission && submission.versions && submission.versions.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-200/90 shadow-sm space-y-2.5">
          <div className="flex items-center space-x-1.5 text-navy-900 font-serif font-bold text-sm">
            <History className="w-4 h-4 text-blue-700" />
            <span>{t.tasks.versionsTitle}</span>
          </div>

          <div className="space-y-2 pt-1">
            {submission.versions.map((ver) => (
              <div key={ver.id} className="p-2.5 rounded-lg border border-gray-200/80 bg-gray-50/60 text-xs">
                <div className="flex items-center justify-between font-semibold text-gray-800">
                  <span>{t.tasks.version} #{ver.version_number}</span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    {new Date(ver.submitted_at).toLocaleString()}
                  </span>
                </div>
                {ver.text_content && (
                  <p className="text-gray-600 mt-1 line-clamp-2">{ver.text_content}</p>
                )}
                {ver.link_url && (
                  <a href={ver.link_url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline mt-1 block truncate">
                    🔗 {ver.link_url}
                  </a>
                )}
                {ver.files && ver.files.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {ver.files.map(f => (
                      <div key={f.id} className="flex items-center space-x-1 text-gray-500 text-[11px]">
                        <FileText className="w-3 h-3 text-gray-400" />
                        <span className="truncate">{f.original_filename}</span>
                        <span>({(((f.file_size_bytes || f.file_size || 0) / 1024)).toFixed(0)} KB)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
