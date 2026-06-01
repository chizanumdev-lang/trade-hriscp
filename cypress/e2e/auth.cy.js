/**
 * Cypress E2E Tests: Authentication
 * Tests: Login page UI, valid login, invalid login, logout, route protection
 */

describe('Authentication', () => {
  beforeEach(() => {
    cy.logout()
  })

  context('Login Page UI', () => {
    beforeEach(() => cy.visit('/Login'))

    it('renders the login page with all required elements', () => {
      cy.contains(/sign in|log in|tradevu/i).should('be.visible')
      cy.get('input[type="email"], [data-testid="email-input"]').should('be.visible')
      cy.get('input[type="password"], [data-testid="password-input"]').should('be.visible')
      cy.get('button[type="submit"], [data-testid="login-submit"]').should('be.visible')
    })

    it('shows validation errors for empty submission', () => {
      cy.get('button[type="submit"], [data-testid="login-submit"]').click()
      // Browser-native or custom validation should fire
      cy.get('input[type="email"]').then(($el) => {
        expect($el[0].validity.valid).to.be.false
      })
    })

    it('shows error on invalid credentials', () => {
      cy.fixture('users').then(({ invalidUser }) => {
        cy.get('input[type="email"]').type(invalidUser.email)
        cy.get('input[type="password"]').type(invalidUser.password)
        cy.get('button[type="submit"]').click()
        // Should show error message, not navigate away
        cy.url().should('include', 'Login')
        cy.contains(/invalid|incorrect|wrong|not found/i, { timeout: 8000 }).should('be.visible')
      })
    })
  })

  context('Successful Login Flow', () => {
    it('logs in as super admin and lands on dashboard', () => {
      cy.fixture('users').then(({ superAdmin }) => {
        cy.visit('/Login')
        cy.get('input[type="email"]').type(superAdmin.email)
        cy.get('input[type="password"]').type(superAdmin.password)
        cy.get('button[type="submit"]').click()

        // Should redirect away from login
        cy.url({ timeout: 10000 }).should('not.include', 'Login')
        // Dashboard or main content should be visible
        cy.contains(/dashboard|employees|hr management/i, { timeout: 8000 }).should('be.visible')
      })
    })

    it('stores auth token in localStorage after login', () => {
      cy.fixture('users').then(({ superAdmin }) => {
        cy.loginByApi(superAdmin.email, superAdmin.password)
        cy.visit('/')
        cy.window().then((win) => {
          const token = win.localStorage.getItem('token')
          expect(token).to.be.a('string').and.not.be.empty
        })
      })
    })
  })

  context('Route Protection', () => {
    it('redirects unauthenticated users from protected pages to login', () => {
      // Without token, visiting protected route should redirect
      cy.visit('/Employees')
      cy.url({ timeout: 8000 }).should('satisfy', (url) => {
        return url.includes('Login') || url.includes('login')
      })
    })

    it('allows authenticated users to access protected pages', () => {
      cy.fixture('users').then(({ superAdmin }) => {
        cy.loginByApi(superAdmin.email, superAdmin.password)
        cy.visit('/Employees')
        cy.url({ timeout: 8000 }).should('not.include', 'Login')
        cy.contains(/employees/i).should('be.visible')
      })
    })
  })

  context('Logout', () => {
    it('logs out and redirects to login page', () => {
      cy.fixture('users').then(({ superAdmin }) => {
        cy.loginByApi(superAdmin.email, superAdmin.password)
        cy.visit('/')

        // Find and click logout (in sidebar dropdown)
        cy.contains('button', /admin|user/i).click()
        cy.contains(/logout|sign out/i).click()

        cy.url({ timeout: 8000 }).should('include', 'login')
        cy.window().then((win) => {
          expect(win.localStorage.getItem('token')).to.be.null
        })
      })
    })
  })
})
