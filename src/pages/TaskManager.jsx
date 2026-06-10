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
import { Plus, Kanban, FolderKanban, Calendar } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { motion } from "framer-motion";

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

const TaskSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
    {Array(5).fill(0).map((_, i) => (
      <div key={i} className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50">
        <div className="flex justify-between items-center mb-4">
          <div className="h-4 bg-slate-200 rounded w-1/3 animate-pulse"></div>
          <div className="w-6 h-4 bg-slate-200 rounded-full animate-pulse"></div>
        </div>
        <div className="space-y-3">
          {Array(3).fill(0).map((_, j) => (
            <div key={j} className="h-28 bg-white border border-slate-100 rounded-xl shadow-sm p-4 animate-pulse flex flex-col justify-between">
              <div className="space-y-2">
                <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                <div className="h-2 bg-slate-100 rounded w-full"></div>
              </div>
              <div className="flex justify-between">
                <div className="w-12 h-4 bg-slate-100 rounded"></div>
                <div className="w-6 h-6 bg-slate-100 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const ProjectSkeleton = () => (
  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array(6).fill(0).map((_, i) => (
      <div key={i} className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6 h-[250px] animate-pulse flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div className="h-5 bg-slate-100 rounded w-1/2"></div>
          <div className="w-16 h-5 bg-slate-100 rounded-full"></div>
        </div>
        <div className="h-3 bg-slate-100 rounded w-full mb-2"></div>
        <div className="h-3 bg-slate-100 rounded w-2/3 mb-6"></div>
        
        <div className="space-y-2 mb-6">
          <div className="flex justify-between">
            <div className="w-12 h-3 bg-slate-100 rounded"></div>
            <div className="w-8 h-3 bg-slate-100 rounded"></div>
          </div>
          <div className="w-full h-2 bg-slate-50 rounded-full"></div>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-4">
          <div className="h-8 bg-slate-100 rounded"></div>
          <div className="h-8 bg-slate-100 rounded"></div>
        </div>
      </div>
    ))}
  </div>
);

export default function TaskManager() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'projects'
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
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
        const currentUser = {
          email: "mock_user@example.com",
          role: "admin",
          organization_id: "org_1",
          full_name: "Mock User"
        };
        setUser(currentUser);
        setProjectForm(prev => ({ ...prev, project_manager: currentUser.email }));
        setTaskForm(prev => ({ ...prev, assigned_to: currentUser.email }));
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: employeesData = {} } = useQuery({
    queryKey: ['task-manager-employees'],
    queryFn: async () => await gqlClient.request(EMPLOYEES_QUERY),
  });
  const employees = employeesData.employees || [];

  const { data: allTasksData = {}, isLoading: tasksLoading } = useQuery({
    queryKey: ['onboarding-tasks'],
    queryFn: async () => await gqlClient.request(GET_TASKS),
  });

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
      return {
        ...data,
        id: `project_${Date.now()}`,
        organization_id: user.organization_id,
        status: 'planning',
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowProjectDialog(false);
      setProjectForm({ project_name: '', description: '', project_manager: user?.email || '' });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data) => {
      return {
        ...data,
        id: `task_${Date.now()}`,
        organization_id: user.organization_id,
        assigned_by: user.email,
        project_id: selectedProject?.id,
        status: 'todo',
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-items'] });
      setShowTaskDialog(false);
      setTaskForm({
        title: '',
        description: '',
        assigned_to: user?.email || '',
        priority: 'medium',
        due_date: '',
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }) => {
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
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
    }
  });

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
    backlog: { title: 'Backlog', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    todo: { title: 'To Do', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    in_progress: { title: 'In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    review: { title: 'Review', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    done: { title: 'Done', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  };

  const priorityColors = {
    low: 'bg-slate-300',
    medium: 'bg-slate-400',
    high: 'bg-slate-600',
    urgent: 'bg-red-500',
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-4 md:p-8 max-w-7xl mx-auto space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full mb-4">
            <FolderKanban className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Task Management</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
            Tasks & Projects
          </h1>
          <p className="text-slate-500">
            Manage tasks, track progress, and collaborate with your team
          </p>
        </div>
        <div className="flex gap-3">
          <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-lg border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-slate-100 shadow-xl max-w-md">
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createProjectMutation.mutate(projectForm); }} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="project_name">Project Name</Label>
                  <Input id="project_name" value={projectForm.project_name} onChange={(e) => setProjectForm(prev => ({ ...prev, project_name: e.target.value }))} className="rounded-lg" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_description">Description</Label>
                  <Textarea id="project_description" value={projectForm.description} onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))} className="rounded-lg" rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_manager">Project Manager</Label>
                  <Select value={projectForm.project_manager} onValueChange={(value) => setProjectForm(prev => ({ ...prev, project_manager: value }))} required>
                    <SelectTrigger id="project_manager" className="rounded-lg"><SelectValue placeholder="Select a manager" /></SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100 shadow-lg">
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.email}>
                          {emp.full_name || emp.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowProjectDialog(false)} className="rounded-lg">Cancel</Button>
                  <Button type="submit" className="rounded-lg bg-indigo-600 hover:bg-indigo-700" isLoading={createProjectMutation.isPending}>
                    {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
            <DialogTrigger asChild>
              <Button className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-slate-100 shadow-xl max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createTaskMutation.mutate(taskForm); }} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="task_title">Task Title</Label>
                  <Input id="task_title" value={taskForm.title} onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))} className="rounded-lg" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task_description">Description</Label>
                  <Textarea id="task_description" value={taskForm.description} onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))} className="rounded-lg" rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assigned_to">Assign To</Label>
                    <Select value={taskForm.assigned_to} onValueChange={(value) => setTaskForm(prev => ({ ...prev, assigned_to: value }))} required>
                      <SelectTrigger id="assigned_to" className="rounded-lg"><SelectValue placeholder="Assignee" /></SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-100 shadow-lg">
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
                      <SelectTrigger id="priority" className="rounded-lg"><SelectValue placeholder="Priority" /></SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-100 shadow-lg">
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
                  <Input id="due_date" type="date" value={taskForm.due_date} onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))} className="rounded-lg" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowTaskDialog(false)} className="rounded-lg">Cancel</Button>
                  <Button type="submit" className="rounded-lg bg-indigo-600 hover:bg-indigo-700" isLoading={createTaskMutation.isPending}>
                    {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* View Toggle */}
      <motion.div variants={itemVariants} className="flex gap-1.5 bg-slate-100 p-1 rounded-lg w-fit">
        <Button
          variant="ghost"
          size="sm"
          className={`rounded-md px-4 ${viewMode === 'kanban' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setViewMode('kanban')}
        >
          <Kanban className="w-4 h-4 mr-2" />
          Kanban
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`rounded-md px-4 ${viewMode === 'projects' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setViewMode('projects')}
        >
          <FolderKanban className="w-4 h-4 mr-2" />
          Projects
        </Button>
      </motion.div>

      {/* Project Filter */}
      {projects.length > 0 && (
        <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <Button
              size="sm"
              variant={!selectedProject ? 'default' : 'ghost'}
              className={`rounded-lg whitespace-nowrap ${!selectedProject ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              onClick={() => setSelectedProject(null)}
            >
              My Tasks
            </Button>
            {projects.map(project => (
              <Button
                key={project.id}
                size="sm"
                variant={selectedProject?.id === project.id ? 'default' : 'ghost'}
                className={`rounded-lg whitespace-nowrap ${selectedProject?.id === project.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                onClick={() => setSelectedProject(project)}
              >
                {project.project_name}
              </Button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <motion.div variants={itemVariants} className="min-h-[500px]">
        {tasksLoading ? (
          viewMode === 'kanban' ? <TaskSkeleton /> : <ProjectSkeleton />
        ) : viewMode === 'kanban' ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar snap-x">
              {Object.entries(statusConfig).map(([status, config]) => (
                <Droppable key={status} droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-col bg-slate-100/50 rounded-2xl p-4 min-h-[500px] border border-slate-200/40 transition-colors w-[320px] shrink-0 snap-start ${snapshot.isDraggingOver ? 'bg-indigo-50/50 border-indigo-100' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-800 tracking-tight">{config.title}</h3>
                        <Badge variant="outline" className={`${config.color} border font-semibold px-2 py-0.5 rounded-full`}>
                          {tasksByStatus[status].length}
                        </Badge>
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        {tasksByStatus[status].map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => setSelectedTask(task)}
                                className={`group bg-white rounded-2xl border border-slate-200 p-5 ${
                                  snapshot.isDragging ? 'shadow-2xl scale-[1.02] rotate-1 ring-1 ring-slate-900/5 z-50' : 'shadow-sm hover:shadow-md hover:border-slate-300'
                                } cursor-grab active:cursor-grabbing transition-all flex flex-col gap-3 min-h-[140px]`}
                                style={provided.draggableProps.style}
                              >
                                <div className="flex justify-between items-center">
                                  {task.category ? (
                                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">{task.category.replace('_', ' ')}</span>
                                  ) : <span />}
                                  <div className="flex items-center justify-center w-5 h-5 rounded-md hover:bg-slate-50 transition-colors" title={`Priority: ${task.priority}`}>
                                    <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`} />
                                  </div>
                                </div>
                                <h4 className="font-medium text-slate-900 text-base leading-snug tracking-tight">
                                  {task.title}
                                </h4>
                                {task.description && (
                                  <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                                    {task.description}
                                  </p>
                                )}
                                <div className="flex items-center justify-between mt-auto pt-4">
                                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                                  </div>
                                  {task.assigned_to && (
                                    <div className="w-8 h-8 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-xs text-slate-600 font-medium" title={task.assigned_to}>
                                      {task.assigned_to.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                              </div>
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
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => {
              const projectTasks = allTasks.filter(t => t.project_id === project.id);
              const completedTasks = projectTasks.filter(t => t.status === 'done').length;
              const progress = projectTasks.length > 0 
                ? Math.round((completedTasks / projectTasks.length) * 100)
                : 0;

              return (
                <motion.div key={project.id} whileHover={{ y: -4 }}>
                  <Card className="h-full border-slate-200/60 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-white group flex flex-col">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-5">
                      <div className="flex justify-between items-start gap-4">
                        <CardTitle className="text-lg font-bold text-slate-900 tracking-tight leading-tight group-hover:text-indigo-600 transition-colors">
                          {project.project_name}
                        </CardTitle>
                        <Badge variant="outline" className={`shrink-0 rounded-full border ${
                          project.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          project.status === 'in_progress' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>
                          {project.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6 flex-1 flex flex-col">
                      <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                        {project.description}
                      </p>
                      
                      <div className="space-y-2 mt-auto">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-500 uppercase tracking-wider">Progress</span>
                          <span className="text-indigo-700">{progress}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, delay: 0.2 }}
                            className="h-full bg-indigo-500 rounded-full"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-0.5">Tasks</span>
                          <p className="font-bold text-slate-900">
                            {completedTasks} <span className="text-slate-400 font-medium">/ {projectTasks.length}</span>
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-0.5">Due Date</span>
                          <p className="font-semibold text-slate-900 truncate">
                            {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'No deadline'}
                          </p>
                        </div>
                      </div>

                      <Button 
                        variant="outline" 
                        className="w-full rounded-lg border-slate-200 hover:bg-slate-50 group-hover:border-indigo-200 group-hover:text-indigo-700 transition-colors"
                        onClick={() => {
                          setSelectedProject(project);
                          setViewMode('kanban');
                        }}
                      >
                        View Tasks
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
            
            {projects.length === 0 && (
              <div className="col-span-full border border-slate-200/60 border-dashed rounded-2xl bg-white/50 p-16 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                  <FolderKanban className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">No projects yet</h3>
                <p className="text-slate-500 mb-6 max-w-sm">Create your first project to start managing tasks and collaborating with your team.</p>
                <Button onClick={() => setShowProjectDialog(true)} className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </Button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Task Details Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
          {selectedTask && (
            <>
              <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-8 relative">
                <div className="absolute top-4 right-4 flex gap-2">
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 font-semibold backdrop-blur-sm uppercase shadow-sm">
                    {selectedTask.status.replace('_', ' ')}
                  </Badge>
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 font-semibold backdrop-blur-sm uppercase shadow-sm">
                    {selectedTask.priority}
                  </Badge>
                </div>
                <h2 className="text-2xl font-bold text-white mt-4 mb-2 pr-20 leading-tight drop-shadow-sm">
                  {selectedTask.title}
                </h2>
                <div className="flex items-center gap-4 text-white/90 text-sm font-medium">
                  <div className="flex items-center gap-1.5">
                    <FolderKanban className="w-4 h-4" />
                    Project: {projects.find(p => p.id === selectedTask.project_id)?.project_name || 'My Tasks'}
                  </div>
                  {selectedTask.category && (
                    <div className="flex items-center gap-1.5">
                      <Kanban className="w-4 h-4" />
                      {selectedTask.category.replace('_', ' ')}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 space-y-6 bg-slate-50/50">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-2">Assignee</span>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold shadow-sm border border-indigo-200">
                        {selectedTask.assigned_to.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm text-slate-700">{selectedTask.assigned_to}</span>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-2">Due Date</span>
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="font-semibold text-sm text-slate-700">
                        {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'No deadline'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-3">Description</span>
                  <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                    {selectedTask.description || <span className="italic text-slate-400">No description provided.</span>}
                  </div>
                </div>
                
                <div className="flex justify-end pt-2">
                  <Button onClick={() => setSelectedTask(null)} className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm px-6">
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
