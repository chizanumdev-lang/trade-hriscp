import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Laptop, Plus, Monitor, Smartphone, Tablet, MoreVertical, Edit } from "lucide-react";
import { motion } from "framer-motion";

const assetIcons = {
  laptop: Laptop,
  monitor: Monitor,
  phone: Smartphone,
  tablet: Tablet,
  desktop: Laptop,
};

const AssetsSkeleton = () => (
  <div className="divide-y divide-slate-100">
    {Array(5).fill(0).map((_, i) => (
      <div key={i} className="p-4 flex items-center gap-4 animate-pulse bg-white">
        <div className="w-12 h-12 bg-slate-100 rounded-xl shrink-0"></div>
        <div className="flex-1 space-y-2.5">
          <div className="h-4 bg-slate-100 rounded w-1/4"></div>
          <div className="h-3 bg-slate-100 rounded w-1/6"></div>
        </div>
        <div className="hidden md:flex items-center gap-3 w-40 shrink-0">
          <div className="w-8 h-8 bg-slate-100 rounded-full"></div>
          <div className="space-y-2 flex-1">
            <div className="h-3 bg-slate-100 rounded w-full"></div>
            <div className="h-2 bg-slate-100 rounded w-2/3"></div>
          </div>
        </div>
        <div className="w-16 h-6 bg-slate-100 rounded-full shrink-0 mx-4"></div>
        <div className="w-8 h-8 bg-slate-100 rounded-lg shrink-0"></div>
      </div>
    ))}
  </div>
);

export default function Assets() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [formData, setFormData] = useState({
    asset_name: '',
    asset_type: 'laptop',
    serial_number: '',
    assigned_to: '',
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
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: assets, isLoading: loadingAssets } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => [], // Will be replaced by real fetch
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => [],
    initialData: [],
  });

  const createAssetMutation = useMutation({
    mutationFn: async (data) => {
      const employee = employees.find(e => e.email === data.assigned_to);
      return {
        ...data,
        id: `asset_${Date.now()}`,
        organization_id: user?.organization_id,
        assigned_to_name: employee?.full_name,
        assigned_date: data.assigned_to ? new Date().toISOString().split('T')[0] : null,
        assignment_status: data.assigned_to ? 'assigned' : 'available',
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowForm(false);
      setEditingAsset(null);
      setFormData({
        asset_name: '',
        asset_type: 'laptop',
        serial_number: '',
        assigned_to: '',
      });
    },
  });

  const updateAssetMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const employee = employees.find(e => e.email === data.assigned_to);
      return {
        id,
        ...data,
        assigned_to_name: employee?.full_name || null,
        assigned_date: data.assigned_to ? new Date().toISOString().split('T')[0] : null,
        assignment_status: data.assigned_to ? 'assigned' : 'available',
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowForm(false);
      setEditingAsset(null);
    },
  });

  const handleEdit = (asset) => {
    setEditingAsset(asset);
    setFormData({
      asset_name: asset.asset_name,
      asset_type: asset.asset_type,
      serial_number: asset.serial_number || '',
      assigned_to: asset.assigned_to || '',
    });
    setShowForm(true);
  };

  const statusColors = {
    active: 'bg-green-50 text-green-700 border-green-200',
    inactive: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    in_repair: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    broken: 'bg-red-50 text-red-700 border-red-200',
    retired: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  const displayAssets = assets || [];

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-4 md:p-8 max-w-6xl mx-auto space-y-8"
    >
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full mb-4">
            <Laptop className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Asset Management</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Assets</h1>
          <p className="text-slate-500 mt-1">Track and manage company devices and equipment.</p>
        </div>
        
        <Dialog open={showForm} onOpenChange={(open) => {
          setShowForm(open);
          if (!open) {
            setEditingAsset(null);
            setFormData({
              asset_name: '',
              asset_type: 'laptop',
              serial_number: '',
              assigned_to: '',
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              {editingAsset ? 'Edit Asset' : 'Add Asset'}
            </Button>
          </DialogTrigger>
          <DialogContent className="border-slate-100 shadow-xl rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-900 tracking-tight">{editingAsset ? 'Edit' : 'Add'} Asset</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              if (editingAsset) {
                updateAssetMutation.mutate({ id: editingAsset.id, data: formData });
              } else {
                createAssetMutation.mutate(formData); 
              }
            }} className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label>Asset Name</Label>
                <Input className="rounded-lg border-slate-200 bg-slate-50 focus:bg-white transition-colors" placeholder="e.g., Macbook Air 2024" value={formData.asset_name} onChange={(e) => setFormData(prev => ({ ...prev, asset_name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.asset_type} onValueChange={(value) => setFormData(prev => ({ ...prev, asset_type: value }))}>
                    <SelectTrigger className="rounded-lg border-slate-200 bg-slate-50 focus:bg-white transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100 shadow-lg">
                      <SelectItem value="laptop">Laptop</SelectItem>
                      <SelectItem value="desktop">Desktop</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="tablet">Tablet</SelectItem>
                      <SelectItem value="monitor">Monitor</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Serial Number</Label>
                  <Input className="rounded-lg border-slate-200 bg-slate-50 focus:bg-white transition-colors" value={formData.serial_number} onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assign To (Optional)</Label>
                <Select value={formData.assigned_to} onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}>
                  <SelectTrigger className="rounded-lg border-slate-200 bg-slate-50 focus:bg-white transition-colors">
                    <SelectValue placeholder="Not assigned" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 shadow-lg">
                    <SelectItem value={null}>Not Assigned</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.email}>
                        {emp.full_name} - {emp.job_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button className="rounded-lg" type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white" type="submit" isLoading={createAssetMutation.isPending || updateAssetMutation.isPending}>
                  {(createAssetMutation.isPending || updateAssetMutation.isPending) ? 'Saving...' : editingAsset ? 'Update' : 'Add Asset'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-0">
            {loadingAssets ? (
              <AssetsSkeleton />
            ) : displayAssets.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                  <Laptop className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">No Assets Found</h3>
                <p className="text-slate-500 max-w-sm">You haven't added any company assets yet. Click "Add Asset" to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {displayAssets.map(asset => {
                  const Icon = assetIcons[asset.asset_type] || Laptop;
                  return (
                    <motion.div 
                      key={asset.id} 
                      whileHover={{ backgroundColor: "rgba(248, 250, 252, 1)" }}
                      className="p-4 transition-colors group flex items-center gap-4"
                    >
                      <div className="w-12 h-12 bg-white border border-slate-200 shadow-sm rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Icon className="w-5 h-5 text-indigo-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{asset.asset_name}</h4>
                        <p className="text-sm text-slate-500 capitalize">{asset.asset_type}</p>
                      </div>
                      
                      <div className="hidden md:flex text-left shrink-0 w-48">
                        {asset.assigned_to ? (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-indigo-100 border border-indigo-200 rounded-full flex items-center justify-center shadow-sm">
                              <span className="text-indigo-700 text-xs font-bold">
                                {asset.assigned_to_name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{asset.assigned_to_name}</p>
                              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Assigned</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center border-dashed">
                              <span className="text-slate-400 text-xs font-medium">--</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-slate-500 italic">Unassigned</p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <Badge variant="outline" className={`shrink-0 mx-2 md:mx-4 ${statusColors[asset.status || 'active']} font-medium py-0 h-6`}>
                        {asset.status || 'Active'}
                      </Badge>
                      
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200/50"
                        onClick={() => handleEdit(asset)}
                      >
                        <Edit className="w-4 h-4 text-slate-600" />
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}