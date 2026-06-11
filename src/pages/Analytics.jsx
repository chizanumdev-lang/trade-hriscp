import React from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, Users, CheckCircle, Clock, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Analytics() {
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => [],
    initialData: [],
  });

  // Calculate analytics
  const statusData = [
    { name: 'Not Started', value: employees.filter(e => e.status === 'not_started').length, color: '#94a3b8' },
    { name: 'In Progress', value: employees.filter(e => e.status === 'in_progress').length, color: '#3b82f6' },
    { name: 'Completed', value: employees.filter(e => e.status === 'completed').length, color: '#10b981' },
  ];

  const departmentTasks = {};
  tasks.forEach(task => {
    if (!departmentTasks[task.department]) {
      departmentTasks[task.department] = { total: 0, completed: 0 };
    }
    departmentTasks[task.department].total++;
    if (task.status === 'completed') {
      departmentTasks[task.department].completed++;
    }
  });

  const departmentData = Object.entries(departmentTasks).map(([dept, data]) => ({
    department: dept,
    total: data.total,
    completed: data.completed,
    completion_rate: Math.round((data.completed / data.total) * 100),
  }));

  const averageOnboardingTime = employees.filter(e => e.onboarding_completed_date).length > 0
    ? Math.round(
        employees
          .filter(e => e.onboarding_completed_date)
          .reduce((sum, e) => {
            const start = new Date(e.start_date);
            const end = new Date(e.onboarding_completed_date);
            const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
            return sum + days;
          }, 0) / employees.filter(e => e.onboarding_completed_date).length
      )
    : 0;

  const taskCompletionRate = tasks.length > 0
    ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
    : 0;

  if (loadingEmployees || loadingTasks) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-12 w-64" />
          <div className="grid md:grid-cols-3 gap-6">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          
          <p className="text-slate-500 mt-1">Track your onboarding performance and metrics</p>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Employees</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{employees.length}</p>
                  <p className="text-xs text-slate-500 mt-2">{templates.length} templates</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Avg. Completion</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{averageOnboardingTime}</p>
                  <p className="text-xs text-slate-500 mt-2">days</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Task Completion</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{taskCompletionRate}%</p>
                  <p className="text-xs text-slate-500 mt-2">{tasks.filter(t => t.status === 'completed').length} / {tasks.length}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Active Onboarding</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {employees.filter(e => e.status === 'in_progress').length}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">in progress</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle>Employee Status Distribution</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Department Performance */}
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle>Department Task Completion</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={departmentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="completed" fill="#10b981" name="Completed" />
                  <Bar dataKey="total" fill="#e5e7eb" name="Total" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Summary Stats */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle>Onboarding Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <p className="text-sm text-slate-500 mb-2">Total Tasks Created</p>
                <p className="text-2xl font-bold text-slate-900">{tasks.length}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-2">Completed Onboardings</p>
                <p className="text-2xl font-bold text-green-600">
                  {employees.filter(e => e.status === 'completed').length}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-2">Templates Created</p>
                <p className="text-2xl font-bold text-indigo-600">{templates.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}