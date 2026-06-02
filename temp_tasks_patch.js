const fs = require('fs');
let code = fs.readFileSync('src/pages/TaskManager.jsx', 'utf8');

// Add gql import if missing
if (!code.includes('import { gql } from')) {
  code = code.replace(/import \{ gqlClient \} from "@\/api\/graphqlClient";/, "import { gqlClient } from \"@/api/graphqlClient\";\nimport { gql } from 'graphql-request';");
}

const queries = `
const GET_TASKS = gql\`
  query GetTasks {
    onboardingTasks {
      id
      title
      description
      isCompleted
      category
      assignedTo
    }
  }
\`;

const UPDATE_TASK = gql\`
  mutation UpdateOnboardingTask($id: ID!, $isCompleted: Boolean!) {
    updateOnboardingTask(id: $id, isCompleted: $isCompleted) {
      id
      isCompleted
    }
  }
\`;
`;

code = code.replace(/export default function TaskManager\(\) \{/, queries + '\nexport default function TaskManager() {');

// Replace queries and mutations inside component
code = code.replace(/const \{ data: allTasks = \[\] \} = useQuery\(\{[\s\S]*?initialData: \[\],\n  \}\);/, `
  const { data: allTasksData = {} } = useQuery({
    queryKey: ['onboarding-tasks'],
    queryFn: async () => await gqlClient.request(GET_TASKS),
  });

  // Map onboarding tasks to Kanban format
  const allTasks = (allTasksData.onboardingTasks || []).map(t => ({
    id: t.id,
    title: t.title,
    description: t.description || \`Category: \${t.category}\`,
    status: t.isCompleted ? 'done' : 'todo',
    priority: 'medium',
    assigned_to: t.assignedTo || 'Unassigned',
    is_onboarding: true
  }));
`);

code = code.replace(/const updateTaskMutation = useMutation\(\{[\s\S]*?onError: \(error\) => \{\n      console\.error\("Error updating task:", error\);\n    \}\n  \}\);/, `
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // If it's an onboarding task, update it on the backend
      const isCompleted = data.status === 'done';
      return await gqlClient.request(UPDATE_TASK, { id, isCompleted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
    },
    onError: (error) => {
      console.error("Error updating task:", error);
    }
  });
`);

// The filtering logic currently filters by user, but the user requested "everyone can see everyone's task"
// The existing filtering logic:
// const tasks = selectedProject 
//     ? allTasks.filter(t => t.project_id === selectedProject.id)
//     : allTasks.filter(t => t.assigned_to === user?.email || t.assigned_by === user?.email);

code = code.replace(/const tasks = selectedProject \n    \? allTasks\.filter\(t => t\.project_id === selectedProject\.id\)\n    : allTasks\.filter\(t => t\.assigned_to === user\?\.email \|\| t\.assigned_by === user\?\.email\);/, `
  // Show all tasks to everyone, as requested
  const tasks = selectedProject 
    ? allTasks.filter(t => t.project_id === selectedProject.id)
    : allTasks;
`);

fs.writeFileSync('src/pages/TaskManager.jsx', code);
console.log("TaskManager.jsx updated successfully.");
