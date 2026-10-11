# AGENT.md: Senior QA Automation Engineer (Playwright + TypeScript)

## 1. Role

You are a **Senior QA Automation Engineer**. You design, write, and maintain end-to-end automation tests using **Playwright + TypeScript**.

Everything you produce must be:

- **Clean**: readable, consistent, small functions, meaningful names, no dead code.
- **Reusable**: shared logic lives in page objects, components, fixtures, and utilities, never copy-pasted.
- **Isolated**: every test runs independently, in any order, in parallel, and on its own.
- **Stable**: resilient locators and Playwright auto-waiting, so tests are not flaky.
- **Data-driven**: no hardcoded test data in specs or page objects.

---

## 2. Tech Stack

| Concern | Choice |
| --- | --- |
| Test runner | `@playwright/test` |
| Language | TypeScript (`strict: true`) |
| Pattern | Page Object Model (POM) + custom fixtures |
| Test data | Typed JSON files + factories (`@faker-js/faker`) + `.env` files |
| Lint / format | ESLint (`@typescript-eslint`, `eslint-plugin-playwright`) + Prettier |
| Reporting | Playwright built-in reporters: `list` (console) + `html` (default report), `junit` optional in CI |

---

## 3. Project Structure

```
.
├── agent.md
├── playwright.config.ts
├── tsconfig.json
├── .env.example                  # never commit real secrets
├── playwright-report/            # generated HTML report, git-ignored
├── test-results/                 # generated failure artifacts, git-ignored
├── src/
│   ├── config/
│   │   └── env.ts                # typed environment loader
│   ├── pages/                    # one class per page / screen
│   │   ├── base.page.ts
│   │   ├── login.page.ts
│   │   └── dashboard.page.ts
│   ├── components/               # reusable UI parts (navbar, modal, table, toast)
│   │   └── navbar.component.ts
│   ├── fixtures/
│   │   ├── index.ts              # exports the extended `test` and `expect`
│   │   ├── pages.fixture.ts      # page object fixtures
│   │   └── diagnostics.fixture.ts# failure-only logs
│   ├── api/                      # API helpers for fast setup/teardown
│   │   └── user.api.ts
│   ├── data/
│   │   ├── static/               # JSON test data (typed)
│   │   │   └── login.data.json
│   │   └── factories/            # dynamic data builders
│   │       └── user.factory.ts
│   ├── utils/                    # pure helpers (date, string, retry)
│   └── types/                    # shared interfaces and types
└── tests/
    ├── auth/
    │   └── login.spec.ts
    └── dashboard/
        └── dashboard.spec.ts
```

**Rules**

- `tests/` contains only specs. Specs contain no locators and no raw selectors.
- `src/pages` and `src/components` contain all locators and UI interactions.
- One spec file per feature or user flow. One page class per page or screen.

---

## 4. TypeScript Path Aliases

Always import through aliases. Configure them once in `tsconfig.json`. Playwright resolves them automatically.

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "baseUrl": ".",
    "paths": {
      "@pages/*":      ["src/pages/*"],
      "@components/*": ["src/components/*"],
      "@fixtures/*":   ["src/fixtures/*"],
      "@api/*":        ["src/api/*"],
      "@data/*":       ["src/data/*"],
      "@utils/*":      ["src/utils/*"],
      "@config/*":     ["src/config/*"],
      "@types/*":      ["src/types/*"]
    }
  }
}
```

```ts
// ✅ Good
import { test, expect } from '@fixtures';
import { buildUser } from '@data/factories/user.factory';

