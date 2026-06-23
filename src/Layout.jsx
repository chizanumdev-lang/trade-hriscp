// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  LayoutDashboard, Users, FileText, BarChart3, UserCircle, LogOut, Menu,
  Briefcase, Video, ClipboardCheck, Calendar, DollarSign, UserPlus, Receipt,
  MessageSquare, Settings, CheckSquare, Plane, MessageCircle, Home,
  Target, ShieldCheck, Laptop, CheckCircle, TrendingUp, BookOpen, Moon, Sun, Search, Clock, CalendarRange
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { useQuery } from '@tanstack/react-query';
import { useAuth } from "@/lib/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


const navigationStructure = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    isParent: true,
    children: [
      { title: "Overview", url: "/", icon: LayoutDashboard },
      { title: "Approvals", url: createPageUrl("PendingApprovals"), icon: CheckCircle },
      { title: "Assets", url: createPageUrl("Assets"), icon: Laptop },
      { title: "Tasks & Projects", url: createPageUrl("TaskManager"), icon: CheckSquare },
    ]
  },
  {
    title: "Employees",
    icon: Users,
    isParent: true,
    children: [
      { title: "All Employees", url: createPageUrl("Employees"), icon: Users },
      { title: "Chat", url: createPageUrl("Chat"), icon: MessageCircle },
      { title: "Leave Management", url: createPageUrl("LeaveManagement"), icon: Plane },
      { title: "Attendance", url: createPageUrl("Attendance"), icon: Calendar },
    ]
  },
  {
    title: "Payroll",
    icon: DollarSign,
    isParent: true,
    children: [
      { title: "Payroll", url: createPageUrl("Payroll"), icon: DollarSign },
      { title: "Compensation", url: createPageUrl("Compensation"), icon: DollarSign },
      { title: "Adjustments", url: createPageUrl("PayrollAdjustments"), icon: DollarSign },
      { title: "Reports", url: createPageUrl("PayrollReports"), icon: TrendingUp },
      { title: "Statutory", url: createPageUrl("SettingsStatutory"), icon: Settings },
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
    icon: Target,
    isParent: true,
    children: [
      { title: "Reviews", url: createPageUrl("Performance"), icon: Target }
    ]
  },
  {
    title: "Compliance",
    icon: ShieldCheck,
    isParent: true,
    children: [
      { title: "AI Compliance Monitor", url: createPageUrl("ComplianceDashboard"), icon: ShieldCheck },
      { title: "Knowledge Bank", url: createPageUrl("KnowledgeBank"), icon: BookOpen },
      { title: "HR Letters", url: createPageUrl("HRLetters"), icon: FileText },
      { title: "Surveys", url: createPageUrl("Surveys"), icon: MessageSquare },
      { title: "Templates", url: createPageUrl("Templates"), icon: FileText },
    ]
  },
  {
    title: "Analytics",
    icon: BarChart3,
    isParent: true,
    children: [
      { title: "Analytics", url: createPageUrl("Analytics"), icon: BarChart3 },
      { title: "Advanced Analytics", url: createPageUrl("AdvancedAnalytics"), icon: TrendingUp },
      { title: "Organogram", url: createPageUrl("Organogram"), icon: Users },
    ]
  },
];

