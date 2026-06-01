/**
 * Cypress E2E Tests: Navigation & Routing
 * Tests: All sidebar links, page transitions, URL correctness
 */

describe('Navigation & Routing', () => {
  beforeEach(() => {
    cy.fixture('users').then(({ superAdmin }) => {
      cy.loginByApi(superAdmin.email, superAdmin.password)
      cy.visit('/')
    })
  })

  const adminRoutes = [
    { label: 'Dashboard', path: '/', heading: /dashboard/i },
    { label: 'Employees', path: '/Employees', heading: /employees/i },
    { label: 'Payroll', path: '/Payroll', heading: /payroll/i },
    { label: 'Loans', path: '/Loans', heading: /loans/i },
    { label: 'Expenses', path: '/Expenses', heading: /expense/i },
    { label: 'Performance', path: '/Performance', heading: /performance/i },
    { label: 'Attendance', path: '/Attendance', heading: /attendance/i },
  ]

  context('Direct URL Navigation', () => {
    adminRoutes.forEach(({ label, path, heading }) => {
      it(`navigates to ${label} page at ${path}`, () => {
        cy.visit(path)
        cy.get('h1, h2').contains(heading, { timeout: 8000 }).should('be.visible')
      })
    })
  })

  context('Sidebar Link Navigation', () => {
    it('Dashboard link navigates to root', () => {
      cy.contains('a', /dashboard/i).first().click()
      cy.url().should('eq', Cypress.config('baseUrl') + '/')
    })

    it('Employees link navigates to employees page', () => {
      // Expand parent if collapsible
      cy.contains(/employees/i).click()
      cy.contains('a', /all employees/i).click({ force: true })
      cy.url({ timeout: 8000 }).should('include', 'employees')
    })

    it('Payroll group expands to show sub-items', () => {
      cy.contains(/payroll/i).click()
      cy.contains(/loans/i, { timeout: 5000 }).should('be.visible')
      cy.contains(/expenses/i).should('be.visible')
    })

    it('Loans sub-link navigates to loans page', () => {
      cy.contains(/payroll/i).click()
      cy.contains('a', /loans/i).click({ force: true })
      cy.url({ timeout: 8000 }).should('include', 'loans')
      cy.contains(/loan/i).should('be.visible')
    })

    it('Expenses sub-link navigates to expenses page', () => {
      cy.contains(/payroll/i).click()
      cy.contains('a', /expenses/i).click({ force: true })
      cy.url({ timeout: 8000 }).should('include', 'expenses')
      cy.contains(/expense/i).should('be.visible')
    })

    it('Performance link navigates correctly', () => {
      cy.contains('a', /performance/i).click({ force: true })
      cy.url({ timeout: 8000 }).should('include', 'performance')
    })
  })

  context('Page Not Found', () => {
    it('shows 404 page for unknown routes', () => {
      cy.visit('/this-route-does-not-exist-xyz', { failOnStatusCode: false })
      cy.contains(/not found|404|page.*not.*exist/i, { timeout: 8000 }).should('be.visible')
    })
  })

  context('Settings (Admin Only)', () => {
    it('Settings link is visible for admins in sidebar', () => {
      cy.contains('button, a', /settings/i).should('be.visible')
    })

    it('Settings link navigates to Settings page', () => {
      cy.contains('button, a', /settings/i).click({ force: true })
      cy.url({ timeout: 8000 }).should('include', 'settings')
    })
  })
})
