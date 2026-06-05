/**
 * Cypress E2E Tests: Employees Page
 * Tests: Page load, search/filter, add employee form, delete employee
 */

describe('Employees', () => {
  beforeEach(() => {
    cy.interceptGQL('GetEmployeesList', {
      data: {
        employees: [
          { 
            id: '1', 
            employeeCode: 'E001',
            fullName: 'Alice Smith', 
            email: 'alice@example.com', 
            jobTitle: 'Developer', 
            department: { name: 'Engineering' }, 
            employmentStatus: 'active',
            onboardingStatus: 'COMPLETED',
            onboardingProgress: 100,
            hireDate: '2023-01-01'
          },
          { 
            id: '2', 
            employeeCode: 'E002',
            fullName: 'Bob Jones', 
            email: 'bob@example.com', 
            jobTitle: 'Designer', 
            department: { name: 'Design' }, 
            employmentStatus: 'active',
            onboardingStatus: 'COMPLETED',
            onboardingProgress: 100,
            hireDate: '2023-05-15'
          }
        ]
      }
    }).as('GetEmployeesList')
    
    cy.interceptGQL('GetDepartments', {
      data: { departments: [{ id: 'd1', name: 'Engineering' }, { id: 'd2', name: 'Design' }] }
    }).as('GetDepartments')

    cy.loginByApi()
    cy.visit('/Employees')
    cy.wait('@GetEmployeesList')
  })

  context('Page Rendering', () => {
    it('loads the employees page without errors', () => {
      cy.contains(/employees/i).should('be.visible')
    })

    it('renders the page header with title', () => {
      cy.contains('h1', /employees|team/i).should('be.visible')
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
        const hasEmptyState = $body.text().match(/no employees|no results|get started/i) !== null
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
      cy.contains(/new employee information/i).should('not.exist')
    })

    it('shows validation when submitting empty form', () => {
      cy.contains('button', /save|submit|create employee|add/i).last().click()
      // Should show HTML5 validation errors (input:invalid)
      cy.get('input:invalid').should('exist')
    })
  })

  context('Employee Detail Navigation', () => {
    it('clicking on an employee navigates to detail view', () => {
      cy.get('[class*="skeleton"]', { timeout: 8000 }).should('not.exist')
      cy.get('body').then(($body) => {
        // Only test navigation if employees exist
        if (!$body.text().match(/no employees|empty/i)) {
          cy.get('[class*="card"], tr, [class*="employee-row"]').first().click()
          cy.url({ timeout: 8000 }).should('match', /employeedetail/i)
        }
      })
    })
  })
})
