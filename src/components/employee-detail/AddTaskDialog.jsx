import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AddTaskDialog({ open, onClose, onSubmit, isSubmitting }) {
  const [taskData, setTaskData] = useState({
    title: "",
    description: "",
    department: "",
    owner_email: "",
    deadline: "",
    priority: "medium",
    status: "pending",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(taskData);
    setTaskData({
      title: "",
      description: "",
      department: "",
      owner_email: "",
      deadline: "",
      priority: "medium",
      status: "pending",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={taskData.title}
              onChange={(e) => setTaskData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Setup laptop"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={taskData.description}
              onChange={(e) => setTaskData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Task details..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Input
                id="department"
                value={taskData.department}
                onChange={(e) => setTaskData(prev => ({ ...prev, department: e.target.value }))}
                placeholder="e.g., IT, HR"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={taskData.priority} 
                onValueChange={(value) => setTaskData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={taskData.deadline}
                onChange={(e) => setTaskData(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_email">Owner Email</Label>
              <Input
                id="owner_email"
                type="email"
                value={taskData.owner_email}
                onChange={(e) => setTaskData(prev => ({ ...prev, owner_email: e.target.value }))}
                placeholder="owner@company.com"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} isLoading={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}