import { createBdd } from 'playwright-bdd';
import { test } from '@fixtures/fixtures';
import { testData } from '@utils/helper';

const { Given, When, Then } = createBdd(test);

Given('User is on the login page', async ({ loginPage }) => {
  await loginPage.goto();
});

When('User enters registered email', async ({ loginPage }) => {
  await loginPage.enterEmail(testData.registeredUser.email);
});

When('User enters invalid password', async ({ loginPage }) => {
  await loginPage.enterPassword(testData.invalidPassword);
});

When('User enters invalid email', async ({ loginPage }) => {
  await loginPage.enterEmail(testData.invalidUser.email);
});

When('User logs in with correct email and password', async ({ loginPage }) => {
  await loginPage.login(testData.registeredUser.email, testData.registeredUser.password);
});

Then('User should see an error message', async ({ loginPage }) => {
  await loginPage.expectErrorVisible();
});

Then('User should be redirected to the dashboard', async ({ loginPage }) => {
  await loginPage.expectLoginSuccess(testData.registeredUser.email);
});
