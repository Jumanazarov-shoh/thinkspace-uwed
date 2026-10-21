import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { api } from '../../services/api';
import { Submission, Assignment, Evaluation, RubricCriterion, StoredFile } from '../../types';
import { 
  FileCheck2, 
  ExternalLink, 
  Download, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Send, 
  RotateCcw,
  Sparkles,
  User,
  History,
  FileText
} from 'lucide-react';

interface AdminReviewWorkspacePageProps {
  initialSubmissionId?: number;
}

export const AdminReviewWorkspacePage: React.FC<AdminReviewWorkspacePageProps> = ({ initialSubmissionId }) => {
  const { t } = useTranslation();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(initialSubmissionId || null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Evaluation Form State
  const [criterionScores, setCriterionScores] = useState<Record<number, { score: number; comment: string }>>({});
  const [generalFeedback, setGeneralFeedback] = useState('');
  const [isRevisionRequested, setIsRevisionRequested] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');

  // Fetch list of submissions
  useEffect(() => {
    const fetchList = async () => {
      setLoading(true);
      try {
        const list = await api.getSubmissionsList();
        setSubmissions(list);
        if (list.length > 0 && !selectedSubId) {
          setSelectedSubId(list[0].id);
        }
      } catch (err) {
        console.error('Error fetching submissions list:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, []);

  // Fetch detailed submission data when selectedSubId changes
  useEffect(() => {
    if (!selectedSubId) return;

    const fetchDetail = async () => {
      try {
        const sub = await api.getSubmissionDetail(selectedSubId);
        setSubmission(sub);

        if (sub.assignment) {
          setAssignment(sub.assignment);
        } else {
          const ass = await api.getAssignment(sub.assignment_id);
          setAssignment(ass);
        }

        // Fetch existing evaluations
        const evals = await api.getEvaluations(selectedSubId);
        setEvaluations(evals);

        // Reset or prepopulate criterion scores based on active assignment rubric
        const initialScores: Record<number, { score: number; comment: string }> = {};
        const rubric = sub.assignment?.rubrics?.[0];
        if (rubric?.criteria) {
          rubric.criteria.forEach((c: RubricCriterion) => {
            initialScores[c.id] = { score: c.max_points, comment: '' };
          });
        }
        setCriterionScores(initialScores);
        setGeneralFeedback('');
        setIsRevisionRequested(false);
        setRevisionNotes('');
        setMessage(null);
      } catch (err) {
        console.error('Error fetching submission details:', err);
      }
    };

    fetchDetail();
  }, [selectedSubId]);

  const activeRubric = assignment?.rubrics?.[0];

  const handleScoreChange = (criterionId: number, scoreVal: number) => {
    setCriterionScores(prev => ({
      ...prev,
      [criterionId]: {
        score: scoreVal,
        comment: prev[criterionId]?.comment || ''
      }
    }));
  };

  const handleCommentChange = (criterionId: number, commentVal: string) => {
    setCriterionScores(prev => ({
      ...prev,
      [criterionId]: {
        score: prev[criterionId]?.score || 0,
        comment: commentVal
      }
    }));
  };

  const calculateTotalAwarded = () => {
    return Object.values(criterionScores).reduce((sum, item) => sum + (Number(item.score) || 0), 0);
  };

  const handleSubmitEvaluation = async (isDraft: boolean) => {
    if (!selectedSubId || !activeRubric) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        submission_id: selectedSubId,
        general_feedback: generalFeedback,
        is_revision_requested: isRevisionRequested,
        revision_notes: isRevisionRequested ? revisionNotes : undefined,
        is_draft: isDraft,
        criterion_scores: Object.entries(criterionScores).map(([critId, data]) => ({
          criterion_id: Number(critId),
          score: Number(data.score),
          comment: data.comment
        }))
      };

      await api.submitEvaluation(payload);
      setMessage({
        type: 'success',
        text: isDraft ? 'Draft saved successfully!' : 'Evaluation submitted officially!'
      });

      // Refresh evaluations
      const updatedEvals = await api.getEvaluations(selectedSubId);
      setEvaluations(updatedEvals);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to submit evaluation'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Workspace Header */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              Academic Review Workspace
            </span>
            <span className="text-xs text-gray-400">• Multi-Admin Double Blind Support</span>
          </div>
          <h1 className="text-xl font-serif font-bold text-navy-950 mt-1">
            Rubric Evaluation & Constructive Feedback
          </h1>
        </div>

        {/* Submissions Switcher */}
        <div className="flex items-center space-x-3 shrink-0 text-xs">
          <label className="text-gray-500 font-medium">Select Submission:</label>
          <select
            value={selectedSubId || ''}
            onChange={(e) => setSelectedSubId(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-navy-900 font-medium focus:ring-1 focus:ring-blue-600 focus:outline-none"
          >
            {submissions.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.id} — {s.user?.display_name || `User ${s.user_id}`} ({s.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
          Loading submission data...
        </div>
      ) : !submission ? (
        <div className="py-20 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
          No submission selected.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Submission Content & History (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Author & Task Header Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-900 font-serif font-bold flex items-center justify-center">
                    {submission.user?.display_name?.charAt(0) || 'M'}
                  </div>
                  <div>
                    <h2 className="font-semibold text-navy-950 text-sm">
                      {submission.user?.display_name || 'ThinkSpace Member'}
                    </h2>
                    <p className="text-xs text-gray-400">
                      {submission.user?.faculty || 'SIEM / UWED'} • ID: {submission.user?.student_id || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                    Version v{submission.version_number || 1}
                  </span>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : 'Recent'}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-medium text-blue-700 uppercase tracking-wide">
                  {assignment?.direction?.replace('_', ' ')}
                </span>
                <h3 className="font-serif font-bold text-base text-navy-950">
                  {assignment?.title}
                </h3>
              </div>

              {/* Text Submission Content */}
              {submission.text_content && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Member Written Work</span>
                  </span>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-800 leading-relaxed font-sans whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {submission.text_content}
                  </div>
                </div>
              )}

              {/* External Links */}
              {submission.link_url && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    External Reference Link:
                  </span>
                  <a
                    href={submission.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-xs text-blue-700 hover:text-blue-900 bg-blue-50 p-2.5 rounded-lg border border-blue-200 truncate"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span className="truncate">{submission.link_url}</span>
                  </a>
                </div>
              )}

              {/* Attached Files */}
              {submission.files && submission.files.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Submitted Documents & Attachments ({submission.files.length}):
                  </span>
                  <div className="space-y-2">
                    {submission.files.map((f: StoredFile) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                      >
                        <div className="flex items-center space-x-2 truncate pr-2">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="font-medium text-gray-800 truncate">{f.file_name || f.original_filename}</span>
                          <span className="text-gray-400">({(((f.file_size || f.file_size_bytes || 0) / 1024)).toFixed(1)} KB)</span>
                        </div>
                        <a
                          href={`/api/submissions/files/${f.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-blue-700 hover:text-blue-900 font-medium shrink-0 bg-white px-2.5 py-1 rounded border border-gray-300"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Peer Evaluators History (Double-Blind / Multi-Admin Audit) */}
            {evaluations.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                <h3 className="font-serif font-bold text-sm text-navy-950 flex items-center space-x-2 border-b border-gray-100 pb-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>Existing Evaluations ({evaluations.length})</span>
                </h3>
                <div className="space-y-3">
                  {evaluations.map((ev) => (
                    <div key={ev.id} className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-navy-900">
                          Evaluator: {ev.evaluator?.display_name || `Admin #${ev.evaluator_id}`}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-navy-950 bg-white px-2 py-0.5 rounded border border-gray-300">
                            {ev.total_score} / {assignment?.max_score} pts
                          </span>
                          {ev.is_draft && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              Draft
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-600 italic">"{ev.general_feedback}"</p>
                      {ev.is_revision_requested && (
                        <div className="text-amber-800 bg-amber-50 p-2 rounded text-[11px]">
                          <strong>Revision Requested:</strong> {ev.revision_notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Active Rubric Scoring Form (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6 sticky top-6">
            <div className="border-b border-gray-100 pb-3">
              <h2 className="font-serif font-bold text-base text-navy-950">
                Rubric Evaluation Form
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Assign scores within criterion limits and add actionable feedback
              </p>
            </div>

            {message && (
              <div className={`p-3 rounded-lg border text-xs flex items-center space-x-2 ${
                message.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            {/* Criteria List */}
            <div className="space-y-4">
              {activeRubric?.criteria?.map((crit: RubricCriterion) => {
                const currentData = criterionScores[crit.id] || { score: crit.max_points, comment: '' };
                return (
                  <div key={crit.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-navy-900 pr-2">{crit.title}</div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <input
                          type="number"
                          min={0}
                          max={crit.max_points}
                          value={currentData.score}
                          onChange={(e) => handleScoreChange(crit.id, Number(e.target.value))}
                          className="w-16 px-2 py-1 bg-white border border-gray-300 rounded font-mono font-bold text-center text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                        />
                        <span className="text-gray-400 font-mono">/ {crit.max_points}</span>
                      </div>
                    </div>
                    {crit.description && (
                      <p className="text-[11px] text-gray-500 leading-tight">
                        {crit.description}
                      </p>
                    )}
                    <input
                      type="text"
                      placeholder="Criterion-level comment (optional)..."
                      value={currentData.comment}
                      onChange={(e) => handleCommentChange(crit.id, e.target.value)}
                      className="w-full px-2.5 py-1 bg-white border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>

            {/* Live Total Score Pill */}
            <div className="bg-navy-950 text-white p-3.5 rounded-xl flex items-center justify-between text-xs font-mono">
              <span className="font-sans font-medium text-blue-200">Total Calculated Score:</span>
              <span className="text-base font-bold">
                {calculateTotalAwarded()} / {assignment?.max_score || 100} pts
              </span>
            </div>

            {/* General Feedback & Academic Critique */}
            <div className="space-y-1.5 text-xs">
              <label className="block font-medium text-gray-700">
                {t.admin.generalFeedback} *
              </label>
              <textarea
                rows={3}
                required
                value={generalFeedback}
                onChange={(e) => setGeneralFeedback(e.target.value)}
                placeholder="Provide comprehensive, encouraging intellectual feedback highlighting strengths and areas for analytical improvement..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none text-xs"
              />
            </div>

            {/* Revision Request Toggle */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2 text-xs">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="rev_req"
                  checked={isRevisionRequested}
                  onChange={(e) => setIsRevisionRequested(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-gray-300"
                />
                <label htmlFor="rev_req" className="font-semibold text-amber-900 cursor-pointer">
                  {t.admin.requestRevision}
                </label>
              </div>

              {isRevisionRequested && (
                <div className="pt-1">
                  <textarea
                    rows={2}
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    placeholder="Clearly specify required revisions before this work can be graded..."
                    className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded text-xs focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => handleSubmitEvaluation(true)}
                disabled={submitting}
                className="px-3.5 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg text-xs transition flex items-center space-x-1.5"
              >
                <Save className="w-3.5 h-3.5 text-gray-500" />
                <span>{t.admin.saveDraft}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmitEvaluation(false)}
                disabled={submitting || !generalFeedback.trim()}
                className="px-4 py-2 bg-navy-950 hover:bg-navy-900 disabled:bg-gray-300 text-white font-medium rounded-lg text-xs shadow-sm transition flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Submitting...' : t.admin.submitEvaluation}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
