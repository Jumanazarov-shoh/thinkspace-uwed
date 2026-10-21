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
  RoleName
} from '../types';

const API_BASE = '/api';

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

  // Submissions
  submitWork: (assignmentId: number, formData: FormData) =>
    request<Submission>(`/submissions/assignment/${assignmentId}`, {
      method: 'POST',
      body: formData,
    }),

  getMySubmission: (assignmentId: number) =>
    request<Submission | null>(`/submissions/assignment/${assignmentId}/my-submission`),

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
  getLeaderboard: (limit: number = 50) =>
    request<LeaderboardEntry[]>(`/leaderboard?limit=${limit}`),

  getMyProgress: () => request<MemberProgress>('/leaderboard/my-progress'),

  getMemberProgress: (userId: number) =>
    request<MemberProgress>(`/leaderboard/member/${userId}/progress`),
};
