import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User, Submission } from '../../types';
import { 
  FileText, 
  Search, 
  ExternalLink, 
  Paperclip, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  RotateCw, 
  FolderOpen,
  X,
  User as UserIcon,
  ShieldAlert,
  UserPlus,
  Scale,
  Award,
  Lock,
  Save,
  Send,
  AlertTriangle,
  FileCheck2,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';

export const AdminSubmissionsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [assignModalSub, setAssignModalSub] = useState<any | null>(null);
  const [availableEvaluators, setAvailableEvaluators] = useState<User[]>([]);
  const [selectedEvaluatorId, setSelectedEvaluatorId] = useState<number | null>(null);

  // Rubric Scoring Modal
  const [scoringModalSub, setScoringModalSub] = useState<any | null>(null);
  const [evaluationContext, setEvaluationContext] = useState<any | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [criterionScores, setCriterionScores] = useState<Record<number, { score: number; comment: string }>>({});
  const [generalFeedback, setGeneralFeedback] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);

  // Senior Review Modal
  const [seniorModalSub, setSeniorModalSub] = useState<any | null>(null);
  const [seniorScore, setSeniorScore] = useState<number>(0);
  const [seniorRationale, setSeniorRationale] = useState('');
  const [seniorInternalNotes, setSeniorInternalNotes] = useState('');
  const [escalateToMod, setEscalateToMod] = useState(false);
  const [isSubmittingSenior, setIsSubmittingSenior] = useState(false);

  // Moderator Finalize Modal
  const [modModalSub, setModModalSub] = useState<any | null>(null);
  const [modFinalScore, setModFinalScore] = useState<number>(0);
  const [modRationale, setModRationale] = useState('');
  const [isSubmittingMod, setIsSubmittingMod] = useState(false);

  // Read-only Inspection modal
  const [inspectDetail, setInspectDetail] = useState<Submission | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getAdminEvaluationsOverview(
        statusFilter !== 'all' ? { review_status: statusFilter } : undefined
      );
      setItems(data);
    } catch (err: any) {
      console.error('Failed to load admin evaluations overview:', err);
      // Fallback to submissions overview if needed
      try {
        const fallback = await api.getAdminSubmissionsOverview();
        setItems(fallback);
      } catch (fErr: any) {
        setErrorMsg(fErr.message || 'Topshirilgan ishlarni yuklab bo\'lmadi');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [statusFilter]);

  // Load evaluators for assignment modal
  useEffect(() => {
    const loadEvaluators = async () => {
      try {
        const members = await api.listMembers('approved');
        // Filter members that have evaluator/senior_reviewer/moderator/super_admin roles
        const evals = members.filter(m => 
          m.roles && m.roles.some(r => ['evaluator', 'senior_reviewer', 'moderator', 'super_admin'].includes(r.role_name))
        );
        setAvailableEvaluators(evals);
        if (evals.length > 0) setSelectedEvaluatorId(evals[0].id);
      } catch (e) {
        console.error('Failed to load evaluators:', e);
      }
    };
    loadEvaluators();
  }, []);

  // Open Inspection
  const openInspection = async (subId: number) => {
    setInspectLoading(true);
    try {
      const detail = await api.getSubmissionDetail(subId);
      setInspectDetail(detail);
    } catch (err: any) {
      alert(err.message || 'Tafsilotlarni yuklab bo\'lmadi');
    } finally {
      setInspectLoading(false);
    }
  };

  // Open Rubric Scoring
  const openScoring = async (sub: any) => {
    setScoringModalSub(sub);
    setContextLoading(true);
    try {
      const ctx = await api.getEvaluationContext(sub.submission_id || sub.id);
      setEvaluationContext(ctx);

      // Pre-fill existing evaluation if available
      const myEval = ctx.evaluations && ctx.evaluations.length > 0 ? ctx.evaluations[0] : null;
      if (myEval) {
        setGeneralFeedback(myEval.general_feedback || '');
        setInternalNotes(myEval.internal_notes || '');
        const scoreMap: Record<number, { score: number; comment: string }> = {};
        for (const cs of myEval.criterion_scores || []) {
          scoreMap[cs.criterion_id] = { score: cs.score, comment: cs.comment || '' };
        }
        setCriterionScores(scoreMap);
      } else {
        setGeneralFeedback('');
        setInternalNotes('');
        const scoreMap: Record<number, { score: number; comment: string }> = {};
        for (const crit of (ctx.rubric?.criteria || [])) {
          scoreMap[crit.id] = { score: 0, comment: '' };
        }
        setCriterionScores(scoreMap);
      }
    } catch (err: any) {
      alert(err.message || 'Baholash ma\'lumotlarini yuklab bo\'lmadi');
      setScoringModalSub(null);
    } finally {
      setContextLoading(false);
    }
  };

  // Submit Rubric Evaluation (Draft or Final)
  const handleSubmitEvaluation = async (isDraft: boolean) => {
    if (!scoringModalSub || !evaluationContext) return;
    const subId = scoringModalSub.submission_id || scoringModalSub.id;

    if (!isDraft && (!generalFeedback.trim() || generalFeedback.trim().length < 5)) {
      alert('Iltimos, umumiy xulosa va fikringizni yozing (kamida 5 belgi).');
      return;
    }

    const payloadCriterionScores = Object.entries(criterionScores).map(([critId, val]) => ({
      criterion_id: Number(critId),
      score: Number(val.score),
      comment: val.comment
    }));

    setIsSubmittingScore(true);
    try {
      await api.submitOrDraftEvaluation({
        submission_id: subId,
        general_feedback: generalFeedback.trim() || 'Qoralama baholash',
        internal_notes: internalNotes.trim() || undefined,
        is_draft: isDraft,
        criterion_scores: payloadCriterionScores
      });
      setSuccessMsg(isDraft ? 'Baholash qoralamasi saqlandi.' : 'Baholash muvaffaqiyatli topshirildi!');
      setScoringModalSub(null);
      await fetchOverview();
    } catch (err: any) {
      alert(err.message || 'Baholashni saqlashda xatolik');
    } finally {
      setIsSubmittingScore(false);
    }
  };

  // Assign Evaluator
  const handleAssignEvaluator = async () => {
    if (!assignModalSub || !selectedEvaluatorId) return;
    const subId = assignModalSub.submission_id || assignModalSub.id;
    try {
      await api.assignEvaluator(subId, selectedEvaluatorId);
      setSuccessMsg("Baholovchi muvaffaqiyatli biriktirildi.");
      setAssignModalSub(null);
      await fetchOverview();
    } catch (e: any) {
      alert(e.message || "Baholovchini biriktirib bo'lmadi");
    }
  };

  // Remove Evaluator
  const handleRemoveEvaluator = async (evaluatorId: number) => {
    if (!assignModalSub) return;
    const subId = assignModalSub.submission_id || assignModalSub.id;
    try {
      await api.removeEvaluator(subId, evaluatorId);
      setSuccessMsg("Baholovchi topshiriqdan olib tashlandi.");
      // update modal
      setAssignModalSub((prev: any) => ({
        ...prev,
        assigned_evaluators: (prev.assigned_evaluators || []).filter((e: any) => e.evaluator_id !== evaluatorId)
      }));
      await fetchOverview();
    } catch (e: any) {
      alert(e.message || "Olib tashlashda xatolik");
    }
  };

  // Senior Review submit
  const handleSubmitSeniorReview = async () => {
    if (!seniorModalSub) return;
    const subId = seniorModalSub.submission_id || seniorModalSub.id;
    if (!seniorRationale.trim() || seniorRationale.trim().length < 5) {
      alert("Iltimos, katta tekshiruv xulosasini asoslab bering.");
      return;
    }
    setIsSubmittingSenior(true);
    try {
      await api.submitSeniorReview(subId, {
        recommended_score: Number(seniorScore),
        rationale: seniorRationale.trim(),
        internal_notes: seniorInternalNotes.trim() || undefined,
        escalate_to_moderator: escalateToMod
      });
      setSuccessMsg(escalateToMod ? "Ish moderator ko'rib chiqishiga yo'naltirildi." : "Katta tekshiruv xulosasi qabul qilindi.");
      setSeniorModalSub(null);
      await fetchOverview();
    } catch (e: any) {
      alert(e.message || "Katta tekshiruvni saqlashda xatolik");
    } finally {
      setIsSubmittingSenior(false);
    }
  };

  // Moderator Finalize submit
  const handleSubmitModeratorDecision = async () => {
    if (!modModalSub) return;
    const subId = modModalSub.submission_id || modModalSub.id;
    if (!modRationale.trim() || modRationale.trim().length < 5) {
      alert("Iltimos, rasmiy xulosani yozing.");
      return;
    }
    setIsSubmittingMod(true);
    try {
      await api.finalizeEvaluation(subId, {
        final_score: Number(modFinalScore),
        rationale: modRationale.trim()
      });
      setSuccessMsg("Topshiriq rasmiy yakunlandi va a'zo uchun e'lon qilindi!");
      setModModalSub(null);
      await fetchOverview();
    } catch (e: any) {
      alert(e.message || "Yakunlashda xatolik");
    } finally {
      setIsSubmittingMod(false);
    }
  };

  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    const name = (item.member_name || item.user_name || '').toLowerCase();
    const title = (item.assignment_title || '').toLowerCase();
    return name.includes(q) || title.includes(q);
  });

  const getReviewStatusBadge = (reviewStatus: string, isDiscrepant: boolean) => {
    if (isDiscrepant || reviewStatus === 'needs_review') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center space-x-1 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          <span>15%+ Farq (Qayta ko'rish)</span>
        </span>
      );
    }
    if (reviewStatus === 'senior_review') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center space-x-1">
          <Scale className="w-3 h-3 text-purple-600" />
          <span>Katta tekshiruv</span>
        </span>
      );
    }
    if (reviewStatus === 'moderator_review') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center space-x-1">
          <SlidersHorizontal className="w-3 h-3 text-amber-600" />
          <span>Moderatsiya</span>
        </span>
      );
    }
    if (reviewStatus === 'finalized') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Yakunlandi</span>
        </span>
      );
    }
    if (reviewStatus === 'under_evaluation') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center space-x-1">
          <Clock className="w-3 h-3 text-blue-600" />
          <span>Baholanmoqda</span>
        </span>
      );
    }
    if (reviewStatus === 'evaluation_complete') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200 flex items-center space-x-1">
          <FileCheck2 className="w-3 h-3 text-teal-600" />
          <span>Baholash to'liq</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
        Kutilmoqda
      </span>
    );
  };

  // Calculate live total score in scoring modal
  const liveTotalScore = Object.values(criterionScores).reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-serif font-bold text-xl text-navy-950 flex items-center space-x-2">
            <span>Baholash va Tekshiruv Nazorati</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-blue-100 text-blue-800">
              Milestone 5
            </span>
          </h2>
          <p className="text-xs text-gray-500 font-sans mt-0.5">
            A'zolar topshiriqlari, rubrika bo'yicha baholash, ko'p baholovchilar konsensusi va moderatsiya
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchOverview}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Yangilash</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="A'zo ismi yoki topshiriq bo'yicha qidirish..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
          />
        </div>

        <div className="flex space-x-1.5 overflow-x-auto w-full md:w-auto text-xs">
          {[
            { id: 'all', label: `Barchasi (${items.length})` },
            { id: 'awaiting_evaluation', label: 'Kutilmoqda' },
            { id: 'under_evaluation', label: 'Baholanmoqda' },
            { id: 'needs_review', label: '⚠️ Farq (15%+)' },
            { id: 'senior_review', label: 'Katta tekshiruv' },
            { id: 'moderator_review', label: 'Moderatsiya' },
            { id: 'finalized', label: 'Yakunlangan' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="py-20 text-center text-xs text-gray-500 space-y-2">
          <RotateCw className="w-5 h-5 text-blue-600 animate-spin mx-auto" />
          <p>Baholash ma'lumotlari yuklanmoqda...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-xs text-red-700">{errorMsg}</p>
          <button
            onClick={fetchOverview}
            className="px-4 py-2 bg-navy-900 text-white rounded-xl text-xs font-semibold hover:bg-navy-800 transition"
          >
            Qayta urinish
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 space-y-2">
          <FolderOpen className="w-8 h-8 text-gray-400 mx-auto" />
          <h3 className="font-serif font-bold text-sm text-navy-950">
            Topshirilgan ishlar topilmadi
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Hozircha tanlangan mezon bo'yicha baholash navbatida topshiriqlar mavjud emas.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-600 uppercase font-semibold tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Talaba / A'zo</th>
                  <th className="py-3 px-4">Topshiriq</th>
                  <th className="py-3 px-4">Ko'rib chiqish holati</th>
                  <th className="py-3 px-4">Biriktirilgan baholovchilar</th>
                  <th className="py-3 px-4">Ballar / Xulosa</th>
                  <th className="py-3 px-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-sans">
                {filtered.map((item) => {
                  const subId = item.submission_id || item.id;
                  const memberName = item.member_name || item.user_name || "A'zo";
                  const assignTitle = item.assignment_title || "Topshiriq";
                  const assignedList = item.assigned_evaluators || [];
                  const evals = item.evaluations || [];
                  const isDiscrepant = Boolean(item.is_discrepant);
                  const reviewStatus = item.review_status || 'awaiting_evaluation';

                  return (
                    <tr key={subId} className={`hover:bg-gray-50/50 transition ${isDiscrepant ? 'bg-rose-50/30' : ''}`}>
                      <td className="py-3 px-4 font-medium text-navy-950">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-full bg-navy-100 text-navy-800 flex items-center justify-center font-bold text-[11px] shrink-0">
                            {memberName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{memberName}</p>
                            <span className="text-[10px] text-gray-400">ID: #{subId}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            {item.direction || item.assignment_direction}
                          </span>
                          <p className="font-semibold text-navy-900 mt-1 line-clamp-1">{assignTitle}</p>
                          <span className="text-[10px] text-gray-400">Maks. {item.max_score || 100} ball</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {getReviewStatusBadge(reviewStatus, isDiscrepant)}
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {assignedList.length === 0 ? (
                              <span className="text-[11px] text-gray-400 italic">Biriktirilmagan</span>
                            ) : (
                              assignedList.map((ea: any, idx: number) => (
                                <span key={idx} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium border border-gray-200">
                                  {ea.evaluator_name || `Evaluator #${ea.evaluator_id}`}
                                </span>
                              ))
                            )}
                          </div>
                          <button
                            onClick={() => setAssignModalSub(item)}
                            className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>Biriktirish</span>
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {evals.length > 0 && (
                            <div className="text-[11px] text-gray-600">
                              Baholar: <span className="font-bold text-navy-900">{evals.map((e: any) => e.total_score).join(', ')}</span>
                            </div>
                          )}
                          {item.average_score !== null && item.average_score !== undefined && (
                            <div className="text-[11px] text-gray-500">
                              O'rtacha: <span className="font-semibold text-navy-900">{item.average_score} ball</span>
                            </div>
                          )}
                          {item.score_difference !== null && item.score_difference !== undefined && (
                            <div className="text-[11px]">
                              Farq: <span className={`font-bold ${isDiscrepant ? 'text-rose-600 font-bold' : 'text-gray-700'}`}>
                                {item.score_difference} ball ({item.difference_percentage}%)
                              </span>
                            </div>
                          )}
                          {item.final_score !== null && item.final_score !== undefined && (
                            <div className="text-[11px] text-emerald-700 font-bold flex items-center space-x-1">
                              <Award className="w-3.5 h-3.5" />
                              <span>Yakuniy: {item.final_score} ball</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Grade Button */}
                          <button
                            onClick={() => openScoring(item)}
                            className="px-2.5 py-1.5 rounded-lg bg-navy-900 text-white font-medium hover:bg-navy-800 transition text-[11px] flex items-center space-x-1 shadow-2xs"
                            title="Rubrika bo'yicha baholash"
                          >
                            <Scale className="w-3 h-3" />
                            <span>Baholash</span>
                          </button>

                          {/* Senior Review Button (if needs review) */}
                          {(isDiscrepant || reviewStatus === 'needs_review' || reviewStatus === 'senior_review') && (
                            <button
                              onClick={() => {
                                setSeniorModalSub(item);
                                setSeniorScore(item.average_score || 75);
                                setSeniorRationale('');
                                setEscalateToMod(false);
                              }}
                              className="px-2 py-1.5 rounded-lg bg-purple-700 text-white font-medium hover:bg-purple-800 transition text-[11px] flex items-center space-x-1 shadow-2xs"
                              title="Katta tekshiruv"
                            >
                              <ShieldAlert className="w-3 h-3" />
                              <span>Katta tekshiruv</span>
                            </button>
                          )}

                          {/* Moderator Finalize Button */}
                          {(reviewStatus === 'moderator_review' || reviewStatus === 'evaluation_complete' || isDiscrepant) && (
                            <button
                              onClick={() => {
                                setModModalSub(item);
                                setModFinalScore(item.average_score || 80);
                                setModRationale('Akademik talablarga muvofiq rasmiy baho tasdiqlandi.');
                              }}
                              className="px-2 py-1.5 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition text-[11px] flex items-center space-x-1 shadow-2xs"
                              title="Yakuniy ballni belgilash"
                            >
                              <Award className="w-3 h-3" />
                              <span>Yakunlash</span>
                            </button>
                          )}

                          {/* Inspect deliverable */}
                          <button
                            onClick={() => openInspection(subId)}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
                            title="Ishni ko'rish"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. ASSIGN EVALUATOR MODAL */}
      {/* ------------------------------------------------------------- */}
      {assignModalSub && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-serif font-bold text-base text-navy-950 flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span>Baholovchilarni biriktirish</span>
              </h3>
              <button onClick={() => setAssignModalSub(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-gray-50 p-3 rounded-xl space-y-1">
                <p className="font-semibold text-navy-900">{assignModalSub.assignment_title}</p>
                <p className="text-gray-500">Talaba: {assignModalSub.member_name || assignModalSub.user_name}</p>
              </div>

              {/* Current assigned evaluators */}
              <div>
                <label className="font-semibold text-gray-700 block mb-1.5">Hozirgi biriktirilgan baholovchilar:</label>
                {(assignModalSub.assigned_evaluators || []).length === 0 ? (
                  <p className="text-gray-400 italic">Hozircha hech kim biriktirilmagan.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(assignModalSub.assigned_evaluators || []).map((ea: any) => (
                      <div key={ea.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
                        <span className="font-medium text-navy-900">{ea.evaluator_name || `Evaluator #${ea.evaluator_id}`}</span>
                        <button
                          onClick={() => handleRemoveEvaluator(ea.evaluator_id)}
                          className="text-red-600 hover:text-red-800 text-[11px] font-semibold"
                        >
                          Olib tashlash
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add evaluator dropdown */}
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Yangi baholovchini tanlang:</label>
                <select
                  value={selectedEvaluatorId || ''}
                  onChange={(e) => setSelectedEvaluatorId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-600 bg-white"
                >
                  {availableEvaluators.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.display_name} (@{ev.username || ev.id})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  * Tizim manfaatlar to'qnashuvini oldini oladi (Talaba o'z ishini o'zi baholay olmaydi).
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-2 text-xs">
              <button
                onClick={() => setAssignModalSub(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleAssignEvaluator}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition flex items-center space-x-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Biriktirish</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. RUBRIC SCORING MODAL */}
      {/* ------------------------------------------------------------- */}
      {scoringModalSub && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-serif font-bold text-lg text-navy-950 flex items-center space-x-2">
                  <Scale className="w-5 h-5 text-blue-600" />
                  <span>Rubrika bo'yicha baholash</span>
                </h3>
                <p className="text-xs text-gray-500 font-sans mt-0.5">
                  {scoringModalSub.assignment_title} — Talaba: {scoringModalSub.member_name || scoringModalSub.user_name}
                </p>
              </div>
              <button onClick={() => setScoringModalSub(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {contextLoading ? (
                <div className="py-12 text-center text-gray-400">
                  <RotateCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  <p>Topshiriq va rubrika ma'lumotlari yuklanmoqda...</p>
                </div>
              ) : !evaluationContext ? (
                <p className="text-center text-red-500">Ma'lumot topilmadi.</p>
              ) : (
                <>
                  {/* Submission Deliverables Section */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
                    <h4 className="font-semibold text-navy-950 text-xs flex items-center space-x-1.5">
                      <FileText className="w-4 h-4 text-gray-600" />
                      <span>Topshirilgan ish mazmuni</span>
                    </h4>
                    {evaluationContext.text_content ? (
                      <div className="bg-white p-3 rounded-xl border border-gray-200 font-sans text-gray-800 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                        {evaluationContext.text_content}
                      </div>
                    ) : (
                      <p className="text-gray-400 italic">Matnli javob yo'q.</p>
                    )}

                    {evaluationContext.link_url && (
                      <div className="pt-1 flex items-center space-x-2">
                        <span className="text-gray-500">Havola:</span>
                        <a
                          href={evaluationContext.link_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline flex items-center space-x-1 font-medium"
                        >
                          <span>{evaluationContext.link_url}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {evaluationContext.files && evaluationContext.files.length > 0 && (
                      <div className="pt-1">
                        <span className="text-gray-500 block mb-1">Fayllar ({evaluationContext.files.length}):</span>
                        <div className="flex flex-wrap gap-2">
                          {evaluationContext.files.map((f: any) => (
                            <a
                              key={f.id}
                              href={f.download_url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-blue-700 flex items-center space-x-1.5 hover:bg-blue-50 font-medium"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>{f.filename}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rubric Criteria Scoring Form */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <h4 className="font-serif font-bold text-sm text-navy-950">
                        Baholash mezonlari (Rubric Criteria)
                      </h4>
                      <div className="text-xs font-bold text-navy-900 bg-blue-50 px-3 py-1 rounded-xl border border-blue-100">
                        Jami ball: <span className="text-blue-700 text-sm">{liveTotalScore}</span> / {evaluationContext.max_score}
                      </div>
                    </div>

                    {(evaluationContext.rubric?.criteria || []).map((crit: any) => {
                      const curVal = criterionScores[crit.id] || { score: 0, comment: '' };
                      return (
                        <div key={crit.id} className="p-4 rounded-2xl border border-gray-200 bg-white shadow-2xs space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <div>
                              <p className="font-semibold text-navy-950 text-xs">{crit.title}</p>
                              {crit.description && (
                                <p className="text-gray-500 text-[11px] mt-0.5">{crit.description}</p>
                              )}
                              {crit.guidance && (
                                <p className="text-blue-600 text-[10px] italic mt-0.5">Ko'rsatma: {crit.guidance}</p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="text-gray-400 text-xs">Ball (maks. {crit.max_points}):</span>
                              <input
                                type="number"
                                min="0"
                                max={crit.max_points}
                                step="1"
                                value={curVal.score}
                                onChange={(e) => {
                                  const num = Math.max(0, Math.min(crit.max_points, Number(e.target.value)));
                                  setCriterionScores(prev => ({
                                    ...prev,
                                    [crit.id]: { ...curVal, score: num }
                                  }));
                                }}
                                className="w-20 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs text-center font-bold text-navy-950 focus:ring-2 focus:ring-blue-600 bg-white"
                              />
                            </div>
                          </div>

                          <div>
                            <input
                              type="text"
                              placeholder="Mezon bo'yicha qisqacha izoh (ixtiyoriy)..."
                              value={curVal.comment}
                              onChange={(e) => {
                                setCriterionScores(prev => ({
                                  ...prev,
                                  [crit.id]: { ...curVal, comment: e.target.value }
                                }));
                              }}
                              className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-[11px] focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-gray-50/50"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* General Feedback & Internal Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold text-navy-900 block mb-1">
                        Umumiy xulosa va fikr (A'zoga ko'rinadi) *
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Talabaning ishi bo'yicha akademik xulosa va takliflar..."
                        value={generalFeedback}
                        onChange={(e) => setGeneralFeedback(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-600 resize-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-navy-900 block mb-1 flex items-center space-x-1">
                        <Lock className="w-3 h-3 text-amber-600" />
                        <span>Ichki eslatmalar (Faqat baholovchilar uchun)</span>
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Ichki tekshiruv eslatmalari, shubhalar yoki savollar..."
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-amber-200 bg-amber-50/30 text-xs focus:ring-2 focus:ring-amber-500 resize-none"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50 rounded-b-3xl">
              <button
                onClick={() => setScoringModalSub(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-white text-xs font-medium"
              >
                Bekor qilish
              </button>

              <div className="flex items-center space-x-2">
                <button
                  disabled={isSubmittingScore}
                  onClick={() => handleSubmitEvaluation(true)}
                  className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <Save className="w-3.5 h-3.5 text-gray-500" />
                  <span>Qoralama saqlash</span>
                </button>

                <button
                  disabled={isSubmittingScore}
                  onClick={() => handleSubmitEvaluation(false)}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Baholashni topshirish</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. SENIOR REVIEW MODAL */}
      {/* ------------------------------------------------------------- */}
      {seniorModalSub && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-serif font-bold text-base text-navy-950 flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-purple-600" />
                <span>Katta tekshiruv (Senior Review)</span>
              </h3>
              <button onClick={() => setSeniorModalSub(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 space-y-1">
                <p className="font-semibold text-purple-950">{seniorModalSub.assignment_title}</p>
                <p className="text-purple-700">Talaba: {seniorModalSub.member_name || seniorModalSub.user_name}</p>
                {seniorModalSub.score_difference && (
                  <p className="text-rose-700 font-bold mt-1">
                    ⚠️ Baholovchilar orasidagi farq: {seniorModalSub.score_difference} ball ({seniorModalSub.difference_percentage}%)
                  </p>
                )}
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Katta baholovchi tavsiya etgan yakuniy ball (0 - {seniorModalSub.max_score || 100}):
                </label>
                <input
                  type="number"
                  min="0"
                  max={seniorModalSub.max_score || 100}
                  value={seniorScore}
                  onChange={(e) => setSeniorScore(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 font-bold text-navy-950 bg-white text-xs focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Xulosa va tahlil (Rationale) *</label>
                <textarea
                  rows={3}
                  placeholder="Nima uchun ushbu ball tavsiya etilmoqda, qaysi baholovchining argumenti asosliroq..."
                  value={seniorRationale}
                  onChange={(e) => setSeniorRationale(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-purple-600 resize-none bg-white"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="escalateCheck"
                  checked={escalateToMod}
                  onChange={(e) => setEscalateToMod(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                />
                <label htmlFor="escalateCheck" className="text-gray-800 font-medium cursor-pointer">
                  Ishni yakuniy qaror uchun Moderatorga yo'naltirish (Escalate)
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-2 text-xs">
              <button
                onClick={() => setSeniorModalSub(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
              >
                Bekor qilish
              </button>
              <button
                disabled={isSubmittingSenior}
                onClick={handleSubmitSeniorReview}
                className="px-5 py-2 rounded-xl bg-purple-700 text-white font-semibold hover:bg-purple-800 transition"
              >
                {escalateToMod ? "Moderatorga yo'naltirish" : "Tekshiruvni tasdiqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. MODERATOR FINALIZATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {modModalSub && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-serif font-bold text-base text-navy-950 flex items-center space-x-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <span>Yakuniy rasmiy bahoni e'lon qilish</span>
              </h3>
              <button onClick={() => setModModalSub(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 space-y-1">
                <p className="font-semibold text-emerald-950">{modModalSub.assignment_title}</p>
                <p className="text-emerald-700">Talaba: {modModalSub.member_name || modModalSub.user_name}</p>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Yakuniy rasmiy ball (0 - {modModalSub.max_score || 100}) *:
                </label>
                <input
                  type="number"
                  min="0"
                  max={modModalSub.max_score || 100}
                  value={modFinalScore}
                  onChange={(e) => setModFinalScore(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 font-bold text-navy-950 bg-white text-xs focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Rasmiy xulosa va a'zoga yuboriladigan fikr *
                </label>
                <textarea
                  rows={3}
                  placeholder="Talaba ko'radigan yakuniy rasmiy xulosa..."
                  value={modRationale}
                  onChange={(e) => setModRationale(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-emerald-600 resize-none bg-white"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-2 text-xs">
              <button
                onClick={() => setModModalSub(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
              >
                Bekor qilish
              </button>
              <button
                disabled={isSubmittingMod}
                onClick={handleSubmitModeratorDecision}
                className="px-5 py-2 rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-800 transition flex items-center space-x-1"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Bahoni e'lon qilish va yakunlash</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. INSPECTION MODAL */}
      {/* ------------------------------------------------------------- */}
      {inspectDetail && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-serif font-bold text-base text-navy-950">
                Topshirilgan ish tafsilotlari
              </h3>
              <button onClick={() => setInspectDetail(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-1">
                <p className="font-bold text-navy-950 text-sm">
                  {inspectDetail.assignment?.title || 'Topshiriq'}
                </p>
                <p className="text-gray-500">
                  Talaba: <span className="font-semibold text-gray-800">{inspectDetail.user?.display_name || 'Talaba'}</span>
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-navy-900 mb-1.5">Matnli tahlil:</h4>
                <div className="bg-white p-3.5 rounded-xl border border-gray-200 text-gray-800 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {inspectDetail.latest_version?.text_content || 'Matn mavjud emas.'}
                </div>
              </div>

              {inspectDetail.latest_version?.link_url && (
                <div>
                  <h4 className="font-semibold text-navy-900 mb-1">Havola:</h4>
                  <a
                    href={inspectDetail.latest_version.link_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline flex items-center space-x-1"
                  >
                    <span>{inspectDetail.latest_version.link_url}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setInspectDetail(null)}
                className="px-4 py-2 bg-navy-900 text-white rounded-xl text-xs font-semibold hover:bg-navy-800 transition"
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
