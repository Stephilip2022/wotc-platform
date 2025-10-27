import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { HelpCircle, Sparkles, Upload, CheckCircle, FileText, Loader2 } from "lucide-react";
import { shouldDisplayQuestion } from "./conditional-logic";
import { useToast } from "@/hooks/use-toast";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { CameraFileUpload } from "@/components/mobile/CameraFileUpload";
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
  const { toast } = useToast();
  const { isMobile } = useMobileDetect();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [fileObject, setFileObject] = useState<File | null>(null);

  // Sync uploaded file state with value prop (for persisted responses)
  useEffect(() => {
    if (value && typeof value === "object" && value.url) {
      setUploadedFile(value);
    } else if (!value) {
      setUploadedFile(null);
    }
  }, [value]);

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

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", (question.ui as any)?.documentType || "other");
      formData.append("description", questionText);

      const response = await fetch("/api/upload/document", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      const fileData = {
        name: file.name,
        url: data.document.filePath,
        documentId: data.document.id,
      };

      setUploadedFile(fileData);
      onAnswerChange(question.id, fileData);

      toast({
        title: "File uploaded",
        description: `${file.name} has been uploaded successfully.`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
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
          className="text-base min-h-[44px]"
          inputMode={question.id.toLowerCase().includes("email") ? "email" : question.id.toLowerCase().includes("phone") ? "tel" : "text"}
          autoComplete={question.id.toLowerCase().includes("email") ? "email" : question.id.toLowerCase().includes("phone") ? "tel" : undefined}
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
          className="text-base min-h-[44px]"
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
          className="text-base min-h-[44px]"
          inputMode="numeric"
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

      {question.type === "file" && isMobile && (
        <CameraFileUpload
          questionId={question.id}
          onFileChange={async (file) => {
            if (!file) {
              setUploadedFile(null);
              setFileObject(null);
              onAnswerChange(question.id, null);
              return;
            }

            setFileObject(file);
            setIsUploading(true);
            try {
              const formData = new FormData();
              formData.append("file", file);
              formData.append("documentType", (question.ui as any)?.documentType || "other");
              formData.append("description", questionText);

              const response = await fetch("/api/upload/document", {
                method: "POST",
                body: formData,
              });

              if (!response.ok) {
                throw new Error("Upload failed");
              }

              const data = await response.json();
              const fileData = {
                name: file.name,
                url: data.document.filePath,
                documentId: data.document.id,
              };

              setUploadedFile(fileData);
              onAnswerChange(question.id, fileData);

              toast({
                title: "Upload successful",
                description: `${file.name} has been uploaded.`,
              });
            } catch (error) {
              console.error("Upload error:", error);
              toast({
                title: "Upload failed",
                description: "Please try again.",
                variant: "destructive",
              });
              setFileObject(null);
            } finally {
              setIsUploading(false);
            }
          }}
          uploadedFile={fileObject}
          isUploading={isUploading}
        />
      )}

      {question.type === "file" && !isMobile && (
        <div className="space-y-3">
          {uploadedFile ? (
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="font-medium text-sm">{uploadedFile.name}</p>
                <p className="text-xs text-muted-foreground">File uploaded successfully</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUploadedFile(null);
                  onAnswerChange(question.id, null);
                }}
                data-testid={`button-remove-file-${question.id}`}
              >
                Remove
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                id={question.id}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileUpload}
                disabled={isUploading}
                data-testid={`input-file-${question.id}`}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium hover:file:bg-accent"
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Accepted formats: PDF, JPG, PNG, DOC, DOCX (max 10MB)
          </p>
        </div>
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
