import { type Page, expect } from '@playwright/test';
import { TIMEOUTS } from '@config/timeouts';

/**
 * Abstract base class for all SleekFlow Page Objects.
 *
 * Responsibilities:
 *  - Holds the Playwright `Page` instance (protected so specs cannot bypass POM).
 *  - Declares the abstract `path` that each page must supply.
 *  - Provides shared navigation (`goto`) and generic wait/assert helpers.
 *
 * ── Locator strategy enforced by this project ─────────────────
 * Always pick the first strategy that uniquely identifies the element:
 *   1. Role + accessible name   → page.getByRole('button', { name: 'Save' })
 *   2. Label                    → page.getByLabel('Email address')
 *   3. Placeholder              → page.getByPlaceholder('Search…')
 *   4. Visible text             → page.getByText('Order confirmed')
 *   5. Test ID                  → page.getByTestId('checkout-submit')
 *   6. Scoped / chained         → row.getByRole('button', { name: 'Delete' })
 *   7. Stable CSS (last resort) → page.locator('[data-state="open"]')
 *
 * ❌ Never: XPath, auto-generated class names, positional `nth()`,
 *    or raw CSS selectors in spec files.
 * ──────────────────────────────────────────────────────────────
 */
export abstract class BasePage {
  /** Relative path used by `goto()`. Override in each subclass. */
  protected abstract readonly path: string;

  /**
   * The Playwright `Page` instance.
   * Protected to ensure specs never bypass POM methods or directly access selectors.
   */
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ── Navigation ───────────────────────────────────────────────

  /**
   * Navigate to this page's `path` (or an explicitly provided path/URL) and wait for the page to load.
   * Subclasses may override to add extra wait conditions (e.g. Auth0 redirect).
   */
  async goto(customPath?: string): Promise<void> {
    await this.page.goto(customPath ?? this.path);
  }

  // ── Common wait helpers ──────────────────────────────────────

  /**
   * Wait for a URL pattern to match (wraps `page.waitForURL`).
   * Use this instead of hard waits after navigation-triggering actions.
   */
  async waitForURL(
    urlPattern: string | RegExp | ((url: URL) => boolean),
    options?: { timeout?: number }
  ): Promise<void> {
    await this.page.waitForURL(urlPattern, {
      timeout: options?.timeout ?? TIMEOUTS.sso,
    });
  }

  // ── Common assertions ────────────────────────────────────────



  /** Assert the current URL matches the given pattern. */
  async expectURL(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }
}