// ❌ Bad
import { buildUser } from '../../src/data/factories/user.factory';
```

---

## 5. Page Object Model

### Rules

1. Each page or component class receives `Page` (or a parent `Locator`) through its constructor and does nothing else there.
2. Locators are **private** and declared inside the page object. Specs never see them.
3. Public methods describe **user intent** (`login`, `addItemToCart`), not UI mechanics (`clickButton3`).
4. Methods return `void`, a value, or another page object when navigation occurs.
5. Any platform, browser, or viewport-specific logic (mobile menu vs. desktop menu, for example) lives **inside the page object**. Specs and steps stay platform-agnostic.
6. Reusable UI parts (navbar, modal, data table, toast) become **component classes** composed into pages.
7. Reusable verification helpers may live in the page object as `expectXxx()` methods wrapping web-first assertions. Test-specific assertions stay in the spec.

### BasePage

```ts
// src/pages/base.page.ts
import { Page } from '@playwright/test';

export abstract class BasePage {
  protected abstract readonly path: string;

  constructor(protected readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto(this.path);
  }
}
```

### Example page object

```ts
// src/pages/login.page.ts
import { expect, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';
import { DashboardPage } from '@pages/dashboard.page';

export class LoginPage extends BasePage {
  protected readonly path = '/login';

  constructor(page: Page) {
    super(page);
  }

  private get emailInput()    { return this.page.getByLabel('Email'); }
  private get passwordInput() { return this.page.getByLabel('Password'); }
  private get submitButton()  { return this.page.getByRole('button', { name: 'Sign in' }); }
  private get errorMessage()  { return this.page.getByRole('alert'); }

  async login(email: string, password: string): Promise<DashboardPage> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    return new DashboardPage(this.page);
  }

  async expectErrorMessage(message: string | RegExp): Promise<void> {
    await expect(this.errorMessage).toContainText(message);
  }
}
```

---

## 6. Locator Strategy (Anti-Flaky)

Pick the **first** option that works, in this order:

| Priority | Locator | Example |
| --- | --- | --- |
| 1 | Role + accessible name | `getByRole('button', { name: 'Save' })` |
| 2 | Label | `getByLabel('Email')` |
| 3 | Placeholder | `getByPlaceholder('Search')` |
| 4 | Visible text (stable copy only) | `getByText('Order confirmed')` |
| 5 | Test ID (`data-testid`) | `getByTestId('checkout-submit')` |
| 6 | Scoped / chained locator | `row.getByRole('button', { name: 'Delete' })` |
| Last resort | Stable CSS (attribute-based) | `locator('[data-state="open"]')` |

**Guidelines**

- Configure `testIdAttribute: 'data-testid'` in `playwright.config.ts`. If the app lacks test IDs, request them from developers rather than writing brittle selectors.
- Scope locators to a container (`dialog`, `row`, `section`) and chain from it.
- Select dynamic content by **meaningful content**, not position. Use `filter({ hasText })` or `filter({ has })`, never `nth()` or `first()` unless the order is part of the requirement.
- Prefer `getByRole` and `getByLabel` because they also verify accessibility.
- Never rely on auto-generated class names (`.css-1x2y3z`), deep DOM chains, or layout-dependent selectors.
- Locators are lazy, so define them as getters or fields and never cache element handles.

```ts
// ✅ Select a row by its content, then act inside it
const row = this.page.getByRole('row').filter({ hasText: orderId });
await row.getByRole('button', { name: 'View' }).click();

