import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageCircle, Send, Plus, Search, Users, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

const ConversationsSkeleton = () => (
  <div className="divide-y divide-slate-100">
    {Array(6).fill(0).map((_, i) => (
      <div key={i} className="p-4 flex items-center gap-3 animate-pulse">
        <div className="w-10 h-10 bg-slate-100 rounded-full shrink-0"></div>
        <div className="flex-1 space-y-2 py-1">
          <div className="h-3 bg-slate-100 rounded w-1/2"></div>
          <div className="h-2 bg-slate-100 rounded w-3/4"></div>
        </div>
      </div>
    ))}
  </div>
);

const MessagesSkeleton = () => (
  <div className="flex-1 overflow-y-auto p-4 space-y-6">
    <div className="flex justify-start">
      <div className="flex flex-col gap-1 w-2/3">
        <div className="h-16 bg-slate-100 rounded-2xl rounded-tl-sm animate-pulse"></div>
        <div className="h-2 w-16 bg-slate-50 rounded mx-2 mt-1 animate-pulse"></div>
      </div>
    </div>
    <div className="flex justify-end">
      <div className="flex flex-col gap-1 w-1/2 items-end">
        <div className="h-10 bg-indigo-50 rounded-2xl rounded-tr-sm animate-pulse w-full"></div>
        <div className="h-2 w-16 bg-slate-50 rounded mx-2 mt-1 animate-pulse"></div>
      </div>
    </div>
    <div className="flex justify-start">
      <div className="flex flex-col gap-1 w-1/2">
        <div className="h-12 bg-slate-100 rounded-2xl rounded-tl-sm animate-pulse"></div>
        <div className="h-2 w-16 bg-slate-50 rounded mx-2 mt-1 animate-pulse"></div>
      </div>
    </div>
  </div>
);

