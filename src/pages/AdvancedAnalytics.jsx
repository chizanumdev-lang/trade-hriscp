import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, DollarSign, Calendar, Plus, Mail } from "lucide-react";
import { format, subMonths } from "date-fns";

export default function AdvancedAnalytics() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    report_name: '',
    report_type: 'attendance',
    frequency: 'monthly',
    recipients: [],
    format: 'pdf',
  });
  const [recipientEmail, setRecipientEmail] = useState('');

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
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: payrolls = [] } = useQuery({
    queryKey: ['payroll'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: scheduledReports = [] } = useQuery({
    queryKey: ['scheduled-reports'],
    queryFn: async () => [],
    initialData: [],
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock create scheduled report", data);
      return {
        ...data,
        id: `report_${Date.now()}`,
        organization_id: user.organization_id,
        created_by: user.email,
        is_active: true,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      setShowScheduleDialog(false);
      setScheduleForm({
        report_name: '',
        report_type: 'attendance',
        frequency: 'monthly',
        recipients: [],
        format: 'pdf',
      });
    },
  });

  // Analytics calculations
  const currentMonth = new Date();
  const last6Months = Array.from({ length: 6 }, (_, i) => subMonths(currentMonth, 5 - i));

  const headcountTrend = last6Months.map(month => ({
    month: format(month, 'MMM'),
    count: employees.filter(e => new Date(e.start_date) <= month).length,
  }));

  const turnoverRate = employees.length > 0
    ? ((employees.filter(e => e.employment_status === 'terminated').length / employees.length) * 100).toFixed(1)
    : 0;

  const avgTenure = employees.length > 0
    ? Math.round(
        employees.reduce((sum, e) => {
          const months = (new Date() - new Date(e.start_date)) / (1000 * 60 * 60 * 24 * 30);
          return sum + months;
        }, 0) / employees.length
      )
    : 0;

  const departmentDistribution = {};
  employees.forEach(emp => {
    const dept = emp.department_id || 'Unassigned';
    departmentDistribution[dept] = (departmentDistribution[dept] || 0) + 1;
  });

  const deptData = Object.entries(departmentDistribution).map(([name, value]) => ({
    name,
    value,
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const payrollTrend = last6Months.map(month => {
    const monthStr = format(month, 'yyyy-MM');
    const monthPayrolls = payrolls.filter(p => p.month === monthStr);
    return {
      month: format(month, 'MMM'),
      total: monthPayrolls.reduce((sum, p) => sum + (p.net_salary || 0), 0),
    };
  });

  // Predictive turnover (simplified AI prediction)
  const employeesAtRisk = employees.filter(emp => {
    const tenure = (new Date() - new Date(emp.start_date)) / (1000 * 60 * 60 * 24 * 30);
    const empLeaves = leaveRequests.filter(l => l.employee_id === emp.id);
    const recentLeaves = empLeaves.filter(l => {
      const months = (new Date() - new Date(l.start_date)) / (1000 * 60 * 60 * 24 * 30);
      return months <= 3;
    }).length;
    
    // Simple risk factors: high leave usage, low tenure
    return tenure < 12 && recentLeaves > 2;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-slate-700">Advanced Analytics</span>
            </div>
            
            <p className="text-lg text-slate-600">Comprehensive HR analytics and predictive insights</p>
          </div>
          <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Report
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Recurring Report</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createScheduleMutation.mutate(scheduleForm); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Report Name</Label>
                  <Input value={scheduleForm.report_name} onChange={(e) => setScheduleForm(prev => ({ ...prev, report_name: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Report Type</Label>
                    <Select value={scheduleForm.report_type} onValueChange={(value) => setScheduleForm(prev => ({ ...prev, report_type: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attendance">Attendance</SelectItem>
                        <SelectItem value="payroll">Payroll</SelectItem>
                        <SelectItem value="overtime">Overtime</SelectItem>
                        <SelectItem value="leave">Leave</SelectItem>
                        <SelectItem value="turnover">Turnover</SelectItem>
                        <SelectItem value="headcount">Headcount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={scheduleForm.frequency} onValueChange={(value) => setScheduleForm(prev => ({ ...prev, frequency: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Recipients</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="email" 
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="email@company.com"
                    />
                    <Button 
                      type="button"
                      onClick={() => {
                        if (recipientEmail) {
                          setScheduleForm(prev => ({ 
                            ...prev, 
                            recipients: [...prev.recipients, recipientEmail] 
                          }));
                          setRecipientEmail('');
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {scheduleForm.recipients.map(email => (
                      <Badge key={email} variant="outline" className="flex items-center gap-1">
                        {email}
                        <button 
                          type="button"
                          onClick={() => setScheduleForm(prev => ({
                            ...prev,
                            recipients: prev.recipients.filter(e => e !== email)
                          }))}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
                  <Button type="submit" isLoading={createScheduleMutation.isPending}>
                    {createScheduleMutation.isPending ? 'Creating...' : 'Schedule Report'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 mt-4">{employees.length}</p>
              <p className="text-sm text-slate-600">Total Headcount</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 mt-4">{turnoverRate}%</p>
              <p className="text-sm text-slate-600">Turnover Rate</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 mt-4">{avgTenure}</p>
              <p className="text-sm text-slate-600">Avg Tenure (months)</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-gradient-to-br from-orange-50 to-red-50">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 mt-4">{employeesAtRisk.length}</p>
              <p className="text-sm text-slate-600">At Risk (AI Prediction)</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle>Headcount Trend</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={headcountTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle>Department Distribution</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={deptData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {deptData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle>Payroll Trend (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={payrollTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle>AI Turnover Prediction</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-sm text-slate-600 mb-2">Employees at Risk of Leaving</p>
                  <p className="text-3xl font-bold text-orange-700">{employeesAtRisk.length}</p>
                </div>
                <div className="space-y-2">
                  {employeesAtRisk.slice(0, 5).map(emp => (
                    <div key={emp.id} className="p-3 bg-slate-50 rounded-lg">
                      <p className="font-medium text-slate-900">{emp.full_name}</p>
                      <p className="text-xs text-slate-500">{emp.job_title} • High leave usage</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scheduled Reports */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle>Scheduled Reports</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {scheduledReports.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500">No scheduled reports</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledReports.map(report => (
                  <div key={report.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-slate-900">{report.report_name}</p>
                      <p className="text-sm text-slate-600">
                        {report.report_type} • {report.frequency} • {report.recipients.length} recipients
                      </p>
                    </div>
                    <Badge className={report.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
                      {report.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}