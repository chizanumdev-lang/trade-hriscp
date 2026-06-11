import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { 
  User, Calendar, DollarSign, FileText, Laptop, 
  TrendingUp, Download, Edit, Save, Clock, CheckCircle,
  Plane, Receipt, Shield, Upload, Eye
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { uploadToCloudinary } from "@/utils/cloudinary";
import { motion } from "framer-motion";

export default function EmployeeSelfService() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const employeeId = user?.employeeId;
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadData, setUploadData] = useState({ name: '', category: 'General', file: null });
  const [isUploadingToCloudinary, setIsUploadingToCloudinary] = useState(false);

  const { data: employee, isLoading: isLoadingEmployee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const EMP_QUERY = gql`
        query GetEmployeeSelfService($id: ID!) {
          employee(id: $id) {
            id fullName email phone privateEmail dateOfBirth gender maritalStatus nationality nationalId passportNumber jobTitle departmentId department { name } hireDate employmentStatus
          }
        }
      `;
      const data = await gqlClient.request(EMP_QUERY, { id: employeeId });
      if (!data.employee) return null;
      const emp = data.employee;
      return {
        ...emp,
        full_name: emp.fullName,
        job_title: emp.jobTitle,
        department_id: emp.department?.name || emp.departmentId,
        start_date: emp.hireDate,
        employment_status: emp.employmentStatus,
      };
    },
    enabled: !!employeeId,
  });

  useEffect(() => {
    if (employee) {
      setEditData(employee);
    }
  }, [employee]);

  const { data: payrolls = [] } = useQuery({
    queryKey: ['my-payrolls', employee?.id],
    queryFn: async () => [],
    enabled: !!employee,
    initialData: [],
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['my-leaves', employee?.id],
    queryFn: async () => [],
    enabled: !!employee,
    initialData: [],
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['my-attendance', employee?.id],
    queryFn: async () => [],
    enabled: !!employee,
    initialData: [],
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['my-assets', employee?.email],
    queryFn: async () => [],
    enabled: !!employee,
    initialData: [],
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['my-expenses', employee?.id],
    queryFn: async () => [],
    enabled: !!employee,
    initialData: [],
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['my-documents', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const DOCS_QUERY = gql`
        query GetMyDocuments($employeeId: ID!) {
          documents(employeeId: $employeeId) {
            id name category fileUrl fileType status
          }
        }
      `;
      const data = await gqlClient.request(DOCS_QUERY, { employeeId });
      return data.documents.map(d => ({
        ...d,
        document_name: d.name,
        file_name: d.name + '.' + (d.fileType || 'pdf'),
        file_url: d.fileUrl
      }));
    },
    enabled: !!employeeId,
    initialData: [],
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const mutation = gql`
        mutation UpdateEmployeeSelf($input: UpdateEmployeeInput!) {
          updateEmployeeSelf(input: $input) {
            id
          }
        }
      `;
      const input = {
        phone: data.phone,
        privateEmail: data.privateEmail,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        maritalStatus: data.maritalStatus,
        nationality: data.nationality,
        nationalId: data.nationalId,
        passportNumber: data.passportNumber
      };
      return gqlClient.request(mutation, { input });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      setIsEditing(false);
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update profile: " + error.message);
      console.error(error);
    }
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (input) => {
      const MUTATION = gql`
        mutation UploadDocument($employeeId: ID!, $name: String!, $category: String!, $fileUrl: String!, $fileType: String!, $visibilityLevel: String!) {
          uploadDocument(employeeId: $employeeId, name: $name, category: $category, fileUrl: $fileUrl, fileType: $fileType, visibilityLevel: $visibilityLevel) {
            id
          }
        }
      `;
      // Ensure visibilityLevel is lowercase 'employee'
      return gqlClient.request(MUTATION, {
        ...input,
        visibilityLevel: input.visibilityLevel?.toLowerCase() || 'employee'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-documents', employeeId] });
      setIsUploadOpen(false);
      setUploadData({ name: '', category: 'General', file: null });
      toast.success("Document uploaded successfully");
    },
    onError: (error) => {
      toast.error("Failed to upload document: " + error.message);
      console.error(error);
    }
  });

  const handleSave = () => {
    updateEmployeeMutation.mutate({ id: employee.id, data: editData });
  };

  const handleDownloadPayslip = (payroll) => {
    const content = `
PAYSLIP - ${format(new Date(payroll.month + '-01'), 'MMMM yyyy')}
Employee: ${employee.full_name}
Position: ${employee.job_title}

EARNINGS:
Basic Salary: ${payroll.basic_salary} SAR
${Object.entries(payroll.allowances || {}).map(([key, val]) => `${key}: ${val} SAR`).join('\n')}
Overtime: ${payroll.overtime_amount || 0} SAR
Total Earnings: ${payroll.total_earnings} SAR

DEDUCTIONS:
${Object.entries(payroll.deductions || {}).map(([key, val]) => `${key}: ${val} SAR`).join('\n')}
Total Deductions: ${payroll.total_deductions} SAR

NET SALARY: ${payroll.net_salary} SAR
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Payslip_${payroll.month}.txt`;
    a.click();
  };

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  const thisMonthAttendance = attendance.filter(a => {
    const d = new Date(a.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4 md:p-8">
      <motion.div 
        className="max-w-7xl mx-auto space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md rounded-full shadow-sm mb-4 border border-slate-200/60">
            <User className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-slate-700">Employee Self-Service</span>
          </div>
          
          <p className="text-lg text-slate-600">
            Manage your profile, view documents, and track your information
          </p>
        </motion.div>

        {employee.employment_status === 'DRAFT' && (
          <motion.div variants={itemVariants} className="bg-yellow-50/80 backdrop-blur-md border border-yellow-200/60 text-yellow-800 rounded-2xl p-4 mb-6 shadow-sm">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full inline-block"></span>
              Draft Status
            </h3>
            <p className="mt-1 text-sm">
              Your profile is currently in <strong>DRAFT</strong> status. To proceed to Pending Onboarding, please ensure you have provided your personal details (Phone, Private Email, Date of Birth, Gender, Marital Status, Nationality, National ID, Passport Number) below, and uploaded at least one required document in the Documents tab.
            </p>
          </motion.div>
        )}

        {employee.employment_status === 'PENDING_APPROVAL' && (
          <motion.div variants={itemVariants} className="bg-blue-50/80 backdrop-blur-md border border-blue-200/60 text-blue-800 rounded-2xl p-4 mb-6 shadow-sm">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full inline-block"></span>
              Awaiting HR Approval
            </h3>
            <p className="mt-1 text-sm">
              Your profile is complete and is currently awaiting review by an HR administrator. You will be notified once your profile data is approved and your onboarding officially begins.
            </p>
          </motion.div>
        )}

        {/* Quick Stats */}
        <motion.div variants={itemVariants} className="grid md:grid-cols-4 gap-6">
          <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
            <Card className="border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-indigo-100/50 rounded-xl flex items-center justify-center border border-indigo-200/50">
                    <Calendar className="w-6 h-6 text-indigo-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 mt-4">
                  {(employee.leave_balances?.annual_leave_total || 21) - (employee.leave_balances?.annual_leave_used || 0)}
                </p>
                <p className="text-sm text-slate-600 font-medium mt-1">Leave Days Remaining</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
            <Card className="border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-emerald-100/50 rounded-xl flex items-center justify-center border border-emerald-200/50">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 mt-4">
                  {thisMonthAttendance.filter(a => a.status === 'present').length}
                </p>
                <p className="text-sm text-slate-600 font-medium mt-1">Days Present This Month</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
            <Card className="border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-blue-100/50 rounded-xl flex items-center justify-center border border-blue-200/50">
                    <Laptop className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 mt-4">{assets.length}</p>
                <p className="text-sm text-slate-600 font-medium mt-1">Assigned Assets</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
            <Card className="border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-amber-100/50 rounded-xl flex items-center justify-center border border-amber-200/50">
                    <Receipt className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 mt-4">
                  {expenses.filter(e => e.status === 'pending').length}
                </p>
                <p className="text-sm text-slate-600 font-medium mt-1">Pending Expenses</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Main Content Tabs */}
        <motion.div variants={itemVariants}>
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-1 rounded-2xl">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              My Profile
            </TabsTrigger>
            <TabsTrigger value="payslips">
              <DollarSign className="w-4 h-4 mr-2" />
              Payslips
            </TabsTrigger>
            <TabsTrigger value="leave">
              <Plane className="w-4 h-4 mr-2" />
              Leave
            </TabsTrigger>
            <TabsTrigger value="attendance">
              <Clock className="w-4 h-4 mr-2" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="assets">
              <Laptop className="w-4 h-4 mr-2" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="expenses">
              <Receipt className="w-4 h-4 mr-2" />
              Expenses
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="w-4 h-4 mr-2" />
              Documents
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-200">
                <div className="flex justify-between items-center">
                  <CardTitle>Personal Information</CardTitle>
                  <Button
                    variant="outline"
                    isLoading={updateEmployeeMutation.isPending}
                    onClick={() => {
                      if (isEditing) {
                        handleSave();
                      } else {
                        setIsEditing(true);
                      }
                    }}
                  >
                    {isEditing ? (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {updateEmployeeMutation.isPending ? "Saving..." : "Save Changes"}
                      </>
                    ) : (
                      <>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Profile
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={employee.full_name} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={employee.email} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                    <Input
                      value={isEditing ? (editData.phone || '') : (employee.phone || '')}
                      onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Job Title</Label>
                    <Input value={employee.job_title} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input value={employee.department_id || 'Not assigned'} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input value={employee.start_date ? format(isNaN(Number(employee.start_date)) ? new Date(employee.start_date) : new Date(Number(employee.start_date)), 'MMM dd, yyyy') : ''} disabled />
                  </div>
                  {!isEditing && (
                    <>
                      <div className="space-y-2">
                        <Label>Private Email {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input value={employee.privateEmail || 'Not provided'} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Date of Birth {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input value={employee.dateOfBirth ? format(isNaN(Number(employee.dateOfBirth)) ? new Date(employee.dateOfBirth) : new Date(Number(employee.dateOfBirth)), 'MMM dd, yyyy') : 'Not provided'} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Gender {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input value={employee.gender || 'Not provided'} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Marital Status {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input value={employee.maritalStatus || 'Not provided'} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Nationality {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input value={employee.nationality || 'Not provided'} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>National ID {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input value={employee.nationalId || 'Not provided'} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Passport Number {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input value={employee.passportNumber || 'Not provided'} disabled />
                      </div>
                    </>
                  )}
                  {isEditing && (
                    <>
                      <div className="space-y-2">
                        <Label>Private Email {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input
                          type="email"
                          value={editData.privateEmail || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, privateEmail: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Date of Birth {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input
                          type="date"
                          value={editData.dateOfBirth ? (isNaN(Number(editData.dateOfBirth)) ? new Date(editData.dateOfBirth) : new Date(Number(editData.dateOfBirth))).toISOString().split('T')[0] : ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Gender {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input
                          value={editData.gender || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, gender: e.target.value }))}
                          placeholder="Male / Female / Other"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Marital Status {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input
                          value={editData.maritalStatus || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, maritalStatus: e.target.value }))}
                          placeholder="Single / Married"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nationality {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input
                          value={editData.nationality || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, nationality: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>National ID {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input
                          value={editData.nationalId || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, nationalId: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Passport Number {employee.employment_status === 'DRAFT' && <span className="text-red-500">*</span>}</Label>
                        <Input
                          value={editData.passportNumber || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, passportNumber: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payslips Tab */}
          <TabsContent value="payslips">
            <Card className="border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>My Payslips</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {payrolls.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500">No payslips available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payrolls.map(payroll => (
                      <div key={payroll.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {format(new Date(payroll.month + '-01'), 'MMMM yyyy')}
                          </p>
                          <p className="text-sm text-slate-600">
                            Net Salary: {payroll.net_salary.toLocaleString()} SAR
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={
                            payroll.status === 'paid' ? 'bg-green-100 text-green-700' :
                            payroll.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                          }>
                            {payroll.status}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadPayslip(payroll)}>
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leave Tab */}
          <TabsContent value="leave">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-200">
                  <CardTitle>Leave Balance</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-slate-600">Annual Leave</p>
                      <p className="text-3xl font-bold text-blue-700">
                        {(employee.leave_balances?.annual_leave_total || 21) - (employee.leave_balances?.annual_leave_used || 0)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {employee.leave_balances?.annual_leave_used || 0} used of {employee.leave_balances?.annual_leave_total || 21}
                      </p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-slate-600">Sick Leave</p>
                      <p className="text-3xl font-bold text-green-700">
                        {(employee.leave_balances?.sick_leave_total || 30) - (employee.leave_balances?.sick_leave_used || 0)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {employee.leave_balances?.sick_leave_used || 0} used of {employee.leave_balances?.sick_leave_total || 30}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-200">
                  <CardTitle>Leave History</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {leaveRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <Plane className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p className="text-slate-500">No leave requests</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leaveRequests.slice(0, 5).map(leave => (
                        <div key={leave.id} className="p-3 bg-slate-50 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-slate-900">{leave.leave_type.replace('_', ' ')}</p>
                              <p className="text-xs text-slate-500">
                                {format(new Date(leave.start_date), 'MMM d')} - {format(new Date(leave.end_date), 'MMM d')}
                              </p>
                            </div>
                            <Badge className={
                              leave.status === 'approved' ? 'bg-green-100 text-green-700' :
                              leave.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }>
                              {leave.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <Card className="border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>My Attendance - {format(new Date(), 'MMMM yyyy')}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <p className="text-3xl font-bold text-green-700">
                      {thisMonthAttendance.filter(a => a.status === 'present').length}
                    </p>
                    <p className="text-sm text-slate-600">Present</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg text-center">
                    <p className="text-3xl font-bold text-red-700">
                      {thisMonthAttendance.filter(a => a.status === 'absent').length}
                    </p>
                    <p className="text-sm text-slate-600">Absent</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg text-center">
                    <p className="text-3xl font-bold text-yellow-700">
                      {thisMonthAttendance.filter(a => a.status === 'late').length}
                    </p>
                    <p className="text-sm text-slate-600">Late</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <p className="text-3xl font-bold text-blue-700">
                      {thisMonthAttendance.filter(a => a.status === 'leave').length}
                    </p>
                    <p className="text-sm text-slate-600">On Leave</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets">
            <Card className="border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>Assigned Assets</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {assets.length === 0 ? (
                  <div className="text-center py-12">
                    <Laptop className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500">No assets assigned</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {assets.map(asset => (
                      <div key={asset.id} className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Laptop className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">{asset.asset_name}</p>
                            <p className="text-sm text-slate-600 capitalize">{asset.asset_type}</p>
                            {asset.serial_number && (
                              <p className="text-xs text-slate-500">S/N: {asset.serial_number}</p>
                            )}
                            <Badge className="mt-2">{asset.status}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses">
            <Card className="border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>My Expense Claims</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {expenses.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500">No expense claims</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expenses.map(expense => (
                      <div key={expense.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-semibold text-slate-900 capitalize">{expense.expense_type.replace('_', ' ')}</p>
                          <p className="text-sm text-slate-600">
                            {format(new Date(expense.date), 'MMM dd, yyyy')} • {expense.amount} SAR
                          </p>
                          <p className="text-xs text-slate-500">{expense.description}</p>
                        </div>
                        <Badge className={
                          expense.status === 'approved' ? 'bg-green-100 text-green-700' :
                          expense.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          expense.status === 'reimbursed' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>
                          {expense.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card className="border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-200 flex flex-row items-center justify-between">
                <CardTitle>My Documents</CardTitle>
                <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Document
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Document</DialogTitle>
                      <DialogDescription className="sr-only">Upload a document to your profile</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Document Name</Label>
                        <Input 
                          placeholder="e.g. Passport, Resume, Degree"
                          value={uploadData.name}
                          onChange={(e) => setUploadData(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Input 
                          placeholder="e.g. Identity, Educational, Financial"
                          value={uploadData.category}
                          onChange={(e) => setUploadData(prev => ({ ...prev, category: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>File</Label>
                        <Input 
                          type="file"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setUploadData(prev => ({ ...prev, file: e.target.files[0] }));
                            }
                          }}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancel</Button>
                      <Button 
                        isLoading={!uploadData.name || !uploadData.category || !uploadData.file || isUploadingToCloudinary || uploadDocumentMutation.isPending}
                        onClick={async () => {
                          try {
                            setIsUploadingToCloudinary(true);
                            const result = await uploadToCloudinary(uploadData.file);
                            
                            uploadDocumentMutation.mutate({
                              employeeId,
                              name: uploadData.name,
                              category: uploadData.category,
                              fileUrl: result.secure_url,
                              fileType: result.format || uploadData.file.name.split('.').pop(),
                              visibilityLevel: 'EMPLOYEE'
                            });
                          } catch (error) {
                            toast.error("Cloudinary upload failed: " + error.message);
                          } finally {
                            setIsUploadingToCloudinary(false);
                          }
                        }}
                      >
                        {(isUploadingToCloudinary || uploadDocumentMutation.isPending) ? "Uploading..." : "Upload"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-6">
                {documents.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500">No documents uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{doc.document_name}</p>
                            <p className="text-sm text-slate-500">{doc.category} • {doc.file_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge>{doc.status}</Badge>
                          {doc.file_url && (
                            <>
                              <Button size="sm" variant="outline" asChild>
                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" title="Preview">
                                  <Eye className="w-4 h-4" />
                                </a>
                              </Button>
                              <Button size="sm" variant="outline" asChild>
                                <a href={doc.file_url} download title="Download">
                                  <Download className="w-4 h-4" />
                                </a>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </motion.div>
      </motion.div>
    </div>
  );
}