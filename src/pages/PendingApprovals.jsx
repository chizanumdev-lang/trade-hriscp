import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { gql } from 'graphql-request';
import { gqlClient } from '@/api/graphqlClient';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { CheckCircle2, XCircle, FileText, UserCircle, CalendarRange, Eye, Inbox, Loader2, AlertCircle } from 'lucide-react';
import { extractErrorMessage } from '../lib/utils';
import { motion } from 'framer-motion';
import EmployeeDetail from './EmployeeDetail';
import UnifiedProfileReviewDialog from '../components/UnifiedProfileReviewDialog';

const GET_PENDING_APPROVALS = gql`
  query GetPendingApprovals {
    employees {
      id
      fullName
      jobTitle
      employmentStatus
      hireDate
      department {
        name
      }
    }
    documents {
      id
      name
      category
      status
      employeeId
      fileUrl
      fileType
      createdAt
    }
    leaveRequests {
      id
      employeeId
      leaveTypeId
      startDate
      endDate
      totalDays
      status
      reason
      attachmentUrl
      createdAt
      employee {
        email
      }
    }
    profileUpdateRequests {
      id
      employeeId
      fieldName
      currentValue
      requestedValue
      status
      createdAt
    }
    allOffboardings {
      id
      employeeId
      exitType
      exitDate
      reason
      status
      employee {
        fullName
      }
    }
    allProbationRequests {
      id
      employeeId
      startDate
      endDate
      status
      employee {
        fullName
      }
    }
  }
`;

const APPROVE_EMPLOYEE = gql`
  mutation ApproveEmployee($employeeId: ID!) {
    approveEmployeeData(employeeId: $employeeId) {
      id
      employmentStatus
    }
  }
`;

const APPROVE_DOCUMENT = gql`
  mutation ApproveDocument($id: ID!) {
    approveDocument(id: $id) {
      id
      status
    }
  }
`;

const REJECT_DOCUMENT = gql`
  mutation RejectDocument($id: ID!, $reason: String, $attachmentUrl: String) {
    rejectDocument(id: $id, reason: $reason, attachmentUrl: $attachmentUrl) {
      id
      status
    }
  }
`;

const APPROVE_LEAVE = gql`
  mutation ApproveLeave($id: ID!) {
    approveLeaveRequest(id: $id) {
      id
      status
    }
  }
`;

const REJECT_LEAVE = gql`
  mutation RejectLeave($id: ID!, $reason: String, $attachmentUrl: String) {
    rejectLeaveRequest(id: $id, reason: $reason, attachmentUrl: $attachmentUrl) {
      id
      status
    }
  }
`;

const APPROVE_PROFILE = gql`
  mutation ApproveProfile($id: ID!) {
    approveProfileUpdateRequest(id: $id) {
      id
      status
    }
  }
`;

const REJECT_PROFILE = gql`
  mutation RejectProfile($id: ID!, $reason: String, $attachmentUrl: String!) {
    rejectProfileUpdateRequest(id: $id, reason: $reason, attachmentUrl: $attachmentUrl) {
      id
      status
    }
  }
`;

const APPROVE_OFFBOARDING = gql`
  mutation ApproveOffboarding($id: ID!, $comments: String) {
    approveOffboarding(id: $id, comments: $comments) {
      id
      status
    }
  }
`;

const REJECT_OFFBOARDING = gql`
  mutation RejectOffboarding($id: ID!, $comments: String) {
    rejectOffboarding(id: $id, comments: $comments) {
      id
      status
    }
  }
`;

const APPROVE_PROBATION = gql`
  mutation ApproveProbation($id: ID!, $status: String!, $comments: String) {
    approveProbation(id: $id, status: $status, comments: $comments) {
      id
      status
    }
  }
`;

