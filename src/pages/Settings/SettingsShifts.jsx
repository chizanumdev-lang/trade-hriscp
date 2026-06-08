import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Edit, Trash2 } from "lucide-react";

const GET_SHIFTS = gql`
  query GetShifts {
    shifts {
      id
      name
      startTime
      endTime
      breakMinutes
      isActive
    }
  }
`;

const CREATE_SHIFT = gql`
  mutation CreateShift($name: String!, $startTime: String!, $endTime: String!, $breakMinutes: Int) {
    createShift(name: $name, startTime: $startTime, endTime: $endTime, breakMinutes: $breakMinutes) {
      id
    }
  }
`;

const UPDATE_SHIFT = gql`
  mutation UpdateShift($id: ID!, $name: String, $startTime: String, $endTime: String, $breakMinutes: Int, $isActive: Boolean) {
    updateShift(id: $id, name: $name, startTime: $startTime, endTime: $endTime, breakMinutes: $breakMinutes, isActive: $isActive) {
      id
    }
  }
`;

const DELETE_SHIFT = gql`
  mutation DeleteShift($id: ID!) {
    deleteShift(id: $id)
  }
`;

export default function SettingsShifts() {
  const queryClient = useQueryClient();
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [editingShift, setEditingShift] = useState(null);

  const { data: shiftsData = {}, isLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => await gqlClient.request(GET_SHIFTS),
  });

  const shifts = shiftsData.shifts || [];

  const [shiftForm, setShiftForm] = useState({
    name: '',
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 60,
    isActive: true,
  });

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await gqlClient.request(UPDATE_SHIFT, { id, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setShowShiftDialog(false);
      setEditingShift(null);
    },
  });

  const createShiftMutation = useMutation({
    mutationFn: async (data) => {
      return await gqlClient.request(CREATE_SHIFT, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setShowShiftDialog(false);
      setShiftForm({
        name: '',
        startTime: '09:00',
        endTime: '17:00',
        breakMinutes: 60,
        isActive: true,
      });
    },
  });
  
  const deleteShiftMutation = useMutation({
    mutationFn: async (id) => await gqlClient.request(DELETE_SHIFT, { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shifts'] })
  });

  const calculateHours = (start, end, breakMins) => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const totalMins = (endH * 60 + endM) - (startH * 60 + startM) - breakMins;
    return totalMins > 0 ? (totalMins / 60).toFixed(1) : 0;
  };

  const handleEditShift = (shift) => {
    setEditingShift(shift);
    setShiftForm({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      isActive: shift.isActive,
    });
    setShowShiftDialog(true);
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <div className="flex justify-between items-center">
          <CardTitle>Work Shifts</CardTitle>
          <Dialog open={showShiftDialog} onOpenChange={(open) => {
            setShowShiftDialog(open);
            if (!open) {
              setEditingShift(null);
              setShiftForm({
                name: '',
                startTime: '09:00',
                endTime: '17:00',
                breakMinutes: 60,
                isActive: true,
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Shift
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingShift ? 'Edit' : 'Add'} Shift</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (editingShift) {
                  updateShiftMutation.mutate({ id: editingShift.id, data: shiftForm });
                } else {
                  const { isActive, ...createData } = shiftForm;
                  createShiftMutation.mutate(createData);
                }
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Shift Name</Label>
                    <Input value={shiftForm.name} onChange={(e) => setShiftForm(prev => ({ ...prev, name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm(prev => ({ ...prev, startTime: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm(prev => ({ ...prev, endTime: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Break (minutes)</Label>
                    <Input type="number" value={shiftForm.breakMinutes} onChange={(e) => setShiftForm(prev => ({ ...prev, breakMinutes: parseInt(e.target.value) }))} />
                  </div>
                  {editingShift && (
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={shiftForm.isActive ? 'active' : 'inactive'} onValueChange={(value) => setShiftForm(prev => ({ ...prev, isActive: value === 'active' }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowShiftDialog(false)}>Cancel</Button>
                  <Button type="submit" disabled={createShiftMutation.isPending || updateShiftMutation.isPending}>
                    {(createShiftMutation.isPending || updateShiftMutation.isPending) ? 'Saving...' : editingShift ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? <p>Loading...</p> : shifts.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">No shifts configured</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shifts.map(shift => (
              <div key={shift.id} className="p-4 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-slate-900">{shift.name}</h4>
                    <p className="text-sm text-slate-600">{shift.startTime} - {shift.endTime} ({calculateHours(shift.startTime, shift.endTime, shift.breakMinutes)}h)</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={shift.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
                      {shift.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => handleEditShift(shift)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deleteShiftMutation.mutate(shift.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
