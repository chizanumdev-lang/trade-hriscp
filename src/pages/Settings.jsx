import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const GET_DEPARTMENTS_AND_EMPLOYEES = gql`
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

const CREATE_DEPARTMENT = gql`
  mutation CreateDepartment($name: String!, $code: String, $headEmployeeId: String) {
    createDepartment(name: $name, code: $code, headEmployeeId: $headEmployeeId) {
      id
    }
  }
`;

const APPROVE_DEPARTMENT = gql`
  mutation ApproveDepartment($id: ID!) {
    approveDepartment(id: $id) {
      id
    }
  }
`;

const DELETE_DEPARTMENT = gql`
  mutation DeleteDepartment($id: ID!) {
    deleteDepartment(id: $id)
  }
`;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings as SettingsIcon, Users, Clock, CheckCircle, Plus, Edit, Trash2, FileText } from "lucide-react";

export default function Settings() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [editingShift, setEditingShift] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Mock user
        const currentUser = {
          email: "mock_user@example.com",
          role: "admin",
          organization_id: "org_1",
          full_name: "Mock User"
        };
        setUser(currentUser);
        
        // Mock org
        setOrganization({
          id: "org_1",
          name: "Mock Organization"
        });
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadData();
  }, []);

  const { data: deptData = {}, isLoading: deptLoading } = useQuery({
    queryKey: ['departmentsAndEmployees'],
    queryFn: async () => await gqlClient.request(GET_DEPARTMENTS_AND_EMPLOYEES),
  });

  const departments = deptData.departments || [];
  const employees = deptData.employees || [];
  const currentUserRole = deptData.me?.role || 'HR_ADMIN';

  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', headEmployeeId: 'none' });

  const createDeptMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data };
      if (payload.headEmployeeId === 'none') payload.headEmployeeId = null;
      return await gqlClient.request(CREATE_DEPARTMENT, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departmentsAndEmployees'] });
      setShowDeptDialog(false);
      setDeptForm({ name: '', code: '', headEmployeeId: 'none' });
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

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => [],
    initialData: [],
  });

  const [workflowForm, setWorkflowForm] = useState({
    workflow_name: '',
    workflow_type: 'leave',
    approval_levels: [],
  });

  const [shiftForm, setShiftForm] = useState({
    shift_name: '',
    shift_code: '',
    start_time: '09:00',
    end_time: '17:00',
    break_duration_minutes: 60,
    is_active: true,
  });

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      console.log("Mock update shift", id, data);
      return { id, ...data };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['shifts'], old => old.map(s => s.id === data.id ? data : s));
      setShowShiftDialog(false);
      setEditingShift(null);
    },
  });

  const createShiftMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock create shift", data);
      return {
        ...data,
        id: `shift_${Date.now()}`,
        organization_id: user?.organization_id,
        total_hours: calculateHours(data.start_time, data.end_time, data.break_duration_minutes),
      };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['shifts'], old => [...(old || []), data]);
      setShowShiftDialog(false);
      setShiftForm({
        shift_name: '',
        shift_code: '',
        start_time: '09:00',
        end_time: '17:00',
        break_duration_minutes: 60,
        is_active: true,
      });
    },
  });

  const createWorkflowMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock create workflow", data);
      return {
        ...data,
        id: `workflow_${Date.now()}`,
        organization_id: user?.organization_id,
        is_active: true,
      };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['workflows'], old => [...(old || []), data]);
      setShowWorkflowDialog(false);
      setWorkflowForm({
        workflow_name: '',
        workflow_type: 'leave',
        approval_levels: [],
      });
    },
  });

  const updateWorkflowMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      console.log("Mock update workflow", id, data);
      return { id, ...data };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['workflows'], old => old.map(w => w.id === data.id ? data : w));
      setShowWorkflowDialog(false);
      setEditingWorkflow(null);
    },
  });

  const calculateHours = (start, end, breakMins) => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const totalMins = (endH * 60 + endM) - (startH * 60 + startM) - breakMins;
    return totalMins / 60;
  };

  const handleEditShift = (shift) => {
    setEditingShift(shift);
    setShiftForm({
      shift_name: shift.shift_name,
      shift_code: shift.shift_code,
      start_time: shift.start_time,
      end_time: shift.end_time,
      break_duration_minutes: shift.break_duration_minutes,
      is_active: shift.is_active,
    });
    setShowShiftDialog(true);
  };

  const handleEditWorkflow = (workflow) => {
    setEditingWorkflow(workflow);
    setWorkflowForm({
      workflow_name: workflow.workflow_name,
      workflow_type: workflow.workflow_type,
      approval_levels: workflow.approval_levels || [],
    });
    setShowWorkflowDialog(true);
  };

  const addApprovalLevel = () => {
    setWorkflowForm(prev => ({
      ...prev,
      approval_levels: [
        ...prev.approval_levels,
        {
          level: prev.approval_levels.length + 1,
          level_name: '',
          approver_role: '',
          approver_emails: [],
          is_mandatory: true,
          delay_hours: 0,
        }
      ]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
            <SettingsIcon className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-slate-700">System Settings</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Settings</h1>
          <p className="text-lg text-slate-600">Configure your HR system</p>
        </div>

        <Tabs defaultValue="approvals" className="space-y-6">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="approvals">
              <CheckCircle className="w-4 h-4 mr-2" />
              Approval Workflows
            </TabsTrigger>
            <TabsTrigger value="shifts">
              <Clock className="w-4 h-4 mr-2" />
              Shifts
            </TabsTrigger>
            <TabsTrigger value="departments">
              <Users className="w-4 h-4 mr-2" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="logs">
              <FileText className="w-4 h-4 mr-2" />
              System Logs
            </TabsTrigger>
          </TabsList>

          {/* Approval Workflows Tab */}
          <TabsContent value="approvals">
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <div className="flex justify-between items-center">
                  <CardTitle>Approval Workflows</CardTitle>
                  <Dialog open={showWorkflowDialog} onOpenChange={(open) => {
                    setShowWorkflowDialog(open);
                    if (!open) {
                      setEditingWorkflow(null);
                      setWorkflowForm({
                        workflow_name: '',
                        workflow_type: 'leave',
                        approval_levels: [],
                      });
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Workflow
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingWorkflow ? 'Edit' : 'Create'} Approval Workflow</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        if (editingWorkflow) {
                          updateWorkflowMutation.mutate({ id: editingWorkflow.id, data: workflowForm });
                        } else {
                          createWorkflowMutation.mutate(workflowForm);
                        }
                      }} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Workflow Name</Label>
                            <Input value={workflowForm.workflow_name} onChange={(e) => setWorkflowForm(prev => ({ ...prev, workflow_name: e.target.value }))} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={workflowForm.workflow_type} onValueChange={(value) => setWorkflowForm(prev => ({ ...prev, workflow_type: value }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="leave">Leave</SelectItem>
                                <SelectItem value="expense">Expense</SelectItem>
                                <SelectItem value="loan">Loan</SelectItem>
                                <SelectItem value="payroll">Payroll</SelectItem>
                                <SelectItem value="recruitment">Recruitment</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <Label>Approval Levels</Label>
                            <Button type="button" size="sm" variant="outline" onClick={addApprovalLevel}>
                              <Plus className="w-4 h-4 mr-1" />
                              Add Level
                            </Button>
                          </div>
                          
                          {workflowForm.approval_levels.map((level, index) => (
                            <Card key={index} className="p-4 border-slate-200">
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <h4 className="font-semibold">Level {level.level}</h4>
                                  <Button 
                                    type="button" 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => setWorkflowForm(prev => ({
                                      ...prev,
                                      approval_levels: prev.approval_levels.filter((_, i) => i !== index)
                                    }))}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <Input 
                                    placeholder="Level Name (e.g., Manager)" 
                                    value={level.level_name}
                                    onChange={(e) => {
                                      const updated = [...workflowForm.approval_levels];
                                      updated[index].level_name = e.target.value;
                                      setWorkflowForm(prev => ({ ...prev, approval_levels: updated }));
                                    }}
                                  />
                                  <Input 
                                    placeholder="Role (e.g., Department Head)" 
                                    value={level.approver_role}
                                    onChange={(e) => {
                                      const updated = [...workflowForm.approval_levels];
                                      updated[index].approver_role = e.target.value;
                                      setWorkflowForm(prev => ({ ...prev, approval_levels: updated }));
                                    }}
                                  />
                                  <Input 
                                    type="number" 
                                    placeholder="Delay (hours)" 
                                    value={level.delay_hours}
                                    onChange={(e) => {
                                      const updated = [...workflowForm.approval_levels];
                                      updated[index].delay_hours = parseInt(e.target.value) || 0;
                                      setWorkflowForm(prev => ({ ...prev, approval_levels: updated }));
                                    }}
                                  />
                                  <div className="flex items-center gap-2">
                                    <Checkbox 
                                      checked={level.is_mandatory}
                                      onCheckedChange={(checked) => {
                                        const updated = [...workflowForm.approval_levels];
                                        updated[index].is_mandatory = checked;
                                        setWorkflowForm(prev => ({ ...prev, approval_levels: updated }));
                                      }}
                                    />
                                    <Label>Mandatory</Label>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>

                        <div className="flex justify-end gap-3">
                          <Button type="button" variant="outline" onClick={() => setShowWorkflowDialog(false)}>Cancel</Button>
                          <Button type="submit" disabled={createWorkflowMutation.isPending || updateWorkflowMutation.isPending}>
                            {(createWorkflowMutation.isPending || updateWorkflowMutation.isPending) ? 'Saving...' : editingWorkflow ? 'Update' : 'Create'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {workflows.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500">No workflows configured</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workflows.map(workflow => (
                      <div key={workflow.id} className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-slate-900">{workflow.workflow_name}</h4>
                            <p className="text-sm text-slate-600 capitalize">{workflow.workflow_type} • {workflow.approval_levels?.length || 0} levels</p>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={workflow.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
                              {workflow.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Button size="sm" variant="ghost" onClick={() => handleEditWorkflow(workflow)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Shifts Tab */}
          <TabsContent value="shifts">
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <div className="flex justify-between items-center">
                  <CardTitle>Work Shifts</CardTitle>
                  <Dialog open={showShiftDialog} onOpenChange={(open) => {
                    setShowShiftDialog(open);
                    if (!open) {
                      setEditingShift(null);
                      setShiftForm({
                        shift_name: '',
                        shift_code: '',
                        start_time: '09:00',
                        end_time: '17:00',
                        break_duration_minutes: 60,
                        is_active: true,
                      });
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Shift
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingShift ? 'Edit' : 'Add'} Shift</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        if (editingShift) {
                          updateShiftMutation.mutate({ id: editingShift.id, data: shiftForm });
                        } else {
                          createShiftMutation.mutate(shiftForm);
                        }
                      }} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Shift Name</Label>
                            <Input value={shiftForm.shift_name} onChange={(e) => setShiftForm(prev => ({ ...prev, shift_name: e.target.value }))} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Code</Label>
                            <Input value={shiftForm.shift_code} onChange={(e) => setShiftForm(prev => ({ ...prev, shift_code: e.target.value }))} placeholder="e.g., M, E, N" />
                          </div>
                          <div className="space-y-2">
                            <Label>Start Time</Label>
                            <Input type="time" value={shiftForm.start_time} onChange={(e) => setShiftForm(prev => ({ ...prev, start_time: e.target.value }))} required />
                          </div>
                          <div className="space-y-2">
                            <Label>End Time</Label>
                            <Input type="time" value={shiftForm.end_time} onChange={(e) => setShiftForm(prev => ({ ...prev, end_time: e.target.value }))} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Break (minutes)</Label>
                            <Input type="number" value={shiftForm.break_duration_minutes} onChange={(e) => setShiftForm(prev => ({ ...prev, break_duration_minutes: parseInt(e.target.value) }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={shiftForm.is_active ? 'active' : 'inactive'} onValueChange={(value) => setShiftForm(prev => ({ ...prev, is_active: value === 'active' }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-3">
                          <Button type="button" variant="outline" onClick={() => setShowShiftDialog(false)}>Cancel</Button>
                          <Button type="submit" disabled={createShiftMutation.isPending || updateShiftMutation.isPending}>
                            {(createShiftMutation.isPending || updateShiftMutation.isPending) ? 'Saving...' : editingShift ? 'Update' : 'Create'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {shifts.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500">No shifts configured</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shifts.map(shift => (
                      <div key={shift.id} className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-slate-900">{shift.shift_name}</h4>
                            <p className="text-sm text-slate-600">{shift.start_time} - {shift.end_time} ({shift.total_hours}h)</p>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={shift.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
                              {shift.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Button size="sm" variant="ghost" onClick={() => handleEditShift(shift)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <div className="flex justify-between items-center">
                  <CardTitle>Departments & Hierarchy</CardTitle>
                  <Dialog open={showDeptDialog} onOpenChange={(open) => {
                    setShowDeptDialog(open);
                    if (!open) setDeptForm({ name: '', code: '', headEmployeeId: 'none' });
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
                              <SelectItem value="none">None</SelectItem>
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

          {/* System Logs Tab */}
          <TabsContent value="logs">
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>System Audit Logs</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500">No audit logs</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.slice(0, 50).map(log => (
                      <div key={log.id} className="p-3 bg-slate-50 rounded-lg text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-slate-900">{log.description}</p>
                            <p className="text-slate-500">By {log.user_name} ({log.user_email})</p>
                          </div>
                          <Badge className={log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {log.action}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(log.created_date).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}