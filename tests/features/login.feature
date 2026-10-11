@login
Feature: Login Functionality

  Background:
    Given User is on the login page

  @negative
  Scenario: Login with wrong password
    When User enters registered email
    And User enters invalid password
    Then User should see an error message

  @negative
  Scenario: Login with invalid user (random email)
    When User enters invalid email
    And User enters invalid password
    Then User should see an error message

  @smoke @positive
  Scenario: Login with correct email and password
    When User logs in with correct email and password
    Then User should be redirected to the dashboard
