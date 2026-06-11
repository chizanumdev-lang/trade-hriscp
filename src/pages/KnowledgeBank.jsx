import React, { useState } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search, Plus, CheckCircle, BookOpen, Clock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const POLICIES_QUERY = gql`
  query GetPolicies {
    policies {
      id
      title
      category
      content
      status
      requiresAck
      createdAt
    }
  }
`;

const CREATE_POLICY_MUTATION = gql`
  mutation CreatePolicy($title: String!, $category: String!, $content: String, $requiresAck: Boolean) {
    createPolicy(title: $title, category: $category, content: $content, requiresAck: $requiresAck) {
      id
      title
    }
  }
`;

const SUBMIT_POLICY_MUTATION = gql`
  mutation SubmitPolicy($id: ID!) {
    submitPolicy(id: $id) {
      id
      status
    }
  }
`;

const ACKNOWLEDGE_POLICY_MUTATION = gql`
  mutation AcknowledgePolicy($policyId: ID!) {
    acknowledgePolicy(policyId: $policyId)
  }
`;

export default function KnowledgeBank() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    title: "",
    category: "hr_policy",
    content: "",
    requiresAck: true
  });

  const { data: policiesData, isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: async () => await gqlClient.request(POLICIES_QUERY),
  });

  const policies = policiesData?.policies || [];

  const createPolicyMutation = useMutation({
    mutationFn: async (data) => await gqlClient.request(CREATE_POLICY_MUTATION, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      setShowAddDialog(false);
      setNewPolicy({ title: "", category: "hr_policy", content: "", requiresAck: true });
    }
  });

  const submitPolicyMutation = useMutation({
    mutationFn: async (id) => await gqlClient.request(SUBMIT_POLICY_MUTATION, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    }
  });

  const acknowledgePolicyMutation = useMutation({
    mutationFn: async (policyId) => await gqlClient.request(ACKNOWLEDGE_POLICY_MUTATION, { policyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      // A full implementation would track which policies the specific user has acknowledged
    }
  });

  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = policy.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || policy.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryLabel = (cat) => {
    switch (cat) {
      case "hr_policy": return "HR Policy";
      case "compliance": return "Compliance";
      case "sop": return "Standard Operating Procedure";
      case "handbook": return "Handbook";
      default: return cat;
    }
  };

  const getCategoryColor = (cat) => {
    switch (cat) {
      case "hr_policy": return "bg-blue-100 text-blue-700";
      case "compliance": return "bg-red-100 text-red-700";
      case "sop": return "bg-purple-100 text-purple-700";
      case "handbook": return "bg-green-100 text-green-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const isHRAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'HR_ADMIN';

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-slate-700">Knowledge & Policies</span>
            </div>
            
            <p className="text-slate-600 mt-2">Central repository for company policies, handbooks, and SOPs.</p>
          </div>
          
          {isHRAdmin && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Create Document
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Document</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Document Title</Label>
                    <Input 
                      value={newPolicy.title} 
                      onChange={(e) => setNewPolicy(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., Code of Conduct 2026"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select 
                        value={newPolicy.category} 
                        onValueChange={(val) => setNewPolicy(prev => ({ ...prev, category: val }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hr_policy">HR Policy</SelectItem>
                          <SelectItem value="compliance">Compliance</SelectItem>
                          <SelectItem value="sop">SOP</SelectItem>
                          <SelectItem value="handbook">Handbook</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Requires Acknowledgment?</Label>
                      <Select 
                        value={newPolicy.requiresAck ? "yes" : "no"} 
                        onValueChange={(val) => setNewPolicy(prev => ({ ...prev, requiresAck: val === "yes" }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes (Mandatory)</SelectItem>
                          <SelectItem value="no">No (Informational)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Document Content</Label>
                    <Textarea 
                      rows={8}
                      value={newPolicy.content}
                      onChange={(e) => setNewPolicy(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Paste document text or markdown here..."
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                    <Button 
                      onClick={() => createPolicyMutation.mutate(newPolicy)}
                      disabled={!newPolicy.title || createPolicyMutation.isPending}
                    >
                      {createPolicyMutation.isPending ? "Saving..." : "Save Draft"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search documents..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-64">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="hr_policy">HR Policies</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
                <SelectItem value="sop">SOPs</SelectItem>
                <SelectItem value="handbook">Handbooks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Document Grid */}
        {isLoading ? (
          <div className="text-center py-12">Loading knowledge bank...</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPolicies.length > 0 ? filteredPolicies.map(policy => (
              <Card key={policy.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <Badge className={getCategoryColor(policy.category)} variant="secondary">
                      {getCategoryLabel(policy.category)}
                    </Badge>
                    {policy.requiresAck && (
                      <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50">
                        Action Required
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg line-clamp-2">{policy.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <Clock className="w-3 h-3" />
                    Published on {new Date(Number(policy.createdAt)).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 text-sm line-clamp-3 mb-6">
                    {policy.content || "No preview available. Click to view full document."}
                  </p>
                  {policy.status === 'DRAFT' && isHRAdmin && (
                    <Button 
                      variant="outline" 
                      className="w-full mb-4 text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => submitPolicyMutation.mutate(policy.id)}
                      disabled={submitPolicyMutation.isPending}
                    >
                      {submitPolicyMutation.isPending ? "Submitting..." : "Submit for Approval"}
                    </Button>
                  )}
                  
                  <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3">
                          <FileText className="w-4 h-4 mr-2" /> Read
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getCategoryColor(policy.category)} variant="secondary">
                              {getCategoryLabel(policy.category)}
                            </Badge>
                          </div>
                          <DialogTitle className="text-2xl">{policy.title}</DialogTitle>
                          <CardDescription>
                            Published on {new Date(Number(policy.createdAt)).toLocaleDateString()}
                          </CardDescription>
                        </DialogHeader>
                        <div className="prose prose-slate max-w-none mt-6 whitespace-pre-wrap">
                          {policy.content}
                        </div>
                        {policy.requiresAck && (
                          <div className="mt-8 p-4 bg-slate-50 border rounded-lg flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-slate-900">Acknowledgment Required</h4>
                              <p className="text-sm text-slate-500">I confirm that I have read and understood this document.</p>
                            </div>
                            <Button 
                              onClick={() => acknowledgePolicyMutation.mutate(policy.id)}
                              disabled={acknowledgePolicyMutation.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" /> Acknowledge
                            </Button>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="col-span-full text-center py-12 text-slate-500">
                <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                No documents found matching your criteria.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
