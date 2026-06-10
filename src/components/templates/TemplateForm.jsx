import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, FileText, CheckSquare, File } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TemplateForm({ onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    role_type: "",
    tasks: [],
    required_documents: [],
  });

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    department: "",
    deadline_days: 7,
  });

  const [newDocument, setNewDocument] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const addTask = () => {
    if (newTask.title) {
      setFormData(prev => ({
        ...prev,
        tasks: [...prev.tasks, newTask],
      }));
      setNewTask({ title: "", description: "", department: "", deadline_days: 7 });
    }
  };

  const removeTask = (index) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index),
    }));
  };

  const addDocument = () => {
    if (newDocument) {
      setFormData(prev => ({
        ...prev,
        required_documents: [...prev.required_documents, newDocument],
      }));
      setNewDocument("");
    }
  };

  const removeDocument = (index) => {
    setFormData(prev => ({
      ...prev,
      required_documents: prev.required_documents.filter((_, i) => i !== index),
    }));
  };

  return (
    <Card className="max-w-4xl mx-auto border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <FileText className="w-6 h-6 text-indigo-600" />
          Create Onboarding Template
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Template Details</h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Software Engineer Onboarding"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role_type">Role Type *</Label>
                <Input
                  id="role_type"
                  value={formData.role_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, role_type: e.target.value }))}
                  placeholder="e.g., Engineer, Designer, Sales"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this template includes..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Tasks Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-5 h-5" />
              Onboarding Tasks
            </h3>
            
            {/* Task List */}
            {formData.tasks.length > 0 && (
              <div className="space-y-2 mb-4">
                {formData.tasks.map((task, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <CheckSquare className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{task.title}</p>
                      <p className="text-sm text-slate-600">{task.description}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">{task.department}</Badge>
                        <Badge variant="outline" className="text-xs">Due in {task.deadline_days} days</Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTask(index)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Task Form */}
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <Input
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                />
                <Input
                  placeholder="Department (e.g., HR, IT)"
                  value={newTask.department}
                  onChange={(e) => setNewTask(prev => ({ ...prev, department: e.target.value }))}
                />
              </div>
              <Input
                placeholder="Task description"
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
              />
              <div className="flex gap-3">
                <Input
                  type="number"
                  placeholder="Days until deadline"
                  value={newTask.deadline_days}
                  onChange={(e) => setNewTask(prev => ({ ...prev, deadline_days: parseInt(e.target.value) }))}
                  className="w-48"
                />
                <Button type="button" onClick={addTask} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </div>
            </div>
          </div>

          {/* Documents Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <File className="w-5 h-5" />
              Required Documents
            </h3>

            {/* Document List */}
            {formData.required_documents.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {formData.required_documents.map((doc, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-2">
                    {doc}
                    <button
                      type="button"
                      onClick={() => removeDocument(index)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add Document Form */}
            <div className="flex gap-3">
              <Input
                placeholder="Document name (e.g., ID Copy, Resume)"
                value={newDocument}
                onChange={(e) => setNewDocument(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDocument())}
              />
              <Button type="button" onClick={addDocument} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Document
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onCancel} isLoading={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              isLoading={isSubmitting}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              {isSubmitting ? "Creating..." : "Create Template"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}