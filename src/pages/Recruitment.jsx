import React, { useState } from "react";
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
import { UserPlus, Briefcase, Users, Upload, Eye, CheckCircle, XCircle, Clock, Star } from "lucide-react";
import { format } from "date-fns";

export default function Recruitment() {
  const queryClient = useQueryClient();
  const [showJobForm, setShowJobForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [uploadingCV, setUploadingCV] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ['job-postings'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: applicants = [] } = useQuery({
    queryKey: ['applicants'],
    queryFn: async () => [],
    initialData: [],
  });

  const [jobFormData, setJobFormData] = useState({
    job_title: '',
    department: '',
    location: '',
    employment_type: 'full_time',
    salary_range: '',
    description: '',
    requirements: '',
    responsibilities: '',
    status: 'draft',
    published_to: [],
  });

  const createJobMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock create job", data);
      return {
        ...data,
        id: `job_${Date.now()}`,
        posted_date: new Date().toISOString().split('T')[0],
        applicants_count: 0,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      setShowJobForm(false);
      setJobFormData({
        job_title: '',
        department: '',
        location: '',
        employment_type: 'full_time',
        salary_range: '',
        description: '',
        requirements: '',
        responsibilities: '',
        status: 'draft',
        published_to: [],
      });
    },
  });

  const handleCVUpload = async (jobId, file) => {
    setUploadingCV(true);
    try {
      const file_url = URL.createObjectURL(file);
      
      const cvData = {
        status: "success",
        output: {
          full_name: "Mock Applicant",
          email: "mock@example.com",
          phone: "1234567890",
          experience_years: 5,
          skills: ["React", "JavaScript"],
          education: "BSc Computer Science",
        }
      };

      if (cvData.status === "success") {
        const job = jobs.find(j => j.id === jobId) || { job_title: "Mock Job" };
        
        const aiAnalysis = {
          score: 85,
          summary: "Strong candidate with relevant experience."
        };

        // Mock create applicant
        console.log("Mock create applicant", {
          job_posting_id: jobId,
          full_name: cvData.output.full_name,
          email: cvData.output.email,
          phone: cvData.output.phone,
          cv_url: file_url,
          experience_years: cvData.output.experience_years,
          status: 'new',
          ai_score: aiAnalysis.score,
          ai_summary: aiAnalysis.summary,
          source: 'direct',
          application_date: new Date().toISOString().split('T')[0],
        });

        queryClient.invalidateQueries({ queryKey: ['applicants'] });
      }
    } catch (error) {
      console.error("Error processing CV:", error);
    }
    setUploadingCV(false);
  };

  const updateApplicantStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      console.log("Mock update applicant status", id, status);
      return { id, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
    },
  });

  const activeJobs = jobs.filter(j => j.status === 'active').length;
  const totalApplicants = applicants.length;
  const shortlisted = applicants.filter(a => a.status === 'shortlisted' || a.status === 'interview_scheduled').length;

  const statusConfig = {
    new: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
    reviewed: { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Eye },
    shortlisted: { color: 'bg-green-100 text-green-700 border-green-200', icon: Star },
    interview_scheduled: { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock },
    offered: { color: 'bg-teal-100 text-teal-700 border-teal-200', icon: CheckCircle },
    hired: { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
    rejected: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
              <UserPlus className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-medium text-slate-700">Recruitment Management</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">
              Recruitment
            </h1>
            <p className="text-lg text-slate-600">
              Manage job postings and track applicants
            </p>
          </div>
          <Button 
            onClick={() => setShowJobForm(!showJobForm)}
            className="bg-gradient-to-r from-indigo-600 to-blue-600"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Post New Job
          </Button>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-indigo-100 p-3 rounded-xl">
                  <Briefcase className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">{activeJobs}</div>
              <div className="text-sm text-slate-600">Active Jobs</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-blue-100 p-3 rounded-xl">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">{totalApplicants}</div>
              <div className="text-sm text-slate-600">Total Applicants</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-green-100 p-3 rounded-xl">
                  <Star className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">{shortlisted}</div>
              <div className="text-sm text-slate-600">Shortlisted</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-purple-100 p-3 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">
                {applicants.filter(a => a.status === 'hired').length}
              </div>
              <div className="text-sm text-slate-600">Hired</div>
            </CardContent>
          </Card>
        </div>

        {/* Job Form */}
        {showJobForm && (
          <Card className="border-slate-200 shadow-xl">
            <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-blue-50">
              <CardTitle>Post New Job</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={(e) => { e.preventDefault(); createJobMutation.mutate(jobFormData); }} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="job_title">Job Title *</Label>
                    <Input
                      id="job_title"
                      value={jobFormData.job_title}
                      onChange={(e) => setJobFormData(prev => ({ ...prev, job_title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department *</Label>
                    <Input
                      id="department"
                      value={jobFormData.department}
                      onChange={(e) => setJobFormData(prev => ({ ...prev, department: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={jobFormData.location}
                      onChange={(e) => setJobFormData(prev => ({ ...prev, location: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employment_type">Employment Type</Label>
                    <Select value={jobFormData.employment_type} onValueChange={(value) => setJobFormData(prev => ({ ...prev, employment_type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full Time</SelectItem>
                        <SelectItem value="part_time">Part Time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Job Description *</Label>
                  <Textarea
                    id="description"
                    value={jobFormData.description}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requirements">Requirements</Label>
                  <Textarea
                    id="requirements"
                    value={jobFormData.requirements}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, requirements: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowJobForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={createJobMutation.isPending}>
                    {createJobMutation.isPending ? "Creating..." : "Create Job"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="jobs">Job Postings</TabsTrigger>
            <TabsTrigger value="applicants">Applicants</TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            <div className="grid md:grid-cols-2 gap-6">
              {jobs.map(job => (
                <Card key={job.id} className="border-slate-200 hover:shadow-lg transition-shadow">
                  <CardHeader className="border-b border-slate-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl mb-1">{job.job_title}</CardTitle>
                        <p className="text-sm text-slate-600">{job.department}</p>
                      </div>
                      <Badge variant="outline" className={
                        job.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' :
                        job.status === 'draft' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                        'bg-orange-100 text-orange-700 border-orange-200'
                      }>
                        {job.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="text-sm text-slate-600 mb-4 line-clamp-3">{job.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">
                        {applicants.filter(a => a.job_posting_id === job.id).length} applicants
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          id={`cv-${job.id}`}
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleCVUpload(job.id, e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => document.getElementById(`cv-${job.id}`).click()}
                          disabled={uploadingCV}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadingCV ? "Processing..." : "Upload CV"}
                        </Button>
                        <Button size="sm" onClick={() => setSelectedJob(job)}>
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="applicants">
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>All Applicants</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {applicants.map(applicant => {
                    const config = statusConfig[applicant.status];
                    const StatusIcon = config.icon;
                    const job = jobs.find(j => j.id === applicant.job_posting_id);

                    return (
                      <div key={applicant.id} className="p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-slate-900">{applicant.full_name}</h3>
                              {applicant.ai_score && (
                                <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                                  AI Score: {applicant.ai_score}%
                                </Badge>
                              )}
                              <Badge variant="outline" className={`${config.color} border flex items-center gap-1`}>
                                <StatusIcon className="w-3 h-3" />
                                {applicant.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 mb-1">
                              Applied for: {job?.job_title}
                            </p>
                            <p className="text-sm text-slate-500">
                              {applicant.email} • {applicant.phone}
                            </p>
                            {applicant.ai_summary && (
                              <p className="text-sm text-slate-600 mt-2 italic">{applicant.ai_summary}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Select
                              value={applicant.status}
                              onValueChange={(value) => updateApplicantStatus.mutate({ id: applicant.id, status: value })}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="reviewed">Reviewed</SelectItem>
                                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                                <SelectItem value="interview_scheduled">Interview</SelectItem>
                                <SelectItem value="offered">Offered</SelectItem>
                                <SelectItem value="hired">Hired</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                            {applicant.cv_url && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={applicant.cv_url} target="_blank" rel="noopener noreferrer">
                                  View CV
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}