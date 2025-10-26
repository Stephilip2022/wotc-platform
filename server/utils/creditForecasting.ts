import { db } from "../db";
import { employees, screenings, creditCalculations, employers } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";

interface ForecastInput {
  employerId: string;
  timeframeMonths?: number;
  currentPipelineCount?: number;
}

interface CreditForecast {
  employerId: string;
  forecastPeriod: string;
  projectedHires: number;
  estimatedConversionRate: number;
  projectedCertifications: number;
  estimatedTotalCredits: number;
  estimatedAverageCredit: number;
  confidenceLevel: "low" | "medium" | "high";
  historicalDataPoints: number;
  breakdown: {
    targetGroup: string;
    projectedCount: number;
    averageCredit: number;
    totalCredits: number;
  }[];
}

/**
 * Calculate credit forecast based on historical data and current pipeline
 */
export async function generateCreditForecast(
  input: ForecastInput
): Promise<CreditForecast> {
  const { employerId, timeframeMonths = 12, currentPipelineCount = 0 } = input;

  // Get historical screening data (last 12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Fetch historical screenings
  const historicalScreenings = await db
    .select({
      id: screenings.id,
      status: screenings.status,
      primaryTargetGroup: screenings.primaryTargetGroup,
      createdAt: screenings.createdAt,
    })
    .from(screenings)
    .where(
      and(
        eq(screenings.employerId, employerId),
        gte(screenings.createdAt, twelveMonthsAgo)
      )
    );

  // Fetch credit calculations for those screenings
  const certifications = await db
    .select({
      id: creditCalculations.id,
      screeningId: creditCalculations.screeningId,
      actualCreditAmount: creditCalculations.actualCreditAmount,
      targetGroup: creditCalculations.targetGroup,
    })
    .from(creditCalculations)
    .where(eq(creditCalculations.employerId, employerId));

  // Calculate conversion rate (screenings → certifications)
  const totalScreenings = historicalScreenings.length;
  const totalCertifications = certifications.length;
  const conversionRate =
    totalScreenings > 0 ? totalCertifications / totalScreenings : 0.25; // Default 25% if no data

  // Calculate average credit amount per target group
  const targetGroupStats = new Map<
    string,
    { count: number; totalCredits: number }
  >();

  certifications.forEach((cert: { targetGroup: string | null; actualCreditAmount: string | null }) => {
    const group = cert.targetGroup || "unknown";
    const existing = targetGroupStats.get(group) || {
      count: 0,
      totalCredits: 0,
    };
    targetGroupStats.set(group, {
      count: existing.count + 1,
      totalCredits: existing.totalCredits + parseFloat(cert.actualCreditAmount || "0"),
    });
  });

  // Calculate hiring velocity (hires per month)
  const monthsOfData = 12;
  const hiresPerMonth = totalScreenings / monthsOfData;
  const projectedHires = Math.round(
    currentPipelineCount > 0
      ? currentPipelineCount
      : hiresPerMonth * timeframeMonths
  );

  // Project certifications
  const projectedCertifications = Math.round(projectedHires * conversionRate);

  // Calculate breakdown by target group
  const breakdown = Array.from(targetGroupStats.entries()).map(
    ([targetGroup, stats]) => {
      const groupConversionRate = stats.count / totalCertifications || 0;
      const projectedCount = Math.round(
        projectedCertifications * groupConversionRate
      );
      const averageCredit =
        stats.count > 0 ? stats.totalCredits / stats.count : 2400;

      return {
        targetGroup,
        projectedCount,
        averageCredit: Math.round(averageCredit),
        totalCredits: Math.round(projectedCount * averageCredit),
      };
    }
  );

  // Calculate overall totals
  const estimatedTotalCredits = breakdown.reduce(
    (sum, item) => sum + item.totalCredits,
    0
  );
  const estimatedAverageCredit =
    projectedCertifications > 0
      ? estimatedTotalCredits / projectedCertifications
      : 2400;

  // Determine confidence level based on data availability
  let confidenceLevel: "low" | "medium" | "high" = "low";
  if (totalScreenings >= 100) {
    confidenceLevel = "high";
  } else if (totalScreenings >= 30) {
    confidenceLevel = "medium";
  }

  return {
    employerId,
    forecastPeriod: `${timeframeMonths} months`,
    projectedHires,
    estimatedConversionRate: Math.round(conversionRate * 100),
    projectedCertifications,
    estimatedTotalCredits,
    estimatedAverageCredit: Math.round(estimatedAverageCredit),
    confidenceLevel,
    historicalDataPoints: totalScreenings,
    breakdown: breakdown.sort((a, b) => b.totalCredits - a.totalCredits),
  };
}

