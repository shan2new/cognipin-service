import { ApplicationStage } from '../schema/application.entity';

// Mapping between frontend display names and backend ApplicationStage enum values
export const stageDisplayNames: Record<ApplicationStage, string> = {
  'applied_self': 'Applied',
  'applied_referral': 'Applied via Referral',
  'recruiter_outreach': 'Recruiter Outreach',
  'hr_shortlisted': 'HR Shortlist',
  'hm_shortlisted': 'Hiring Manager Shortlist',
  'interview_shortlist': 'Interview Shortlist',
  'interview_scheduled': 'Interview Scheduled',
  'interview_rescheduled': 'Interview Rescheduled',
  'interview_completed': 'Interview Completed',
  'interview_passed': 'Interview Passed',
  'interview_rejected': 'Interview Rejected',
  'offer': 'Offer',
  'accepted': 'Accepted',
  'rejected': 'Rejected',
  'withdrawn': 'Withdrawn',
  'on_hold': 'On Hold'
};

// Frontend friendly stage order for visualization
export const stageOrder: ApplicationStage[] = [
  'recruiter_outreach',
  'applied_self',
  'applied_referral',
  'hr_shortlisted',
  'interview_shortlist',
  'interview_scheduled',
  'interview_rescheduled',
  'interview_completed',
  'interview_passed',
  'hm_shortlisted',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'on_hold'
];

// Group stages into logical milestones
export const stageMilestoneMapping: Record<ApplicationStage, string> = {
  'recruiter_outreach': 'exploration',
  'applied_self': 'exploration',
  'applied_referral': 'exploration',
  'hr_shortlisted': 'exploration',
  'hm_shortlisted': 'interviewing',
  'interview_shortlist': 'interviewing',
  'interview_scheduled': 'interviewing',
  'interview_rescheduled': 'interviewing',
  'interview_completed': 'interviewing',
  'interview_passed': 'interviewing',
  'interview_rejected': 'post_interview',
  'offer': 'post_interview',
  'accepted': 'post_interview',
  'rejected': 'post_interview',
  'withdrawn': 'post_interview',
  'on_hold': 'post_interview'
};

// Function to get a display name for a stage
export function getStageDisplayName(stage: ApplicationStage): string {
  return stageDisplayNames[stage] || stage;
}

// Function to convert frontend display name back to backend enum
export function getStageEnumFromDisplayName(displayName: string): ApplicationStage | undefined {
  const entry = Object.entries(stageDisplayNames).find(([_, value]) => value === displayName);
  return entry ? entry[0] as ApplicationStage : undefined;
}

// Validate if a stage exists in the backend enum
export function isValidBackendStage(stage: string): boolean {
  return Object.keys(stageDisplayNames).includes(stage);
}

// Get the next logical stage in the sequence
export function getNextStage(currentStage: ApplicationStage): ApplicationStage | null {
  const currentIndex = stageOrder.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex === stageOrder.length - 1) {
    return null;
  }
  return stageOrder[currentIndex + 1];
}
