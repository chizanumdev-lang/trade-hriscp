import React, { useState, useEffect } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MessageSquare, Plus, Trash2, Eye, BarChart3, Users, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function Surveys() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [showSurveyForm, setShowSurveyForm] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [surveyResponses, setSurveyResponses] = useState({});

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Mock user
        const currentUser = {
          email: "mock_user@example.com",
          role: "admin"
        };
        setUser(currentUser);
        
        // Mock employee
        setEmployee({
          id: 'emp_1',
          email: currentUser.email
        });
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: surveys = [] } = useQuery({
    queryKey: ['surveys'],
    queryFn: async () => {
      // Mock surveys
      return [];
    },
    initialData: [],
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['survey-responses'],
    queryFn: async () => {
      // Mock responses
      return [];
    },
    initialData: [],
  });

  const isAdmin = user?.role === 'admin';

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    survey_type: 'engagement',
    questions: [{ question: '', type: 'text', options: [], required: true }],
    anonymous: true,
    status: 'draft',
  });

  const createSurveyMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock create survey", data);
      return {
        ...data,
        id: `survey_${Date.now()}`,
        responses_count: 0,
        start_date: new Date().toISOString().split('T')[0],
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      setShowSurveyForm(false);
      setFormData({
        title: '',
        description: '',
        survey_type: 'engagement',
        questions: [{ question: '', type: 'text', options: [], required: true }],
        anonymous: true,
        status: 'draft',
      });
    },
  });

  const submitResponseMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Mock submit response", data);
      
      // Mock AI Sentiment Analysis
      const sentiment = { score: 0.8 };
      
      return {
        ...data,
        id: `resp_${Date.now()}`,
        sentiment_score: sentiment.score,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-responses'] });
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      setSelectedSurvey(null);
      setSurveyResponses({});
    },
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async (surveyId) => {
      console.log("Mock generate insights for survey", surveyId);
      return {
        id: surveyId,
        ai_summary: "This is a mock AI generated summary of the survey responses.",
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
    },
  });

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, { question: '', type: 'text', options: [], required: true }]
    }));
  };

  const removeQuestion = (index) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const updateQuestion = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createSurveyMutation.mutate(formData);
  };

  const handleSurveyResponse = (surveyId) => {
    const survey = surveys.find(s => s.id === surveyId);
    const responseData = survey.questions.map(q => ({
      question: q.question,
      answer: surveyResponses[q.question] || ''
    }));

    submitResponseMutation.mutate({
      survey_id: surveyId,
      employee_id: survey.anonymous ? null : employee?.id,
      responses: responseData,
      submitted_date: new Date().toISOString(),
    });
  };

  const activeSurveys = surveys.filter(s => s.status === 'active');
  const totalResponses = responses.length;
  const avgSentiment = responses.length > 0 
    ? responses.reduce((sum, r) => sum + (r.sentiment_score || 0), 0) / responses.length
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
              <MessageSquare className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-medium text-slate-700">Employee Engagement</span>
            </div>
            
            <p className="text-lg text-slate-600">
              Create surveys and gather employee feedback
            </p>
          </div>
          {isAdmin && (
            <Button 
              onClick={() => setShowSurveyForm(!showSurveyForm)}
              className="bg-gradient-to-r from-teal-600 to-cyan-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Survey
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-teal-100 p-3 rounded-xl">
                  <MessageSquare className="w-6 h-6 text-teal-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">{surveys.length}</div>
              <div className="text-sm text-slate-600">Total Surveys</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-blue-100 p-3 rounded-xl">
                  <Eye className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">{activeSurveys.length}</div>
              <div className="text-sm text-slate-600">Active Surveys</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-purple-100 p-3 rounded-xl">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">{totalResponses}</div>
              <div className="text-sm text-slate-600">Total Responses</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-green-100 p-3 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">
                {avgSentiment > 0 ? '+' : ''}{(avgSentiment * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-slate-600">Avg Sentiment</div>
            </CardContent>
          </Card>
        </div>

        {/* Survey Form */}
        {showSurveyForm && isAdmin && (
          <Card className="border-slate-200 shadow-xl">
            <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-teal-50 to-cyan-50">
              <CardTitle>Create New Survey</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Survey Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="survey_type">Survey Type</Label>
                    <Select value={formData.survey_type} onValueChange={(value) => setFormData(prev => ({ ...prev, survey_type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="engagement">Engagement</SelectItem>
                        <SelectItem value="satisfaction">Satisfaction</SelectItem>
                        <SelectItem value="wellness">Wellness</SelectItem>
                        <SelectItem value="feedback">Feedback</SelectItem>
                        <SelectItem value="pulse">Pulse Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                </div>

                {/* Questions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Questions</Label>
                    <Button type="button" onClick={addQuestion} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Question
                    </Button>
                  </div>

                  {formData.questions.map((q, index) => (
                    <Card key={index} className="border-slate-200">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Question text"
                              value={q.question}
                              onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                              className="flex-1"
                            />
                            <Select value={q.type} onValueChange={(value) => updateQuestion(index, 'type', value)}>
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="rating">Rating</SelectItem>
                                <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                <SelectItem value="yes_no">Yes/No</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => removeQuestion(index)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>

                          {q.type === 'multiple_choice' && (
                            <Input
                              placeholder="Options (comma-separated)"
                              value={q.options.join(', ')}
                              onChange={(e) => updateQuestion(index, 'options', e.target.value.split(',').map(o => o.trim()))}
                            />
                          )}

                          <div className="flex items-center gap-2">
                            <Switch
                              checked={q.required}
                              onCheckedChange={(checked) => updateQuestion(index, 'required', checked)}
                            />
                            <Label>Required</Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label>Anonymous Responses</Label>
                    <p className="text-xs text-slate-500">Don't track who responded</p>
                  </div>
                  <Switch
                    checked={formData.anonymous}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, anonymous: checked }))}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowSurveyForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={createSurveyMutation.isPending}>
                    {createSurveyMutation.isPending ? "Creating..." : "Create Survey"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Survey Taking View */}
        {selectedSurvey && !isAdmin && (
          <Card className="border-slate-200 shadow-xl">
            <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-teal-50 to-cyan-50">
              <CardTitle>{selectedSurvey.title}</CardTitle>
              {selectedSurvey.description && (
                <p className="text-sm text-slate-600 mt-2">{selectedSurvey.description}</p>
              )}
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {selectedSurvey.questions.map((q, index) => (
                <div key={index} className="space-y-2">
                  <Label>
                    {index + 1}. {q.question} {q.required && <span className="text-red-500">*</span>}
                  </Label>
                  
                  {q.type === 'text' && (
                    <Textarea
                      value={surveyResponses[q.question] || ''}
                      onChange={(e) => setSurveyResponses(prev => ({ ...prev, [q.question]: e.target.value }))}
                      rows={3}
                    />
                  )}

                  {q.type === 'rating' && (
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(rating => (
                        <Button
                          key={rating}
                          type="button"
                          variant={surveyResponses[q.question] === rating.toString() ? "default" : "outline"}
                          onClick={() => setSurveyResponses(prev => ({ ...prev, [q.question]: rating.toString() }))}
                        >
                          {rating}
                        </Button>
                      ))}
                    </div>
                  )}

                  {q.type === 'multiple_choice' && (
                    <Select
                      value={surveyResponses[q.question]}
                      onValueChange={(value) => setSurveyResponses(prev => ({ ...prev, [q.question]: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        {q.options.map((option, i) => (
                          <SelectItem key={i} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {q.type === 'yes_no' && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={surveyResponses[q.question] === 'Yes' ? "default" : "outline"}
                        onClick={() => setSurveyResponses(prev => ({ ...prev, [q.question]: 'Yes' }))}
                      >
                        Yes
                      </Button>
                      <Button
                        type="button"
                        variant={surveyResponses[q.question] === 'No' ? "default" : "outline"}
                        onClick={() => setSurveyResponses(prev => ({ ...prev, [q.question]: 'No' }))}
                      >
                        No
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button variant="outline" onClick={() => setSelectedSurvey(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSurveyResponse(selectedSurvey.id)}
                  disabled={submitResponseMutation.isPending}
                >
                  {submitResponseMutation.isPending ? "Submitting..." : "Submit Response"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Surveys List */}
        {!selectedSurvey && (
          <div className="grid md:grid-cols-2 gap-6">
            {surveys.map(survey => (
              <Card key={survey.id} className="border-slate-200 hover:shadow-lg transition-shadow">
                <CardHeader className="border-b border-slate-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl mb-1">{survey.title}</CardTitle>
                      <p className="text-sm text-slate-600">{survey.survey_type}</p>
                    </div>
                    <Badge variant="outline" className={
                      survey.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' :
                      survey.status === 'closed' ? 'bg-red-100 text-red-700 border-red-200' :
                      'bg-slate-100 text-slate-700 border-slate-200'
                    }>
                      {survey.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {survey.description && (
                    <p className="text-sm text-slate-600 mb-4">{survey.description}</p>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-slate-500">
                      {survey.responses_count || 0} responses
                    </span>
                    <span className="text-sm text-slate-500">
                      {survey.questions?.length || 0} questions
                    </span>
                  </div>

                  {survey.ai_summary && (
                    <div className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                      <p className="text-xs font-medium text-teal-900 mb-2">AI Insights:</p>
                      <p className="text-sm text-teal-800 whitespace-pre-wrap">{survey.ai_summary}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!isAdmin && survey.status === 'active' && (
                      <Button
                        className="flex-1"
                        onClick={() => setSelectedSurvey(survey)}
                      >
                        Take Survey
                      </Button>
                    )}
                    {isAdmin && (
                      <>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => generateInsightsMutation.mutate(survey.id)}
                          disabled={generateInsightsMutation.isPending || (survey.responses_count || 0) === 0}
                        >
                          <BarChart3 className="w-4 h-4 mr-2" />
                          {generateInsightsMutation.isPending ? "Analyzing..." : "AI Insights"}
                        </Button>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}