
import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Upload, Grid, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmployeeList from "../components/dashboard/EmployeeList";
import AddEmployeeForm from "../components/employees/AddEmployeeForm";
import BulkImportDialog from "../components/employees/BulkImportDialog";
import EmployeeCard from "../components/employees/EmployeeCard";

export default function Employees() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  const [showAddForm, setShowAddForm] = useState(action === 'add');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // Changed default to 'cards'
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const query = gql`
        query GetEmployeesList {
          employees {
            id
            fullName
            email
            jobTitle
            employmentStatus
            hireDate
          }
        }
      `;
      const data = await gqlClient.request(query);
      return (data.employees || []).map(emp => ({
        ...emp,
        full_name: emp.fullName,
        job_title: emp.jobTitle,
        employment_status: emp.employmentStatus,
        start_date: emp.hireDate
      }));
    },
    initialData: [],
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const query = gql`
        query GetDepartments {
          departments { id name }
        }
      `;
      const data = await gqlClient.request(query);
      return data.departments || [];
    },
    initialData: [],
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (employeeData) => {
      const mutation = gql`
        mutation CreateEmployee($input: EmployeeInput!) {
          createEmployee(input: $input) {
            id
          }
        }
      `;
      
      const { createEmployee } = await gqlClient.request(mutation, {
        input: {
          fullName: employeeData.full_name,
          email: employeeData.email,
          jobTitle: employeeData.job_title,
          departmentId: employeeData.department_id,
          hireDate: employeeData.start_date,
          basicSalary: parseFloat(employeeData.basic_salary) || 0
        }
      });

      return createEmployee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setShowAddForm(false);
      navigate('/Employees');
    },
  });

  const bulkCreateEmployeesMutation = useMutation({
    mutationFn: async (employeesData) => {
      const createdEmployees = [];
      const mutation = gql`
        mutation CreateEmployee($input: EmployeeInput!) {
          createEmployee(input: $input) { id }
        }
      `;
      for (const employeeData of employeesData) {
        const { createEmployee } = await gqlClient.request(mutation, {
          input: {
            fullName: employeeData.full_name,
            email: employeeData.email,
            jobTitle: employeeData.job_title,
            departmentId: employeeData.department_id,
            hireDate: employeeData.start_date,
            basicSalary: parseFloat(employeeData.basic_salary) || 0
          }
        });
        createdEmployees.push(createEmployee);
      }
      return createdEmployees;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setShowImportDialog(false);
    },
  });

  // Filter employees
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          employee.job_title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || employee.employment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {showAddForm && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setShowAddForm(false);
                  navigate('/Employees');
                }}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {showAddForm ? "Add New Employee" : "Employees"}
              </h1>
              <p className="text-slate-500 mt-1">
                {showAddForm 
                  ? "Add a new team member" 
                  : `Manage your ${employees.length} employee${employees.length !== 1 ? 's' : ''}`
                }
              </p>
            </div>
          </div>
          {!showAddForm && (
            <div className="flex gap-3">
              <Button 
                onClick={() => setShowImportDialog(true)}
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
              <Button 
                onClick={() => setShowAddForm(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Employee
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        {showAddForm ? (
          <AddEmployeeForm
            templates={templates}
            departments={departments}
            onSubmit={(data) => createEmployeeMutation.mutate(data)}
            onCancel={() => {
              setShowAddForm(false);
              navigate('/Employees');
            }}
            isSubmitting={createEmployeeMutation.isPending}
          />
        ) : (
          <>
            {/* Filters and View Toggle */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
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
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="suspended">Suspended</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'cards' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {filteredEmployees.length === 0 && !isLoading ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <EmployeeList employees={filteredEmployees} isLoading={isLoading} />
              </div>
            ) : viewMode === 'list' ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <EmployeeList employees={filteredEmployees} isLoading={isLoading} />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEmployees.map(employee => (
                  <EmployeeCard key={employee.id} employee={employee} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Bulk Import Dialog */}
        <BulkImportDialog
          open={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          onImport={(data) => bulkCreateEmployeesMutation.mutate(data)}
          isImporting={bulkCreateEmployeesMutation.isPending}
          templates={templates}
          departments={departments}
        />
      </div>
    </div>
  );
}
