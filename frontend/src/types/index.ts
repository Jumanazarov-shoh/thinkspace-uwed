export type RoleName = 'member' | 'evaluator' | 'senior_reviewer' | 'moderator' | 'super_admin';

export type DirectionType = 
  | 'think_read' 
  | 'think_discuss' 
  | 'think_analyze' 
  | 'think_lead' 
  | 'think_create' 
  | 'think_connect';

export type AssignmentDirection = 
  | 'Think & Read'
  | 'Think & Discuss'
  | 'Think & Analyze'
  | 'Think & Lead'
  | 'Think & Create'
  | 'Think & Connect'
  | DirectionType;

export interface UserRole {
  id?: number;
  role_name: RoleName;
  granted_at?: string;
}

export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  display_name: string;
  student_id?: string;
  faculty?: string;
  phone?: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  preferred_language: 'uz' | 'en';
  roles: UserRole[];
  created_at: string;
  updated_at: string;
}

export interface RubricCriterion {
  id: number;
  rubric_id?: number;
  title: string;
  description?: string;
  guidance?: string;
  max_points: number;
  weight?: number;
  order_index?: number;
}

export interface Rubric {
  id: number;
  assignment_id?: number;
  title?: string;
  description?: string;
  version?: number;
  is_active?: boolean;
  criteria: RubricCriterion[];
  created_at?: string;
}

export interface Assignment {
  id: number;
  title: string;
  slug?: string;
  direction: AssignmentDirection;
  description: string;
  short_description?: string;
  instructions?: string;
  reference_links?: Array<{ title: string; url: string }>;
  difficulty?: string;
  attachment_url?: string;
  status: 'draft' | 'published' | 'scheduled' | 'open' | 'closed' | 'archived' | string;
  publish_at?: string;
  published_at?: string;
  deadline_at?: string;
  deadline?: string;
  max_score: number;
  allowed_formats?: string[];
  min_evaluators: number;
  requires_moderation: boolean;
  discrepancy_threshold: number;
  created_by_id?: number;
  created_at: string;
  updated_at?: string;
  active_rubric?: Rubric;
  rubrics?: Rubric[];
  my_submission_status?: 'not_started' | 'draft' | 'submitted' | 'late' | 'locked' | string;
}

export interface StoredFile {
  id: number;
  submission_version_id?: number;
  file_name?: string;
  original_filename?: string;
  file_path?: string;
  mime_type?: string;
  file_size?: number;
  file_size_bytes?: number;
  telegram_file_id?: string;
  uploaded_at?: string;
  download_url?: string;
}

export interface SubmissionVersion {
  id: number;
  submission_id?: number;
  version_number: number;
  text_content?: string;
  link_url?: string;
  submitted_at: string;
  files?: StoredFile[];
}

export interface Submission {
  id: number;
  assignment_id: number;
  user_id: number;
  user?: User;
  assignment?: Assignment;
  status: 'draft' | 'submitted' | 'late' | 'locked' | 'under_review' | 'evaluated' | 'revision_requested' | 'resubmitted' | 'awaiting_moderator' | 'approved' | 'published' | 'rejected' | string;
  is_late?: boolean;
  submitted_at?: string;
  created_at: string;
  updated_at?: string;
  latest_version?: SubmissionVersion;
  versions?: SubmissionVersion[];
  evaluations?: Evaluation[];
  published_grade?: PublishedGrade;

  // Convenience flat accessors mapped from latest_version or serializer
  version_number?: number;
  text_content?: string;
  link_url?: string;
  submission_type?: string;
  files?: StoredFile[];
}

export interface MySubmissionSummary {
  id: number;
  assignment_id: number;
  assignment_title: string;
  assignment_direction: string;
  status: 'draft' | 'submitted' | 'late' | 'locked' | string;
  is_late: boolean;
  submitted_at?: string;
  deadline?: string;
  updated_at: string;
  version_number: number;
  has_text: boolean;
  has_link: boolean;
  attachment_count: number;
}

export interface AdminSubmissionOverviewItem {
  id: number;
  assignment_id: number;
  assignment_title: string;
  assignment_direction: string;
  user_id: number;
  user_name: string;
  user_telegram_username?: string;
  status: 'draft' | 'submitted' | 'late' | 'locked' | string;
  is_late: boolean;
  submitted_at?: string;
  updated_at: string;
  version_number: number;
  attachment_count: number;
}

export interface CriterionScore {
  id: number;
  evaluation_id?: number;
  criterion_id: number;
  score: number;
  comment?: string;
}

export interface Evaluation {
  id: number;
  submission_id: number;
  submission_version_id?: number;
  evaluator_id: number;
  evaluator?: User;
  status?: 'draft' | 'submitted' | string;
  is_draft?: boolean;
  total_score: number;
  general_feedback: string;
  is_revision_requested: boolean;
  revision_notes?: string;
  criterion_scores: CriterionScore[];
  created_at: string;
  submitted_at?: string;
}

