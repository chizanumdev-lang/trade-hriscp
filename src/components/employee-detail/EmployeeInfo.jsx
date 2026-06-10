import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Calendar, Briefcase, Building2, Save } from "lucide-react";
import { format } from "date-fns";

export default function EmployeeInfo({ employee, isEditing, onUpdate, isUpdating }) {
  const [formData, setFormData] = useState({
    full_name: employee.full_name || "",
    email: employee.email || "",
    phone: employee.phone || "",
    job_title: employee.job_title || "",
    start_date: employee.start_date || "",
    personal_info: employee.personal_info || {},
  });

  useEffect(() => {
    setFormData({
      full_name: employee.full_name || "",
      email: employee.email || "",
      phone: employee.phone || "",
      job_title: employee.job_title || "",
      start_date: employee.start_date || "",
      personal_info: employee.personal_info || {},
    });
  }, [employee]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(formData);
  };

  if (isEditing) {
    return (
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="text-xl">Edit Employee Information</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title *</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Personal Information</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.personal_info.address || ""}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      personal_info: { ...prev.personal_info, address: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact">Emergency Contact</Label>
                  <Input
                    id="emergency_contact"
                    value={formData.personal_info.emergency_contact || ""}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      personal_info: { ...prev.personal_info, emergency_contact: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_phone">Emergency Phone</Label>
                  <Input
                    id="emergency_phone"
                    value={formData.personal_info.emergency_phone || ""}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      personal_info: { ...prev.personal_info, emergency_phone: e.target.value }
                    }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button
                type="submit"
                isLoading={isUpdating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Basic Information */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-200 bg-slate-50">
          <CardTitle className="text-lg">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-500">Email</p>
              <p className="font-medium text-slate-900">{employee.email}</p>
            </div>
          </div>
          {employee.phone && (
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm text-slate-500">Phone</p>
                <p className="font-medium text-slate-900">{employee.phone}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <Briefcase className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-500">Job Title</p>
              <p className="font-medium text-slate-900">{employee.job_title}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-500">Start Date</p>
              <p className="font-medium text-slate-900">
                {format(new Date(employee.start_date), "MMMM d, yyyy")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Status */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-200 bg-slate-50">
          <CardTitle className="text-lg">Onboarding Status</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <p className="text-sm text-slate-500">Current Status</p>
            <p className="font-medium text-slate-900 capitalize">
              {employee.status.replace('_', ' ')}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Progress</p>
            <p className="font-medium text-slate-900">{employee.progress_percentage || 0}%</p>
          </div>
          {employee.welcome_sent && (
            <div>
              <p className="text-sm text-slate-500">Welcome Email</p>
              <p className="font-medium text-green-600">Sent ✓</p>
            </div>
          )}
          {employee.onboarding_completed_date && (
            <div>
              <p className="text-sm text-slate-500">Completion Date</p>
              <p className="font-medium text-slate-900">
                {format(new Date(employee.onboarding_completed_date), "MMMM d, yyyy")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personal Information */}
      {employee.personal_info && (
        <Card className="border-slate-200 md:col-span-2">
          <CardHeader className="border-b border-slate-200 bg-slate-50">
            <CardTitle className="text-lg">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid md:grid-cols-2 gap-6">
            {employee.personal_info.address && (
              <div>
                <p className="text-sm text-slate-500">Address</p>
                <p className="font-medium text-slate-900">{employee.personal_info.address}</p>
              </div>
            )}
            {employee.personal_info.emergency_contact && (
              <div>
                <p className="text-sm text-slate-500">Emergency Contact</p>
                <p className="font-medium text-slate-900">{employee.personal_info.emergency_contact}</p>
                {employee.personal_info.emergency_phone && (
                  <p className="text-sm text-slate-600 mt-1">{employee.personal_info.emergency_phone}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}