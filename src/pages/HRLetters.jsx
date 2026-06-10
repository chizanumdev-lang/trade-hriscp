import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, Send, CheckCircle, Clock, XCircle, Edit } from "lucide-react";
import { format } from "date-fns";

export default function HRLetters() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Mock user
        const currentUser = {
          email: "mock_user@example.com",
          role: "admin",
          organization_id: "org_1",
          full_name: "Mock User"
        };
        setUser(currentUser);
        
        // Mock employee
        setEmployee({
          id: 'emp_1',
          email: currentUser.email,
          full_name: currentUser.full_name
        });
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: requests = [] } = useQuery({
    queryKey: ['hr-letter-requests'],
    queryFn: async () => {
      return [];
    },
    initialData: [],
  });

  const isAdmin = user?.role === 'admin';
  const myRequests = requests.filter(r => r.employee_id === employee?.id);
  const displayRequests = isAdmin ? requests : myRequests;

  const [formData, setFormData] = useState({
    letter_type: 'employment',
    purpose: '',
  });

  const createAuditLog = async (action, entityId, entityName) => {
    try {
      console.log("Mock create audit log", action, entityId, entityName);
    } catch (error) {
      console.error("Error creating audit log:", error);
    }
  };

  const createRequestMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock create request", data);
      const request = {
        ...data,
        id: `req_${Date.now()}`,
        employee_id: employee.id,
        employee_name: employee.full_name,
        request_date: new Date().toISOString().split('T')[0],
        status: 'pending',
      };
      await createAuditLog('create', request.id, `${data.letter_type} letter`);
      return request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-letter-requests'] });
      setShowRequestForm(false);
      setEditingRequest(null);
      setFormData({ letter_type: 'employment', purpose: '' });
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      console.log("Mock update request", id, data);
      const updated = { id, ...data };
      await createAuditLog('update', id, `${data.letter_type || 'letter'}`);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-letter-requests'] });
      setShowRequestForm(false);
      setEditingRequest(null);
    },
  });

  const generateLetterMutation = useMutation({
    mutationFn: async ({ requestId, employeeData }) => {
      console.log("Mock generate letter", requestId, employeeData);
      
      const result = "This is a mock AI generated letter content.";
      
      const updated = {
        id: requestId,
        letter_content: result,
        status: 'completed',
        approved_date: new Date().toISOString().split('T')[0],
      };

      await createAuditLog('approve', requestId, `${employeeData.letter_type} letter`);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-letter-requests'] });
    },
  });

  const handleEdit = (request) => {
    setEditingRequest(request);
    setFormData({
      letter_type: request.letter_type,
      purpose: request.purpose,
    });
    setShowRequestForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingRequest) {
      updateRequestMutation.mutate({ id: editingRequest.id, data: formData });
    } else {
      createRequestMutation.mutate(formData);
    }
  };

  const statusConfig = {
    pending: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
    approved: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle },
    completed: { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
    rejected: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-medium text-slate-700">HR Letters & Documents</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">
              HR Letters
            </h1>
            <p className="text-lg text-slate-600">
              Request and manage official HR documents
            </p>
          </div>
          {employee && (
            <Dialog open={showRequestForm} onOpenChange={(open) => {
              setShowRequestForm(open);
              if (!open) {
                setEditingRequest(null);
                setFormData({ letter_type: 'employment', purpose: '' });
              }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-indigo-600 to-purple-600">
                  <Plus className="w-4 h-4 mr-2" />
                  {editingRequest ? 'Edit Request' : 'Request Letter'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingRequest ? 'Edit' : 'Request'} HR Letter</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="letter_type">Letter Type *</Label>
                    <Select value={formData.letter_type} onValueChange={(value) => setFormData(prev => ({ ...prev, letter_type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employment">Employment Letter</SelectItem>
                        <SelectItem value="salary_certificate">Salary Certificate</SelectItem>
                        <SelectItem value="recommendation">Recommendation Letter</SelectItem>
                        <SelectItem value="experience">Experience Certificate</SelectItem>
                        <SelectItem value="resignation_acceptance">Resignation Acceptance</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="purpose">Purpose *</Label>
                    <Textarea
                      id="purpose"
                      value={formData.purpose}
                      onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                      placeholder="Why do you need this letter? (e.g., visa application, bank loan, etc.)"
                      rows={3}
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowRequestForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" isLoading={createRequestMutation.isPending || updateRequestMutation.isPending}>
                      {(createRequestMutation.isPending || updateRequestMutation.isPending) ? "Saving..." : editingRequest ? "Update" : "Submit Request"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle>Letter Requests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {displayRequests.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No letter requests yet</h3>
                <p className="text-slate-500">Request your first HR letter to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {displayRequests.map((request) => {
                  const config = statusConfig[request.status];
                  const StatusIcon = config.icon;

                  return (
                    <div key={request.id} className="p-6 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-slate-900 capitalize">
                              {request.letter_type.replace(/_/g, ' ')}
                            </h3>
                            <Badge variant="outline" className={`${config.color} border flex items-center gap-1`}>
                              <StatusIcon className="w-3 h-3" />
                              {request.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">{request.employee_name}</p>
                          <p className="text-sm text-slate-500">Purpose: {request.purpose}</p>
                          <p className="text-xs text-slate-400 mt-2">
                            Requested: {format(new Date(request.request_date || Date.now()), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {request.status === 'pending' && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(request)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  size="sm"
                                  onClick={() => generateLetterMutation.mutate({
                                    requestId: request.id,
                                    employeeData: { ...request, job_title: 'Employee' }
                                  })}
                                  disabled={generateLetterMutation.isPending}
                                >
                                  Generate with AI
                                </Button>
                              )}
                            </>
                          )}
                          {request.status === 'completed' && request.letter_content && (
                            <Button size="sm" variant="outline">
                              <Send className="w-4 h-4 mr-2" />
                              Send
                            </Button>
                          )}
                        </div>
                      </div>
                      {request.letter_content && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                          <p className="text-xs font-medium text-slate-700 mb-2">Generated Letter:</p>
                          <div className="text-sm text-slate-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {request.letter_content}
                          </div>
                        </div>
                      )}
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