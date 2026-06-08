import { request, gql } from 'graphql-request';
import jwt from 'jsonwebtoken';

const endpoint = 'http://localhost:3001/graphql';

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
  const token = jwt.sign(
    { id: 'e08b6364-e54b-48f1-b981-95ec4dea5860', email: 'superadmin@tradevu.com', role: 'SUPER_ADMIN', organizationId: '8575d9d3-e654-4e9b-9d40-674ebde7eada' },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '1h' }
  );
  
  const headers = { authorization: `Bearer ${token}` };

  try {
    const depts = await request(endpoint, GET_DEPARTMENTS, undefined, headers);
    console.log("Departments Output:");
    console.log(JSON.stringify(depts, null, 2));
  } catch (e) {
    console.error("Dept Error:", e.response ? JSON.stringify(e.response.errors, null, 2) : e.message);
  }

  try {
    const wfs = await request(endpoint, GET_WORKFLOWS, undefined, headers);
    console.log("Workflows Output:");
    console.log(JSON.stringify(wfs, null, 2));
  } catch (e) {
    console.error("Workflow Error:", e.response ? JSON.stringify(e.response.errors, null, 2) : e.message);
  }
}

test();
