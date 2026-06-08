import { request, gql } from 'graphql-request';

const endpoint = 'http://localhost:3001/graphql';

const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
    }
  }
`;

const GET_DEPARTMENTS = gql`
  query GetDepartmentsAndEmployees {
    departments {
      id
      name
      code
      status
      headEmployeeId
      employees {
        id
        fullName
        email
        jobTitle
      }
    }
    employees {
      id
      fullName
      email
    }
    me {
      id
      role
    }
  }
`;

const GET_WORKFLOWS = gql`
  query GetApprovalWorkflows {
    approvalWorkflows {
      id
      name
      entityType
      steps
      isActive
    }
  }
`;

async function test() {
  try {
    const loginData = await request(endpoint, LOGIN, { email: "superadmin@tradevu.com", password: "Password123!" });
    const token = loginData.login.token;
    console.log("Token acquired.");
    
    const headers = { authorization: `Bearer ${token}` };

    console.log("Fetching workflows...");
    try {
      const wfs = await request(endpoint, GET_WORKFLOWS, undefined, headers);
      console.log(JSON.stringify(wfs, null, 2));
    } catch (e) {
      console.error("Workflow Error:", e.response ? e.response.errors : e.message);
    }

    console.log("Fetching departments...");
    try {
      const depts = await request(endpoint, GET_DEPARTMENTS, undefined, headers);
      console.log(JSON.stringify(depts, null, 2));
    } catch (e) {
      console.error("Dept Error:", e.response ? e.response.errors : e.message);
    }

  } catch (error) {
    console.error("Login Error:", error.response ? error.response.errors : error.message);
  }
}

test();
