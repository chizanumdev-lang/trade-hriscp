import React from "react";
import { useQuery } from "@tanstack/react-query";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const GET_TASKS = gql`
  query GetTasks($employeeId: ID) {
    onboardingTasks(employeeId: $employeeId) {
      id
      isCompleted
    }
  }
`;

export default function OnboardingProgressWidget({ employeeId, employee, onCompleteAction, onSetToActive, onBeginOffboarding }) {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['onboarding-tasks', employeeId],
    queryFn: async () => {
      const data = await gqlClient.request(GET_TASKS, { employeeId });
      return data.onboardingTasks || [];
    },
    enabled: !!employeeId
  });

  const isProbation = employee?.employmentStatus === 'PROBATION';
  const isActiveOrOffboarded = employee?.employmentStatus === 'ACTIVE' || employee?.employmentStatus === 'OFFBOARDED';

  if (isLoading || (!isProbation && tasks.length === 0) || isActiveOrOffboarded) return null;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.isCompleted).length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const parseSafeDateObj = (d) => {
    if (!d) return null;
    const asNum = Number(d);
    const parsed = new Date(isNaN(asNum) ? d : asNum);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  let probationDaysLeft = null;
  let isProbationEnd = false;
  let endDateDisplay = null;

  if (isProbation) {
    let end = parseSafeDateObj(employee?.probationEndDate);
    if (!end) {
      end = parseSafeDateObj(employee?.hireDate);
      if (end) end.setMonth(end.getMonth() + 3); // 3 months default
    }

    if (end) {
      endDateDisplay = end.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      const today = new Date();
      end.setHours(0,0,0,0);
      today.setHours(0,0,0,0);
      const diff = end.getTime() - today.getTime();
      probationDaysLeft = Math.ceil(diff / (1000 * 3600 * 24));
      isProbationEnd = probationDaysLeft <= 0;
    }
  }

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100 mb-6 shadow-sm">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 border border-blue-100">
            <ClipboardCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 w-full">
            {isProbation ? (
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-semibold text-slate-900">Probation Status</h4>
                    <p className="text-sm text-slate-500">
                      {endDateDisplay ? `Ends on ${endDateDisplay}` : "End date pending"}
                    </p>
                  </div>
                  {probationDaysLeft !== null && (
                    <div className="text-right">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block mb-1">Time Remaining</span>
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${isProbationEnd ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {isProbationEnd ? 'Probation Ended' : `${probationDaysLeft} days left`}
                      </span>
                    </div>
                  )}
                </div>
                {(isProbationEnd || probationDaysLeft === null) && (
                  <div className="flex gap-3 mt-4">
                    <Button 
                      onClick={onSetToActive}
                      className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                    >
                      Set to Active
                    </Button>
                    <Button 
                      onClick={onBeginOffboarding}
                      variant="outline"
                      className="flex-1 text-sm border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      Begin Offboarding
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-900">Onboarding Progress</h4>
                    <p className="text-sm text-slate-500">{completedTasks} of {totalTasks} tasks completed</p>
                  </div>
                  <span className="text-lg font-bold text-blue-700">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2 bg-blue-100 mb-3" />
                {progress === 100 && onCompleteAction && employee?.employment_status !== 'ACTIVE' && employee?.employment_status !== 'OFFBOARDED' && (
                  <Button 
                    onClick={onCompleteAction}
                    className="mt-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md font-medium transition-colors"
                  >
                    Set Employee to Probation
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
