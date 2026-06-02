// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  BarChart3,
  UserCircle,
  LogOut,
  Menu,
  Briefcase,
  Video,
  ClipboardCheck,
  Calendar,
  DollarSign,
  UserPlus,
  Receipt,
  MessageSquare,
  Settings,
  CheckSquare,
  Plane,
  MessageCircle,
  Home,
  ChevronDown,
  ChevronRight,
  Target,
  ShieldCheck,
  Laptop,
  CheckCircle,
  TrendingUp // New import
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const navigationStructure = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Employees",
    icon: Users,
    isParent: true,
    children: [
      { title: "All Employees", url: createPageUrl("Employees"), icon: Users },
      { title: "Chat", url: createPageUrl("Chat"), icon: MessageCircle },
      { title: "Tasks & Projects", url: createPageUrl("TaskManager"), icon: CheckSquare },
      { title: "Leave Requests", url: createPageUrl("AllLeaveRequests"), icon: Plane },
      { title: "Attendance", url: createPageUrl("Attendance"), icon: Calendar },
    ]
  },
  {
    title: "Payroll",
    icon: DollarSign,
    isParent: true,
    children: [
      { title: "Payroll", url: createPageUrl("Payroll"), icon: DollarSign },
      { title: "Loans", url: createPageUrl("Loans"), icon: DollarSign },
      { title: "Expenses", url: createPageUrl("Expenses"), icon: Receipt },
    ]
  },
  {
    title: "Recruitment",
    icon: UserPlus,
    isParent: true,
    children: [
      { title: "Job Postings", url: createPageUrl("Recruitment"), icon: UserPlus },
      { title: "Onboarding", url: createPageUrl("Templates"), icon: CheckCircle },
      { title: "Offboarding", url: createPageUrl("Offboarding"), icon: CheckCircle },
    ]
  },
  {
    title: "Training LMS",
    icon: Video,
    isParent: true,
    children: [
      { title: "Training", url: createPageUrl("Training"), icon: Video },
      { title: "Evaluations", url: createPageUrl("Evaluations"), icon: ClipboardCheck },
    ]
  },
  {
    title: "Performance",
    url: createPageUrl("Performance"),
    icon: Target,
  },
  {
    title: "Compliance",
    icon: ShieldCheck,
    isParent: true,
    children: [
      { title: "AI Compliance Monitor", url: createPageUrl("ComplianceDashboard"), icon: ShieldCheck }, // Added item
      { title: "HR Letters", url: createPageUrl("HRLetters"), icon: FileText },
      { title: "Surveys", url: createPageUrl("Surveys"), icon: MessageSquare },
      { title: "Templates", url: createPageUrl("Templates"), icon: FileText },
    ]
  },
  {
    title: "Assets",
    url: createPageUrl("Assets"),
    icon: Laptop,
  },
  {
    title: "Analytics",
    icon: BarChart3,
    isParent: true,
    children: [
      { title: "Analytics", url: createPageUrl("Analytics"), icon: BarChart3 },
      { title: "Advanced Analytics", url: createPageUrl("AdvancedAnalytics"), icon: TrendingUp }, // Added item
      { title: "Organogram", url: createPageUrl("Organogram"), icon: Users },
    ]
  },
];

const employeeNavigation = [
  {
    title: "My Portal", // Changed from "My Dashboard"
    url: createPageUrl("EmployeeSelfService"), // Changed from "EmployeePortal"
    icon: Briefcase,
  },
  {
    title: "My Tasks",
    url: createPageUrl("TaskManager"),
    icon: CheckSquare,
  },
  {
    title: "Chat",
    url: createPageUrl("Chat"),
    icon: MessageCircle,
  },
  {
    title: "Leave Requests",
    url: createPageUrl("LeaveManagement"),
    icon: Plane,
  },
  {
    title: "My Loans",
    url: createPageUrl("Loans"),
    icon: DollarSign,
  },
  {
    title: "My Training",
    url: createPageUrl("Training"),
    icon: Video,
  },
  {
    title: "Request HR Letter",
    url: createPageUrl("HRLetters"),
    icon: FileText,
  },
  {
    title: "Expense Claims",
    url: createPageUrl("Expenses"),
    icon: Receipt,
  },
];

