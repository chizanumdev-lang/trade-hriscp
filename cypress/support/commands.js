// ***********************************************
// cypress/support/commands.js
// Custom commands for Tradevu HR test suite
// ***********************************************

/**
 * Login via GraphQL API and store the token in localStorage.
 * Bypasses the UI login for speed in non-auth tests.
 * Usage: cy.loginByApi('email', 'password')
 */
Cypress.Commands.add('loginByApi', (email, password) => {
  // Mock login: bypassing the network request for speed in mocked E2E tests
  const token = 'mock-jwt-token'
  const user = {
    id: '1',
    email: email || 'superadmin@tradevu.com',
    role: 'SUPER_ADMIN',
    organizationId: 'org1',
    employeeId: 'emp1',
    isOrgOwner: true
  }

  // Set localStorage reliably before app code runs on the next visit
  cy.on('window:before:load', (win) => {
    win.localStorage.setItem('token', token)
    win.localStorage.setItem('currentUser', JSON.stringify(user))
  })
  
  // Intercept the Me query that AuthContext calls on app mount
  cy.interceptGQL('Me', {
    data: {
      me: user
    }
  })
  
  Cypress.env('token', token)
  Cypress.env('currentUser', user)
})

/**
 * Login through the UI login page.
 * Usage: cy.loginByUI('email', 'password')
 */
Cypress.Commands.add('loginByUI', (email, password) => {
  cy.visit('/login')
  cy.get('[data-testid="email-input"]').clear().type(email)
  cy.get('[data-testid="password-input"]').clear().type(password)
  cy.get('[data-testid="login-submit"]').click()
  cy.url().should('not.include', '/login')
})

/**
 * Logout the current user.
 * Usage: cy.logout()
 */
Cypress.Commands.add('logout', () => {
  window.localStorage.removeItem('token')
  window.localStorage.removeItem('currentUser')
})

/**
 * Make a GraphQL request using the stored auth token.
 * Usage: cy.gql(query, variables)
 */
Cypress.Commands.add('gql', (query, variables = {}) => {
  return cy.request({
    method: 'POST',
    url: Cypress.env('graphqlUrl'),
    headers: {
      Authorization: `Bearer ${Cypress.env('token')}`,
      'Content-Type': 'application/json',
    },
    body: { query, variables },
  })
})

/**
 * Navigate to a page by name (uses the app's URL patterns).
 * Usage: cy.navigateTo('Employees')
 */
Cypress.Commands.add('navigateTo', (pageName) => {
  const routes = {
    Dashboard: '/',
    Employees: '/Employees',
    Payroll: '/Payroll',
    Loans: '/Loans',
    Expenses: '/Expenses',
    Leave: '/AllLeaveRequests',
    Attendance: '/Attendance',
    Training: '/Training',
    Performance: '/Performance',
    Settings: '/Settings',
    Login: '/Login',
  }
  cy.visit(routes[pageName] || '/')
})

/**
 * Assert no console errors are present.
 * Usage: cy.noConsoleErrors()
 */
Cypress.Commands.add('noConsoleErrors', () => {
  cy.window().then((win) => {
    expect(win.consoleError).to.be.undefined
  })
})

/**
 * Intercept GraphQL operations by operation name.
 * Usage: cy.interceptGQL('GetEmployees', { data: { employees: [] } })
 */
Cypress.Commands.add('interceptGQL', (operationName, responseOverride) => {
  cy.intercept('POST', Cypress.env('graphqlUrl'), (req) => {
    let matches = false;
    if (typeof req.body === 'string') {
      matches = req.body.includes(operationName);
    } else if (req.body) {
      matches = (req.body.operationName === operationName) || 
                (req.body.query && req.body.query.includes(operationName));
    }

    if (matches) {
      req.alias = operationName;
      req.reply({
        statusCode: 200,
        body: responseOverride,
      })
    }
  })
})
