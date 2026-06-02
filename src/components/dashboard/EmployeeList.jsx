import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Mail, Briefcase } from "lucide-react";

const statusColors = {
  not_started: "bg-slate-100 text-slate-800 border-slate-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
};

const statusLabels = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

export default function EmployeeList({ employees, isLoading }) {
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-2 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center">
          <Briefcase className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No employees yet</h3>
        <p className="text-slate-500 mb-4">Start by adding your first new hire</p>
        <Link to={createPageUrl("Employees?action=add")}>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Add New Hire
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {employees.map((employee) => (
        <Link
          key={employee.id}
          to={createPageUrl(`EmployeeDetail?id=${employee.id}`)}
          className="block p-6 hover:bg-slate-50 transition-colors group"
        >
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
              {employee.full_name.charAt(0).toUpperCase()}
            </div>

            {/* Employee Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900 truncate flex items-center gap-2">
                  {employee.full_name}
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-normal">
                    {employee.employeeCode}
                  </span>
                </h3>
                <Badge variant="outline" className={`${statusColors[employee.onboarding_status] || 'bg-slate-100 text-slate-800'} border`}>
                  {statusLabels[employee.onboarding_status] || employee.onboarding_status || 'Draft'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  {employee.job_title}
                  {employee.department_name && <span className="text-slate-400"> • {employee.department_name}</span>}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {employee.email}
                </span>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Progress</span>
                  <span className="font-medium">{employee.progress_percentage || 0}%</span>
                </div>
                <Progress value={employee.progress_percentage || 0} className="h-2" />
              </div>
            </div>

            {/* Arrow */}
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0" />
          </div>
        </Link>
      ))}
    </div>
  );
}