@signup
Feature: Signup Functionality

  Background:
    Given User is on the signup page

  @negative
  Scenario: Signup with email that already registered
    When User signs up with already registered email
    And User fills in the password
    Then User should see a registration error message

  @smoke @positive
  Scenario: Signup with new email from generator
    When User signs up with newly generated email
    And User fills in the password
    Then User redirect to verification code page

    When User enters verification code
    Then User should complete registration successfully
