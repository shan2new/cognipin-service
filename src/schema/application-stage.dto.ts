export interface StageObject {
  id: string
  name: string
  type: 'standard' | 'interview_round'
  interview_round_number?: number
  interview_data?: {
    type: string
    custom_name?: string
    status: 'unscheduled' | 'scheduled' | 'rescheduled' | 'completed' | 'rejected' | 'withdrawn'
    scheduled_at?: string
    completed_at?: string
    result?: string
    rejection_reason?: string
  }
}

export interface ApplicationWithStageObject {
  id: string
  milestone: string
  stage: StageObject
  // ... other application fields
}
