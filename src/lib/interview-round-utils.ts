import { InterviewRound, InterviewRoundStatus, InterviewRoundType } from '../schema/interview-round.entity';

// Map interview round types to display names
export const interviewRoundTypeDisplayNames: Record<InterviewRoundType, string> = {
  'screen': 'Phone Screen',
  'dsa': 'Data Structures & Algorithms',
  'system_design': 'System Design',
  'coding': 'Coding Interview',
  'hm': 'Hiring Manager Round',
  'bar_raiser': 'Bar Raiser Round',
  'other': 'Interview Round'
};

// Map interview round statuses to display names
export const interviewRoundStatusDisplayNames: Record<InterviewRoundStatus, string> = {
  'unscheduled': 'Not Scheduled',
  'scheduled': 'Scheduled',
  'rescheduled': 'Rescheduled',
  'completed': 'Completed',
  'rejected': 'Rejected',
  'withdrawn': 'Withdrawn'
};

// Get display name for a round type
export function getInterviewTypeDisplayName(type: InterviewRoundType): string {
  return interviewRoundTypeDisplayNames[type] || 'Interview Round';
}

// Get display name for a round status
export function getInterviewStatusDisplayName(status: InterviewRoundStatus): string {
  return interviewRoundStatusDisplayNames[status] || 'Unknown';
}

// Format a round for display (with custom name handling)
export function formatRoundForDisplay(round: InterviewRound): string {
  if (round.custom_name) {
    return round.custom_name;
  }
  return getInterviewTypeDisplayName(round.type);
}

// Reorder rounds based on their indices
export function reorderRounds(rounds: InterviewRound[]): InterviewRound[] {
  return [...rounds].sort((a, b) => a.round_index - b.round_index);
}

// Get the next available round index
export function getNextRoundIndex(rounds: InterviewRound[]): number {
  if (!rounds.length) return 1;
  return Math.max(...rounds.map(r => r.round_index)) + 1;
}

// Normalize round indices (fix gaps, ensure sequential ordering)
export function normalizeRoundIndices(rounds: InterviewRound[]): InterviewRound[] {
  const sortedRounds = reorderRounds(rounds);
  return sortedRounds.map((round, idx) => ({
    ...round,
    round_index: idx + 1
  }));
}

// Check if a round can transition to a particular status
export function canTransitionToStatus(
  currentStatus: InterviewRoundStatus, 
  targetStatus: InterviewRoundStatus
): boolean {
  // Define valid transitions
  const validTransitions: Record<InterviewRoundStatus, InterviewRoundStatus[]> = {
    'unscheduled': ['scheduled', 'withdrawn'],
    'scheduled': ['rescheduled', 'completed', 'rejected', 'withdrawn'],
    'rescheduled': ['completed', 'rejected', 'withdrawn'],
    'completed': [],  // Terminal state
    'rejected': [],   // Terminal state
    'withdrawn': []   // Terminal state
  };
  
  return validTransitions[currentStatus]?.includes(targetStatus) || false;
}