const RejectDialog = ({ onReject, title = "Reject Request" }) => {
  const [reason, setReason] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const handleReject = () => {
    if (!reason.trim()) return;
    onReject(reason);
    setOpen(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-slate-600 border-slate-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 flex items-center gap-2 transition-colors">
          <XCircle className="w-4 h-4" />
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent className="border-slate-100 shadow-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-900 tracking-tight">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Reason for rejection (Required)</label>
            <textarea
              className="w-full min-h-[100px] p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors resize-none"
              placeholder="Please provide a reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-lg" onClick={() => setOpen(false)}>Cancel</Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm"
              disabled={!reason.trim()} 
              onClick={handleReject}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ApprovalsSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    {Array(4).fill(0).map((_, i) => (
      <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 border border-slate-100 rounded-xl bg-white shadow-sm gap-4">
        <div className="flex-1 space-y-3 w-full">
          <div className="h-4 bg-slate-100 rounded w-1/3"></div>
          <div className="h-3 bg-slate-100 rounded w-1/2"></div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-9 w-24 bg-slate-100 rounded-lg"></div>
          <div className="h-9 w-24 bg-slate-100 rounded-lg"></div>
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ message, icon: Icon }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="text-center p-12 flex flex-col items-center justify-center border border-slate-100 rounded-2xl bg-white/50 border-dashed"
  >
    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-slate-300" />
    </div>
    <p className="text-slate-500 font-medium">{message}</p>
  </motion.div>
);

export default function PendingApprovals() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedUnifiedEmployeeId, setSelectedUnifiedEmployeeId] = useState(null);
  const { data, isLoading: loading, error } = useQuery({
    queryKey: ['pendingApprovals'],
    queryFn: () => gqlClient.request(GET_PENDING_APPROVALS),
    refetchInterval: 10000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
    queryClient.invalidateQueries({ queryKey: ['pendingApprovalsCount'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleError = (err) => {
    toast.error(extractErrorMessage(err, "Operation failed."));
  };

  const { mutate: approveEmployee, isPending: isApprovingEmployee, variables: empAppVars } = useMutation({
    mutationFn: (variables) => gqlClient.request(APPROVE_EMPLOYEE, variables),
    onSuccess: () => {
      toast.success("Employee approved successfully!");
      invalidate();
    },
    onError: handleError
  });
  
  const { mutate: approveDocument, isPending: isApprovingDoc, variables: docAppVars } = useMutation({
    mutationFn: (variables) => gqlClient.request(APPROVE_DOCUMENT, variables),
    onSuccess: () => {
      toast.success("Document approved!");
      invalidate();
    },
    onError: handleError
  });
  
  const { mutate: rejectDocument, isPending: isRejectingDoc, variables: docRejVars } = useMutation({
    mutationFn: (variables) => gqlClient.request(REJECT_DOCUMENT, variables),
    onSuccess: () => {
      toast.success("Document rejected!");
      invalidate();
    },
    onError: handleError
  });
  
  const { mutate: approveLeave, isPending: isApprovingLeave, variables: leaveAppVars } = useMutation({
    mutationFn: (variables) => gqlClient.request(APPROVE_LEAVE, variables),
    onSuccess: () => {
      toast.success("Leave approved!");
      invalidate();
    },
    onError: handleError
  });
  
  const { mutate: rejectLeave, isPending: isRejectingLeave, variables: leaveRejVars } = useMutation({
    mutationFn: (variables) => gqlClient.request(REJECT_LEAVE, variables),
    onSuccess: () => {
      toast.success("Leave rejected!");
      invalidate();
    },
    onError: handleError
  });
  
  const { mutate: approveProfile, isPending: isApprovingProfile, variables: profAppVars } = useMutation({
    mutationFn: (variables) => gqlClient.request(APPROVE_PROFILE, variables),
    onSuccess: () => {
      toast.success("Profile update approved!");
      invalidate();
    },
    onError: handleError
  });
  
  const { mutate: rejectProfile, isPending: isRejectingProfile, variables: profRejVars } = useMutation({
    mutationFn: (variables) => gqlClient.request(REJECT_PROFILE, variables),
    onSuccess: () => {
      toast.success("Profile update rejected!");
      invalidate();
    },
    onError: handleError
  });

  const { mutate: approveOffboarding } = useMutation({
    mutationFn: (variables) => gqlClient.request(APPROVE_OFFBOARDING, variables),
    onSuccess: () => { toast.success("Offboarding approved!"); invalidate(); },
    onError: handleError
  });

  const { mutate: rejectOffboarding } = useMutation({
    mutationFn: (variables) => gqlClient.request(REJECT_OFFBOARDING, variables),
    onSuccess: () => { toast.success("Offboarding rejected!"); invalidate(); },
    onError: handleError
  });

  const { mutate: approveProbation } = useMutation({
    mutationFn: (variables) => gqlClient.request(APPROVE_PROBATION, variables),
    onSuccess: () => { toast.success("Probation request updated!"); invalidate(); },
    onError: handleError
  });

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

  const safeDate = (val) => {
    if (!val) return new Date();
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
    const num = Number(val);
    if (!isNaN(num)) return new Date(num);
    return new Date();
  };

  if (error) return (
    <div className="flex justify-center items-center h-64 text-red-500 bg-red-50 p-4 rounded-lg text-center max-w-lg mx-auto mt-10 shadow-sm border border-red-100">
      <AlertCircle className="w-6 h-6 mr-3 shrink-0" />
      <span>Error loading approvals: {extractErrorMessage(error)}</span>
    </div>
  );

  const pendingEmployees = data?.employees?.filter(e => e.employmentStatus === 'PENDING_APPROVAL') || [];
  
  const pendingDocuments = data?.documents?.filter(d => {
    if (d.status !== 'PENDING') return false;
    const emp = data?.employees?.find(e => e.id === d.employeeId);
    return emp?.employmentStatus !== 'DRAFT';
  }) || [];

  const isAdmin = ['HR_ADMIN', 'SUPER_ADMIN', 'admin'].includes(user?.role) || user?.is_organization_owner;
  const pendingLeaves = data?.leaveRequests?.filter(l => {
    // Exclude own requests
    if (l.employee?.email === user?.email || l.employeeId === user?.employeeId) return false;
    
    if (isAdmin) {
      return l.status === 'PENDING_HR' || l.status === 'PENDING_SUPER_ADMIN';
    }
    return l.status === 'PENDING';
  }) || [];
  
  const pendingProfiles = data?.profileUpdateRequests?.filter(p => {
    if (p.status !== 'PENDING') return false;
    const emp = data?.employees?.find(e => e.id === p.employeeId);
    return emp?.employmentStatus !== 'DRAFT';
  }) || [];

  const pendingOffboardings = data?.allOffboardings?.filter(o => o.status === 'PENDING') || [];
  const pendingProbations = data?.allProbationRequests?.filter(p => p.status === 'PENDING') || [];

  const standalonePendingDocuments = pendingDocuments.filter(d => !pendingEmployees.some(e => e.id === d.employeeId));

  // Group by Employee for Unified View
  const unifiedEmployeeIds = Array.from(new Set([
    ...pendingEmployees.map(e => e.id),
    ...pendingDocuments.map(d => d.employeeId),
    ...pendingProfiles.map(p => p.employeeId)
  ]));

  const getEmployeeName = (empId) => {
    const emp = data?.employees?.find(e => e.id === empId);
    return emp ? emp.fullName : 'Unknown Employee';
  };

  const getEmployeeDept = (empId) => {
    const emp = data?.employees?.find(e => e.id === empId);
    return emp?.department?.name || 'No Dept';
  };

  const getEmployeeJobTitle = (empId) => {
    const emp = data?.employees?.find(e => e.id === empId);
    return emp?.jobTitle || 'No Title';
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8 p-4 md:p-8 max-w-5xl mx-auto"
    >
      <Dialog open={!!selectedEmployeeId} onOpenChange={(open) => !open && setSelectedEmployeeId(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0 border-0 bg-transparent shadow-2xl">
          <DialogTitle className="sr-only">Employee Profile</DialogTitle>
          {selectedEmployeeId && (
            <EmployeeDetail 
              employeeIdProp={selectedEmployeeId} 
              onClose={() => setSelectedEmployeeId(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
      <UnifiedProfileReviewDialog 
        open={!!selectedUnifiedEmployeeId}
        onOpenChange={(open) => !open && setSelectedUnifiedEmployeeId(null)}
        employeeId={selectedUnifiedEmployeeId}
        employeeName={getEmployeeName(selectedUnifiedEmployeeId)}
        isPendingActivation={pendingEmployees.some(e => e.id === selectedUnifiedEmployeeId)}
        pendingDocs={pendingDocuments.filter(d => d.employeeId === selectedUnifiedEmployeeId)}
        pendingProfiles={pendingProfiles.filter(p => p.employeeId === selectedUnifiedEmployeeId)}
      />
      <motion.div variants={itemVariants}>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full mb-4">
          <Inbox className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Inbox</span>
        </div>
        
        <p className="text-slate-500 mt-1">Review and action pending requests across the organization.</p>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Tabs defaultValue="unified" className="space-y-6">
          <TabsList className="bg-slate-50/80 border border-slate-100 p-1.5 rounded-xl flex-wrap h-auto">
            <TabsTrigger value="unified" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex gap-2">
              <UserCircle className="w-4 h-4" />
              Profile Reviews
              {(unifiedEmployeeIds.length + pendingProfiles.length + pendingProbations.length + pendingOffboardings.length) > 0 && <Badge variant="secondary" className="ml-1 bg-indigo-100 text-indigo-700 px-1.5 py-0 min-w-[20px]">{unifiedEmployeeIds.length + pendingProfiles.length + pendingProbations.length + pendingOffboardings.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="leaves" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex gap-2">
              <CalendarRange className="w-4 h-4" />
              Leave Requests
              {pendingLeaves.length > 0 && <Badge variant="secondary" className="ml-1 bg-indigo-100 text-indigo-700 px-1.5 py-0 min-w-[20px]">{pendingLeaves.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <div className="pt-2">
            <TabsContent value="unified" className="m-0 focus-visible:outline-none">
              {loading ? (
                <ApprovalsSkeleton />
              ) : (unifiedEmployeeIds.length === 0 && pendingProfiles.length === 0 && pendingProbations.length === 0 && pendingOffboardings.length === 0) ? (
                <EmptyState message="No pending reviews across the organization." icon={UserCircle} />
              ) : (
                <div className="space-y-8">
                  {/* Profile Completions (Unified View) */}
                  {unifiedEmployeeIds.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Profile Completions</h3>
                      {unifiedEmployeeIds.map(empId => {
                        const eDocs = pendingDocuments.filter(d => d.employeeId === empId).length;
                        const eProfs = pendingProfiles.filter(p => p.employeeId === empId).length;
                        const ePendingOnboarding = pendingEmployees.some(e => e.id === empId);

                        return (
                          <motion.div 
                            key={empId} 
                            whileHover={{ y: -2 }}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-slate-200/60 rounded-xl bg-white shadow-sm hover:shadow-md transition-all gap-4 group"
                          >
                            <div>
                              <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{getEmployeeName(empId)}</h4>
                              <p className="text-sm text-slate-500 mt-1">{getEmployeeJobTitle(empId)} • <span className="font-medium text-slate-600">{getEmployeeDept(empId)}</span></p>
                              <div className="flex gap-2 mt-2">
                                {ePendingOnboarding && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Pending Activation</Badge>}
                                {eProfs > 0 && <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50">{eProfs} Profile Changes</Badge>}
                                {eDocs > 0 && <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">{eDocs} Documents</Badge>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button 
                                className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 rounded-lg shadow-sm"
                                onClick={() => setSelectedUnifiedEmployeeId(empId)}
                              >
                                Review & Action
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Profile Updates */}
                  {pendingProfiles.length > 0 && (
                    <div className="space-y-3 mt-8">
                      <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Profile Updates</h3>
                      {pendingProfiles.map(update => (
                        <motion.div 
                          key={update.id} 
                          whileHover={{ y: -2 }}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-slate-200/60 rounded-xl bg-white shadow-sm hover:shadow-md transition-all gap-4 group"
                        >
                          <div>
                            <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{getEmployeeName(update.employeeId)}</h4>
                            <p className="text-sm text-slate-500 mt-1">
                              Requested change to <span className="font-semibold text-slate-700">{update.fieldName}</span>
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-sm border border-slate-100 bg-slate-50 p-2 rounded-lg inline-flex">
                              <span className="text-slate-400 line-through font-medium">{update.currentValue || '(empty)'}</span>
                              <span className="text-slate-300">→</span>
                              <span className="text-indigo-600 font-semibold">{update.requestedValue}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <RejectDialog onReject={(reason) => rejectProfile({ id: update.id, reason, attachmentUrl: "" })} title="Reject Profile Update" />
                            <Button 
                              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 rounded-lg shadow-sm"
                              onClick={() => approveProfile({ id: update.id })}
                              disabled={isApprovingProfile && profAppVars?.id === update.id}
                            >
                              {isApprovingProfile && profAppVars?.id === update.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              Approve
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Probation Requests */}
                  {pendingProbations.length > 0 && (
                    <div className="space-y-3 mt-8">
                      <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Probation Requests</h3>
                      {pendingProbations.map(prob => (
                        <motion.div 
                          key={prob.id} 
                          whileHover={{ y: -2 }}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-slate-200/60 rounded-xl bg-white shadow-sm hover:shadow-md transition-all gap-4 group"
                        >
                          <div>
                            <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{prob.employee?.fullName || 'Unknown'}</h4>
                            <p className="text-sm text-slate-500 mt-1">
                              Requested Probation Period: <span className="font-medium text-slate-700">{new Date(safeDate(prob.startDate)).toLocaleDateString()}</span> to <span className="font-medium text-slate-700">{new Date(safeDate(prob.endDate)).toLocaleDateString()}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <RejectDialog onReject={(reason) => approveProbation({ id: prob.id, status: 'REJECTED', comments: reason })} title="Reject Probation Request" />
                            <Button 
                              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 rounded-lg shadow-sm"
                              onClick={() => approveProbation({ id: prob.id, status: 'APPROVED' })}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Approve
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Offboarding Requests */}
                  {pendingOffboardings.length > 0 && (
                    <div className="space-y-3 mt-8">
                      <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Offboarding Requests</h3>
                      {pendingOffboardings.map(off => (
                        <motion.div 
                          key={off.id} 
                          whileHover={{ y: -2 }}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-slate-200/60 rounded-xl bg-white shadow-sm hover:shadow-md transition-all gap-4 group"
                        >
                          <div>
                            <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{off.employee?.fullName || 'Unknown'}</h4>
                            <p className="text-sm text-slate-500 mt-1">
                              Offboarding Type: <span className="font-semibold text-slate-700">{off.exitType}</span> • Exit Date: <span className="font-medium text-slate-700">{new Date(safeDate(off.exitDate)).toLocaleDateString()}</span>
                            </p>
                            {off.reason && <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">"{off.reason}"</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <RejectDialog onReject={(reason) => rejectOffboarding({ id: off.id, comments: reason })} title="Reject Offboarding" />
                            <Button 
                              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 rounded-lg shadow-sm"
                              onClick={() => approveOffboarding({ id: off.id })}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Approve
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="leaves" className="m-0 focus-visible:outline-none">
              {loading ? (
                <ApprovalsSkeleton />
              ) : pendingLeaves.length === 0 ? (
                <EmptyState message="No pending leave requests." icon={CalendarRange} />
              ) : (
                <div className="space-y-3">
                  {pendingLeaves.map(leave => (
                    <motion.div 
                      key={leave.id} 
                      whileHover={{ y: -2 }}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-slate-200/60 rounded-xl bg-white shadow-sm hover:shadow-md transition-all gap-4 group"
                    >
                      <div>
                        <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{getEmployeeName(leave.employeeId)}</h4>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600 font-medium py-0 h-5 text-[10px]">
                            {leave.totalDays} Days
                          </Badge>
                          <span className="text-sm text-slate-500">
                            {safeDate(leave.startDate).toLocaleDateString()} <span className="text-slate-300 mx-1">→</span> {safeDate(leave.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        {leave.reason && <p className="text-sm text-slate-500 italic mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">"{leave.reason}"</p>}
                        {leave.attachmentUrl && (
                           <div className="mt-2">
                             <a 
                               href={leave.attachmentUrl} 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                             >
                               <FileText className="w-3 h-3" /> View Attachment
                             </a>
                           </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <RejectDialog onReject={(reason) => rejectLeave({ id: leave.id, reason, attachmentUrl: "" })} title="Reject Leave Request" />
                        <Button 
                          className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 rounded-lg shadow-sm"
                          onClick={() => approveLeave({ id: leave.id })}
                          disabled={isApprovingLeave && leaveAppVars?.id === leave.id}
                        >
                          {isApprovingLeave && leaveAppVars?.id === leave.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          Approve
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

          </div>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
