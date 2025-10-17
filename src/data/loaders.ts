// src/data/loaders.ts
// This module loads data from the kb JSON files and transforms them into the format
// expected by the UI components. It handles mapping skill IDs to human-readable names
// and formatting dates for display.

import blogsData from "./iris/kb/blogs.json";
import projectsData from "./iris/kb/projects.json";
import experienceData from "./iris/kb/experience.json";
import skillsData from "./iris/kb/skills.json";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Blog interface - represents a blog post with metadata and links
 */
export interface Blog {
  id: string;
  title: string;
  imageUrl: string;
  date: string;
  link: string;
}

/**
 * Project interface - represents a project with description, links, and skills
 */
export interface Project {
  id: string;
  imageUrl?: string;
  title: string;
  description: string;
  githubLink: string;
  projectLink?: string;
  skills?: string[];
}

/**
 * WorkExperience interface - represents a work experience entry
 */
export interface WorkExperience {
  id: string;
  title: string;
  company: string;
  period: string;
  description: string;
  companyUrl: string;
  skills: string[];
}

// ============================================================================
// SKILL MAPPING UTILITIES
// ============================================================================

/**
 * Creates a mapping from skill ID to skill name for quick lookups
 * This enables us to convert skill IDs (like "python") to display names (like "Python")
 */
const skillIdToNameMap = new Map<string, string>(
  skillsData.map((skill) => [skill.id, skill.name])
);

/**
 * Converts an array of skill IDs to their corresponding display names
 * @param skillIds - Array of skill IDs from the kb JSON
 * @param limit - Maximum number of skills to return (default: 5)
 * @returns Array of skill names, limited to the specified count
 */
function mapSkillIdsToNames(skillIds: string[], limit: number = 5): string[] {
  return skillIds
    .slice(0, limit) // Take only the top N skills
    .map((id) => skillIdToNameMap.get(id) || id) // Map ID to name, fallback to ID if not found
    .filter(Boolean); // Remove any undefined values
}

// ============================================================================
// DATE FORMATTING UTILITIES
// ============================================================================

/**
 * Formats a date object with start and optional end dates into a display string
 * Examples:
 * - { start: "2024-05", end: "2024-08" } → "MAY - AUG 2024"
 * - { start: "2024-02" } → "FEB 2024 - PRESENT"
 * @param dates - Object containing start and optionally end date strings
 * @returns Formatted date range string in uppercase
 */
function formatDateRange(dates: { start: string; end?: string }): string {
  const startDate = new Date(dates.start + "-01"); // Add day for valid date parsing
  const startMonth = startDate.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const startYear = startDate.getFullYear();

  if (dates.end) {
    const endDate = new Date(dates.end + "-01");
    const endMonth = endDate.toLocaleString("en-US", { month: "short" }).toUpperCase();
    const endYear = endDate.getFullYear();
    
    // If same year, show "MAY - AUG 2024", otherwise "MAY 2024 - AUG 2025"
    if (startYear === endYear) {
      return `${startMonth} - ${endMonth} ${startYear}`;
    }
    return `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
  }
  
  // No end date means it's current/ongoing
  return `${startMonth} ${startYear} - PRESENT`;
}

// ============================================================================
// DATA LOADERS
// ============================================================================

/**
 * Loads and transforms blog data from blogs.json
 * Maps the kb JSON structure to the Blog interface expected by components
 */
export const blogs: Blog[] = blogsData.blog_posts.map((post, index) => ({
  id: String(index + 1), // Generate sequential IDs since blogs.json doesn't have them
  title: post.title,
  imageUrl: "/blog1.png", // Default image - could be enhanced to use post-specific images
  date: new Date(post.published_date).getFullYear().toString(), // Extract just the year
  link: post.url,
}));

/**
 * Loads and transforms project data from projects.json
 * Uses the summary field for descriptions and maps the top 5 skills
 */
export const projects: Project[] = projectsData.map((proj) => ({
  id: proj.id,
  imageUrl: proj.links.image,
  title: proj.title,
  description: proj.summary, // Using summary as requested, not specifics
  githubLink: proj.links.github,
  // Prefer app_store link, fall back to demo if available
  projectLink: proj.links.app_store || proj.links.demo,
  // Map skill IDs to display names, limited to top 5
  skills: mapSkillIdsToNames(proj.skills, 5),
}));

/**
 * Loads and transforms work experience data from experience.json
 * Formats date ranges and maps the top 5 skills for each role
 */
export const workExperiences: WorkExperience[] = experienceData.map((exp) => ({
  id: exp.id,
  title: exp.role, // 'role' in JSON maps to 'title' in the UI
  company: exp.company,
  period: formatDateRange(exp.dates), // Convert date object to readable format
  description: exp.summary, // Using summary as requested, not specifics
  companyUrl: exp.links.company,
  // Map skill IDs to display names, limited to top 5
  skills: mapSkillIdsToNames(exp.skills, 5),
}));