export default function Chat() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [groupName, setGroupName] = useState('');

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
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => [],
    initialData: [],
  });

  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ['conversations', user?.email],
    queryFn: async () => [], // Will be replaced by real fetch
    enabled: !!user,
  });

  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['messages', selectedConversation?.id],
    queryFn: async () => [], // Will be replaced by real fetch
    enabled: !!selectedConversation,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (data) => {
      return {
        ...data,
        id: `conv_${Date.now()}`,
        created_date: new Date().toISOString()
      };
    },
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setShowNewChatDialog(false);
      setSelectedParticipants([]);
      setGroupName('');
      setSelectedConversation(newConversation);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data) => {
      return {
        ...data,
        id: `msg_${Date.now()}`,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setMessageText('');
    },
  });

  const handleCreateConversation = () => {
    if (selectedParticipants.length === 0) return;
    const participants = [...selectedParticipants, user.email];
    
    createConversationMutation.mutate({
      organization_id: user.organization_id,
      conversation_type: selectedParticipants.length === 1 ? 'direct' : 'group',
      participants,
      group_name: selectedParticipants.length > 1 ? groupName : null,
      group_admin: selectedParticipants.length > 1 ? user.email : null,
    });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedConversation) return;

    sendMessageMutation.mutate({
      organization_id: user.organization_id,
      conversation_id: selectedConversation.id,
      sender_email: user.email,
      sender_name: user.full_name,
      message: messageText,
      message_type: 'text',
      timestamp: new Date().toISOString(),
    });
  };

  const toggleParticipant = (email) => {
    setSelectedParticipants(prev => 
      prev.includes(email) 
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const displayConversations = conversations || [];
  const displayMessages = messages || [];

  const filteredConversations = displayConversations.filter(conv => {
    if (!searchTerm) return true;
    return conv.group_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           conv.participants.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="p-4 md:p-8 max-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col"
    >
      <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full mb-4 w-max">
        <MessageCircle className="w-4 h-4 text-indigo-600" />
        <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Internal Comms</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-1 overflow-hidden">
        {/* Conversations List */}
        <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/30">
          <div className="p-5 border-b border-slate-100 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Messages</h2>
              <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
                <DialogTrigger asChild>
                  <Button size="icon" className="h-8 w-8 bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm">
                    <Plus className="w-4 h-4 text-white" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md border-slate-100 shadow-xl rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-slate-900 tracking-tight">New Conversation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    {selectedParticipants.length > 1 && (
                      <div className="space-y-2">
                        <Label>Group Name</Label>
                        <Input
                          placeholder="Enter group name..."
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          className="rounded-lg border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Select People</Label>
                      <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-200 bg-slate-50 rounded-xl p-3">
                        {employees
                          .filter(emp => emp.email !== user?.email)
                          .map(emp => (
                            <div key={emp.id} className="flex items-center gap-3 p-2 bg-white rounded-lg shadow-sm border border-slate-100">
                              <Checkbox
                                checked={selectedParticipants.includes(emp.email)}
                                onCheckedChange={() => toggleParticipant(emp.email)}
                              />
                              <div className="flex items-center gap-2 flex-1">
                                <div className="w-8 h-8 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs">
                                  {emp.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{emp.full_name}</p>
                                  <p className="text-[10px] text-slate-500 truncate">{emp.job_title}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                    <Button 
                      onClick={handleCreateConversation}
                      isLoading={selectedParticipants.length === 0 || createConversationMutation.isPending}
                      className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700"
                    >
                      {createConversationMutation.isPending ? 'Creating...' : 'Create Conversation'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-lg border-slate-200 bg-slate-50 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white">
            {loadingConversations ? (
              <ConversationsSkeleton />
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-3 border border-slate-100">
                  <MessageCircle className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-slate-500 text-sm font-medium">No conversations yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filteredConversations.map(conv => (
                  <motion.div
                    key={conv.id}
                    whileHover={{ backgroundColor: "rgba(248, 250, 252, 1)" }}
                    onClick={() => setSelectedConversation(conv)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedConversation?.id === conv.id ? 'bg-indigo-50/50 relative' : ''
                    }`}
                  >
                    {selectedConversation?.id === conv.id && (
                      <motion.div layoutId="activeChat" className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />
                    )}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold flex-shrink-0">
                        {conv.conversation_type === 'group' ? (
                          <Users className="w-5 h-5 text-indigo-600" />
                        ) : (
                          conv.participants.find(p => p !== user?.email)?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className={`font-semibold text-sm truncate ${selectedConversation?.id === conv.id ? 'text-indigo-900' : 'text-slate-900'}`}>
                            {conv.group_name || conv.participants.find(p => p !== user?.email)?.split('@')[0]}
                          </h4>
                          {conv.last_message_time && (
                            <span className="text-[10px] font-medium text-slate-400">
                              {format(new Date(conv.last_message_time), 'h:mm a')}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs truncate ${selectedConversation?.id === conv.id ? 'text-indigo-700' : 'text-slate-500'}`}>
                          {conv.last_message || 'No messages yet'}
                        </p>
                      </div>
                      {conv.unread_count?.[user?.email] > 0 && (
                        <Badge className="bg-indigo-600 text-white border-0 h-5 px-1.5 min-w-[20px] flex items-center justify-center shadow-sm">
                          {conv.unread_count[user.email]}
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-50/30">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between h-[73px]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                    {selectedConversation.conversation_type === 'group' ? (
                      <Users className="w-5 h-5 text-indigo-600" />
                    ) : (
                      selectedConversation.participants.find(p => p !== user?.email)?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">
                      {selectedConversation.group_name || 
                       selectedConversation.participants.find(p => p !== user?.email)?.split('@')[0]}
                    </h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      {selectedConversation.conversation_type === 'group' 
                        ? `${selectedConversation.participants.length} members`
                        : 'Direct Message'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              {loadingMessages ? (
                <MessagesSkeleton />
              ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {displayMessages.map(msg => {
                    const isOwn = msg.sender_email === user?.email;
                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={msg.id} 
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          {!isOwn && (
                            <span className="text-[10px] font-semibold text-slate-400 px-2 uppercase tracking-wider">{msg.sender_name}</span>
                          )}
                          <div className={`px-4 py-2.5 shadow-sm border ${
                            isOwn 
                              ? 'bg-indigo-600 text-white border-indigo-700 rounded-2xl rounded-tr-sm' 
                              : 'bg-white text-slate-800 border-slate-200/60 rounded-2xl rounded-tl-sm'
                          }`}>
                            <p className="text-sm leading-relaxed">{msg.message}</p>
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 px-2">
                            {format(new Date(msg.timestamp || msg.created_date), 'h:mm a')}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Message Input */}
              <div className="p-4 border-t border-slate-100 bg-white">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-4xl mx-auto">
                  <Button type="button" variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 text-slate-500 shrink-0">
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  <Input
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="flex-1 rounded-full border-slate-200 bg-slate-50 focus:bg-white px-4 transition-colors"
                  />
                  <Button 
                    type="submit" 
                    size="icon"
                    isLoading={!messageText.trim() || sendMessageMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-sm shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white">
              <div className="text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 border border-slate-100 shadow-sm">
                  <MessageCircle className="w-10 h-10 text-indigo-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
                  Your Messages
                </h3>
                <p className="text-slate-500 font-medium max-w-xs">
                  Select a conversation from the sidebar or start a new one to begin messaging.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}