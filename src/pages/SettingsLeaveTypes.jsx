import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { gql } from 'graphql-request';
import { gqlClient } from '@/api/graphqlClient';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { Plus, Briefcase, Trash2, Edit } from 'lucide-react';
import { motion } from 'framer-motion';

const GET_LEAVE_TYPES = gql`
  query GetLeaveTypes {
    leaveTypes {
      id
      name
      daysPerYear
      isPaid
      requiresApproval
      eligibleAfterDays
    }
  }
`;

const CREATE_LEAVE_TYPE = gql`
  mutation CreateLeaveType($name: String!, $daysPerYear: Float!, $isPaid: Boolean!, $requiresApproval: Boolean!, $eligibleAfterDays: Int) {
    createLeaveType(name: $name, daysPerYear: $daysPerYear, isPaid: $isPaid, requiresApproval: $requiresApproval, eligibleAfterDays: $eligibleAfterDays) {
      id
      name
    }
  }
`;

export default function SettingsLeaveTypes() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    daysPerYear: 10,
    isPaid: true,
    requiresApproval: true,
    eligibleAfterDays: 0
  });

  const { data, isLoading } = useQuery({
    queryKey: ['leaveTypes'],
    queryFn: () => gqlClient.request(GET_LEAVE_TYPES)
  });

  const { mutate: createLeaveType, isPending } = useMutation({
    mutationFn: (variables) => gqlClient.request(CREATE_LEAVE_TYPE, variables),
    onSuccess: () => {
      toast.success("Leave Type created successfully!");
      queryClient.invalidateQueries(['leaveTypes']);
      setIsAdding(false);
      setFormData({ name: '', daysPerYear: 10, isPaid: true, requiresApproval: true, eligibleAfterDays: 0 });
    },
    onError: (err) => {
      toast.error(err.response?.errors?.[0]?.message || err.message || "Failed to create leave type.");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Name is required");
    createLeaveType({
      ...formData,
      daysPerYear: parseFloat(formData.daysPerYear),
      eligibleAfterDays: parseInt(formData.eligibleAfterDays, 10)
    });
  };

  const leaveTypes = data?.leaveTypes || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Leave Types</h2>
        <p className="text-slate-500 mt-1">Configure available leave categories, quotas, and rules.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <Card><CardContent className="p-8 text-center text-slate-500">Loading leave types...</CardContent></Card>
          ) : leaveTypes.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-slate-500">No leave types configured yet.</CardContent></Card>
          ) : (
            leaveTypes.map(lt => (
              <motion.div key={lt.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900">{lt.name}</h4>
                      <p className="text-sm text-slate-500 mt-1">
                        {lt.daysPerYear} days/year • {lt.isPaid ? 'Paid' : 'Unpaid'} • {lt.requiresApproval ? 'Requires Approval' : 'Auto-Approve'}
                        {lt.eligibleAfterDays > 0 && ` • Eligible after ${lt.eligibleAfterDays} days`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        <div>
          {isAdding ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Leave Type</CardTitle>
                <CardDescription>Create a new leave category</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Name (e.g. Annual, Sick)</label>
                    <Input 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="Annual Leave"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Days Per Year</label>
                    <Input 
                      type="number"
                      value={formData.daysPerYear}
                      onChange={e => setFormData({...formData, daysPerYear: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Eligible After (Days of Service)</label>
                    <Input 
                      type="number"
                      value={formData.eligibleAfterDays}
                      onChange={e => setFormData({...formData, eligibleAfterDays: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <label className="text-sm font-medium text-slate-700">Is Paid Leave?</label>
                    <Switch 
                      checked={formData.isPaid}
                      onCheckedChange={c => setFormData({...formData, isPaid: c})}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <label className="text-sm font-medium text-slate-700">Requires Approval?</label>
                    <Switch 
                      checked={formData.requiresApproval}
                      onCheckedChange={c => setFormData({...formData, requiresApproval: c})}
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAdding(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1" disabled={isPending}>Save</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Button onClick={() => setIsAdding(true)} className="w-full flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Leave Type
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
