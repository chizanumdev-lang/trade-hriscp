// @ts-nocheck
import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Users, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Plus,
  Search,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatsCard from "../components/dashboard/StatsCard";
import EmployeeList from "../components/dashboard/EmployeeList";
import RecentActivity from "../components/dashboard/RecentActivity";
import QuickActions from "../components/dashboard/QuickActions";

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const EMPLOYEES_QUERY = gql`
        query GetDashboardEmployees {
          employees {
            id
            fullName
            email
            jobTitle
            onboardingStatus
            onboardingProgress
          }
        }
      `;
      const data = await gqlClient.request(EMPLOYEES_QUERY);
      // Map to expected structure until backend fully supports these fields
      return (data.employees || []).map(emp => ({
        ...emp,
        full_name: emp.fullName,
        job_title: emp.jobTitle,
        onboarding_status: emp.onboardingStatus || 'not_started',
        progress_percentage: emp.onboardingProgress || 0
      }));
    },
    initialData: [],
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      // Mocked until Tasks module is migrated to GraphQL
      return [];
    },
    initialData: [],
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      // Mocked until Templates module is migrated
      return [];
    },
    initialData: [],
  });

  // Calculate stats
  const totalEmployees = employees.length;
  const activeOnboarding = employees.filter(e => e.onboarding_status === 'in_progress').length;
  const completedOnboarding = employees.filter(e => e.onboarding_status === 'completed').length;
  const averageProgress = employees.length > 0 
    ? Math.round(employees.reduce((sum, e) => sum + (e.progress_percentage || 0), 0) / employees.length)
    : 0;

  const pendingTasks = tasks.filter(t => t.status === 'pending').length;

  // Filter employees
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          employee.job_title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || employee.onboarding_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">HR Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back! Here's what's happening with onboarding.</p>
        </div>
        <Link to={createPageUrl("Employees?action=add")}>
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            Add New Hire
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Employees"
          value={totalEmployees}
          icon={Users}
          color="blue"
          trend={`${templates.length} templates`}
        />
        <StatsCard
          title="Active Onboarding"
          value={activeOnboarding}
          icon={Clock}
          color="orange"
          trend={`${pendingTasks} pending tasks`}
        />
        <StatsCard
          title="Completed"
          value={completedOnboarding}
          icon={CheckCircle}
          color="green"
          trend="This month"
        />
        <StatsCard
          title="Avg. Progress"
          value={`${averageProgress}%`}
          icon={TrendingUp}
          color="purple"
          trend="Overall"
        />
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Employee List - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-xl font-bold text-slate-900">Employees</h2>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-none">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search employees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full md:w-64"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
            <EmployeeList 
              employees={filteredEmployees} 
              isLoading={loadingEmployees}
            />
          </div>
        </div>

        {/* Recent Activity - Takes 1 column */}
        <div>
          <RecentActivity tasks={tasks} employees={employees} />
        </div>
      </div>
    </div>
  );
}