export interface ModeratorDecision {
  id: number;
  submission_id: number;
  moderator_id: number;
  moderator?: User;
  decision: 'approved' | 'rejected' | 'overridden' | 'returned_to_evaluator' | 'override' | string;
  override_score?: number;
  rationale: string;
  created_at: string;
}

export interface GradeRevision {
  id: number;
  published_grade_id?: number;
  previous_score: number;
  new_score: number;
  reason: string;
  changed_by_id: number;
  changed_at: string;
}

export interface PublishedGrade {
  id: number;
  submission_id: number;
  assignment_id?: number;
  user_id?: number;
  final_score: number;
  max_score?: number;
  percentage?: number;
  overall_feedback?: string;
  published_by_id?: number;
  published_at?: string;
  revisions?: GradeRevision[];
}

export interface ReviewRequest {
  id: number;
  published_grade_id: number;
  published_grade?: PublishedGrade;
  user_id: number;
  user?: User;
  reason: string;
  status: 'pending' | 'under_review' | 'resolved' | 'rejected' | string;
  resolution_comment?: string;
  created_at: string;
  resolved_at?: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  display_name: string;
  student_id?: string;
  faculty?: string;
  total_score: number;
  total_points?: number;
  average_percentage?: number;
  average_score?: number;
  completed_assignments?: number;
  completed_tasks_count?: number;
}

export interface DirectionPerformance {
  direction: AssignmentDirection;
  assignments_available?: number;
  assignments_completed: number;
  total_score: number;
  average_score?: number;
  average_percentage: number;
}

export interface RecentResultItem {
  assignment_id: number;
  assignment_title: string;
  direction: string;
  score: number;
  max_score: number;
  percentage: number;
  finalized_at?: string;
}

export interface RecentActivityItem {
  type: string;
  title: string;
  description: string;
  timestamp: string;
  related_id?: string;
}

export interface MemberProgress {
  user_id: number;
  total_points: number;
  average_score?: number;
  average_percentage: number;
  total_assignments_available?: number;
  assignments_submitted_count?: number;
  graded_assignments_count: number;
  finalized_evaluations_count?: number;
  pending_reviews_count: number;
  draft_submissions_count?: number;
  late_submissions_count?: number;
  completion_rate: number;
  directions: DirectionPerformance[];
  recent_results?: RecentResultItem[];
  recent_activity?: RecentActivityItem[];
}

export interface MembershipRequest {
  id: number;
  user_id: number;
  user?: User;
  student_id?: string;
  faculty?: string;
  statement: string;
  chosen_directions: string[];
  status: 'pending' | 'approved' | 'rejected' | string;
  reviewed_at?: string;
  review_comment?: string;
  created_at: string;
}

export type ReviewStatus = 
  | 'awaiting_evaluation'
  | 'under_evaluation'
  | 'evaluation_complete'
  | 'needs_review'
  | 'senior_review'
  | 'moderator_review'
  | 'finalized';

export interface EvaluatorAssignment {
  id: number;
  submission_id: number;
  evaluator_id: number;
  evaluator_name?: string;
  evaluator_username?: string;
  assigned_by_id: number;
  status: string;
  assigned_at: string;
}

export interface SeniorReview {
  id: number;
  submission_id: number;
  senior_reviewer_id: number;
  senior_reviewer_name?: string;
  recommended_score: number;
  rationale: string;
  internal_notes?: string;
  escalate_to_moderator: boolean;
  created_at: string;
}

export interface EvaluatorQueueItem {
  assignment_id: number;
  assignment_title: string;
  direction: string;
  max_score: number;
  submission_id: number;
  member_id: number;
  member_name: string;
  submitted_at?: string;
  is_late: boolean;
  submission_status: string;
  review_status: string;
  evaluator_assignment_status: string;
  evaluation_status: string;
  evaluation_score?: number;
  text_content?: string;
  link_url?: string;
  attachments_count: number;
}

export interface EvaluationContext {
  submission_id: number;
  assignment_id: number;
  assignment_title: string;
  direction: string;
  instructions: string;
  max_score: number;
  discrepancy_threshold: number;
  member_id: number;
  member_name: string;
  submission_status: string;
  review_status: string;
  submitted_at?: string;
  is_late: boolean;
  text_content: string;
  link_url?: string;
  files: Array<{
    id: number;
    filename: string;
    size_bytes: number;
    download_url: string;
  }>;
  rubric: {
    id: number | null;
    criteria: RubricCriterion[];
  };
  assigned_evaluators: Array<{
    id: number;
    evaluator_id: number;
    evaluator_name: string;
    status: string;
    assigned_at: string;
  }>;
  evaluations: Array<{
    id: number;
    evaluator_id: number;
    evaluator_name: string;
    status: string;
    total_score: number;
    general_feedback: string;
    internal_notes?: string;
    submitted_at?: string;
    criterion_scores: Array<{
      criterion_id: number;
      score: number;
      comment?: string;
    }>;
  }>;
  senior_reviews: SeniorReview[];
}

