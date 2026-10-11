import { expect } from '@playwright/test';
import { BasePage } from '@basepages/BasePage';
import { URLS } from '@config/urls';
import { TIMEOUTS } from '@config/timeouts';

/**
 * Page Object Model for the SleekFlow signup page.
 *
 * SleekFlow signup is hosted on Auth0 (sso.sleekflow.io/u/signup) with a two-step flow:
 *   Step 1 (Identifier) – enter email + accept Terms of Service → Sign up
 *   Step 2 (Password)   – enter password → Sign up
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
export class SignupPage extends BasePage {
  protected readonly path = URLS.login;
  public currentEmail: string = '';

  // ── Private locators (specs never access these) ──────────────

  private get createAccountHeading() {
    return this.page.getByRole('heading', { name: 'Create your account' });
  }

  private get emailInput() {
    return this.page.getByLabel('Email address');
  }

  private get termsCheckbox() {
    return this.page.getByRole('checkbox', { name: /terms of service/i });
  }

  private get signUpButton() {
    return this.page.getByRole('button', { name: 'Sign up' });
  }

  private get passwordInput() {
    return this.page.getByRole('textbox', { name: 'Password' });
  }

  private get submitPasswordButton() {
    return this.page.getByRole('button', { name: /^(Sign up|Continue)$/ });
  }

  private get errorMessage() {
    return this.page
      .getByText(/(couldn[’']t complete your registration|registration is not allowed|already registered|already exists|something went wrong)/i)
      .or(this.page.getByRole('alert'))
      .or(this.page.locator('[data-error-message], [role="alert"], #error-element-password'));
  }

  private get codeInput() {
    return this.page
      .getByRole('textbox', { name: /6-digit verification code/i })
      .or(this.page.getByRole('textbox', { name: /(code|verification|otp)/i }))
      .or(this.page.locator('input[name="code"], input[id="code"], input[autocomplete="one-time-code"]'));
  }

  private get verifyButton() {
    return this.page
      .getByRole('button', { name: /I[’']ve verified my email/i })
      .or(this.page.getByRole('button', { name: /(verify|continue|confirm|submit)/i }));
  }

  private get companyDetailsText() {
    return this.page.getByText(/Welcome!\s*Let[’']s confirm your company info\./i);
  }

  // ── Navigation ───────────────────────────────────────────────

  /**
   * Navigate to the signup page:
   *   1. Go to root → redirected to Auth0 login
   *   2. Click "Sign up" link → arrives at Auth0 signup
   */
  override async goto(): Promise<void> {
    await this.page.goto(this.path);
    await this.waitForURL(/sso\.sleekflow\.io\/u\/login/, { timeout: TIMEOUTS.sso });
    await this.page.getByRole('link', { name: 'Sign up' }).click();
    await this.waitForURL(/sso\.sleekflow\.io\/u\/signup/, { timeout: TIMEOUTS.page });
    await expect(this.createAccountHeading).toBeVisible({ timeout: TIMEOUTS.page });
  }

  // ── Actions ──────────────────────────────────────────────────

  /** Fill in the email, optionally accept ToS, and click "Sign up". */
  async enterEmail(email: string, acceptTerms = true): Promise<void> {
    if (email) {
      await this.emailInput.fill(email);
    }
    if (acceptTerms) {
      await this.termsCheckbox.check({ force: true });
    }
    await this.signUpButton.click();
  }

  /** Fill in the email verification OTP code and submit. */
  async enterVerificationCode(code: string): Promise<void> {
    const singleInput = this.codeInput;
    if ((await singleInput.count()) > 0) {
      await singleInput.first().fill(code);
    } else {
      const digitInputs = this.page.locator('input[type="text"], input[type="tel"], input[inputmode="numeric"]');
      const count = await digitInputs.count();
      if (count >= code.length) {
        for (let i = 0; i < code.length; i++) {
          await digitInputs.nth(i).fill(code[i]);
        }
      }
    }

    if (await this.verifyButton.isVisible({ timeout: TIMEOUTS.quick }).catch(() => false)) {
      await this.verifyButton.click();
    }
  }

  /** Fill in the password and submit the password step. */
  async enterPassword(password: string): Promise<void> {
    if (password) {
      await this.passwordInput.fill(password);
    }
    await this.submitPasswordButton.click();
  }

  // ── Assertions ───────────────────────────────────────────────

  /** Assert Auth0 has navigated to the signup password step. */
  async expectPasswordStepVisible(): Promise<void> {
    await this.waitForURL(/sso\.sleekflow\.io\/u\/signup\/password/, { timeout: TIMEOUTS.page });
    await expect(this.passwordInput).toBeVisible();
  }

  /** Assert the email verification / OTP challenge step is visible. */
  async expectVerificationStepVisible(): Promise<void> {
    await expect(this.codeInput).toBeVisible({ timeout: TIMEOUTS.page });
  }

  /**
   * Assert successful signup after OTP confirmation:
   * 1. Redirects to company onboarding page (https://app.sleekflow.io/en/register-company)
   * 2. The welcome copy "Welcome! Let's confirm your company info." is visible.
   */
  async expectSignupSuccess(): Promise<void> {
    await this.waitForURL(/app\.sleekflow\.io\/.*register-company/, {
      timeout: TIMEOUTS.appRedirect,
    });
    await this.expectURL(/app\.sleekflow\.io\/.*register-company/);
    await expect(this.companyDetailsText).toBeVisible({ timeout: TIMEOUTS.page });
  }

  /** Assert Auth0 kept us within the SSO domain (e.g. after a rejected signup). */
  async expectStillOnSSODomain(): Promise<void> {
    await this.expectURL(/sso\.sleekflow\.io/);
  }

  /** Assert an Auth0 error alert is visible. */
  async expectErrorVisible(): Promise<void> {
    await expect(this.errorMessage.first()).toBeVisible({ timeout: TIMEOUTS.medium });
  }
}
