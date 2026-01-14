import { db } from "../db";
import { pricingPlans, employerBilling, billingEvents, employers } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface MilestoneFees {
  [targetGroup: string]: {
    submittal: number;
    certification: number;
    hours120: number;
    hours400: number;
  };
}

export interface PerScreeningTier {
  minScreenings: number;
  maxScreenings: number | null;
  pricePerScreening: number;
}

export interface DeferredConfig {
  monthlyBase: number;
  annualPercentage: number;
  billingDate: string;
}

const DEFAULT_MILESTONE_FEES: MilestoneFees = {
  standard: { submittal: 49, certification: 75, hours120: 99, hours400: 139 },
  snap_recipient: { submittal: 49, certification: 75, hours120: 99, hours400: 139 },
  tanf_short_term: { submittal: 49, certification: 75, hours120: 99, hours400: 139 },
  veteran_unemployed: { submittal: 99, certification: 149, hours120: 199, hours400: 289 },
  veteran_disabled: { submittal: 149, certification: 249, hours120: 349, hours400: 489 },
  long_term_tanf: { submittal: 149, certification: 249, hours120: 349, hours400: 489 },
};

const DEFAULT_SCREENING_TIERS: PerScreeningTier[] = [
  { minScreenings: 1, maxScreenings: 50, pricePerScreening: 30 },
  { minScreenings: 51, maxScreenings: 200, pricePerScreening: 27 },
  { minScreenings: 201, maxScreenings: 500, pricePerScreening: 24 },
  { minScreenings: 501, maxScreenings: 1000, pricePerScreening: 21 },
  { minScreenings: 1001, maxScreenings: null, pricePerScreening: 18 },
];

const DEFAULT_DEFERRED_CONFIG: DeferredConfig = {
  monthlyBase: 199,
  annualPercentage: 9.5,
  billingDate: "03-15",
};

export async function createPricingPlan(data: {
  name: string;
  description?: string;
  pricingModel: string;
  percentageRate?: number;
  milestoneFeesConfig?: MilestoneFees;
  perScreeningConfig?: { tiers: PerScreeningTier[] };
  deferredConfig?: DeferredConfig;
  monthlySubscriptionFee?: number;
  minimumAnnualFee?: number;
  setupFee?: number;
  isDefault?: boolean;
}) {
  if (data.isDefault) {
    await db.update(pricingPlans)
      .set({ isDefault: false })
      .where(eq(pricingPlans.isDefault, true));
  }

  const [plan] = await db.insert(pricingPlans).values({
    name: data.name,
    description: data.description,
    pricingModel: data.pricingModel,
    percentageRate: data.percentageRate?.toString(),
    milestoneFeesConfig: data.milestoneFeesConfig,
    perScreeningConfig: data.perScreeningConfig,
    deferredConfig: data.deferredConfig,
    monthlySubscriptionFee: data.monthlySubscriptionFee?.toString() || "0.00",
    minimumAnnualFee: data.minimumAnnualFee?.toString(),
    setupFee: data.setupFee?.toString() || "0.00",
    isDefault: data.isDefault || false,
  }).returning();

  return plan;
}

export async function getPricingPlans(activeOnly = true) {
  if (activeOnly) {
    return db.select().from(pricingPlans).where(eq(pricingPlans.isActive, true)).orderBy(desc(pricingPlans.createdAt));
  }
  return db.select().from(pricingPlans).orderBy(desc(pricingPlans.createdAt));
}

export async function getPricingPlanById(id: string) {
  const [plan] = await db.select().from(pricingPlans).where(eq(pricingPlans.id, id));
  return plan;
}

