import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../locales';
import { api } from '../../services/api';
import { Assignment, DirectionType, RubricCriterion } from '../../types';
import { 
  Plus, 
  Layers, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Trash2, 
  Sliders,
  Sparkles,
  Filter
} from 'lucide-react';

export const AdminAssignmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDirection, setFilterDirection] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [direction, setDirection] = useState<DirectionType>('think_read');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [maxScore, setMaxScore] = useState<number>(100);
  const [minEvaluators, setMinEvaluators] = useState<number>(1);
  const [requiresModeration, setRequiresModeration] = useState<boolean>(true);
  const [discrepancyThreshold, setDiscrepancyThreshold] = useState<number>(15.0);
  const [criteria, setCriteria] = useState<Array<{ title: string; description: string; max_points: number }>>([
    { title: 'Intellectual Depth & Critical Analysis', description: 'Depth of reasoning, conceptual clarity, rigorous argumentation', max_points: 40 },
    { title: 'Academic Structure & Methodology', description: 'Logical flow, clarity of expression, evidence-based approach', max_points: 30 },
    { title: 'Originality & Academic Synthesis', description: 'Unique perspective, creative insights, relevance to UWED context', max_points: 30 }
  ]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const data = await api.getAssignments();
      setAssignments(data);
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const totalCriteriaPoints = criteria.reduce((sum, c) => sum + (Number(c.max_points) || 0), 0);
  const isSumValid = totalCriteriaPoints === Number(maxScore);

  const handleAddCriterion = () => {
    setCriteria([...criteria, { title: '', description: '', max_points: 10 }]);
  };

  const handleRemoveCriterion = (index: number) => {
    if (criteria.length <= 1) return;
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const handleUpdateCriterion = (index: number, field: string, value: any) => {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [field]: value };
    setCriteria(updated);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isSumValid) {
      setErrorMsg(`Rubric validation failed: Sum of criteria (${totalCriteriaPoints}) must equal Max Score (${maxScore}).`);
      return;
    }

    if (!title.trim() || !description.trim()) {
      setErrorMsg('Please fill in title and short description.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createAssignment({
        title,
        direction,
        description,
        instructions,
        max_score: Number(maxScore),
        min_evaluators: Number(minEvaluators),
        requires_moderation: requiresModeration,
        discrepancy_threshold: Number(discrepancyThreshold),
        status: 'open',
        rubric: {
          title: `${title} Standard Rubric`,
          description: `Comprehensive academic rubric for ${title}`,
          criteria: criteria.map((c, i) => ({
            title: c.title,
            description: c.description,
            max_points: Number(c.max_points),
            order_index: i
          }))
        }
      });

      setShowCreateModal(false);
      resetForm();
      fetchAssignments();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setInstructions('');
    setMaxScore(100);
    setCriteria([
      { title: 'Intellectual Depth & Critical Analysis', description: 'Depth of reasoning, conceptual clarity', max_points: 40 },
      { title: 'Academic Structure & Methodology', description: 'Logical flow, clarity of expression', max_points: 30 },
      { title: 'Originality & Academic Synthesis', description: 'Unique perspective, creative insights', max_points: 30 }
    ]);
  };

  const directionsList: Array<{ id: DirectionType; label: string }> = [
    { id: 'think_read', label: 'Think & Read' },
    { id: 'think_discuss', label: 'Think & Discuss' },
    { id: 'think_analyze', label: 'Think & Analyze' },
    { id: 'think_lead', label: 'Think & Lead' },
    { id: 'think_create', label: 'Think & Create' },
    { id: 'think_connect', label: 'Think & Connect' },
  ];

  const filteredAssignments = assignments.filter((a) => {
    if (filterDirection !== 'all' && a.direction !== filterDirection) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-xl font-serif font-bold text-navy-950">Academic Assignments & Rubrics</h1>
          <p className="text-xs text-gray-500 mt-1">
            Author tasks, configure mathematical rubrics, and publish assignments across the 6 ThinkSpace directions.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="flex items-center space-x-2 bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t.admin.createAssignment}</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 text-xs">
        <div className="flex items-center space-x-1.5 text-gray-500 mr-2">
          <Filter className="w-3.5 h-3.5" />
          <span className="font-medium">Filters:</span>
        </div>

        <select
          value={filterDirection}
          onChange={(e) => setFilterDirection(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-navy-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
        >
          <option value="all">All Directions</option>
          {directionsList.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-navy-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="closed">Closed</option>
        </select>

        <span className="text-gray-400 ml-auto">
          Showing {filteredAssignments.length} of {assignments.length} assignments
        </span>
      </div>

      {/* Assignments Table / Cards */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
          Loading assignments...
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
          No assignments found matching filters. Click "+ Create Assignment" to draft your first academic challenge!
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Title & Direction</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Rubric Structure</th>
                  <th className="py-3.5 px-4">Evaluation Rule</th>
                  <th className="py-3.5 px-4">Max Score</th>
                  <th className="py-3.5 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-navy-900">
                {filteredAssignments.map((a) => {
                  const dirInfo = directionsList.find(d => d.id === a.direction);
                  const rubric = a.rubrics?.[0];
                  return (
                    <tr key={a.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-4 px-5">
                        <div className="font-semibold text-sm text-navy-950">{a.title}</div>
                        <div className="text-xs text-blue-700 font-medium mt-0.5">
                          {dirInfo?.label || a.direction}
                        </div>
                        <p className="text-[11px] text-gray-500 line-clamp-1 mt-1 max-w-md">
                          {a.description}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full font-medium text-[11px] uppercase ${
                          a.status === 'open' ? 'bg-emerald-100 text-emerald-800' :
                          a.status === 'closed' ? 'bg-gray-100 text-gray-700' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {rubric ? (
                          <div>
                            <span className="font-medium text-navy-900">
                              {rubric.criteria?.length || 0} criteria
                            </span>
                            <div className="text-[10px] text-gray-400">
                              {rubric.criteria?.map((c: RubricCriterion) => `${c.max_points}pt`).join(' + ')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">No rubric attached</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        <div>Min Evaluators: <span className="font-semibold text-navy-950">{a.min_evaluators}</span></div>
                        <div className="text-[10px] text-gray-400">
                          {a.requires_moderation ? 'Moderation required' : 'Direct publish'} • ±{a.discrepancy_threshold}%
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-sm text-navy-950">
                        {a.max_score} pts
                      </td>
                      <td className="py-4 px-4 text-gray-400 text-[11px]">
                        {new Date(a.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Assignment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-navy-950 text-white">
              <div>
                <h2 className="text-lg font-serif font-bold">New Academic Assignment</h2>
                <p className="text-xs text-blue-200">Configure rubric criteria and evaluation parameters</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-gray-300 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateAssignment} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Assignment Basic Details */}
              <div className="space-y-4">
                <h3 className="font-serif font-bold text-sm text-navy-900 border-b border-gray-100 pb-1">
                  1. Assignment Overview
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">
                      {t.admin.assignmentTitle} *
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Analysis of Global Trade Alliances in Central Asia"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 mb-1">
                      {t.admin.chooseDirection} *
                    </label>
                    <select
                      value={direction}
                      onChange={(e) => setDirection(e.target.value as DirectionType)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    >
                      {directionsList.map((d) => (
                        <option key={d.id} value={d.id}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">
                    {t.admin.description} *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief summary of assignment goals and thematic focus..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">
                    {t.admin.instructions}
                  </label>
                  <textarea
                    rows={3}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Provide detailed submission requirements, word limits, citation guides..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-sans"
                  />
                </div>
              </div>

              {/* Evaluation Governance Settings */}
              <div className="space-y-4 pt-2">
                <h3 className="font-serif font-bold text-sm text-navy-900 border-b border-gray-100 pb-1">
                  2. {t.admin.evaluatorSettings}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">
                      Max Total Score *
                    </label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={1000}
                      value={maxScore}
                      onChange={(e) => setMaxScore(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 mb-1">
                      {t.admin.minEvaluators}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={minEvaluators}
                      onChange={(e) => setMinEvaluators(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 mb-1">
                      {t.admin.discrepancyThreshold}
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      min={5}
                      max={50}
                      value={discrepancyThreshold}
                      onChange={(e) => setDiscrepancyThreshold(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="req_mod"
                    checked={requiresModeration}
                    onChange={(e) => setRequiresModeration(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <label htmlFor="req_mod" className="font-medium text-gray-700 cursor-pointer">
                    {t.admin.requiresModeration} (Recommended for strict academic fairness)
                  </label>
                </div>
              </div>

              {/* Dynamic Rubric Builder */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                  <h3 className="font-serif font-bold text-sm text-navy-900">
                    3. Dynamic Rubric Criteria
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddCriterion}
                    className="text-blue-700 hover:text-blue-800 font-semibold flex items-center space-x-1"
                  >
                    <span>{t.admin.addCriterion}</span>
                  </button>
                </div>

                {/* Live Mathematical Verification Pill */}
                <div className={`p-3 rounded-lg border flex items-center justify-between ${
                  isSumValid 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}>
                  <div className="flex items-center space-x-2 font-medium">
                    {isSumValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    )}
                    <span>
                      Criteria Sum: <strong>{totalCriteriaPoints}</strong> / {maxScore} points
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold uppercase">
                    {isSumValid ? 'Mathematical Match' : `Difference: ${maxScore - totalCriteriaPoints} pts`}
                  </span>
                </div>

                <div className="space-y-3">
                  {criteria.map((crit, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <input
                          type="text"
                          required
                          placeholder="Criterion Name (e.g. Critical Thinking)"
                          value={crit.title}
                          onChange={(e) => handleUpdateCriterion(idx, 'title', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-white border border-gray-300 rounded font-medium focus:ring-1 focus:ring-blue-600 focus:outline-none"
                        />
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="text-gray-500 font-medium">Points:</span>
                          <input
                            type="number"
                            required
                            min={1}
                            max={maxScore}
                            value={crit.max_points}
                            onChange={(e) => handleUpdateCriterion(idx, 'max_points', Number(e.target.value))}
                            className="w-16 px-2 py-1.5 bg-white border border-gray-300 rounded font-mono font-bold text-center focus:ring-1 focus:ring-blue-600 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveCriterion(idx)}
                            disabled={criteria.length <= 1}
                            className="text-gray-400 hover:text-red-600 disabled:opacity-30 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="Detailed criteria guidelines and grading expectations..."
                        value={crit.description}
                        onChange={(e) => handleUpdateCriterion(idx, 'description', e.target.value)}
                        className="w-full px-2.5 py-1 bg-white border border-gray-300 rounded text-gray-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isSumValid || submitting}
                  className="px-5 py-2 bg-navy-950 hover:bg-navy-900 disabled:bg-gray-300 text-white font-medium rounded-lg shadow-sm transition flex items-center space-x-2"
                >
                  <span>{submitting ? 'Creating...' : 'Publish Assignment & Rubric'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
