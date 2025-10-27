import { db } from "../db";
import { 
  retentionMilestones, 
  retentionAlerts, 
  turnoverPredictions,
  employees,
  hoursWorked,
  screenings,
  employers
} from "../../shared/schema";
import { eq, and, sql, gte, desc, asc } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface MilestoneCalculation {
  employeeId: string;
  employerId: string;
  currentHours: number;
  targetMilestone: number;
  progressPercent: number;
  averageHoursPerWeek: number;
  estimatedDaysToMilestone: number;
  projectedCompletionDate: Date;
  currentCreditValue: number;
  potentialCreditValue: number;
}

interface TurnoverRiskFactors {
  factor: string;
  weight: number;
  description: string;
}

interface TurnoverRecommendation {
  action: string;
  priority: "low" | "medium" | "high" | "critical";
  rationale: string;
}

/**
 * Calculate current hours worked and milestone progress for an employee
 */
export async function calculateMilestoneProgress(employeeId: string): Promise<MilestoneCalculation | null> {
  // Get employee details
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee) {
    return null;
  }

  // Get total hours worked
  const [hoursResult] = await db
    .select({
      totalHours: sql<number>`COALESCE(SUM(CAST(${hoursWorked.hours} AS NUMERIC)), 0)`,
      recordCount: sql<number>`COUNT(*)`,
    })
    .from(hoursWorked)
    .where(eq(hoursWorked.employeeId, employeeId));

  const currentHours = Number(hoursResult.totalHours) || 0;

  // Get screening to determine target milestone
  const [screening] = await db
    .select()
    .from(screenings)
    .where(eq(screenings.employeeId, employeeId))
    .orderBy(desc(screenings.createdAt))
    .limit(1);

  // Determine target milestone based on screening status
  // 120 hours = minimum for first-year credit
  // 400 hours = maximum credit threshold
  let targetMilestone = 120;
  if (screening?.status === "certified" && currentHours >= 120) {
    targetMilestone = 400; // Aim for maximum credit
  }

  // Calculate progress
  const progressPercent = Math.min((currentHours / targetMilestone) * 100, 100);

  // Calculate average hours per week (last 8 weeks)
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const [recentHours] = await db
    .select({
      totalHours: sql<number>`COALESCE(SUM(CAST(${hoursWorked.hours} AS NUMERIC)), 0)`,
      weekCount: sql<number>`COUNT(DISTINCT DATE_TRUNC('week', TO_DATE(${hoursWorked.periodStart}, 'YYYY-MM-DD')))`,
    })
    .from(hoursWorked)
    .where(
      and(
        eq(hoursWorked.employeeId, employeeId),
        sql`TO_DATE(${hoursWorked.periodStart}, 'YYYY-MM-DD') >= ${eightWeeksAgo}`
      )
    );

  const averageHoursPerWeek = 
    Number(recentHours.weekCount) > 0
      ? Number(recentHours.totalHours) / Number(recentHours.weekCount)
      : 20; // Default assumption

  // Calculate days to milestone
  const remainingHours = Math.max(targetMilestone - currentHours, 0);
  const weeksToMilestone = averageHoursPerWeek > 0 ? remainingHours / averageHoursPerWeek : 0;
  const estimatedDaysToMilestone = Math.ceil(weeksToMilestone * 7);

  // Calculate projected completion date
  const projectedCompletionDate = new Date();
  projectedCompletionDate.setDate(projectedCompletionDate.getDate() + estimatedDaysToMilestone);

  // Calculate credit values (simplified - would use actual credit calculation logic)
  const currentCreditValue = calculateWOTCCredit(currentHours, screening?.primaryTargetGroup || "");
  const potentialCreditValue = calculateWOTCCredit(targetMilestone, screening?.primaryTargetGroup || "");

  return {
    employeeId,
    employerId: employee.employerId,
    currentHours,
    targetMilestone,
    progressPercent,
    averageHoursPerWeek,
    estimatedDaysToMilestone,
    projectedCompletionDate,
    currentCreditValue,
    potentialCreditValue,
  };
}

