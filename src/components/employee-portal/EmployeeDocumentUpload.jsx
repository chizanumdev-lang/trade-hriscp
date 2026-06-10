import React, { useState } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Loader2, CheckCircle, ExternalLink } from "lucide-react";
import { gql } from "graphql-request";
import { uploadToCloudinary } from "@/utils/cloudinary";
import { DocumentViewerModal } from "@/components/ui/DocumentViewerModal";

export default function EmployeeDocumentUpload({ documents, employeeId }) {
  const queryClient = useQueryClient();
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [viewerDoc, setViewerDoc] = useState(null);

  const updateDocumentMutation = useMutation({
    mutationFn: async ({ docId, fileUrl, fileType, fileSize }) => {
      const REPLACE_DOC = gql`
        mutation ReplaceDoc($id: ID!, $url: String!, $type: String!, $size: Int) {
          replaceDocumentVersion(id: $id, fileUrl: $url, fileType: $type, fileSize: $size) { id currentVersion status }
        }
      `;
      return gqlClient.request(REPLACE_DOC, { id: docId, url: fileUrl, type: fileType, size: fileSize });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents', employeeId] });
      setUploadingDoc(null);
    },
  });

  const handleFileUpload = async (document, file) => {
    setUploadingDoc(document.id);
    
    try {
      const uploadResult = await uploadToCloudinary(file);
      
      await updateDocumentMutation.mutateAsync({
        docId: document.id,
        fileUrl: uploadResult.secure_url,
        fileType: uploadResult.format || 'PDF',
        fileSize: uploadResult.bytes || 0
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file");
      setUploadingDoc(null);
    }
  };

  const pendingDocs = documents.filter(d => d.status === 'PENDING');
  const uploadedDocs = documents.filter(d => d.status !== 'PENDING');

  const statusColors = {
    PENDING: "bg-orange-100 text-orange-700 border-orange-200",
    ACTIVE: "bg-green-100 text-green-700 border-green-200",
    ARCHIVED: "bg-slate-100 text-slate-700 border-slate-200",
    DELETED: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-slate-50">
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {/* Pending Documents */}
        {pendingDocs.length > 0 && (
          <div className="space-y-3 mb-6">
            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
              Required ({pendingDocs.length})
            </h3>
            {pendingDocs.map(doc => (
              <div key={doc.id} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900">{doc.document_name}</h4>
                      <Badge variant="outline" className={`${statusColors[doc.status]} border mt-1`}>
                        Upload Required
                      </Badge>
                    </div>
                  </div>
                </div>
                <input
                  type="file"
                  id={`file-${doc.id}`}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(doc, e.target.files[0]);
                    }
                  }}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                <Button
                  size="sm"
                  onClick={() => document.getElementById(`file-${doc.id}`).click()}
                  disabled={uploadingDoc === doc.id}
                  className="w-full"
                >
                  {uploadingDoc === doc.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload File
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Uploaded Documents */}
        {uploadedDocs.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Uploaded ({uploadedDocs.length})
            </h3>
            {uploadedDocs.map(doc => (
              <div key={doc.id} className="p-4 bg-white border border-slate-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
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
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {documents.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No documents required</p>
          </div>
        )}
      </CardContent>

      <DocumentViewerModal
        isOpen={!!viewerDoc}
        onClose={() => setViewerDoc(null)}
        fileUrl={viewerDoc?.file_url}
        title={viewerDoc?.document_name || "Document Viewer"}
      />
    </Card>
  );
}