import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Building2, CreditCard, Save, Edit } from "lucide-react";

export default function PayrollDetails({ employee, onUpdate, isUpdating }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    basic_salary: employee.payroll_details?.basic_salary || '',
    bank_name: employee.payroll_details?.bank_name || '',
    account_number: employee.payroll_details?.account_number || '',
    iban: employee.payroll_details?.iban || '',
    tax_number: employee.payroll_details?.tax_number || '',
    social_insurance_number: employee.payroll_details?.social_insurance_number || '',
    allowances: {
      housing: employee.payroll_details?.allowances?.housing || 0,
      transport: employee.payroll_details?.allowances?.transport || 0,
      food: employee.payroll_details?.allowances?.food || 0,
      other: employee.payroll_details?.allowances?.other || 0,
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate({ payroll_details: formData });
    setIsEditing(false);
  };

  const totalAllowances = Object.values(formData.allowances).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  const totalCompensation = (parseFloat(formData.basic_salary) || 0) + totalAllowances;

  if (!isEditing) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Payroll Details
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {!employee.payroll_details?.basic_salary ? (
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500 mb-4">No payroll information added yet</p>
              <Button onClick={() => setIsEditing(true)}>
                <DollarSign className="w-4 h-4 mr-2" />
                Add Payroll Details
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Salary Information */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Salary Information</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-slate-600 mb-1">Basic Salary</p>
                    <p className="text-2xl font-bold text-green-700">
                      {parseFloat(employee.payroll_details.basic_salary).toLocaleString()} SAR
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-slate-600 mb-1">Total Compensation</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {(parseFloat(employee.payroll_details.basic_salary) + 
                        Object.values(employee.payroll_details.allowances || {}).reduce((sum, val) => sum + (val || 0), 0)
                      ).toLocaleString()} SAR
                    </p>
                  </div>
                </div>
              </div>

              {/* Allowances */}
              {employee.payroll_details.allowances && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Allowances</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    {employee.payroll_details.allowances.housing > 0 && (
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">Housing</span>
                        <span className="font-medium">{employee.payroll_details.allowances.housing} SAR</span>
                      </div>
                    )}
                    {employee.payroll_details.allowances.transport > 0 && (
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">Transport</span>
                        <span className="font-medium">{employee.payroll_details.allowances.transport} SAR</span>
                      </div>
                    )}
                    {employee.payroll_details.allowances.food > 0 && (
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">Food</span>
                        <span className="font-medium">{employee.payroll_details.allowances.food} SAR</span>
                      </div>
                    )}
                    {employee.payroll_details.allowances.other > 0 && (
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">Other</span>
                        <span className="font-medium">{employee.payroll_details.allowances.other} SAR</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Banking Information */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Banking Information
                </h4>
                <div className="space-y-3">
                  {employee.payroll_details.bank_name && (
                    <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Bank Name</span>
                      <span className="font-medium">{employee.payroll_details.bank_name}</span>
                    </div>
                  )}
                  {employee.payroll_details.account_number && (
                    <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Account Number</span>
                      <span className="font-medium font-mono">{employee.payroll_details.account_number}</span>
                    </div>
                  )}
                  {employee.payroll_details.iban && (
                    <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">IBAN</span>
                      <span className="font-medium font-mono">{employee.payroll_details.iban}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tax & Insurance */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Tax & Insurance
                </h4>
                <div className="space-y-3">
                  {employee.payroll_details.tax_number && (
                    <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Tax Number</span>
                      <span className="font-medium font-mono">{employee.payroll_details.tax_number}</span>
                    </div>
                  )}
                  {employee.payroll_details.social_insurance_number && (
                    <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Social Insurance Number</span>
                      <span className="font-medium font-mono">{employee.payroll_details.social_insurance_number}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="border-b border-slate-200 bg-slate-50">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Edit Payroll Details
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Salary Information */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900">Salary Information</h4>
            <div className="space-y-2">
              <Label htmlFor="basic_salary">Basic Salary (SAR) *</Label>
              <Input
                id="basic_salary"
                type="number"
                step="0.01"
                value={formData.basic_salary}
                onChange={(e) => setFormData(prev => ({ ...prev, basic_salary: e.target.value }))}
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="housing">Housing Allowance (SAR)</Label>
                <Input
                  id="housing"
                  type="number"
                  step="0.01"
                  value={formData.allowances.housing}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    allowances: { ...prev.allowances, housing: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transport">Transport Allowance (SAR)</Label>
                <Input
                  id="transport"
                  type="number"
                  step="0.01"
                  value={formData.allowances.transport}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    allowances: { ...prev.allowances, transport: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="food">Food Allowance (SAR)</Label>
                <Input
                  id="food"
                  type="number"
                  step="0.01"
                  value={formData.allowances.food}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    allowances: { ...prev.allowances, food: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="other">Other Allowance (SAR)</Label>
                <Input
                  id="other"
                  type="number"
                  step="0.01"
                  value={formData.allowances.other}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    allowances: { ...prev.allowances, other: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-700">Total Monthly Compensation</span>
                <span className="text-2xl font-bold text-blue-700">
                  {totalCompensation.toLocaleString()} SAR
                </span>
              </div>
            </div>
          </div>

          {/* Banking Information */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900">Banking Information</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                  placeholder="e.g., Al Rajhi Bank"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  value={formData.account_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                value={formData.iban}
                onChange={(e) => setFormData(prev => ({ ...prev, iban: e.target.value }))}
                placeholder="SA00 0000 0000 0000 0000 0000"
              />
            </div>
          </div>

          {/* Tax & Insurance */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900">Tax & Insurance</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax_number">Tax Number</Label>
                <Input
                  id="tax_number"
                  value={formData.tax_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, tax_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="social_insurance_number">Social Insurance Number</Label>
                <Input
                  id="social_insurance_number"
                  value={formData.social_insurance_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, social_insurance_number: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isUpdating}>
              <Save className="w-4 h-4 mr-2" />
              {isUpdating ? 'Saving...' : 'Save Payroll Details'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}