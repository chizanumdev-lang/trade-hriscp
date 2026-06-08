import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gql } from 'graphql-request';
import { gqlClient } from '@/api/graphqlClient';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { CheckCircle2, XCircle, FileText, UserCircle, CalendarRange, Eye } from 'lucide-react';

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
      createdAt
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
  mutation RejectDocument($id: ID!, $reason: String) {
    rejectDocument(id: $id, reason: $reason) {
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
  mutation RejectLeave($id: ID!) {
    rejectLeaveRequest(id: $id) {
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
  mutation RejectProfile($id: ID!) {
    rejectProfileUpdateRequest(id: $id) {
      id
      status
    }
  }
`;

export default function PendingApprovals() {
  const queryClient = useQueryClient();
  const { data, isLoading: loading, error } = useQuery({
    queryKey: ['pendingApprovals'],
    queryFn: () => gqlClient.request(GET_PENDING_APPROVALS)
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });

  const { mutate: approveEmployee } = useMutation({
    mutationFn: (variables) => gqlClient.request(APPROVE_EMPLOYEE, variables),
    onSuccess: invalidate
  });
  
  const { mutate: approveDocument } = useMutation({
    mutationFn: (variables) => gqlClient.request(APPROVE_DOCUMENT, variables),
    onSuccess: invalidate
  });
  
  const { mutate: rejectDocument } = useMutation({
    mutationFn: (variables) => gqlClient.request(REJECT_DOCUMENT, variables),
    onSuccess: invalidate
  });
  
  const { mutate: approveLeave } = useMutation({
    mutationFn: (variables) => gqlClient.request(APPROVE_LEAVE, variables),
    onSuccess: invalidate
  });
  
  const { mutate: rejectLeave } = useMutation({
    mutationFn: (variables) => gqlClient.request(REJECT_LEAVE, variables),
    onSuccess: invalidate
  });
  
  const { mutate: approveProfile } = useMutation({
    mutationFn: (variables) => gqlClient.request(APPROVE_PROFILE, variables),
    onSuccess: invalidate
  });
  
  const { mutate: rejectProfile } = useMutation({
    mutationFn: (variables) => gqlClient.request(REJECT_PROFILE, variables),
    onSuccess: invalidate
  });

  if (loading) return <div className="p-8 text-slate-500">Loading approvals...</div>;
  if (error) return <div className="p-8 text-red-500">Error loading approvals: {error.message}</div>;

  const pendingEmployees = data?.employees?.filter(e => e.employmentStatus === 'PENDING_APPROVAL') || [];
  const pendingDocuments = data?.documents?.filter(d => d.status === 'PENDING') || [];
  const pendingLeaves = data?.leaveRequests?.filter(l => l.status === 'PENDING') || [];
  const pendingProfiles = data?.profileUpdateRequests?.filter(p => p.status === 'PENDING') || [];

  const getEmployeeName = (empId) => {
    const emp = data?.employees?.find(e => e.id === empId);
    return emp ? emp.fullName : 'Unknown Employee';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Approvals Inbox</h1>
        <p className="text-slate-500">Review and action pending requests across the organization.</p>
      </div>

      <Tabs defaultValue="onboarding" className="space-y-6">
        <TabsList className="bg-white border p-1 rounded-lg">
          <TabsTrigger value="onboarding" className="data-[state=active]:bg-slate-100 flex gap-2">
            <UserCircle className="w-4 h-4" />
            Onboarding 
            {pendingEmployees.length > 0 && <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700">{pendingEmployees.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-slate-100 flex gap-2">
            <FileText className="w-4 h-4" />
            Documents
            {pendingDocuments.length > 0 && <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700">{pendingDocuments.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="leaves" className="data-[state=active]:bg-slate-100 flex gap-2">
            <CalendarRange className="w-4 h-4" />
            Leave Requests
            {pendingLeaves.length > 0 && <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700">{pendingLeaves.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="profiles" className="data-[state=active]:bg-slate-100 flex gap-2">
            <UserCircle className="w-4 h-4" />
            Profile Updates
            {pendingProfiles.length > 0 && <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700">{pendingProfiles.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="onboarding">
          <Card>
            <CardHeader>
              <CardTitle>Employees Pending Onboarding Approval</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingEmployees.length === 0 ? (
                <div className="text-center p-8 text-slate-500">No pending employee onboardings.</div>
              ) : (
                <div className="space-y-4">
                  {pendingEmployees.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                      <div>
                        <h4 className="font-medium text-slate-900">{emp.fullName}</h4>
                        <p className="text-sm text-slate-500">{emp.jobTitle} • {emp.department?.name || 'No Dept'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => window.open(`/employee/${emp.id}`, '_blank')}>
                          View Profile
                        </Button>
                        <Button 
                          className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                          onClick={() => approveEmployee({ variables: { employeeId: emp.id } })}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Pending Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingDocuments.length === 0 ? (
                <div className="text-center p-8 text-slate-500">No pending documents.</div>
              ) : (
                <div className="space-y-4">
                  {pendingDocuments.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                      <div>
                        <h4 className="font-medium text-slate-900">{doc.name}</h4>
                        <p className="text-sm text-slate-500">Category: {doc.category} • Uploaded by: {getEmployeeName(doc.employeeId)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="text-blue-600 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                            <DialogHeader>
                              <DialogTitle>{doc.name}</DialogTitle>
                            </DialogHeader>
                            <div className="w-full flex-1 flex items-center justify-center bg-slate-100 rounded-lg overflow-hidden relative min-h-[60vh]">
                              {!doc.fileUrl ? (
                                <p className="text-slate-500">Document URL not available</p>
                              ) : ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(doc.fileType?.toLowerCase()) || doc.fileType?.startsWith('image/') ? (
                                <img src={doc.fileUrl} alt={doc.name} className="max-w-full max-h-full object-contain" />
                              ) : (
                                <iframe src={doc.fileUrl} className="w-full h-full border-0" title={doc.name} />
                              )}
                              {doc.fileUrl && (
                                <a 
                                  href={doc.fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="absolute top-4 right-4 bg-white/90 text-blue-600 text-sm px-3 py-1.5 rounded-md shadow border border-slate-200 hover:bg-white hover:text-blue-700 z-10 font-medium flex items-center gap-2"
                                >
                                  <Eye className="w-4 h-4" /> Open in New Tab
                                </a>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button 
                          variant="outline" 
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2"
                          onClick={() => rejectDocument({ variables: { id: doc.id } })}
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>
                        <Button 
                          className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                          onClick={() => approveDocument({ variables: { id: doc.id } })}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves">
          <Card>
            <CardHeader>
              <CardTitle>Pending Leave Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingLeaves.length === 0 ? (
                <div className="text-center p-8 text-slate-500">No pending leave requests.</div>
              ) : (
                <div className="space-y-4">
                  {pendingLeaves.map(leave => (
                    <div key={leave.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                      <div>
                        <h4 className="font-medium text-slate-900">{getEmployeeName(leave.employeeId)}</h4>
                        <p className="text-sm text-slate-500">
                          {new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()} ({leave.totalDays} days)
                        </p>
                        {leave.reason && <p className="text-sm text-slate-500 italic mt-1">"{leave.reason}"</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2"
                          onClick={() => rejectLeave({ variables: { id: leave.id } })}
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>
                        <Button 
                          className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                          onClick={() => approveLeave({ variables: { id: leave.id } })}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles">
          <Card>
            <CardHeader>
              <CardTitle>Pending Profile Updates</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingProfiles.length === 0 ? (
                <div className="text-center p-8 text-slate-500">No pending profile updates.</div>
              ) : (
                <div className="space-y-4">
                  {pendingProfiles.map(update => (
                    <div key={update.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                      <div>
                        <h4 className="font-medium text-slate-900">{getEmployeeName(update.employeeId)}</h4>
                        <p className="text-sm text-slate-500 mt-1">
                          Requested change to <span className="font-semibold text-slate-700">{update.fieldName}</span>:
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <span className="text-red-500 line-through bg-red-50 px-2 py-0.5 rounded">{update.currentValue || '(empty)'}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded">{update.requestedValue}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2"
                          onClick={() => rejectProfile({ variables: { id: update.id } })}
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>
                        <Button 
                          className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                          onClick={() => approveProfile({ variables: { id: update.id } })}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
