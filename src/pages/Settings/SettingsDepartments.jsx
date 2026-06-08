import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Trash2, ExternalLink, Building, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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

const UPDATE_DEPARTMENT = gql`
  mutation UpdateDepartment($id: ID!, $headEmployeeId: String) {
    updateDepartment(id: $id, headEmployeeId: $headEmployeeId) {
      id
    }
  }
`;

export default function SettingsDepartments() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', headEmployeeId: 'none' });

  const [selectedDept, setSelectedDept] = useState(null);

  const { data: deptData = {}, isLoading: deptLoading } = useQuery({
    queryKey: ['departmentsAndEmployees'],
    queryFn: async () => await gqlClient.request(GET_DEPARTMENTS_AND_EMPLOYEES),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const departments = deptData.departments || [];
  const employees = deptData.employees || [];
  const currentUserRole = deptData.me?.role || 'HR_ADMIN';

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

  const updateDeptMutation = useMutation({
    mutationFn: async ({ id, headEmployeeId }) => {
      return await gqlClient.request(UPDATE_DEPARTMENT, { 
        id, 
        headEmployeeId: headEmployeeId === 'none' ? null : headEmployeeId 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departmentsAndEmployees'] });
      toast.success("Department head updated");
    }
  });

  return (
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
                    {dept.employees?.slice(0, 3).map(emp => (
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
                    {dept.employees?.length > 3 && (
                      <p className="text-xs text-slate-500 text-center py-1">...and {dept.employees.length - 3} more</p>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full mt-4 bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50 hover:text-indigo-700"
                    onClick={() => setSelectedDept(dept)}
                  >
                    View Details <ExternalLink className="w-3.5 h-3.5 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!selectedDept} onOpenChange={(open) => !open && setSelectedDept(null)}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-0 rounded-xl overflow-hidden gap-0 bg-white">
          {selectedDept && (
            <>
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 md:p-8 text-white relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Building className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <h2 className="text-3xl font-bold flex items-center gap-3">
                    {selectedDept.name}
                    {selectedDept.status === 'APPROVED' && <Badge className="bg-white/20 hover:bg-white/30 text-white border-none shadow-none text-xs font-medium">Approved</Badge>}
                    {selectedDept.status === 'PENDING' && <Badge className="bg-white/20 hover:bg-white/30 text-white border-none shadow-none text-xs font-medium">Pending</Badge>}
                  </h2>
                  <p className="text-indigo-100 mt-2 opacity-90 flex items-center gap-2 font-medium">
                    <Building className="w-4 h-4" /> Department Code: {selectedDept.code || 'N/A'}
                  </p>
                </div>
              </div>
              
              {/* Content Body */}
              <div className="flex flex-col md:flex-row">
                
                {/* Left Sidebar (Info) */}
                <div className="w-full md:w-1/3 bg-slate-50/50 p-6 md:p-8 border-r border-slate-100">
                  <h3 className="text-xs font-bold text-slate-400 mb-6 uppercase tracking-wider">Details</h3>
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1.5">Department Name</p>
                      <p className="text-sm font-medium text-slate-900">{selectedDept.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1.5">Department Code</p>
                      <p className="text-sm font-medium text-slate-900">{selectedDept.code || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1.5">Total Headcount</p>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                          <Users className="w-4 h-4" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{selectedDept.employees?.length || 0} Employees</p>
                      </div>
                    </div>
                  </div>

                  {/* Department Head Assignment */}
                  <div className="mt-8 pt-8 border-t border-slate-200/60">
                    <p className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider">Department Head</p>
                    {(currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'HR_ADMIN') ? (
                      <div className="space-y-2">
                        <Select 
                          value={selectedDept.headEmployeeId || 'none'} 
                          onValueChange={(val) => {
                            updateDeptMutation.mutate({ id: selectedDept.id, headEmployeeId: val });
                            setSelectedDept({ ...selectedDept, headEmployeeId: val === 'none' ? null : val });
                          }}
                        >
                          <SelectTrigger className="w-full bg-white border-slate-200">
                            <SelectValue placeholder="Assign Head" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Department Head</SelectItem>
                            {employees.map(emp => (
                              <SelectItem key={emp.id} value={emp.id}>{emp.fullName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                          The department head has access to approve workflows and manage team settings.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                        {selectedDept.headEmployeeId ? (
                          <>
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                              {employees.find(e => e.id === selectedDept.headEmployeeId)?.fullName.substring(0, 2).toUpperCase() || 'DH'}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{employees.find(e => e.id === selectedDept.headEmployeeId)?.fullName}</p>
                              <Badge className="bg-indigo-50 text-indigo-700 border-none px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider mt-0.5">Head</Badge>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm font-medium text-slate-500 italic px-2">No head assigned</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right Main Content (Employees) */}
                <div className="w-full md:w-2/3 p-6 md:p-8 bg-white">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Team Members</h3>
                    <Badge variant="outline" className="text-slate-500 font-medium bg-slate-50">{selectedDept.employees?.length || 0} Total</Badge>
                  </div>
                  
                  {selectedDept.employees?.length > 0 ? (
                    <div className="space-y-3">
                      {selectedDept.employees.map(emp => {
                        const initials = emp.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                        const isHead = emp.id === selectedDept.headEmployeeId;
                        return (
                          <div 
                            key={emp.id} 
                            onClick={() => navigate(`/employeedetail?id=${emp.id}`)}
                            className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${isHead ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50'}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 flex items-center justify-center text-sm font-bold shadow-inner">
                                {initials}
                              </div>
                              <div>
                                <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                  {emp.fullName}
                                  {isHead && <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-none px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider h-5">Head</Badge>}
                                </div>
                                <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-1">
                                  <Briefcase className="w-3.5 h-3.5 opacity-70" /> {emp.jobTitle}
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 font-medium transition-opacity">
                              View Profile
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                      <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-4">
                        <Users className="w-6 h-6 text-slate-400" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-700">No team members</h3>
                      <p className="text-sm text-slate-500 mt-1">This department has no employees yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
