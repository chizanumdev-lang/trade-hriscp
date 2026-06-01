/**
 * Cypress E2E Tests: Dashboard
 * Tests: Layout rendering, stat cards, navigation sidebar, quick actions
 */

describe('Dashboard', () => {
  beforeEach(() => {
    cy.fixture('users').then(({ superAdmin }) => {
      cy.loginByApi(superAdmin.email, superAdmin.password)
      cy.visit('/')
    })
  })

  context('Layout & Navigation Sidebar', () => {
    it('renders the main navigation sidebar', () => {
      cy.get('aside, [data-sidebar], nav').should('be.visible')
    })

    it('shows Tradevu branding in the sidebar header', () => {
      cy.contains(/tradevu/i).should('be.visible')
    })

    it('renders all top-level navigation items', () => {
      const navItems = ['Dashboard', 'Employees', 'Payroll', 'Recruitment', 'Performance', 'Analytics']
      navItems.forEach((item) => {
        cy.contains(item).should('be.visible')
      })
    })

    it('highlights the active navigation item when on dashboard', () => {
      // Active nav item should have a distinct style (purple background in this app)
      cy.contains('a', 'Dashboard').should('have.class', 'text-purple-700').or('have.attr', 'aria-current', 'page')
        .or('have.class', 'bg-purple-50')
    })

    it('expands collapsible nav groups on click', () => {
      // Payroll group is collapsible
      cy.contains('Payroll').click()
      cy.contains('Loans').should('be.visible')
      cy.contains('Expenses').should('be.visible')
    })

    it('renders user info in sidebar footer', () => {
      cy.get('[data-sidebar="footer"], aside footer, nav footer')
        .should('be.visible')
        .within(() => {
          cy.contains(/admin|user/i).should('be.visible')
        })
    })
  })

  context('Dashboard Stats', () => {
    it('renders four stat cards', () => {
      // The Dashboard has 4 StatsCard components
      cy.get('.grid').find('[class*="Card"]').should('have.length.gte', 4)
    })

    it('displays Total Employees stat card', () => {
      cy.contains(/total employees/i).should('be.visible')
    })

    it('displays Active Onboarding stat card', () => {
      cy.contains(/active onboarding/i).should('be.visible')
    })

    it('displays Avg. Progress stat card', () => {
      cy.contains(/avg.*progress|average/i).should('be.visible')
    })
  })

  context('Quick Actions', () => {
    it('renders quick action buttons', () => {
      cy.contains(/quick actions|add employee|new hire/i).should('be.visible')
    })

    it('Add New Hire button navigates to employees page', () => {
      cy.contains('button, a', /add new hire/i).click()
      cy.url({ timeout: 8000 }).should('include', 'employees')
    })
  })

  context('Employee List Table', () => {
    it('renders the employee list section', () => {
      cy.contains(/employees/i).should('be.visible')
    })

    it('renders search input for filtering employees', () => {
      cy.get('input[placeholder*="search" i], input[placeholder*="employee" i]').should('be.visible')
    })

    it('renders status filter dropdown', () => {
      cy.get('select').contains(/all status|status/i).should('exist')
        .or(() => cy.get('select').should('be.visible'))
    })

    it('filters employees by search term', () => {
      cy.get('input[placeholder*="search" i]').type('test-nonexistent-xyz')
      cy.contains(/no.*found|no employees|empty/i).should('be.visible')
    })
  })

  context('Mobile Responsiveness', () => {
    it('renders mobile header on small screens', () => {
      cy.viewport('iphone-x')
      cy.visit('/')
      cy.get('header').should('be.visible')
    })

    it('sidebar is hidden by default on mobile', () => {
      cy.viewport('iphone-x')
      cy.visit('/')
      cy.get('aside, [data-sidebar]').should('not.be.visible')
    })
  })
})
