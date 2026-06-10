import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, Rocket, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function OrganizationSetup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [user, setUser] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    industry: 'technology',
    size: '1-10',
    country: 'Saudi Arabia',
    city: '',
    phone: '',
    email: '',
    subscription_plan: 'trial',
  });

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
        setFormData(prev => ({ ...prev, email: currentUser.email }));

        // Mock check if user already has an organization
        // const orgs = await base44.entities.Organization.filter({ owner_email: currentUser.email });
        // if (orgs.length > 0) {
        //   navigate('/Dashboard');
        // }
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const createOrganizationMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock create organization", data);
      
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const features_enabled = {
        attendance: true,
        payroll: true,
        recruitment: true,
        lms: true,
        surveys: true,
        expenses: true,
        zkteco: false,
        whatsapp: false,
        ai_features: true,
      };

      const org = {
        ...data,
        id: `org_${Date.now()}`,
        owner_email: user.email,
        subscription_status: 'trial',
        trial_ends_at: trialEndsAt.toISOString().split('T')[0],
        max_employees: 50,
        features_enabled,
      };

      return org;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setStep(3);
      setTimeout(() => {
        navigate('/Dashboard');
      }, 2000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      createOrganizationMutation.mutate(formData);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-2xl border-slate-200">
        <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl mb-2">Welcome to EonHR! 🎉</CardTitle>
            <p className="text-slate-600">Let's set up your organization in just a few steps</p>
          </div>
        </CardHeader>

        <CardContent className="p-8">
          {step === 3 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">All Set! 🚀</h2>
              <p className="text-slate-600 mb-2">Your organization has been created successfully.</p>
              <p className="text-sm text-slate-500">Redirecting to dashboard...</p>
            </div>
          ) : (
            <>
              {/* Progress Steps */}
              <div className="flex items-center justify-center mb-8">
                <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-slate-400'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>
                    1
                  </div>
                  <span className="ml-2 font-medium">Company Info</span>
                </div>
                <div className={`w-16 h-0.5 mx-4 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>
                    2
                  </div>
                  <span className="ml-2 font-medium">Details</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {step === 1 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">Company Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter your company name"
                        required
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="industry">Industry</Label>
                        <Select value={formData.industry} onValueChange={(value) => setFormData(prev => ({ ...prev, industry: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="technology">Technology</SelectItem>
                            <SelectItem value="healthcare">Healthcare</SelectItem>
                            <SelectItem value="education">Education</SelectItem>
                            <SelectItem value="retail">Retail</SelectItem>
                            <SelectItem value="manufacturing">Manufacturing</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                            <SelectItem value="hospitality">Hospitality</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="size">Company Size</Label>
                        <Select value={formData.size} onValueChange={(value) => setFormData(prev => ({ ...prev, size: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1-10">1-10 employees</SelectItem>
                            <SelectItem value="11-50">11-50 employees</SelectItem>
                            <SelectItem value="51-200">51-200 employees</SelectItem>
                            <SelectItem value="201-500">201-500 employees</SelectItem>
                            <SelectItem value="501-1000">501-1000 employees</SelectItem>
                            <SelectItem value="1000+">1000+ employees</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          value={formData.country}
                          onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                          placeholder="e.g., Riyadh"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Company Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+966 XXX XXX XXX"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Company Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="contact@company.com"
                      />
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Rocket className="w-6 h-6 text-blue-600 mt-1" />
                        <div>
                          <h4 className="font-semibold text-blue-900 mb-1">14-Day Free Trial</h4>
                          <p className="text-sm text-blue-700">
                            Start with a free trial. No credit card required. Access all features!
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-between pt-4">
                  {step > 1 && (
                    <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                      Back
                    </Button>
                  )}
                  <Button
                    type="submit"
                    className="ml-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    isLoading={createOrganizationMutation.isPending}
                  >
                    {step === 1 ? 'Continue' : createOrganizationMutation.isPending ? 'Creating...' : 'Complete Setup'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}