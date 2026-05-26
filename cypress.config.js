import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx}',
    supportFile: 'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',
    videosFolder: 'cypress/videos',
    screenshotsFolder: 'cypress/screenshots',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    // Run against the real backend at localhost:3001
    env: {
      graphqlUrl: 'http://localhost:3001/graphql',
      adminEmail: 'superadmin@tradevu.com',
      adminPassword: 'Admin@12345',
    },
    setupNodeEvents(on, config) {
      // Log failed tests clearly
      on('after:run', (results) => {
        if (results && results.totalFailed > 0) {
          console.error(`\n❌ ${results.totalFailed} Cypress test(s) failed`)
        } else if (results) {
          console.log(`\n✅ All ${results.totalPassed} Cypress tests passed!`)
        }
      })
    },
  },
})
