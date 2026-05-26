// ***********************************************************
// cypress/support/e2e.js
// This is loaded automatically before every spec file.
// ***********************************************************

import './commands'

// Preserve localStorage between tests so login persists
Cypress.on('window:before:load', (win) => {
  // Stub console.error so we can assert on it if needed
  cy.stub(win.console, 'error').as('consoleError')
})

// Fail tests on uncaught exceptions only if they're not expected
Cypress.on('uncaught:exception', (err) => {
  // Ignore React hydration warnings and non-critical errors
  if (
    err.message.includes('ResizeObserver loop') ||
    err.message.includes('Non-Error promise rejection')
  ) {
    return false
  }
  return true
})

// Global before each: assert app is reachable
beforeEach(() => {
  // Nothing global by default — each spec handles its own setup
})
