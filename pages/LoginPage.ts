import { expect } from '@playwright/test';
import { BasePage } from '@basepages/BasePage';
import { URLS } from '@config/urls';
import { TIMEOUTS } from '@config/timeouts';

/**
 * Page Object Model for the SleekFlow login page.
 *
 * SleekFlow uses Auth0 (sso.sleekflow.io) with an identifier-first flow:
 *   Step 1 – enter email/username → Continue
 *   Step 2 – enter password       → Continue
 *
 * ── Selector strategy ────────────────────────────────────────
 * All locators use Playwright semantic selectors in priority order:
 *   1. getByRole   – preferred; also validates accessibility
 *   2. getByLabel  – for labelled form controls
 *   3. getByText   – for visible, stable copy
 *   4. locator()   – CSS fallback only when no semantic selector fits
 *
 * Rule: ALL locators are private. Specs only call action/assertion methods.
 * ────────────────────────────────────────────────────────────
 */
export class LoginPage extends BasePage {
  protected readonly path = URLS.login;

  // ── Private locators (specs never access these) ──────────────

  private get usernameInput() {
    return this.page.getByLabel('Email or username');
  }

  private get passwordInput() {
    return this.page.getByRole('textbox', { name: 'Password' });
  }

  private get continueButton() {
    return this.page.getByRole('button', { name: 'Continue', exact: true });
  }

  private get submitButton() {
    return this.page.getByRole('button', { name: /^(Continue|Sign in)$/ });
  }

  private get sidebarLogoToggle() {
    return this.page.locator('[data-sentry-source-file="LogoNavItemNew.tsx"]').first();
  }

  private get profileTrigger() {
    return this.page.locator('[data-sentry-source-file="ProfilePanel.tsx"]').first();
  }

  private get profileMainPanel() {
    return this.page.locator('[data-sentry-source-file="ProfileMainPanel.tsx"]').first();
  }

  private get errorMessage() {
    return this.page
      .getByText(/Wrong (username or password|email or password)/i)
      .or(this.page.getByRole('alert'))
      .or(this.page.locator('#error-element-password, [data-error-message]'));
  }

  // ── Navigation ───────────────────────────────────────────────

  override async goto(): Promise<void> {
    await this.page.goto(this.path);
    await this.waitForURL(/sso\.sleekflow\.io\/u\/login/, { timeout: TIMEOUTS.sso });
  }

  // ── Actions ──────────────────────────────────────────────────

  /** Step 1: Enter email/username and click Continue. */
  async enterEmail(email: string): Promise<void> {
    await this.usernameInput.fill(email);
    await this.continueButton.click();
  }

  /** Step 2: Wait for the password field, fill it, and submit. */
  async enterPassword(password: string): Promise<void> {
    await this.passwordInput.waitFor({ state: 'visible', timeout: TIMEOUTS.medium });
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** Complete two-step login: email → password. */
  async login(email: string, password: string): Promise<void> {
    await this.enterEmail(email);
    await this.enterPassword(password);
  }

  /**
   * Opens the profile panel from the sidebar navigation.
   * Clicks the sidebar toggle first if the profile trigger is not yet revealed.
   */
  async openProfilePanel(): Promise<void> {
    const isProfileVisible = await this.profileTrigger.isVisible({ timeout: TIMEOUTS.quick }).catch(() => false);
    if (!isProfileVisible) {
      const isSidebarToggleVisible = await this.sidebarLogoToggle.isVisible({ timeout: TIMEOUTS.quick }).catch(() => false);
      if (isSidebarToggleVisible) {
        await this.sidebarLogoToggle.click();
      }
    }
    await this.profileTrigger.click();
    await expect(this.profileMainPanel).toBeVisible({ timeout: TIMEOUTS.page });
  }

  /**
   * Assert a successful login redirected to app domain and verify user profile panel.
   *
   * @param expectedEmail Optional user email to verify. If omitted, performs a general check
   *                      verifying that a valid email address is displayed in the profile panel.
   */
  async expectLoginSuccess(expectedEmail?: string): Promise<void> {
    await this.waitForURL(/app\.sleekflow\.io(?!.*\/login)/, { timeout: TIMEOUTS.appRedirect });
    await this.expectURL(/app\.sleekflow\.io/);

    await this.openProfilePanel();

    if (expectedEmail) {
      await expect(
        this.profileMainPanel.getByText(expectedEmail, { exact: false })
      ).toBeVisible({ timeout: TIMEOUTS.page });
    } else {
      // General assertion: verifies an email is present in the profile panel
      await expect(
        this.profileMainPanel.locator('p').filter({ hasText: /@/ })
      ).toBeVisible({ timeout: TIMEOUTS.page });
    }
  }

  /** Assert an Auth0 error alert is visible. */
  async expectErrorVisible(): Promise<void> {
    await expect(this.errorMessage).toBeVisible({ timeout: TIMEOUTS.short });
  }
}
