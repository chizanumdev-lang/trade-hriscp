import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/api/graphqlClient';
import { gql } from 'graphql-request';
import { format } from 'date-fns';
import { Shield, Search, Filter, Monitor, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AuditLogDetailsModal } from '@/components/AuditLogDetailsModal';

const GET_AUDIT_LOGS = gql`
  query GetAuditLogs($entityType: String, $action: String, $limit: Int) {
    auditLogs(entityType: $entityType, action: $action, limit: $limit) {
      id
      actor {
        email
        role
        employee {
          fullName
          phone
        }
      }
      entityType
      entityId
      action
      previousValue
      newValue
      details
      ipAddress
      location
      createdAt
    }
  }
`;

export default function AuditLogs() {
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const { data: { auditLogs = [] } = {}, isLoading } = useQuery({
    queryKey: ['auditLogs', entityTypeFilter, actionFilter],
    queryFn: () => gqlClient.request(GET_AUDIT_LOGS, {
      entityType: entityTypeFilter || null,
      action: actionFilter || null,
      limit: 100
    }),
  });

  const formatAction = (action, entityType) => {
    if (!action) return 'Unknown Action';
    const formattedAction = action.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    
    if (['Create', 'Update', 'Delete'].includes(formattedAction) && entityType) {
      const cleanEntity = entityType.replace(/([A-Z])/g, ' $1').trim();
      return `${formattedAction} ${cleanEntity}`;
    }
    
    return formattedAction;
  };

  const renderChanges = (log) => {
    try {
      const prev = log.previousValue ? JSON.parse(log.previousValue) : null;
      const next = log.newValue ? JSON.parse(log.newValue) : null;
      
      if (!prev && !next) return <span className="text-slate-400 italic">No details</span>;

      // Extract specific fields if it's an employee status update or leave etc
      if (log.action === 'UPDATE_STATUS' || log.action === 'APPROVED' || log.action === 'REJECTED') {
        const prevStatus = prev?.status || prev?.employmentStatus || 'Unknown';
        const nextStatus = next?.status || next?.employmentStatus || 'Unknown';
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 line-through">{prevStatus}</span>
            <span className="text-xs text-slate-400">→</span>
            <span className="text-xs font-semibold text-indigo-700">{nextStatus}</span>
          </div>
        );
      }

      if (log.action === 'CREATED' && log.entityType === 'SalaryHistory') {
        return (
          <div className="text-xs">
            <span className="text-slate-500">Old Basic: </span><span className="line-through">{prev?.basicSalary}</span>
            <br/>
            <span className="font-semibold text-green-700">New Basic: {next?.basicSalary}</span>
          </div>
        );
      }

      // Generic fallback
      return (
        <div className="text-xs text-slate-500 truncate max-w-[200px]" title={log.newValue}>
          {log.newValue ? "Data updated" : "Metadata logged"}
        </div>
      );
    } catch (e) {
      return <span className="text-slate-400 italic">Unparseable</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          
          <p className="text-slate-500 mt-1">Platform-wide historical tracking and compliance records.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Filter by Entity Type (e.g. Employee, PayrollRun)" 
            className="pl-9 bg-slate-50"
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
          />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Filter by Action (e.g. UPDATE, APPROVED)" 
            className="pl-9 bg-slate-50"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => { setEntityTypeFilter(''); setActionFilter(''); }}>
          Reset Filters
        </Button>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Actor</th>
                <th className="px-6 py-4">Entity</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Changes</th>
                <th className="px-6 py-4">Device / IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">Loading audit logs...</td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    <Shield className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p>No audit logs match your filters.</p>
                  </td>
                </tr>
              ) : (
                auditLogs.map(log => {
                  const actorName = log.actor?.employee ? log.actor.employee.fullName : (log.actor?.email || 'System');
                  return (
                  <tr 
                    key={log.id} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-6 py-3">
                      <div className="text-slate-900 font-medium">
                        {format(new Date(parseInt(log.createdAt)), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-slate-500">
                        {format(new Date(parseInt(log.createdAt)), 'h:mm:ss a')}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-slate-900 font-medium">{actorName}</div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{log.actor?.role || 'SYSTEM'}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-indigo-700 font-semibold">{log.entityType}</div>
                      <div className="text-[10px] text-slate-400 font-mono" title={log.entityId}>
                        {log.entityId.split('-')[0]}...
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold uppercase tracking-wider">
                        {formatAction(log.action, log.entityType)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {renderChanges(log)}
                    </td>
                    <td className="px-6 py-3">
                      {log.ipAddress ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                            <Monitor className="w-3 h-3 text-slate-400" />
                            {log.ipAddress}
                          </div>
                          {log.location && <div className="text-[10px] text-slate-400">{log.location}</div>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not tracked</span>
                      )}
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <AuditLogDetailsModal 
        isOpen={!!selectedLog} 
        onClose={() => setSelectedLog(null)} 
        log={selectedLog} 
      />
    </div>
  );
}