export async function updatePricingPlan(id: string, data: Partial<{
  name: string;
  description: string;
  pricingModel: string;
  percentageRate: number;
  milestoneFeesConfig: MilestoneFees;
  perScreeningConfig: { tiers: PerScreeningTier[] };
  deferredConfig: DeferredConfig;
  monthlySubscriptionFee: number;
  minimumAnnualFee: number;
  setupFee: number;
  isActive: boolean;
  isDefault: boolean;
}>) {
  if (data.isDefault) {
    await db.update(pricingPlans)
      .set({ isDefault: false })
      .where(eq(pricingPlans.isDefault, true));
  }

  const updateData: any = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.pricingModel !== undefined) updateData.pricingModel = data.pricingModel;
  if (data.percentageRate !== undefined) updateData.percentageRate = data.percentageRate.toString();
  if (data.milestoneFeesConfig !== undefined) updateData.milestoneFeesConfig = data.milestoneFeesConfig;
  if (data.perScreeningConfig !== undefined) updateData.perScreeningConfig = data.perScreeningConfig;
  if (data.deferredConfig !== undefined) updateData.deferredConfig = data.deferredConfig;
  if (data.monthlySubscriptionFee !== undefined) updateData.monthlySubscriptionFee = data.monthlySubscriptionFee.toString();
  if (data.minimumAnnualFee !== undefined) updateData.minimumAnnualFee = data.minimumAnnualFee.toString();
  if (data.setupFee !== undefined) updateData.setupFee = data.setupFee.toString();
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

  const [plan] = await db.update(pricingPlans)
    .set(updateData)
    .where(eq(pricingPlans.id, id))
    .returning();

  return plan;
}

export async function assignPricingPlanToEmployer(employerId: string, pricingPlanId: string, customOverrides?: {
  customPercentageRate?: number;
  customMonthlyFee?: number;
  customMilestoneConfig?: MilestoneFees;
  contractStartDate?: Date;
  contractEndDate?: Date;
}) {
  const existing = await db.select().from(employerBilling).where(eq(employerBilling.employerId, employerId));
  
  if (existing.length > 0) {
    const [billing] = await db.update(employerBilling)
      .set({
        pricingPlanId,
        customPercentageRate: customOverrides?.customPercentageRate?.toString(),
        customMonthlyFee: customOverrides?.customMonthlyFee?.toString(),
        customMilestoneConfig: customOverrides?.customMilestoneConfig,
        contractStartDate: customOverrides?.contractStartDate,
        contractEndDate: customOverrides?.contractEndDate,
        updatedAt: new Date(),
      })
      .where(eq(employerBilling.employerId, employerId))
      .returning();
    return billing;
  }

  const [billing] = await db.insert(employerBilling).values({
    employerId,
    pricingPlanId,
    customPercentageRate: customOverrides?.customPercentageRate?.toString(),
    customMonthlyFee: customOverrides?.customMonthlyFee?.toString(),
    customMilestoneConfig: customOverrides?.customMilestoneConfig,
    contractStartDate: customOverrides?.contractStartDate,
    contractEndDate: customOverrides?.contractEndDate,
  }).returning();

  return billing;
}

export async function getEmployerBilling(employerId: string) {
  const [billing] = await db.select().from(employerBilling).where(eq(employerBilling.employerId, employerId));
  if (!billing) return null;

  let plan = null;
  if (billing.pricingPlanId) {
    plan = await getPricingPlanById(billing.pricingPlanId);
  }

  return { billing, plan };
}

export async function recordBillingEvent(data: {
  employerId: string;
  employeeId?: string;
  screeningId?: string;
  eventType: string;
  targetGroup?: string;
  amount: number;
  creditAmount?: number;
}) {
  const [event] = await db.insert(billingEvents).values({
    employerId: data.employerId,
    employeeId: data.employeeId,
    screeningId: data.screeningId,
    eventType: data.eventType,
    targetGroup: data.targetGroup,
    amount: data.amount.toString(),
    creditAmount: data.creditAmount?.toString(),
  }).returning();

  return event;
}

