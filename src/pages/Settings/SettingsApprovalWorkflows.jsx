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
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Plus, Edit, Trash2, ArrowRight, GitBranch } from "lucide-react";

const GET_WORKFLOWS = gql`
  query GetWorkflows {
    approvalWorkflows {
      id
      name
      entityType
      steps
      isActive
    }
  }
`;

const CREATE_WORKFLOW = gql`
  mutation CreateApprovalWorkflow($name: String!, $entityType: String!, $steps: String!) {
    createApprovalWorkflow(name: $name, entityType: $entityType, steps: $steps) {
      id
    }
  }
`;

const UPDATE_WORKFLOW = gql`
  mutation UpdateApprovalWorkflow($id: ID!, $name: String, $entityType: String, $steps: String, $isActive: Boolean) {
    updateApprovalWorkflow(id: $id, name: $name, entityType: $entityType, steps: $steps, isActive: $isActive) {
      id
    }
  }
`;

const DELETE_WORKFLOW = gql`
  mutation DeleteApprovalWorkflow($id: ID!) {
    deleteApprovalWorkflow(id: $id)
  }
`;

export default function SettingsApprovalWorkflows() {
  const queryClient = useQueryClient();
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);

  const { data: workflowData = {}, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => await gqlClient.request(GET_WORKFLOWS),
  });

  const workflows = (workflowData.approvalWorkflows || []).map(w => ({
    ...w,
    parsedSteps: w.steps ? JSON.parse(w.steps) : []
  }));

  const [workflowForm, setWorkflowForm] = useState({
    name: '',
    entityType: 'LeaveRequest',
    steps: [],
    isActive: true,
  });

  const updateWorkflowMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const payload = { ...data, steps: JSON.stringify(data.steps) };
      return await gqlClient.request(UPDATE_WORKFLOW, { id, ...payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setShowWorkflowDialog(false);
      setEditingWorkflow(null);
    },
  });

  const createWorkflowMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { name: data.name, entityType: data.entityType, steps: JSON.stringify(data.steps) };
      return await gqlClient.request(CREATE_WORKFLOW, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setShowWorkflowDialog(false);
      setWorkflowForm({
        name: '',
        entityType: 'LeaveRequest',
        steps: [],
        isActive: true,
      });
    },
  });
  
  const deleteWorkflowMutation = useMutation({
    mutationFn: async (id) => await gqlClient.request(DELETE_WORKFLOW, { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] })
  });

  const handleEditWorkflow = (workflow) => {
    setEditingWorkflow(workflow);
    setWorkflowForm({
      name: workflow.name,
      entityType: workflow.entityType,
      steps: workflow.parsedSteps,
      isActive: workflow.isActive,
    });
    setShowWorkflowDialog(true);
  };

  const addApprovalLevel = () => {
    setWorkflowForm(prev => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          order: prev.steps.length + 1,
          role: 'MANAGER',
        }
      ]
    }));
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-indigo-500" />
              Approval Workflows
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">Define the sequence of approvals required for different operations.</p>
          </div>
          <Dialog open={showWorkflowDialog} onOpenChange={(open) => {
            setShowWorkflowDialog(open);
            if (!open) {
              setEditingWorkflow(null);
              setWorkflowForm({
                name: '',
                entityType: 'LeaveRequest',
                steps: [],
                isActive: true,
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Workflow
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
                    <Input value={workflowForm.name} onChange={(e) => setWorkflowForm(prev => ({ ...prev, name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Entity Type</Label>
                    <Select value={workflowForm.entityType} onValueChange={(value) => setWorkflowForm(prev => ({ ...prev, entityType: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LeaveRequest">Leave Request</SelectItem>
                        <SelectItem value="PayrollRun">Payroll Run</SelectItem>
                        <SelectItem value="Employee">Employee Onboarding</SelectItem>
                        <SelectItem value="Document">Document Approval</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editingWorkflow && (
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={workflowForm.isActive ? 'active' : 'inactive'} onValueChange={(value) => setWorkflowForm(prev => ({ ...prev, isActive: value === 'active' }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>Approval Steps</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addApprovalLevel}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Step
                    </Button>
                  </div>
                  
                  {workflowForm.steps.map((step, index) => (
                    <Card key={index} className="p-4 border-slate-200">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-sm">Step {index + 1}</span>
                          <Select 
                            value={step.role}
                            onValueChange={(value) => {
                              const updated = [...workflowForm.steps];
                              updated[index].role = value;
                              setWorkflowForm(prev => ({ ...prev, steps: updated }));
                            }}
                          >
                            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Role" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MANAGER">Manager</SelectItem>
                              <SelectItem value="HR_ADMIN">HR Admin</SelectItem>
                              <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                              <SelectItem value="FINANCE">Finance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setWorkflowForm(prev => ({
                            ...prev,
                            steps: prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }))
                          }))}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {workflowForm.steps.length === 0 && <p className="text-sm text-slate-500">No steps defined. Approvals will be auto-approved if active.</p>}
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
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-4">
              <GitBranch className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No workflows configured</h3>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto">Create approval workflows to enforce sign-offs before requests like Leave or Payroll are processed.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {workflows.map(workflow => (
              <div key={workflow.id} className="group p-6 bg-white border border-slate-200 rounded-2xl hover:shadow-md transition-all duration-200 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-bold text-xl text-slate-900">{workflow.name}</h4>
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 font-medium border-slate-200">{workflow.entityType}</Badge>
                      <Badge className={workflow.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200 shadow-none border-none px-2 py-0.5 text-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-none border-none px-2 py-0.5 text-xs'}>
                        {workflow.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">{workflow.parsedSteps?.length || 0} Approval Level(s)</p>

                    {/* Visual Flow Representation */}
                    <div className="mt-6 pt-5 border-t border-slate-100">
                      {workflow.parsedSteps && workflow.parsedSteps.length > 0 ? (
                        <div className="flex items-center flex-wrap gap-3">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shadow-sm">
                              REQ
                            </div>
                            <span className="text-[10px] mt-1.5 text-slate-500 font-bold uppercase tracking-wider">Requester</span>
                          </div>
                          
                          {workflow.parsedSteps.sort((a, b) => a.order - b.order).map((step, idx) => (
                            <React.Fragment key={idx}>
                              <div className="text-slate-300 px-1">
                                 <ArrowRight className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col items-center justify-center relative">
                                <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">
                                  {step.order}
                                </div>
                                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-sm font-bold shadow-sm border border-indigo-200">
                                  {step.role.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="text-[10px] mt-1.5 text-indigo-700 font-bold uppercase tracking-wider">{step.role.replace('_', ' ')}</span>
                              </div>
                            </React.Fragment>
                          ))}

                          <React.Fragment>
                            <div className="text-slate-300 px-1">
                               <ArrowRight className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 border border-green-200 flex items-center justify-center shadow-sm">
                                <CheckCircle className="w-5 h-5" />
                              </div>
                              <span className="text-[10px] mt-1.5 text-green-700 font-bold uppercase tracking-wider">Approved</span>
                            </div>
                          </React.Fragment>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg border border-amber-200/50">
                          <CheckCircle className="w-4 h-4" />
                          <p className="text-sm font-medium">No approval steps defined. Requests are auto-approved.</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <Button size="sm" variant="ghost" className="h-8 px-3 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700" onClick={() => handleEditWorkflow(workflow)}>
                      <Edit className="w-4 h-4 mr-1.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:bg-red-100 hover:text-red-700" onClick={() => deleteWorkflowMutation.mutate(workflow.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
