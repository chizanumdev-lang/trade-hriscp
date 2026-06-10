import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Mail, Briefcase, Calendar, FileText } from "lucide-react";

export default function AddEmployeeForm({ templates, departments, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    job_title: "",
    department_id: "",
    template_id: "",
    start_date: "",
    phone: "",
    status: "not_started",
    progress_percentage: 0,
    employment_type: "full_time",
    employeeClass: "Permanent",
    employeeGrade: "Entry Level 1",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.template_id) {
      alert("Please select an onboarding template.");
      return;
    }
    onSubmit(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="max-w-3xl mx-auto border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <UserPlus className="w-6 h-6 text-blue-600" />
          New Employee Information
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Personal Information
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleChange("full_name", e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="john@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_date" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Start Date *
                </Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange("start_date", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Job Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Job Details
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title *</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => handleChange("job_title", e.target.value)}
                  placeholder="Software Engineer"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department_id">Department</Label>
                <Select value={formData.department_id} onValueChange={(value) => handleChange("department_id", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeClass">Employment Class</Label>
                <Select value={formData.employeeClass} onValueChange={(value) => handleChange("employeeClass", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Permanent">Permanent</SelectItem>
                    <SelectItem value="Probationary">Probationary</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Consultant">Consultant</SelectItem>
                    <SelectItem value="Intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeGrade">Employee Grade</Label>
                <Select value={formData.employeeGrade} onValueChange={(value) => handleChange("employeeGrade", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Entry Level 1">Entry Level 1</SelectItem>
                    <SelectItem value="Entry Level 2">Entry Level 2</SelectItem>
                    <SelectItem value="Entry Level 3">Entry Level 3</SelectItem>
                    <SelectItem value="Entry Level 4">Entry Level 4</SelectItem>
                    <SelectItem value="Entry Level 5">Entry Level 5</SelectItem>
                    <SelectItem value="Mid-Level 1">Mid-Level 1</SelectItem>
                    <SelectItem value="Mid-Level 2">Mid-Level 2</SelectItem>
                    <SelectItem value="Mid-Level 3">Mid-Level 3</SelectItem>
                    <SelectItem value="Mid-Level 4">Mid-Level 4</SelectItem>
                    <SelectItem value="Mid-Level 5">Mid-Level 5</SelectItem>
                    <SelectItem value="Senior Level 1">Senior Level 1</SelectItem>
                    <SelectItem value="Senior Level 2">Senior Level 2</SelectItem>
                    <SelectItem value="Senior Level 3">Senior Level 3</SelectItem>
                    <SelectItem value="Senior Level 4">Senior Level 4</SelectItem>
                    <SelectItem value="Senior Level 5">Senior Level 5</SelectItem>
                    <SelectItem value="Management 1">Management 1</SelectItem>
                    <SelectItem value="Management 2">Management 2</SelectItem>
                    <SelectItem value="Management 3">Management 3</SelectItem>
                    <SelectItem value="Management 4">Management 4</SelectItem>
                    <SelectItem value="Management 5">Management 5</SelectItem>
                    <SelectItem value="CEO">CEO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Onboarding Template */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Onboarding Template
            </h3>
            <div className="space-y-2">
              <Label htmlFor="template_id">Select Template *</Label>
              <Select value={formData.template_id} onValueChange={(value) => handleChange("template_id", value)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} - {template.role_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-slate-500">
                Templates automatically create tasks and document requests for the employee
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onCancel} isLoading={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              isLoading={isSubmitting}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {isSubmitting ? "Creating..." : "Create Employee"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}