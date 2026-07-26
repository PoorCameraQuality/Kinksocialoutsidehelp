/** Signal caps for public member Community Trust (levels, not points). */
export const TRUST_CAP_ACCEPTED_REFERENCES = 3
export const TRUST_CAP_STAFF_CHECK_INS = 3
export const TRUST_CAP_VERIFIED_PRESENTER_CREDITS = 2
export const TRUST_CAP_VERIFIED_VENDOR_CREDITS = 2
export const TRUST_ORGANIZER_ROLE_PARTICIPATION_WEIGHT = 2

/** Reference anti-gaming */
export const REFERRER_MIN_ACCOUNT_AGE_DAYS = 14
export const SIGNUP_COHORT_WINDOW_HOURS = 48
export const REFERENCE_SOFT_DECAY_YEARS = 2

/** Presenter review weights */
export const PRESENTER_ATTENDEE_REVIEW_WEIGHT = 1.0
export const PRESENTER_CHECKED_IN_ATTENDEE_WEIGHT = 1.25
export const PRESENTER_ORG_REVIEW_WEIGHT = 2.5
export const PRESENTER_ORG_REPEAT_DECAY_MONTHS = 12
export const PRESENTER_ORG_REPEAT_WEIGHT_FACTOR = 0.5

/** Presenter / org public display gates */
export const PRESENTER_MIN_REVIEWS_FOR_TIER = 3
export const PRESENTER_MIN_ORG_REVIEWED_EVENTS_FOR_TIER = 2

/**
 * Org composite rating blends public stars with internal member signals.
 * Few public reviews: lean internal (0.7 / 0.3).
 * Plenty of public reviews: weight public higher (0.85 / 0.15).
 */
export const ORG_MIN_PUBLIC_REVIEWS_FOR_STARS = 3
export const ORG_HIGH_PUBLIC_REVIEW_COUNT = 10
export const ORG_BLEND_PUBLIC_LOW = 0.7
export const ORG_BLEND_INTERNAL_LOW = 0.3
export const ORG_BLEND_PUBLIC_HIGH = 0.85
export const ORG_BLEND_INTERNAL_HIGH = 0.15

/** Vendor public display */
export const VENDOR_MIN_VERIFIED_FOR_STARS = 3

/** Bayesian display priors */
export const BAYESIAN_PRIOR_RATING = 4.0
export const BAYESIAN_PRIOR_WEIGHT_PRESENTER_VENDOR = 5
export const BAYESIAN_PRIOR_WEIGHT_ORG = 8

/** Minimum account age before public reviews count (days) */
export const REVIEW_MIN_ACCOUNT_AGE_DAYS = 14

/** Minimum group dimension responses before showing averages */
export const GROUP_MIN_REVIEWS_FOR_DIMENSIONS = 3

export const VENDOR_FEEDBACK_HELPER =
  'Vendor feedback is based on verified community interactions where available.'
