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
  Filter,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatsCard from "../components/dashboard/StatsCard";
import EmployeeList from "../components/dashboard/EmployeeList";
import RecentActivity from "../components/dashboard/RecentActivity";
import QuickActions from "../components/dashboard/QuickActions";
import CelebrationsWidget from "../components/dashboard/CelebrationsWidget";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import EmployeeDetail from "./EmployeeDetail";

import { useAuth } from "@/lib/AuthContext";
import { Navigate } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [page, setPage] = useState(1);
  const limit = 5;

  if (user?.role === 'EMPLOYEE') {
    return <Navigate to="/employeeselfservice" />;
  }

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

  const { data: paginatedData, isLoading: loadingPaginated, isFetching } = useQuery({
    queryKey: ['paginatedEmployees', page, limit, searchTerm, statusFilter],
    queryFn: async () => {
      const PAGINATED_QUERY = gql`
        query GetPaginatedDashboardEmployees($page: Int, $limit: Int, $search: String, $status: String) {
          paginatedEmployees(page: $page, limit: $limit, search: $search, status: $status) {
            employees {
              id
              fullName
              email
              jobTitle
              onboardingStatus
              onboardingProgress
            }
            totalCount
            totalPages
            currentPage
          }
        }
      `;
      const data = await gqlClient.request(PAGINATED_QUERY, { page, limit, search: searchTerm, status: statusFilter });
      return {
        ...data.paginatedEmployees,
        employees: data.paginatedEmployees.employees.map(emp => ({
          ...emp,
          full_name: emp.fullName,
          job_title: emp.jobTitle,
          onboarding_status: emp.onboardingStatus || 'not_started',
          progress_percentage: emp.onboardingProgress || 0
        }))
      };
    },
    keepPreviousData: true,
  });

  // Reset page to 1 when search or status filter changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);


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

  const currentEmployees = paginatedData?.employees || [];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-lg font-semibold text-slate-700 tracking-tight">Welcome back! Here's what's happening with onboarding.</p>
        </div>
        <Link to={createPageUrl("Employees?action=add")}>
          <Button className="bg-slate-900 text-white hover:bg-slate-800 shadow-sm rounded-lg px-5 transition-all">
            <Plus className="w-4 h-4 mr-2" />
            Add New Hire
          </Button>
        </Link>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatsCard
          title="Total Employees"
          value={totalEmployees}
          icon={Users}
          color="blue"
          trend={`${templates.length} templates`}
          isLoading={loadingEmployees}
        />
        <StatsCard
          title="Active Onboarding"
          value={activeOnboarding}
          icon={Clock}
          color="orange"
          trend={`${pendingTasks} pending tasks`}
          isLoading={loadingEmployees}
        />
        <StatsCard
          title="Completed"
          value={completedOnboarding}
          icon={CheckCircle}
          color="green"
          trend="This month"
          isLoading={loadingEmployees}
        />
        <StatsCard
          title="Avg. Progress"
          value={`${averageProgress}%`}
          icon={TrendingUp}
          color="purple"
          trend="Overall"
          isLoading={loadingEmployees}
        />
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <QuickActions />
      </motion.div>

      {/* Main Content Grid */}
      <motion.div variants={itemVariants} className="grid lg:grid-cols-3 gap-6">
        {/* Employee List - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden h-full flex flex-col">
            <div className="p-5 border-b border-slate-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Employees</h2>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-none">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search employees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-full md:w-64 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white text-slate-700 transition-colors cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex-1 p-0 relative">
              {(loadingPaginated || isFetching) && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center pointer-events-none">
                  {/* Optional spinner */}
                </div>
              )}
              <EmployeeList 
                employees={currentEmployees} 
                isLoading={loadingPaginated && !paginatedData}
                onOpenDetail={setSelectedEmployeeId}
              />
            </div>
            {paginatedData?.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, paginatedData.totalCount)} of {paginatedData.totalCount} entries
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.min(paginatedData.totalPages, p + 1))}
                    disabled={page === paginatedData.totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity - Takes 1 column */}
        <div className="space-y-6">
          <CelebrationsWidget />
          <RecentActivity tasks={tasks} employees={employees} />
        </div>
      </motion.div>

      <Dialog open={!!selectedEmployeeId} onOpenChange={(open) => !open && setSelectedEmployeeId(null)}>
        <DialogContent className="max-w-6xl p-0 overflow-hidden rounded-2xl border-0 shadow-2xl bg-transparent" hideCloseButton>
          <DialogTitle className="sr-only">Employee Detail</DialogTitle>
          <DialogDescription className="sr-only">Detailed view of the selected employee's information.</DialogDescription>
          {selectedEmployeeId && (
            <EmployeeDetail 
              employeeIdProp={selectedEmployeeId} 
              onClose={() => setSelectedEmployeeId(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}