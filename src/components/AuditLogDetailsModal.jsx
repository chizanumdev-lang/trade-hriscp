import React from 'react';
import { format } from 'date-fns';
import { Shield, MapPin, Monitor, Clock, User, Fingerprint, Info, CheckCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function AuditLogDetailsModal({ isOpen, onClose, log }) {
  if (!log) return null;

  const employee = log.actor?.employee;
  const actorName = employee ? employee.fullName : (log.actor?.email || 'System');
  const actorPhone = employee?.phone || 'Not provided';
  const role = log.actor?.role || 'SYSTEM';

  let detailsObj = null;
  if (log.details) {
    try {
      detailsObj = JSON.parse(log.details);
    } catch (e) {
      detailsObj = { message: log.details };
    }
  }

  const formatAction = (action, entityType) => {
    if (!action) return 'Unknown Action';
    const formattedAction = action.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    
    // If the action is just a simple verb, append the entity type for clarity (e.g. "Create Employee")
    if (['Create', 'Update', 'Delete'].includes(formattedAction) && entityType) {
      // Clean up entityType format (e.g. LeaveRequest -> Leave Request)
      const cleanEntity = entityType.replace(/([A-Z])/g, ' $1').trim();
      return `${formattedAction} ${cleanEntity}`;
    }
    
    return formattedAction;
  };

  const renderPayload = (payloadString) => {
    if (!payloadString) return null;
    try {
      let parsed = JSON.parse(payloadString);
      
      // If it's doubly stringified, try parsing again
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch (e) {
          // If it fails, it's just a normal string
        }
      }

      // If it's an object/array, render it nicely
      if (typeof parsed === 'object' && parsed !== null) {
        return (
          <div className="space-y-1 mt-1">
            {Object.entries(parsed).map(([key, value]) => (
              <div key={key} className="flex text-[11px] leading-tight">
                <span className="font-semibold text-slate-600 min-w-[120px] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                <span className="text-slate-800 break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
              </div>
            ))}
          </div>
        );
      }
      
      // If it's a primitive (like a string or number), render directly
      return <div className="text-[11px] text-slate-800 mt-1">{String(parsed)}</div>;
    } catch (e) {
      return <div className="text-[11px] text-slate-800 mt-1">{payloadString}</div>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Audit Log Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          
          {/* Top summary row */}
          <div className="flex flex-wrap gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex-1 min-w-[150px]">
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Timestamp</div>
              <div className="font-semibold text-slate-900">{format(new Date(parseInt(log.createdAt)), 'MMM d, yyyy h:mm:ss a')}</div>
            </div>
            <div className="flex-1 min-w-[150px]">
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Fingerprint className="w-3 h-3"/> Action</div>
              <div className="font-semibold text-indigo-700 bg-indigo-50 inline-block px-2 py-0.5 rounded text-sm">{formatAction(log.action, log.entityType)}</div>
            </div>
            <div className="flex-1 min-w-[150px]">
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Info className="w-3 h-3"/> Entity Type</div>
              <div className="font-semibold text-slate-900">{log.entityType} <span className="text-slate-400 font-normal text-xs">({log.entityId.substring(0, 8)}...)</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Actor Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b pb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                Actor Information
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-slate-500 block text-xs">Name</span>
                  <span className="font-medium text-slate-900">{actorName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Email</span>
                  <span className="text-slate-900">{log.actor?.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Phone</span>
                  <span className="text-slate-900">{actorPhone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Role</span>
                  <span className="inline-flex px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-700">{role}</span>
                </div>
              </div>
            </div>

            {/* Network Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b pb-2 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-slate-500" />
                Network & Location
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-slate-500 block text-xs">IP Address</span>
                  <span className="font-medium font-mono text-slate-900">{log.ipAddress || 'Not tracked'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs flex items-center gap-1">Location</span>
                  <span className="text-slate-900 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" /> 
                    {log.location || (log.ipAddress === '127.0.0.1' || log.ipAddress === '::1' ? 'Localhost (Development)' : 'Unknown')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Extra Details / Payloads */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-500" />
              Event Payload & Status
            </h3>
            
            {detailsObj && (
               <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm">
                 {detailsObj.message && <p className="mb-3 text-slate-700 font-medium">{detailsObj.message}</p>}
                 {detailsObj.approved !== undefined && (
                   <p className="flex items-center gap-2 mb-3 font-medium">
                     Status: 
                     {detailsObj.approved ? <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4"/> Approved</span> : <span className="text-red-600 flex items-center gap-1"><XCircle className="w-4 h-4"/> Rejected</span>}
                   </p>
                 )}
                 {Object.keys(detailsObj).length > 0 && !detailsObj.message && !detailsObj.approved && (
                   <div className="space-y-1">
                     {Object.entries(detailsObj).map(([key, value]) => (
                       <div key={key} className="flex text-xs leading-relaxed">
                         <span className="font-semibold text-slate-600 min-w-[140px] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                         <span className="text-slate-800 font-medium">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
            )}
            
            {!detailsObj && !log.previousValue && !log.newValue && (
              <p className="text-sm text-slate-500 italic">No additional metadata attached to this event.</p>
            )}

            {(log.previousValue || log.newValue) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {log.previousValue && (
                  <div className="bg-rose-50/50 p-4 rounded-lg border border-rose-100">
                    <span className="text-xs font-semibold text-rose-700 mb-2 block uppercase tracking-wider">Previous State</span>
                    <div className="overflow-auto max-h-[200px] custom-scrollbar">
                      {renderPayload(log.previousValue)}
                    </div>
                  </div>
                )}
                {log.newValue && (
                  <div className="bg-green-50/50 p-4 rounded-lg border border-green-100">
                    <span className="text-xs font-semibold text-green-700 mb-2 block uppercase tracking-wider">New State</span>
                    <div className="overflow-auto max-h-[200px] custom-scrollbar">
                      {renderPayload(log.newValue)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
