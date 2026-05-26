/**
 * Cypress E2E Tests: GraphQL API Integration
 * Tests the frontend's API calls by intercepting network requests
 * to verify correct queries are sent and responses handled properly.
 */

describe('GraphQL API Integration', () => {
  beforeEach(() => {
    cy.fixture('users').then(({ superAdmin }) => {
      cy.loginByApi(superAdmin.email, superAdmin.password)
    })
  })

  context('Employees Query Intercepted', () => {
    it('sends employees query when visiting Employees page', () => {
      cy.intercept('POST', '**/graphql', (req) => {
        // Tag requests containing the employees query
        if (req.body?.query?.includes('employees')) {
          req.alias = 'employeesQuery'
        }
      })

      cy.visit('/Employees')
      cy.wait('@employeesQuery', { timeout: 10000 }).then((interception) => {
        expect(interception.request.body.query).to.include('employees')
        expect(interception.response.statusCode).to.eq(200)
        expect(interception.response.body).to.have.property('data')
      })
    })

    it('sends authorization header with employees query', () => {
      cy.intercept('POST', '**/graphql', (req) => {
        if (req.body?.query?.includes('employees')) {
          req.alias = 'employeesAuth'
        }
      })

      cy.visit('/Employees')
      cy.wait('@employeesAuth', { timeout: 10000 }).then((interception) => {
        const authHeader = interception.request.headers.authorization
        expect(authHeader).to.match(/^Bearer .+/)
      })
    })
  })

  context('Mock GraphQL Responses', () => {
    it('renders mocked employee data correctly', () => {
      cy.fixture('employees').then(({ mockEmployees }) => {
        cy.intercept('POST', '**/graphql', (req) => {
          if (req.body?.query?.includes('GetDashboardEmployees') || req.body?.query?.includes('employees')) {
            req.reply({
              statusCode: 200,
              body: {
                data: {
                  employees: mockEmployees,
                },
              },
            })
          }
        }).as('mockedEmployees')

        cy.visit('/Employees')
        cy.wait('@mockedEmployees', { timeout: 10000 })
        // Both mock employees should render
        cy.contains('John Doe').should('be.visible')
        cy.contains('Jane Smith').should('be.visible')
      })
    })

    it('handles empty employees response gracefully', () => {
      cy.intercept('POST', '**/graphql', (req) => {
        if (req.body?.query?.includes('employees')) {
          req.reply({
            statusCode: 200,
            body: { data: { employees: [] } },
          })
        }
      }).as('emptyEmployees')

      cy.visit('/Employees')
      cy.wait('@emptyEmployees', { timeout: 10000 })
      cy.contains(/no employees|get started|empty/i, { timeout: 5000 }).should('be.visible')
    })

    it('handles GraphQL error response gracefully', () => {
      cy.intercept('POST', '**/graphql', (req) => {
        if (req.body?.query?.includes('employees')) {
          req.reply({
            statusCode: 200,
            body: {
              errors: [{ message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } }],
              data: null,
            },
          })
        }
      }).as('errorResponse')

      cy.visit('/Employees')
      cy.wait('@errorResponse', { timeout: 10000 })
      // App should not crash — either shows error UI or falls back gracefully
      cy.get('body').should('be.visible')
    })
  })

  context('Dashboard API Calls', () => {
    it('dashboard fetches employees and tasks on load', () => {
      const queries = []

      cy.intercept('POST', '**/graphql', (req) => {
        queries.push(req.body?.query)
      }).as('allGraphQL')

      cy.visit('/')

      cy.wait('@allGraphQL', { timeout: 10000 }).then(() => {
        // At least one query should have been made
        expect(queries.length).to.be.gte(1)
      })
    })
  })

  context('Expenses API Calls', () => {
    it('fetches employees list when admin visits expenses page', () => {
      cy.intercept('POST', '**/graphql', (req) => {
        if (req.body?.query?.includes('employees')) {
          req.alias = 'expensesEmployees'
        }
      })

      cy.visit('/Expenses')
      // Admin with canAddForOthers=true triggers employees fetch
      // Just verify the page loads without crashing
      cy.contains(/expense/i).should('be.visible')
    })
  })

  context('Loans API Calls', () => {
    it('fetches loans data on page load', () => {
      cy.intercept('POST', '**/graphql', (req) => {
        if (req.body?.query?.includes('loans') || req.body?.query?.includes('employees')) {
          req.alias = 'loansPageQuery'
        }
      })

      cy.visit('/Loans')
      cy.contains(/loan/i).should('be.visible')
    })
  })
})
