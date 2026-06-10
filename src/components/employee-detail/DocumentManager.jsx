import React, { useState } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, File, CheckCircle, Clock, ExternalLink, Plus } from "lucide-react";
import UploadDocumentDialog from "./UploadDocumentDialog";
import { DocumentViewerModal } from "@/components/ui/DocumentViewerModal";

const statusColors = {
  pending: "bg-orange-100 text-orange-800 border-orange-200",
  uploaded: "bg-blue-100 text-blue-800 border-blue-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

export default function DocumentManager({ documents, employeeId }) {
  const queryClient = useQueryClient();
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [viewerDoc, setViewerDoc] = useState(null);

  const updateDocumentMutation = useMutation({
    mutationFn: async ({ docId, data }) => {
      console.log("Mock update document", docId, data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', employeeId] });
    },
  });

  const createDocumentMutation = useMutation({
    mutationFn: async (docData) => {
      console.log("Mock create document", docData);
      return { ...docData, employee_id: employeeId, id: `doc_${Date.now()}` };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', employeeId] });
      setShowUploadDialog(false);
      setSelectedDocument(null);
    },
  });

  const approveDocument = (docId) => {
    updateDocumentMutation.mutate({ 
      docId, 
      data: { 
        status: 'approved',
        reviewed_date: new Date().toISOString().split('T')[0]
      } 
    });
  };

  const openUploadDialog = (doc = null) => {
    setSelectedDocument(doc);
    setShowUploadDialog(true);
  };

  const pendingDocs = documents.filter(d => d.status === 'pending');
  const uploadedDocs = documents.filter(d => ['uploaded', 'approved', 'rejected'].includes(d.status));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Documents</h2>
        <Button onClick={() => openUploadDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Document Request
        </Button>
      </div>

      {/* Pending Documents */}
      {pendingDocs.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Pending Upload ({pendingDocs.length})
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {pendingDocs.map(doc => (
              <Card key={doc.id} className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <File className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">{doc.document_name}</h4>
                        <Badge variant="outline" className={`${statusColors[doc.status]} border mt-2`}>
                          Awaiting Upload
                        </Badge>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => openUploadDialog(doc)}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Documents */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          Uploaded Documents ({uploadedDocs.length})
        </h3>
        {uploadedDocs.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="p-8 text-center text-slate-500">
              <File className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No documents uploaded yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {uploadedDocs.map(doc => (
              <Card key={doc.id} className="border-slate-200 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <File className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-900">{doc.document_name}</h4>
                        {doc.file_name && (
                          <p className="text-sm text-slate-600 truncate">{doc.file_name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={`${statusColors[doc.status]} border`}>
                            {doc.status}
                          </Badge>
                          {doc.file_url && (
                            <button
                              onClick={() => setViewerDoc(doc)}
                              className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </button>
                          )}
                        </div>
                        {doc.status === 'uploaded' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3"
                            onClick={() => approveDocument(doc.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <UploadDocumentDialog
        open={showUploadDialog}
        onClose={() => {
          setShowUploadDialog(false);
          setSelectedDocument(null);
        }}
        onSubmit={(data) => {
          if (selectedDocument?.id) {
            updateDocumentMutation.mutate({ docId: selectedDocument.id, data });
          } else {
            createDocumentMutation.mutate(data);
          }
        }}
        document={selectedDocument}
        isSubmitting={updateDocumentMutation.isPending || createDocumentMutation.isPending}
      />

      <DocumentViewerModal
        isOpen={!!viewerDoc}
        onClose={() => setViewerDoc(null)}
        fileUrl={viewerDoc?.file_url}
        title={viewerDoc?.document_name || "Document Viewer"}
      />
    </div>
  );
}