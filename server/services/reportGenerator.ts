import PDFDocument from "pdfkit";
import { db } from "../db";
import { eq, sql, and, gte, lte, count, desc } from "drizzle-orm";
import {
  employers,
  employees,
  screenings,
  creditCalculations,
  taxCreditPrograms,
  programScreeningResults,
  programCreditCalculations,
  programSubmissions,
  employerProgramAssignments,
  generatedReports,
} from "@shared/schema";

interface ReportOptions {
  employerId?: string;
  reportType: string;
  periodStart?: Date;
  periodEnd?: Date;
  generatedBy?: string;
}

async function gatherCreditSummaryData(employerId: string | null, periodStart: Date, periodEnd: Date) {
  const empFilter = employerId ? sql`${screenings.employerId} = ${employerId}` : sql`1=1`;
  const creditFilter = employerId ? sql`${creditCalculations.employerId} = ${employerId}` : sql`1=1`;
  const progCreditFilter = employerId ? sql`${programCreditCalculations.employerId} = ${employerId}` : sql`1=1`;

  const [screeningStats] = await db
    .select({
      total: count(),
      eligible: sql<number>`COUNT(*) FILTER (WHERE ${screenings.status} IN ('eligible', 'certified'))`,
      certified: sql<number>`COUNT(*) FILTER (WHERE ${screenings.status} = 'certified')`,
      denied: sql<number>`COUNT(*) FILTER (WHERE ${screenings.status} = 'denied')`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${screenings.status} = 'pending')`,
    })
    .from(screenings)
    .where(and(empFilter, gte(screenings.createdAt, periodStart), lte(screenings.createdAt, periodEnd)));

  const [wotcCredits] = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${creditCalculations.projectedCreditAmount} AS DECIMAL)), 0)`,
      count: count(),
      avg: sql<number>`COALESCE(AVG(CAST(${creditCalculations.projectedCreditAmount} AS DECIMAL)), 0)`,
    })
    .from(creditCalculations)
    .where(and(creditFilter, gte(creditCalculations.calculatedAt, periodStart), lte(creditCalculations.calculatedAt, periodEnd)));

  const [multiCredits] = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${programCreditCalculations.finalCreditAmount} AS DECIMAL)), 0)`,
      count: count(),
    })
    .from(programCreditCalculations)
    .where(and(progCreditFilter, gte(programCreditCalculations.createdAt, periodStart), lte(programCreditCalculations.createdAt, periodEnd)));

  const byTargetGroup = await db
    .select({
      targetGroup: creditCalculations.targetGroup,
      count: count(),
      totalCredits: sql<number>`COALESCE(SUM(CAST(${creditCalculations.projectedCreditAmount} AS DECIMAL)), 0)`,
    })
    .from(creditCalculations)
    .where(and(creditFilter, gte(creditCalculations.calculatedAt, periodStart), lte(creditCalculations.calculatedAt, periodEnd), sql`${creditCalculations.targetGroup} IS NOT NULL`))
    .groupBy(creditCalculations.targetGroup)
    .orderBy(desc(sql`COALESCE(SUM(CAST(${creditCalculations.projectedCreditAmount} AS DECIMAL)), 0)`));

  let employerName = "All Employers";
  if (employerId) {
    const [emp] = await db.select().from(employers).where(eq(employers.id, employerId));
    employerName = emp?.name || "Unknown";
  }

  return {
    employerName,
    period: { start: periodStart, end: periodEnd },
    screenings: {
      total: Number(screeningStats.total),
      eligible: Number(screeningStats.eligible),
      certified: Number(screeningStats.certified),
      denied: Number(screeningStats.denied),
      pending: Number(screeningStats.pending),
      eligibilityRate: Number(screeningStats.total) > 0 ? (Number(screeningStats.eligible) / Number(screeningStats.total) * 100) : 0,
    },
    wotcCredits: {
      total: Number(wotcCredits.total),
      count: Number(wotcCredits.count),
      avg: Number(wotcCredits.avg),
    },
    multiCredits: {
      total: Number(multiCredits.total),
      count: Number(multiCredits.count),
    },
    totalCredits: Number(wotcCredits.total) + Number(multiCredits.total),
    byTargetGroup: byTargetGroup.map(g => ({
      targetGroup: g.targetGroup || "Unknown",
      count: Number(g.count),
      totalCredits: Number(g.totalCredits),
    })),
  };
}

async function gatherROIData(employerId: string | null, periodStart: Date, periodEnd: Date) {
  const creditData = await gatherCreditSummaryData(employerId, periodStart, periodEnd);

  const empFilter = employerId ? sql`${employees.employerId} = ${employerId}` : sql`1=1`;
  const [employeeStats] = await db
    .select({ count: count() })
    .from(employees)
    .where(empFilter);

  const avgCreditPerEmployee = Number(employeeStats.count) > 0 
    ? creditData.totalCredits / Number(employeeStats.count) 
    : 0;

  const monthsDiff = Math.max(1, (periodEnd.getTime() - periodStart.getTime()) / (30 * 24 * 60 * 60 * 1000));
  const annualizedCredits = (creditData.totalCredits / monthsDiff) * 12;

  return {
    ...creditData,
    employeeCount: Number(employeeStats.count),
    avgCreditPerEmployee: Math.round(avgCreditPerEmployee),
    annualizedCredits: Math.round(annualizedCredits),
    estimatedROI: Math.round(annualizedCredits * 0.85),
    processingCostEstimate: Math.round(Number(creditData.screenings.total) * 25),
    netBenefit: Math.round(annualizedCredits * 0.85 - Number(creditData.screenings.total) * 25),
  };
}

async function gatherComplianceData(employerId: string | null, periodStart: Date, periodEnd: Date) {
  const empFilter = employerId ? sql`${screenings.employerId} = ${employerId}` : sql`1=1`;

  const [screeningStats] = await db
    .select({
      total: count(),
      withForm: sql<number>`COUNT(*) FILTER (WHERE ${screenings.status} != 'pending')`,
      complete: sql<number>`COUNT(*) FILTER (WHERE ${screenings.status} IN ('eligible', 'certified', 'denied'))`,
    })
    .from(screenings)
    .where(and(empFilter, gte(screenings.createdAt, periodStart), lte(screenings.createdAt, periodEnd)));

  const subFilter = employerId ? sql`${programSubmissions.employerId} = ${employerId}` : sql`1=1`;
  const submissions = await db
    .select({
      status: programSubmissions.submissionStatus,
      count: count(),
    })
    .from(programSubmissions)
    .where(subFilter)
    .groupBy(programSubmissions.submissionStatus);

  let employerName = "All Employers";
  if (employerId) {
    const [emp] = await db.select().from(employers).where(eq(employers.id, employerId));
    employerName = emp?.name || "Unknown";
  }

  return {
    employerName,
    period: { start: periodStart, end: periodEnd },
    screeningCompletionRate: Number(screeningStats.total) > 0 
      ? (Number(screeningStats.complete) / Number(screeningStats.total) * 100) : 0,
    totalScreenings: Number(screeningStats.total),
    completedScreenings: Number(screeningStats.complete),
    submissions: submissions.map(s => ({ status: s.status, count: Number(s.count) })),
    complianceScore: calculateComplianceScore(Number(screeningStats.total), Number(screeningStats.complete), submissions),
  };
}

function calculateComplianceScore(total: number, complete: number, submissions: any[]): number {
  if (total === 0) return 100;
  const completionScore = (complete / total) * 50;
  const submittedCount = submissions.find((s: any) => s.status === "submitted")?.count || 0;
  const confirmedCount = submissions.find((s: any) => s.status === "confirmed")?.count || 0;
  const totalSubs = submissions.reduce((sum: number, s: any) => sum + Number(s.count), 0);
  const submissionScore = totalSubs > 0 ? ((submittedCount + confirmedCount) / totalSubs) * 50 : 25;
  return Math.round(completionScore + submissionScore);
}

function formatCurrency(value: number): string {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatPercent(value: number): string {
  return value.toFixed(1) + "%";
}

function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.rect(0, 0, doc.page.width, 80).fill("#1e40af");
  doc.fillColor("#ffffff").fontSize(24).font("Helvetica-Bold").text("Rockerbox", 50, 20);
  doc.fontSize(10).font("Helvetica").text("WOTC Optimization Platform", 50, 48);
  doc.fillColor("#333333");
  doc.moveDown(2);
  doc.fontSize(20).font("Helvetica-Bold").text(title, 50, 100);
  doc.fontSize(11).font("Helvetica").fillColor("#666666").text(subtitle, 50, 125);
  doc.moveDown(1);
  doc.y = 155;
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string) {
  const y = doc.y;
  doc.rect(50, y, doc.page.width - 100, 28).fill("#f0f4ff");
  doc.fillColor("#1e40af").fontSize(13).font("Helvetica-Bold").text(title, 58, y + 7);
  doc.fillColor("#333333").font("Helvetica");
  doc.y = y + 38;
}

function drawKPIRow(doc: PDFKit.PDFDocument, items: { label: string; value: string; color?: string }[]) {
  const y = doc.y;
  const width = (doc.page.width - 100) / items.length;
  items.forEach((item, i) => {
    const x = 50 + i * width;
    doc.rect(x + 2, y, width - 4, 55).lineWidth(1).strokeColor("#e0e0e0").stroke();
    doc.fillColor(item.color || "#1e40af").fontSize(18).font("Helvetica-Bold").text(item.value, x + 10, y + 8, { width: width - 20 });
    doc.fillColor("#666666").fontSize(9).font("Helvetica").text(item.label, x + 10, y + 32, { width: width - 20 });
  });
  doc.fillColor("#333333");
  doc.y = y + 65;
}

function drawTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], colWidths: number[]) {
  const startX = 50;
  let y = doc.y;
  const rowHeight = 22;

  doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill("#e8edf5");
  let x = startX;
  headers.forEach((h, i) => {
    doc.fillColor("#1e40af").fontSize(9).font("Helvetica-Bold").text(h, x + 5, y + 6, { width: colWidths[i] - 10 });
    x += colWidths[i];
  });
  y += rowHeight;

  rows.forEach((row, rowIdx) => {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }
    if (rowIdx % 2 === 1) {
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill("#f9fafb");
    }
    x = startX;
    row.forEach((cell, i) => {
      doc.fillColor("#333333").fontSize(9).font("Helvetica").text(cell, x + 5, y + 6, { width: colWidths[i] - 10 });
      x += colWidths[i];
    });
    y += rowHeight;
  });

  doc.y = y + 10;
  doc.fillColor("#333333");
}

function drawFooter(doc: PDFKit.PDFDocument) {
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.fillColor("#999999").fontSize(8).font("Helvetica")
      .text(
        `Generated by Rockerbox WOTC Platform | ${new Date().toLocaleDateString()} | Page ${i + 1} of ${pageCount}`,
        50,
        doc.page.height - 30,
        { align: "center", width: doc.page.width - 100 }
      );
  }
}

export async function generateCreditSummaryPDF(options: ReportOptions): Promise<Buffer> {
  const periodStart = options.periodStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const periodEnd = options.periodEnd || new Date();
  const data = await gatherCreditSummaryData(options.employerId || null, periodStart, periodEnd);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "letter", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, "Weekly Credit Summary Report", `${data.employerName} | ${formatDate(periodStart)} - ${formatDate(periodEnd)}`);

    drawSectionHeader(doc, "Screening Overview");
    drawKPIRow(doc, [
      { label: "Total Screenings", value: data.screenings.total.toLocaleString() },
      { label: "Eligible", value: data.screenings.eligible.toLocaleString(), color: "#16a34a" },
      { label: "Certified", value: data.screenings.certified.toLocaleString(), color: "#2563eb" },
      { label: "Eligibility Rate", value: formatPercent(data.screenings.eligibilityRate) },
    ]);

    drawSectionHeader(doc, "Credit Summary");
    drawKPIRow(doc, [
      { label: "WOTC Credits", value: formatCurrency(data.wotcCredits.total), color: "#2563eb" },
      { label: "Multi-Credit Programs", value: formatCurrency(data.multiCredits.total), color: "#9333ea" },
      { label: "Total Credits", value: formatCurrency(data.totalCredits), color: "#16a34a" },
      { label: "Avg WOTC Credit", value: formatCurrency(data.wotcCredits.avg) },
    ]);

    if (data.byTargetGroup.length > 0) {
      drawSectionHeader(doc, "Credits by Target Group");
      drawTable(
        doc,
        ["Target Group", "Screenings", "Total Credits", "Avg Credit"],
        data.byTargetGroup.map(g => [
          g.targetGroup,
          g.count.toString(),
          formatCurrency(g.totalCredits),
          formatCurrency(g.count > 0 ? g.totalCredits / g.count : 0),
        ]),
        [200, 80, 120, 100]
      );
    }

    drawFooter(doc);
    doc.end();
  });
}

export async function generateROIReportPDF(options: ReportOptions): Promise<Buffer> {
  const periodStart = options.periodStart || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const periodEnd = options.periodEnd || new Date();
  const data = await gatherROIData(options.employerId || null, periodStart, periodEnd);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "letter", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, "ROI Analysis Report", `${data.employerName} | ${formatDate(periodStart)} - ${formatDate(periodEnd)}`);

    drawSectionHeader(doc, "Key Financial Metrics");
    drawKPIRow(doc, [
      { label: "Total Credits Captured", value: formatCurrency(data.totalCredits), color: "#16a34a" },
      { label: "Annualized Credits", value: formatCurrency(data.annualizedCredits), color: "#2563eb" },
      { label: "Estimated Net ROI", value: formatCurrency(data.estimatedROI), color: "#9333ea" },
    ]);

    drawSectionHeader(doc, "Employee Impact");
    drawKPIRow(doc, [
      { label: "Total Employees", value: data.employeeCount.toLocaleString() },
      { label: "Avg Credit/Employee", value: formatCurrency(data.avgCreditPerEmployee), color: "#2563eb" },
      { label: "Screenings Processed", value: data.screenings.total.toLocaleString() },
      { label: "Eligibility Rate", value: formatPercent(data.screenings.eligibilityRate) },
    ]);

    drawSectionHeader(doc, "Cost-Benefit Analysis");
    doc.y += 5;
    const items = [
      ["Gross Credit Value", formatCurrency(data.annualizedCredits)],
      ["Processing Cost Estimate", `(${formatCurrency(data.processingCostEstimate)})`],
      ["Net Benefit", formatCurrency(data.netBenefit)],
    ];
    items.forEach(([label, value]) => {
      const y = doc.y;
      doc.fontSize(11).font("Helvetica").text(label, 60, y);
      doc.font("Helvetica-Bold").text(value, 350, y, { width: 150, align: "right" });
      doc.y = y + 20;
    });
    doc.y += 5;
    doc.rect(60, doc.y, 440, 1).fill("#e0e0e0");
    doc.y += 10;
    doc.fontSize(11).font("Helvetica").text("Return on Investment", 60, doc.y);
    const roiPercent = data.processingCostEstimate > 0 ? (data.netBenefit / data.processingCostEstimate * 100) : 0;
    doc.font("Helvetica-Bold").fillColor("#16a34a").text(formatPercent(roiPercent), 350, doc.y - 14, { width: 150, align: "right" });
    doc.fillColor("#333333");
    doc.y += 20;

    if (data.byTargetGroup.length > 0) {
      drawSectionHeader(doc, "Credits by Target Group");
      drawTable(
        doc,
        ["Target Group", "Employees", "Total Credits"],
        data.byTargetGroup.map(g => [g.targetGroup, g.count.toString(), formatCurrency(g.totalCredits)]),
        [220, 100, 180]
      );
    }

    drawFooter(doc);
    doc.end();
  });
}

export async function generateComplianceReportPDF(options: ReportOptions): Promise<Buffer> {
  const periodStart = options.periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const periodEnd = options.periodEnd || new Date();
  const data = await gatherComplianceData(options.employerId || null, periodStart, periodEnd);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "letter", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, "Compliance Status Report", `${data.employerName} | ${formatDate(periodStart)} - ${formatDate(periodEnd)}`);

    drawSectionHeader(doc, "Compliance Score");
    const scoreColor = data.complianceScore >= 80 ? "#16a34a" : data.complianceScore >= 60 ? "#ca8a04" : "#dc2626";
    drawKPIRow(doc, [
      { label: "Overall Compliance Score", value: `${data.complianceScore}/100`, color: scoreColor },
      { label: "Screening Completion", value: formatPercent(data.screeningCompletionRate) },
      { label: "Total Screenings", value: data.totalScreenings.toLocaleString() },
      { label: "Completed", value: data.completedScreenings.toLocaleString(), color: "#16a34a" },
    ]);

    if (data.submissions.length > 0) {
      drawSectionHeader(doc, "Submission Status");
      drawTable(
        doc,
        ["Status", "Count"],
        data.submissions.map(s => [s.status, s.count.toString()]),
        [300, 200]
      );
    }

    doc.y += 20;
    drawSectionHeader(doc, "Recommendations");
    doc.y += 5;
    const recommendations = [];
    if (data.screeningCompletionRate < 80) {
      recommendations.push("Increase screening completion rate - currently below 80% threshold");
    }
    if (data.complianceScore < 70) {
      recommendations.push("Review submission processes - compliance score needs improvement");
    }
    const pending = data.submissions.find(s => s.status === "pending");
    if (pending && pending.count > 5) {
      recommendations.push(`Process ${pending.count} pending submissions to maintain compliance`);
    }
    if (recommendations.length === 0) {
      recommendations.push("All compliance metrics are within acceptable ranges");
    }
    recommendations.forEach((rec, i) => {
      doc.fontSize(10).font("Helvetica").text(`${i + 1}. ${rec}`, 60, doc.y, { width: 440 });
      doc.y += 5;
    });

    drawFooter(doc);
    doc.end();
  });
}

export async function generateReport(options: ReportOptions): Promise<{ reportId: string; buffer: Buffer }> {
  let buffer: Buffer;
  let title: string;

  switch (options.reportType) {
    case "credit_summary":
      title = "Weekly Credit Summary";
      buffer = await generateCreditSummaryPDF(options);
      break;
    case "roi_analysis":
      title = "ROI Analysis";
      buffer = await generateROIReportPDF(options);
      break;
    case "compliance":
      title = "Compliance Status";
      buffer = await generateComplianceReportPDF(options);
      break;
    default:
      throw new Error(`Unknown report type: ${options.reportType}`);
  }

  const [report] = await db.insert(generatedReports).values({
    employerId: options.employerId || null,
    reportType: options.reportType,
    reportTitle: title,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    status: "completed",
    fileSize: buffer.length,
    generatedBy: options.generatedBy,
    reportData: {
      generatedAt: new Date().toISOString(),
      reportType: options.reportType,
      periodStart: options.periodStart?.toISOString(),
      periodEnd: options.periodEnd?.toISOString(),
    },
  }).returning();

  return { reportId: report.id, buffer };
}

export async function listReports(employerId: string | null, limit = 20) {
  const filter = employerId ? eq(generatedReports.employerId, employerId) : sql`1=1`;
  return db.select().from(generatedReports).where(filter).orderBy(desc(generatedReports.createdAt)).limit(limit);
}
