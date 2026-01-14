import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { 
  MessageCircle, 
  Send, 
  X, 
  HelpCircle, 
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  suggestedQuestions?: string[];
}

interface QuestionnaireContext {
  currentQuestion: string;
  currentSection: string;
  employeeName?: string;
  language?: string;
}

interface AIAssistantChatProps {
  context: QuestionnaireContext;
  onClose?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export default function AIAssistantChat({ 
  context, 
  onClose,
  isMinimized = false,
  onToggleMinimize 
}: AIAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hi${context.employeeName ? ` ${context.employeeName}` : ""}! I'm here to help you with the WOTC questionnaire. Feel free to ask me about any questions you don't understand.`,
      suggestedQuestions: [
        "What is WOTC?",
        "Why am I being asked these questions?",
        "What does this question mean?"
      ]
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await apiRequest("POST", "/api/ai/chat", {
        message: userMessage,
        context,
        conversationHistory: messages.slice(-10).map(m => ({
          role: m.role,
          content: m.content
        }))
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.message,
        suggestedQuestions: data.relatedQuestions
      }]);
    },
    onError: () => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm sorry, I'm having trouble right now. Please try again or contact your HR representative for help."
      }]);
    }
  });

  const simplifyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/simplify", {
        question: context.currentQuestion,
        language: context.language || "en"
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `**Simpler version:** ${data.simplifiedQuestion}\n\n**What it means:** ${data.explanation}${data.exampleAnswer ? `\n\n**Example:** ${data.exampleAnswer}` : ""}`
      }]);
    }
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || chatMutation.isPending) return;
    
    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setInputValue("");
    chatMutation.mutate(userMessage);
  };

  const handleSuggestedQuestion = (question: string) => {
    setMessages(prev => [...prev, { role: "user", content: question }]);
    chatMutation.mutate(question);
  };

  const handleSimplify = () => {
    if (context.currentQuestion) {
      setMessages(prev => [...prev, { 
        role: "user", 
        content: "Can you simplify the current question for me?" 
      }]);
      simplifyMutation.mutate();
    }
  };

  if (isMinimized) {
    return (
      <div 
        className="fixed bottom-4 right-4 z-50"
        data-testid="chat-minimized"
      >
        <Button
          onClick={onToggleMinimize}
          className="rounded-full h-14 w-14 shadow-lg"
          data-testid="button-expand-chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <Card 
      className="fixed bottom-4 right-4 w-96 h-[500px] z-50 shadow-xl flex flex-col"
      data-testid="chat-container"
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">AI Assistant</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          {onToggleMinimize && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onToggleMinimize}
              data-testid="button-minimize-chat"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          )}
          {onClose && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              data-testid="button-close-chat"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`message-${message.role}-${index}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs opacity-70">Quick questions:</p>
                      <div className="flex flex-wrap gap-1">
                        {message.suggestedQuestions.map((q, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="cursor-pointer text-xs"
                            onClick={() => handleSuggestedQuestion(q)}
                            data-testid={`button-suggestion-${i}`}
                          >
                            {q}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {(chatMutation.isPending || simplifyMutation.isPending) && (
              <div className="flex justify-start" data-testid="chat-loading">
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {context.currentQuestion && (
          <div className="px-4 py-2 border-t bg-muted/50">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground truncate flex-1">
                Current: {context.currentQuestion.substring(0, 40)}...
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSimplify}
                disabled={simplifyMutation.isPending}
                data-testid="button-simplify"
              >
                <HelpCircle className="h-3 w-3 mr-1" />
                Simplify
              </Button>
            </div>
          </div>
        )}

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Ask me anything..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={chatMutation.isPending}
              data-testid="input-chat-message"
            />
            <Button 
              onClick={handleSend} 
              disabled={!inputValue.trim() || chatMutation.isPending}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
