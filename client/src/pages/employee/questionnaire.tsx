import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import QuestionnaireWizard from "@/components/wizard/QuestionnaireWizard";
import type { Questionnaire, QuestionnaireResponse, SectionState } from "@shared/schema";

export default function EmployeeQuestionnaire() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: questionnaire, isLoading } = useQuery<Questionnaire>({
    queryKey: ["/api/employee/questionnaire"],
  });

  // Load saved responses
  const { data: savedResponse } = useQuery<QuestionnaireResponse>({
    queryKey: ["/api/employee/questionnaire/response"],
    enabled: !!questionnaire,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { responses: Record<string, any>; sectionStates: SectionState[] }) => {
      return apiRequest("/api/employee/questionnaire/response", {
        method: "POST",
        body: JSON.stringify({
          questionnaireId: questionnaire?.id,
          responses: data.responses,
          completionPercentage: calculateCompletion(data.sectionStates),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee/questionnaire/response"] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { responses: Record<string, any> }) => {
      return apiRequest("/api/employee/questionnaire/submit", {
        method: "POST",
        body: JSON.stringify({
          questionnaireId: questionnaire?.id,
          responses: data.responses,
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

  // Calculate completion percentage from section states
  const calculateCompletion = (sectionStates: SectionState[]): number => {
    if (!sectionStates.length) return 0;
    const completed = sectionStates.filter(s => s.status === "completed" || s.status === "skipped").length;
    return Math.round((completed / sectionStates.length) * 100);
  };

  // Handle wizard completion
  const handleComplete = async (responses: Record<string, any>, sectionStates: SectionState[]) => {
    setIsSubmitting(true);
    try {
      await submitMutation.mutateAsync({ responses });
      toast({
        title: "Success!",
        description: "Your questionnaire has been submitted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit questionnaire. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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

  // Check if questionnaire already submitted
  if (savedResponse?.isCompleted) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Questionnaire Already Submitted</CardTitle>
            <CardDescription>
              You have already completed this questionnaire. Thank you!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Submitted on: {new Date(savedResponse.submittedAt!).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Parse sections from questionnaire.questions (which stores our sections array)
  const sections = Array.isArray(questionnaire.questions) ? questionnaire.questions : [];

  if (!sections.length) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Invalid Questionnaire</CardTitle>
            <CardDescription>
              This questionnaire has no sections configured.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <QuestionnaireWizard
      sections={sections}
      welcomeMessage={questionnaire.description || "Let's see if you qualify for valuable tax credits!"}
      onComplete={handleComplete}
      initialResponses={savedResponse?.responses as Record<string, any> || {}}
      initialSectionStates={[]}
    />
  );
}
