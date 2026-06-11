import React from "react";
import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
          <SettingsIcon className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-slate-700">System Settings</span>
        </div>
        
        <p className="text-lg text-slate-600">Please select a settings category from the sidebar.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <SettingsIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-800 mb-2">General Settings</h3>
        <p className="text-slate-500 max-w-md mx-auto">
          Navigate through the sidebar to configure Approval Workflows, Work Shifts, Departments, and view Audit Logs.
        </p>
      </div>
    </div>
  );
}