import React from "react";
import { useQuery } from "@tanstack/react-query";
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Gift, CalendarDays, PartyPopper } from "lucide-react";
import { format } from "date-fns";

const UPCOMING_CELEBRATIONS = gql`
  query UpcomingCelebrations($month: Int!) {
    upcomingCelebrations(month: $month) {
      employeeId
      fullName
      type
      date
      years
    }
  }
`;

export default function CelebrationsWidget() {
  const currentMonth = new Date().getMonth() + 1; // 1-12
  
  const { data: celebrations = [], isLoading } = useQuery({
    queryKey: ['upcoming-celebrations', currentMonth],
    queryFn: async () => {
      const data = await gqlClient.request(UPCOMING_CELEBRATIONS, { month: currentMonth });
      return data.upcomingCelebrations || [];
    }
  });

  if (isLoading) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-200 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PartyPopper className="w-5 h-5 text-pink-500" />
            Celebrations This Month
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 flex justify-center text-slate-500">
          Loading...
        </CardContent>
      </Card>
    );
  }

  // Sort celebrations by date within the month
  const sortedCelebrations = [...celebrations].sort((a, b) => {
    return new Date(a.date).getDate() - new Date(b.date).getDate();
  });

  return (
    <Card className="border-slate-200 bg-gradient-to-b from-white to-pink-50/30">
      <CardHeader className="border-b border-slate-200 pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PartyPopper className="w-5 h-5 text-pink-500" />
            This Month's Celebrations
          </div>
          <span className="text-xs font-normal text-slate-500">
            {format(new Date(), 'MMMM')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {sortedCelebrations.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <Gift className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm">No celebrations this month.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {sortedCelebrations.map((event, idx) => {
              const dateObj = new Date(event.date);
              const isBirthday = event.type === 'BIRTHDAY';
              
              return (
                <div key={`${event.employeeId}-${idx}`} className="flex items-center p-4 hover:bg-slate-50 transition-colors">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isBirthday ? 'bg-pink-100' : 'bg-blue-100'}`}>
                    {isBirthday ? (
                      <Gift className="w-5 h-5 text-pink-600" />
                    ) : (
                      <CalendarDays className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {event.fullName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {isBirthday ? 'Birthday' : `${event.years} Year Anniversary`}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0 flex flex-col items-end">
                    <span className="text-sm font-semibold text-slate-700">
                      {format(dateObj, 'MMM d')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
