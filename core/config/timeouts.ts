/**
 * Centralized timeout configurations (in milliseconds).
 *
 * Tiered timeouts allow easy adjustments across all Page Objects,
 * navigation wait helpers, assertions, and test steps.
 */
export const TIMEOUTS = {
  /** Quick presence check (e.g., conditional UI triggers, sidebar toggle checks): 2s */
  quick: 2_000,

  /** Short wait (e.g., error alert appearance, fast element rendering): 5s */
  short: 5_000,

  /** Medium wait (e.g., step transitions, password step render, link redirects): 8s */
  medium: 8_000,

  /** Page load / modal or panel appearance / heading visibility: 10s */
  page: 10_000,

  /** SSO navigation / Auth0 external redirects: 15s */
  sso: 15_000,

  /** Long operations (e.g., post-login dashboard redirect): 25s */
  appRedirect: 25_000,

  /** Longest polling operations (e.g., email OTP arrival via IMAP): 60s */
  otp: 60_000,
} as const;
