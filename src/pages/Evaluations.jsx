import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardCheck, Target } from "lucide-react";
import EvaluationsList from "../components/evaluations/EvaluationsList";
import EvaluationForm from "../components/evaluations/EvaluationForm";
import TrainingNeedsList from "../components/evaluations/TrainingNeedsList";
import TrainingNeedForm from "../components/evaluations/TrainingNeedForm";

export default function Evaluations() {
  const [user, setUser] = useState(null);
  const [showEvalForm, setShowEvalForm] = useState(false);
  const [showNeedForm, setShowNeedForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Mock user load
        const currentUser = {
          email: "mock_user@example.com",
          full_name: "Mock User",
        };
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      // Mock employees
      return [];
    },
    initialData: [],
  });

  const { data: evaluations = [] } = useQuery({
    queryKey: ['evaluations'],
    queryFn: async () => {
      // Mock evaluations
      return [];
    },
    initialData: [],
  });

  const { data: trainingNeeds = [] } = useQuery({
    queryKey: ['training-needs'],
    queryFn: async () => {
      // Mock training needs
      return [];
    },
    initialData: [],
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
            <ClipboardCheck className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-slate-700">Performance Management</span>
          </div>
          
          <p className="text-lg text-slate-600">
            Comprehensive performance reviews and skill development tracking
          </p>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="evaluations" className="space-y-6">
          <TabsList className="bg-white border border-slate-200 grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="evaluations" className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Evaluations
            </TabsTrigger>
            <TabsTrigger value="training-needs" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Training Needs
            </TabsTrigger>
          </TabsList>

          {/* Evaluations Tab */}
          <TabsContent value="evaluations" className="space-y-6">
            <div className="flex justify-end">
              <Button 
                onClick={() => setShowEvalForm(true)}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Evaluation
              </Button>
            </div>

            {showEvalForm ? (
              <EvaluationForm
                employees={employees}
                currentUser={user}
                onCancel={() => setShowEvalForm(false)}
                onSuccess={() => setShowEvalForm(false)}
              />
            ) : (
              <EvaluationsList 
                evaluations={evaluations}
                employees={employees}
              />
            )}
          </TabsContent>

          {/* Training Needs Tab */}
          <TabsContent value="training-needs" className="space-y-6">
            <div className="flex justify-end">
              <Button 
                onClick={() => setShowNeedForm(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Training Need
              </Button>
            </div>

            {showNeedForm ? (
              <TrainingNeedForm
                employees={employees}
                onCancel={() => setShowNeedForm(false)}
                onSuccess={() => setShowNeedForm(false)}
              />
            ) : (
              <TrainingNeedsList 
                trainingNeeds={trainingNeeds}
                employees={employees}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}