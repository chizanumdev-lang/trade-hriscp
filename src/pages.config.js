/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdvancedAnalytics from './pages/AdvancedAnalytics';
import AllLeaveRequests from './pages/AllLeaveRequests';
import Analytics from './pages/Analytics';
import AuditLogs from './pages/AuditLogs';
import Assets from './pages/Assets';
import Attendance from './pages/Attendance';
import Chat from './pages/Chat';
import CompanyWall from './pages/CompanyWall';
import Compensation from './pages/Compensation';
import PayrollAdjustments from './pages/PayrollAdjustments';
import ComplianceDashboard from './pages/ComplianceDashboard';
import Dashboard from './pages/Dashboard';
import EmployeeDetail from './pages/EmployeeDetail';
import EmployeePortal from './pages/EmployeePortal';
import EmployeeSelfService from './pages/EmployeeSelfService';
import Employees from './pages/Employees';
import Evaluations from './pages/Evaluations';
import Expenses from './pages/Expenses';
import HRAssistant from './pages/HRAssistant';
import HRLetters from './pages/HRLetters';
import Home from './pages/Home';
import LeaveManagement from './pages/LeaveManagement';
import Loans from './pages/Loans';
import Offboarding from './pages/Offboarding';
import OrganizationSetup from './pages/OrganizationSetup';
import Organogram from './pages/Organogram';
import Payroll from './pages/Payroll';
import PayrollAI from './pages/PayrollAI';
import PayrollReports from './pages/PayrollReports';
import Profile from './pages/Profile';
import Recruitment from './pages/Recruitment';
import Settings from './pages/Settings';
import SettingsApprovalWorkflows from './pages/Settings/SettingsApprovalWorkflows';
import SettingsShifts from './pages/Settings/SettingsShifts';
import SettingsDepartments from './pages/Settings/SettingsDepartments';
import SettingsLeaveTypes from './pages/SettingsLeaveTypes';
import SettingsPublicHolidays from './pages/SettingsPublicHolidays';
import SettingsStatutory from './pages/SettingsStatutory';
import Surveys from './pages/Surveys';
import TaskManager from './pages/TaskManager';
import Templates from './pages/Templates';
import Training from './pages/Training';
import Performance from './pages/Performance';
import KnowledgeBank from './pages/KnowledgeBank';
import Login from './pages/Login';
import PendingApprovals from './pages/PendingApprovals';
import __Layout from './Layout.jsx';

export const PAGES = {
    "AdvancedAnalytics": AdvancedAnalytics,
    "AllLeaveRequests": AllLeaveRequests,
    "Analytics": Analytics,
    "AuditLogs": AuditLogs,
    "Assets": Assets,
    "Attendance": Attendance,
    "Chat": Chat,
    "CompanyWall": CompanyWall,
    "Compensation": Compensation,
    "PayrollAdjustments": PayrollAdjustments,
    "PayrollReports": PayrollReports,
    "ComplianceDashboard": ComplianceDashboard,
    "Dashboard": Dashboard,
    "EmployeeDetail": EmployeeDetail,
    "EmployeePortal": EmployeePortal,
    "EmployeeSelfService": EmployeeSelfService,
    "Employees": Employees,
    "Evaluations": Evaluations,
    "Expenses": Expenses,
    "HRAssistant": HRAssistant,
    "HRLetters": HRLetters,
    "Home": Home,
    "LeaveManagement": LeaveManagement,
    "Loans": Loans,
    "Offboarding": Offboarding,
    "OrganizationSetup": OrganizationSetup,
    "Organogram": Organogram,
    "Payroll": Payroll,
    "PayrollAI": PayrollAI,
    "Profile": Profile,
    "Recruitment": Recruitment,
    "Settings": Settings,
    "SettingsApprovalWorkflows": SettingsApprovalWorkflows,
    "SettingsShifts": SettingsShifts,
    "SettingsDepartments": SettingsDepartments,
    "SettingsLeaveTypes": SettingsLeaveTypes,
    "SettingsPublicHolidays": SettingsPublicHolidays,
    "SettingsStatutory": SettingsStatutory,
    "Surveys": Surveys,
    "TaskManager": TaskManager,
    "Templates": Templates,
    "Training": Training,
    "Performance": Performance,
    "KnowledgeBank": KnowledgeBank,
    "Login": Login,
    "PendingApprovals": PendingApprovals,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};