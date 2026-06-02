
import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from 'graphql-request';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Kanban, FolderKanban } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const GET_TASKS = gql`
  query GetTasks {
    onboardingTasks {
      id
      title
      description
      isCompleted
      status
      category
      assignedTo
      employeeId
    }
  }
`;

const EMPLOYEES_QUERY = gql`
  query GetTaskManagerEmployees {
    employees {
      id
      fullName
    }
  }
`;

const UPDATE_TASK = gql`
  mutation UpdateOnboardingTask($id: ID!, $status: String!) {
    updateOnboardingTask(id: $id, status: $status) {
      id
      isCompleted
      status
    }
  }
`;

export default function TaskManager() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'projects'
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [projectForm, setProjectForm] = useState({
    project_name: '',
    description: '',
    project_manager: '',
  });
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: '',
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Mock user
        const currentUser = {
          email: "mock_user@example.com",
          role: "admin",
          organization_id: "org_1",
          full_name: "Mock User"
        };
        setUser(currentUser);
        // Set initial form values based on the logged-in user
        setProjectForm(prev => ({ ...prev, project_manager: currentUser.email }));
        setTaskForm(prev => ({ ...prev, assigned_to: currentUser.email }));
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: employeesData = {} } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => await gqlClient.request(EMPLOYEES_QUERY),
  });
  const employees = employeesData.employees || [];

  const { data: allTasksData = {} } = useQuery({
    queryKey: ['onboarding-tasks'],
    queryFn: async () => await gqlClient.request(GET_TASKS),
  });

  // Dynamically create projects from unique employee IDs in onboarding tasks
  const uniqueEmployeeIds = Array.from(new Set((allTasksData.onboardingTasks || []).map(t => t.employeeId).filter(Boolean)));
  const projects = uniqueEmployeeIds.map(empId => {
    const emp = employees.find(e => e.id === empId);
    return {
      id: empId,
      project_name: emp ? `Onboarding: ${emp.fullName}` : 'Onboarding: Unknown',
      description: 'Employee onboarding process',
      status: 'in_progress'
    };
  });

  // Map onboarding tasks to Kanban format
  const allTasks = (allTasksData.onboardingTasks || []).map(t => ({
    id: t.id,
    title: t.title,
    description: t.description || `Category: ${t.category}`,
    status: t.status || (t.isCompleted ? 'done' : 'todo'),
    priority: 'medium',
    assigned_to: t.assignedTo || 'Unassigned',
    project_id: t.employeeId,
    is_onboarding: true
  }));

  const createProjectMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock create project", data);
      return {
        ...data,
        id: `project_${Date.now()}`,
        organization_id: user.organization_id, // Ensure organization_id is passed
        status: 'planning', // Default status for new projects
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowProjectDialog(false);
      setProjectForm({ project_name: '', description: '', project_manager: user?.email || '' }); // Reset form
    },
    onError: (error) => {
      console.error("Error creating project:", error);
      // Optionally show a toast notification
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock create task", data);
      return {
        ...data,
        id: `task_${Date.now()}`,
        organization_id: user.organization_id, // Ensure organization_id is passed
        assigned_by: user.email,
        project_id: selectedProject?.id, // Assign to current selected project if any
        status: 'todo', // Default status for new tasks
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-items'] });
      setShowTaskDialog(false);
      setTaskForm({ // Reset form
        title: '',
        description: '',
        assigned_to: user?.email || '',
        priority: 'medium',
        due_date: '',
      });
    },
    onError: (error) => {
      console.error("Error creating task:", error);
      // Optionally show a toast notification
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // If it's an onboarding task, update it on the backend
      return await gqlClient.request(UPDATE_TASK, { id, status: data.status });
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['onboarding-tasks'] });
      const previousData = queryClient.getQueryData(['onboarding-tasks']);
      
      queryClient.setQueryData(['onboarding-tasks'], (old) => {
        if (!old || !old.onboardingTasks) return old;
        return {
          ...old,
          onboardingTasks: old.onboardingTasks.map(task => 
            task.id === id ? { ...task, status: data.status, isCompleted: data.status === 'done' } : task
          )
        };
      });
      
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['onboarding-tasks'], context.previousData);
      }
      console.error("Error updating task:", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
    }
  });

  // Filter tasks by project if selected
  // Show all tasks to everyone, as requested
  const tasks = selectedProject 
    ? allTasks.filter(t => t.project_id === selectedProject.id)
    : allTasks;

  const tasksByStatus = {
    backlog: tasks.filter(t => t.status === 'backlog'),
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    review: tasks.filter(t => t.status === 'review'),
    done: tasks.filter(t => t.status === 'done'),
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId;
    const task = tasks.find(t => t.id === taskId);
    
    if (task && task.status !== newStatus) {
      updateTaskMutation.mutate({
        id: taskId,
        data: { 
          status: newStatus,
          completed_date: newStatus === 'done' ? new Date().toISOString().split('T')[0] : undefined
        }
      });
    }
  };

  const statusConfig = {
    backlog: { title: 'Backlog', color: 'bg-slate-100 text-slate-700' },
    todo: { title: 'To Do', color: 'bg-blue-100 text-blue-700' },
    in_progress: { title: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
    review: { title: 'Review', color: 'bg-purple-100 text-purple-700' },
    done: { title: 'Done', color: 'bg-green-100 text-green-700' },
  };

  const priorityColors = {
    low: 'border-l-blue-500',
    medium: 'border-l-yellow-500',
    high: 'border-l-orange-500',
    urgent: 'border-l-red-500',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
              <FolderKanban className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-slate-700">Task Management</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">
              Tasks & Projects
            </h1>
            <p className="text-lg text-slate-600">
              Manage tasks, track progress, and collaborate with your team
            </p>
          </div>
          <div className="flex gap-3">
            {/* New Project Dialog */}
            <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Project</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createProjectMutation.mutate(projectForm); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="project_name">Project Name</Label>
                    <Input id="project_name" value={projectForm.project_name} onChange={(e) => setProjectForm(prev => ({ ...prev, project_name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project_description">Description</Label>
                    <Textarea id="project_description" value={projectForm.description} onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project_manager">Project Manager</Label>
                    <Select value={projectForm.project_manager} onValueChange={(value) => setProjectForm(prev => ({ ...prev, project_manager: value }))} required>
                      <SelectTrigger id="project_manager"><SelectValue placeholder="Select a manager" /></SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.email}>
                            {emp.full_name || emp.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowProjectDialog(false)}>Cancel</Button>
                    <Button type="submit" disabled={createProjectMutation.isPending}>
                      {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* New Task Dialog */}
            <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
                  <Plus className="w-4 h-4 mr-2" />
                  New Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Task</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createTaskMutation.mutate(taskForm); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="task_title">Task Title</Label>
                    <Input id="task_title" value={taskForm.title} onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task_description">Description</Label>
                    <Textarea id="task_description" value={taskForm.description} onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))} rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="assigned_to">Assign To</Label>
                      <Select value={taskForm.assigned_to} onValueChange={(value) => setTaskForm(prev => ({ ...prev, assigned_to: value }))} required>
                        <SelectTrigger id="assigned_to"><SelectValue placeholder="Assignee" /></SelectTrigger>
                        <SelectContent>
                          {employees.map(emp => (
                            <SelectItem key={emp.id} value={emp.email}>
                              {emp.full_name || emp.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={taskForm.priority} onValueChange={(value) => setTaskForm(prev => ({ ...prev, priority: value }))} required>
                        <SelectTrigger id="priority"><SelectValue placeholder="Priority" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input id="due_date" type="date" value={taskForm.due_date} onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))} />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowTaskDialog(false)}>Cancel</Button>
                    <Button type="submit" disabled={createTaskMutation.isPending}>
                      {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            onClick={() => setViewMode('kanban')}
          >
            <Kanban className="w-4 h-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'projects' ? 'default' : 'outline'}
            onClick={() => setViewMode('projects')}
          >
            <FolderKanban className="w-4 h-4 mr-2" />
            Projects
          </Button>
        </div>

        {/* Project Filter */}
        {projects.length > 0 && (
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 overflow-x-auto">
                <Button
                  size="sm"
                  variant={!selectedProject ? 'default' : 'outline'}
                  onClick={() => setSelectedProject(null)}
                >
                  My Tasks
                </Button>
                {projects.map(project => (
                  <Button
                    key={project.id}
                    size="sm"
                    variant={selectedProject?.id === project.id ? 'default' : 'outline'}
                    onClick={() => setSelectedProject(project)}
                  >
                    {project.project_name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Kanban View */}
        {viewMode === 'kanban' && (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {Object.entries(statusConfig).map(([status, config]) => (
                <Droppable key={status} droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-3 ${snapshot.isDraggingOver ? 'bg-blue-50' : ''} rounded-lg p-3`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-slate-900">{config.title}</h3>
                        <Badge variant="outline" className={config.color}>
                          {tasksByStatus[status].length}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        {tasksByStatus[status].map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`border-l-4 ${priorityColors[task.priority]} ${
                                  snapshot.isDragging ? 'shadow-lg' : ''
                                } cursor-move hover:shadow-md transition-shadow`}
                              >
                                <CardContent className="p-4">
                                  <h4 className="font-medium text-slate-900 mb-2 text-sm">
                                    {task.title}
                                  </h4>
                                  {task.description && (
                                    <p className="text-xs text-slate-600 mb-3 line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-xs">
                                      {task.priority}
                                    </Badge>
                                    {task.due_date && (
                                      <span className="text-xs text-slate-500">
                                        {new Date(task.due_date).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                  {task.assigned_to && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs text-blue-700">
                                        {task.assigned_to.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-xs text-slate-600 truncate">
                                        {task.assigned_to.split('@')[0]}
                                      </span>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        )}

        {/* Projects View */}
        {viewMode === 'projects' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => {
              const projectTasks = allTasks.filter(t => t.project_id === project.id);
              const completedTasks = projectTasks.filter(t => t.status === 'done').length;
              const progress = projectTasks.length > 0 
                ? Math.round((completedTasks / projectTasks.length) * 100)
                : 0;

              return (
                <Card key={project.id} className="border-slate-200 hover:shadow-lg transition-shadow">
                  <CardHeader className="border-b border-slate-100">
                    <CardTitle className="text-lg">{project.project_name}</CardTitle>
                    <Badge variant="outline" className={
                      project.status === 'completed' ? 'bg-green-100 text-green-700' :
                      project.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-700'
                    }>
                      {project.status.replace('_', ' ')}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <p className="text-sm text-slate-600 line-clamp-2">{project.description}</p>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Progress</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">Tasks</span>
                        <p className="font-semibold text-slate-900">
                          {completedTasks}/{projectTasks.length}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Due Date</span>
                        <p className="font-semibold text-slate-900">
                          {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'No deadline'}
                        </p>
                      </div>
                    </div>

                    {project.team_members && project.team_members.length > 0 && (
                      <div>
                        <span className="text-xs text-slate-500">Team</span>
                        <div className="flex -space-x-2 mt-2">
                          {project.team_members.slice(0, 3).map((email, idx) => (
                            <div 
                              key={idx}
                              className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs border-2 border-white"
                            >
                              {email.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {project.team_members.length > 3 && (
                            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 text-xs border-2 border-white">
                              +{project.team_members.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        setSelectedProject(project);
                        setViewMode('kanban');
                      }}
                    >
                      View Tasks
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            
            {projects.length === 0 && (
              <Card className="col-span-full border-slate-200">
                <CardContent className="p-12 text-center">
                  <FolderKanban className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No projects yet</h3>
                  <p className="text-slate-500 mb-4">Create your first project to get started</p>
                  <Button onClick={() => setShowProjectDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Project
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