/**
 * Simplified WOTC credit calculation
 */
function calculateWOTCCredit(hours: number, targetGroup: string): number {
  // Simplified logic - real implementation would match actual WOTC rules
  if (hours < 120) return 0;
  
  // Common target groups
  const firstYearWageBase = 6000; // Typical first-year wage base
  const creditRate = targetGroup.includes("veteran") ? 0.40 : 0.25; // Veterans get 40%, others 25%
  
  if (hours >= 400) {
    return firstYearWageBase * creditRate; // Full credit
  } else {
    // Proportional credit between 120-400 hours
    return (firstYearWageBase * creditRate) * 0.5; // Partial credit
  }
}

/**
 * Update or create milestone tracking for an employee
 */
export async function updateMilestoneTracking(employeeId: string): Promise<void> {
  const calculation = await calculateMilestoneProgress(employeeId);
  if (!calculation) {
    return;
  }

  // Check if milestone record exists
  const [existing] = await db
    .select()
    .from(retentionMilestones)
    .where(eq(retentionMilestones.employeeId, employeeId))
    .limit(1);

  const milestoneData = {
    employeeId: calculation.employeeId,
    employerId: calculation.employerId,
    currentHours: calculation.currentHours.toString(),
    targetMilestone: calculation.targetMilestone,
    progressPercent: calculation.progressPercent.toFixed(2),
    averageHoursPerWeek: calculation.averageHoursPerWeek.toFixed(2),
    estimatedDaysToMilestone: calculation.estimatedDaysToMilestone,
    projectedCompletionDate: calculation.projectedCompletionDate,
    currentCreditValue: calculation.currentCreditValue.toFixed(2),
    potentialCreditValue: calculation.potentialCreditValue.toFixed(2),
    lastCalculated: new Date(),
    updatedAt: new Date(),
  };

  if (existing) {
    // Update existing
    await db
      .update(retentionMilestones)
      .set(milestoneData)
      .where(eq(retentionMilestones.id, existing.id));

    // Check for alert thresholds
    await checkAndGenerateAlerts(existing.id, calculation);
  } else {
    // Insert new
    await db.insert(retentionMilestones).values(milestoneData);

    // Check for alert thresholds
    const [newRecord] = await db
      .select()
      .from(retentionMilestones)
      .where(eq(retentionMilestones.employeeId, employeeId))
      .limit(1);

    if (newRecord) {
      await checkAndGenerateAlerts(newRecord.id, calculation);
    }
  }
}

/**
 * Check if alerts should be generated based on milestone progress
 */
