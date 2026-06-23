import React, { useState } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, TrendingUp, DollarSign, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function PayrollReports() {
  const [selectedRunId, setSelectedRunId] = useState("all");

  const { data: runs = [], isLoading: isLoadingRuns } = useQuery({
    queryKey: ['payrollRuns'],
    queryFn: async () => {
      const QUERY = `
        query {
          payrollRuns {
            id month startDate endDate status totalGrossPay totalNetPay totalDeductions
            records { id }
          }
        }
      `;
      const data = await gqlClient.request(QUERY);
      return data.payrollRuns.sort((a, b) => b.month.localeCompare(a.month));
    }
  });

  const { data: records = [], isLoading: isLoadingRecords } = useQuery({
    queryKey: ['payrollRecords', selectedRunId],
    queryFn: async () => {
      if (selectedRunId === "all") return [];
      const QUERY = `
        query GetRecords($runId: ID!) {
          payrollRecords(payrollRunId: $runId) {
            id basicSalary grossPay netPay allowances deductions
            employee { id fullName jobTitle department { name } }
          }
        }
      `;
      const data = await gqlClient.request(QUERY, { runId: selectedRunId });
      return data.payrollRecords;
    },
    enabled: selectedRunId !== "all"
  });

  const handleExportCSV = () => {
    if (selectedRunId === "all" || !records.length) {
      toast.error("Please select a specific payroll run with records to export");
      return;
    }

    const run = runs.find(r => r.id === selectedRunId);
    
    // Create CSV content
    const headers = ["Employee ID", "Full Name", "Department", "Job Title", "Basic Salary", "Total Allowances", "Gross Pay", "Total Deductions", "Net Pay", "Bank Transfer Amount"];
    
    const rows = records.map(r => {
      const totalAllowances = Object.values(r.allowances || {}).reduce((a,b) => Number(a)+Number(b), 0);
      const totalDeductions = Object.values(r.deductions || {}).reduce((a,b) => Number(a)+Number(b), 0);
      return [
        r.employee.id,
        `"${r.employee.fullName}"`,
        `"${r.employee.department?.name || 'N/A'}"`,
        `"${r.employee.jobTitle}"`,
        r.basicSalary,
        totalAllowances,
        r.grossPay,
        totalDeductions,
        r.netPay,
        r.netPay // Assuming full amount goes to bank transfer for now
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `payment_instructions_${run.month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedRun = runs.find(r => r.id === selectedRunId);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Payroll Reports</h1>
            <p className="text-slate-600">Analyze organization-wide compensation metrics and generate payment instructions.</p>
          </div>
          
          <div className="flex gap-3 items-center">
            <Select value={selectedRunId} onValueChange={setSelectedRunId}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue placeholder="Select Payroll Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Overview</SelectItem>
                {runs.map(run => (
                  <SelectItem key={run.id} value={run.id}>
                    {format(new Date(run.month + '-01'), 'MMMM yyyy')} ({run.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleExportCSV} disabled={selectedRunId === "all" || !records.length} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export Payment CSV
            </Button>
          </div>
        </div>

        {selectedRunId === "all" ? (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Total Processed Gross</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">
                    {runs.filter(r => r.status === 'PROCESSED' || r.status === 'APPROVED').reduce((acc, r) => acc + r.totalGrossPay, 0).toLocaleString()} <span className="text-sm font-normal text-slate-500">SAR</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Total Net Disbursed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-600">
                    {runs.filter(r => r.status === 'PROCESSED' || r.status === 'APPROVED').reduce((acc, r) => acc + r.totalNetPay, 0).toLocaleString()} <span className="text-sm font-normal text-slate-500">SAR</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Total Deductions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-rose-600">
                    {runs.filter(r => r.status === 'PROCESSED' || r.status === 'APPROVED').reduce((acc, r) => acc + r.totalDeductions, 0).toLocaleString()} <span className="text-sm font-normal text-slate-500">SAR</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Payroll History Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Employees</TableHead>
                      <TableHead className="text-right">Gross Pay</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map(run => (
                      <TableRow key={run.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedRunId(run.id)}>
                        <TableCell className="font-medium">{format(new Date(run.month + '-01'), 'MMMM yyyy')}</TableCell>
                        <TableCell>{run.status}</TableCell>
                        <TableCell>{run.records.length}</TableCell>
                        <TableCell className="text-right">{run.totalGrossPay.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-rose-600">{run.totalDeductions.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-indigo-600">{run.totalNetPay.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {runs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-500 py-8">No payroll runs found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {selectedRun && (
              <div className="grid md:grid-cols-4 gap-4">
                <Card className="bg-indigo-50 border-indigo-100">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-indigo-600 mb-1">Total Net Pay</p>
                    <p className="text-2xl font-bold text-indigo-900">{selectedRun.totalNetPay.toLocaleString()} <span className="text-sm font-normal">SAR</span></p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-slate-600 mb-1">Total Gross</p>
                    <p className="text-2xl font-bold text-slate-900">{selectedRun.totalGrossPay.toLocaleString()} <span className="text-sm font-normal">SAR</span></p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-slate-600 mb-1">Total Deductions</p>
                    <p className="text-2xl font-bold text-rose-600">{selectedRun.totalDeductions.toLocaleString()} <span className="text-sm font-normal">SAR</span></p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-slate-600 mb-1">Employees Paid</p>
                    <p className="text-2xl font-bold text-slate-900">{selectedRun.records.length}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Detailed Payment Breakdown</CardTitle>
                <CardDescription>Line item view for each employee in this run.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingRecords ? (
                  <div className="py-8 text-center text-slate-500">Loading records...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">Basic</TableHead>
                        <TableHead className="text-right">Allowances</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Deductions</TableHead>
                        <TableHead className="text-right">Net Pay</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map(record => {
                        const totalAllowances = Object.values(record.allowances || {}).reduce((a,b) => Number(a)+Number(b), 0);
                        const totalDeductions = Object.values(record.deductions || {}).reduce((a,b) => Number(a)+Number(b), 0);
                        return (
                          <TableRow key={record.id}>
                            <TableCell>
                              <p className="font-medium">{record.employee.fullName}</p>
                              <p className="text-xs text-slate-500">{record.employee.jobTitle}</p>
                            </TableCell>
                            <TableCell>{record.employee.department?.name || '-'}</TableCell>
                            <TableCell className="text-right">{record.basicSalary.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-emerald-600">+{totalAllowances.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-medium">{record.grossPay.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-rose-600">-{totalDeductions.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-bold text-indigo-600">{record.netPay.toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