const employeeNavigation = [
  {
    title: "Home",
    icon: Home,
    isParent: true,
    children: [
      { title: "My Portal", url: createPageUrl("EmployeeSelfService"), icon: Briefcase },
      { title: "My Tasks", url: createPageUrl("TaskManager"), icon: CheckSquare },
      { title: "Chat", url: createPageUrl("Chat"), icon: MessageCircle },
    ]
  },
  {
    title: "HR & Finance",
    icon: FileText,
    isParent: true,
    children: [
      { title: "Leave Management", url: createPageUrl("LeaveManagement"), icon: Plane },
      { title: "My Loans", url: createPageUrl("Loans"), icon: DollarSign },
      { title: "Expense Claims", url: createPageUrl("Expenses"), icon: Receipt },
      { title: "Request HR Letter", url: createPageUrl("HRLetters"), icon: FileText },
    ]
  },
  {
    title: "Training",
    icon: Video,
    isParent: true,
    children: [
      { title: "My Training", url: createPageUrl("Training"), icon: Video },
    ]
  }
];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("sidebarTheme") || "dark");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  useEffect(() => {
    localStorage.setItem("sidebarTheme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");
  const isDark = theme === "dark";
  
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

  const [manualActivePrimary, setManualActivePrimary] = useState(null);

  const GET_PENDING_COUNTS = gql`
    query GetPendingCounts {
      employees { id employmentStatus }
      documents { id status employeeId }
      leaveRequests { id status employeeId employee { email } }
      profileUpdateRequests { id status employeeId }
      allProbationRequests { id status employeeId }
      allOffboardings { id status employeeId }
    }
  `;

  const { data: pendingData } = useQuery({
    queryKey: ['pendingApprovalsCount'],
    queryFn: () => gqlClient.request(GET_PENDING_COUNTS),
    enabled: !!user?.organizationId && (user?.role?.includes('ADMIN') || user?.role === 'admin' || user?.isOrgOwner),
    refetchInterval: 10000,
  });

  const isAdmin = ['HR_ADMIN', 'SUPER_ADMIN', 'admin'].includes(user?.role) || user?.is_organization_owner;
  
  const pendingEmployeesCount = pendingData?.employees?.filter(e => e.employmentStatus === 'PENDING_APPROVAL').length || 0;
  const pendingDocumentCount = pendingData?.documents?.filter(d => {
    if (d.status !== 'PENDING') return false;
    const emp = pendingData.employees?.find(e => e.id === d.employeeId);
    return emp?.employmentStatus !== 'DRAFT';
  }).length || 0;
  const pendingLeaveCount = pendingData?.leaveRequests?.filter(l => {
    if (l.employee?.email === user?.email || l.employeeId === user?.employeeId) return false;
    if (isAdmin) return l.status === 'PENDING_HR' || l.status === 'PENDING_SUPER_ADMIN';
    return l.status === 'PENDING';
  }).length || 0;
  const pendingProfilesCount = pendingData?.profileUpdateRequests?.filter(p => {
    if (p.status !== 'PENDING') return false;
    const emp = pendingData.employees?.find(e => e.id === p.employeeId);
    return emp?.employmentStatus !== 'DRAFT';
  }).length || 0;
  const pendingProbationCount = pendingData?.allProbationRequests?.filter(p => p.status === 'PENDING').length || 0;
  const pendingOffboardingCount = pendingData?.allOffboardings?.filter(o => o.status === 'PENDING').length || 0;

  const totalApprovalsCount = pendingEmployeesCount + pendingDocumentCount + pendingLeaveCount + pendingProfilesCount + pendingProbationCount + pendingOffboardingCount;

  let baseNavItems = isEmployee && !user?.role?.includes('ADMIN') && user?.role !== 'admin' ? employeeNavigation : [...navigationStructure];

  // Append settings if admin
  if (user?.role?.includes('ADMIN') || user?.role === 'admin' || user?.isOrgOwner) {
    baseNavItems.push({
      title: "Settings",
      icon: Settings,
      isParent: true,
      children: [
        { title: "General Settings", url: createPageUrl("Settings"), icon: Settings },
        { title: "Approval Workflows", url: createPageUrl("SettingsApprovalWorkflows"), icon: CheckCircle },
        { title: "Work Shifts", url: createPageUrl("SettingsShifts"), icon: Clock },
        { title: "Departments", url: createPageUrl("SettingsDepartments"), icon: Users },
        { title: "Leave Types", url: createPageUrl("SettingsLeaveTypes"), icon: CalendarRange },
        { title: "Public Holidays", url: createPageUrl("SettingsPublicHolidays"), icon: Calendar },
        { title: "Audit Logs", url: createPageUrl("AuditLogs"), icon: ShieldCheck }
      ]
    });
  }

  const navItems = baseNavItems.map(item => {
    if (item.title === "Dashboard") {
      return {
        ...item,
        badge: totalApprovalsCount > 0 ? totalApprovalsCount : undefined,
        children: item.children.map(child => {
          if (child.title === "Approvals") {
            return { ...child, badge: totalApprovalsCount > 0 ? totalApprovalsCount : undefined };
          }
          return child;
        })
      };
    }
    if (item.title === "Recruitment") {
      return {
        ...item,
        badge: pendingOffboardingCount > 0 ? pendingOffboardingCount : undefined,
        children: item.children.map(child => {
          if (child.title === "Offboarding") {
            return { ...child, badge: pendingOffboardingCount > 0 ? pendingOffboardingCount : undefined };
          }
          return child;
        })
      };
    }
    if (item.title === "Employees") {
      const empBadgeCount = pendingLeaveCount + pendingProfilesCount;
      return {
        ...item,
        badge: empBadgeCount > 0 ? empBadgeCount : undefined,
        children: item.children.map(child => {
          if (child.title === "Leave Management" && pendingLeaveCount > 0) {
            return { ...child, badge: pendingLeaveCount };
          }
          return child;
        })
      };
    }
    return item;
  });

  // Sync active primary based on URL or manual selection
  const getActivePrimaryNav = () => {
    if (manualActivePrimary) return manualActivePrimary;
    for (const item of navItems) {
      if (item.children && item.children.some(child => location.pathname === child.url)) {
        return item;
      }
    }
    return navItems[0];
  };

  const activePrimary = getActivePrimaryNav();

  const handlePrimaryClick = (item) => {
    setManualActivePrimary(item);
  };

  // Reset manual state when a sub-menu link is actually clicked and the URL changes
  useEffect(() => {
    setManualActivePrimary(null);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex w-full bg-slate-50 font-sans">
      
      {/* Mobile Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 md:hidden sticky top-0 z-30 flex items-center gap-4">
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 -ml-2 rounded-lg hover:bg-slate-100">
          <Menu className="w-6 h-6 text-slate-700" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo-icon.png" alt="Logo" className="w-6 h-6" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">TradeVu</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">

        </div>
      </header>

      {/* Primary Rail (Leftmost Sidebar) */}
      <aside className={`fixed md:sticky top-0 h-screen w-16 flex flex-col items-center py-5 border-r flex-shrink-0 z-50 transition-colors duration-300 ${
        isDark ? 'bg-[#0f172a] border-slate-800' : 'bg-slate-50 border-slate-200'
      } ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* Logo */}
        <div className="mb-8 w-10 h-10 flex items-center justify-center">
          <img src={isDark ? "/logo-icon-white.png" : "/logo-icon.png"} alt="TradeVu" className="w-8 h-8 object-contain" />
        </div>

        {/* Icons */}
        <nav className="flex-1 flex flex-col gap-2 w-full px-2 overflow-y-auto hide-scrollbar">
          <TooltipProvider delayDuration={200}>
            {navItems.map((item, i) => {
              const isActive = activePrimary?.title === item.title;
              return (
                <Tooltip key={item.title}>
                  <TooltipTrigger asChild>
                    <motion.button
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 24 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        handlePrimaryClick(item);
                        if (window.innerWidth < 768) setIsMobileMenuOpen(false);
                      }}
                      className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center transition-colors group relative ${
                        isActive 
                          ? (isDark ? 'bg-indigo-500 text-white shadow-sm' : 'bg-white shadow-sm text-slate-900 border border-slate-200') 
                          : (isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900')
                      }`}
                    >
                      <item.icon className={`w-5 h-5 transition-all ${isActive ? 'stroke-[2.5px] scale-110' : 'stroke-2'}`} />
                      {item.badge && (
                        <div className={`absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 ${isDark ? 'border-slate-900' : 'border-slate-50'}`}>
                          {item.badge}
                        </div>
                      )}
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={14} className="z-[100] font-medium bg-slate-900 text-white border-none shadow-md">
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </nav>

        {/* Theme Toggle & Avatar */}
        <div className="mt-auto flex flex-col gap-3 items-center w-full px-2 pt-4 pb-2">


          <button onClick={toggleTheme} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'}`}>
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-10 h-10 rounded-full overflow-hidden border-2 border-transparent hover:border-indigo-500 transition-all outline-none">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                    <UserCircle className="w-5 h-5" />
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" className="w-48 ml-4">
              <div className="px-2 py-2 border-b border-slate-100 mb-1">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.full_name || 'User'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <DropdownMenuItem onClick={() => navigate('/Profile')}>
                <UserCircle className="w-4 h-4 mr-2" />
                My Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:bg-red-50">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Secondary Sidebar (Sub-navigation) */}
      <aside className="hidden md:flex h-screen w-64 bg-white border-r border-slate-200 flex-col flex-shrink-0 sticky top-0 z-10 shadow-sm">
        <div className="px-5 py-6">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{activePrimary?.title}</h2>
        </div>
        

        <div className="flex-1 overflow-y-auto px-3 pb-6 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePrimary?.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-1"
            >
              {activePrimary?.children?.map(child => {
                const isActive = location.pathname === child.url;
                return (
                  <Link 
                    key={child.title}
                    to={child.url}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                      isActive 
                        ? 'bg-slate-100 text-slate-900 translate-x-1' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-1'
                    }`}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="activeIndicator"
                        className="absolute left-0 w-1 h-6 bg-indigo-600 rounded-r-full" 
                      />
                    )}
                    <child.icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-110' : ''}`} />
                    {child.title}
                    {child.badge && (
                      <span className="ml-auto bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                        {child.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-auto bg-slate-50">
        <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Mobile Secondary Menu (Slide up or just inline - for MVP we can just use the desktop ones if screen is wide enough, but for true mobile we need a drawer) */}
    </div>
  );
}