import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, FileText, Briefcase, Sparkles } from "lucide-react";
import EmployeeTaskList from "../components/employee-portal/EmployeeTaskList";
import EmployeeDocumentUpload from "../components/employee-portal/EmployeeDocumentUpload";

export default function EmployeePortal() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = {
          email: "mock_user@example.com",
          role: "admin",
          organization_id: "org_1",
          full_name: "Mock User"
        };
        setUser(currentUser);
        
        const mockEmployee = {
          id: 'emp_1',
          full_name: "Mock User",
          email: "mock_user@example.com",
          job_title: "Mock Employee",
          progress_percentage: 50,
          start_date: new Date().toISOString()
        };
        setEmployee(mockEmployee);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: tasks = [] } = useQuery({
    queryKey: ['employee-tasks', employee?.id],
    queryFn: async () => [],
    enabled: !!employee,
    initialData: [],
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['employee-documents', employee?.id],
    queryFn: async () => [],
    enabled: !!employee,
    initialData: [],
  });

  if (!employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-slate-200 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No Onboarding Found</h2>
            <p className="text-slate-600">
              You don't have an active onboarding process yet. Please contact your HR team.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const uploadedDocs = documents.filter(d => d.status !== 'pending').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-slate-700">Welcome to the Team!</span>
          </div>
          
          <p className="text-lg text-slate-600">
            We're excited to have you as our {employee.job_title}
          </p>
        </div>

        {/* Progress Overview */}
        <Card className="border-slate-200 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">Your Onboarding Journey</h2>
                <p className="text-blue-100">Track your progress</p>
              </div>
              <div className="text-4xl font-bold">{employee.progress_percentage || 0}%</div>
            </div>
            <Progress value={employee.progress_percentage || 0} className="h-3 bg-blue-400" />
          </div>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">{tasks.length}</div>
                <div className="text-sm text-slate-600 flex items-center justify-center gap-1 mt-1">
                  <CheckCircle className="w-4 h-4" />
                  Total Tasks
                </div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
                <div className="text-sm text-slate-600 flex items-center justify-center gap-1 mt-1">
                  <CheckCircle className="w-4 h-4" />
                  Completed
                </div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{uploadedDocs}/{documents.length}</div>
                <div className="text-sm text-slate-600 flex items-center justify-center gap-1 mt-1">
                  <FileText className="w-4 h-4" />
                  Documents
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks and Documents */}
        <div className="grid lg:grid-cols-2 gap-8">
          <EmployeeTaskList tasks={tasks} employeeId={employee.id} />
          <EmployeeDocumentUpload documents={documents} employeeId={employee.id} />
        </div>

        {/* Start Date Info */}
        <Card className="border-slate-200 shadow-lg bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardContent className="p-6 text-center">
            <Clock className="w-8 h-8 mx-auto mb-3 text-indigo-600" />
            <p className="text-slate-600 mb-1">Your start date</p>
            <p className="text-2xl font-bold text-slate-900">
              {new Date(employee.start_date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}