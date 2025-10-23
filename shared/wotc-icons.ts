import type { WOTCTargetGroup } from "./schema";

/**
 * Icon mapping for WOTC Target Groups
 * Using lucide-react icon names that will be dynamically imported
 */
export const WOTCIcons: Record<WOTCTargetGroup, string> = {
  // Group IV: TANF Recipients
  "IV-A": "HeartHandshake",
  "IV-B": "Clock",
  
  // Group V: Veterans
  "V": "Medal",
  "V-Unemployed-4wk": "Briefcase",
  "V-Unemployed-6mo": "BriefcaseBusiness",
  "V-Disability": "ShieldAlert",
  "V-Disability-Unemployed-6mo": "ShieldCheck",
  "V-SNAP": "UtensilsCrossed",
  
  // Group VI: Ex-Felons
  "VI": "Gavel",
  
  // Group VII: Designated Community Residents
  "VII-EZ": "Building2",
  "VII-RRC": "Tractor",
  
  // Group VIII: Vocational Rehabilitation
  "VIII": "Wrench",
  
  // Group IX: SNAP Recipients
  "IX": "ShoppingCart",
  
  // Group X: SSI Recipients
  "X": "Accessibility",
  
  // Group XI: Summer Youth
  "XI": "Sun",
  "XI-EZ": "Sunrise",
  "XI-RRC": "Sunset",
  
  // Group XII: Long-Term Unemployment
  "XII": "CalendarClock",
};

/**
 * Color mapping for WOTC sections (used for accent colors in wizard)
 */
export const WOTCColors: Record<string, string> = {
  "IV": "from-blue-500 to-blue-600",      // TANF - Blue
  "V": "from-green-500 to-green-600",     // Veterans - Green  
  "VI": "from-purple-500 to-purple-600",  // Ex-Felons - Purple
  "VII": "from-orange-500 to-orange-600", // Community - Orange
  "VIII": "from-yellow-500 to-yellow-600",// Voc Rehab - Yellow
  "IX": "from-pink-500 to-pink-600",      // SNAP - Pink
  "X": "from-indigo-500 to-indigo-600",   // SSI - Indigo
  "XI": "from-red-500 to-red-600",        // Summer Youth - Red
  "XII": "from-teal-500 to-teal-600",     // Long-Term Unemployment - Teal
};

/**
 * Get icon name for a target group
 */
export function getIconForTargetGroup(targetGroup: WOTCTargetGroup): string {
  return WOTCIcons[targetGroup];
}

/**
 * Get color gradient for a target group section
 */
export function getColorForSection(targetGroup: WOTCTargetGroup): string {
  // Extract the major group code (e.g., "V" from "V-Disability")
  const majorGroup = targetGroup.split("-")[0];
  return WOTCColors[majorGroup] || "from-gray-500 to-gray-600";
}

/**
 * Friendly section names for display
 */
export const WOTCSectionNames: Record<string, string> = {
  "IV": "Government Assistance",
  "V": "Veteran Status",
  "VI": "Justice System Involvement",
  "VII": "Community Residency",
  "VIII": "Vocational Rehabilitation",
  "IX": "Nutrition Assistance",
  "X": "Disability Benefits",
  "XI": "Summer Youth Employment",
  "XII": "Long-Term Unemployment",
};

/**
 * Get friendly section name
 */
export function getSectionName(targetGroup: WOTCTargetGroup): string {
  const majorGroup = targetGroup.split("-")[0];
  return WOTCSectionNames[majorGroup] || "Other";
}

/**
 * Encouraging messages for gamification
 */
export const encouragingMessages = [
  "You're doing great!",
  "Almost there! Keep going!",
  "Fantastic progress!",
  "Way to go!",
  "You've got this!",
  "Nice work!",
  "Excellent!",
  "Keep up the great work!",
  "You're on a roll!",
  "Outstanding!",
];

/**
 * Get random encouraging message
 */
export function getEncouragingMessage(): string {
  return encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)];
}
