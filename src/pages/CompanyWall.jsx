import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Home, Heart, MessageSquare, Send, Image, Video, PinIcon, Upload, Users } from "lucide-react";
import { format } from "date-fns";
import CelebrationsWidget from "@/components/dashboard/CelebrationsWidget";

export default function CompanyWall() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [postText, setPostText] = useState('');
  const [commentText, setCommentText] = useState({});
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [visibility, setVisibility] = useState('all');
  const [selectedDepartments, setSelectedDepartments] = useState([]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Mock user load
        const currentUser = {
          email: "mock_user@example.com",
          full_name: "Mock User",
          role: "admin",
          is_organization_owner: true,
          organization_id: "org_1",
          avatar_url: null,
        };
        setUser(currentUser);
        setIsAdmin(currentUser.role === 'admin' || currentUser.is_organization_owner);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: posts = [] } = useQuery({
    queryKey: ['company-posts'],
    queryFn: async () => {
      // Mock posts data
      return [
        {
          id: 'post_1',
          created_date: new Date().toISOString(),
          posted_by_name: 'Mock Admin',
          posted_by: 'mock_admin@example.com',
          content: 'Welcome to the new Company Wall!',
          visibility: 'all',
          likes: [],
          likes_count: 0,
          comments_count: 0,
          media: []
        }
      ];
    },
    initialData: [],
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['post-comments'],
    queryFn: async () => {
      // Mock comments data
      return [];
    },
    initialData: [],
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      // Mock departments data
      return [
        { id: 'dept_1', name: 'Engineering' },
        { id: 'dept_2', name: 'HR' }
      ];
    },
    initialData: [],
  });

  const createPostMutation = useMutation({
    mutationFn: async (data) => {
      // Mock create post
      console.log("Mock create post", data);
      return { id: `post_${Date.now()}`, ...data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-posts'] });
      setPostText('');
      setMediaFiles([]);
      setVisibility('all');
      setSelectedDepartments([]);
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async (data) => {
      // Mock create comment
      console.log("Mock create comment", data);
      return { id: `comment_${Date.now()}`, ...data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-comments'] });
      queryClient.invalidateQueries({ queryKey: ['company-posts'] });
      setCommentText({});
    },
  });

  const toggleLikeMutation = useMutation({
    mutationFn: async ({ postId, likes }) => {
      // Mock toggle like
      const hasLiked = likes.includes(user.email);
      const newLikes = hasLiked 
        ? likes.filter(email => email !== user.email)
        : [...likes, user.email];
      console.log("Mock toggle like", postId, newLikes);
      return { id: postId, likes: newLikes, likes_count: newLikes.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-posts'] });
    },
  });

  const handleMediaUpload = async (files) => {
    setUploadingMedia(true);
    const uploadedMedia = [];
    
    for (const file of files) {
      try {
        const file_url = URL.createObjectURL(file);
        const type = file.type.startsWith('image/') ? 'image' : 
                    file.type.startsWith('video/') ? 'video' : 'document';
        uploadedMedia.push({ type, url: file_url });
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }
    
    setMediaFiles(prev => [...prev, ...uploadedMedia]);
    setUploadingMedia(false);
  };

  const handleCreatePost = () => {
    if (!postText.trim() && mediaFiles.length === 0) return;

    createPostMutation.mutate({
      organization_id: user.organization_id,
      posted_by: user.email,
      posted_by_name: user.full_name,
      content: postText,
      media: mediaFiles,
      visibility: visibility,
      target_departments: visibility === 'department' ? selectedDepartments : [],
    });
  };

  const handleComment = (postId) => {
    const text = commentText[postId];
    if (!text?.trim()) return;

    createCommentMutation.mutate({
      organization_id: user.organization_id,
      post_id: postId,
      commenter_email: user.email,
      commenter_name: user.full_name,
      comment: text,
      timestamp: new Date().toISOString(),
    });
  };

  const getPostComments = (postId) => {
    return comments.filter(c => c.post_id === postId);
  };

  const toggleDepartment = (deptId) => {
    setSelectedDepartments(prev => 
      prev.includes(deptId) 
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
            <Home className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-slate-700">Company Wall</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">
            Company Updates
          </h1>
          <p className="text-lg text-slate-600">
            Stay connected with your team
          </p>
        </div>

        {/* Create Post (Admin Only) */}
        {isAdmin && (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {user?.full_name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 space-y-4">
                  <Textarea
                    placeholder="Share an update with your team..."
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  
                  {/* Visibility Selection */}
                  <div className="space-y-2">
                    <Label>Who can see this post?</Label>
                    <Select value={visibility} onValueChange={setVisibility}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            All Employees
                          </div>
                        </SelectItem>
                        <SelectItem value="department">Specific Departments</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Department Selection */}
                  {visibility === 'department' && (
                    <div className="space-y-2">
                      <Label>Select Departments</Label>
                      <div className="border border-slate-200 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                        {departments.map(dept => (
                          <div key={dept.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedDepartments.includes(dept.id)}
                              onCheckedChange={() => toggleDepartment(dept.id)}
                            />
                            <Label className="cursor-pointer">{dept.name}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {mediaFiles.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {mediaFiles.map((media, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                          {media.type === 'image' ? (
                            <img src={media.url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                              <Video className="w-8 h-8 text-slate-400" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <input
                        type="file"
                        id="media-upload"
                        accept="image/*,video/*"
                        multiple
                        onChange={(e) => handleMediaUpload(Array.from(e.target.files))}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => document.getElementById('media-upload').click()}
                        disabled={uploadingMedia}
                      >
                        <Image className="w-4 h-4 mr-2" />
                        {uploadingMedia ? 'Uploading...' : 'Photo'}
                      </Button>
                      <Button type="button" variant="ghost" size="sm">
                        <Video className="w-4 h-4 mr-2" />
                        Video
                      </Button>
                    </div>
                    <Button 
                      onClick={handleCreatePost}
                      disabled={(!postText.trim() && mediaFiles.length === 0) || createPostMutation.isPending}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Post
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Posts Feed */}
        <div className="space-y-6">
          {posts.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="p-12 text-center">
                <Home className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No posts yet</h3>
                <p className="text-slate-500">Be the first to share something with your team!</p>
              </CardContent>
            </Card>
          ) : (
            posts.map(post => {
              const postComments = getPostComments(post.id);
              const hasLiked = post.likes?.includes(user?.email);
              
              return (
                <Card key={post.id} className="border-slate-200">
                  <CardContent className="p-6">
                    {/* Post Header */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {post.posted_by_name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900">{post.posted_by_name}</h4>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-500">
                            {format(new Date(post.created_date), 'MMM d, yyyy • h:mm a')}
                          </p>
                          {post.visibility === 'department' && (
                            <Badge variant="outline" className="text-xs">
                              {post.target_departments?.length} departments
                            </Badge>
                          )}
                        </div>
                      </div>
                      {post.is_pinned && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          <PinIcon className="w-3 h-3 mr-1" />
                          Pinned
                        </Badge>
                      )}
                    </div>

                    {/* Post Content */}
                    <p className="text-slate-700 mb-4 whitespace-pre-wrap">{post.content}</p>

                    {/* Media */}
                    {post.media && post.media.length > 0 && (
                      <div className={`grid ${post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2 mb-4`}>
                        {post.media.map((media, idx) => (
                          <div key={idx} className="rounded-lg overflow-hidden border border-slate-200">
                            {media.type === 'image' ? (
                              <img src={media.url} alt="" className="w-full h-auto" />
                            ) : media.type === 'video' ? (
                              <video src={media.url} controls className="w-full h-auto" />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-6 pt-4 border-t border-slate-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLikeMutation.mutate({ postId: post.id, likes: post.likes || [] })}
                        className={hasLiked ? 'text-red-600' : ''}
                      >
                        <Heart className={`w-4 h-4 mr-2 ${hasLiked ? 'fill-current' : ''}`} />
                        {post.likes_count || 0}
                      </Button>
                      <Button variant="ghost" size="sm">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        {post.comments_count || 0}
                      </Button>
                    </div>

                    {/* Comments */}
                    {postComments.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                        {postComments.map(comment => (
                          <div key={comment.id} className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                              {comment.commenter_name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 bg-slate-50 rounded-lg p-3">
                              <h5 className="font-semibold text-sm text-slate-900">{comment.commenter_name}</h5>
                              <p className="text-sm text-slate-700">{comment.comment}</p>
                              <span className="text-xs text-slate-500 mt-1">
                                {format(new Date(comment.timestamp || comment.created_date), 'h:mm a')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Comment */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                          {user?.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <Input
                          placeholder="Write a comment..."
                          value={commentText[post.id] || ''}
                          onChange={(e) => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleComment(post.id);
                            }
                          }}
                          className="flex-1"
                        />
                        <Button 
                          size="sm"
                          onClick={() => handleComment(post.id)}
                          disabled={!commentText[post.id]?.trim()}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <CelebrationsWidget />
        </div>
      </div>
    </div>
  );
}