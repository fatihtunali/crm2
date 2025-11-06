/**
 * Cancellation Policy Engine
 * Calculates cancellation fees based on booking date and travel date
 */

/**
 * Standard cancellation policy structure
 */
interface CancellationRule {
  days_before: number; // Days before travel start
  penalty_percent: number; // Penalty as percentage of total (0-100)
}

interface CancellationPolicy {
  name: string;
  rules: CancellationRule[];
  default_penalty_percent: number; // If no rule matches
}

/**
 * Default cancellation policy
 * Based on common travel industry standards
 */
export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  name: 'Standard Travel Cancellation Policy',
  rules: [
    { days_before: 60, penalty_percent: 10 },  // 60+ days: 10% penalty
    { days_before: 30, penalty_percent: 25 },  // 30-59 days: 25% penalty
    { days_before: 14, penalty_percent: 50 },  // 14-29 days: 50% penalty
    { days_before: 7, penalty_percent: 75 },   // 7-13 days: 75% penalty
    { days_before: 0, penalty_percent: 100 },  // 0-6 days: 100% penalty (no refund)
  ],
  default_penalty_percent: 100, // No refund if travel date has passed
};

/**
 * Calculate cancellation fee based on policy
 *
 * @param travelStartDate - Date when travel begins (YYYY-MM-DD)
 * @param cancellationDate - Date when cancellation is requested (YYYY-MM-DD)
 * @param bookingTotalAmount - Total booking amount
 * @param policy - Cancellation policy to apply (optional, uses default if not provided)
 * @returns Object with fee details
 */
export function calculateCancellationFee(
  travelStartDate: string,
  cancellationDate: string,
  bookingTotalAmount: number,
  policy: CancellationPolicy = DEFAULT_CANCELLATION_POLICY
): {
  days_before_travel: number;
  penalty_percent: number;
  cancellation_fee: number;
  refund_amount: number;
  policy_applied: string;
  policy_rule: string;
} {
  // Parse dates
  const travelDate = new Date(travelStartDate);
  const cancelDate = new Date(cancellationDate);

  // Calculate days before travel
  const timeDiff = travelDate.getTime() - cancelDate.getTime();
  const daysBeforeTravel = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  // Find applicable rule
  let penaltyPercent = policy.default_penalty_percent;
  let policyRule = 'Default (travel date passed or no matching rule)';

  // Rules are sorted from highest days_before to lowest
  // Find the first rule where daysBeforeTravel >= days_before
  for (const rule of policy.rules) {
    if (daysBeforeTravel >= rule.days_before) {
      penaltyPercent = rule.penalty_percent;
      policyRule = `${rule.days_before}+ days before: ${rule.penalty_percent}% penalty`;
      break;
    }
  }

  // Calculate fee and refund
  const cancellationFee = (bookingTotalAmount * penaltyPercent) / 100;
  const refundAmount = bookingTotalAmount - cancellationFee;

  return {
    days_before_travel: daysBeforeTravel,
    penalty_percent: penaltyPercent,
    cancellation_fee: cancellationFee,
    refund_amount: Math.max(0, refundAmount), // Ensure non-negative
    policy_applied: policy.name,
    policy_rule: policyRule,
  };
}

/**
 * Flexible cancellation policy (lower penalties)
 */
export const FLEXIBLE_CANCELLATION_POLICY: CancellationPolicy = {
  name: 'Flexible Cancellation Policy',
  rules: [
    { days_before: 30, penalty_percent: 5 },   // 30+ days: 5% penalty
    { days_before: 14, penalty_percent: 15 },  // 14-29 days: 15% penalty
    { days_before: 7, penalty_percent: 35 },   // 7-13 days: 35% penalty
    { days_before: 0, penalty_percent: 50 },   // 0-6 days: 50% penalty
  ],
  default_penalty_percent: 100,
};

/**
 * Strict cancellation policy (higher penalties)
 */
export const STRICT_CANCELLATION_POLICY: CancellationPolicy = {
  name: 'Strict Cancellation Policy',
  rules: [
    { days_before: 90, penalty_percent: 25 },  // 90+ days: 25% penalty
    { days_before: 60, penalty_percent: 50 },  // 60-89 days: 50% penalty
    { days_before: 30, penalty_percent: 75 },  // 30-59 days: 75% penalty
    { days_before: 0, penalty_percent: 100 },  // 0-29 days: 100% penalty (no refund)
  ],
  default_penalty_percent: 100,
};

/**
 * Non-refundable policy
 */
export const NON_REFUNDABLE_POLICY: CancellationPolicy = {
  name: 'Non-Refundable',
  rules: [
    { days_before: 0, penalty_percent: 100 },  // Any time: 100% penalty
  ],
  default_penalty_percent: 100,
};
