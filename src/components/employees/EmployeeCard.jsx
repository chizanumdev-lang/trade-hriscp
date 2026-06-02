import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Briefcase, Calendar } from "lucide-react";
import { format } from "date-fns";

const statusColors = {
  active: "bg-green-100 text-green-800 border-green-200",
  on_leave: "bg-yellow-100 text-yellow-800 border-yellow-200",
  suspended: "bg-orange-100 text-orange-800 border-orange-200",
  terminated: "bg-red-100 text-red-800 border-red-200",
  resigned: "bg-slate-100 text-slate-800 border-slate-200",
};

export default function EmployeeCard({ employee }) {
  return (
    <Link to={createPageUrl(`EmployeeDetail?id=${employee.id}`)}>
      <Card className="border-slate-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
        <CardContent className="p-6">
          <div className="flex items-start gap-4 mb-4">
            {employee.avatar_url ? (
              <img src={employee.avatar_url} alt={employee.full_name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-xl">
                {employee.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                {employee.full_name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {employee.employeeCode}
                </span>
                <Badge variant="outline" className={`${statusColors[employee.employment_status || 'active']} border text-[10px]`}>
                  {(employee.employment_status || 'active').replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <span className="truncate">
                {employee.job_title}
                {employee.department_name && <span className="text-slate-400"> • {employee.department_name}</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="truncate">{employee.email}</span>
            </div>
            {employee.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{employee.phone}</span>
              </div>
            )}
            {employee.start_date && !isNaN(new Date(employee.start_date).getTime()) && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Joined {format(new Date(employee.start_date), "MMM d, yyyy")}</span>
              </div>
            )}
          </div>

          {employee.employment_type && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                {employee.employment_type.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}