
import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plane, Plus, Calendar, CheckCircle, XCircle, Clock, Upload, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function LeaveOverview() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'HR_ADMIN' || user?.is_organization_owner;
  const isManager = user?.role === 'MANAGER';
  const [formData, setFormData] = useState({
    employee_email: user?.email || '',
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
    total_days: 0,
    attachment_url: '',
    isHalfDay: false,
    useMultipleDates: false,
    selectedDates: [],
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({ ...prev, employee_email: user.email }));
    }
  }, [user]);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const EMP_QUERY = gql`query { employees { id fullName email jobTitle } }`;
      const data = await gqlClient.request(EMP_QUERY);
      return (data.employees || []).map(e => ({ ...e, full_name: e.fullName }));
    },
    initialData: [],
    enabled: isAdmin,
  });

  useEffect(() => {
    if (employees.length > 0 && user) {
      setEmployee(employees.find(e => e.email === user.email));
    }
  }, [employees, user]);

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const TYPE_QUERY = gql`query { leaveTypes { id name daysPerYear isPaid } }`;
      const data = await gqlClient.request(TYPE_QUERY);
      return data.leaveTypes || [];
    },
    initialData: [],
  });

  useEffect(() => {
    if (leaveTypes.length > 0 && !formData.leave_type) {
      setFormData(prev => ({ ...prev, leave_type: leaveTypes[0].id }));
    }
  }, [leaveTypes]);

  const activeEmployeeId = isAdmin && formData.employee_email 
    ? employees.find(e => e.email === formData.employee_email)?.id 
    : user?.employeeId;

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leave-requests', activeEmployeeId],
    queryFn: async () => {
      const LEAVE_QUERY = gql`
        query GetLeaveRequests { 
          leaveRequests { 
            id employeeId leaveTypeId startDate endDate totalDays status reason attachmentUrl createdAt 
            employee { email fullName } leaveType { name } 
          } 
        }
      `;
      const data = await gqlClient.request(LEAVE_QUERY);
      return (data.leaveRequests || []).map(l => {
        const typeName = l.leaveType?.name || 'Annual Leave';
        return {
          ...l,
          employee_email: l.employee?.email || l.employeeId,
          employee_name: l.employee?.fullName || l.employeeId,
          leave_type: typeName,
          start_date: l.startDate,
          end_date: l.endDate,
          total_days: l.totalDays,
          isHalfDay: l.isHalfDay,
          selectedDates: l.selectedDates,
          attachment_url: l.attachmentUrl,
          approvers: [] // Mocked
        };
      });
    },
    enabled: !!activeEmployeeId,
    initialData: [],
  });

  const { data: leaveBalances = [], refetch: refetchBalances } = useQuery({
    queryKey: ['leave-balances', activeEmployeeId],
    queryFn: async () => {
      if (!activeEmployeeId) return [];
      const BALANCES_QUERY = gql`
        query GetBalances($employeeId: ID!) { 
          leaveBalances(employeeId: $employeeId) { 
            id leaveTypeId totalEntitled used pending available carriedForward expired 
          } 
        }
      `;
      const data = await gqlClient.request(BALANCES_QUERY, { employeeId: activeEmployeeId });
      return data.leaveBalances || [];
    },
    enabled: !!activeEmployeeId,
  });

  const createLeaveMutation = useMutation({
    mutationFn: async (data) => {
      const CREATE_LEAVE = gql`
        mutation CreateLeave($leaveTypeId: String!, $startDate: String!, $endDate: String!, $totalDays: Float!, $reason: String, $attachmentUrl: String, $isHalfDay: Boolean, $selectedDates: [String!]) {
          submitLeaveRequest(input: {
            leaveTypeId: $leaveTypeId,
            startDate: $startDate,
            endDate: $endDate,
            totalDays: $totalDays,
            reason: $reason,
            attachmentUrl: $attachmentUrl,
            isHalfDay: $isHalfDay,
            selectedDates: $selectedDates
          }) { id status }
        }
      `;
      
      const start = data.useMultipleDates && data.selectedDates.length > 0 ? data.selectedDates[0] : data.start_date;
      const end = data.useMultipleDates && data.selectedDates.length > 0 ? data.selectedDates[data.selectedDates.length - 1] : data.end_date;

      return gqlClient.request(CREATE_LEAVE, {
        leaveTypeId: data.leave_type,
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString(),
        totalDays: data.isHalfDay ? 0.5 : parseFloat(data.total_days),
        reason: data.reason,
        attachmentUrl: data.attachment_url,
        isHalfDay: data.isHalfDay,
        selectedDates: data.useMultipleDates ? data.selectedDates : []
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      queryClient.invalidateQueries({ queryKey: ['pendingApprovalsCount'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      refetchBalances();
      setShowForm(false);
      setFormData({
        employee_email: employee?.email || '',
        leave_type: leaveTypes.length > 0 ? leaveTypes[0].id : '',
        start_date: '',
        end_date: '',
        reason: '',
        total_days: 0,
        attachment_url: '',
        isHalfDay: false,
        useMultipleDates: false,
        selectedDates: [],
      });
    },
    onError: (error) => {
      console.error(error);
      const msg = error.response?.errors?.[0]?.message || error.message || "Failed to submit leave request.";
      toast.error(msg);
    }
  });

  const updateLeaveMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      if (status === 'APPROVED') {
        const APPROVE_LEAVE = gql`
          mutation ApproveLeave($id: ID!) {
            approveLeaveRequest(id: $id) { id status }
          }
        `;
        return gqlClient.request(APPROVE_LEAVE, { id });
      } else if (status === 'REJECTED') {
        const REJECT_LEAVE = gql`
          mutation RejectLeave($id: ID!) {
            rejectLeaveRequest(id: $id) { id status }
          }
        `;
        return gqlClient.request(REJECT_LEAVE, { id });
      } else if (status === 'CANCELLED') {
        const CANCEL_LEAVE = gql`
          mutation CancelLeave($id: ID!) {
            cancelLeaveRequest(id: $id) { id status }
          }
        `;
        return gqlClient.request(CANCEL_LEAVE, { id });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      queryClient.invalidateQueries({ queryKey: ['pendingApprovalsCount'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      let actionText = 'updated';
      if (variables.status === 'APPROVED') actionText = 'approved';
      if (variables.status === 'REJECTED') actionText = 'rejected';
      if (variables.status === 'CANCELLED') actionText = 'cancelled';
      
      toast.success(`Leave request successfully ${actionText}`);
    },
    onError: (error) => {
      console.error("Failed to update leave request:", error);
      const msg = error.response?.errors?.[0]?.message || error.message || "Failed to update leave request.";
      toast.error(msg);
    }
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      // Mocked file upload
      setFormData(prev => ({ ...prev, attachment_url: 'https://example.com/mock.pdf' }));
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file. Please try again.");
      setFormData(prev => ({ ...prev, attachment_url: '' })); // Clear attachment on error
    }
    setUploadingFile(false);
  };

  const handleApprove = (request) => {
    updateLeaveMutation.mutate({
      id: request.id,
      status: 'APPROVED'
    });
  };

  const handleReject = (request) => {
    updateLeaveMutation.mutate({
      id: request.id,
      status: 'REJECTED'
    });
  };

  const handleCancel = (request) => {
    updateLeaveMutation.mutate({
      id: request.id,
      status: 'CANCELLED'
    });
  };

  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate < startDate) return 0;

    let days = 0;
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
  };

  const safeDate = (val) => {
    if (!val) return new Date();
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
    const num = Number(val);
    if (!isNaN(num)) return new Date(num);
    return new Date();
  };

  const handleDateChange = (field, value) => {
    const newData = { ...formData, [field]: value };
    if (field === 'start_date' || field === 'end_date') {
      const days = calculateDays(newData.start_date, newData.end_date);
      newData.total_days = newData.isHalfDay ? days * 0.5 : days;
    }
    setFormData(newData);
  };

  const addSelectedDate = (date) => {
    if (!date) return;
    const newDates = [...formData.selectedDates, date].sort();
    setFormData({ ...formData, selectedDates: newDates, total_days: formData.isHalfDay ? newDates.length * 0.5 : newDates.length });
  };

  const removeSelectedDate = (date) => {
    const newDates = formData.selectedDates.filter(d => d !== date);
    setFormData({ ...formData, selectedDates: newDates, total_days: formData.isHalfDay ? newDates.length * 0.5 : newDates.length });
  };

  const myRequests = leaveRequests.filter(r => r.employee_email === user?.email);
  const pendingApprovals = leaveRequests.filter(r => {
    if (r.employee_email === user?.email) return false;
    if (isAdmin) {
      return r.status === 'PENDING' || r.status === 'PENDING_HR' || r.status === 'PENDING_SUPER_ADMIN';
    }
    if (isManager) {
      return r.status === 'PENDING';
    }
    return false;
  });

  const statusColors = {
    APPROVED: 'bg-green-100 text-green-800 border-green-200',
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    PENDING_HR: 'bg-purple-100 text-purple-800 border-purple-200',
    REJECTED: 'bg-red-100 text-red-800 border-red-200',
    CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const selectedLeaveTypeObj = leaveTypes.find(t => t.id === formData.leave_type);
  const requiresAttachment = selectedLeaveTypeObj && (
    selectedLeaveTypeObj.name === 'Study Leave' || 
    (selectedLeaveTypeObj.name === 'Sick Leave' && formData.total_days > 2)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
              <Plane className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-slate-700">Leave Management</span>
            </div>
            
            <p className="text-lg text-slate-600">
              Request time off and manage approvals
            </p>
          </div>
            <Button 
              onClick={() => setShowForm(!showForm)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Leave Request
            </Button>
        </div>

        {/* Leave Balances */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {leaveBalances.length > 0 ? (
            leaveBalances.map(balance => {
              const type = leaveTypes.find(t => t.id === balance.leaveTypeId) || { name: 'Unknown' };
              return (
                <Card key={balance.id} className="border-slate-200">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-sm font-medium text-slate-500 uppercase">{type.name}</p>
                    <p className="text-3xl font-bold text-blue-600 my-2">{balance.available}</p>
                    <p className="text-xs text-slate-400">
                      Entitlement: {balance.totalEntitled} | Used: {balance.used} | Pending: {balance.pending}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            leaveTypes.map(type => (
              <Card key={type.id} className="border-slate-200 opacity-50">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <p className="text-sm font-medium text-slate-500 uppercase">{type.name}</p>
                  <p className="text-3xl font-bold text-slate-400 my-2">-</p>
                  <p className="text-xs text-slate-400">Balance not initialized</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Request Form */}
        {showForm && (
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle>New Leave Request</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (requiresAttachment && !formData.attachment_url) {
                    toast.error("Please upload a supporting document for your leave request.");
                    return;
                  }
                  createLeaveMutation.mutate(formData);
                }}
                className="space-y-6"
              >
                {/* Conditional Employee Selection for Admin */}
                {isAdmin && (
                  <div className="space-y-2">
                    <Label>Apply For</Label>
                    <Select 
                      value={formData.employee_email} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, employee_email: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.email}>
                            {emp.full_name} - {emp.job_title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Leave Type *</Label>
                    <Select 
                      value={formData.leave_type} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, leave_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {leaveTypes.map(type => (
                          <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedLeaveTypeObj?.noticeDaysRequired > 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Requires at least {selectedLeaveTypeObj.noticeDaysRequired} days notice.
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="isHalfDay" 
                        checked={formData.isHalfDay} 
                        onChange={(e) => {
                          const isHalf = e.target.checked;
                          let tDays = 0;
                          if (formData.useMultipleDates) {
                            tDays = formData.selectedDates.length * (isHalf ? 0.5 : 1);
                          } else {
                            tDays = calculateDays(formData.start_date, formData.end_date) * (isHalf ? 0.5 : 1);
                          }
                          setFormData({ ...formData, isHalfDay: isHalf, total_days: tDays });
                        }} 
                        className="rounded border-slate-300"
                      />
                      <Label htmlFor="isHalfDay">Half-Day Request</Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="useMultipleDates" 
                        checked={formData.useMultipleDates} 
                        onChange={(e) => {
                          const useMultiple = e.target.checked;
                          let tDays = 0;
                          if (useMultiple) {
                            tDays = formData.selectedDates.length * (formData.isHalfDay ? 0.5 : 1);
                          } else {
                            tDays = calculateDays(formData.start_date, formData.end_date) * (formData.isHalfDay ? 0.5 : 1);
                          }
                          setFormData({ ...formData, useMultipleDates: useMultiple, total_days: tDays });
                        }} 
                        className="rounded border-slate-300"
                      />
                      <Label htmlFor="useMultipleDates">Multiple Non-Continuous Dates</Label>
                    </div>
                  </div>

                  {!formData.useMultipleDates ? (
                    <>
                      <div className="space-y-2">
                        <Label>Start Date *</Label>
                        <Input 
                          type="date" 
                          value={formData.start_date}
                          onChange={(e) => handleDateChange('start_date', e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>End Date *</Label>
                        <Input 
                          type="date" 
                          value={formData.end_date}
                          onChange={(e) => handleDateChange('end_date', e.target.value)}
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2 col-span-1 md:col-span-2">
                      <Label>Selected Dates</Label>
                      <div className="flex items-center gap-2 mb-2">
                        <Input 
                          type="date" 
                          id="multipleDateInput"
                        />
                        <Button type="button" onClick={() => {
                          const val = document.getElementById('multipleDateInput').value;
                          if (val) addSelectedDate(val);
                        }}>Add Date</Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.selectedDates.map(date => (
                          <Badge key={date} variant="secondary" className="px-3 py-1 text-sm flex items-center gap-2">
                            {format(new Date(date), 'MMM d, yyyy')}
                            <XCircle className="w-4 h-4 cursor-pointer text-slate-400 hover:text-red-500" onClick={() => removeSelectedDate(date)} />
                          </Badge>
                        ))}
                        {formData.selectedDates.length === 0 && <span className="text-sm text-slate-500">No dates added yet</span>}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label>Total Days</Label>
                    <Input type="number" value={formData.total_days} disabled className="bg-slate-50" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Reason *</Label>
                  <Textarea
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    rows={4}
                    required
                  />
                </div>

                {/* File Upload Section */}
                {(requiresAttachment || formData.attachment_url) && (
                  <div className="space-y-2">
                    <Label>Supporting Document {requiresAttachment ? '* (Required)' : '(Optional)'}</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        id="attachment"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('attachment').click()}
                        disabled={uploadingFile}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingFile ? 'Uploading...' : 'Upload Document'}
                      </Button>
                      {formData.attachment_url && (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <Paperclip className="w-4 h-4" />
                          Document attached
                        </div>
                      )}
                      {requiresAttachment && !formData.attachment_url && (
                        <span className="text-sm text-red-500">
                          Document is required for this request.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={createLeaveMutation.isPending} disabled={requiresAttachment && !formData.attachment_url}>
                    {createLeaveMutation.isPending ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Pending Approvals (for managers) */}
        {pendingApprovals.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="border-b border-orange-200">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-600" />
                Pending Approvals ({pendingApprovals.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {pendingApprovals.map(request => (
                <Card key={request.id} className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 mb-2">{request.employee_name}</h4>
                        <div className="space-y-1 text-sm text-slate-600">
                          <p><strong>Type:</strong> {request.leave_type.replace('_', ' ')} {request.isHalfDay && <Badge variant="secondary" className="ml-1 text-[10px]">Half Day</Badge>}</p>
                          <p><strong>Duration:</strong> {
                            request.selectedDates && request.selectedDates.length > 0 
                              ? request.selectedDates.map(d => format(safeDate(d), 'MMM d')).join(', ')
                              : `${format(safeDate(request.start_date), 'MMM d')} - ${format(safeDate(request.end_date), 'MMM d')}`
                          } ({request.total_days} days)</p>
                          <p><strong>Reason:</strong> {request.reason}</p>
                          {request.attachment_url && (
                            <p className="flex items-center gap-2">
                              <Paperclip className="w-4 h-4 text-blue-500" />
                              <a 
                                href={request.attachment_url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-blue-600 hover:underline"
                              >
                                View Document
                              </a>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(request)}
                          disabled={updateLeaveMutation.isPending}
                        >
                          {updateLeaveMutation.isPending && updateLeaveMutation.variables?.id === request.id && updateLeaveMutation.variables?.status === 'APPROVED' ? (
                             <>Approving...</>
                          ) : (
                            <><CheckCircle className="w-4 h-4 mr-1" /> Approve</>
                          )}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleReject(request)}
                          disabled={updateLeaveMutation.isPending}
                        >
                          {updateLeaveMutation.isPending && updateLeaveMutation.variables?.id === request.id && updateLeaveMutation.variables?.status === 'REJECTED' ? (
                             <>Rejecting...</>
                          ) : (
                            <><XCircle className="w-4 h-4 mr-1" /> Reject</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}

        {/* My Requests */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle>My Leave Requests</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {myRequests.length === 0 ? (
              <div className="text-center py-12">
                <Plane className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">No leave requests yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myRequests.map(request => (
                  <Card key={request.id} className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h4 className="font-semibold text-slate-900">
                              {request.leave_type.replace('_', ' ').toUpperCase()}
                            </h4>
                            <Badge variant="outline" className={statusColors[request.status]}>
                              {request.status}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm text-slate-600">
                            <p className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {request.selectedDates && request.selectedDates.length > 0
                                ? request.selectedDates.map(d => format(safeDate(d), 'MMM d')).join(', ')
                                : `${format(safeDate(request.start_date), 'MMM d, yyyy')} - ${format(safeDate(request.end_date), 'MMM d, yyyy')}`
                              }
                            </p>
                            <p><strong>Days:</strong> {request.total_days} {request.isHalfDay && <Badge variant="secondary" className="ml-1 text-[10px]">Half Day</Badge>}</p>
                            <p><strong>Reason:</strong> {request.reason}</p>
                            
                            {request.attachment_url && (
                               <p className="flex items-center gap-2">
                                 <Paperclip className="w-4 h-4 text-blue-500" />
                                 <a 
                                   href={request.attachment_url} 
                                   target="_blank" 
                                   rel="noopener noreferrer" 
                                   className="text-blue-600 hover:underline"
                                 >
                                   View Document
                                 </a>
                               </p>
                             )}

                            {request.approvers && request.approvers.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-100">
                                <p className="font-medium text-slate-700 mb-2">Approvals:</p>
                                {request.approvers.map((approver, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs">
                                    <span>{approver.name}</span>
                                    <Badge 
                                      variant="outline" 
                                      className={`${statusColors[approver.status]} text-xs`}
                                    >
                                      {approver.status}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {['PENDING', 'PENDING_HR', 'APPROVED'].includes(request.status) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                Cancel
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel Leave Request</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to cancel this leave request? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>No, keep it</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleCancel(request)} 
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                  Yes, cancel request
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
