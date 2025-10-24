import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, Loader2, FileText } from "lucide-react";
import type { Invoice, InvoiceLineItem, Payment, Employer, Subscription, SubscriptionPlan } from "@shared/schema";

export default function InvoiceDetailPage() {
  const [, params] = useRoute("/employer/invoice/:id");
  const [, setLocation] = useLocation();
  const invoiceId = params?.id;

  const { data, isLoading } = useQuery<{
    invoice: Invoice;
    employer: Employer;
    subscription: Subscription | null;
    plan: SubscriptionPlan | null;
    lineItems: InvoiceLineItem[];
    payments: Payment[];
  }>({
    queryKey: ["/api/invoices", invoiceId],
    enabled: !!invoiceId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <div className="text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-bold mb-2">Invoice Not Found</h2>
          <p className="text-muted-foreground mb-4">The invoice you're looking for doesn't exist.</p>
          <Button onClick={() => setLocation("/employer/billing")} data-testid="button-back-to-billing">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Billing
          </Button>
        </div>
      </div>
    );
  }

  const { invoice, employer, lineItems, payments } = data;
  
  const statusColor = invoice.status === "paid" 
    ? "default" 
    : invoice.status === "open" 
    ? "secondary" 
    : "destructive";

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/employer/billing")}
            className="mb-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Billing
          </Button>
          <h1 className="text-3xl font-bold" data-testid="text-invoice-number">
            {invoice.invoiceNumber}
          </h1>
          <p className="text-muted-foreground">
            Issued on {new Date(invoice.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusColor} data-testid="badge-invoice-status">
            {invoice.status}
          </Badge>
          <Button variant="outline" data-testid="button-download">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card data-testid="card-billed-to">
          <CardHeader>
            <CardTitle>Billed To</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium" data-testid="text-employer-name">{employer.name}</p>
            {employer.contactEmail && (
              <p className="text-sm text-muted-foreground">{employer.contactEmail}</p>
            )}
            {employer.contactPhone && (
              <p className="text-sm text-muted-foreground">{employer.contactPhone}</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-payment-details">
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invoice.periodStart && invoice.periodEnd && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Billing Period:</span>
                <span data-testid="text-billing-period">
                  {new Date(invoice.periodStart).toLocaleDateString()} - {new Date(invoice.periodEnd).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Issue Date:</span>
              <span data-testid="text-issue-date">{new Date(invoice.createdAt).toLocaleDateString()}</span>
            </div>
            {invoice.dueDate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due Date:</span>
                <span 
                  className={invoice.status !== "paid" ? "text-orange-600 dark:text-orange-400 font-medium" : ""}
                  data-testid="text-due-date"
                >
                  {new Date(invoice.dueDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {invoice.paidAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid On:</span>
                <span className="text-green-600 dark:text-green-400 font-medium" data-testid="text-paid-date">
                  {new Date(invoice.paidAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card data-testid="card-line-items">
        <CardHeader>
          <CardTitle>Invoice Items</CardTitle>
          <CardDescription>Detailed breakdown of charges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {lineItems.map((item, index) => (
              <div key={item.id} className="flex justify-between items-start" data-testid={`line-item-${index}`}>
                <div className="flex-1">
                  <p className="font-medium" data-testid={`text-item-description-${index}`}>{item.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} × ${Number(item.unitPrice).toFixed(2)}
                  </p>
                  {item.periodStart && item.periodEnd && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.periodStart).toLocaleDateString()} - {new Date(item.periodEnd).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="font-medium" data-testid={`text-item-amount-${index}`}>
                  ${Number(item.amount).toFixed(2)}
                </div>
              </div>
            ))}
            
            {lineItems.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No line items</p>
            )}
          </div>

          <Separator className="my-4" />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span data-testid="text-subtotal">${Number(invoice.subtotal).toFixed(2)}</span>
            </div>
            {Number(invoice.taxAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax:</span>
                <span data-testid="text-tax">${Number(invoice.taxAmount).toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span data-testid="text-total">${Number(invoice.totalAmount).toFixed(2)}</span>
            </div>
            {Number(invoice.amountPaid) > 0 && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span>Amount Paid:</span>
                <span data-testid="text-amount-paid">-${Number(invoice.amountPaid).toFixed(2)}</span>
              </div>
            )}
            {Number(invoice.amountDue) > 0 && (
              <div className="flex justify-between text-lg font-bold text-orange-600 dark:text-orange-400">
                <span>Amount Due:</span>
                <span data-testid="text-amount-due">${Number(invoice.amountDue).toFixed(2)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      {payments && payments.length > 0 && (
        <Card data-testid="card-payment-history">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.map((payment, index) => (
                <div key={payment.id} className="flex justify-between items-center p-3 border rounded-lg" data-testid={`payment-${index}`}>
                  <div>
                    <p className="font-medium">
                      {payment.status === "succeeded" ? "Payment Received" : payment.status}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(payment.createdAt).toLocaleDateString()} • {payment.paymentMethod || "N/A"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600 dark:text-green-400" data-testid={`text-payment-amount-${index}`}>
                      ${Number(payment.amount).toFixed(2)}
                    </p>
                    {payment.cardLast4 && (
                      <p className="text-xs text-muted-foreground">
                        {payment.cardBrand} •••• {payment.cardLast4}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {invoice.notes && (
        <Card data-testid="card-notes">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground" data-testid="text-notes">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
