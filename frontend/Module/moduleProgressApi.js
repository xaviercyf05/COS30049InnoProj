import { requestProfileApi } from '../Profile/profileApi.js';

/**
 * Save user progress for a module
 * @param {string} moduleId - The module ID
 * @param {Set|Array} visitedSectionIds - Set or array of visited section IDs
 * @param {number} progressPercent - Calculated progress percentage (0-100)
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Response from backend
 */
export async function saveModuleProgress(moduleId, visitedSectionIds, progressPercent, token) {
  try {
    const sectionIdsArray = Array.isArray(visitedSectionIds) 
      ? visitedSectionIds 
      : Array.from(visitedSectionIds);

    const response = await requestProfileApi(`/api/v1/modules/${moduleId}/progress`, token, {
      method: 'POST',
      body: {
        visitedSectionIds: sectionIdsArray,
        progressPercent: Math.min(100, Math.max(0, Math.round(progressPercent))),
      },
    });

    return response;
  } catch (error) {
    console.error(`Failed to save progress for module ${moduleId}:`, error);
    throw error;
  }
}

/**
 * Fetch current user progress for a module
 * @param {string} moduleId - The module ID
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Progress data including visitedSectionIds and progressPercent
 */
export async function fetchModuleProgress(moduleId, token) {
  try {
    const response = await requestProfileApi(`/api/v1/modules/${moduleId}/progress`, token, {
      method: 'GET',
    });

    return {
      visitedSectionIds: response.data?.visitedSectionIds || [],
      progressPercent: response.data?.progressPercent || 0,
    };
  } catch (error) {
    console.warn(`Failed to fetch progress for module ${moduleId}:`, error);
    // Return empty progress on error - user can restart
    return {
      visitedSectionIds: [],
      progressPercent: 0,
    };
  }
}

/**
 * Calculate progress percentage based on visited sections
 * @param {Set} visitedSectionIds - Set of visited section IDs
 * @param {Array} allSections - Array of all section objects
 * @returns {number} Progress percentage (0-100)
 */
export function calculateProgressPercent(visitedSectionIds, allSections) {
  if (!allSections || allSections.length === 0) {
    return 0;
  }

  let totalItems = 0;
  let visitedItems = 0;

  // Count all sections and subsections
  allSections.forEach((section) => {
    totalItems += 1; // Count main section

    if (section.subsections && section.subsections.length > 0) {
      totalItems += section.subsections.length;
    }
  });

  if (totalItems === 0) {
    return 0;
  }

  // Build set of valid ids from current section structure
  const validIds = new Set();
  allSections.forEach((section) => {
    validIds.add(section.id);
    (section.subsections || []).forEach((sub) => validIds.add(sub.id));
  });

  // Count visited items but only those present in the current module structure
  const visitedIterable = Array.isArray(visitedSectionIds) ? visitedSectionIds : Array.from(visitedSectionIds);
  const seen = new Set();
  visitedIterable.forEach((sectionId) => {
    if (!sectionId) return;
    if (!validIds.has(sectionId)) return;
    if (seen.has(sectionId)) return;
    seen.add(sectionId);
    visitedItems += 1;
  });

  const percent = Math.round((visitedItems / totalItems) * 100);
  return Math.min(100, Math.max(0, percent));
}
