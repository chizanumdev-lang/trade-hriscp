import React, { useState } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, CheckCircle, XCircle } from "lucide-react";

export default function PayrollAdjustments() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  
  const [form, setForm] = useState({
    employeeId: '',
    type: 'BONUS', // BONUS, DEDUCTION, REIMBURSEMENT
    amount: '',
    reason: ''
  });

  const { data: adjustments = [], isLoading: adjustmentsLoading } = useQuery({
    queryKey: ['payroll-adjustments'],
    queryFn: async () => {
      const QUERY = `
        query {
          payrollAdjustments {
            id type amount reason status createdAt
            employee { fullName employeeCode }
          }
        }
      `;
      const data = await gqlClient.request(QUERY);
      return data.payrollAdjustments || [];
    }
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-basic'],
    queryFn: async () => {
      const QUERY = `query { employees { id fullName employeeCode } }`;
      const data = await gqlClient.request(QUERY);
      return data.employees || [];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (input) => {
      const MUTATION = `
        mutation CreateAdj($input: PayrollAdjustmentInput!) {
          createPayrollAdjustment(input: $input) { id }
        }
      `;
      await gqlClient.request(MUTATION, { 
        input: {
          employeeId: input.employeeId,
          type: input.type,
          amount: Number(input.amount),
          reason: input.reason
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payroll-adjustments']);
      setShowDialog(false);
      toast.success("Adjustment Created");
      setForm({ employeeId: '', type: 'BONUS', amount: '', reason: '' });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to create adjustment");
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (id) => {
      const MUTATION = `mutation($id: ID!) { approvePayrollAdjustment(id: $id) { id } }`;
      await gqlClient.request(MUTATION, { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payroll-adjustments']);
      toast.success("Adjustment Approved");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (id) => {
      const MUTATION = `mutation($id: ID!) { rejectPayrollAdjustment(id: $id) { id } }`;
      await gqlClient.request(MUTATION, { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payroll-adjustments']);
      toast.success("Adjustment Rejected");
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Payroll Adjustments</h1>
            <p className="text-slate-600">Log one-off bonuses, deductions, or reimbursements.</p>
          </div>
          
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 text-white">
                <Plus className="w-4 h-4 mr-2" /> Log Adjustment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Log Payroll Adjustment</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    value={form.employeeId} 
                    onChange={e => setForm({...form, employeeId: e.target.value})}
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.employeeCode})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    value={form.type} 
                    onChange={e => setForm({...form, type: e.target.value})}
                  >
                    <option value="BONUS">Bonus</option>
                    <option value="DEDUCTION">Deduction</option>
                    <option value="REIMBURSEMENT">Reimbursement</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (NGN)</Label>
                  <Input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="e.g. Performance Bonus" />
                </div>

                <Button 
                  onClick={() => createMutation.mutate(form)}
                  disabled={createMutation.isPending || !form.employeeId || !form.amount}
                  className="w-full mt-4 bg-slate-900"
                >
                  {createMutation.isPending ? 'Logging...' : 'Log Adjustment'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date Logged</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustmentsLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : adjustments.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">No adjustments found.</TableCell></TableRow>
              ) : (
                adjustments.map(adj => (
                  <TableRow key={adj.id}>
                    <TableCell className="font-medium">
                      <div>{adj.employee?.fullName}</div>
                      <div className="text-xs text-slate-500">{adj.employee?.employeeCode}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        adj.type === 'BONUS' || adj.type === 'REIMBURSEMENT' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }>
                        {adj.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{adj.reason}</TableCell>
                    <TableCell className="font-medium">{Number(adj.amount).toLocaleString()} NGN</TableCell>
                    <TableCell>{format(new Date(Number(adj.createdAt)), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        adj.status === 'APPROVED' ? 'bg-green-50 text-green-700' : 
                        adj.status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-700'
                      }>{adj.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {adj.status === 'DRAFT' && (
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => approveMutation.mutate(adj.id)}>
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => rejectMutation.mutate(adj.id)}>
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
