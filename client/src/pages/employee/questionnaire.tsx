import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, ChevronLeft, ChevronRight, CheckCircle2, Upload } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Questionnaire, QuestionnaireResponse } from "@shared/schema";

interface Question {
  id: string;
  type: "text" | "radio" | "checkbox" | "date" | "file";
  question: string;
  helpText?: string;
  options?: string[];
  required?: boolean;
  targetGroup?: string;
}

export default function EmployeeQuestionnaire() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [simplifiedQuestions, setSimplifiedQuestions] = useState<Record<string, string>>({});
  const [loadingSimplification, setLoadingSimplification] = useState<string | null>(null);

  const { data: questionnaire, isLoading } = useQuery<Questionnaire>({
    queryKey: ["/api/employee/questionnaire"],
  });

  // Load saved responses
  const { data: savedResponse } = useQuery<QuestionnaireResponse>({
    queryKey: ["/api/employee/questionnaire/response"],
    enabled: !!questionnaire,
  });

  // Initialize responses from saved data
  useEffect(() => {
    if (savedResponse?.responses) {
      setResponses(savedResponse.responses as Record<string, any>);
    }
  }, [savedResponse]);

  const saveMutation = useMutation({
    mutationFn: async (data: { responses: Record<string, any>; completionPercentage: number }) => {
      return apiRequest("/api/employee/questionnaire/response", {
        method: "POST",
        body: JSON.stringify({
          questionnaireId: questionnaire?.id,
          ...data,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee/questionnaire/response"] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/employee/questionnaire/submit", {
        method: "POST",
        body: JSON.stringify({
          questionnaireId: questionnaire?.id,
          responses,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Questionnaire Submitted!",
        description: "Thank you for completing the screening questionnaire.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/questionnaire"] });
    },
  });

  const simplifyQuestion = async (questionId: string, questionText: string) => {
    setLoadingSimplification(questionId);
    try {
      const response = await apiRequest("/api/ai/simplify-question", {
        method: "POST",
        body: JSON.stringify({ questionId, questionText }),
      });
      const data = await response.json();
      setSimplifiedQuestions(prev => ({ ...prev, [questionId]: data.simplifiedQuestion }));
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not simplify question. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingSimplification(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!questionnaire) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>No Questionnaire Available</CardTitle>
            <CardDescription>
              Please contact your employer to complete the WOTC screening.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const questions = (questionnaire.questions as Question[]) || [];
  const totalQuestions = questions.length;
  const completionPercentage = Math.round((Object.keys(responses).length / totalQuestions) * 100);
  const currentQuestion = questions[currentStep];

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
      saveMutation.mutate({ responses, completionPercentage });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    submitMutation.mutate();
  };

  const renderQuestion = (question: Question) => {
    const displayQuestion = simplifiedQuestions[question.id] || question.question;
    const isSimplified = !!simplifiedQuestions[question.id];

    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Label className="text-lg font-medium">
                {displayQuestion}
                {question.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {question.helpText && (
                <p className="text-sm text-muted-foreground mt-2">{question.helpText}</p>
              )}
              {isSimplified && (
                <Badge variant="secondary" className="mt-2">
                  Simplified Version
                </Badge>
              )}
            </div>
            {!isSimplified && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => simplifyQuestion(question.id, question.question)}
                disabled={loadingSimplification === question.id}
                data-testid={`button-simplify-${question.id}`}
              >
                {loadingSimplification === question.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Simplify
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="pt-4">
          {question.type === "text" && (
            <Input
              value={responses[question.id] || ""}
              onChange={(e) => setResponses({ ...responses, [question.id]: e.target.value })}
              placeholder="Enter your answer"
              data-testid={`input-question-${question.id}`}
            />
          )}

          {question.type === "text" && question.question.length > 100 && (
            <Textarea
              value={responses[question.id] || ""}
              onChange={(e) => setResponses({ ...responses, [question.id]: e.target.value })}
              placeholder="Enter your answer"
              rows={4}
              data-testid={`textarea-question-${question.id}`}
            />
          )}

          {question.type === "radio" && question.options && (
            <RadioGroup
              value={responses[question.id]}
              onValueChange={(value) => setResponses({ ...responses, [question.id]: value })}
            >
              {question.options.map((option, idx) => (
                <div key={idx} className="flex items-center space-x-3 py-2">
                  <RadioGroupItem 
                    value={option} 
                    id={`${question.id}-${idx}`}
                    data-testid={`radio-${question.id}-${idx}`}
                  />
                  <Label htmlFor={`${question.id}-${idx}`} className="cursor-pointer font-normal">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {question.type === "date" && (
            <Input
              type="date"
              value={responses[question.id] || ""}
              onChange={(e) => setResponses({ ...responses, [question.id]: e.target.value })}
              data-testid={`input-date-${question.id}`}
            />
          )}

          {question.type === "file" && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                Upload supporting documents (DD-214, TANF letter, etc.)
              </p>
              <Input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setResponses({ ...responses, [question.id]: file.name });
                  }
                }}
                data-testid={`input-file-${question.id}`}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const isLastQuestion = currentStep === questions.length - 1;
  const canProceed = !currentQuestion?.required || responses[currentQuestion?.id];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 md:p-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">WOTC Screening Questionnaire</h1>
            <Badge variant="secondary" data-testid="text-progress">
              {currentStep + 1} of {totalQuestions}
            </Badge>
          </div>
          <Progress value={completionPercentage} className="h-2" data-testid="progress-questionnaire" />
          <p className="text-sm text-muted-foreground mt-2">
            {completionPercentage}% Complete
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Question {currentStep + 1}</CardTitle>
            {currentQuestion?.targetGroup && (
              <CardDescription>
                Category: {currentQuestion.targetGroup}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="min-h-[300px]">
            {currentQuestion && renderQuestion(currentQuestion)}
          </CardContent>
          <CardFooter className="flex justify-between gap-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              data-testid="button-previous"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            {isLastQuestion ? (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed || submitMutation.isPending}
                data-testid="button-submit"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Submit Questionnaire
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed}
                data-testid="button-next"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardFooter>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Your progress is saved automatically as you go.</p>
        </div>
      </div>
    </div>
  );
}
