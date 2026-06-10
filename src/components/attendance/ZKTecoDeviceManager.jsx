// @ts-nocheck
import React, { useState } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Wifi, WifiOff, Edit, Trash2, RefreshCw, Settings as SettingsIcon } from "lucide-react";

export default function ZKTecoDeviceManager({ open, onClose }) {
  const queryClient = useQueryClient();
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [formData, setFormData] = useState({
    device_name: '',
    device_serial: '',
    ip_address: '',
    port: 4370,
    location: '',
    department: '',
    status: 'active',
    auto_sync_enabled: true,
    sync_interval_minutes: 60,
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['zkteco-devices'],
    queryFn: async () => [],
    initialData: [],
  });

  const createDeviceMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock create device", data);
      return { ...data, id: `dev_${Date.now()}` };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zkteco-devices'] });
      setShowDeviceForm(false);
      setEditingDevice(null);
      setFormData({
        device_name: '',
        device_serial: '',
        ip_address: '',
        port: 4370,
        location: '',
        department: '',
        status: 'active',
        auto_sync_enabled: true,
        sync_interval_minutes: 60,
      });
    },
  });

  const updateDeviceMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      console.log("Mock update device", id, data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zkteco-devices'] });
      setShowDeviceForm(false);
      setEditingDevice(null);
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (id) => {
      console.log("Mock delete device", id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zkteco-devices'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingDevice) {
      updateDeviceMutation.mutate({ id: editingDevice.id, data: formData });
    } else {
      createDeviceMutation.mutate(formData);
    }
  };

  const handleEdit = (device) => {
    setEditingDevice(device);
    setFormData({
      device_name: device.device_name,
      device_serial: device.device_serial,
      ip_address: device.ip_address,
      port: device.port,
      location: device.location,
      department: device.department || '',
      status: device.status,
      auto_sync_enabled: device.auto_sync_enabled,
      sync_interval_minutes: device.sync_interval_minutes,
    });
    setShowDeviceForm(true);
  };

  const handleSync = (deviceId) => {
    // In production, this would trigger actual device sync
    alert(`Syncing device ${deviceId}. This requires backend ZKTeco SDK integration.`);
  };

  const statusConfig = {
    active: { color: 'bg-green-100 text-green-700 border-green-200', icon: Wifi },
    inactive: { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: WifiOff },
    maintenance: { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: SettingsIcon },
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">ZKTeco Device Management</DialogTitle>
            <Button onClick={() => setShowDeviceForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Device Form */}
          {showDeviceForm && (
            <Card className="border-slate-200 bg-slate-50">
              <CardHeader className="border-b border-slate-200">
                <CardTitle>{editingDevice ? 'Edit Device' : 'Add New Device'}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="device_name">Device Name *</Label>
                      <Input
                        id="device_name"
                        value={formData.device_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, device_name: e.target.value }))}
                        placeholder="e.g., Main Entrance"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="device_serial">Serial Number</Label>
                      <Input
                        id="device_serial"
                        value={formData.device_serial}
                        onChange={(e) => setFormData(prev => ({ ...prev, device_serial: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ip_address">IP Address *</Label>
                      <Input
                        id="ip_address"
                        value={formData.ip_address}
                        onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
                        placeholder="192.168.1.100"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        type="number"
                        value={formData.port}
                        onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location *</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="e.g., Head Office"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        value={formData.department}
                        onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto Sync</Label>
                        <p className="text-xs text-slate-500">Automatically sync data from device</p>
                      </div>
                      <Switch
                        checked={formData.auto_sync_enabled}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_sync_enabled: checked }))}
                      />
                    </div>

                    {formData.auto_sync_enabled && (
                      <div className="space-y-2">
                        <Label htmlFor="sync_interval">Sync Interval (minutes)</Label>
                        <Input
                          id="sync_interval"
                          type="number"
                          value={formData.sync_interval_minutes}
                          onChange={(e) => setFormData(prev => ({ ...prev, sync_interval_minutes: parseInt(e.target.value) }))}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowDeviceForm(false);
                        setEditingDevice(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" isLoading={createDeviceMutation.isPending || updateDeviceMutation.isPending}>
                      {(createDeviceMutation.isPending || updateDeviceMutation.isPending) ? "Saving..." : editingDevice ? "Update Device" : "Add Device"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Devices List */}
          <div className="grid md:grid-cols-2 gap-4">
            {devices.map(device => {
              const config = statusConfig[device.status];
              const StatusIcon = config.icon;

              return (
                <Card key={device.id} className="border-slate-200">
                  <CardHeader className="border-b border-slate-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg mb-1">{device.device_name}</CardTitle>
                        <p className="text-sm text-slate-600">{device.location}</p>
                      </div>
                      <Badge variant="outline" className={`${config.color} border flex items-center gap-1`}>
                        <StatusIcon className="w-3 h-3" />
                        {device.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">IP Address:</span>
                        <span className="font-medium text-slate-900">{device.ip_address}:{device.port}</span>
                      </div>
                      {device.device_serial && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Serial:</span>
                          <span className="font-medium text-slate-900">{device.device_serial}</span>
                        </div>
                      )}
                      {device.last_sync && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Last Sync:</span>
                          <span className="font-medium text-slate-900">
                            {new Date(device.last_sync).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {device.auto_sync_enabled && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Auto Sync:</span>
                          <Badge className="bg-green-100 text-green-700">
                            Every {device.sync_interval_minutes} min
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleSync(device.id)}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync Now
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(device)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this device?')) {
                            deleteDeviceMutation.mutate(device.id);
                          }
                        }}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {devices.length === 0 && !showDeviceForm && (
            <Card className="border-slate-200">
              <CardContent className="p-12 text-center">
                <Wifi className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No devices configured</h3>
                <p className="text-slate-500 mb-4">Add your first ZKTeco biometric device</p>
                <Button onClick={() => setShowDeviceForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Device
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}