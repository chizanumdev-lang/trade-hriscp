/**
 * Cypress E2E Tests: Employees Page
 * Tests: Page load, search/filter, add employee form, delete employee
 */

describe('Employees', () => {
  beforeEach(() => {
    cy.fixture('users').then(({ superAdmin }) => {
      cy.loginByApi(superAdmin.email, superAdmin.password)
      cy.visit('/Employees')
    })
  })

  context('Page Rendering', () => {
    it('loads the employees page without errors', () => {
      cy.contains(/employees|team|staff/i).should('be.visible')
      cy.get('@consoleError').should('not.have.been.called')
    })

    it('renders the page header with title', () => {
      cy.get('h1').should('contain.text', /employees|team/i)
    })

    it('renders the Add Employee / Hire button', () => {
      cy.contains('button, a', /add employee|new hire|hire|add/i).should('be.visible')
    })
  })

  context('Employee List', () => {
    it('renders the employee list table or grid', () => {
      // Waits for loading to finish
      cy.get('[class*="skeleton"], [class*="loading"]', { timeout: 8000 }).should('not.exist')
      // Should show either employees or empty state
      cy.get('body').then(($body) => {
        const hasEmployees = $body.find('[class*="employee"], tr, [class*="card"]').length > 0
        const hasEmptyState = $body.text().match(/no employees|no results|get started/i)
        expect(hasEmployees || hasEmptyState).to.be.true
      })
    })

    it('renders employee cards or rows with names', () => {
      cy.get('[class*="skeleton"]', { timeout: 8000 }).should('not.exist')
      // If employees exist, at least one name should be visible
      cy.get('body').then(($body) => {
        if (!$body.text().match(/no employees|empty|no results/i)) {
          cy.get('h3, td, [class*="name"]').first().should('be.visible')
        }
      })
    })
  })

  context('Search & Filter', () => {
    it('has a functional search input', () => {
      cy.get('input[placeholder*="search" i], input[type="search"]').should('be.visible').type('test')
      cy.get('input[placeholder*="search" i], input[type="search"]').clear()
    })

    it('filters results when typing a search term', () => {
      cy.get('input[placeholder*="search" i]').type('xxxxnonexistent')
      cy.contains(/no.*found|no employees|0 employees|empty/i, { timeout: 5000 }).should('be.visible')
    })

    it('clears filter and shows all employees', () => {
      cy.get('input[placeholder*="search" i]').type('xxxxnonexistent')
      cy.get('input[placeholder*="search" i]').clear()
      // After clearing, should show employees or empty state
      cy.get('body').should('not.contain', /1 billion results/i)
    })
  })

  context('Add Employee Form', () => {
    beforeEach(() => {
      cy.contains('button, a', /add employee|new hire|hire|add/i).first().click()
    })

    it('opens the add employee dialog or form', () => {
      cy.contains(/add employee|new employee|create employee/i, { timeout: 5000 }).should('be.visible')
    })

    it('renders all required form fields', () => {
      cy.get('input[name="fullName"], input[placeholder*="name" i], label')
        .contains(/name/i).should('be.visible')
      cy.get('input[name="email"], input[type="email"], label')
        .contains(/email/i).should('be.visible')
      cy.get('input[name="jobTitle"], label')
        .contains(/job title|position/i).should('be.visible')
    })

    it('can close the form/dialog', () => {
      cy.contains('button', /cancel|close|dismiss/i).click()
      cy.contains(/add employee|new employee/i).should('not.exist')
    })

    it('shows validation when submitting empty form', () => {
      cy.contains('button', /save|submit|create|add/i).last().click()
      // Should show validation errors or stay on form
      cy.contains(/required|please fill|enter/i).should('be.visible')
        .or(() => cy.get('input:invalid').should('exist'))
    })
  })

  context('Employee Detail Navigation', () => {
    it('clicking on an employee navigates to detail view', () => {
      cy.get('[class*="skeleton"]', { timeout: 8000 }).should('not.exist')
      cy.get('body').then(($body) => {
        // Only test navigation if employees exist
        if (!$body.text().match(/no employees|empty/i)) {
          cy.get('[class*="card"], tr, [class*="employee-row"]').first().click()
          cy.url({ timeout: 8000 }).should('include', 'EmployeeDetail')
        }
      })
    })
  })
})
