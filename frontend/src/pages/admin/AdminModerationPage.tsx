import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { api } from '../../services/api';
import { Submission, ReviewRequest, Evaluation } from '../../types';
import { 
  SlidersHorizontal, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  FileCheck2, 
  Send, 
  MessageSquare,
  Clock,
  RotateCcw,
  Sparkles,
  X
} from 'lucide-react';

export const AdminModerationPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'queue' | 'appeals'>('queue');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [appeals, setAppeals] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected Submission for Moderation Decision
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'override'>('approved');
  const [rationale, setRationale] = useState('');
  const [overrideScore, setOverrideScore] = useState<number | ''>('');

  // Selected Appeal for Resolution
  const [selectedAppeal, setSelectedAppeal] = useState<ReviewRequest | null>(null);
  const [appealAction, setAppealAction] = useState<'resolve' | 'reject'>('resolve');
  const [appealComment, setAppealComment] = useState('');
  const [adjustedScore, setAdjustedScore] = useState<number | ''>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subList, appList] = await Promise.all([
        api.getSubmissionsList(),
        api.listAppeals()
      ]);
      setSubmissions(subList);
      setAppeals(appList);
    } catch (err) {
      console.error('Error fetching moderation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModerationModal = async (sub: Submission) => {
    setSelectedSub(sub);
    setDecision('approved');
    setRationale('');
    setOverrideScore('');
    setMessage(null);

    try {
      const evals = await api.getEvaluations(sub.id);
      setEvaluations(evals);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecordDecision = async () => {
    if (!selectedSub) return;
    if (decision === 'override' && !rationale.trim()) {
      setMessage({ type: 'error', text: 'Rationale is required when overriding evaluator scores.' });
      return;
    }

    setActionLoading(true);
    try {
      await api.recordModerationDecision(selectedSub.id, {
        decision,
        rationale: rationale || 'Moderation approved standard evaluation.',
        override_score: overrideScore !== '' ? Number(overrideScore) : undefined
      });

      setMessage({ type: 'success', text: 'Moderator decision recorded successfully.' });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to record decision.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishGrade = async (submissionId: number) => {
    setActionLoading(true);
    setMessage(null);
    try {
      await api.publishGrade(submissionId);
      setMessage({ type: 'success', text: 'Official grade published! Leaderboard updated and member notified.' });
      setSelectedSub(null);
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to publish grade.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveAppeal = async () => {
    if (!selectedAppeal) return;
    if (!appealComment.trim()) {
      setMessage({ type: 'error', text: 'Resolution comment is required.' });
      return;
    }

    setActionLoading(true);
    try {
      await api.resolveAppeal(selectedAppeal.id, {
        action: appealAction,
        resolution_comment: appealComment,
        adjusted_score: appealAction === 'resolve' && adjustedScore !== '' ? Number(adjustedScore) : undefined
      });

      setMessage({ type: 'success', text: 'Appeal decision finalized and logged in audit records.' });
      setSelectedAppeal(null);
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to resolve appeal.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter queue for items needing moderation or evaluated
  const moderationQueue = submissions.filter(
    s => s.status === 'evaluated' || s.status === 'under_review' || (s.evaluations && s.evaluations.length > 0)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
              Academic Governance
            </span>
            <span className="text-xs text-gray-400">• Discrepancy Checks & Appeals</span>
          </div>
          <h1 className="text-xl font-serif font-bold text-navy-950 mt-1">
            Moderator Approval & Dispute Resolution
          </h1>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg bg-gray-100 p-1 text-xs shrink-0 font-medium">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeTab === 'queue' ? 'bg-white text-navy-950 shadow-xs' : 'text-gray-500 hover:text-navy-900'
            }`}
          >
            Moderation Queue ({moderationQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('appeals')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeTab === 'appeals' ? 'bg-white text-navy-950 shadow-xs' : 'text-gray-500 hover:text-navy-900'
            }`}
          >
            Student Appeals ({appeals.filter(a => a.status === 'pending').length} pending)
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border text-xs flex items-center space-x-2 ${
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

      {/* Tab 1: Moderation Queue */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
              Loading moderation queue...
            </div>
          ) : moderationQueue.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
              No submissions currently require moderation sign-off.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-5">Submission</th>
                    <th className="py-3.5 px-4">Author</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Evaluations</th>
                    <th className="py-3.5 px-4">Discrepancy Check</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-navy-900">
                  {moderationQueue.map((sub) => {
                    const evalsCount = sub.evaluations?.length || 0;
                    return (
                      <tr key={sub.id} className="hover:bg-gray-50/70 transition">
                        <td className="py-4 px-5">
                          <div className="font-semibold text-sm text-navy-950">
                            {sub.assignment?.title || `Assignment #${sub.assignment_id}`}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            Sub #{sub.id} • v{sub.version_number || 1} • {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Recent'}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-navy-950">{sub.user?.display_name || `User ${sub.user_id}`}</div>
                          <div className="text-[10px] text-gray-400">{sub.user?.student_id || 'SIEM'}</div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium uppercase ${
                            sub.status === 'published' ? 'bg-emerald-100 text-emerald-800' :
                            sub.status === 'evaluated' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {sub.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-medium">{evalsCount} recorded</div>
                          {sub.evaluations && sub.evaluations.length > 0 && (
                            <div className="text-[11px] text-gray-500 font-mono">
                              Scores: {sub.evaluations.map((e: Evaluation) => `${e.total_score}pt`).join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {/* Discrepancy indicator */}
                          {evalsCount >= 2 ? (
                            <span className="flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Consistent (within ±15%)</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[11px]">Single evaluator</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => openModerationModal(sub)}
                            className="bg-navy-900 hover:bg-navy-800 text-white font-medium px-3.5 py-1.5 rounded-lg text-xs transition"
                          >
                            Review & Publish
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Grade Appeals */}
      {activeTab === 'appeals' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
              Loading student appeals...
            </div>
          ) : appeals.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
              No grade appeals have been filed by members.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-5">Student & Grade</th>
                    <th className="py-3.5 px-4">Appeal Rationale</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Requested Date</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-navy-900">
                  {appeals.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-4 px-5">
                        <div className="font-semibold text-sm text-navy-950">
                          {app.user?.display_name || `Member #${app.user_id}`}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Grade #{app.published_grade_id} • Score: {app.published_grade?.final_score || 'N/A'} pts
                        </div>
                      </td>
                      <td className="py-4 px-4 max-w-md">
                        <p className="text-gray-700 italic line-clamp-2">"{app.reason}"</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium uppercase ${
                          app.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                          app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-400">
                        {new Date(app.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {app.status === 'pending' ? (
                          <button
                            onClick={() => {
                              setSelectedAppeal(app);
                              setAppealAction('resolve');
                              setAppealComment('');
                              setAdjustedScore(app.published_grade?.final_score || '');
                            }}
                            className="bg-navy-900 hover:bg-navy-800 text-white font-medium px-3.5 py-1.5 rounded-lg text-xs transition"
                          >
                            Resolve Appeal
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">Finalized</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Moderation Review & Decision Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden my-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-navy-950 text-white">
              <div>
                <h2 className="text-base font-serif font-bold">Moderation Governance Action</h2>
                <p className="text-xs text-blue-200">
                  Submission #{selectedSub.id} by {selectedSub.user?.display_name || `Member #${selectedSub.user_id}`}
                </p>
              </div>
              <button 
                onClick={() => setSelectedSub(null)}
                className="text-gray-300 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Evaluators comparison box */}
              <div className="space-y-2">
                <span className="font-semibold text-gray-700 uppercase tracking-wide">
                  Evaluator Scores Summary:
                </span>
                <div className="space-y-2">
                  {evaluations.map((ev) => (
                    <div key={ev.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-navy-950">{ev.evaluator?.display_name || `Evaluator #${ev.evaluator_id}`}</div>
                        <div className="text-gray-500 italic text-[11px]">"{ev.general_feedback}"</div>
                      </div>
                      <span className="font-mono font-bold text-navy-950 bg-white px-2.5 py-1 rounded border border-gray-300">
                        {ev.total_score} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision Type */}
              <div className="space-y-2">
                <label className="font-semibold text-gray-700 block">Moderator Decision</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['approved', 'rejected', 'override'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDecision(d)}
                      className={`p-2.5 rounded-lg border font-medium capitalize text-center transition ${
                        decision === d
                          ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Override Score Field */}
              {decision === 'override' && (
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Override Final Score *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    value={overrideScore}
                    onChange={(e) => setOverrideScore(Number(e.target.value))}
                    placeholder="Enter overridden score..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-mono"
                  />
                </div>
              )}

              {/* Rationale */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">
                  Moderator Rationale {decision === 'override' ? '*' : '(Optional)'}
                </label>
                <textarea
                  rows={3}
                  required={decision === 'override'}
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Explain why this decision is made or reason for score override..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleRecordDecision}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-navy-950 font-medium rounded-lg transition"
                >
                  Record Decision Only
                </button>

                <button
                  type="button"
                  onClick={() => handlePublishGrade(selectedSub.id)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-lg shadow-sm transition flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish Official Grade</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appeal Resolution Modal */}
      {selectedAppeal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full flex flex-col shadow-2xl border border-gray-200 overflow-hidden my-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-navy-950 text-white">
              <div>
                <h2 className="text-base font-serif font-bold">Resolve Grade Appeal</h2>
                <p className="text-xs text-blue-200">
                  Applicant: {selectedAppeal.user?.display_name || `Member #${selectedAppeal.user_id}`}
                </p>
              </div>
              <button 
                onClick={() => setSelectedAppeal(null)}
                className="text-gray-300 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
                <span className="font-semibold text-gray-700">Member's Reason for Appeal:</span>
                <p className="text-gray-600 italic">"{selectedAppeal.reason}"</p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Resolution Action</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAppealAction('resolve')}
                    className={`p-2.5 rounded-lg border font-medium text-center transition ${
                      appealAction === 'resolve'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-bold'
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    Adjust / Resolve Grade
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppealAction('reject')}
                    className={`p-2.5 rounded-lg border font-medium text-center transition ${
                      appealAction === 'reject'
                        ? 'bg-red-50 border-red-600 text-red-900 font-bold'
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    Uphold Original / Reject
                  </button>
                </div>
              </div>

              {appealAction === 'resolve' && (
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">New Adjusted Score</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={adjustedScore}
                    onChange={(e) => setAdjustedScore(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Resolution Comment *</label>
                <textarea
                  rows={3}
                  required
                  value={appealComment}
                  onChange={(e) => setAppealComment(e.target.value)}
                  placeholder="Official reasoning explaining the appeal outcome..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setSelectedAppeal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResolveAppeal}
                  disabled={actionLoading || !appealComment.trim()}
                  className="px-4 py-2 bg-navy-950 hover:bg-navy-900 text-white rounded-lg font-medium shadow-sm transition"
                >
                  Confirm Resolution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
