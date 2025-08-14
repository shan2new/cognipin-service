import { ApplicationMilestone, ApplicationStage } from '../schema/application.entity'

const exploration: ApplicationStage[] = [
  'recruiter_outreach',
  'applied_self',
  'applied_referral',
  'recruiter_discussion',
  'pending_shortlist',
  'interview_shortlist',
]
const interviewing: ApplicationStage[] = [
  'interview_scheduled',
  'interview_rescheduled',
  'interview_completed',
  'interview_passed',
  'interview_rejected',
]
const postInterview: ApplicationStage[] = ['offer', 'rejected', 'on_hold', 'withdrawn', 'accepted']

export function deriveMilestone(stage: ApplicationStage): ApplicationMilestone {
  if (exploration.includes(stage)) return 'exploration'
  if (interviewing.includes(stage)) return 'interviewing'
  return 'post_interview'
}

export function canTransition(from: ApplicationStage, to: ApplicationStage, adminOverride = false): boolean {
  if (adminOverride) return true
  // lateral within exploration
  if (exploration.includes(from) && exploration.includes(to)) return true

  if (from === 'interview_shortlist' && to === 'interview_scheduled') return true
  if (from === 'interview_scheduled' && to === 'interview_rescheduled') return true
  if ((from === 'interview_scheduled' || from === 'interview_rescheduled') && to === 'interview_completed') return true
  if (from === 'interview_completed' && (to === 'interview_passed' || to === 'interview_rejected')) return true
  if (from === 'interview_passed' && (to === 'offer' || to === 'interview_scheduled')) return true
  if (
    interviewing.includes(from) &&
    (to === 'rejected' || to === 'on_hold' || to === 'withdrawn')
  )
    return true

  return false
}