async function checkAndGenerateAlerts(
  milestoneId: string,
  calculation: MilestoneCalculation
): Promise<void> {
  const { employeeId, employerId, progressPercent, estimatedDaysToMilestone, potentialCreditValue } = calculation;

  // Get employee details for alert messages
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee) return;

  const employeeName = `${employee.firstName} ${employee.lastName}`;

  // Get milestone record to check if alerts already triggered
  const [milestone] = await db
    .select()
    .from(retentionMilestones)
    .where(eq(retentionMilestones.employeeId, employeeId))
    .limit(1);

  if (!milestone) return;

  // 80% milestone alert
  if (progressPercent >= 80 && progressPercent < 90 && !milestone.alert80Triggered) {
    await db.insert(retentionAlerts).values({
      employeeId,
      employerId,
      alertType: "milestone_80",
      severity: "medium",
      title: `${employeeName} is 80% to milestone`,
      message: `${employeeName} has reached 80% of their ${calculation.targetMilestone}-hour milestone. Expected completion in ${estimatedDaysToMilestone} days.`,
      currentHours: calculation.currentHours.toString(),
      targetMilestone: calculation.targetMilestone,
      daysRemaining: estimatedDaysToMilestone,
      potentialValueAtRisk: potentialCreditValue.toFixed(2),
      recommendedActions: [
        { action: "Monitor hours closely", priority: "medium" },
        { action: "Ensure consistent scheduling", priority: "medium" },
      ],
    });

    // Mark alert as triggered
    await db
      .update(retentionMilestones)
      .set({ alert80Triggered: true })
      .where(eq(retentionMilestones.id, milestone.id));
  }

  // 90% milestone alert
  if (progressPercent >= 90 && !milestone.alert90Triggered) {
    await db.insert(retentionAlerts).values({
      employeeId,
      employerId,
      alertType: "milestone_90",
      severity: "high",
      title: `${employeeName} is 90% to milestone`,
      message: `${employeeName} has reached 90% of their ${calculation.targetMilestone}-hour milestone. Expected completion in ${estimatedDaysToMilestone} days. Take action to ensure they reach the milestone.`,
      currentHours: calculation.currentHours.toString(),
      targetMilestone: calculation.targetMilestone,
      daysRemaining: estimatedDaysToMilestone,
      potentialValueAtRisk: potentialCreditValue.toFixed(2),
      recommendedActions: [
        { action: "Schedule retention conversation", priority: "high" },
        { action: "Review hours schedule for next 2 weeks", priority: "high" },
        { action: "Identify any scheduling conflicts", priority: "medium" },
      ],
    });

    // Mark alert as triggered
    await db
      .update(retentionMilestones)
      .set({ alert90Triggered: true })
      .where(eq(retentionMilestones.id, milestone.id));
  }
}

/**
 * Predict turnover risk using AI analysis
 */
export async function predictTurnoverRisk(employeeId: string): Promise<void> {
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee) {
    throw new Error("Employee not found");
  }

  // Get hours history
  const hoursHistory = await db
    .select()
    .from(hoursWorked)
    .where(eq(hoursWorked.employeeId, employeeId))
    .orderBy(asc(hoursWorked.periodStart))
    .limit(50);

  // Calculate tenure
  const tenureDays = employee.hireDate
    ? Math.floor(
        (Date.now() - new Date(employee.hireDate).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  // Calculate hours volatility (standard deviation)
  const hourValues = hoursHistory.map(h => Number(h.hours));
  const avgHours = hourValues.reduce((a, b) => a + b, 0) / hourValues.length;
  const variance = hourValues.reduce((sum, val) => sum + Math.pow(val - avgHours, 2), 0) / hourValues.length;
  const hoursVolatility = Math.sqrt(variance);

  // Determine hours trend
  const recentHours = hourValues.slice(-4); // Last 4 entries
  const olderHours = hourValues.slice(-8, -4); // Previous 4 entries
  const recentAvg = recentHours.reduce((a, b) => a + b, 0) / recentHours.length;
  const olderAvg = olderHours.reduce((a, b) => a + b, 0) / olderHours.length;
  
  let recentHoursTrend: string;
  if (recentAvg > olderAvg * 1.1) {
    recentHoursTrend = "increasing";
  } else if (recentAvg < olderAvg * 0.9) {
    recentHoursTrend = "decreasing";
  } else {
    recentHoursTrend = "stable";
  }

  // Get milestone progress
  const [milestone] = await db
    .select()
    .from(retentionMilestones)
    .where(eq(retentionMilestones.employeeId, employeeId))
    .limit(1);

  const currentMilestoneProgress = milestone ? Number(milestone.progressPercent) : 0;

  // Use OpenAI to analyze turnover risk
  const prompt = `You are an expert HR analyst specializing in employee retention and turnover prediction.

Analyze the following employee data and predict their turnover risk:

Employee Details:
- Tenure: ${tenureDays} days
- Average Hours/Week: ${avgHours.toFixed(1)}
- Hours Volatility (Std Dev): ${hoursVolatility.toFixed(1)}
- Recent Hours Trend: ${recentHoursTrend}
- Milestone Progress: ${currentMilestoneProgress.toFixed(1)}% toward ${milestone?.targetMilestone || 120} hours

Recent Hours History: ${hourValues.slice(-8).join(", ")}

Provide your analysis in JSON format:
{
  "riskScore": <0-100 integer>,
  "riskLevel": "<low|medium|high|critical>",
  "confidence": <0-100 integer>,
  "factors": [
    {
      "factor": "factor_name",
      "weight": <0.0-1.0>,
      "description": "explanation"
    }
  ],
  "recommendedActions": [
    {
      "action": "specific action to take",
      "priority": "<low|medium|high|critical>",
      "rationale": "why this action is recommended"
    }
  ]
}

Consider factors like:
- Short tenure (higher risk in first 90 days)
- Decreasing hours trend (disengagement signal)
- High hours volatility (scheduling instability)
- Low milestone progress (may not reach WOTC threshold)`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are an HR analytics expert. Always respond with valid JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const analysis = JSON.parse(completion.choices[0].message.content || "{}");

    // Save prediction to database
    await db.insert(turnoverPredictions).values({
      employeeId,
      employerId: employee.employerId,
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      confidence: analysis.confidence,
      factors: analysis.factors,
      recommendedActions: analysis.recommendedActions,
      tenure: tenureDays,
      hoursVolatility: hoursVolatility.toFixed(2),
      recentHoursTrend,
      currentMilestoneProgress: currentMilestoneProgress.toFixed(2),
      model: completion.model,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
    });

    // Generate high-risk alert if needed
    if (analysis.riskLevel === "high" || analysis.riskLevel === "critical") {
      await db.insert(retentionAlerts).values({
        employeeId,
        employerId: employee.employerId,
        alertType: "high_turnover_risk",
        severity: analysis.riskLevel === "critical" ? "critical" : "high",
        title: `High turnover risk: ${employee.firstName} ${employee.lastName}`,
        message: `AI analysis indicates ${analysis.riskLevel} turnover risk (${analysis.riskScore}% confidence: ${analysis.confidence}%). Immediate action recommended.`,
        currentHours: milestone?.currentHours,
        targetMilestone: milestone?.targetMilestone,
        potentialValueAtRisk: milestone?.potentialCreditValue,
        recommendedActions: analysis.recommendedActions,
      });
    }
  } catch (error) {
    console.error("Error predicting turnover risk:", error);
    throw error;
  }
}

