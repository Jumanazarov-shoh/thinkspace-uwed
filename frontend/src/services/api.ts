/**
 * ThinkSpace | UWED API Client
 * Interacts with FastAPI backend endpoints with Telegram WebApp initData & JWT tokens.
 */
import {
  User,
  Assignment,
  Submission,
  Evaluation,
  ModeratorDecision,
  PublishedGrade,
  ReviewRequest,
  LeaderboardEntry,
  MemberProgress,
  MembershipRequest,
  RoleName,
  MySubmissionSummary,
  AdminSubmissionOverviewItem,
  Rubric,
  RubricCriterion,
  NotificationItem,
  NotificationListResponse,
  NotificationPreference,
  AdminNotificationStatus,
  PointTransaction,
  PersonalRanking,
  DirectionAnalyticsItem,
  AdminAnalyticsOverview,
  AdminMemberPerformanceItem,
  AdminMemberDetail,
  ManualPointAdjustmentPayload
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('thinkspace_token');
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set JSON content-type if not FormData
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('thinkspace_token');
    }
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch (e) {}
    throw new ApiError(response.status, errorDetail);
  }

  return response.json();
}

export const api = {
  // Auth
  authenticateTelegram: (initData: string) =>
    request<{ access_token: string; user: User }>('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ init_data: initData }),
    }),

  devLogin: (role: RoleName) =>
    request<{ access_token: string; user: User }>(`/auth/dev-login?role=${role}`, {
      method: 'POST',
    }),

  getMe: () => request<User>('/auth/me'),

  updateProfile: (data: Partial<User>) =>
    request<User>('/members/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Membership
  applyForMembership: (data: { statement: string; chosen_directions: string[]; student_id?: string; faculty?: string; phone?: string }) =>
    request<MembershipRequest>('/members/request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listMembershipRequests: (status?: string) =>
    request<MembershipRequest[]>(`/members/requests${status ? `?status_filter=${status}` : ''}`),

  reviewMembershipRequest: (requestId: number, action: 'approve' | 'reject', comment?: string) =>
    request<MembershipRequest>(`/members/requests/${requestId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, review_comment: comment }),
    }),

  listMembers: (status?: string) =>
    request<User[]>(`/members${status ? `?status_filter=${status}` : ''}`),

  assignRole: (userId: number, roleName: RoleName) =>
    request<User>(`/members/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ role_name: roleName }),
    }),

  removeRole: (userId: number, roleName: RoleName) =>
    request<User>(`/members/${userId}/roles/${roleName}`, {
      method: 'DELETE',
    }),

  // Assignments
  getAssignments: (params?: { direction?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.direction) q.set('direction', params.direction);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<Assignment[]>(`/assignments${qs}`);
  },

  getAssignment: (id: number) => request<Assignment>(`/assignments/${id}`),

  createAssignment: (data: any) =>
    request<Assignment>('/assignments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAssignment: (id: number, data: any) =>
    request<Assignment>(`/assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  publishAssignment: (id: number) =>
    request<Assignment>(`/assignments/${id}/publish`, {
      method: 'POST',
    }),

  closeAssignment: (id: number) =>
    request<Assignment>(`/assignments/${id}/close`, {
      method: 'POST',
    }),

  archiveAssignment: (id: number) =>
    request<Assignment>(`/assignments/${id}/archive`, {
      method: 'POST',
    }),

  revertAssignmentToDraft: (id: number) =>
    request<Assignment>(`/assignments/${id}/draft`, {
      method: 'POST',
    }),

  deleteAssignment: (id: number) =>
    request<{ success: boolean; message: string }>(`/assignments/${id}`, {
      method: 'DELETE',
    }),

  // Submissions
  saveSubmissionDraft: (assignmentId: number, formData: FormData) =>
    request<Submission>(`/submissions/assignment/${assignmentId}/draft`, {
      method: 'POST',
      body: formData,
    }),

  submitAssignmentWork: (assignmentId: number, formData: FormData) =>
    request<Submission>(`/submissions/assignment/${assignmentId}/submit`, {
      method: 'POST',
      body: formData,
    }),

  submitWork: (assignmentId: number, formData: FormData) =>
    request<Submission>(`/submissions/assignment/${assignmentId}/submit`, {
      method: 'POST',
      body: formData,
    }),

  getMySubmission: (assignmentId: number) =>
    request<Submission | null>(`/submissions/assignment/${assignmentId}/my-submission`),

  getMySubmissions: () =>
    request<MySubmissionSummary[]>('/submissions/my-submissions'),

  deleteSubmissionAttachment: (submissionId: number, fileId: number) =>
    request<{ status: string; message: string }>(`/submissions/${submissionId}/attachments/${fileId}`, {
      method: 'DELETE',
    }),

  getAdminSubmissionsOverview: (params?: { assignment_id?: number; status_filter?: string }) => {
    const q = new URLSearchParams();
    if (params?.assignment_id) q.set('assignment_id', params.assignment_id.toString());
    if (params?.status_filter) q.set('status_filter', params.status_filter);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<AdminSubmissionOverviewItem[]>(`/submissions/admin/overview${qs}`);
  },

  getSubmissionsList: (params?: { assignment_id?: number; status_filter?: string }) => {
    const q = new URLSearchParams();
    if (params?.assignment_id) q.set('assignment_id', params.assignment_id.toString());
    if (params?.status_filter) q.set('status_filter', params.status_filter);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<Submission[]>(`/submissions${qs}`);
  },

  getSubmissionDetail: (id: number) => request<Submission>(`/submissions/${id}`),

  // Evaluations
  submitEvaluation: (data: {
    submission_id: number;
    general_feedback: string;
    is_revision_requested?: boolean;
    revision_notes?: string;
    is_draft?: boolean;
    criterion_scores: Array<{ criterion_id: number; score: number; comment?: string }>;
  }) =>
    request<Evaluation>('/evaluations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getEvaluations: (submissionId: number) =>
    request<Evaluation[]>(`/evaluations/submission/${submissionId}`),

  // Moderation & Publishing
  recordModerationDecision: (submissionId: number, data: { decision: string; rationale: string; override_score?: number }) =>
    request<ModeratorDecision>(`/moderation/submissions/${submissionId}/decision`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  publishGrade: (submissionId: number) =>
    request<PublishedGrade>(`/moderation/submissions/${submissionId}/publish-grade`, {
      method: 'POST',
    }),

  revisePublishedGrade: (gradeId: number, data: { new_score: number; reason: string }) =>
    request<any>(`/moderation/published-grades/${gradeId}/revise`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  appealGrade: (gradeId: number, reason: string) =>
    request<ReviewRequest>(`/moderation/published-grades/${gradeId}/appeal`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  listAppeals: (status?: string) =>
    request<ReviewRequest[]>(`/moderation/appeals${status ? `?status_filter=${status}` : ''}`),

  resolveAppeal: (appealId: number, data: { action: 'resolve' | 'reject'; resolution_comment: string; adjusted_score?: number }) =>
    request<ReviewRequest>(`/moderation/appeals/${appealId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Leaderboard & Progress
  getLeaderboard: (direction?: string, limit: number = 50) =>
    request<LeaderboardEntry[]>(`/leaderboard?limit=${limit}${direction ? `&direction=${encodeURIComponent(direction)}` : ''}`),

  getMyRank: () => request<PersonalRanking>('/leaderboard/me/rank'),

  getMyPointsHistory: () => request<PointTransaction[]>('/leaderboard/me/points'),

  getMyProgress: () => request<MemberProgress>('/leaderboard/my-progress'),

  getMemberProgress: (userId: number) =>
    request<MemberProgress>(`/leaderboard/member/${userId}/progress`),

  // Milestone 5: Rubrics, Evaluators, Senior Review & Moderation
  getAssignmentRubric: (assignmentId: number) =>
    request<Rubric>(`/assignments/${assignmentId}/rubric`),

  addRubricCriterion: (assignmentId: number, data: { title: string; description?: string; guidance?: string; max_points: number; order_index?: number }) =>
    request<RubricCriterion>(`/assignments/${assignmentId}/rubric/criteria`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRubricCriterion: (assignmentId: number, criterionId: number, data: { title?: string; description?: string; guidance?: string; max_points?: number; order_index?: number }) =>
    request<RubricCriterion>(`/assignments/${assignmentId}/rubric/criteria/${criterionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteRubricCriterion: (assignmentId: number, criterionId: number) =>
    request<{ success: boolean; message: string }>(`/assignments/${assignmentId}/rubric/criteria/${criterionId}`, {
      method: 'DELETE',
    }),

  getEvaluatorAssigned: (statusFilter?: string) =>
    request<any[]>(`/evaluations/assigned${statusFilter ? `?status_filter=${statusFilter}` : ''}`),

  getEvaluationContext: (submissionId: number) =>
    request<any>(`/evaluations/submission/${submissionId}/context`),

  submitOrDraftEvaluation: (data: {
    submission_id: number;
    general_feedback: string;
    internal_notes?: string;
    is_draft?: boolean;
    criterion_scores: Array<{ criterion_id: number; score: number; comment?: string }>;
  }) =>
    request<Evaluation>('/evaluations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  assignEvaluator: (submissionId: number, evaluatorId: number) =>
    request<any>(`/evaluations/assignments/${submissionId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ evaluator_id: evaluatorId }),
    }),

  removeEvaluator: (submissionId: number, evaluatorId: number) =>
    request<{ success: boolean; message: string }>(`/evaluations/assignments/${submissionId}/evaluators/${evaluatorId}`, {
      method: 'DELETE',
    }),

  getSeniorReviewQueue: () =>
    request<any[]>('/evaluations/senior-queue'),

  submitSeniorReview: (submissionId: number, data: {
    recommended_score: number;
    rationale: string;
    internal_notes?: string;
    escalate_to_moderator?: boolean;
  }) =>
    request<any>(`/evaluations/submissions/${submissionId}/senior-review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getModeratorQueue: () =>
    request<any[]>('/evaluations/moderator-queue'),

  finalizeEvaluation: (submissionId: number, data: {
    final_score: number;
    rationale: string;
  }) =>
    request<PublishedGrade>(`/evaluations/submissions/${submissionId}/finalize`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAdminEvaluationsOverview: (params?: { review_status?: string; direction?: string }) => {
    const q = new URLSearchParams();
    if (params?.review_status) q.set('review_status', params.review_status);
    if (params?.direction) q.set('direction', params.direction);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<any[]>(`/evaluations/admin/overview${qs}`);
  },

  getMemberAssignmentResult: (assignmentId: number) =>
    request<any>(`/evaluations/member/assignment/${assignmentId}/result`),

  // Milestone 6: Notifications & Reminders
  getNotifications: (unreadOnly: boolean = false, limit: number = 50) =>
    request<NotificationListResponse>(`/notifications?unread_only=${unreadOnly}&limit=${limit}`),

  markNotificationRead: (id: number) =>
    request<NotificationItem>(`/notifications/${id}/read`, {
      method: 'POST',
    }),

  markAllNotificationsRead: () =>
    request<{ success: boolean; marked_count: number }>('/notifications/read-all', {
      method: 'POST',
    }),

  getNotificationPreferences: () =>
    request<NotificationPreference>('/notifications/preferences'),

  updateNotificationPreferences: (data: { telegram_notifications_enabled?: boolean; deadline_reminders_enabled?: boolean }) =>
    request<NotificationPreference>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getAdminNotificationStatus: () =>
    request<AdminNotificationStatus>('/notifications/admin/status'),

  sendAdminAnnouncement: (data: { title: string; message: string; send_telegram?: boolean }) =>
    request<{ success: boolean; recipients_count: number; title: string }>('/notifications/admin/announcement', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  processDeadlineReminders: () =>
    request<{ assignments_checked: number; reminders_sent: number; skipped_duplicates: number }>('/notifications/admin/process-reminders', {
      method: 'POST',
    }),

  // Milestone 7: Admin Analytics & Point Adjustments
  getAdminAnalyticsOverview: (dateRange: string = 'all_time') =>
    request<AdminAnalyticsOverview>(`/admin/analytics/overview?date_range=${dateRange}`),

  getAdminDirectionAnalytics: () =>
    request<DirectionAnalyticsItem[]>('/admin/analytics/directions'),

  getAdminMembersAnalytics: (search?: string, sortBy?: string, order: string = 'desc') =>
    request<AdminMemberPerformanceItem[]>(
      `/admin/analytics/members?order=${order}${search ? `&search=${encodeURIComponent(search)}` : ''}${sortBy ? `&sort_by=${sortBy}` : ''}`
    ),

  getAdminMemberDetail: (userId: number) =>
    request<AdminMemberDetail>(`/admin/analytics/members/${userId}`),

  adjustMemberPoints: (data: ManualPointAdjustmentPayload) =>
    request<PointTransaction>('/admin/points/adjust', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
