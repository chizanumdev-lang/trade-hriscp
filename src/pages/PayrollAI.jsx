import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Sparkles, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function PayrollAI() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      // Mock current user
      setUser({ role: 'admin', email: 'admin@tradevu.com', full_name: 'Admin User', organization_id: 'org-1' });
    };
    loadUser();
  }, []);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['payroll-suggestions'],
    queryFn: async () => {
      // Mock suggestions list
      return [];
    },
    initialData: [],
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const query = `query { employees { id first_name last_name job_title } }`;
      const data = await gqlClient.request(query);
      return data.employees.map(emp => ({
        id: emp.id,
        full_name: `${emp.first_name} ${emp.last_name}`,
        job_title: emp.job_title,
        payroll_details: { basic_salary: 5000 }
      }));
    },
    initialData: [],
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: overtimeRecords = [] } = useQuery({
    queryKey: ['overtime'],
    queryFn: async () => [],
    initialData: [],
  });

  const updateSuggestionMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // Mock update
      return { id, ...data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-suggestions'] });
    },
  });

  const runPayrollAnalysis = async () => {
    setIsAnalyzing(true);
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const newSuggestions = [];

    for (const emp of employees) {
      // Check overtime
      const empOvertime = overtimeRecords.filter(o => 
        o.employee_id === emp.id && 
        o.date.startsWith(currentMonth) &&
        o.status === 'approved'
      );
      
      if (empOvertime.length > 0) {
        const totalOvertimeHours = empOvertime.reduce((sum, o) => sum + o.hours, 0);
        const totalOvertimeAmount = empOvertime.reduce((sum, o) => sum + o.total_amount, 0);
        
        newSuggestions.push({
          organization_id: user.organization_id,
          employee_id: emp.id,
          employee_name: emp.full_name,
          month: currentMonth,
          suggestion_type: 'overtime_adjustment',
          current_value: 0,
          suggested_value: totalOvertimeAmount,
          difference: totalOvertimeAmount,
          reason: `${totalOvertimeHours} hours of approved overtime detected`,
          confidence_score: 95,
          supporting_data: { hours: totalOvertimeHours, records: empOvertime.length },
          status: 'pending',
        });
      }

      // Check unpaid leave
      const empLeaves = leaveRequests.filter(l =>
        l.employee_id === emp.id &&
        l.status === 'approved' &&
        !l.is_paid &&
        l.start_date.startsWith(currentMonth)
      );

      if (empLeaves.length > 0) {
        const totalUnpaidDays = empLeaves.reduce((sum, l) => sum + l.total_days, 0);
        const dailySalary = emp.payroll_details?.basic_salary / 30;
        const deduction = dailySalary * totalUnpaidDays;

        newSuggestions.push({
          organization_id: user.organization_id,
          employee_id: emp.id,
          employee_name: emp.full_name,
          month: currentMonth,
          suggestion_type: 'leave_deduction',
          current_value: 0,
          suggested_value: -deduction,
          difference: -deduction,
          reason: `${totalUnpaidDays} days of unpaid leave should be deducted`,
          confidence_score: 98,
          supporting_data: { unpaid_days: totalUnpaidDays, daily_rate: dailySalary },
          status: 'pending',
        });
      }
    }

    // Create suggestions
    for (const suggestion of newSuggestions) {
      // await base44.entities.PayrollSuggestion.create(suggestion);
      console.log('Mock create suggestion', suggestion);
    }

    queryClient.invalidateQueries({ queryKey: ['payroll-suggestions'] });
    setIsAnalyzing(false);
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

  const handleAccept = (suggestion) => {
    updateSuggestionMutation.mutate({
      id: suggestion.id,
      data: {
        status: 'accepted',
        reviewed_by: user.email,
        reviewed_date: new Date().toISOString(),
      }
    });
  };

  const handleReject = (suggestion) => {
    updateSuggestionMutation.mutate({
      id: suggestion.id,
      data: {
        status: 'rejected',
        reviewed_by: user.email,
        reviewed_date: new Date().toISOString(),
      }
    });
  };

  const typeConfig = {
    overtime_adjustment: { color: 'bg-blue-100 text-blue-700', label: 'Overtime' },
    leave_deduction: { color: 'bg-orange-100 text-orange-700', label: 'Leave Deduction' },
    allowance_change: { color: 'bg-purple-100 text-purple-700', label: 'Allowance' },
    error_detection: { color: 'bg-red-100 text-red-700', label: 'Error' },
    gosi_adjustment: { color: 'bg-green-100 text-green-700', label: 'GOSI' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
              <Sparkles className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-slate-700">AI Payroll Assistant</span>
            </div>
            
            <p className="text-lg text-slate-600">AI-powered payroll analysis and recommendations</p>
          </div>
          <Button 
            onClick={runPayrollAnalysis}
            disabled={isAnalyzing}
            className="bg-gradient-to-r from-green-600 to-emerald-600"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {isAnalyzing ? 'Analyzing...' : 'Run AI Analysis'}
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 mt-4">{pendingSuggestions.length}</p>
              <p className="text-sm text-slate-600">Pending Suggestions</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 mt-4">
                {suggestions.filter(s => s.status === 'accepted').length}
              </p>
              <p className="text-sm text-slate-600">Accepted</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 mt-4">
                {suggestions.reduce((sum, s) => sum + Math.abs(s.difference || 0), 0).toLocaleString()} SAR
              </p>
              <p className="text-sm text-slate-600">Total Adjustments</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle>AI Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {pendingSuggestions.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">All Clear!</h3>
                <p className="text-slate-500">No payroll adjustments needed</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingSuggestions.map(suggestion => {
                  const config = typeConfig[suggestion.suggestion_type] || typeConfig.error_detection;
                  
                  return (
                    <div key={suggestion.id} className="p-4 rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className={config.color}>{config.label}</Badge>
                            <Badge variant="outline">
                              {suggestion.confidence_score}% Confidence
                            </Badge>
                          </div>
                          <p className="font-semibold text-slate-900 mb-1">
                            {suggestion.employee_name}
                          </p>
                          <p className="text-sm text-slate-600 mb-2">{suggestion.reason}</p>
                          <div className="flex gap-4 text-sm">
                            <div>
                              <p className="text-slate-500">Current</p>
                              <p className="font-semibold">{suggestion.current_value} SAR</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Suggested</p>
                              <p className="font-semibold text-green-600">{suggestion.suggested_value} SAR</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Difference</p>
                              <p className={`font-semibold ${suggestion.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {suggestion.difference > 0 ? '+' : ''}{suggestion.difference} SAR
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleAccept(suggestion)}>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Accept
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleReject(suggestion)}>
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
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