/**
 * Get employees at risk (near milestones or high turnover risk)
 */
export async function getEmployeesAtRisk(employerId: string) {
  // Get employees with milestone progress 80%+ or recent high turnover predictions
  const milestonesAtRisk = await db
    .select({
      employee: employees,
      milestone: retentionMilestones,
      latestPrediction: turnoverPredictions,
    })
    .from(retentionMilestones)
    .innerJoin(employees, eq(employees.id, retentionMilestones.employeeId))
    .leftJoin(
      turnoverPredictions,
      and(
        eq(turnoverPredictions.employeeId, retentionMilestones.employeeId),
        // Get most recent prediction (subquery would be better but this works)
        sql`${turnoverPredictions.predictedAt} = (
          SELECT MAX(predicted_at) 
          FROM ${turnoverPredictions} tp2 
          WHERE tp2.employee_id = ${retentionMilestones.employeeId}
        )`
      )
    )
    .where(
      and(
        eq(retentionMilestones.employerId, employerId),
        sql`(
          CAST(${retentionMilestones.progressPercent} AS NUMERIC) >= 80 
          OR ${turnoverPredictions.riskLevel} IN ('high', 'critical')
        )`
      )
    )
    .orderBy(desc(retentionMilestones.progressPercent));

  return milestonesAtRisk;
}

/**
 * Batch update milestones for all active employees in an employer
 */
export async function batchUpdateMilestones(employerId: string): Promise<number> {
  const activeEmployees = await db
    .select()
    .from(employees)
    .where(eq(employees.employerId, employerId));

  let updated = 0;
  for (const employee of activeEmployees) {
    try {
      await updateMilestoneTracking(employee.id);
      updated++;
    } catch (error) {
      console.error(`Error updating milestone for employee ${employee.id}:`, error);
    }
  }

  return updated;
}