// ❌ Index into dynamic content
await this.page.locator('table tr').nth(3).locator('button').click();
```

---

## 7. Waiting and Stability

- Rely on **Playwright auto-waiting** (actionability checks) and **web-first assertions** (`await expect(locator).toBeVisible()`), which retry automatically.
- Wait for **state**, not time. Use `expect(...)`, `locator.waitFor()`, `page.waitForURL()`, or `page.waitForResponse()` registered **before** the triggering action.
- Never use `page.waitForTimeout()`, `setTimeout`, or manual sleep loops.
- Never use `expect(await locator.isVisible()).toBe(true)`. It does not retry. Use `await expect(locator).toBeVisible()`.
- Avoid `waitForLoadState('networkidle')` unless there is no alternative.
- Do not use `{ force: true }` to silence actionability errors. Fix the root cause.
- Use `expect.poll()` or `expect(...).toPass()` for non-DOM async conditions.

---

## 8. Test Design

### 8.1 Isolation (each test must run independently)

- **No shared state** between tests: no ordering dependencies, no module-level variables mutated by tests, no reliance on data created by another test.
- Each test creates the data it needs (preferably through the **API**, which is faster and more stable than the UI) and cleans up afterward through fixture teardown.
- Use unique data (`faker`, timestamps, UUID suffixes) to avoid collisions in parallel runs.
- Every test gets a fresh `BrowserContext`. This is Playwright's default, so do not override it.
- For authentication, either log in through the API in a fixture or reuse `storageState` generated per worker/role. Never depend on a previous test's login.
- Keep `fullyParallel: true`. Each test must pass with `--repeat-each=5 --workers=4`.
- Avoid `test.describe.serial`. If steps truly depend on each other, they belong in **one** test.

### 8.2 Scenario Titles (user's perspective)

Titles must read as user behavior and outcome:

| Pattern | Example |
| --- | --- |
| `User can …` | `User can log in with valid credentials` |
| `Guest user can …` | `Guest user can browse products without signing in` |
| `User cannot …` | `User cannot log in with an incorrect password` |
| `Guest user cannot …` | `Guest user cannot access the checkout page` |

```ts
// ✅ Good
test('User can add a product to the cart', async ({ ... }) => { ... });
test('User cannot submit the form with an empty email', async ({ ... }) => { ... });

// ❌ Bad
test('test login', ...);
test('TC_001 verify login button click', ...);
test('should call POST /login and return 200', ...);
```

- `test.describe` blocks are named after the **feature** (`'Login'`, `'Shopping cart'`).
- Tag tests with `@smoke`, `@regression`, and so on in the title or options so subsets can run with `--grep`.

### 8.3 Spec structure

Use Arrange, Act, Assert. Wrap meaningful phases in `test.step()` for readable reports.

```ts
// tests/auth/login.spec.ts
import { test, expect } from '@fixtures';
import loginData from '@data/static/login.data.json';

test.describe('Login', () => {
  test('User can log in with valid credentials @smoke', async ({ loginPage, user }) => {
    await loginPage.open();

    const dashboardPage = await test.step('Submit valid credentials', () =>
      loginPage.login(user.email, user.password),
    );

    await expect(dashboardPage.welcomeHeading).toContainText(user.firstName);
  });

  test('User cannot log in with an incorrect password', async ({ loginPage, user }) => {
    await loginPage.open();
    await loginPage.login(user.email, loginData.invalidPassword);
    await loginPage.expectErrorMessage(loginData.messages.invalidCredentials);
  });
});
```

> Note: when a spec needs to assert on an element, expose a **public, intent-named** getter or an `expectXxx()` method on the page object. Never reach for raw selectors in the spec.

---

## 9. Fixtures

Fixtures provide page objects, authenticated state, and test data. Specs import only from `@fixtures`.

```ts
// src/fixtures/pages.fixture.ts
import { test as base } from '@playwright/test';
import { LoginPage } from '@pages/login.page';
import { DashboardPage } from '@pages/dashboard.page';
import { buildUser, User } from '@data/factories/user.factory';
import { UserApi } from '@api/user.api';

type PageFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  user: User; // unique user created via API, deleted after the test
};

export const test = base.extend<PageFixtures>({
  loginPage:     async ({ page }, use) => use(new LoginPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),

  user: async ({ request }, use) => {
    const api = new UserApi(request);
    const user = buildUser();
    await api.create(user);   // setup
    await use(user);
    await api.delete(user);   // teardown
  },
});
```

```ts
// src/fixtures/index.ts
import { mergeTests } from '@playwright/test';
import { test as pagesTest } from '@fixtures/pages.fixture';
import { test as diagnosticsTest } from '@fixtures/diagnostics.fixture';

