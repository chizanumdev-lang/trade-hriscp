/**
 * Cypress E2E Tests: Loans Page
 * Tests: Page load, loan cards, new loan request form, loan stats
 */

describe('Loans', () => {
  beforeEach(() => {
    cy.fixture('users').then(({ superAdmin }) => {
      cy.loginByApi(superAdmin.email, superAdmin.password)
      cy.visit('/Loans')
    })
  })

  context('Page Rendering', () => {
    it('loads the loans page without errors', () => {
      cy.contains(/loan/i).should('be.visible')
      cy.get('@consoleError').should('not.have.been.called')
    })

    it('renders the page header with correct title', () => {
      cy.get('h1').contains(/loans/i).should('be.visible')
    })

    it('renders the Loan Management badge', () => {
      cy.contains(/loan management/i).should('be.visible')
    })

    it('renders description text', () => {
      cy.contains(/manage.*track.*loan|loan request/i).should('be.visible')
    })
  })

  context('New Loan Request Button', () => {
    it('renders the New Loan Request button', () => {
      cy.contains('button', /new loan request/i).should('be.visible')
    })

    it('opens the loan request dialog on click', () => {
      cy.contains('button', /new loan request/i).click()
      cy.contains(/new loan request/i, { timeout: 5000 }).should('be.visible')
    })
  })

  context('Loan Request Dialog', () => {
    beforeEach(() => {
      cy.contains('button', /new loan request/i).click()
      cy.contains(/new loan request/i, { timeout: 5000 }).should('be.visible')
    })

    it('renders Loan Type select', () => {
      cy.contains(/loan type/i).should('be.visible')
    })

    it('renders Amount field', () => {
      cy.contains(/amount/i).should('be.visible')
      cy.get('input[type="number"]').should('have.length.gte', 1)
    })

    it('renders Duration (Months) field', () => {
      cy.contains(/duration|months/i).should('be.visible')
    })

    it('renders Reason textarea', () => {
      cy.contains(/reason/i).should('be.visible')
      cy.get('textarea').should('be.visible')
    })

    it('renders Monthly Installment calculated display', () => {
      cy.contains(/monthly instalment|monthly installment/i).should('be.visible')
    })

    it('renders Paid From field', () => {
      cy.contains(/paid from/i).should('be.visible')
    })

    it('calculates monthly installment dynamically', () => {
      // Set amount and duration and verify calculation updates
      cy.get('input[type="number"]').first().clear().type('12000')
      cy.get('input[type="number"]').eq(1).clear().type('12')
      cy.contains(/SAR 1,000|1000/i).should('exist')
    })

    it('can close the dialog with Cancel button', () => {
      cy.contains('button', /cancel/i).click()
      // Dialog should close
      cy.contains(/new loan request/i).should('not.exist')
    })

    it('shows admin employee selector when admin is logged in', () => {
      cy.contains(/employee/i).should('be.visible')
    })
  })

  context('Empty State', () => {
    it('shows empty state with no loans', () => {
      // Loans query returns [] in mock, so empty state should render
      cy.contains(/no loans|create your first|no loan/i, { timeout: 5000 }).should('be.visible')
    })

    it('empty state has a New Loan Request button', () => {
      cy.get('body').then(($body) => {
        if ($body.text().match(/no loans|no loan/i)) {
          cy.contains('button', /new loan request/i).should('be.visible')
        }
      })
    })
  })

  context('Loan Type Options', () => {
    beforeEach(() => {
      cy.contains('button', /new loan request/i).click()
    })

    it('loan type select contains correct options', () => {
      cy.contains(/loan type/i).parent().within(() => {
        cy.contains(/standard|emergency|advance|personal/i).should('exist')
      })
    })
  })
})
