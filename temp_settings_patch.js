// A script to patch Settings.jsx
const fs = require('fs');
let code = fs.readFileSync('src/pages/Settings.jsx', 'utf8');

// Add gql import
code = code.replace(/import \{ gqlClient \} from "@\/api\/graphqlClient";/, "import { gqlClient } from \"@/api/graphqlClient\";\nimport { gql } from 'graphql-request';");

// Define GraphQL queries
const queries = `
const GET_DEPARTMENTS_AND_EMPLOYEES = gql\`
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
      role: employmentStatus
    }
    me {
      id
      role
    }
  }
\`;

const CREATE_DEPARTMENT = gql\`
  mutation CreateDepartment($name: String!, $code: String, $headEmployeeId: String) {
    createDepartment(name: $name, code: $code, headEmployeeId: $headEmployeeId) {
      id
    }
  }
\`;

const APPROVE_DEPARTMENT = gql\`
  mutation ApproveDepartment($id: ID!) {
    approveDepartment(id: $id) {
      id
    }
  }
\`;

const DELETE_DEPARTMENT = gql\`
  mutation DeleteDepartment($id: ID!) {
    deleteDepartment(id: $id)
  }
\`;
`;

code = code.replace(/export default function Settings\(\) \{/, queries + '\nexport default function Settings() {');

// Update useQuery for departments
code = code.replace(/const \{ data: departments = \[\] \} = useQuery\(\{\n    queryKey: \['departments'\],\n    queryFn: async \(\) => \[\],\n    initialData: \[\],\n  \}\);/, `
  const { data: deptData = {}, isLoading: deptLoading } = useQuery({
    queryKey: ['departmentsAndEmployees'],
    queryFn: async () => await gqlClient.request(GET_DEPARTMENTS_AND_EMPLOYEES),
  });
  
  const departments = deptData.departments || [];
  const employees = deptData.employees || [];
  const currentUserRole = deptData.me?.role || 'HR_ADMIN';
`);

// Remove mock employees useQuery
code = code.replace(/const \{ data: employees = \[\] \} = useQuery\(\{\n    queryKey: \['employees'\],\n    queryFn: async \(\) => \[\],\n    initialData: \[\],\n  \}\);/, '');

// Add Department State and Mutations
const deptState = `
  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', headEmployeeId: '' });

  const createDeptMutation = useMutation({
    mutationFn: async (data) => await gqlClient.request(CREATE_DEPARTMENT, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departmentsAndEmployees'] });
      setShowDeptDialog(false);
      setDeptForm({ name: '', code: '', headEmployeeId: '' });
    }
  });

  const approveDeptMutation = useMutation({
    mutationFn: async (id) => await gqlClient.request(APPROVE_DEPARTMENT, { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departmentsAndEmployees'] })
  });

  const deleteDeptMutation = useMutation({
    mutationFn: async (id) => await gqlClient.request(DELETE_DEPARTMENT, { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departmentsAndEmployees'] })
  });
`;

code = code.replace(/const \[workflowForm, setWorkflowForm\] = useState\(\{/, deptState + '\n  const [workflowForm, setWorkflowForm] = useState({');


// Replace Departments Tab
const newDeptTab = `
          {/* Departments Tab */}
          <TabsContent value="departments">
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <div className="flex justify-between items-center">
                  <CardTitle>Departments & Hierarchy</CardTitle>
                  <Dialog open={showDeptDialog} onOpenChange={(open) => {
                    setShowDeptDialog(open);
                    if (!open) setDeptForm({ name: '', code: '', headEmployeeId: '' });
                  }}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Department
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Department</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        createDeptMutation.mutate(deptForm);
                      }} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Department Name</Label>
                          <Input value={deptForm.name} onChange={(e) => setDeptForm(prev => ({ ...prev, name: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Department Code</Label>
                          <Input value={deptForm.code} onChange={(e) => setDeptForm(prev => ({ ...prev, code: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Department Head</Label>
                          <Select value={deptForm.headEmployeeId} onValueChange={(val) => setDeptForm(prev => ({ ...prev, headEmployeeId: val }))}>
                            <SelectTrigger><SelectValue placeholder="Select Head (Optional)" /></SelectTrigger>
                            <SelectContent>
                              {employees.map(emp => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.fullName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-3">
                          <Button type="button" variant="outline" onClick={() => setShowDeptDialog(false)}>Cancel</Button>
                          <Button type="submit" disabled={createDeptMutation.isPending}>
                            {createDeptMutation.isPending ? 'Creating...' : 'Create'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {deptLoading ? <p>Loading...</p> : departments.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500">No departments found.</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {departments.map(dept => (
                      <Card key={dept.id} className="border-slate-200">
                        <CardHeader className="bg-slate-50 pb-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{dept.name}</CardTitle>
                              <p className="text-sm text-slate-500">Code: {dept.code || 'N/A'}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {dept.status === 'PENDING' && (
                                <Badge className="bg-orange-100 text-orange-700">Pending Approval</Badge>
                              )}
                              <div className="flex gap-2">
                                {dept.status === 'PENDING' && currentUserRole === 'SUPER_ADMIN' && (
                                  <Button size="sm" onClick={() => approveDeptMutation.mutate(dept.id)} disabled={approveDeptMutation.isPending}>Approve</Button>
                                )}
                                <Button size="sm" variant="destructive" onClick={() => deleteDeptMutation.mutate(dept.id)} disabled={deleteDeptMutation.isPending}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          <h4 className="text-sm font-semibold mb-2 text-slate-700">Employees ({dept.employees?.length || 0})</h4>
                          <div className="space-y-2">
                            {dept.employees?.map(emp => (
                              <div key={emp.id} className="flex justify-between items-center p-2 rounded bg-white border border-slate-100">
                                <div>
                                  <p className="font-medium text-sm">{emp.fullName}</p>
                                  <p className="text-xs text-slate-500">{emp.jobTitle}</p>
                                </div>
                                {emp.id === dept.headEmployeeId && (
                                  <Badge className="bg-blue-50 text-blue-700 border-blue-200">Dept Head</Badge>
                                )}
                              </div>
                            ))}
                            {!dept.employees?.length && <p className="text-xs text-slate-400">No employees assigned.</p>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
`;

code = code.replace(/\{\/\* Departments Tab - keep existing code \*\/\}\n          <TabsContent value="departments">\n            \{\/\* ... existing departments code ... \*\/\}\n          <\/TabsContent>/, newDeptTab);

fs.writeFileSync('src/pages/Settings.jsx', code);
console.log("Settings.jsx updated successfully.");
