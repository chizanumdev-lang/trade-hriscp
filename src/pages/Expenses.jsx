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
import { Receipt, Plus, Upload, CheckCircle, XCircle, Clock, Download, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function Expenses() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canAddForOthers, setCanAddForOthers] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Mock current user
        const currentUser = { role: 'admin', email: 'admin@tradevu.com', full_name: 'Admin User', organization_id: 'org-1' };
        setUser(currentUser);
        const adminStatus = currentUser.role === 'admin' || currentUser.is_organization_owner;
        setIsAdmin(adminStatus);
        
        setEmployee(null);
        setCanAddForOthers(adminStatus);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: claims = [] } = useQuery({
    queryKey: ['expense-claims'],
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
    enabled: canAddForOthers,
  });

  const myClaims = claims.filter(c => c.employee_id === employee?.id);
  const displayClaims = isAdmin ? claims : myClaims;

  const [formData, setFormData] = useState({
    employee_id: employee?.id || '', // Added this for selecting employee
    expense_type: 'travel',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    receipt_url: '',
  });

  const createClaimMutation = useMutation({
    mutationFn: (data) => {
      const selectedEmployee = canAddForOthers && data.employee_id !== employee?.id
        ? employees.find(e => e.id === data.employee_id)
        : employee;
        
      if (!selectedEmployee) {
        throw new Error("Selected employee not found.");
      }

      return {
        id: Math.random().toString(),
        ...data,
        organization_id: user.organization_id, // Ensure organization_id is included
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.full_name,
        status: 'pending',
        currency: 'SAR',
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-claims'] });
      setShowClaimForm(false);
      setFormData({
        employee_id: employee?.id || '', // Reset employee_id to current user after submission
        expense_type: 'travel',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        receipt_url: '',
      });
    },
  });

  const updateClaimMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return { id, ...data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-claims'] });
    },
  });

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    try {
      // const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const file_url = 'mock_url';
      setFormData(prev => ({ ...prev, receipt_url: file_url }));
    } catch (error) {
      console.error("Error uploading receipt:", error);
    }
    setUploadingReceipt(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createClaimMutation.mutate(formData);
  };

  const handleApprove = (claim) => {
    updateClaimMutation.mutate({
      id: claim.id,
      data: {
        status: 'approved',
        reviewed_by: user.email,
        reviewed_date: new Date().toISOString().split('T')[0],
      }
    });
  };

  const handleReject = (claim, reason) => {
    updateClaimMutation.mutate({
      id: claim.id,
      data: {
        status: 'rejected',
        reviewed_by: user.email,
        reviewed_date: new Date().toISOString().split('T')[0],
        rejection_reason: reason || 'Not approved',
      }
    });
  };

  const totalPending = displayClaims.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
  const totalApproved = displayClaims.filter(c => c.status === 'approved').reduce((sum, c) => sum + c.amount, 0);
  const totalReimbursed = displayClaims.filter(c => c.status === 'reimbursed').reduce((sum, c) => sum + c.amount, 0);

  const statusConfig = {
    pending: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
    approved: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle },
    reimbursed: { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
    rejected: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  };

  // Get direct reports for non-admin, if applicable
  const myDirectReports = employees.filter(e => e.manager_email === user?.email);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
              <Receipt className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-slate-700">Expense Management</span>
            </div>
            
            <p className="text-lg text-slate-600">
              Submit and manage expense reimbursements
            </p>
          </div>
          {employee && (
            <Button 
              onClick={() => {
                setFormData({ ...formData, employee_id: employee.id });
                setShowClaimForm(true);
              }}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Expense
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-yellow-100 p-3 rounded-xl">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">
                {totalPending.toLocaleString()} SAR
              </div>
              <div className="text-sm text-slate-600">Pending</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-blue-100 p-3 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">
                {totalApproved.toLocaleString()} SAR
              </div>
              <div className="text-sm text-slate-600">Approved</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-green-100 p-3 rounded-xl">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">
                {totalReimbursed.toLocaleString()} SAR
              </div>
              <div className="text-sm text-slate-600">Reimbursed</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-purple-100 p-3 rounded-xl">
                  <Receipt className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">
                {displayClaims.length}
              </div>
              <div className="text-sm text-slate-600">Total Claims</div>
            </CardContent>
          </Card>
        </div>

        {/* Claim Form */}
        {showClaimForm && employee && (
          <Card className="border-slate-200 shadow-xl">
            <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-purple-50 to-pink-50">
              <CardTitle>Submit Expense Claim</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {canAddForOthers && (
                  <div className="space-y-2">
                    <Label htmlFor="submit_for_employee">Submit For</Label>
                    <Select 
                      value={formData.employee_id} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, employee_id: value }))}
                    >
                      <SelectTrigger id="submit_for_employee">
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={employee.id}>Myself - {employee.full_name}</SelectItem>
                        {myDirectReports.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.full_name} - {emp.job_title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="expense_type">Expense Type *</Label>
                    <Select value={formData.expense_type} onValueChange={(value) => setFormData(prev => ({ ...prev, expense_type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="meals">Meals</SelectItem>
                        <SelectItem value="accommodation">Accommodation</SelectItem>
                        <SelectItem value="supplies">Supplies</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (SAR) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">Expense Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receipt">Receipt Upload</Label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        id="receipt"
                        accept="image/*,.pdf"
                        onChange={handleReceiptUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('receipt').click()}
                        disabled={uploadingReceipt}
                        className="w-full"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingReceipt ? "Uploading..." : formData.receipt_url ? "Change Receipt" : "Upload Receipt"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    required
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowClaimForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={createClaimMutation.isPending}>
                    {createClaimMutation.isPending ? "Submitting..." : "Submit Claim"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Claims List */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle>Expense Claims</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {displayClaims.length === 0 ? (
              <div className="p-12 text-center">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No expense claims yet</h3>
                <p className="text-slate-500">Submit your first claim to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {displayClaims.map((claim) => {
                  const config = statusConfig[claim.status];
                  const StatusIcon = config.icon;

                  return (
                    <div key={claim.id} className="p-6 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-slate-900 capitalize">
                              {claim.expense_type.replace('_', ' ')}
                            </h3>
                            <Badge variant="outline" className={`${config.color} border flex items-center gap-1`}>
                              <StatusIcon className="w-3 h-3" />
                              {claim.status}
                            </Badge>
                            <span className="text-lg font-bold text-slate-900">
                              {claim.amount.toLocaleString()} {claim.currency}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-1">{claim.employee_name}</p>
                          <p className="text-sm text-slate-500 mb-2">{claim.description}</p>
                          <p className="text-xs text-slate-400">
                            Date: {format(new Date(claim.date), "MMM d, yyyy")}
                          </p>
                          {claim.rejection_reason && (
                            <p className="text-sm text-red-600 mt-2">Reason: {claim.rejection_reason}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {claim.receipt_url && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={claim.receipt_url} target="_blank" rel="noopener noreferrer">
                                <Download className="w-4 h-4 mr-2" />
                                Receipt
                              </a>
                            </Button>
                          )}
                          {isAdmin && claim.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => handleApprove(claim)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => handleReject(claim)}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
