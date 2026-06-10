import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Wifi, Clock, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ZKTecoSettings({ open, onClose, currentSettings }) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState({
    zkteco_enabled: false,
    zkteco_device_ip: "",
    zkteco_device_port: 4370,
    work_start_time: "09:00",
    work_end_time: "17:00",
    late_threshold_minutes: 15,
    auto_sync_enabled: false,
    sync_interval_minutes: 60,
    ...currentSettings,
  });

  const [testConnection, setTestConnection] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (currentSettings) {
      setSettings({ ...settings, ...currentSettings });
    }
  }, [currentSettings]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock save attendance settings", data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-settings'] });
      onClose();
    },
  });

  const handleTestConnection = async () => {
    setTesting(true);
    setTestConnection(null);
    
    // Simulate connection test (in production, this would make an API call to ZKTeco device)
    setTimeout(() => {
      if (settings.zkteco_device_ip && settings.zkteco_device_port) {
        setTestConnection({ success: true, message: "Successfully connected to ZKTeco device" });
      } else {
        setTestConnection({ success: false, message: "Failed to connect. Please check IP and port." });
      }
      setTesting(false);
    }, 2000);
  };

  const handleSync = async () => {
    // This would trigger a sync from ZKTeco device
    // In production, this would call a backend endpoint that communicates with the device
    alert("ZKTeco sync would be triggered here. This requires backend integration with the device.");
  };

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-600" />
            Attendance Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Work Hours Settings */}
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-200 bg-slate-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Work Hours Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="work_start_time">Work Start Time</Label>
                  <Input
                    id="work_start_time"
                    type="time"
                    value={settings.work_start_time}
                    onChange={(e) => setSettings(prev => ({ ...prev, work_start_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="work_end_time">Work End Time</Label>
                  <Input
                    id="work_end_time"
                    type="time"
                    value={settings.work_end_time}
                    onChange={(e) => setSettings(prev => ({ ...prev, work_end_time: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="late_threshold">Late Threshold (minutes)</Label>
                <Input
                  id="late_threshold"
                  type="number"
                  value={settings.late_threshold_minutes}
                  onChange={(e) => setSettings(prev => ({ ...prev, late_threshold_minutes: parseInt(e.target.value) }))}
                  placeholder="15"
                />
                <p className="text-xs text-slate-500">
                  Minutes after start time to mark as late
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ZKTeco Integration */}
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wifi className="w-5 h-5" />
                  ZKTeco Device Integration
                </CardTitle>
                <Switch
                  checked={settings.zkteco_enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, zkteco_enabled: checked }))}
                />
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {settings.zkteco_enabled && (
                <>
                  <Alert>
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>
                      Connect to your ZKTeco biometric device to automatically sync attendance data.
                      Make sure the device is on the same network and accessible.
                    </AlertDescription>
                  </Alert>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="device_ip">Device IP Address</Label>
                      <Input
                        id="device_ip"
                        value={settings.zkteco_device_ip}
                        onChange={(e) => setSettings(prev => ({ ...prev, zkteco_device_ip: e.target.value }))}
                        placeholder="192.168.1.100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="device_port">Device Port</Label>
                      <Input
                        id="device_port"
                        type="number"
                        value={settings.zkteco_device_port}
                        onChange={(e) => setSettings(prev => ({ ...prev, zkteco_device_port: parseInt(e.target.value) }))}
                        placeholder="4370"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      onClick={handleTestConnection}
                      disabled={testing}
                      variant="outline"
                      className="flex-1"
                    >
                      {testing ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Wifi className="w-4 h-4 mr-2" />
                          Test Connection
                        </>
                      )}
                    </Button>
                    <Button 
                      onClick={handleSync}
                      variant="outline"
                      className="flex-1"
                      disabled={!testConnection?.success}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync Now
                    </Button>
                  </div>

                  {testConnection && (
                    <Alert variant={testConnection.success ? "default" : "destructive"}>
                      {testConnection.success ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      <AlertDescription>{testConnection.message}</AlertDescription>
                    </Alert>
                  )}

                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="auto_sync">Auto Sync</Label>
                        <p className="text-xs text-slate-500">Automatically sync data from device</p>
                      </div>
                      <Switch
                        id="auto_sync"
                        checked={settings.auto_sync_enabled}
                        onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_sync_enabled: checked }))}
                      />
                    </div>

                    {settings.auto_sync_enabled && (
                      <div className="space-y-2">
                        <Label htmlFor="sync_interval">Sync Interval (minutes)</Label>
                        <Input
                          id="sync_interval"
                          type="number"
                          value={settings.sync_interval_minutes}
                          onChange={(e) => setSettings(prev => ({ ...prev, sync_interval_minutes: parseInt(e.target.value) }))}
                          placeholder="60"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {!settings.zkteco_enabled && (
                <div className="text-center py-8 text-slate-500">
                  <Wifi className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Enable ZKTeco integration to connect your biometric device</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="outline" onClick={onClose} isLoading={saveMutation.isPending}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              isLoading={saveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saveMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}