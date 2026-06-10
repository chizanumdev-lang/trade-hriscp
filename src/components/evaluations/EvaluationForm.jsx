import React, { useState } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2 } from "lucide-react";

export default function EvaluationForm({ employees, currentUser, onCancel, onSuccess }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    employee_id: "",
    evaluator_email: currentUser?.email || "",
    evaluation_type: "manager",
    period: "",
    status: "draft",
    competencies: {
      communication: 3,
      teamwork: 3,
      problem_solving: 3,
      technical_skills: 3,
      leadership: 3,
      adaptability: 3,
      initiative: 3,
    },
    strengths: "",
    areas_for_improvement: "",
    goals: [],
    overall_rating: 3,
    comments: "",
  });

  const [newGoal, setNewGoal] = useState("");

  const createEvaluationMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock create evaluation", data);
      return { ...data, id: `eval_${Date.now()}` };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      onSuccess();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createEvaluationMutation.mutate(formData);
  };

  const updateCompetency = (key, value) => {
    setFormData(prev => ({
      ...prev,
      competencies: {
        ...prev.competencies,
        [key]: value[0],
      },
    }));
  };

  const addGoal = () => {
    if (newGoal.trim()) {
      setFormData(prev => ({
        ...prev,
        goals: [...prev.goals, newGoal],
      }));
      setNewGoal("");
    }
  };

  const removeGoal = (index) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.filter((_, i) => i !== index),
    }));
  };

  return (
    <Card className="border-slate-200 shadow-xl max-w-4xl mx-auto">
      <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardTitle className="text-2xl">New Performance Evaluation</CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
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
              <Label htmlFor="evaluation_type">Evaluation Type *</Label>
              <Select value={formData.evaluation_type} onValueChange={(value) => setFormData(prev => ({ ...prev, evaluation_type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Self Evaluation</SelectItem>
                  <SelectItem value="manager">Manager Review</SelectItem>
                  <SelectItem value="peer">Peer Review</SelectItem>
                  <SelectItem value="360">360° Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="period">Evaluation Period *</Label>
              <Input
                id="period"
                value={formData.period}
                onChange={(e) => setFormData(prev => ({ ...prev, period: e.target.value }))}
                placeholder="e.g., Q1 2024"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Competencies */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Competencies (1-5)</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {Object.entries(formData.competencies).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="capitalize">{key.replace(/_/g, ' ')}</Label>
                    <span className="text-sm font-semibold text-indigo-600">{value}</span>
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={(val) => updateCompetency(key, val)}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Feedback */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="strengths">Key Strengths</Label>
              <Textarea
                id="strengths"
                value={formData.strengths}
                onChange={(e) => setFormData(prev => ({ ...prev, strengths: e.target.value }))}
                placeholder="What are the employee's main strengths?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="areas_for_improvement">Areas for Improvement</Label>
              <Textarea
                id="areas_for_improvement"
                value={formData.areas_for_improvement}
                onChange={(e) => setFormData(prev => ({ ...prev, areas_for_improvement: e.target.value }))}
                placeholder="What areas need development?"
                rows={3}
              />
            </div>
          </div>

          {/* Goals */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Goals for Next Period</h3>
            {formData.goals.length > 0 && (
              <div className="space-y-2">
                {formData.goals.map((goal, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                    <span className="flex-1 text-sm">{goal}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeGoal(index)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="Add a goal..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addGoal())}
              />
              <Button type="button" onClick={addGoal} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Overall Rating & Comments */}
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="overall_rating">Overall Rating</Label>
                <span className="text-lg font-bold text-indigo-600">{formData.overall_rating}</span>
              </div>
              <Slider
                value={[formData.overall_rating]}
                onValueChange={(val) => setFormData(prev => ({ ...prev, overall_rating: val[0] }))}
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comments">Additional Comments</Label>
              <Textarea
                id="comments"
                value={formData.comments}
                onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                placeholder="Any additional feedback..."
                rows={4}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              isLoading={createEvaluationMutation.isPending}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              {createEvaluationMutation.isPending ? "Saving..." : "Save Evaluation"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}