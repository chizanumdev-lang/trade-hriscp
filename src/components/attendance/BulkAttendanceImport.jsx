
// @ts-nocheck
import React, { useState } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Download, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function BulkAttendanceImport({ open, onClose, employees }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [errors, setErrors] = useState([]);
  const [processing, setProcessing] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setParsedData(null);
      setErrors([]);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `employee_id,employee_name,date,check_in,check_out,status,hours_worked,overtime_hours,notes
emp_001,John Doe,2024-01-15,09:00,17:30,present,8.5,0.5,
emp_002,Jane Smith,2024-01-15,09:15,17:00,late,7.75,0,Arrived 15 min late
emp_003,Bob Johnson,2024-01-15,,,absent,0,0,Sick leave`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'eonhr_attendance_import_template.csv'; // Changed filename here
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const validateRecord = (record, index) => {
    const rowErrors = [];
    
    if (!record.employee_id || record.employee_id.trim() === '') {
      rowErrors.push(`Row ${index + 1}: Employee ID is required`);
    }
    
    if (!record.date || record.date.trim() === '') {
      rowErrors.push(`Row ${index + 1}: Date is required`);
    }
    
    if (!record.status) {
      rowErrors.push(`Row ${index + 1}: Status is required`);
    }
    
    return rowErrors;
  };

  const handleProcessFile = async () => {
    if (!file) return;

    setProcessing(true);
    setErrors([]);

    try {
      const file_url = URL.createObjectURL(file);

      const result = {
        status: "success",
        output: {
          records: [
            {
              employee_id: "emp_1",
              employee_name: "Mock Employee",
              date: "2024-01-15",
              check_in: "09:00",
              check_out: "17:00",
              status: "present",
              hours_worked: 8,
              overtime_hours: 0,
              notes: "Mock data"
            }
          ]
        }
      };

      if (result.status === "success" && result.output?.records) {
        const records = result.output.records;
        
        const allErrors = [];
        records.forEach((record, index) => {
          const recordErrors = validateRecord(record, index);
          allErrors.push(...recordErrors);
        });

        if (allErrors.length > 0) {
          setErrors(allErrors);
        } else {
          const processedRecords = records.map(rec => ({
            ...rec,
            sync_source: 'csv',
            hours_worked: rec.hours_worked || 0,
            overtime_hours: rec.overtime_hours || 0,
          }));
          
          setParsedData(processedRecords);
        }
      } else {
        setErrors(['Failed to parse CSV file. Please check the format.']);
      }
    } catch (error) {
      console.error("Error processing file:", error);
      setErrors([`Error processing file: ${error.message}`]);
    }

    setProcessing(false);
  };

  const importMutation = useMutation({
    mutationFn: async (records) => {
      console.log("Mock import attendance records", records);
      return records.map((record, index) => ({
        ...record,
        id: `att_${Date.now()}_${index}`,
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      handleClose();
    },
  });

  const handleImport = () => {
    if (parsedData && parsedData.length > 0) {
      importMutation.mutate(parsedData);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData(null);
    setErrors([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            Import Attendance Records
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">How to import attendance:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Download the CSV template</li>
                  <li>Fill in attendance data (required: employee_id, date, status)</li>
                  <li>Upload the completed CSV file</li>
                  <li>Review and import</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>

          <Button onClick={downloadTemplate} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Download CSV Template
          </Button>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors">
              <input
                type="file"
                id="csv-file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="csv-file" className="cursor-pointer">
                <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="text-lg font-medium text-slate-700 mb-2">
                  {file ? file.name : 'Click to upload CSV file'}
                </p>
                <p className="text-sm text-slate-500">
                  or drag and drop your CSV file here
                </p>
              </label>
            </div>

            {file && !parsedData && (
              <Button 
                onClick={handleProcessFile} 
                disabled={processing}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Process File
                  </>
                )}
              </Button>
            )}
          </div>

          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Validation Errors:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {parsedData && parsedData.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  Preview ({parsedData.length} record{parsedData.length !== 1 ? 's' : ''})
                </h3>
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Ready to Import
                </Badge>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0">
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.map((record, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{record.employee_name || record.employee_id}</TableCell>
                          <TableCell>{record.date}</TableCell>
                          <TableCell>{record.check_in || '--'}</TableCell>
                          <TableCell>{record.check_out || '--'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{record.status}</Badge>
                          </TableCell>
                          <TableCell>{record.hours_worked || 0}h</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="outline" onClick={handleClose} disabled={importMutation.isPending}>
              Cancel
            </Button>
            {parsedData && parsedData.length > 0 && (
              <Button 
                onClick={handleImport}
                disabled={importMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import {parsedData.length} Record{parsedData.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
