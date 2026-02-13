import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Globe, MessageCircle, CheckCircle2, Shield } from "lucide-react";
import QuestionnaireWizard from "@/components/wizard/QuestionnaireWizard";
import AIAssistantChat from "@/components/AIAssistantChat";
import type { Questionnaire, QuestionnaireResponse, SectionState } from "@shared/schema";

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "zh", name: "中文" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "ko", name: "한국어" },
  { code: "pt", name: "Português" },
  { code: "de", name: "Deutsch" },
  { code: "ja", name: "日本語" },
];

interface ScreeningData {
  questionnaire: Questionnaire;
  employer: {
    id: string;
    name: string;
    companyName: string;
    logoUrl: string | null;
    primaryColor: string | null;
    welcomeMessage: string | null;
  };
  employeeId: string | null;
  employeeName: string | null;
}

export default function PublicScreening({ token }: { token: string }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentSection, setCurrentSection] = useState("");

  const urlParams = new URLSearchParams(window.location.search);
  const employeeParam = urlParams.get("employee");

  const { data: screeningData, isLoading, error } = useQuery<ScreeningData>({
    queryKey: ["/api/public/screen", token, employeeParam],
    queryFn: async () => {
      const url = employeeParam
        ? `/api/public/screen/${token}?employee=${employeeParam}`
        : `/api/public/screen/${token}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load" }));
        throw new Error(err.error || "Failed to load questionnaire");
      }
      return res.json();
    },
  });

  const { data: savedResponse } = useQuery<QuestionnaireResponse>({
    queryKey: ["/api/public/screen", token, "response", employeeParam],
    queryFn: async () => {
      const url = employeeParam
        ? `/api/public/screen/${token}/response?employee=${employeeParam}`
        : `/api/public/screen/${token}/response`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!screeningData,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { responses: Record<string, any>; sectionStates: SectionState[] }) => {
      if (!screeningData?.employeeId) return;
      const res = await fetch(`/api/public/screen/${token}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaireId: screeningData.questionnaire.id,
          responses: data.responses,
          completionPercentage: calculateCompletion(data.sectionStates),
          employeeId: screeningData.employeeId,
        }),
      });
      if (!res.ok) throw new Error("Failed to save progress");
      return res.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { responses: Record<string, any> }) => {
      const res = await fetch(`/api/public/screen/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaireId: screeningData?.questionnaire.id,
          responses: data.responses,
          employeeId: screeningData?.employeeId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Submission failed" }));
        throw new Error(err.error || "Failed to submit");
      }
      return res.json();
    },
  });

  const calculateCompletion = (sectionStates: SectionState[]): number => {
    if (!sectionStates.length) return 0;
    const completed = sectionStates.filter(s => s.status === "completed" || s.status === "skipped").length;
    return Math.round((completed / sectionStates.length) * 100);
  };

  const handleComplete = async (responses: Record<string, any>, sectionStates: SectionState[]) => {
    setIsSubmitting(true);
    try {
      await submitMutation.mutateAsync({ responses });
      setIsComplete(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit questionnaire. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" data-testid="loading-spinner" />
          <p className="text-muted-foreground">Loading your screening questionnaire...</p>
        </div>
      </div>
    );
  }

  if (error || !screeningData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle data-testid="text-error-title">Screening Not Available</CardTitle>
            <CardDescription data-testid="text-error-message">
              {(error as Error)?.message || "This screening link is invalid or has expired. Please contact your employer for a new link."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isComplete || savedResponse?.isCompleted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl" data-testid="text-completion-title">
              Thank You!
            </CardTitle>
            <CardDescription className="text-base" data-testid="text-completion-message">
              Your screening questionnaire has been submitted successfully. 
              {screeningData.employer.companyName && (
                <span> {screeningData.employer.companyName} will review your responses.</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              You can safely close this page. No further action is needed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sections = Array.isArray(screeningData.questionnaire.questions)
    ? screeningData.questionnaire.questions
    : [];

  if (!sections.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Questionnaire Not Ready</CardTitle>
            <CardDescription>
              The screening questionnaire is not yet configured. Please contact your employer.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!screeningData.employeeId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center space-y-4">
            <CardTitle data-testid="text-missing-employee">Screening Link Incomplete</CardTitle>
            <CardDescription data-testid="text-missing-employee-message">
              This screening link is missing your employee information. Please use the link provided to you by your employer via text message, email, or QR code. If you continue to see this message, contact your employer for assistance.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const brandColor = screeningData.employer.primaryColor || "#2563eb";

  return (
    <div className="relative min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            {screeningData.employer.logoUrl && (
              <img
                src={screeningData.employer.logoUrl}
                alt={screeningData.employer.companyName}
                className="h-8 w-auto object-contain"
                data-testid="img-employer-logo"
              />
            )}
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-employer-name">
                {screeningData.employer.companyName}
              </h1>
              <p className="text-xs text-muted-foreground">WOTC Screening Questionnaire</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-[130px]" data-testid="select-language">
                <Globe className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code} data-testid={`language-${lang.code}`}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {screeningData.employeeName && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <p className="text-sm text-muted-foreground" data-testid="text-employee-greeting">
            Welcome, <span className="font-medium text-foreground">{screeningData.employeeName}</span>
          </p>
        </div>
      )}

      <QuestionnaireWizard
        sections={sections}
        welcomeMessage={screeningData.employer.welcomeMessage || screeningData.questionnaire.description || "Let's see if you qualify for valuable tax credits!"}
        onComplete={handleComplete}
        initialResponses={savedResponse?.responses as Record<string, any> || {}}
        initialSectionStates={[]}
        onQuestionChange={(question, section) => {
          setCurrentQuestion(question);
          setCurrentSection(section);
        }}
        language={selectedLanguage}
      />

      <footer className="border-t bg-card mt-8">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>Your responses are encrypted and secure</span>
        </div>
      </footer>

      <div className="fixed bottom-6 right-6 z-50">
        {!showChat && (
          <Button
            size="icon"
            onClick={() => setShowChat(true)}
            className="rounded-full h-12 w-12 shadow-lg"
            data-testid="button-open-chat"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        )}
      </div>

      {showChat && (
        <AIAssistantChat
          context={{
            currentQuestion,
            currentSection,
            employeeName: screeningData.employeeName || "there",
            language: selectedLanguage,
          }}
          onClose={() => setShowChat(false)}
          isMinimized={isChatMinimized}
          onToggleMinimize={() => setIsChatMinimized(!isChatMinimized)}
        />
      )}
    </div>
  );
}
