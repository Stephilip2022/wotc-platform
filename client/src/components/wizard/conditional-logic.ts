import type { DisplayCondition, SimpleCondition, CompositeCondition } from "@shared/schema";

/**
 * Evaluate if a simple condition is met based on current responses
 */
function evaluateSimpleCondition(
  condition: SimpleCondition,
  responses: Record<string, any>
): boolean {
  const value = responses[condition.sourceQuestionId];
  
  switch (condition.operator) {
    case "equals":
      return value === condition.value;
    
    case "notEquals":
      return value !== condition.value;
    
    case "includes":
      if (Array.isArray(value)) {
        return value.includes(condition.value);
      }
      if (typeof value === "string") {
        return value.includes(condition.value);
      }
      return false;
    
    case "greaterThan":
      return Number(value) > Number(condition.value);
    
    case "lessThan":
      return Number(value) < Number(condition.value);
    
    case "exists":
      return value !== undefined && value !== null && value !== "";
    
    default:
      return false;
  }
}

/**
 * Evaluate if a composite condition (AND/OR) is met
 */
function evaluateCompositeCondition(
  condition: CompositeCondition,
  responses: Record<string, any>
): boolean {
  if (condition.logic === "AND") {
    return condition.conditions.every(c => evaluateDisplayCondition(c, responses));
  } else if (condition.logic === "OR") {
    return condition.conditions.some(c => evaluateDisplayCondition(c, responses));
  }
  return false;
}

/**
 * Evaluate any type of display condition (simple or composite)
 */
export function evaluateDisplayCondition(
  condition: DisplayCondition,
  responses: Record<string, any>
): boolean {
  // Check if it's a composite condition
  if ("logic" in condition) {
    return evaluateCompositeCondition(condition as CompositeCondition, responses);
  }
  
  // Otherwise it's a simple condition
  return evaluateSimpleCondition(condition as SimpleCondition, responses);
}

/**
 * Check if a question should be displayed based on its display condition
 */
export function shouldDisplayQuestion(
  questionId: string,
  displayCondition: DisplayCondition | undefined,
  responses: Record<string, any>
): boolean {
  // If no condition, always display
  if (!displayCondition) {
    return true;
  }
  
  // Evaluate the condition
  return evaluateDisplayCondition(displayCondition, responses);
}

/**
 * Validate that all required questions in a list have been answered
 */
export function validateRequiredQuestions(
  questions: any[],
  responses: Record<string, any>
): { valid: boolean; missingQuestions: string[] } {
  const missingQuestions: string[] = [];
  
  for (const question of questions) {
    // Check if question should be displayed
    if (!shouldDisplayQuestion(question.id, question.displayCondition, responses)) {
      continue; // Skip questions that aren't displayed
    }
    
    // Check if required and answered
    if (question.required && !responses[question.id]) {
      missingQuestions.push(question.id);
    }
    
    // Recursively check follow-up questions
    if (question.followUpQuestions && question.followUpQuestions.length > 0) {
      const followUpValidation = validateRequiredQuestions(
        question.followUpQuestions,
        responses
      );
      missingQuestions.push(...followUpValidation.missingQuestions);
    }
  }
  
  return {
    valid: missingQuestions.length === 0,
    missingQuestions,
  };
}
