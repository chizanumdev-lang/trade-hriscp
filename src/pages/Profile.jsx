import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { UserCircle, Upload, Lock, Share2, Bell, Save, Check, Linkedin, Twitter, Github, Facebook } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Profile() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    job_title: '',
    department: '',
  });

  const [socialAccounts, setSocialAccounts] = useState({
    linkedin: '',
    twitter: '',
    github: '',
    facebook: '',
  });

  const [preferences, setPreferences] = useState({
    language: 'en',
    timezone: 'Asia/Riyadh',
    notifications: {
      email: true,
      push: true,
    }
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = {
          email: "mock_user@example.com",
          role: "admin",
          organization_id: "org_1",
          full_name: "Mock User",
          phone: "1234567890",
          job_title: "Mock Employee",
          department: "Engineering",
        };
        setUser(currentUser);
        setProfileData({
          full_name: currentUser.full_name || '',
          email: currentUser.email || '',
          phone: currentUser.phone || '',
          job_title: currentUser.job_title || '',
          department: currentUser.department || '',
        });
        setSocialAccounts(currentUser.social_accounts || {
          linkedin: '',
          twitter: '',
          github: '',
          facebook: '',
        });
        setPreferences(currentUser.preferences || {
          language: 'en',
          timezone: 'Asia/Riyadh',
          notifications: {
            email: true,
            push: true,
          }
        });
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock update me", data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const file_url = URL.createObjectURL(file);
      console.log("Mock update avatar_url", file_url);
      queryClient.invalidateQueries();
      setUser(prev => ({ ...prev, avatar_url: file_url }));
    } catch (error) {
      console.error("Error uploading avatar:", error);
    }
    setUploadingAvatar(false);
  };

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileData);
  };

  const handleSocialAccountsSubmit = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate({ social_accounts: socialAccounts });
  };

  const handlePreferencesSubmit = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate({ preferences });
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordData.new_password.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    // In production, this would call a real password change API
    // For now, we'll simulate success
    setTimeout(() => {
      setPasswordSuccess(true);
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      setTimeout(() => setPasswordSuccess(false), 3000);
    }, 500);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
            <UserCircle className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-slate-700">My Profile</span>
          </div>
          
          <p className="text-lg text-slate-600">
            Manage your personal information and preferences
          </p>
        </div>

        {/* Avatar Section */}
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-blue-100" />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <UserCircle className="w-16 h-16 text-white" />
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-slate-900">{user.full_name}</h2>
                <p className="text-slate-600 mb-3">{user.email}</p>
                <input
                  type="file"
                  id="avatar"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('avatar').click()}
                  disabled={uploadingAvatar}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
                </Button>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {user.role === 'admin' ? 'Admin' : 'User'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="general">
              <UserCircle className="w-4 h-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="social">
              <Share2 className="w-4 h-4 mr-2" />
              Social Accounts
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <Bell className="w-4 h-4 mr-2" />
              Preferences
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general">
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={profileData.full_name}
                        onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        disabled
                        className="bg-slate-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={profileData.phone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="job_title">Job Title</Label>
                      <Input
                        id="job_title"
                        value={profileData.job_title}
                        onChange={(e) => setProfileData(prev => ({ ...prev, job_title: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" isLoading={updateProfileMutation.isPending}>
                      <Save className="w-4 h-4 mr-2" />
                      {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>Change Password</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {passwordSuccess && (
                  <Alert className="mb-6 border-green-200 bg-green-50">
                    <Check className="w-4 h-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Password changed successfully!
                    </AlertDescription>
                  </Alert>
                )}
                {passwordError && (
                  <Alert className="mb-6 border-red-200 bg-red-50">
                    <AlertDescription className="text-red-800">
                      {passwordError}
                    </AlertDescription>
                  </Alert>
                )}
                <form onSubmit={handlePasswordChange} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="current_password">Current Password</Label>
                    <Input
                      id="current_password"
                      type="password"
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_password">New Password</Label>
                    <Input
                      id="new_password"
                      type="password"
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                      required
                    />
                    <p className="text-xs text-slate-500">Must be at least 8 characters long</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirm New Password</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit">
                      <Lock className="w-4 h-4 mr-2" />
                      Update Password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Social Accounts Tab */}
          <TabsContent value="social">
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>Connected Accounts</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSocialAccountsSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Linkedin className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="linkedin">LinkedIn Profile</Label>
                        <Input
                          id="linkedin"
                          placeholder="https://linkedin.com/in/yourprofile"
                          value={socialAccounts.linkedin}
                          onChange={(e) => setSocialAccounts(prev => ({ ...prev, linkedin: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center">
                        <Twitter className="w-6 h-6 text-sky-600" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="twitter">Twitter Profile</Label>
                        <Input
                          id="twitter"
                          placeholder="https://twitter.com/yourusername"
                          value={socialAccounts.twitter}
                          onChange={(e) => setSocialAccounts(prev => ({ ...prev, twitter: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Github className="w-6 h-6 text-slate-700" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="github">GitHub Profile</Label>
                        <Input
                          id="github"
                          placeholder="https://github.com/yourusername"
                          value={socialAccounts.github}
                          onChange={(e) => setSocialAccounts(prev => ({ ...prev, github: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Facebook className="w-6 h-6 text-blue-700" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="facebook">Facebook Profile</Label>
                        <Input
                          id="facebook"
                          placeholder="https://facebook.com/yourprofile"
                          value={socialAccounts.facebook}
                          onChange={(e) => setSocialAccounts(prev => ({ ...prev, facebook: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" isLoading={updateProfileMutation.isPending}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Accounts
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handlePreferencesSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-slate-900">Email Notifications</h4>
                        <p className="text-sm text-slate-500">Receive notifications via email</p>
                      </div>
                      <Switch
                        checked={preferences.notifications?.email}
                        onCheckedChange={(checked) => setPreferences(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications, email: checked }
                        }))}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-slate-900">Push Notifications</h4>
                        <p className="text-sm text-slate-500">Receive push notifications in browser</p>
                      </div>
                      <Switch
                        checked={preferences.notifications?.push}
                        onCheckedChange={(checked) => setPreferences(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications, push: checked }
                        }))}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" isLoading={updateProfileMutation.isPending}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Preferences
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}