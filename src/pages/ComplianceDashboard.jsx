import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, XCircle, Clock, Shield, Calendar, Users } from "lucide-react";
import { format } from "date-fns";

export default function ComplianceDashboard() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Mock user
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

  const { data: alerts = [] } = useQuery({
    queryKey: ['compliance-alerts'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['task-items'],
    queryFn: async () => [],
    initialData: [],
  });

  const updateAlertMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      console.log("Mock update alert", id, data);
      return { id, ...data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-alerts'] });
    },
  });

  const runComplianceScan = async () => {
    setIsScanning(true);
    
    const newAlerts = [];
    const today = new Date();

    // Check visa expiries
    for (const emp of employees) {
      if (emp.personal_info?.visa_expiry) {
        const expiryDate = new Date(emp.personal_info.visa_expiry);
        const daysUntil = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= 60 && daysUntil > 0) {
          newAlerts.push({
            organization_id: user.organization_id,
            alert_type: 'visa_expiry',
            severity: daysUntil <= 30 ? 'critical' : 'high',
            employee_id: emp.id,
            employee_name: emp.full_name,
            alert_message: `Visa expiring in ${daysUntil} days for ${emp.full_name}`,
            expiry_date: emp.personal_info.visa_expiry,
            days_until_expiry: daysUntil,
            status: 'active',
            ai_generated: true,
          });
        }
      }

      // Check iqama expiries
      if (emp.personal_info?.iqama_expiry) {
        const expiryDate = new Date(emp.personal_info.iqama_expiry);
        const daysUntil = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= 60 && daysUntil > 0) {
          newAlerts.push({
            organization_id: user.organization_id,
            alert_type: 'iqama_expiry',
            severity: daysUntil <= 30 ? 'critical' : 'high',
            employee_id: emp.id,
            employee_name: emp.full_name,
            alert_message: `Iqama expiring in ${daysUntil} days for ${emp.full_name}`,
            expiry_date: emp.personal_info.iqama_expiry,
            days_until_expiry: daysUntil,
            status: 'active',
            ai_generated: true,
          });
        }
      }

      // Check probation end dates
      if (emp.probation_end_date) {
        const probationEnd = new Date(emp.probation_end_date);
        const daysUntil = Math.ceil((probationEnd - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= 14 && daysUntil > 0) {
          newAlerts.push({
            organization_id: user.organization_id,
            alert_type: 'probation_review',
            severity: 'medium',
            employee_id: emp.id,
            employee_name: emp.full_name,
            alert_message: `Probation period ending in ${daysUntil} days for ${emp.full_name} - Review required`,
            expiry_date: emp.probation_end_date,
            days_until_expiry: daysUntil,
            status: 'active',
            ai_generated: true,
          });
        }
      }

      // Check contract renewals
      if (emp.contract_details?.contract_end_date) {
        const contractEnd = new Date(emp.contract_details.contract_end_date);
        const daysUntil = Math.ceil((contractEnd - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= 30 && daysUntil > 0) {
          newAlerts.push({
            organization_id: user.organization_id,
            alert_type: 'contract_renewal',
            severity: daysUntil <= 14 ? 'high' : 'medium',
            employee_id: emp.id,
            employee_name: emp.full_name,
            alert_message: `Contract expiring in ${daysUntil} days for ${emp.full_name}`,
            expiry_date: emp.contract_details.contract_end_date,
            days_until_expiry: daysUntil,
            status: 'active',
            ai_generated: true,
          });
        }
      }
    }

    // Check overdue tasks
    for (const task of tasks) {
      if (task.due_date && task.status !== 'done') {
        const dueDate = new Date(task.due_date);
        if (dueDate < today) {
          const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
          newAlerts.push({
            organization_id: user.organization_id,
            alert_type: 'overdue_task',
            severity: daysOverdue > 7 ? 'high' : 'medium',
            employee_id: task.assigned_to,
            employee_name: employees.find(e => e.email === task.assigned_to)?.full_name || 'Unknown',
            alert_message: `Task "${task.title}" is ${daysOverdue} days overdue`,
            expiry_date: task.due_date,
            days_until_expiry: -daysOverdue,
            status: 'active',
            ai_generated: true,
          });
        }
      }
    }

    // Create alerts
    for (const alert of newAlerts) {
      console.log("Mock create alert", alert);
    }

    queryClient.invalidateQueries({ queryKey: ['compliance-alerts'] });
    setIsScanning(false);
  };

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
  const highAlerts = activeAlerts.filter(a => a.severity === 'high');

  const severityConfig = {
    critical: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
    high: { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle },
    medium: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
    low: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle },
  };

  const handleAcknowledge = (alert) => {
    updateAlertMutation.mutate({
      id: alert.id,
      data: {
        status: 'acknowledged',
        acknowledged_by: user.email,
        acknowledged_date: new Date().toISOString(),
      }
    });
  };

  const handleResolve = (alert) => {
    updateAlertMutation.mutate({
      id: alert.id,
      data: {
        status: 'resolved',
        resolved_date: new Date().toISOString(),
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
              <Shield className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-slate-700">AI Compliance Monitor</span>
            </div>
            
            <p className="text-lg text-slate-600">AI-powered compliance monitoring and alerts</p>
          </div>
          <Button 
            onClick={runComplianceScan}
            disabled={isScanning}
            className="bg-gradient-to-r from-red-600 to-orange-600"
          >
            {isScanning ? 'Scanning...' : 'Run AI Scan'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 mt-4">{criticalAlerts.length}</p>
              <p className="text-sm text-slate-600">Critical Alerts</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 mt-4">{highAlerts.length}</p>
              <p className="text-sm text-slate-600">High Priority</p>
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
                {alerts.filter(a => a.status === 'resolved').length}
              </p>
              <p className="text-sm text-slate-600">Resolved</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 mt-4">{activeAlerts.length}</p>
              <p className="text-sm text-slate-600">Active Alerts</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts List */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle>Compliance Alerts</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {activeAlerts.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">All Clear!</h3>
                <p className="text-slate-500">No compliance issues detected</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeAlerts.map(alert => {
                  const config = severityConfig[alert.severity];
                  const Icon = config.icon;
                  
                  return (
                    <div key={alert.id} className={`p-4 rounded-lg border ${config.color}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex gap-3 flex-1">
                          <Icon className="w-5 h-5 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-semibold text-slate-900">{alert.alert_message}</p>
                              <Badge variant="outline" className={config.color}>
                                {alert.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">
                              Employee: {alert.employee_name}
                            </p>
                            {alert.expiry_date && (
                              <p className="text-xs text-slate-500">
                                Due Date: {format(new Date(alert.expiry_date), 'MMM dd, yyyy')}
                                {alert.days_until_expiry > 0 && ` (${alert.days_until_expiry} days)`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleAcknowledge(alert)}
                          >
                            Acknowledge
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleResolve(alert)}
                          >
                            Resolve
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

        {/* Alert Categories */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="text-base">Visa/Iqama Expiries</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-3xl font-bold text-slate-900">
                {alerts.filter(a => a.alert_type === 'visa_expiry' || a.alert_type === 'iqama_expiry').length}
              </p>
              <p className="text-sm text-slate-600 mt-1">Expiring documents</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="text-base">Contract Reviews</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-3xl font-bold text-slate-900">
                {alerts.filter(a => a.alert_type === 'probation_review' || a.alert_type === 'contract_renewal').length}
              </p>
              <p className="text-sm text-slate-600 mt-1">Reviews needed</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="text-base">Overdue Tasks</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-3xl font-bold text-slate-900">
                {alerts.filter(a => a.alert_type === 'overdue_task').length}
              </p>
              <p className="text-sm text-slate-600 mt-1">Tasks delayed</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}