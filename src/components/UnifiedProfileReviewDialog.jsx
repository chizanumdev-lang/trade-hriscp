import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { gql } from 'graphql-request';
import { gqlClient } from '@/api/graphqlClient';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { CheckCircle2, XCircle, FileText, UserCircle, Loader2, AlertCircle, Eye } from 'lucide-react';
import { motion } from 'framer-motion';

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

const RejectInline = ({ onReject }) => {
  const [reason, setReason] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" className="text-slate-600 hover:text-red-600 hover:bg-red-50" onClick={() => setIsOpen(true)}>
        <XCircle className="w-4 h-4 mr-1" /> Reject
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 w-full sm:w-auto mt-2 sm:mt-0">
      <input 
        type="text" 
        className="text-sm px-3 py-1.5 rounded-md border border-slate-300 w-full" 
        placeholder="Reason for rejection..." 
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>Cancel</Button>
        <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" disabled={!reason.trim()} onClick={() => {
          onReject(reason);
          setIsOpen(false);
          setReason("");
        }}>
          Confirm
        </Button>
      </div>
    </div>
  );
};

export default function UnifiedProfileReviewDialog({ 
  open, 
  onOpenChange, 
  employeeName, 
  employeeId,
  isPendingActivation,
  pendingDocs = [],
  pendingProfiles = []
}) {
  const queryClient = useQueryClient();
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleError = (err) => {
    const errMsg = err.response?.errors?.[0]?.message || err.message || "Operation failed.";
    toast.error(errMsg);
  };

  const { mutateAsync: approveEmployee } = useMutation({
    mutationFn: (variables) => gqlClient.request(APPROVE_EMPLOYEE, variables),
    onSuccess: () => { toast.success("Activation approved!"); invalidate(); },
    onError: handleError
  });

  const { mutateAsync: approveDocument } = useMutation({
    mutationFn: (variables) => gqlClient.request(APPROVE_DOCUMENT, variables),
    onSuccess: () => { toast.success("Document approved!"); invalidate(); },
    onError: handleError
  });

  const { mutateAsync: rejectDocument } = useMutation({
    mutationFn: (variables) => gqlClient.request(REJECT_DOCUMENT, variables),
    onSuccess: () => { toast.success("Document rejected!"); invalidate(); },
    onError: handleError
  });

  const { mutateAsync: approveProfile } = useMutation({
    mutationFn: (variables) => gqlClient.request(APPROVE_PROFILE, variables),
    onSuccess: () => { toast.success("Profile update approved!"); invalidate(); },
    onError: handleError
  });

  const { mutateAsync: rejectProfile } = useMutation({
    mutationFn: (variables) => gqlClient.request(REJECT_PROFILE, variables),
    onSuccess: () => { toast.success("Profile update rejected!"); invalidate(); },
    onError: handleError
  });

  const handleApproveAll = async () => {
    setIsApprovingAll(true);
    try {
      const promises = [];
      if (isPendingActivation) {
        promises.push(approveEmployee({ employeeId }));
      }
      for (const doc of pendingDocs) {
        promises.push(approveDocument({ id: doc.id }));
      }
      for (const prof of pendingProfiles) {
        promises.push(approveProfile({ id: prof.id }));
      }
      await Promise.allSettled(promises);
      toast.success("All pending actions processed.");
      invalidate();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Some approvals failed.");
    } finally {
      setIsApprovingAll(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-0 border-slate-100 shadow-2xl">
        <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl text-slate-900 tracking-tight flex items-center gap-2">
                <UserCircle className="w-5 h-5 text-indigo-600" />
                Reviewing: {employeeName}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Unified review for profile activation, data updates, and documents.
              </DialogDescription>
            </div>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              onClick={handleApproveAll}
              disabled={isApprovingAll || (!isPendingActivation && pendingDocs.length === 0 && pendingProfiles.length === 0)}
            >
              {isApprovingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Approve All Unactioned
            </Button>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-8 bg-slate-50/50">
          {/* Activation Step */}
          {isPendingActivation && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-900">Pending Activation / Probation</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    This employee's profile is currently pending approval. Activating their account will grant them full access.
                  </p>
                </div>
                <Button 
                  size="sm" 
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => approveEmployee({ employeeId })}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Activate Now
                </Button>
              </div>
            </div>
          )}

          {/* Profile Updates */}
          {pendingProfiles.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-lg">
                <UserCircle className="w-5 h-5 text-slate-500" /> 
                Data Changes ({pendingProfiles.length})
              </h3>
              <div className="grid gap-3">
                {pendingProfiles.map(update => (
                  <div key={update.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div>
                      <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">{update.fieldName}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm bg-slate-50 p-2 rounded-lg inline-flex">
                        <span className="text-slate-400 line-through">{update.currentValue || '(empty)'}</span>
                        <span className="text-slate-300">→</span>
                        <span className="text-indigo-600 font-semibold">{update.requestedValue}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 sm:mt-0">
                      <RejectInline onReject={(reason) => rejectProfile({ id: update.id, reason, attachmentUrl: "" })} />
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => approveProfile({ id: update.id })}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {pendingDocs.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-slate-500" /> 
                Documents ({pendingDocs.length})
              </h3>
              <div className="grid gap-3">
                {pendingDocs.map(doc => (
                  <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div>
                      <h4 className="font-semibold text-slate-900">{doc.name}</h4>
                      <Badge variant="secondary" className="mt-1 bg-slate-100 text-slate-600">{doc.category}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0">
                      {doc.fileUrl && (
                        <Button variant="outline" size="sm" className="text-slate-600" onClick={() => window.open(doc.fileUrl, '_blank')}>
                          <Eye className="w-4 h-4 mr-1" /> View
                        </Button>
                      )}
                      <RejectInline onReject={(reason) => rejectDocument({ id: doc.id, reason, attachmentUrl: "" })} />
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => approveDocument({ id: doc.id })}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isPendingActivation && pendingProfiles.length === 0 && pendingDocs.length === 0 && (
            <div className="text-center p-8 bg-white rounded-xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900">All caught up</h3>
              <p className="text-slate-500 text-sm mt-1">There are no more pending actions for this employee.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
