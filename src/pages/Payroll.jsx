import React, { useState } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { DollarSign, TrendingUp, Users, Calendar, Plus, Download, ArrowLeft, CheckCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

export default function Payroll() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [runForm, setRunForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    periodStart: '',
    periodEnd: ''
  });

  const { data: payrollRuns = [], isLoading: runsLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: async () => {
      const RUNS_QUERY = `
        query {
          payrollRuns { id month periodStart periodEnd status totalGross totalNet approvedBy createdAt }
        }
      `;
      const data = await gqlClient.request(RUNS_QUERY);
      return data.payrollRuns || [];
    }
  });

  const { data: currentRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['payroll-records', selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return [];
      const RECORDS_QUERY = `
        query GetRecords($runId: ID!) {
          payrollRecords(payrollRunId: $runId) {
            id employeeId employee { fullName }
            basicSalary allowances deductions
            grossPay taxAmount netPay
          }
        }
      `;
      const data = await gqlClient.request(RECORDS_QUERY, { runId: selectedRunId });
      return data.payrollRecords || [];
    },
    enabled: !!selectedRunId
  });

  const createRunMutation = useMutation({
    mutationFn: async (input) => {
      const MUTATION = `
        mutation CreateRun($month: String!, $start: String!, $end: String!) {
          createPayrollRun(month: $month, periodStart: $start, periodEnd: $end) { id status }
        }
      `;
      await gqlClient.request(MUTATION, { month: input.month, start: input.periodStart, end: input.periodEnd });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payroll-runs']);
      setShowRunDialog(false);
      setRunForm({ month: '', periodStart: '', periodEnd: '' });
      toast.success("Payroll run generated successfully");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to generate payroll run");
    }
  });

  const submitRunMutation = useMutation({
    mutationFn: async (id) => {
      const MUTATION = `mutation SubmitRun($id: ID!) { submitPayrollRun(id: $id) { id status } }`;
      await gqlClient.request(MUTATION, { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payroll-runs']);
      toast.success("Payroll run submitted for approval");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to submit payroll run");
    }
  });

  const approveRunMutation = useMutation({
    mutationFn: async (id) => {
      const MUTATION = `mutation ApproveRun($id: ID!) { approvePayrollRun(id: $id) { id status } }`;
      await gqlClient.request(MUTATION, { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payroll-runs']);
      toast.success("Payroll run approved");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to approve payroll run");
    }
  });

  const generatePayslipMutation = useMutation({
    mutationFn: async (recordId) => {
      const MUTATION = `mutation GenPayslip($id: ID!) { generatePayslip(recordId: $id) }`;
      const data = await gqlClient.request(MUTATION, { id: recordId });
      return data.generatePayslip;
    },
    onSuccess: (msg) => toast.success(msg),
    onError: (err) => {
      console.error(err);
      toast.error("Failed to trigger payslip generation");
    }
  });

  const canApprove = ['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(user?.role);

  if (selectedRunId) {
    const run = payrollRuns.find(r => r.id === selectedRunId);
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setSelectedRunId(null)}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Runs
              </Button>
              <h1 className="text-3xl font-bold text-slate-900">Payroll Records for {run?.month}</h1>
              <Badge variant="outline" className={run?.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                {run?.status}
              </Badge>
            </div>
            {run?.status === 'DRAFT' && (
              <Button 
                onClick={() => submitRunMutation.mutate(run.id)}
                disabled={submitRunMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {submitRunMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            )}
            {run?.status === 'PENDING_APPROVAL' && canApprove && (
              <Button 
                onClick={() => approveRunMutation.mutate(run.id)}
                disabled={approveRunMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {approveRunMutation.isPending ? 'Approving...' : 'Approve Run'}
              </Button>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-slate-600 mb-1">Total Gross</p>
                <p className="text-2xl font-bold">{run?.totalGross.toLocaleString()} NGN</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-slate-600 mb-1">Total Net</p>
                <p className="text-2xl font-bold text-green-600">{run?.totalNet.toLocaleString()} NGN</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-slate-600 mb-1">Employees Processed</p>
                <p className="text-2xl font-bold text-blue-600">{currentRecords.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Gross Pay</TableHead>
                  <TableHead>Deductions (incl. Tax)</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordsLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Loading records...</TableCell></TableRow>
                ) : (
                  currentRecords.map(record => {
                    const parsedAllowances = record.allowances ? JSON.parse(record.allowances) : {};
                    const parsedDeductions = record.deductions ? JSON.parse(record.deductions) : {};
                    const totalDeductions = Object.values(parsedDeductions).reduce((sum, v) => sum + (parseFloat(v)||0), 0);

                    return (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.employee.fullName}</TableCell>
                        <TableCell>{record.grossPay.toLocaleString()} NGN</TableCell>
                        <TableCell className="text-red-600">{(totalDeductions + record.taxAmount).toLocaleString()} NGN</TableCell>
                        <TableCell className="text-green-600 font-bold">{record.netPay.toLocaleString()} NGN</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => generatePayslipMutation.mutate(record.id)}
                            disabled={generatePayslipMutation.isPending}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Payslip
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Payroll Administration</h1>
            <p className="text-slate-600">Generate and manage monthly payroll runs.</p>
          </div>
          
          <Dialog open={showRunDialog} onOpenChange={setShowRunDialog}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 text-white">
                <Plus className="w-4 h-4 mr-2" /> Generate Payroll Run
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Payroll Run</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Month (YYYY-MM)</Label>
                  <Input type="month" value={runForm.month} onChange={e => setRunForm({...runForm, month: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Period Start Date</Label>
                  <Input type="date" value={runForm.periodStart} onChange={e => setRunForm({...runForm, periodStart: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Period End Date</Label>
                  <Input type="date" value={runForm.periodEnd} onChange={e => setRunForm({...runForm, periodEnd: e.target.value})} />
                </div>
                <Button 
                  onClick={() => createRunMutation.mutate(runForm)}
                  disabled={createRunMutation.isPending || !runForm.month || !runForm.periodStart || !runForm.periodEnd}
                  className="w-full bg-slate-900"
                >
                  {createRunMutation.isPending ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Total Gross</TableHead>
                <TableHead>Total Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runsLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading runs...</TableCell></TableRow>
              ) : payrollRuns.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">No payroll runs generated yet.</TableCell></TableRow>
              ) : (
                payrollRuns.map(run => (
                  <TableRow key={run.id}>
                    <TableCell className="font-semibold">{run.month}</TableCell>
                    <TableCell>{format(new Date(run.periodStart), 'MMM d, yyyy')} - {format(new Date(run.periodEnd), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{run.totalGross.toLocaleString()} NGN</TableCell>
                    <TableCell className="text-green-600 font-medium">{run.totalNet.toLocaleString()} NGN</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={run.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedRunId(run.id)}>
                        View Records
                      </Button>
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
