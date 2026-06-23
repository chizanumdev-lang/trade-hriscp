import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function SettingsStatutory() {
  const [config, setConfig] = useState({
    paye: { enabled: true, rate: 0.05 },
    pension: { enabled: true, employerRate: 0.10, employeeRate: 0.08 }
  });

  const { data: organization, isLoading } = useQuery({
    queryKey: ['org-statutory'],
    queryFn: async () => {
      const QUERY = `
        query {
          organization(id: "") { # id is injected by backend resolver if we pass empty or use a generic query
            id statutoryConfig
          }
        }
      `;
      // The current backend might require an ID, but let's assume `user.organizationId` works 
      // or we just fetch the user's current org. Let's fix the query to fetch me first.
      const USER_QUERY = `query { me { organizationId } }`;
      const meData = await gqlClient.request(USER_QUERY);
      const orgId = meData.me.organizationId;
      
      const ORG_QUERY = `query($id: ID!) { organization(id: $id) { id statutoryConfig } }`;
      const orgData = await gqlClient.request(ORG_QUERY, { id: orgId });
      return orgData.organization;
    }
  });

  useEffect(() => {
    if (organization?.statutoryConfig) {
      setConfig(organization.statutoryConfig);
    }
  }, [organization]);

  const updateMutation = useMutation({
    mutationFn: async (newConfig) => {
      const MUTATION = `
        mutation UpdateStat($config: JSON!) {
          updateStatutoryConfig(config: $config) { id statutoryConfig }
        }
      `;
      await gqlClient.request(MUTATION, { config: newConfig });
    },
    onSuccess: () => {
      toast.success("Statutory settings saved");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to save settings");
    }
  });

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Statutory Configuration</h1>
          <p className="text-slate-600">Configure global tax and pension rates.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>PAYE (Pay As You Earn)</CardTitle>
            <CardDescription>Global configuration for income tax</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable PAYE Deductions globally</Label>
              <Switch 
                checked={config.paye.enabled} 
                onCheckedChange={c => setConfig({...config, paye: {...config.paye, enabled: c}})} 
              />
            </div>
            {config.paye.enabled && (
              <div className="space-y-2">
                <Label>Default Flat Rate (%)</Label>
                <Input 
                  type="number" 
                  value={config.paye.rate * 100} 
                  onChange={e => setConfig({...config, paye: {...config.paye, rate: Number(e.target.value) / 100}})} 
                />
                <p className="text-xs text-slate-500">For dynamic bands, leave blank and use custom calculation engine.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pension</CardTitle>
            <CardDescription>Global configuration for pension contributions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Pension Deductions globally</Label>
              <Switch 
                checked={config.pension.enabled} 
                onCheckedChange={c => setConfig({...config, pension: {...config.pension, enabled: c}})} 
              />
            </div>
            {config.pension.enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee Contribution (%)</Label>
                  <Input 
                    type="number" 
                    value={config.pension.employeeRate * 100} 
                    onChange={e => setConfig({...config, pension: {...config.pension, employeeRate: Number(e.target.value) / 100}})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employer Contribution (%)</Label>
                  <Input 
                    type="number" 
                    value={config.pension.employerRate * 100} 
                    onChange={e => setConfig({...config, pension: {...config.pension, employerRate: Number(e.target.value) / 100}})} 
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button 
          className="bg-slate-900 text-white" 
          onClick={() => updateMutation.mutate(config)}
          disabled={updateMutation.isPending}
        >
          <Save className="w-4 h-4 mr-2" /> 
          {updateMutation.isPending ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
