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
  cy.request({
    method: 'POST',
    url: Cypress.env('graphqlUrl'),
    body: {
      query: `
        mutation Login($email: String!, $password: String!) {
          login(email: $email, password: $password) {
            token
            user {
              id
              email
              role
              organizationId
              employeeId
              isOrgOwner
            }
          }
        }
      `,
      variables: { email, password },
    },
  }).then((response) => {
    expect(response.status).to.eq(200)
    expect(response.body.errors).to.be.undefined

    const { token, user } = response.body.data.login
    window.localStorage.setItem('authToken', token)
    window.localStorage.setItem('currentUser', JSON.stringify(user))
    Cypress.env('authToken', token)
    Cypress.env('currentUser', user)
  })
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
  window.localStorage.removeItem('authToken')
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
      Authorization: `Bearer ${Cypress.env('authToken')}`,
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
