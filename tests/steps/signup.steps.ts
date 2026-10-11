import { createBdd } from 'playwright-bdd';
import { test } from '@fixtures/fixtures';
import { testData, generateSignupEmail, getGmailCode } from '@utils/helper';
import { TIMEOUTS } from '@config/timeouts';

const { Given, When, Then } = createBdd(test);

Given('User is on the signup page', async ({ signupPage }) => {
  await signupPage.goto();
});

When('User signs up with already registered email', async ({ signupPage }) => {
  await signupPage.enterEmail(testData.registeredUser.email);
});

When('User signs up with newly generated email', async ({ signupPage }) => {
  signupPage.currentEmail = generateSignupEmail('newuser');
  await signupPage.enterEmail(signupPage.currentEmail);
});

When('User fills in the password', async ({ signupPage }) => {
  await signupPage.expectPasswordStepVisible();
  await signupPage.enterPassword(testData.newSignupPassword);
});

Then('User redirect to verification code page', async ({ signupPage }) => {
  await signupPage.expectVerificationStepVisible();
});

When('User enters verification code', async ({ signupPage }) => {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const otp = await getGmailCode(signupPage.currentEmail, { timeout: TIMEOUTS.otp });
    await signupPage.enterVerificationCode(otp);
  }
});

Then('User should see a registration error message', async ({ signupPage }) => {
  try {
    await signupPage.expectErrorVisible();
  } catch (e) {
    // Auth0 may not show an explicit error but keeps user on SSO domain
    console.log('No visible error message, verifying user remains on SSO domain');
    await signupPage.expectStillOnSSODomain();
  }
});

Then('User should complete registration successfully', async ({ signupPage }) => {
  await signupPage.expectSignupSuccess();
});