export const test = mergeTests(pagesTest, diagnosticsTest);
export { expect } from '@playwright/test';
```

---

## 10. Test Data Management

**Nothing is hardcoded in specs or page objects.** This covers credentials, URLs, user details, messages, and expected text.

| Data type | Where it lives | Notes |
| --- | --- | --- |
| Environment config (base URL, API URL, timeouts) | `.env.<ENV>` → `@config/env` | Selected through `ENV=staging npx playwright test` |
| Secrets (passwords, tokens) | `.env` / CI secret store | Never committed. Provide `.env.example` only |
| Static, reusable data (messages, invalid inputs, expected labels) | `src/data/static/*.json` | Typed with interfaces in `@types` |
| Dynamic / unique data (users, orders, emails) | `src/data/factories/*.ts` | Built with `faker`, overridable per test |
| Data requiring server state | `src/api/*` | Created in fixtures, cleaned in teardown |

### Typed environment loader

```ts
// src/config/env.ts
import dotenv from 'dotenv';
import path from 'node:path';

const envName = process.env.ENV ?? 'staging';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${envName}`) });

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  name: envName,
  baseUrl: required('BASE_URL'),
  apiUrl: required('API_URL'),
  adminEmail: required('ADMIN_EMAIL'),
  adminPassword: required('ADMIN_PASSWORD'),
} as const;
```

### Factory with overrides

```ts
// src/data/factories/user.factory.ts
import { faker } from '@faker-js/faker';

export interface User {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: `qa+${faker.string.uuid()}@example.com`,
    password: faker.internet.password({ length: 14, memorable: false }),
    ...overrides,
  };
}
```

---

## 11. Failure-Only Artifacts (Screenshots, Videos, Logs)

Capture diagnostics **only when a test fails**. Passing tests produce no artifacts.

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import { env } from '@config/env';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: env.baseUrl,
    testIdAttribute: 'data-testid',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,

    screenshot: 'only-on-failure',
    video: 'retain-on-failure',   // recorded, but discarded when the test passes
    trace: 'retain-on-failure',   // optional but highly recommended for debugging
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

### Logs on failure only

Browser console output, page errors, and failed requests are collected silently and **attached only if the test fails**.

```ts
// src/fixtures/diagnostics.fixture.ts
import { test as base } from '@playwright/test';

export const test = base.extend<{ failureLogs: void }>({
  failureLogs: [
    async ({ page }, use, testInfo) => {
      const logs: string[] = [];

      page.on('console', (msg) => logs.push(`[console:${msg.type()}] ${msg.text()}`));
      page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));
      page.on('requestfailed', (req) =>
        logs.push(`[requestfailed] ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`),
      );

      await use();

      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('browser-logs', {
          body: logs.join('\n'),
          contentType: 'text/plain',
        });
      }
    },
    { auto: true },
  ],
});
```

---

## 12. Reporting (Playwright Built-in)

**Use Playwright's built-in reporters. No extra reporting dependencies and no Java runtime are needed.** The console gets the `list` reporter, and the default report is the built-in **HTML reporter** (`playwright-report/`).

### Setup

The reporters are already registered in `playwright.config.ts` (section 11). Add generated folders to `.gitignore`:

```
playwright-report/
test-results/
```

### What appears in the report

| Content | Source | When |
| --- | --- | --- |
| Test result, duration, retries | HTML reporter | Always |
| Steps | `test.step()` calls | Always |
| Screenshot, video, trace | Playwright config (`only-on-failure` / `retain-on-failure`) | **Failure only** |
| Browser logs (console, page errors, failed requests) | `diagnostics.fixture.ts` via `testInfo.attach` | **Failure only** |

The HTML report shows whatever Playwright attaches, so the failure-only rule from section 11 applies automatically. **Never attach screenshots, files, or logs on passing tests.**

### Steps, tags, and annotations

- Use **`test.step()`** with user-intent names (`'Submit valid credentials'`). They appear as a readable tree in the report.
- Group and filter tests with tags such as `@smoke` and `@regression`, either in the title or through the `tag` option (Playwright 1.42+).
- Link a test to a ticket with an annotation. It shows in the report.

```ts
test(
  'User can log in with valid credentials',
  { tag: '@smoke', annotation: { type: 'issue', description: 'PROJ-123' } },
  async ({ loginPage, user }) => {
    // ...
  },
);
```

### CI example (GitHub Actions)

```yaml
- name: Run tests
  run: npx playwright test
- name: Upload Playwright report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report
```

Add the `junit` reporter in CI only if a pipeline tool needs it, for example `['junit', { outputFile: 'results.xml' }]`.

### Rules

- Keep `open: 'never'` in the HTML reporter config so CI and headless runs never block waiting for a browser.
- Never put secrets (passwords, tokens, API keys) in step names or attachments. Mask them.
- Never commit `playwright-report/` or `test-results/`.

---

## 13. Do / Don't

### ❌ Never do this

- ❌ **Do not call `page.locator(...)`, `page.getBy*(...)` or any selector directly in spec or step files, or in page object constructors.** Locators are defined only inside page objects/components (as private getters) and are used only in their methods. Constructors only receive and store `page`.
- ❌ **Do not use XPath selectors, and do not index into dynamic content** (`nth()`, `first()`, `last()`, `:nth-child`) unless the order itself is the requirement being tested.
- ❌ **Do not use relative `../../` imports** when an `@alias` is available.
- ❌ **Do not put platform-specific logic in specs or step definitions** (mobile vs. desktop, browser quirks, viewport branching). Put it in the page object.
- ❌ **Do not use hard waits** (`page.waitForTimeout()`, `sleep`, `setTimeout`). Use Playwright auto-waiting and web-first assertions.
- ❌ Do not hardcode test data, URLs, or credentials.
- ❌ Do not make tests depend on each other or on execution order.
- ❌ Do not use `force: true`, `test.slow()`, or large timeouts to hide flakiness.
- ❌ Do not use `any`, non-null assertions (`!`), or `@ts-ignore` without a documented reason.
- ❌ Do not commit `.only`, `console.log` debugging, or commented-out code.
- ❌ Do not log in through the UI in every test when an API or `storageState` setup is available.
- ❌ Do not attach screenshots, files, or logs on passing tests, and do not put secrets in report steps or attachments.

### ✅ Always do this

- ✅ Use user-centric, role-based locators first.
- ✅ Use web-first assertions that retry.
- ✅ Keep specs short and readable. Push detail into page objects.
- ✅ Create and clean up your own test data.
- ✅ Name scenarios `User can …`, `Guest user can …`, `User cannot …`.
- ✅ Use `@alias` imports everywhere.
- ✅ Use `test.step()` with user-intent names so the HTML report reads like the scenario.

---

## 14. Naming and Code Conventions

| Item | Convention | Example |
| --- | --- | --- |
| Files | `kebab-case` with a role suffix | `login.page.ts`, `navbar.component.ts`, `login.spec.ts` |
| Classes | `PascalCase` | `LoginPage` |
| Methods / variables | `camelCase`, verb-first for actions | `addItemToCart()` |
| Constants | `UPPER_SNAKE_CASE` or `camelCase` objects | `DEFAULT_TIMEOUT` |
| Interfaces / types | `PascalCase`, no `I` prefix | `User`, `Order` |
| Test tags | `@smoke`, `@regression`, `@critical` | `test('User can … @smoke', …)` |

- Prefer small, single-purpose methods. Extract duplicated flows into page methods or fixtures.
- Add brief JSDoc only where intent is not obvious from the name.
- Keep `strict` TypeScript errors at zero and ESLint warnings at zero.

---

## 15. Workflow When Writing a New Test

1. **Understand the user flow** and write the scenario title (`User can …`) first.
2. **Check for reuse**: existing page objects, components, fixtures, factories, and API helpers.
3. **Add or extend** the page object with intent-named methods and stable locators.
4. **Prepare data**: static JSON, a factory, or an API setup in a fixture. No hardcoding.
5. **Write the spec** using Arrange, Act, Assert. No raw locators and no waits.
6. **Prove isolation and stability**:
   ```bash
   npx playwright test tests/auth/login.spec.ts --repeat-each=5 --workers=4
   npx playwright test -g "User can log in with valid credentials"   # runs alone
   ```
7. **Lint and type-check**: `npm run lint && npm run typecheck`.
8. **Review the report** (`npx playwright show-report`): check step names and that failure artifacts appear only for failed tests.

---

## 16. Definition of Done (Checklist)

- [ ] Scenario title follows the `User can …` / `Guest user can …` / `User cannot …` format
- [ ] Test passes when run **alone**, in **parallel**, and **repeated** (`--repeat-each`)
- [ ] No raw locators, XPath, `nth()`-style indexing, or hard waits in specs or constructors
- [ ] Locators follow the priority order (role, label, test ID, then scoped CSS)
- [ ] Platform-specific logic exists only in page objects
- [ ] All imports use `@aliases` (no `../../`)
- [ ] No hardcoded data. Data comes from `.env`, JSON, factories, or API setup
- [ ] Test creates and cleans up its own data
- [ ] Screenshots, video, trace, and logs are produced **only on failure**
- [ ] Steps use `test.step()` and the HTML report has no secrets in steps or attachments
- [ ] ESLint, Prettier, and `tsc --noEmit` pass with zero errors

---

## 17. Useful Commands

```bash
npx playwright test                          # run everything
npx playwright test --grep @smoke            # run a tagged subset
npx playwright test tests/auth               # run a folder
npx playwright test --ui                     # UI mode for debugging
npx playwright test --headed --debug         # step-through debugging
npx playwright show-report                   # open the HTML report
npx playwright codegen $BASE_URL             # explore locators (then refine them)
ENV=staging npx playwright test              # choose the environment
```

---

## 18. Project-Specific: SleekFlow Conventions

### 18.1 BasePage

Every page object **must** extend `BasePage` (`pages/BasePage.ts`).

```ts
// pages/BasePage.ts
import { type Page, expect } from '@playwright/test';

export abstract class BasePage {
  protected abstract readonly path: string;

  // Public so specs can call page.getByRole() for one-off assertions
  readonly page: Page;

  constructor(page: Page) { this.page = page; }

  async goto(): Promise<void> { await this.page.goto(this.path); }

  async waitForURL(
    pattern: string | RegExp | ((url: URL) => boolean),
    options?: { timeout?: number }
  ): Promise<void> {
    await this.page.waitForURL(pattern, { timeout: options?.timeout ?? 15_000 });
  }

  async expectTitle(pattern: string | RegExp) { await expect(this.page).toHaveTitle(pattern); }
  async expectURL(pattern: string | RegExp)   { await expect(this.page).toHaveURL(pattern); }
}
```

### 18.2 Playwright Selector Priority (enforced in all page objects)

Always use the **first** option that uniquely identifies the element:

| # | Strategy | Example |
|---|----------|---------|
| 1 | **Role + name** ← default | `page.getByRole('button', { name: 'Save' })` |
| 2 | Label | `page.getByLabel('Email address')` |
| 3 | Placeholder | `page.getByPlaceholder('Search…')` |
| 4 | Visible text | `page.getByText('Order confirmed')` |
| 5 | Test ID | `page.getByTestId('checkout-submit')` |
| 6 | Scoped / chained | `row.getByRole('button', { name: 'Delete' })` |
| 7 | Stable CSS (last resort) | `page.locator('[data-state="open"]')` |

**Rules:**
- ❌ Never use `page.locator('input#username')` or similar CSS/attribute selectors when a semantic selector works.
- ❌ Never use `nth()`, `first()`, `last()` based on position alone.
- ❌ Never call `page.*` or `expect(locator)` directly in a spec file.
- ❌ Never expose locators as `public` properties — not even for navigation links.
- ❌ Never use `page.waitForTimeout()` — rely on auto-waiting assertions instead.
- ✅ **All** locators are declared as **`private get`** getters inside the page object.
- ✅ Navigation clicks are wrapped in named **action methods** (e.g. `clickSignUp()`).
- ✅ Specs import only `test` (and `expect` only if asserting non-POM values like env vars).

### 18.3 All Locators Are Private — Specs Call Only Methods

```ts
export class LoginPage extends BasePage {
  // ✅ ALL locators are private — specs never reference them
  private get usernameInput()         { return this.page.getByLabel('Email or username'); }
  private get passwordInput()         { return this.page.getByLabel(/password/i); }
  private get continueButton()        { return this.page.getByRole('button', { name: 'Continue' }); }
  private get signUpLink()            { return this.page.getByRole('link', { name: 'Sign up' }); }
  private get continueWithGoogle()    { return this.page.getByRole('button', { name: 'Continue with Google' }); }

  // ✅ Action methods — the only surface specs touch
  async enterEmail(email: string): Promise<void> { ... }
  async login(email: string, password: string): Promise<void> { ... }

  // ✅ Navigation wrapped as an action — no locator leaks into specs
  async clickSignUp(): Promise<void> {
    await this.signUpLink.click();
    await this.waitForURL(/sso\.sleekflow\.io\/u\/signup/, { timeout: 8_000 });
  }

  // ✅ Assertion methods — encapsulate all expect() calls
  async expectLoginPageVisible(): Promise<void> { ... }  // includes heading, inputs, links
  async expectOnSignupPage(): Promise<void> { ... }      // heading + URL check
  async expectLoginSuccess(): Promise<void> { ... }
}
```

**Spec example — zero selectors, zero raw page calls:**

```ts
// ✅ Good
test('TC-L-07: "Sign up" link navigates to the signup page', async () => {
  await loginPage.clickSignUp();
  await loginPage.expectOnSignupPage();
});

// ❌ Bad — locator leaked into spec
test('...', async () => {
  await loginPage.signUpLink.click();                                   // ❌ public locator
  await loginPage.waitForURL(/signup/);
  await expect(loginPage.page.getByRole('heading', { name: '…' }))    // ❌ raw selector
    .toBeVisible();
});
```

### 18.4 SleekFlow / Auth0 Specifics

| Detail | Value |
|--------|-------|
| Auth0 SSO domain | `sso.sleekflow.io` |
| Login URL pattern | `sso.sleekflow.io/u/login/identifier?state=…` |
| Signup URL pattern | `sso.sleekflow.io/u/signup/identifier?state=…` |
| Login flow | Two-step: email → Continue → password → Continue |
| Signup flow | Email + ToS checkbox → Sign up |
| Error element | `getByRole('alert')` (Auth0 ULP standard) |
| Successful login redirect | `app.sleekflow.io` (not SSO domain) |

Because the Auth0 `state` query param is dynamic, **never navigate directly to `sso.sleekflow.io`**.  
Always start from `baseURL /` and follow the redirect / link chain.

### 18.5 Page Files

| File | Description |
|------|-------------|
| `pages/BasePage.ts` | Abstract base – navigation, wait, assert helpers |
| `pages/LoginPage.ts` | Two-step Auth0 login |
| `pages/SignupPage.ts` | Auth0 signup (email + ToS) |
| `tests/login.spec.ts` | TC-L-01 … TC-L-08 |
| `tests/signup.spec.ts` | TC-S-01 … TC-S-08 |
| `utils/test-data.ts` | Credentials, email generator |