function NavMenuItem({ item, location }) {
  const [isOpen, setIsOpen] = useState(false);

  // Determine if the current path is a child of this parent item
  useEffect(() => {
    if (item.isParent && item.children) {
      const isChildActive = item.children.some(child => location.pathname === child.url);
      if (isChildActive) {
        setIsOpen(true);
      }
    }
  }, [location.pathname, item.isParent, item.children]);

  if (item.isParent) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 rounded-lg mb-1 text-slate-600">
            <div className="flex items-center justify-between w-full px-3 py-2.5">
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.title}</span>
              </div>
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-4 space-y-1">
          {item.children.map((child) => (
            <SidebarMenuItem key={child.title}>
              <SidebarMenuButton asChild>
                <Link 
                  to={child.url} 
                  className={`flex items-center gap-3 px-3 py-2 hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 rounded-lg ${
                    location.pathname === child.url ? 'bg-purple-50 text-purple-700 font-medium shadow-sm' : 'text-slate-600'
                  }`}
                >
                  <child.icon className="w-4 h-4" />
                  <span className="text-sm">{child.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className="mb-1">
        <Link 
          to={item.url} 
          className={`flex items-center gap-3 px-3 py-2.5 hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 rounded-lg ${
            location.pathname === item.url ? 'bg-purple-50 text-purple-700 font-medium shadow-sm' : 'text-slate-600'
          }`}
        >
          <item.icon className="w-5 h-5" />
          <span className="font-medium">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [organization, setOrganization] = useState(null);
  
  // A user is an employee if they have an employeeId
  const isEmployee = !!user?.employeeId;

  useEffect(() => {
    if (user?.organizationId) {
      const loadOrg = async () => {
        try {
          const ORG_QUERY = gql`
            query GetOrg($id: ID!) {
              organization(id: $id) {
                id
                name
              }
            }
          `;
          const data = await gqlClient.request(ORG_QUERY, { id: user.organizationId });
          setOrganization(data.organization);
        } catch (error) {
          console.error("Error loading organization:", error);
        }
      };
      loadOrg();
    }
  }, [user]);

  const handleLogout = () => {
    logout();
  };

  const navItems = isEmployee && !user?.role?.includes('ADMIN') && user?.role !== 'admin' ? employeeNavigation : navigationStructure;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-purple-50 to-pink-50">
        <Sidebar className="border-r border-slate-200 bg-white">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              {organization?.logo_url ? (
                <img src={organization.logo_url} alt="Logo" className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69951f4d3ce6a608fcf7e916/273166988_Tradevu-Icon.png" 
                  alt="Logo" 
                  className="w-10 h-10 object-contain" 
                />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-slate-900 text-lg leading-tight">Tradevu</h2>
                <p className="text-xs text-slate-500 truncate">{organization?.name || 'HR Management'}</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 mb-2">
                {isEmployee && !user?.role?.includes('ADMIN') && user?.role !== 'admin' ? 'Employee Menu' : 'Main Menu'}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <NavMenuItem key={item.title} item={item} location={location} />
                  ))}
                  {(user?.role?.includes('ADMIN') || user?.role === 'admin' || user?.isOrgOwner) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === createPageUrl("Settings") ? 'bg-purple-50 text-purple-700 font-medium shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        <Link to={createPageUrl("Settings")} className="flex items-center gap-3 px-3 py-2.5">
                          <Settings className="w-5 h-5" />
                          <span className="font-medium">Settings</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200 p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 hover:bg-slate-100">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-slate-900 text-sm truncate">
                      {user?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/Profile')}>
                  <UserCircle className="w-4 h-4 mr-2" />
                  My Profile
                </DropdownMenuItem>
                {(user?.role?.includes('ADMIN') || user?.role === 'admin' || user?.isOrgOwner) && (
                  <DropdownMenuItem onClick={() => navigate('/Settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-slate-200 px-6 py-4 md:hidden sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200">
                <Menu className="w-5 h-5" />
              </SidebarTrigger>
              <div>
                <h1 className="text-base font-bold text-slate-900">Tradevu</h1>
                <p className="text-xs text-slate-500">{organization?.name}</p>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}