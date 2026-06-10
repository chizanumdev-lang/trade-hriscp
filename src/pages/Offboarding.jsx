import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserMinus, Plus, CheckCircle, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function Offboarding() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    notice_date: new Date().toISOString().split('T')[0],
    last_working_day: '',
    termination_date: '',
    final_settlement: 0,
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Mock user load
        const currentUser = {
          organization_id: "org_1",
        };
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: offboardings = [] } = useQuery({
    queryKey: ['offboardings'],
    queryFn: async () => {
      const OFFBOARDINGS_QUERY = gql`
        query GetAllOffboardings {
          allOffboardings {
            id
            employeeId
            exitType
            exitDate
            reason
            assetReturned
            accessRevoked
            handoverComplete
            finalPayrollProcessed
          }
        }
      `;
      const data = await gqlClient.request(OFFBOARDINGS_QUERY);
      return data.allOffboardings || [];
    },
    initialData: [],
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const EMPLOYEES_QUERY = gql`
        query GetEmployees {
          employees {
            id
            fullName
            jobTitle
          }
        }
      `;
      return await gqlClient.request(EMPLOYEES_QUERY);
    },
  });
  const employees = employeesData?.employees || [];

  const createOffboardingMutation = useMutation({
    mutationFn: async (data) => {
      const INITIATE_OFFBOARDING = gql`
        mutation InitiateOffboarding($employeeId: ID!, $exitType: String!, $exitDate: String!, $reason: String) {
          initiateOffboarding(employeeId: $employeeId, exitType: $exitType, exitDate: $exitDate, reason: $reason) {
            id
          }
        }
      `;
      return await gqlClient.request(INITIATE_OFFBOARDING, {
        employeeId: data.employee_id,
        exitType: data.exitType || 'RESIGNATION',
        exitDate: data.last_working_day,
        reason: data.reason || ''
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offboardings'] });
      setShowForm(false);
      setFormData({
        employee_id: '',
        notice_date: new Date().toISOString().split('T')[0],
        last_working_day: '',
        termination_date: '',
        final_settlement: 0,
      });
    },
  });

  const updateOffboardingMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const UPDATE_OFFBOARDING = gql`
        mutation UpdateOffboarding($id: ID!, $assetReturned: Boolean, $accessRevoked: Boolean, $handoverComplete: Boolean) {
          updateOffboarding(id: $id, assetReturned: $assetReturned, accessRevoked: $accessRevoked, handoverComplete: $handoverComplete) {
            id
          }
        }
      `;
      return await gqlClient.request(UPDATE_OFFBOARDING, { id, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offboardings'] });
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
              <UserMinus className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-slate-700">Offboarding Management</span>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-3">Offboarding Journey</h1>
            <p className="text-lg text-slate-600">Manage employee departures smoothly</p>
          </div>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
                <Plus className="w-4 h-4 mr-2" />
                New Offboarding
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start Offboarding Process</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createOffboardingMutation.mutate(formData); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={formData.employee_id} onValueChange={(value) => setFormData(prev => ({ ...prev, employee_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name} - {emp.job_title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Notice Date</Label>
                    <Input type="date" value={formData.notice_date} onChange={(e) => setFormData(prev => ({ ...prev, notice_date: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Working Day</Label>
                    <Input type="date" value={formData.last_working_day} onChange={(e) => setFormData(prev => ({ ...prev, last_working_day: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Termination Date</Label>
                    <Input type="date" value={formData.termination_date} onChange={(e) => setFormData(prev => ({ ...prev, termination_date: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Final Settlement (SAR)</Label>
                    <Input type="number" value={formData.final_settlement} onChange={(e) => setFormData(prev => ({ ...prev, final_settlement: parseFloat(e.target.value) }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" isLoading={createOffboardingMutation.isPending}>
                    {createOffboardingMutation.isPending ? 'Creating...' : 'Start Offboarding'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offboardings.map(offboarding => {
            const employee = employees.find(e => e.id === offboarding.employeeId) || { fullName: "Unknown Employee" };
            const checklist = [
              { task: 'Return company assets', field: 'assetReturned', completed: offboarding.assetReturned },
              { task: 'Access revocation', field: 'accessRevoked', completed: offboarding.accessRevoked },
              { task: 'Handover complete', field: 'handoverComplete', completed: offboarding.handoverComplete },
              { task: 'Final settlement processed', field: 'finalPayrollProcessed', completed: offboarding.finalPayrollProcessed },
            ];

            return (
            <Card key={offboarding.id} className="border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-6 text-white">
                <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center border-4 border-white shadow-lg">
                  <span className="text-3xl">👋</span>
                </div>
                <h3 className="font-bold text-xl text-center">{employee.fullName}</h3>
                <p className="text-center text-teal-100 text-sm">Offboarding Journey ({offboarding.exitType})</p>
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  {checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <button 
                        onClick={() => {
                          if (item.field !== 'finalPayrollProcessed') {
                            updateOffboardingMutation.mutate({ id: offboarding.id, data: { [item.field]: !item.completed } });
                          }
                        }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        item.completed ? 'bg-green-500' : 'bg-slate-200 hover:bg-slate-300'
                      }`}>
                        {item.completed && <CheckCircle className="w-4 h-4 text-white" />}
                      </button>
                      <span className={`text-sm ${item.completed ? 'text-slate-900' : 'text-slate-500'}`}>
                        {item.task}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Exit Date</p>
                      <p className="font-medium">{format(new Date(offboarding.exitDate), 'MMM dd, yyyy')}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )})}

          {offboardings.length === 0 && (
            <Card className="col-span-full border-slate-200">
              <CardContent className="p-12 text-center">
                <UserMinus className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No offboarding processes</h3>
                <p className="text-slate-500">Start an offboarding journey when needed</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}