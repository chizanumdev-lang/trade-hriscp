// @ts-nocheck
import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign, Plus, Clock, Calendar, User } from "lucide-react";
import { format } from "date-fns";

export default function Loans() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    loan_type: 'standard',
    loan_amount: 0,
    loan_reason: '',
    duration_months: 12,
    paid_from: 'New Era LLC',
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Mock current user
        const currentUser = { role: 'admin', email: 'admin@tradevu.com', full_name: 'Admin User', organization_id: 'org-1' };
        setUser(currentUser);
        setIsAdmin(currentUser.role === 'admin' || currentUser.is_organization_owner);
        
        // Mock employees search
        setEmployee(null);
        setFormData(prev => ({ ...prev, employee_id: '' }));
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: loans = [] } = useQuery({
    queryKey: ['loans'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const query = `query { employees { id first_name last_name job_title } }`;
      const data = await gqlClient.request(query);
      return data.employees.map(emp => ({
        id: emp.id,
        full_name: `${emp.first_name} ${emp.last_name}`,
        job_title: emp.job_title,
      }));
    },
    initialData: [],
    enabled: isAdmin,
  });

  const myLoans = isAdmin ? loans : loans.filter(l => l.employee_id === employee?.id);

  const createLoanMutation = useMutation({
    mutationFn: (data) => {
      const selectedEmployee = isAdmin 
        ? employees.find(e => e.id === data.employee_id)
        : employee;
        
      const monthlyInstallment = data.loan_amount / data.duration_months;
      const startMonth = new Date().toISOString().slice(0, 7);
      
      return {
        id: Math.random().toString(),
        ...data,
        organization_id: user.organization_id,
        employee_name: selectedEmployee?.full_name,
        monthly_installment: monthlyInstallment,
        start_month: startMonth,
        remaining_amount: data.loan_amount,
        status: 'pending'
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setShowForm(false);
      setFormData({
        employee_id: employee?.id || '',
        loan_type: 'standard',
        loan_amount: 0,
        loan_reason: '',
        duration_months: 12,
        paid_from: 'New Era LLC',
      });
    },
  });

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    completed: 'bg-slate-100 text-slate-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-slate-700">Loan Management</span>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-3">{isAdmin ? 'Employee' : 'My'} Loans</h1>
            <p className="text-lg text-slate-600">Manage and track loan requests</p>
          </div>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
                <Plus className="w-4 h-4 mr-2" />
                New Loan Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>New Loan Request</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createLoanMutation.mutate(formData); }} className="space-y-4">
                {isAdmin && (
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
                )}
                
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <User className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-slate-600">Requesting for</p>
                      <p className="font-semibold text-slate-900">
                        {isAdmin 
                          ? employees.find(e => e.id === formData.employee_id)?.full_name || 'Select employee'
                          : employee?.full_name}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Loan Type</Label>
                    <Select value={formData.loan_type} onValueChange={(value) => setFormData(prev => ({ ...prev, loan_type: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard Loan</SelectItem>
                        <SelectItem value="emergency">Emergency Loan</SelectItem>
                        <SelectItem value="advance">Salary Advance</SelectItem>
                        <SelectItem value="personal">Personal Loan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (SAR)</Label>
                    <Input type="number" value={formData.loan_amount} onChange={(e) => setFormData(prev => ({ ...prev, loan_amount: parseFloat(e.target.value) }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (Months)</Label>
                    <Input type="number" value={formData.duration_months} onChange={(e) => setFormData(prev => ({ ...prev, duration_months: parseInt(e.target.value) }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Installment</Label>
                    <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-md text-center">
                      <p className="font-semibold text-blue-700">
                        SAR {(formData.loan_amount / formData.duration_months).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea value={formData.loan_reason} onChange={(e) => setFormData(prev => ({ ...prev, loan_reason: e.target.value }))} rows={3} required placeholder="Hi, I'm buying an apartment and I need a loan for the down payment." />
                </div>
                <div className="space-y-2">
                  <Label>Paid From</Label>
                  <Input value={formData.paid_from} onChange={(e) => setFormData(prev => ({ ...prev, paid_from: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" isLoading={createLoanMutation.isPending}>
                    {createLoanMutation.isPending ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-6">
          {myLoans.map(loan => (
            <Card key={loan.id} className="border-slate-200 hover:shadow-xl transition-all overflow-hidden">
              <div className="bg-white p-6 border-b border-slate-100">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Loan</h3>
                      <p className="text-sm text-slate-500">Loan Amount</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">SAR {loan.loan_amount.toLocaleString()}</p>
                    <Badge className={statusColors[loan.status]}>{loan.status}</Badge>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-700 font-semibold">
                      {loan.employee_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-600 italic">"{loan.loan_reason}"</p>
                  </div>
                </div>
              </div>

              <CardContent className="p-6 bg-slate-50">
                <div className="mb-6">
                  <p className="text-sm font-medium text-slate-700 mb-2">To be paid from</p>
                  <p className="text-lg font-bold text-slate-900">{loan.paid_from || 'New Era LLC'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-slate-400" />
                      <p className="text-xs text-slate-500 uppercase">Loan Type</p>
                    </div>
                    <p className="font-semibold text-slate-900 capitalize">{loan.loan_type.replace('_', ' ')}</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-slate-400" />
                      <p className="text-xs text-slate-500 uppercase">Amount</p>
                    </div>
                    <p className="font-semibold text-slate-900">SAR {loan.loan_amount.toLocaleString()}</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <p className="text-xs text-slate-500 uppercase">Loan Duration</p>
                    </div>
                    <p className="font-semibold text-slate-900">{loan.duration_months} months</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-slate-400" />
                      <p className="text-xs text-slate-500 uppercase">Monthly Instalment</p>
                    </div>
                    <p className="font-semibold text-slate-900">SAR {loan.monthly_installment?.toFixed(2)}</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <p className="text-xs text-slate-500 uppercase">Payment Month / First Instalment</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-slate-900">
                        {format(new Date(loan.start_month + '-01'), 'MMMM yyyy')}
                      </p>
                      <p className="font-semibold text-slate-900">
                        {format(new Date(loan.start_month).setMonth(new Date(loan.start_month).getMonth() + 1), 'MMMM yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {myLoans.length === 0 && (
            <Card className="col-span-full border-slate-200">
              <CardContent className="p-12 text-center">
                <DollarSign className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No loans yet</h3>
                <p className="text-slate-500 mb-4">Create your first loan request</p>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Loan Request
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}