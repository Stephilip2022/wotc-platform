import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Questionnaire, Employer } from "@shared/schema";

export default function QuestionnairesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestionnaire, setEditingQuestionnaire] = useState<Questionnaire | null>(null);

  const { data: questionnaires = [], isLoading } = useQuery<Questionnaire[]>({
    queryKey: ["/api/admin/questionnaires"],
  });

  const { data: employers = [] } = useQuery<Employer[]>({
    queryKey: ["/api/admin/employers"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/admin/questionnaires", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questionnaires"] });
      setDialogOpen(false);
      setEditingQuestionnaire(null);
      toast({ title: "Questionnaire saved successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/admin/questionnaires/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questionnaires"] });
      toast({ title: "Questionnaire deleted" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Questionnaires</h1>
          <p className="text-muted-foreground">Manage WOTC screening questionnaires</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-questionnaire">
              <Plus className="w-4 h-4 mr-2" />
              Create Questionnaire
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingQuestionnaire ? "Edit Questionnaire" : "Create New Questionnaire"}
              </DialogTitle>
            </DialogHeader>
            <QuestionnaireForm
              employers={employers}
              questionnaire={editingQuestionnaire}
              onSubmit={(data) => createMutation.mutate(data)}
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">Loading...</CardContent>
        </Card>
      ) : questionnaires.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No questionnaires yet. Create your first one above.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {questionnaires.map((q) => (
            <Card key={q.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{q.name}</CardTitle>
                    <CardDescription>
                      {employers.find((e) => e.id === q.employerId)?.name || "All Employers"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {q.isActive && <Badge>Active</Badge>}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingQuestionnaire(q);
                        setDialogOpen(true);
                      }}
                      data-testid={`button-edit-${q.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(q.id)}
                      data-testid={`button-delete-${q.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {((q.questions as any[]) || []).length} questions
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionnaireForm({
  employers,
  questionnaire,
  onSubmit,
  isPending,
}: {
  employers: Employer[];
  questionnaire: Questionnaire | null;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(questionnaire?.name || "");
  const [employerId, setEmployerId] = useState(questionnaire?.employerId || "");
  const [isActive, setIsActive] = useState(questionnaire?.isActive ?? true);
  const [questions, setQuestions] = useState<any[]>(
    (questionnaire?.questions as any[]) || [
      {
        id: "q1",
        question: "Have you received SNAP (Food Stamps) benefits in the last 6 months?",
        type: "radio",
        required: true,
        options: ["Yes", "No"],
      },
    ]
  );

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `q${questions.length + 1}`,
        question: "",
        type: "text",
        required: true,
        options: [],
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const handleSubmit = () => {
    if (!name || !employerId) {
      return;
    }

    onSubmit({
      id: questionnaire?.id,
      name,
      employerId,
      isActive,
      questions,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="WOTC Screening 2024"
          data-testid="input-name"
        />
      </div>

      <div>
        <Label>Employer</Label>
        <Select value={employerId} onValueChange={setEmployerId}>
          <SelectTrigger data-testid="select-employer">
            <SelectValue placeholder="Select employer" />
          </SelectTrigger>
          <SelectContent>
            {employers.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          id="isActive"
          data-testid="checkbox-active"
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Questions</h3>
          <Button variant="outline" size="sm" onClick={addQuestion} data-testid="button-add-question">
            <Plus className="w-4 h-4 mr-2" />
            Add Question
          </Button>
        </div>

        {questions.map((q, index) => (
          <Card key={q.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-3">
                  <Input
                    value={q.question}
                    onChange={(e) => updateQuestion(index, "question", e.target.value)}
                    placeholder="Question text"
                    data-testid={`input-question-${index}`}
                  />

                  <div className="flex gap-2 flex-wrap">
                    <Select
                      value={q.type}
                      onValueChange={(value) => updateQuestion(index, "type", value)}
                    >
                      <SelectTrigger data-testid={`select-type-${index}`} className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="radio">Multiple Choice</SelectItem>
                        <SelectItem value="checkbox">Checkboxes</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="file">File Upload</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={q.targetGroup || "none"}
                      onValueChange={(value) => updateQuestion(index, "targetGroup", value === "none" ? undefined : value)}
                    >
                      <SelectTrigger data-testid={`select-target-group-${index}`} className="w-48">
                        <SelectValue placeholder="Target Group (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="IX">IX - SNAP</SelectItem>
                        <SelectItem value="IV-A">IV-A - TANF Long-term</SelectItem>
                        <SelectItem value="IV-B">IV-B - TANF Short-term</SelectItem>
                        <SelectItem value="V">V - Veteran</SelectItem>
                        <SelectItem value="VI">VI - Ex-Felon</SelectItem>
                        <SelectItem value="X">X - SSI</SelectItem>
                        <SelectItem value="XI">XI - Summer Youth</SelectItem>
                      </SelectContent>
                    </Select>

                    {(q.type === "radio" || q.type === "checkbox") && (
                      <Input
                        value={q.options?.join(", ") || ""}
                        onChange={(e) =>
                          updateQuestion(
                            index,
                            "options",
                            e.target.value.split(",").map((o) => o.trim())
                          )
                        }
                        placeholder="Options (comma separated)"
                        data-testid={`input-options-${index}`}
                        className="flex-1"
                      />
                    )}
                  </div>

                  {q.targetGroup && (
                    <div className="mt-2">
                      <Input
                        value={
                          Array.isArray(q.eligibilityTrigger)
                            ? q.eligibilityTrigger.join(", ")
                            : q.eligibilityTrigger || ""
                        }
                        onChange={(e) => {
                          const values = e.target.value.split(",").map((v) => v.trim());
                          updateQuestion(index, "eligibilityTrigger", values.length === 1 ? values[0] : values);
                        }}
                        placeholder="Eligibility trigger value(s) - comma separated for multiple"
                        data-testid={`input-trigger-${index}`}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Which answer(s) make employee eligible for this target group
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeQuestion(index)}
                  data-testid={`button-remove-${index}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save">
          {isPending ? "Saving..." : "Save Questionnaire"}
        </Button>
      </div>
    </div>
  );
}
