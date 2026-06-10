import React, { useState } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TrainingNeedForm({ employees, onCancel, onSuccess }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    employee_id: "",
    skill_name: "",
    current_level: "beginner",
    target_level: "intermediate",
    priority: "medium",
    status: "identified",
    recommended_training: "",
    target_date: "",
    notes: "",
    identified_by: "manager",
  });

  const createNeedMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock create training need", data);
      return { ...data, id: `need_${Date.now()}` };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-needs'] });
      onSuccess();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createNeedMutation.mutate(formData);
  };

  return (
    <Card className="border-slate-200 shadow-xl max-w-3xl mx-auto">
      <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardTitle className="text-2xl">Add Training Need</CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="employee_id">Employee *</Label>
              <Select value={formData.employee_id} onValueChange={(value) => setFormData(prev => ({ ...prev, employee_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} - {emp.job_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill_name">Skill/Competency *</Label>
              <Input
                id="skill_name"
                value={formData.skill_name}
                onChange={(e) => setFormData(prev => ({ ...prev, skill_name: e.target.value }))}
                placeholder="e.g., Project Management"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_level">Current Level *</Label>
              <Select value={formData.current_level} onValueChange={(value) => setFormData(prev => ({ ...prev, current_level: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_level">Target Level *</Label>
              <Select value={formData.target_level} onValueChange={(value) => setFormData(prev => ({ ...prev, target_level: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="identified">Identified</SelectItem>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_date">Target Date</Label>
              <Input
                id="target_date"
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData(prev => ({ ...prev, target_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="identified_by">Identified By</Label>
              <Input
                id="identified_by"
                value={formData.identified_by}
                onChange={(e) => setFormData(prev => ({ ...prev, identified_by: e.target.value }))}
                placeholder="e.g., manager, self"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recommended_training">Recommended Training</Label>
            <Input
              id="recommended_training"
              value={formData.recommended_training}
              onChange={(e) => setFormData(prev => ({ ...prev, recommended_training: e.target.value }))}
              placeholder="Suggest a course or training program..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional information..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              isLoading={createNeedMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {createNeedMutation.isPending ? "Saving..." : "Add Training Need"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}