export interface SubmissionEvaluationOverviewItem {
  submission_id: number;
  assignment_id: number;
  assignment_title: string;
  direction: string;
  member_name: string;
  member_id: number;
  submitted_at?: string;
  is_late: boolean;
  submission_status: string;
  review_status: string;
  max_score: number;
  assigned_evaluators: Array<{
    id: number;
    evaluator_id: number;
    evaluator_name: string;
    status: string;
  }>;
  evaluations_count: number;
  evaluations: Array<{
    id: number;
    evaluator_id: number;
    evaluator_name: string;
    total_score: number;
  }>;
  average_score?: number;
  score_difference?: number;
  difference_percentage?: number;
  is_discrepant: boolean;
  final_score?: number;
}

export interface MemberResult {
  assignment_id: number;
  assignment_title: string;
  direction: string;
  submission_id?: number;
  review_status: string;
  is_finalized: boolean;
  final_score?: number;
  max_score?: number;
  percentage?: number;
  overall_feedback?: string;
  feedback?: string;
  score?: number;
  finalized_at?: string;
  criteria_breakdown?: Array<{
    criterion_id: number;
    title: string;
    max_points: number;
    score?: number;
    comment?: string;
  }>;
  criteria_scores?: Array<{
    criterion_id: number;
    title: string;
    max_points: number;
    score: number;
    comment?: string;
  }>;
}

export type MemberResultResponse = MemberResult;

// Milestone 6: Notifications, Preferences, and Reminders
export type NotificationType =
  | 'assignment_published'
  | 'deadline_reminder'
  | 'deadline_reached'
  | 'submission_received'
  | 'submission_late'
  | 'evaluation_finalized'
  | 'feedback_available'
  | 'system_announcement';

export interface NotificationItem {
  id: number;
  user_id: number;
  type: NotificationType | string;
  title: string;
  message: string;
  related_entity_type?: string;
  related_entity_id?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  delivery_status: string;
  telegram_delivery_status: string;
  telegram_error?: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  unread_count: number;
}

export interface NotificationPreference {
  user_id: number;
  telegram_notifications_enabled: boolean;
  deadline_reminders_enabled: boolean;
}

export interface AdminNotificationStatus {
  total_notifications: number;
  unread_notifications: number;
  telegram_sent_count: number;
  telegram_failed_count: number;
  telegram_disabled_count: number;
}

// Milestone 7: Leaderboard, Ranking, Points Engine & Admin Analytics
export type PointTransactionType =
  | 'performance'
  | 'completion_bonus'
  | 'ontime_bonus'
  | 'manual_adjustment'
  | 'score_correction'
  | string;

export interface PointTransaction {
  id: number;
  user_id: number;
  assignment_id?: number | null;
  submission_id?: number | null;
  transaction_type: PointTransactionType;
  points: number;
  reason?: string | null;
  created_at: string;
}

export interface PersonalRanking {
  current_rank: number | null;
  total_points: number;
  total_ranked_members: number;
  completed_assignments: number;
  average_percentage: number;
  direction_ranks: Record<string, number | null>;
}

export interface DirectionAnalyticsItem {
  direction: string;
  total_assignments: number;
  total_submissions: number;
  completion_rate: number;
  average_score: number;
  active_participants: number;
}

export interface AdminAnalyticsOverview {
  total_members: number;
  active_members: number;
  total_assignments: number;
  total_submissions: number;
  on_time_submissions: number;
  late_submissions: number;
  on_time_rate: number;
  submission_rate: number;
  completion_rate: number;
  average_finalized_score: number;
  total_points_distributed: number;
  pending_evaluations_count: number;
  discrepancies_count: number;
  direction_breakdown: DirectionAnalyticsItem[];
}

export interface AdminMemberPerformanceItem {
  user_id: number;
  display_name: string;
  student_id?: string | null;
  faculty?: string | null;
  rank: number;
  total_points: number;
  completed_count: number;
  average_score: number;
  on_time_count: number;
  late_count: number;
}

export interface AdminMemberDetail {
  user_id?: number;
  display_name?: string;
  student_id?: string | null;
  faculty?: string | null;
  status?: string;
  roles?: string[];
  total_points: number;
  rank?: number | null;
  overall_rank?: number | null;
  completed_assignments?: number;
  average_percentage?: number;
  direction_breakdown: any;
  points_history?: PointTransaction[];
  point_history?: PointTransaction[];
  submissions?: any[];
  member?: {
    id: number;
    display_name: string;
    student_id?: string | null;
    faculty?: string | null;
    username?: string | null;
    preferred_language?: string;
    status: string;
  };
}

export interface ManualPointAdjustmentPayload {
  user_id: number;
  points: number;
  reason: string;
}


