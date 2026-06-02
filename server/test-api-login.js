import { GraphQLClient, gql } from 'graphql-request';
const client = new GraphQLClient('http://127.0.0.1:3001/');

async function main() {
  try {
    const loginData = await client.request(gql`
      mutation {
        login(email: "superadmin@tradevu.com", password: "Password123!") {
          token
        }
      }
    `);
    const token = loginData.login.token;
    
    const clientAuth = new GraphQLClient('http://127.0.0.1:3001/', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const data = await clientAuth.request(gql`
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
    `);
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e.response ? JSON.stringify(e.response.errors, null, 2) : e.message);
  }
}
main();
