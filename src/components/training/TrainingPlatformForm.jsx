import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Upload, Loader2 } from "lucide-react";

export default function TrainingPlatformForm({ platform, onCancel, onSuccess }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "technical",
    thumbnail_url: "",
    total_duration_minutes: 0,
    is_mandatory: false,
  });

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (platform) {
      setFormData({
        name: platform.name || "",
        description: platform.description || "",
        category: platform.category || "technical",
        thumbnail_url: platform.thumbnail_url || "",
        total_duration_minutes: platform.total_duration_minutes || 0,
        is_mandatory: platform.is_mandatory || false,
      });
    }
  }, [platform]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock save training platform", data);
      if (platform?.id) {
        return { ...platform, ...data };
      } else {
        return { ...data, id: `plat_${Date.now()}` };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-platforms'] });
      onSuccess();
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const file_url = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, thumbnail_url: file_url }));
    } catch (error) {
      console.error("Error uploading file:", error);
    }
    setUploading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Card className="border-slate-200 shadow-xl max-w-3xl mx-auto">
      <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardTitle className="text-2xl">
          {platform ? 'Edit Training Platform' : 'Create Training Platform'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Platform Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., React Fundamentals"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the training platform..."
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="soft_skills">Soft Skills</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="tools">Tools</SelectItem>
                  <SelectItem value="leadership">Leadership</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Total Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.total_duration_minutes}
                onChange={(e) => setFormData(prev => ({ ...prev, total_duration_minutes: parseInt(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="thumbnail">Thumbnail Image</Label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-slate-400 transition-colors">
              <input
                type="file"
                id="thumbnail"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="thumbnail" className="cursor-pointer">
                {uploading ? (
                  <Loader2 className="w-8 h-8 mx-auto mb-2 text-slate-400 animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                )}
                <p className="text-sm text-slate-600">
                  {formData.thumbnail_url ? 'Image uploaded - Click to change' : 'Click to upload thumbnail'}
                </p>
              </label>
            </div>
            {formData.thumbnail_url && (
              <img src={formData.thumbnail_url} alt="Thumbnail" className="mt-2 w-32 h-32 object-cover rounded-lg" />
            )}
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <Label htmlFor="mandatory">Mandatory Training</Label>
              <p className="text-xs text-slate-500">Require all employees to complete this</p>
            </div>
            <Switch
              id="mandatory"
              checked={formData.is_mandatory}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_mandatory: checked }))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={saveMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saveMutation.isPending ? "Saving..." : platform ? "Update Platform" : "Create Platform"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}