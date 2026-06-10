import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, FileText } from "lucide-react";

export default function TrainingVideoForm({ video, platforms, platformId, onCancel, onSuccess }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    platform_id: platformId || "",
    title: "",
    description: "",
    video_url: "",
    duration_minutes: 0,
    order: 0,
    transcript: "",
  });

  const [uploadingAssessment, setUploadingAssessment] = useState(false);
  const [assessmentFiles, setAssessmentFiles] = useState([]);

  useEffect(() => {
    if (video) {
      setFormData({
        platform_id: video.platform_id || platformId || "",
        title: video.title || "",
        description: video.description || "",
        video_url: video.video_url || "",
        duration_minutes: video.duration_minutes || 0,
        order: video.order || 0,
        transcript: video.transcript || "",
      });
    }
  }, [video, platformId]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock save training video", data);
      if (video?.id) {
        return { ...video, ...data };
      } else {
        return { ...data, id: `video_${Date.now()}` };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-videos'] });
      onSuccess();
    },
  });

  const handleAssessmentUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingAssessment(true);
    const uploadedFiles = [];

    for (const file of files) {
      try {
        const file_url = URL.createObjectURL(file);
        uploadedFiles.push({ name: file.name, url: file_url });
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }

    setAssessmentFiles(prev => [...prev, ...uploadedFiles]);
    setUploadingAssessment(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Include assessment files in transcript as links
    let finalTranscript = formData.transcript;
    if (assessmentFiles.length > 0) {
      finalTranscript += "\n\n## Assessment Materials:\n";
      assessmentFiles.forEach(file => {
        finalTranscript += `- [${file.name}](${file.url})\n`;
      });
    }

    saveMutation.mutate({ ...formData, transcript: finalTranscript });
  };

  return (
    <Card className="border-slate-200 shadow-xl max-w-3xl mx-auto">
      <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardTitle className="text-2xl">
          {video ? 'Edit Training Video' : 'Add Training Video'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="platform_id">Platform *</Label>
            <Select value={formData.platform_id} onValueChange={(value) => setFormData(prev => ({ ...prev, platform_id: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((platform) => (
                  <SelectItem key={platform.id} value={platform.id}>
                    {platform.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Video Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Introduction to React Hooks"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What will students learn in this video?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="video_url">Video URL *</Label>
            <Input
              id="video_url"
              value={formData.video_url}
              onChange={(e) => setFormData(prev => ({ ...prev, video_url: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..."
              required
            />
            <p className="text-xs text-slate-500">
              YouTube, Vimeo, or direct video link
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order">Order/Sequence</Label>
              <Input
                id="order"
                type="number"
                value={formData.order}
                onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transcript">Transcript / Notes</Label>
            <Textarea
              id="transcript"
              value={formData.transcript}
              onChange={(e) => setFormData(prev => ({ ...prev, transcript: e.target.value }))}
              placeholder="Add video transcript or additional notes..."
              rows={4}
            />
          </div>

          {/* Assessment Materials Upload */}
          <div className="space-y-2">
            <Label>Assessment Materials (Optional)</Label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-slate-400 transition-colors">
              <input
                type="file"
                id="assessments"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
                onChange={handleAssessmentUpload}
                className="hidden"
              />
              <label htmlFor="assessments" className="cursor-pointer">
                {uploadingAssessment ? (
                  <Loader2 className="w-8 h-8 mx-auto mb-2 text-slate-400 animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                )}
                <p className="text-sm text-slate-600">
                  Click to upload assessments, quizzes, or study materials
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  PDF, DOC, PPT, or ZIP files
                </p>
              </label>
            </div>
            {assessmentFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-slate-700">Uploaded Files:</p>
                {assessmentFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-slate-700">{file.name}</span>
                  </div>
                ))}
              </div>
            )}
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
              {saveMutation.isPending ? "Saving..." : video ? "Update Video" : "Add Video"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}