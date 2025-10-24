import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, Plus, Edit, Trash2, Download, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import CSVImportWizard from "@/components/CSVImportWizard";

const hoursFormSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  hours: z.string().min(1, "Hours is required").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Must be a positive number"),
  periodStart: z.string().min(1, "Start date is required"),
  periodEnd: z.string().min(1, "End date is required"),
  notes: z.string().optional(),
});

type HoursFormValues = z.infer<typeof hoursFormSchema>;

export default function EmployerHoursPage() {
  const { toast } = useToast();
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [enhancedImportDialog, setEnhancedImportDialog] = useState(false);
  const [selectedHours, setSelectedHours] = useState<any>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const form = useForm<HoursFormValues>({
    resolver: zodResolver(hoursFormSchema),
    defaultValues: {
      employeeId: "",
      hours: "",
      periodStart: "",
      periodEnd: "",
      notes: "",
    },
  });

  const editForm = useForm<HoursFormValues>({
    resolver: zodResolver(hoursFormSchema),
  });

  // Fetch hours entries
  const { data: hoursData, isLoading } = useQuery({
    queryKey: ["/api/employer/hours"],
  });

  // Fetch employees for dropdown
  const { data: employees } = useQuery({
    queryKey: ["/api/employer/employees"],
  });

  // Add hours mutation
  const addHoursMutation = useMutation({
    mutationFn: async (data: HoursFormValues) => {
      const response = await apiRequest("POST", "/api/employer/hours", {
        ...data,
        hours: Number(data.hours),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employer/hours"] });
      setAddDialog(false);
      form.reset();
      toast({
        title: "Hours Added",
        description: "Work hours have been recorded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add hours",
        variant: "destructive",
      });
    },
  });

  // Update hours mutation
  const updateHoursMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: HoursFormValues }) => {
      const response = await apiRequest("PATCH", `/api/employer/hours/${id}`, {
        ...data,
        hours: Number(data.hours),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employer/hours"] });
      setEditDialog(false);
      setSelectedHours(null);
      toast({
        title: "Hours Updated",
        description: "Work hours have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update hours",
        variant: "destructive",
      });
    },
  });

  // Delete hours mutation
  const deleteHoursMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/employer/hours/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employer/hours"] });
      toast({
        title: "Hours Deleted",
        description: "Work hours have been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete hours",
        variant: "destructive",
      });
    },
  });

  // CSV Import mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/employer/hours/bulk", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Import failed");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employer/hours"] });
      setImportDialog(false);
      setCsvFile(null);
      
      let description = `Successfully imported ${data.imported} hours entries.`;
      if (data.errors && data.errors.length > 0) {
        description += ` ${data.errors.length} rows had errors.`;
      }

      toast({
        title: "Import Complete",
        description,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to import CSV",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (item: any) => {
    setSelectedHours(item);
    editForm.reset({
      employeeId: item.hours.employeeId,
      hours: item.hours.hours,
      periodStart: item.hours.periodStart,
      periodEnd: item.hours.periodEnd,
      notes: item.hours.notes || "",
    });
    setEditDialog(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this hours entry?")) {
      deleteHoursMutation.mutate(id);
    }
  };

  const downloadCSVTemplate = () => {
    const template = "employeeId,hours,periodStart,periodEnd,notes\nEMP001,160,2024-01-01,2024-01-31,January hours";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hours-import-template.csv";
    a.click();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Hours Tracking</h1>
          <p className="text-muted-foreground">
            Track employee work hours for WOTC credit calculations
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            onClick={() => setEnhancedImportDialog(true)}
            data-testid="button-smart-import"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Smart Import
          </Button>
          <Button
            variant="outline"
            onClick={() => setImportDialog(true)}
            data-testid="button-import-csv"
          >
            <Upload className="h-4 w-4 mr-2" />
            Quick Import
          </Button>
          <Button
            onClick={() => setAddDialog(true)}
            data-testid="button-add-hours"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Hours
          </Button>
        </div>
      </div>

      {/* Hours Table */}
      <Card>
        <CardHeader>
          <CardTitle>Hours Entries ({hoursData?.length || 0})</CardTitle>
          <CardDescription>All recorded work hours for your employees</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !hoursData || hoursData.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No hours entries yet</p>
              <Button onClick={() => setAddDialog(true)} data-testid="button-add-first-hours">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Entry
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {hoursData.map((item: any) => (
                <div
                  key={item.hours.id}
                  className="border rounded-lg p-4"
                  data-testid={`hours-row-${item.hours.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-semibold" data-testid={`employee-name-${item.hours.id}`}>
                            {item.employee?.firstName} {item.employee?.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {item.hours.periodStart} to {item.hours.periodEnd}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-4 flex-wrap">
                        <span className="text-sm">
                          <strong>Hours:</strong> {item.hours.hours}
                        </span>
                        <Badge variant="secondary">{item.hours.source}</Badge>
                        {item.hours.notes && (
                          <span className="text-sm text-muted-foreground">
                            {item.hours.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(item)}
                        data-testid={`button-edit-${item.hours.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(item.hours.id)}
                        data-testid={`button-delete-${item.hours.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Hours Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Work Hours</DialogTitle>
            <DialogDescription>
              Record work hours for an employee
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => addHoursMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-employee">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees?.map((emp: any) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.firstName} {emp.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours Worked</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" placeholder="160" data-testid="input-hours" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="periodStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Start</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-period-start" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="periodEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period End</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-period-end" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes" data-testid="textarea-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setAddDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addHoursMutation.isPending} data-testid="button-submit-hours">
                  {addHoursMutation.isPending ? "Adding..." : "Add Hours"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Hours Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Work Hours</DialogTitle>
            <DialogDescription>
              Update work hours for {selectedHours?.employee?.firstName} {selectedHours?.employee?.lastName}
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form 
              onSubmit={editForm.handleSubmit((data) => 
                updateHoursMutation.mutate({ id: selectedHours.hours.id, data })
              )} 
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours Worked</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" data-testid="input-edit-hours" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="periodStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Start</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-edit-period-start" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="periodEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period End</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-edit-period-end" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes" data-testid="textarea-edit-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateHoursMutation.isPending} data-testid="button-update-hours">
                  {updateHoursMutation.isPending ? "Updating..." : "Update Hours"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Hours from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with work hours data
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                data-testid="input-csv-file"
              />
              <p className="text-sm text-muted-foreground mt-1">
                CSV format: employeeId, hours, periodStart, periodEnd, notes
              </p>
            </div>

            <Button
              variant="outline"
              onClick={downloadCSVTemplate}
              className="w-full"
              data-testid="button-download-template"
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => csvFile && importMutation.mutate(csvFile)}
              disabled={!csvFile || importMutation.isPending}
              data-testid="button-import-csv-submit"
            >
              {importMutation.isPending ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced CSV Import Wizard */}
      <CSVImportWizard
        open={enhancedImportDialog}
        onClose={() => setEnhancedImportDialog(false)}
        onComplete={() => {
          setEnhancedImportDialog(false);
          queryClient.invalidateQueries({ queryKey: ["/api/employer/hours"] });
          toast({
            title: "Import Complete",
            description: "Hours data has been imported successfully",
          });
        }}
      />
    </div>
  );
}