/**
 * Calculate system-wide credit forecasts for admin analytics
 */
export async function generateSystemWideForecast(): Promise<{
  totalProjectedCredits: number;
  totalActiveEmployers: number;
  averageCreditsPerEmployer: number;
  topPerformers: Array<{
    employerId: string;
    employerName: string;
    projectedCredits: number;
  }>;
}> {
  // Get all active employers
  const activeEmployers = await db
    .select({
      id: employers.id,
      name: employers.name,
    })
    .from(employers);

  let totalProjectedCredits = 0;
  const employerForecasts: Array<{
    employerId: string;
    employerName: string;
    projectedCredits: number;
  }> = [];

  // Generate forecast for each employer
  for (const employer of activeEmployers) {
    try {
      const forecast = await generateCreditForecast({
        employerId: employer.id,
        timeframeMonths: 12,
      });

      totalProjectedCredits += forecast.estimatedTotalCredits;
      employerForecasts.push({
        employerId: employer.id,
        employerName: employer.name,
        projectedCredits: forecast.estimatedTotalCredits,
      });
    } catch (error) {
      console.error(`Forecast error for employer ${employer.id}:`, error);
    }
  }

  // Sort and get top 10 performers
  const topPerformers = employerForecasts
    .sort((a, b) => b.projectedCredits - a.projectedCredits)
    .slice(0, 10);

  return {
    totalProjectedCredits,
    totalActiveEmployers: activeEmployers.length,
    averageCreditsPerEmployer:
      activeEmployers.length > 0
        ? Math.round(totalProjectedCredits / activeEmployers.length)
        : 0,
    topPerformers,
  };
}

/**
 * Calculate monthly credit projection trend
 */
export async function getMonthlyProjectionTrend(
  employerId: string,
  months: number = 12
): Promise<
  Array<{
    month: string;
    projectedHires: number;
    projectedCertifications: number;
    projectedCredits: number;
  }>
> {
  // Get historical monthly data
  const monthlyData: Array<{
    month: string;
    projectedHires: number;
    projectedCertifications: number;
    projectedCredits: number;
  }> = [];

  // Calculate baseline from historical data
  const baseForecast = await generateCreditForecast({
    employerId,
    timeframeMonths: 1,
  });

  const monthlyHires = Math.round(baseForecast.projectedHires);
  const monthlyCertifications = Math.round(
    baseForecast.projectedCertifications
  );
  const monthlyCredits = Math.round(baseForecast.estimatedTotalCredits);

  // Project forward
  const currentDate = new Date();
  for (let i = 0; i < months; i++) {
    const futureDate = new Date(currentDate);
    futureDate.setMonth(futureDate.getMonth() + i);

    // Add seasonal variation (10% variance)
    const seasonalFactor = 1 + (Math.random() * 0.2 - 0.1);

    monthlyData.push({
      month: futureDate.toISOString().slice(0, 7), // YYYY-MM format
      projectedHires: Math.round(monthlyHires * seasonalFactor),
      projectedCertifications: Math.round(
        monthlyCertifications * seasonalFactor
      ),
      projectedCredits: Math.round(monthlyCredits * seasonalFactor),
    });
  }

  return monthlyData;
}
