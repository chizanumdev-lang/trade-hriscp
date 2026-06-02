import { prisma } from './src/db.js';
import { ApolloServer } from '@apollo/server';
import { typeDefs } from './src/graphql/typeDefs.js';
import { resolvers } from './src/graphql/resolvers.js';

async function main() {
  const server = new ApolloServer({ typeDefs, resolvers });
  const result = await server.executeOperation({
    query: `
        query GetEmployeesList {
          employees {
            id
            employeeCode
            fullName
            email
            jobTitle
            department {
              name
            }
            employmentStatus
            onboardingStatus
            onboardingProgress
            hireDate
          }
        }
    `
  }, {
    contextValue: {
      prisma,
      user: { organizationId: '8575d9d3-e654-4e9b-9d40-674ebde7eada', role: 'SUPER_ADMIN' },
      requireAuth: () => true
    }
  });

  console.log(JSON.stringify(result, null, 2));
}
main();
