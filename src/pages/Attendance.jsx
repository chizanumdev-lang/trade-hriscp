
import React, { useState } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Upload, Settings, Users, Smartphone, Printer, Download, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import AttendanceRecords from "../components/attendance/AttendanceRecords";
import BulkAttendanceImport from "../components/attendance/BulkAttendanceImport";
import ZKTecoSettings from "../components/attendance/ZKTecoSettings";
import ZKTecoDeviceManager from "../components/attendance/ZKTecoDeviceManager";
import AttendanceSummary from "../components/attendance/AttendanceSummary";

export default function Attendance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showDeviceManager, setShowDeviceManager] = useState(false);
  const [reportType, setReportType] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['attendance'],
    queryFn: async () => {
      const ATT_QUERY = gql`
        query { attendanceRecords { id employeeId date clockIn clockOut status } }
      `;
      const data = await gqlClient.request(ATT_QUERY);
      return (data.attendanceRecords || []).map(a => ({
        ...a,
        employee_id: a.employeeId,
        check_in: a.clockIn,
        check_out: a.clockOut,
        employee_name: a.employeeId // mocked name
      }));
    },
    initialData: [],
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const EMP_QUERY = gql`query { employees { id fullName email jobTitle } }`;
      const data = await gqlClient.request(EMP_QUERY);
      return (data.employees || []).map(e => ({ ...e, full_name: e.fullName }));
    },
    initialData: [],
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: myTodayRecord } = useQuery({
    queryKey: ['attendance-today', user?.email],
    queryFn: async () => {
      const GET_MY_ATTENDANCE = gql`
        query GetMyAttendance($date: String!) {
          attendanceRecords(date: $date) {
            id
            employeeId
            date
            clockIn
            clockOut
            status
          }
        }
      `;
      // We pass today's date formatted as YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];
      const data = await gqlClient.request(GET_MY_ATTENDANCE, { date: today });
      // Find the record for the current user
      const record = (data.attendanceRecords || []).find(r => r.employeeId === user?.email);
      return record || null;
    },
    enabled: !!user?.email
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      const CLOCK_IN = gql`
        mutation ClockIn {
          clockIn {
            id
            clockIn
            status
          }
        }
      `;
      return await gqlClient.request(CLOCK_IN);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
    }
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!myTodayRecord?.id) return;
      const CLOCK_OUT = gql`
        mutation ClockOut {
          clockOut {
            id
            clockOut
            status
          }
        }
      `;
      return await gqlClient.request(CLOCK_OUT);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
    }
  });

  const currentSettings = settings[0] || {
    work_start_time: "09:00",
    work_end_time: "17:00",
    late_threshold_minutes: 15,
    zkteco_enabled: false,
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportPDF = () => {
    alert('PDF export coming soon');
  };

  const handleExportExcel = () => {
    let data = attendanceRecords;
    
    if (reportType === 'employee' && selectedEmployee) {
      data = attendanceRecords.filter(r => r.employee_id === selectedEmployee);
    } else if (reportType === 'department' && selectedDepartment) {
      const deptEmployees = employees.filter(e => e.department_id === selectedDepartment).map(e => e.id);
      data = attendanceRecords.filter(r => deptEmployees.includes(r.employee_id));
    }
    
    const csvData = data.map(record => 
      `${record.employee_name},${format(new Date(record.date), 'yyyy-MM-dd')},${record.status},${record.check_in || ''},${record.check_out || ''}`
    ).join('\n');
    
    const blob = new Blob([`Employee,Date,Status,Check In,Check Out\n${csvData}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const departments = [...new Set(employees.map(e => e.department_id).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-slate-700">Attendance Management</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">
              Staff Attendance
            </h1>
            <p className="text-lg text-slate-600">
              Track and manage employee attendance records
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
              <Button 
                onClick={() => clockInMutation.mutate()} 
                disabled={!!myTodayRecord?.clockIn || clockInMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {myTodayRecord?.clockIn ? `Clocked In at ${myTodayRecord.clockIn}` : 'Clock In'}
              </Button>
              <Button 
                onClick={() => clockOutMutation.mutate()} 
                disabled={!myTodayRecord?.clockIn || !!myTodayRecord?.clockOut || clockOutMutation.isPending}
                variant={myTodayRecord?.clockOut ? "outline" : "destructive"}
              >
                {myTodayRecord?.clockOut ? `Clocked Out at ${myTodayRecord.clockOut}` : 'Clock Out'}
              </Button>
            </div>
            <div className="flex gap-3 flex-wrap">
            <Button size="sm" variant="outline" onClick={handlePrintReport}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportPDF}>
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button 
              onClick={() => setShowDeviceManager(true)}
              variant="outline"
              className="border-cyan-300 text-cyan-700 hover:bg-cyan-50"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Devices
            </Button>
            <Button 
              onClick={() => setShowSettingsDialog(true)}
              variant="outline"
              className="border-slate-300"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button 
              onClick={() => setShowImportDialog(true)}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Attendance
            </Button>
            </div>
          </div>
        </div>

        {/* Report Options */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              <Label>Report Type:</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff Report</SelectItem>
                  <SelectItem value="employee">Individual Employee</SelectItem>
                  <SelectItem value="department">Department Report</SelectItem>
                </SelectContent>
              </Select>
              
              {reportType === 'employee' && (
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {reportType === 'department' && (
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        <AttendanceSummary 
          attendanceRecords={attendanceRecords}
          employees={employees}
        />

        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Employee Summary
            </TabsTrigger>
            <TabsTrigger value="records" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Records
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {employees.map(emp => {
                    const empAttendance = attendanceRecords.filter(r => r.employee_id === emp.id);
                    const thisMonth = empAttendance.filter(r => {
                      const d = new Date(r.date);
                      const now = new Date();
                      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    });
                    const present = thisMonth.filter(r => r.status === 'present' || r.status === 'remote').length;
                    const absent = thisMonth.filter(r => r.status === 'absent').length;
                    const late = thisMonth.filter(r => r.status === 'late').length;

                    return (
                      <div key={emp.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-700 font-semibold">
                              {emp.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{emp.full_name}</p>
                            <p className="text-sm text-slate-500">{emp.job_title}</p>
                          </div>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{present}</p>
                            <p className="text-xs text-slate-500">Present</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-red-600">{absent}</p>
                            <p className="text-xs text-slate-500">Absent</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-yellow-600">{late}</p>
                            <p className="text-xs text-slate-500">Late</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="records">
            <AttendanceRecords 
              attendanceRecords={attendanceRecords}
              employees={employees}
              settings={currentSettings}
            />
          </TabsContent>
        </Tabs>

        <BulkAttendanceImport
          open={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          employees={employees}
        />

        <ZKTecoSettings
          open={showSettingsDialog}
          onClose={() => setShowSettingsDialog(false)}
          currentSettings={currentSettings}
        />

        <ZKTecoDeviceManager
          open={showDeviceManager}
          onClose={() => setShowDeviceManager(false)}
        />
      </div>
    </div>
  );
}
