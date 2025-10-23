import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { HelpCircle, Sparkles } from "lucide-react";
import { shouldDisplayQuestion } from "./conditional-logic";
import type { QuestionMetadata } from "@shared/schema";

interface QuestionRendererProps {
  question: QuestionMetadata;
  value: any;
  onAnswerChange: (questionId: string, answer: any) => void;
  responses: Record<string, any>;
  onSimplify?: (questionId: string, questionText: string) => void;
  isSimplifying?: boolean;
  simplifiedText?: string;
}

export default function QuestionRenderer({
  question,
  value,
  onAnswerChange,
  responses,
  onSimplify,
  isSimplifying,
  simplifiedText,
}: QuestionRendererProps) {
  // Check if question should be displayed
  if (!shouldDisplayQuestion(question.id, question.displayCondition, responses)) {
    return null;
  }

  const questionText = simplifiedText || question.question;
  const showSimplifyButton = !simplifiedText && onSimplify;

  // Animation for question appearance
  const questionVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={questionVariants}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      {/* Question Label */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Label htmlFor={question.id} className="text-base font-medium">
            {questionText}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {showSimplifyButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSimplify?.(question.id, question.question)}
              disabled={isSimplifying}
              data-testid={`button-simplify-${question.id}`}
              className="shrink-0"
            >
              {isSimplifying ? (
                <Sparkles className="w-4 h-4 animate-spin" />
              ) : (
                <HelpCircle className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
        {question.ui?.helpText && (
          <p className="text-sm text-muted-foreground">{question.ui.helpText}</p>
        )}
      </div>

      {/* Question Input */}
      {question.type === "text" && (
        <Input
          id={question.id}
          value={value || ""}
          onChange={(e) => onAnswerChange(question.id, e.target.value)}
          placeholder={question.ui?.placeholder}
          data-testid={`input-${question.id}`}
          className="text-base"
        />
      )}

      {question.type === "radio" && question.options && (
        <RadioGroup
          value={value || ""}
          onValueChange={(val) => onAnswerChange(question.id, val)}
          data-testid={`radio-${question.id}`}
        >
          {question.options.map((option) => (
            <div key={option} className="flex items-center space-x-2">
              <RadioGroupItem
                value={option}
                id={`${question.id}-${option}`}
                data-testid={`radio-option-${question.id}-${option.toLowerCase().replace(/\s+/g, "-")}`}
              />
              <Label
                htmlFor={`${question.id}-${option}`}
                className="font-normal cursor-pointer"
              >
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {question.type === "checkbox" && question.options && (
        <div className="space-y-2" data-testid={`checkbox-${question.id}`}>
          {question.options.map((option) => {
            const isChecked = Array.isArray(value) && value.includes(option);
            return (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={`${question.id}-${option}`}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    const newValue = Array.isArray(value) ? [...value] : [];
                    if (checked) {
                      if (!newValue.includes(option)) {
                        newValue.push(option);
                      }
                    } else {
                      const index = newValue.indexOf(option);
                      if (index > -1) {
                        newValue.splice(index, 1);
                      }
                    }
                    onAnswerChange(question.id, newValue);
                  }}
                  data-testid={`checkbox-option-${question.id}-${option.toLowerCase().replace(/\s+/g, "-")}`}
                />
                <Label
                  htmlFor={`${question.id}-${option}`}
                  className="font-normal cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            );
          })}
        </div>
      )}

      {question.type === "date" && (
        <Input
          id={question.id}
          type="date"
          value={value || ""}
          onChange={(e) => onAnswerChange(question.id, e.target.value)}
          data-testid={`input-date-${question.id}`}
          className="text-base"
        />
      )}

      {question.type === "number" && (
        <Input
          id={question.id}
          type="number"
          value={value || ""}
          onChange={(e) => onAnswerChange(question.id, e.target.value)}
          placeholder={question.ui?.placeholder}
          data-testid={`input-number-${question.id}`}
          className="text-base"
        />
      )}

      {question.type === "select" && question.options && (
        <select
          id={question.id}
          value={value || ""}
          onChange={(e) => onAnswerChange(question.id, e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          data-testid={`select-${question.id}`}
        >
          <option value="">Select an option...</option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {/* Encouraging Message */}
      {question.ui?.encouragingMessage && value && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-green-600 dark:text-green-400 font-medium"
        >
          {question.ui.encouragingMessage}
        </motion.p>
      )}

      {/* Follow-up Questions (Recursive) */}
      {question.followUpQuestions && question.followUpQuestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="pl-4 border-l-2 border-muted space-y-4 mt-4"
        >
          {question.followUpQuestions.map((followUp) => (
            <QuestionRenderer
              key={followUp.id}
              question={followUp}
              value={responses[followUp.id]}
              onAnswerChange={onAnswerChange}
              responses={responses}
              onSimplify={onSimplify}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
