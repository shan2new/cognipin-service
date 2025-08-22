import { ApplicationMilestone, ApplicationStage } from '../schema/application.entity'

const exploration: ApplicationStage[] = [
  'wishlist',
  'recruiter_reachout',
  'self_review',
]
const screening: ApplicationStage[] = [
  'hr_shortlist',
  'hm_shortlist',
]
const postInterview: ApplicationStage[] = ['offer']

// Helper function to check if a stage is an interview round
export function isInterviewRoundStage(stage: ApplicationStage): boolean {
  return typeof stage === 'string' && stage.startsWith('interview_round_')
}

export function deriveMilestone(stage: ApplicationStage): ApplicationMilestone {
  if (exploration.includes(stage)) return 'exploration'
  if (screening.includes(stage)) return 'screening'
  if (isInterviewRoundStage(stage)) return 'interviewing'
  if (stage === 'offer') return 'post_interview'
  return 'exploration' // Default fallback
}

export function canTransition(from: ApplicationStage, to: ApplicationStage, adminOverride = false): boolean {
  return true;
}

export function getNextStage(currentStage: ApplicationStage): ApplicationStage | null {
  switch (currentStage) {
    case 'wishlist':
      return 'recruiter_reachout'
    case 'recruiter_reachout':
      return 'self_review'
    case 'self_review':
      return 'hr_shortlist'
    case 'hr_shortlist':
      return 'hm_shortlist'
    case 'hm_shortlist':
      return 'interview_round_1' // After screening, move to first interview round
    case 'offer':
      return null // Final stage
    default:
      // Handle interview round progression
      if (isInterviewRoundStage(currentStage)) {
        // For interview rounds, the next stage would be determined by the application logic
        // This could be the next interview round or offer stage
        return null // Let application service determine next interview round or offer
      }
      return null
  }
}

export function getStageOrder(): ApplicationStage[] {
  return ['wishlist', 'recruiter_reachout', 'self_review', 'hr_shortlist', 'hm_shortlist', 'offer']
}


