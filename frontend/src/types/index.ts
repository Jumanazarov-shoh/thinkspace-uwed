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
  instructions?: string;
  reference_links?: Array<{ title: string; url: string }>;
  status: 'draft' | 'scheduled' | 'open' | 'closed' | 'archived' | string;
  publish_at?: string;
  deadline_at?: string;
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
  status: 'submitted' | 'under_review' | 'evaluated' | 'revision_requested' | 'resubmitted' | 'awaiting_moderator' | 'approved' | 'published' | 'rejected' | string;
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
  submitted_at?: string;
  submission_type?: string;
  files?: StoredFile[];
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
  average_percentage?: number;
  average_score?: number;
  completed_assignments?: number;
  completed_tasks_count?: number;
}

export interface DirectionPerformance {
  direction: AssignmentDirection;
  assignments_completed: number;
  total_score: number;
  average_percentage: number;
}

export interface MemberProgress {
  user_id: number;
  total_points: number;
  average_percentage: number;
  graded_assignments_count: number;
  pending_reviews_count: number;
  completion_rate: number;
  directions: DirectionPerformance[];
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
