import React, { useState, useMemo, useEffect } from "react";
import { 
  eachMonthOfInterval, startOfMonth, endOfMonth, eachDayOfInterval, 
  startOfYear, endOfYear, format, getDay, isWeekend
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LeaveHeatmapCalendar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const isAdmin = user?.role === 'admin' || user?.is_organization_owner;

  const [selectedDates, setSelectedDates] = useState([]);
  const [viewMode, setViewMode] = useState("team"); // Default to team to show holistic calendar
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  // Generate calendar dates by month
  const months = useMemo(() => {
    const yearStart = startOfYear(new Date(currentYear, 0, 1));
    const yearEnd = endOfYear(new Date(currentYear, 11, 31));
    return eachMonthOfInterval({ start: yearStart, end: yearEnd }).map(monthStart => {
      const monthEnd = endOfMonth(monthStart);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const prefix = Array.from({ length: getDay(monthStart) }).map(() => null);
      return { monthStart, days, prefix };
    });
  }, [currentYear]);

  // Fetch data
  const { data: myPlan, isLoading: myPlanLoading } = useQuery({
    queryKey: ['myLeavePlan', currentYear],
    queryFn: async () => {
      const QUERY = gql`
        query GetMyLeavePlan($year: Int!) {
          myLeavePlans(year: $year) { id plannedDates status }
        }
      `;
      const data = await gqlClient.request(QUERY, { year: currentYear });
      return data.myLeavePlans?.[0] || null;
    }
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const QUERY = gql`query { departments { id name } }`;
      const data = await gqlClient.request(QUERY);
      return data.departments || [];
    },
    enabled: isAdmin
  });

  const { data: teamPlans, isLoading: teamPlansLoading } = useQuery({
    queryKey: ['teamLeavePlans', currentYear, selectedDepartment],
    queryFn: async () => {
      const depId = selectedDepartment === "all" ? null : selectedDepartment;
      const QUERY = gql`
        query GetTeamLeavePlans($year: Int!, $departmentId: ID) {
          teamLeavePlans(year: $year, departmentId: $departmentId) { id plannedDates employee { fullName } }
        }
      `;
      const data = await gqlClient.request(QUERY, { year: currentYear, departmentId: depId });
      return data.teamLeavePlans || [];
    }
  });

  const { data: approvedLeaves, isLoading: approvedLeavesLoading } = useQuery({
    queryKey: ['leaveCalendar', currentYear, selectedDepartment],
    queryFn: async () => {
      const depId = selectedDepartment === "all" ? null : selectedDepartment;
      const QUERY = gql`
        query GetLeaveCalendar($year: Int!, $departmentId: ID) {
          leaveCalendar(year: $year, departmentId: $departmentId) { 
            id 
            startDate 
            endDate 
            selectedDates 
            employee { fullName } 
          }
        }
      `;
      const data = await gqlClient.request(QUERY, { year: currentYear, departmentId: depId });
      return data.leaveCalendar || [];
    }
  });

  // Calculate team conflict heatmap including approved leaves
  const teamDateData = useMemo(() => {
    const counts = {};
    const details = {};

    const addDetail = (date, name, type) => {
      if (!details[date]) details[date] = [];
      if (!details[date].some(d => d.name === name && d.type === type)) {
        details[date].push({ name, type });
      }
    };

    if (teamPlans) {
      teamPlans.forEach(plan => {
        plan.plannedDates.forEach(date => {
          addDetail(date, plan.employee.fullName, 'Planned');
        });
      });
    }

    const safeDate = (val) => {
      if (!val) return new Date();
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
      const num = Number(val);
      if (!isNaN(num)) return new Date(num);
      return new Date();
    };

    if (approvedLeaves) {
      approvedLeaves.forEach(leave => {
        let dates = [];
        if (leave.selectedDates && leave.selectedDates.length > 0) {
          dates = leave.selectedDates;
        } else {
          try {
            const start = safeDate(leave.startDate);
            const end = safeDate(leave.endDate);
            const days = eachDayOfInterval({ start, end });
            dates = days.map(d => format(d, 'yyyy-MM-dd'));
          } catch (err) {
            console.error("Invalid leave dates:", leave);
          }
        }

        dates.forEach(date => {
          if (!isWeekend(new Date(date))) {
            addDetail(date, leave.employee.fullName, 'Approved');
          }
        });
      });
    }

    for (const [date, info] of Object.entries(details)) {
      const uniqueNames = [...new Set(info.map(i => i.name))];
      counts[date] = uniqueNames.length;
    }

    return { counts, details };
  }, [teamPlans, approvedLeaves]);

  // Sync selected dates from backend
  useEffect(() => {
    if (myPlan && myPlan.plannedDates) {
      setSelectedDates(myPlan.plannedDates);
    }
  }, [myPlan]);

  const submitMutation = useMutation({
    mutationFn: async (dates) => {
      const MUTATION = gql`
        mutation SubmitLeavePlan($year: Int!, $plannedDates: [String!]!) {
          submitLeavePlan(year: $year, plannedDates: $plannedDates) {
            id status
          }
        }
      `;
      return gqlClient.request(MUTATION, { year: currentYear, plannedDates: dates });
    },
    onSuccess: () => {
      toast.success("Leave plan submitted for approval");
      queryClient.invalidateQueries({ queryKey: ['myLeavePlan'] });
    },
    onError: (err) => {
      toast.error("Failed to submit plan");
      console.error(err);
    }
  });

  const handleDayClick = (day) => {
    if (!day || viewMode === "team") return;
    if (isWeekend(day)) return; // Don't allow selecting weekends

    const dateStr = format(day, "yyyy-MM-dd");
    setSelectedDates(prev => 
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleAddRange = () => {
    if (!rangeStart || !rangeEnd) return;
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    if (start > end) {
      toast.error("Start date must be before end date");
      return;
    }
    const days = eachDayOfInterval({ start, end });
    const newDates = [];
    days.forEach(day => {
      if (!isWeekend(day)) {
        newDates.push(format(day, "yyyy-MM-dd"));
      }
    });
    setSelectedDates(prev => {
      const merged = new Set([...prev, ...newDates]);
      return Array.from(merged).sort();
    });
    setRangeStart("");
    setRangeEnd("");
    toast.success(`Added ${newDates.length} days to plan.`);
  };

  const getCellClasses = (day) => {
    if (!day) return "bg-transparent";
    
    const dateStr = format(day, "yyyy-MM-dd");
    const weekend = isWeekend(day);

    if (viewMode === "personal") {
      if (selectedDates.includes(dateStr)) return "bg-green-500 text-white hover:bg-green-600 cursor-pointer shadow-sm border border-green-600 font-medium";
      if (weekend) return "bg-slate-50 dark:bg-slate-800/40 text-muted-foreground/60 cursor-not-allowed";
      return "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer border border-transparent";
    } else {
      // Team mode - heatmap
      if (weekend) return "bg-slate-50 dark:bg-slate-800/40 text-muted-foreground/60 border border-transparent";
      const count = teamDateData.counts[dateStr] || 0;
      if (count === 0) return "bg-slate-100 dark:bg-slate-800 border border-transparent";
      
      const details = teamDateData.details[dateStr] || [];
      const hasApproved = details.some(d => d.type === 'Approved');
      
      // If approved, give a stronger color like blue/indigo instead of orange
      if (hasApproved) {
        if (count === 1) return "bg-indigo-400 text-white font-medium border border-indigo-500";
        if (count === 2) return "bg-indigo-600 text-white font-medium border border-indigo-700 shadow-sm";
        return "bg-indigo-800 text-white font-medium border border-indigo-900 shadow-sm";
      } else {
        if (count === 1) return "bg-orange-300 text-orange-950 font-medium border border-orange-400";
        if (count === 2) return "bg-orange-500 text-white font-medium border border-orange-600 shadow-sm";
        return "bg-red-600 text-white font-medium border border-red-700 shadow-sm";
      }
    }
  };

  const getTooltipContent = (day) => {
    if (!day) return null;
    const dateStr = format(day, "yyyy-MM-dd");
    if (viewMode === "personal") {
      return format(day, "MMMM d, yyyy");
    } else {
      const details = teamDateData.details[dateStr] || [];
      if (details.length === 0) return format(day, "MMMM d, yyyy");
      
      const lines = details.map(d => `${d.name} (${d.type})`);
      return (
        <div className="flex flex-col gap-1">
          <div className="font-bold border-b pb-1 mb-1">{format(day, "MMMM d, yyyy")}</div>
          {lines.map((line, idx) => <div key={idx}>{line}</div>)}
        </div>
      );
    }
  };

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between bg-muted/20 gap-4">
        <div>
          <CardTitle>Annual Leave Planner - {currentYear}</CardTitle>
          <CardDescription className="max-w-xl mt-1.5">
            {viewMode === "personal" 
              ? "Select days to map out your planned leave for the year. Weekends are automatically excluded."
              : "Viewing aggregated team leave plans. Darker colors indicate multiple team members have planned leave on the same day."}
          </CardDescription>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {isAdmin && viewMode === "team" && departments && departments.length > 0 && (
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[180px] bg-white dark:bg-slate-900">
                <SelectValue placeholder="Filter Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Company</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button 
            variant="outline" 
            onClick={() => setViewMode(v => v === "personal" ? "team" : "personal")}
          >
            {viewMode === "personal" ? "View Team Calendar" : "View Personal Plan"}
          </Button>
          {viewMode === "personal" && (
            <Button 
              onClick={() => submitMutation.mutate(selectedDates)}
              disabled={submitMutation.isPending || (myPlan?.status === 'APPROVED')}
              className="bg-primary hover:bg-primary/90"
            >
              {submitMutation.isPending ? "Submitting..." : myPlan?.status === 'APPROVED' ? "Plan Approved" : "Submit Plan"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-6">
          <div className="flex justify-between items-center text-sm font-medium">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded-sm border border-green-600 shadow-sm"></div>
              <span>Total Planned Days: {selectedDates.length}</span>
            </div>
            {myPlan && (
              <div className="flex items-center gap-2">
                Status: 
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  myPlan.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                  myPlan.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {myPlan.status}
                </span>
              </div>
            )}
          </div>
          
          {viewMode === "personal" && myPlan?.status !== 'APPROVED' && (
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-sm font-medium whitespace-nowrap">Add Date Range:</span>
              <Input 
                type="date" 
                value={rangeStart} 
                onChange={(e) => setRangeStart(e.target.value)} 
                className="max-w-[160px] bg-white dark:bg-slate-900" 
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input 
                type="date" 
                value={rangeEnd} 
                onChange={(e) => setRangeEnd(e.target.value)} 
                className="max-w-[160px] bg-white dark:bg-slate-900" 
              />
              <Button onClick={handleAddRange} variant="secondary">Add Range</Button>
              <Button onClick={() => setSelectedDates([])} variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 ml-auto">Clear All</Button>
            </div>
          )}
          
          {/* Calendar Grid - Month by Month */}
          <TooltipProvider delayDuration={100}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-10">
              {months.map(({ monthStart, days, prefix }, mIndex) => (
                <div key={mIndex} className="flex flex-col">
                  <h4 className="font-semibold text-[15px] mb-3 text-center">
                    {format(monthStart, 'MMMM')}
                  </h4>
                  
                  {/* Days of week header */}
                  <div className="grid grid-cols-7 gap-1.5 mb-2 text-center text-xs text-muted-foreground font-medium">
                    <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {[...prefix, ...days].map((day, i) => {
                      if (!day) return <div key={i} className="aspect-square" />;
                      return (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <div
                              onClick={() => handleDayClick(day)}
                              className={`aspect-square flex items-center justify-center text-[11px] rounded-md transition-all duration-200 ease-in-out select-none ${getCellClasses(day)}`}
                            >
                              {format(day, 'd')}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-popover text-popover-foreground shadow-md border">
                            <div className="font-medium text-sm">{getTooltipContent(day)}</div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </TooltipProvider>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-8 pt-6 border-t text-sm text-muted-foreground justify-end">
            {viewMode === "team" ? (
              <>
                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-sm bg-slate-100 dark:bg-slate-800"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-1.5 border-l pl-4">
                    <span className="font-medium mr-1">Planned:</span>
                    <div className="w-4 h-4 rounded-sm bg-orange-300 border border-orange-400"></div>
                    <span>1</span>
                    <div className="w-4 h-4 rounded-sm bg-orange-500 border border-orange-600 shadow-sm ml-1"></div>
                    <span>2</span>
                    <div className="w-4 h-4 rounded-sm bg-red-600 border border-red-700 shadow-sm ml-1"></div>
                    <span>3+</span>
                  </div>
                  <div className="flex items-center gap-1.5 border-l pl-4">
                    <span className="font-medium mr-1">Approved:</span>
                    <div className="w-4 h-4 rounded-sm bg-indigo-400 border border-indigo-500 shadow-sm"></div>
                    <span>1</span>
                    <div className="w-4 h-4 rounded-sm bg-indigo-600 border border-indigo-700 shadow-sm ml-1"></div>
                    <span>2</span>
                    <div className="w-4 h-4 rounded-sm bg-indigo-800 border border-indigo-900 shadow-sm ml-1"></div>
                    <span>3+</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 mr-4">
                  <div className="w-4 h-4 rounded-sm bg-slate-50 dark:bg-slate-800/40"></div>
                  <span>Weekend</span>
                </div>
                <div className="flex items-center gap-1.5 mr-4">
                  <div className="w-4 h-4 rounded-sm bg-slate-100 dark:bg-slate-800"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-sm bg-green-500 border border-green-600 shadow-sm"></div>
                  <span>Planned</span>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
