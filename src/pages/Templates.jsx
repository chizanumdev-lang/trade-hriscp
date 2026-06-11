import React, { useState } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import TemplateList from "../components/templates/TemplateList";
import TemplateForm from "../components/templates/TemplateForm";

export default function Templates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  const [showForm, setShowForm] = useState(action === 'add');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => [],
    initialData: [],
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (templateData) => {
      console.log("Mock create template", templateData);
      return templateData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowForm(false);
      navigate('/Templates');
    },
  });

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {showForm && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setShowForm(false);
                  navigate('/Templates');
                }}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div>
              
              <p className="text-slate-500 mt-1">
                {showForm 
                  ? "Build reusable onboarding flows" 
                  : `${templates.length} template${templates.length !== 1 ? 's' : ''} available`
                }
              </p>
            </div>
          </div>
          {!showForm && (
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          )}
        </div>

        {showForm ? (
          <TemplateForm
            onSubmit={(data) => createTemplateMutation.mutate(data)}
            onCancel={() => {
              setShowForm(false);
              navigate('/Templates');
            }}
            isSubmitting={createTemplateMutation.isPending}
          />
        ) : (
          <TemplateList templates={templates} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}