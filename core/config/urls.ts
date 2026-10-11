import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded if imported standalone
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Centralized URL configuration for the SleekFlow web application.
 *
 * Supports environment variables:
 *  - BASE_URL: Overrides the default app base URL (default: https://app.sleekflow.io)
 *  - SSO_URL:  Overrides the Auth0 SSO base URL (default: https://sso.sleekflow.io)
 */
const DEFAULT_BASE_URL = process.env.BASE_URL || 'https://app.sleekflow.io';
const DEFAULT_SSO_URL = process.env.SSO_URL || 'https://sso.sleekflow.io';

export const URL_CONFIG = {
  baseUrl: DEFAULT_BASE_URL,
  ssoUrl: DEFAULT_SSO_URL,

  /**
   * Relative paths and direct routes for pages across the application.
   */
  routes: {
    root: '/',
    login: '/',
    signup: '/u/signup',
    registerCompany: '/en/register-company',
  },
} as const;

/**
 * Convenient shorthand map for page routes.
 * Page objects assign `protected readonly path = URLS.login` directly.
 */
export const URLS = {
  ...URL_CONFIG.routes,
} as const;
