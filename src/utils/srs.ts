export type ReviewStatus = 'forgot' | 'hard' | 'good' | 'easy';

export interface SRSState {
  interval: number;       // In days
  easeFactor: number;     // SM-2 Ease Factor (minimum 1.3)
  repetitions: number;    // Consecutive correct reviews
  nextReviewDate: number; // Timestamp (ms)
  lastStatus?: ReviewStatus;
  mistakeCount: number;
  isLeech: boolean;
  isSuspended: boolean;
}

export const INITIAL_SRS_STATE: SRSState = {
  interval: 0,
  easeFactor: 2.5,
  repetitions: 0,
  nextReviewDate: Date.now(),
  mistakeCount: 0,
  isLeech: false,
  isSuspended: false
};

/**
 * Custom Spaced Repetition (SRS) Engine
 * Integrates response speed, hard shrink factors, speed ceilings, and automated leech detection.
 * 
 * @param currentState The current card review history
 * @param status The user's self-assessed review confidence rating
 * @param responseTimeMs Time taken in milliseconds to submit the answer
 * @returns Updated SRSState
 */
export function calculateNextReview(
  currentState: SRSState,
  status: ReviewStatus,
  responseTimeMs?: number
): SRSState {
  const state = { ...currentState };
  state.lastStatus = status;

  // Track mistakes
  if (status === 'forgot') {
    state.mistakeCount += 1;
    // Check for Leech Detection
    if (state.mistakeCount >= 8) {
      state.isLeech = true;
      state.isSuspended = true; // Suspend for specialized drills
    }
  }

  let newInterval = 1;
  let newEaseFactor = state.easeFactor;
  let newRepetitions = state.repetitions;

  switch (status) {
    case 'forgot':
      newInterval = 1;
      newRepetitions = 0;
      // Decrease ease factor (floor is 1.3 to avoid "ease hell")
      newEaseFactor = Math.max(1.3, state.easeFactor - 0.2);
      break;

    case 'hard':
      // User struggled. Shrink previous interval by 50% rather than dropping to 1-2 days
      const prevInterval = state.interval || 1;
      newInterval = Math.max(1, Math.floor(prevInterval * 0.5));
      newRepetitions = Math.max(0, state.repetitions - 1);
      // Reduce ease factor since the card is difficult
      newEaseFactor = Math.max(1.3, state.easeFactor - 0.15);
      break;

    case 'good':
      newRepetitions = state.repetitions + 1;
      if (newRepetitions === 1) {
        newInterval = 1; // 1 day
      } else if (newRepetitions === 2) {
        newInterval = 6; // 6 days
      } else {
        newInterval = Math.max(1, Math.floor(state.interval * state.easeFactor));
      }
      // Keep ease factor steady or slowly build it
      newEaseFactor = Math.min(5.0, state.easeFactor + 0.05);
      break;

    case 'easy':
      newRepetitions = state.repetitions + 1;
      if (newRepetitions === 1) {
        newInterval = 2; // 2 days
      } else if (newRepetitions === 2) {
        newInterval = 8; // 8 days
      } else {
        // Fast-track interval (1.5x speed boost)
        newInterval = Math.max(1, Math.floor(state.interval * state.easeFactor * 1.5));
      }
      // Boost ease factor
      newEaseFactor = Math.min(5.0, state.easeFactor + 0.15);
      break;
  }

  // Apply speed bonus for quick recalls
  if (responseTimeMs !== undefined && (status === 'good' || status === 'easy')) {
    // If recalled in less than 2.5 seconds, grant a speed bonus multiplier
    if (responseTimeMs < 2500) {
      // 10% speed bonus, capped at maximum 1.15x
      const speedMultiplier = 1.10;
      newInterval = Math.floor(newInterval * speedMultiplier);
    }
  }

  // Absolute Interval Ceiling cap (365 days)
  newInterval = Math.min(365, newInterval);

  state.interval = newInterval;
  state.easeFactor = Number(newEaseFactor.toFixed(2));
  state.repetitions = newRepetitions;

  // Calculate next review timestamp in milliseconds
  const millisecondsInADay = 24 * 60 * 60 * 1000;
  // Make nextReviewDate absolute start of that day (local time) to avoid minute-drifts
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Start of today
  state.nextReviewDate = now.getTime() + (newInterval * millisecondsInADay);

  return state;
}