export async function calculatePricing(params: {
  pricingModel: string;
  annualHires: number;
  certificationRate: number;
  averageCredit: number;
  monthlySubscriptionFee?: number;
  percentageRate?: number;
  perScreeningRate?: number;
  deferredConfig?: DeferredConfig;
}) {
  const {
    pricingModel,
    annualHires,
    certificationRate,
    averageCredit,
    monthlySubscriptionFee = 0,
    percentageRate = 15,
    perScreeningRate = 27,
    deferredConfig = DEFAULT_DEFERRED_CONFIG,
  } = params;

  const certifiedEmployees = Math.round(annualHires * (certificationRate / 100));
  const totalCredits = certifiedEmployees * averageCredit;

  let annualRevenue = 0;
  let breakdown: any = {};

  switch (pricingModel) {
    case 'percentage':
      annualRevenue = totalCredits * (percentageRate / 100);
      breakdown = {
        totalCredits,
        percentageRate,
        revenueFromPercentage: annualRevenue,
      };
      break;

    case 'milestone_flat_fee':
      const avgMilestoneFee = 362;
      annualRevenue = (monthlySubscriptionFee * 12) + (certifiedEmployees * avgMilestoneFee);
      breakdown = {
        subscriptionRevenue: monthlySubscriptionFee * 12,
        certifiedEmployees,
        avgFeePerCertification: avgMilestoneFee,
        milestoneRevenue: certifiedEmployees * avgMilestoneFee,
      };
      break;

    case 'per_screening':
      annualRevenue = (monthlySubscriptionFee * 12) + (annualHires * perScreeningRate);
      breakdown = {
        subscriptionRevenue: monthlySubscriptionFee * 12,
        screenings: annualHires,
        perScreeningRate,
        screeningRevenue: annualHires * perScreeningRate,
      };
      break;

    case 'deferred_annual':
      const monthlyBase = deferredConfig.monthlyBase;
      const annualPercentage = deferredConfig.annualPercentage;
      annualRevenue = (monthlyBase * 12) + (totalCredits * (annualPercentage / 100));
      breakdown = {
        subscriptionRevenue: monthlyBase * 12,
        totalCredits,
        annualPercentage,
        creditRevenue: totalCredits * (annualPercentage / 100),
        billingDate: deferredConfig.billingDate,
      };
      break;
  }

  return {
    pricingModel,
    annualRevenue,
    monthlyRevenue: annualRevenue / 12,
    breakdown,
    comparison: {
      percentageModelRevenue: totalCredits * 0.15,
      difference: annualRevenue - (totalCredits * 0.15),
      percentageDifference: ((annualRevenue / (totalCredits * 0.15)) - 1) * 100,
    },
  };
}

export async function initializeDefaultPricingPlans() {
  const existingPlans = await getPricingPlans(false);
  if (existingPlans.length > 0) return existingPlans;

  const plans = [
    {
      name: "Standard Percentage (15%)",
      description: "Traditional 15% of captured WOTC credits",
      pricingModel: "percentage",
      percentageRate: 15,
      isDefault: true,
    },
    {
      name: "Milestone Flat Fee",
      description: "Flat fees per milestone: submittal, certification, 120-hour, 400-hour",
      pricingModel: "milestone_flat_fee",
      milestoneFeesConfig: DEFAULT_MILESTONE_FEES,
      monthlySubscriptionFee: 99,
    },
    {
      name: "Per-Screening Volume",
      description: "Pay per hire screened with volume discounts",
      pricingModel: "per_screening",
      perScreeningConfig: { tiers: DEFAULT_SCREENING_TIERS },
      monthlySubscriptionFee: 99,
    },
    {
      name: "Deferred Annual",
      description: "$199/month + 9.5% of credits, billed March 15th with Form 5884 release",
      pricingModel: "deferred_annual",
      deferredConfig: DEFAULT_DEFERRED_CONFIG,
    },
  ];

  const createdPlans = [];
  for (const plan of plans) {
    const created = await createPricingPlan(plan);
    createdPlans.push(created);
  }

  return createdPlans;
}

export const DEFAULT_MILESTONE_FEES_EXPORT = DEFAULT_MILESTONE_FEES;
export const DEFAULT_SCREENING_TIERS_EXPORT = DEFAULT_SCREENING_TIERS;
export const DEFAULT_DEFERRED_CONFIG_EXPORT = DEFAULT_DEFERRED_CONFIG;
