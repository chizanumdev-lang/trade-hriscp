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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plane, Plus, CheckCircle, XCircle, Upload, Calendar, Edit, Clock } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

const StatsSkeleton = () => (
  <div className="grid md:grid-cols-3 gap-6">
    {Array(3).fill(0).map((_, i) => (
      <div key={i} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm animate-pulse">
        <div className="w-12 h-12 bg-slate-100 rounded-xl mb-4"></div>
        <div className="h-8 bg-slate-100 rounded w-16 mb-2"></div>
        <div className="h-4 bg-slate-100 rounded w-24"></div>
      </div>
    ))}
  </div>
);

const RequestsSkeleton = () => (
  <div className="space-y-4">
    {Array(4).fill(0).map((_, i) => (
      <div key={i} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm animate-pulse flex items-start justify-between">
        <div className="flex gap-4">
          <div className="w-10 h-10 bg-slate-100 rounded-full"></div>
          <div className="space-y-2">
            <div className="h-4 bg-slate-100 rounded w-32"></div>
            <div className="h-3 bg-slate-100 rounded w-24"></div>
            <div className="h-3 bg-slate-100 rounded w-48 mt-2"></div>
          </div>
        </div>
        <div className="space-y-2 flex flex-col items-end">
          <div className="h-6 bg-slate-100 rounded-full w-20"></div>
          <div className="flex gap-2 mt-2">
            <div className="h-8 w-20 bg-slate-100 rounded-md"></div>
            <div className="h-8 w-20 bg-slate-100 rounded-md"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default function AllLeaveRequests() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    total_days: 0,
    reason: '',
    attachment_url: '',
  });
  
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const { data: leaveRequestsData, isLoading: loadingRequests } = useQuery({
    queryKey: ['leave-requests', page, limit],
    queryFn: async () => {
      const LEAVE_QUERY = gql`
        query GetPaginatedLeaveRequests($page: Int!, $limit: Int!) { 
          paginatedLeaveRequests(page: $page, limit: $limit) {
            leaveRequests { id employeeId startDate endDate totalDays status reason createdAt }
            totalCount
            totalPages
            currentPage
          }
        }
      `;
      const data = await gqlClient.request(LEAVE_QUERY, { page, limit });
      return {
        ...data.paginatedLeaveRequests,
        leaveRequests: data.paginatedLeaveRequests.leaveRequests.map(l => ({
          ...l,
          employee_name: l.employeeId,
          employee_email: l.employeeId,
          leave_type: 'annual',
          start_date: l.startDate,
          end_date: l.endDate,
          total_days: l.totalDays,
          approvers: []
        }))
      };
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const EMP_QUERY = gql`query { employees { id fullName email jobTitle } }`;
      const data = await gqlClient.request(EMP_QUERY);
      return (data.employees || []).map(e => ({ ...e, full_name: e.fullName }));
    },
    initialData: [],
  });

  const createAuditLog = async (action, entityId, entityName, changes = {}) => {
    // Mocked for now
  };

  const createLeaveMutation = useMutation({
    mutationFn: async (data) => {
      const CREATE_LEAVE = gql`
        mutation CreateLeave($employeeId: ID!, $startDate: String!, $endDate: String!, $totalDays: Int!, $reason: String) {
          createLeaveRequest(employeeId: $employeeId, startDate: $startDate, endDate: $endDate, totalDays: $totalDays, reason: $reason) { id }
        }
      `;
      const leave = await gqlClient.request(CREATE_LEAVE, {
        employeeId: data.employee_id,
        startDate: new Date(data.start_date).toISOString(),
        endDate: new Date(data.end_date).toISOString(),
        totalDays: parseInt(data.total_days),
        reason: data.reason
      });

      await createAuditLog('create', leave.id, data.employee_id, { after: leave });
      return leave;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      setShowForm(false);
      setEditingLeave(null);
      setFormData({
        employee_id: '',
        leave_type: 'annual',
        start_date: '',
        end_date: '',
        total_days: 0,
        reason: '',
        attachment_url: '',
      });
    },
  });

  const updateLeaveMutation = useMutation({
    mutationFn: async ({ id, data, oldData }) => {
      const UPDATE_LEAVE = gql`
        mutation UpdateLeave($id: ID!, $status: String!) {
          updateLeaveRequest(id: $id, status: $status) { id status }
        }
      `;
      const updated = await gqlClient.request(UPDATE_LEAVE, { id, status: data.status });
      await createAuditLog('update', id, oldData?.employee_name, {
        before: oldData,
        after: updated,
        fields_changed: Object.keys(data)
      });
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      setEditingLeave(null);
      setShowForm(false);
    },
  });

  const handleEdit = (leave) => {
    setEditingLeave(leave);
    setFormData({
      employee_id: leave.employee_id,
      leave_type: leave.leave_type,
      start_date: leave.start_date ? new Date(leave.start_date).toISOString().split('T')[0] : '',
      end_date: leave.end_date ? new Date(leave.end_date).toISOString().split('T')[0] : '',
      total_days: leave.total_days,
      reason: leave.reason,
      attachment_url: leave.attachment_url || '',
    });
    setShowForm(true);
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      setFormData(prev => ({ ...prev, attachment_url: 'https://example.com/mock.pdf' }));
    } catch (error) {
      console.error("Error uploading:", error);
    }
    setUploadingDoc(false);
  };

  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setFormData(prev => ({ ...prev, total_days: days > 0 ? days : 0 }));
    } else {
      setFormData(prev => ({ ...prev, total_days: 0 }));
    }
  }, [formData.start_date, formData.end_date]);

  const handleApprove = async (leave) => {
    updateLeaveMutation.mutate({
      id: leave.id,
      data: { status: 'approved' },
      oldData: leave
    });
  };

  const handleReject = async (leave) => {
    updateLeaveMutation.mutate({
      id: leave.id,
      data: { status: 'rejected' },
      oldData: leave
    });
  };

  const statusStyles = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    cancelled: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  const displayRequests = leaveRequestsData?.leaveRequests || [];
  const totalRequests = leaveRequestsData?.totalCount || 0;
  const totalPages = leaveRequestsData?.totalPages || 1;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 p-4 md:p-8"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full mb-4">
              <Plane className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Leave Management</span>
            </div>
            
            <p className="text-slate-500">Manage and approve employee time off</p>
          </div>
          <Dialog open={showForm} onOpenChange={(open) => {
            setShowForm(open);
            if (!open) {
              setEditingLeave(null);
              setFormData({
                employee_id: '',
                leave_type: 'annual',
                start_date: '',
                end_date: '',
                total_days: 0,
                reason: '',
                attachment_url: '',
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl rounded-2xl border-slate-100 shadow-xl">
              <DialogHeader>
                <DialogTitle>{editingLeave ? 'Edit' : 'Create'} Leave Request</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (editingLeave) {
                  updateLeaveMutation.mutate({ id: editingLeave.id, data: formData, oldData: editingLeave });
                } else {
                  createLeaveMutation.mutate(formData);
                }
              }} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={formData.employee_id} onValueChange={(value) => setFormData(prev => ({ ...prev, employee_id: value }))} disabled={!!editingLeave}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100 shadow-lg">
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
                    <Label>Leave Type</Label>
                    <Select value={formData.leave_type} onValueChange={(value) => setFormData(prev => ({ ...prev, leave_type: value }))}>
                      <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-100 shadow-lg">
                        <SelectItem value="annual">Annual Leave</SelectItem>
                        <SelectItem value="sick">Sick Leave</SelectItem>
                        <SelectItem value="personal">Personal Leave</SelectItem>
                        <SelectItem value="emergency">Emergency Leave</SelectItem>
                        <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                        <SelectItem value="maternity">Maternity Leave</SelectItem>
                        <SelectItem value="paternity">Paternity Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Total Days</Label>
                    <Input type="number" value={formData.total_days} readOnly className="bg-slate-50 rounded-lg text-slate-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={formData.start_date} onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))} className="rounded-lg" required />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={formData.end_date} onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))} className="rounded-lg" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea value={formData.reason} onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))} className="rounded-lg" rows={3} required />
                </div>

                <div className="space-y-2">
                  <Label>Supporting Document (Optional)</Label>
                  <input type="file" onChange={handleDocUpload} className="hidden" id="leave-doc" />
                  <Button type="button" variant="outline" className="w-full rounded-lg border-dashed border-slate-300 hover:border-indigo-300 hover:bg-indigo-50" onClick={() => document.getElementById('leave-doc').click()} disabled={uploadingDoc}>
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingDoc ? 'Uploading...' : formData.attachment_url ? 'Document Uploaded ✓' : 'Upload Document'}
                  </Button>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" className="rounded-lg" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" className="rounded-lg bg-indigo-600 hover:bg-indigo-700" isLoading={createLeaveMutation.isPending || updateLeaveMutation.isPending}>
                    {(createLeaveMutation.isPending || updateLeaveMutation.isPending) ? 'Saving...' : editingLeave ? 'Update Request' : 'Submit Request'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </motion.div>

        {loadingRequests ? (
          <StatsSkeleton />
        ) : (
          <motion.div variants={itemVariants} className="grid md:grid-cols-3 gap-6">
            <Card className="border-slate-200/60 shadow-sm rounded-2xl bg-white overflow-hidden relative">
              <div className="absolute right-0 top-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 opacity-50 pointer-events-none"></div>
              <CardContent className="p-6 relative z-10">
                <div className="w-12 h-12 bg-amber-100/50 rounded-xl flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">
                  {displayRequests.filter(l => l.status === 'pending').length}
                </p>
                <p className="text-sm font-medium text-slate-500 mt-1">Pending Approvals</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/60 shadow-sm rounded-2xl bg-white overflow-hidden relative">
              <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 opacity-50 pointer-events-none"></div>
              <CardContent className="p-6 relative z-10">
                <div className="w-12 h-12 bg-emerald-100/50 rounded-xl flex items-center justify-center mb-4">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">
                  {displayRequests.filter(l => l.status === 'approved').length}
                </p>
                <p className="text-sm font-medium text-slate-500 mt-1">Approved This Month</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/60 shadow-sm rounded-2xl bg-white overflow-hidden relative">
              <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 opacity-50 pointer-events-none"></div>
              <CardContent className="p-6 relative z-10">
                <div className="w-12 h-12 bg-indigo-100/50 rounded-xl flex items-center justify-center mb-4">
                  <Plane className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">{displayRequests.length}</p>
                <p className="text-sm font-medium text-slate-500 mt-1">Total Requests</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">All Leave Requests</h2>
            </div>
            
            <div className="p-6">
              {loadingRequests ? (
                <RequestsSkeleton />
              ) : displayRequests.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                    <Plane className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">No leave requests</h3>
                  <p className="text-slate-500 max-w-sm">When employees submit time off requests, they will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayRequests.map((leave, index) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={leave.id} 
                      className="p-5 bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all rounded-2xl group"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-indigo-700 font-bold text-lg">
                              {leave.employee_name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="font-bold text-slate-900">{leave.employee_name}</h3>
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-semibold border-slate-200 text-slate-600">
                                {leave.leave_type.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{format(new Date(leave.start_date), 'MMM dd, yyyy')}</span>
                              <span className="text-slate-300">-</span>
                              <span>{format(new Date(leave.end_date), 'MMM dd, yyyy')}</span>
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium text-xs ml-1">
                                {leave.total_days} day{leave.total_days !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                              "{leave.reason}"
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-3 pl-16 md:pl-0">
                          <Badge className={`${statusStyles[leave.status]} border font-semibold px-2.5 py-0.5 rounded-full shadow-sm`}>
                            {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                          </Badge>
                          
                          {leave.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" 
                                onClick={() => handleEdit(leave)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 rounded-lg text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" 
                                onClick={() => handleApprove(leave)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1.5" />
                                Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 rounded-lg text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700" 
                                onClick={() => handleReject(leave)}
                              >
                                <XCircle className="w-4 h-4 mr-1.5" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  <div className="mt-6 flex items-center justify-between px-2">
                    <p className="text-sm text-slate-500 font-medium">
                      Showing <span className="text-slate-900 font-semibold">{((page - 1) * limit) + 1}</span> to <span className="text-slate-900 font-semibold">{Math.min(page * limit, totalRequests)}</span> of <span className="text-slate-900 font-semibold">{totalRequests}</span> requests
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="rounded-lg shadow-sm border-slate-200 hover:bg-slate-50 hover:text-indigo-600"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || totalPages === 0}
                        className="rounded-lg shadow-sm border-slate-200 hover:bg-slate-50 hover:text-indigo-600"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}