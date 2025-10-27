import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, ChevronRight, Sparkles, AlertCircle, ChevronLeft } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { getIconForTargetGroup, getColorForSection, getSectionName, getEncouragingMessage } from "@shared/wotc-icons";
import { validateRequiredQuestions } from "./conditional-logic";
import QuestionRenderer from "./QuestionRenderer";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import type { QuestionnaireSection, SectionState, WOTCTargetGroup } from "@shared/schema";

interface QuestionnaireWizardProps {
  sections: QuestionnaireSection[];
  welcomeMessage?: string;
  onComplete: (responses: Record<string, any>, sectionStates: SectionState[]) => void;
  initialResponses?: Record<string, any>;
  initialSectionStates?: SectionState[];
}

export default function QuestionnaireWizard({
  sections,
  welcomeMessage,
  onComplete,
  initialResponses = {},
  initialSectionStates = [],
}: QuestionnaireWizardProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>(initialResponses);
  const [sectionStates, setSectionStates] = useState<SectionState[]>(
    initialSectionStates.length > 0
      ? initialSectionStates
      : sections.map(s => ({ sectionId: s.id, status: "pending" }))
  );
  const [showWelcome, setShowWelcome] = useState(!!welcomeMessage);
  const [showCelebration, setShowCelebration] = useState(false);

  const { isMobile } = useMobileDetect();
  const currentSection = sections[currentSectionIndex];
  const progress = ((currentSectionIndex + 1) / sections.length) * 100;
  const completedCount = sectionStates.filter(s => s.status === "completed" || s.status === "skipped").length;

  // Swipe handlers for mobile navigation
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (isMobile && currentSectionIndex < sections.length - 1) {
        const currentState = sectionStates.find(s => s.sectionId === currentSection.id);
        if (currentState?.status === "completed" || currentState?.status === "skipped") {
          setCurrentSectionIndex(prev => prev + 1);
        }
      }
    },
    onSwipedRight: () => {
      if (isMobile && currentSectionIndex > 0) {
        setCurrentSectionIndex(prev => prev - 1);
      }
    },
    preventScrollOnSwipe: true,
    trackMouse: false,
  });

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  };

  const celebrationVariants = {
    initial: { scale: 0, rotate: -180 },
    animate: { scale: 1, rotate: 0 },
    exit: { scale: 0, rotate: 180 },
  };

  // Update section state
  const updateSectionState = (sectionId: string, status: SectionState["status"], reason?: string) => {
    setSectionStates(prev =>
      prev.map(s =>
        s.sectionId === sectionId
          ? {
              ...s,
              status,
              completedAt: status === "completed" || status === "skipped" ? new Date().toISOString() : s.completedAt,
              skippedReason: reason || s.skippedReason,
            }
          : s
      )
    );
  };

  // Handle gating question answer
  const handleGatingAnswer = (answer: any) => {
    const gatingQuestionId = `${currentSection.id}_gating`;
    setResponses(prev => ({ ...prev, [gatingQuestionId]: answer }));

    const isApplicable = currentSection.gatingConfig.applicableAnswers.includes(answer);

    if (isApplicable) {
      // Section is applicable - mark as in progress
      updateSectionState(currentSection.id, "in_progress");
    } else {
      // Section not applicable - skip it
      updateSectionState(currentSection.id, "skipped", "Not applicable");
      
      // Show skip message briefly then move to next section
      setTimeout(() => {
        if (currentSectionIndex < sections.length - 1) {
          setCurrentSectionIndex(prev => prev + 1);
        } else {
          handleComplete();
        }
      }, 1500);
    }
  };

  // Handle section question answer
  const handleQuestionAnswer = (questionId: string, answer: any) => {
    setResponses(prev => ({ ...prev, [questionId]: answer }));
  };

  // Complete current section
  const completeSection = () => {
    updateSectionState(currentSection.id, "completed");
    setShowCelebration(true);

    setTimeout(() => {
      setShowCelebration(false);
      if (currentSectionIndex < sections.length - 1) {
        setCurrentSectionIndex(prev => prev + 1);
      } else {
        handleComplete();
      }
    }, 2000);
  };

  // Complete entire questionnaire
  const handleComplete = () => {
    onComplete(responses, sectionStates);
  };

  // Render dynamic icon
  const renderIcon = (iconName: string, className?: string) => {
    const Icon = (LucideIcons as any)[iconName];
    if (!Icon) return null;
    return <Icon className={className} />;
  };

  // Welcome screen
  if (showWelcome) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="max-w-2xl mx-auto p-4 md:p-8"
      >
        <Card className="border-2">
          <CardContent className="p-8 md:p-12 text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              <Sparkles className="w-16 h-16 mx-auto text-primary" />
            </motion.div>
            <h1 className="text-3xl md:text-4xl font-bold">Welcome!</h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              {welcomeMessage || "Let's see if you qualify for valuable tax credits that benefit both you and your employer."}
            </p>
            <div className="pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                This should take about 5-10 minutes
              </p>
              <Button
                size="lg"
                onClick={() => setShowWelcome(false)}
                data-testid="button-start-questionnaire"
                className="min-w-[200px]"
              >
                Let's Get Started
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const currentState = sectionStates.find(s => s.sectionId === currentSection.id);
  const isGatingAnswered = responses[`${currentSection.id}_gating`] !== undefined;
  const isApplicable = currentSection.gatingConfig.applicableAnswers.includes(
    responses[`${currentSection.id}_gating`]
  );
  const isSkipped = currentState?.status === "skipped";

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8" {...(isMobile ? swipeHandlers : {})}>
      {/* Progress Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 space-y-3"
      >
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {isMobile && currentSectionIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentSectionIndex(prev => prev - 1)}
                data-testid="button-prev-section"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <span className="font-medium">
              Section {currentSectionIndex + 1} of {sections.length}
            </span>
          </div>
          <span className="text-muted-foreground text-xs md:text-sm">
            {completedCount} completed
          </span>
        </div>
        <Progress value={progress} className="h-2 md:h-3" data-testid="progress-bar" />
        {isMobile && (
          <p className="text-xs text-center text-muted-foreground">
            Swipe left/right to navigate
          </p>
        )}
      </motion.div>

      {/* Celebration Animation */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            variants={celebrationVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-background/95 backdrop-blur-sm rounded-full p-12">
              <CheckCircle2 className="w-24 h-24 text-green-500" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSection.id}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3 }}
        >
          <Card className="border-2">
            <CardContent className="p-6 md:p-8 space-y-6">
              {/* Section Header */}
              <div className="text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: "spring" }}
                  className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${getColorForSection(
                    currentSection.targetGroups[0]
                  )} flex items-center justify-center`}
                >
                  {renderIcon(currentSection.icon || "HelpCircle", "w-10 h-10 text-white")}
                </motion.div>
                <div>
                  <Badge variant="outline" className="mb-2">
                    {getSectionName(currentSection.targetGroups[0])}
                  </Badge>
                  <h2 className="text-2xl font-bold">{currentSection.name}</h2>
                  {currentSection.description && (
                    <p className="text-muted-foreground mt-2">{currentSection.description}</p>
                  )}
                </div>
              </div>

              {/* Gating Question (if not yet answered) */}
              {!isGatingAnswered && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-4"
                >
                  <p className="text-lg font-medium text-center">
                    {currentSection.gatingConfig.questionText}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {currentSection.gatingConfig.applicableAnswers.map((answer) => (
                      <Button
                        key={answer}
                        size="lg"
                        onClick={() => handleGatingAnswer(answer)}
                        data-testid={`button-gating-${answer.toLowerCase().replace(/\s+/g, "-")}`}
                        className="min-w-[120px]"
                      >
                        {answer}
                      </Button>
                    ))}
                    {currentSection.gatingConfig.notApplicableAnswers.map((answer) => (
                      <Button
                        key={answer}
                        variant="outline"
                        size="lg"
                        onClick={() => handleGatingAnswer(answer)}
                        data-testid={`button-gating-${answer.toLowerCase().replace(/\s+/g, "-")}`}
                        className="min-w-[120px]"
                      >
                        {answer}
                      </Button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Skipped Message */}
              {isGatingAnswered && isSkipped && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-4 py-8"
                >
                  <CheckCircle2 className="w-16 h-16 mx-auto text-muted-foreground" />
                  <p className="text-lg font-medium">
                    {currentSection.gatingConfig.skipMessage || "No problem! Moving on to the next section."}
                  </p>
                  <p className="text-sm text-muted-foreground">{getEncouragingMessage()}</p>
                </motion.div>
              )}

              {/* Section Questions (if applicable) */}
              {isGatingAnswered && isApplicable && !isSkipped && (
                <SectionQuestions
                  section={currentSection}
                  responses={responses}
                  onAnswerChange={handleQuestionAnswer}
                  onComplete={completeSection}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Section Questions Component
interface SectionQuestionsProps {
  section: QuestionnaireSection;
  responses: Record<string, any>;
  onAnswerChange: (questionId: string, answer: any) => void;
  onComplete: () => void;
}

function SectionQuestions({ section, responses, onAnswerChange, onComplete }: SectionQuestionsProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleComplete = () => {
    // Validate required questions
    const validation = validateRequiredQuestions(section.questions, responses);
    
    if (!validation.valid) {
      setValidationError(`Please answer all required questions (${validation.missingQuestions.length} remaining)`);
      return;
    }

    setValidationError(null);
    onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center">
        <p className="text-sm font-medium text-green-600 dark:text-green-400">
          {getEncouragingMessage()}
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {section.questions.map((question) => (
          <QuestionRenderer
            key={question.id}
            question={question}
            value={responses[question.id]}
            onAnswerChange={(questionId, value) => {
              onAnswerChange(questionId, value);
              setValidationError(null); // Clear error when user starts answering
            }}
            responses={responses}
          />
        ))}
      </div>

      {/* Validation Error */}
      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {/* Completion Message */}
      {section.completionMessage && (
        <p className="text-center text-sm text-muted-foreground italic">
          {section.completionMessage}
        </p>
      )}

      {/* Continue Button */}
      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          onClick={handleComplete}
          data-testid="button-complete-section"
          className="min-w-[200px]"
        >
          Continue
          <ChevronRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
}
