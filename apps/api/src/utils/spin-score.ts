/**
 * SPIN Score Calculator
 *
 * Calculates a 0-100 score based on the completeness of SPIN fields:
 * - Situation
 * - Problem
 * - Implication
 * - Need-Payoff
 *
 * Each field contributes 25 points max:
 * - 0 chars = 0 points
 * - 1-49 chars = 5 points (started)
 * - 50-149 chars = 15 points (partial)
 * - 150+ chars = 25 points (complete)
 */

export interface SpinScoreBreakdown {
  situation: number;
  problem: number;
  implication: number;
  needPayoff: number;
}

export interface SpinScoreResult {
  score: number;
  breakdown: SpinScoreBreakdown;
  completeness: number; // 0-4 count of complete fields
}

function scoreField(value: string | null | undefined): number {
  if (!value) return 0;
  const length = value.trim().length;
  if (length === 0) return 0;
  if (length < 50) return 5;
  if (length < 150) return 15;
  return 25;
}

function isFieldComplete(value: string | null | undefined): boolean {
  return value ? value.trim().length >= 150 : false;
}

export function calculateSpinScore(deal: {
  spin_situation?: string | null;
  spin_problem?: string | null;
  spin_implication?: string | null;
  spin_need_payoff?: string | null;
}): SpinScoreResult {
  const breakdown: SpinScoreBreakdown = {
    situation: scoreField(deal.spin_situation),
    problem: scoreField(deal.spin_problem),
    implication: scoreField(deal.spin_implication),
    needPayoff: scoreField(deal.spin_need_payoff),
  };

  const score = breakdown.situation + breakdown.problem + breakdown.implication + breakdown.needPayoff;

  const completeness = [
    isFieldComplete(deal.spin_situation),
    isFieldComplete(deal.spin_problem),
    isFieldComplete(deal.spin_implication),
    isFieldComplete(deal.spin_need_payoff),
  ].filter(Boolean).length;

  return {
    score,
    breakdown,
    completeness,
  };
}

/**
 * Get a text description of the SPIN score
 */
export function getSpinScoreLabel(score: number): string {
  if (score >= 75) return 'Complete';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Partial';
  return 'Needs Work';
}

/**
 * Get the color class for a SPIN score (for styling)
 */
export function getSpinScoreColor(score: number): 'green' | 'yellow' | 'orange' | 'gray' {
  if (score >= 75) return 'green';
  if (score >= 50) return 'yellow';
  if (score >= 25) return 'orange';
  return 'gray';
}
