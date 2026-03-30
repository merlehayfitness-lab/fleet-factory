/**
 * Static mapping from Agency Factory department types to relevant AITMPL categories.
 * Used for recommendation badges and default filtering in the catalog browser.
 *
 * See 15-RESEARCH.md for the full AITMPL category breakdown.
 */

/**
 * Maps Agency Factory department types to arrays of relevant AITMPL categories.
 * Used to show "Recommended" badges and pre-filter catalog results.
 */
export const DEPARTMENT_CATEGORY_MAP: Record<string, string[]> = {
  owner: [
    "business-marketing",
    "finance",
    "expert-advisors",
    "analytics",
    "productivity",
  ],
  sales: [
    "business-marketing",
    "marketing",
    "enterprise-communication",
    "web-data",
    "seo",
  ],
  support: [
    "documentation",
    "enterprise-communication",
    "productivity",
    "education",
  ],
  operations: [
    "security",
    "development-team",
    "devops-infrastructure",
    "data-ai",
    "workflow-automation",
    "database",
    "development",
    "web-development",
  ],
};

/**
 * Get the recommended AITMPL categories for a department type.
 * Returns an empty array if the department type is not recognized.
 */
export function getRecommendedCategories(departmentType: string): string[] {
  return DEPARTMENT_CATEGORY_MAP[departmentType.toLowerCase()] ?? [];
}

/**
 * Check whether a given AITMPL category is recommended for a department type.
 */
export function isDepartmentRecommended(
  departmentType: string,
  category: string,
): boolean {
  const categories = DEPARTMENT_CATEGORY_MAP[departmentType.toLowerCase()];
  return categories ? categories.includes(category) : false;
}
