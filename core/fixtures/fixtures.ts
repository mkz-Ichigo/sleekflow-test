import { test as base } from 'playwright-bdd';
import { LoginPage } from '@pages/LoginPage';
import { SignupPage } from '@pages/SignupPage';

type CustomFixtures = {
  loginPage: LoginPage;
  signupPage: SignupPage;
};

export const test = base.extend<CustomFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  signupPage: async ({ page }, use) => {
    await use(new SignupPage(page));
  },
});
