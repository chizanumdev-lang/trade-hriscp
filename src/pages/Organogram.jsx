
import React from "react";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; // Added import for Badge component
import { Users } from "lucide-react";

export default function Organogram() {
  const { user } = useAuth();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const query = gql`
        query GetOrganogramEmployees {
          employees {
            id
            fullName
            email
            jobTitle
          }
        }
      `;
      const data = await gqlClient.request(query);
      return (data.employees || []).map(emp => ({
        ...emp,
        full_name: emp.fullName,
        job_title: emp.jobTitle,
        manager_email: null, // Mocked for now, as manager_email is not in schema
      }));
    },
    initialData: [],
  });

  const getDirectReports = (managerEmail) => {
    if (!managerEmail) return [];
    return employees.filter(emp => emp.manager_email === managerEmail);
  };

  const topLevel = employees.filter(emp => !emp.manager_email || emp.manager_email === '');

  const renderEmployee = (employee) => {
    const directReports = getDirectReports(employee.email);
    
    return (
      <div key={employee.id} className="flex flex-col items-center">
        <Card className="w-64 border-slate-200 hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-6 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-teal-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold">
              {employee.full_name.charAt(0).toUpperCase()}
            </div>
            <h3 className="font-bold text-slate-900 mb-1">{employee.full_name}</h3>
            <p className="text-sm text-slate-600 mb-2">{employee.job_title}</p>
            {directReports.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {directReports.length} {directReports.length === 1 ? 'Report' : 'Reports'}
              </Badge>
            )}
          </CardContent>
        </Card>

        {directReports.length > 0 && (
          <>
            <div className="h-8 w-px bg-slate-300 my-2"></div>
            <div className="flex gap-8">
              {directReports.map(report => (
                <div key={report.id} className="flex flex-col items-center">
                  {renderEmployee(report)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-green-50 p-4 md:p-8">
      <div className="max-w-full mx-auto space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
            <Users className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-medium text-slate-700">Organization Structure</span>
          </div>
          
          <p className="text-lg text-slate-600">Visual representation of your organization structure</p>
        </div>

        <div className="overflow-x-auto pb-8">
          <div className="min-w-max flex justify-center p-8">
            {topLevel.length > 0 ? (
              topLevel.map(emp => renderEmployee(emp))
            ) : (
              <Card className="border-slate-200">
                <CardContent className="p-12 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-slate-500">No reporting structure defined. Assign managers to employees to build the org chart.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
