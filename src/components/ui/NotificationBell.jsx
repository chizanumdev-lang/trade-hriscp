import React, { useState } from 'react';
import { Bell, Check, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gqlClient } from '@/api/graphqlClient';
import { gql } from 'graphql-request';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    notifications {
      id
      category
      title
      message
      channel
      isRead
      deepLink
      createdAt
    }
  }
`;

const MARK_READ = gql`
  mutation MarkRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      isRead
    }
  }
`;

export default function NotificationBell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: { notifications = [] } = {}, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => gqlClient.request(GET_NOTIFICATIONS),
    refetchInterval: 10000, // Poll every 10s
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => gqlClient.request(MARK_READ, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    setOpen(false);
    if (notification.deepLink) {
      navigate(notification.deepLink);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors focus:outline-none">
          <Bell className="w-5 h-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute top-1 right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-50 flex items-center justify-center"
              >
                <span className="text-[9px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>
      
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0 overflow-hidden rounded-xl border border-slate-200 shadow-xl">
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              {unreadCount} New
            </span>
          )}
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-slate-500">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center">
              <Bell className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">All caught up!</p>
              <p className="text-xs text-slate-400 mt-1">No new notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map(notification => (
                <div 
                  key={notification.id} 
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 flex gap-3 ${!notification.isRead ? 'bg-indigo-50/30' : ''}`}
                >
                  <div className="mt-1 flex-shrink-0">
                    {!notification.isRead ? (
                      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />
                    ) : (
                      <Circle className="w-3 h-3 text-slate-300 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm mb-1 leading-snug ${!notification.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">
                      {formatDistanceToNow(new Date(parseInt(notification.createdAt)), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {notifications.length > 0 && (
          <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
            <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700 p-1 w-full rounded hover:bg-indigo-50 transition-colors">
              Mark all as read
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
