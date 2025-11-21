/**
 * Ranking algorithms for KB items
 * Computes importance scores based on multiple factors
 */

import type { KBItem, SkillT, ProjectT, ExperienceT, ClassT } from './schema';
import { getSkillComplexity, getAverageComplexity } from './skillComplexity';

export interface ItemRanking {
  id: string;
  kind: string;
  importance: number;  // 0-100 normalized score
}

export interface Rankings {
  skills: ItemRanking[];
  projects: ItemRanking[];
  experiences: ItemRanking[];
  classes: ItemRanking[];
  blogs: ItemRanking[];
  all: ItemRanking[];
}

/**
 * Compute recency score based on dates (0-10 scale)
 * More recent = higher score
 */
function computeRecency(dates?: { start?: string; end?: string }): number {
  if (!dates?.start) return 5; // Default if no dates

  const now = new Date();
  const startDate = new Date(dates.start);
  const endDate = dates.end ? new Date(dates.end) : now;

  // Use the most recent date (end or start if no end)
  const relevantDate = dates.end ? endDate : startDate;

  // Calculate months ago
  const monthsAgo = (now.getTime() - relevantDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

  // Scoring: 10 = this month, 5 = 2 years ago, 0 = 5+ years ago
  if (monthsAgo < 6) return 10;
  if (monthsAgo < 12) return 9;
  if (monthsAgo < 18) return 8;
  if (monthsAgo < 24) return 7;
  if (monthsAgo < 36) return 5;
  if (monthsAgo < 48) return 3;
  return 1;
}

/**
 * Compute skill importance (0-100 scale)
 * Based on: evidence count, complexity, recency
 */
export function computeSkillImportance(skill: SkillT, allItems: KBItem[]): number {
  const evidenceCount = skill.evidence.length;
  const projectCount = skill.evidence.filter(e => e.type === 'project').length;
  const experienceCount = skill.evidence.filter(e => e.type === 'experience').length;
  const complexity = getSkillComplexity(skill.id);

  // Find most recent usage
  let mostRecentDate: { start: string; end?: string } | undefined;
  for (const evidence of skill.evidence) {
    const item = allItems.find(i => i.id === evidence.id);
    if (item && 'dates' in item && item.dates) {
      if (!mostRecentDate || (item.dates.end || item.dates.start) > (mostRecentDate.end || mostRecentDate.start)) {
        mostRecentDate = item.dates;
      }
    }
  }

  const recency = computeRecency(mostRecentDate);

  // Weighted scoring
  const evidenceScore = Math.min(evidenceCount * 5, 30);  // Cap at 30 (6+ uses)
  const projectScore = projectCount * 3;                  // Projects more valuable
  const experienceScore = experienceCount * 4;            // Work experience most valuable
  const complexityScore = complexity * 2;                 // Complexity matters
  const recencyScore = recency * 2;                       // Recency matters

  const rawScore = evidenceScore + projectScore + experienceScore + complexityScore + recencyScore;

  // Normalize to 0-100
  // Max possible: 30 + 30 + 40 + 20 + 20 = 140
  return Math.min(Math.round((rawScore / 140) * 100), 100);
}

/**
 * Compute project importance (0-100 scale)
 * Based on: skill complexity, skill count, recency, has demo/metrics
 * Prioritizes: Iris (RAG/AI), HiLiTe (ML/CV), Knight Life (high user impact) over simpler projects
 */
export function computeProjectImportance(project: ProjectT): number {
  const skillComplexity = getAverageComplexity(project.skills);
  const skillCount = project.skills.length;
  const recency = computeRecency(project.dates);
  const hasDemo = 'demo' in (project.links || {}) ? 1 : 0;
  const hasGithub = 'github' in (project.links || {}) ? 1 : 0;

  // Check BOTH summary and specifics for USER IMPACT metrics and production deployment
  // Exclude competition placements like "top X%" - focus on adoption/usage metrics
  const allText = [project.summary, ...(project.specifics || [])].join(' ');
  const hasMetrics = /\d+\+?\s*(users|downloads|clients|installs)|star.*rating|rating.*star|\d+\.\d+\s*★|widely\s+adopted|adopted\s+by|production\s+deployment|live\s+deployment|serving\s+live/i.test(allText);

  // Bonus for live deployment (has image/screenshot indicating it's live)
  const isLive = 'image' in (project.links || {}) ? 1 : 0;

  // Check if project IS the live production system (self-hosted/deployed)
  // Indicators: 
  // 1. Full-Stack/Web tag + production architecture (Next.js, App Router, backend services)
  // 2. Published mobile app (App Store/Play Store link)
  const tagsText = (project.tags || []).join(' ');
  const archText = project.architecture || '';
  const hasAppStoreLink = 'app_store' in (project.links || {}) || 'play_store' in (project.links || {});
  
  const isProductionSystem = 
    hasAppStoreLink || // Published mobile apps are production systems
    ((tagsText.includes('Full-Stack') || tagsText.includes('Web')) && 
     /Next\.js|App Router|backend|API Routes|production|deployed|live|serving/i.test(archText));

  // Bonus for cutting-edge AI/ML work (RAG, transformers, diffusion, etc.)
  const hasCuttingEdgeAI = (project.skills as string[]).some(s =>
    ['rag', 'sentence_transformers', 'diffusion_models', 'pytorch', 'opencv'].includes(s)
  );

  // Weighted scoring (prioritize complexity and impact over recency)
  const complexityScore = skillComplexity * 6;            // Increased from 5 to 6 (most important)
  const diversityScore = Math.min(skillCount * 3, 25);    // Cap at 25 (8+ skills)
  const recencyScore = recency * 1.0;                     // Reduced from 1.5 to 1.0 (less important)
  const demoScore = hasDemo * 12;                         // Demo/shipped work (HiLiTe)
  const productionScore = isProductionSystem ? 12 : 0;    // Self-hosted production system (Iris)
  const liveScore = isLive * 12;                          // Live projects equal value (Iris)
  const githubScore = hasGithub * 5;                      // Code availability
  const impactScore = hasMetrics ? 25 : 0;                // User adoption/impact (Knight Life)
  const aiBonus = hasCuttingEdgeAI ? 10 : 0;              // Cutting-edge AI bonus (HiLiTe, Iris)

  const rawScore = complexityScore + diversityScore + recencyScore + demoScore + productionScore + liveScore + githubScore + impactScore + aiBonus;

  // Normalize to 0-100
  // Max possible: 60 + 25 + 10 + 12 + 12 + 12 + 5 + 25 + 10 = 171
  return Math.min(Math.round((rawScore / 171) * 100), 100);
}

/**
 * Compute experience importance (0-100 scale)
 * Based on: skill complexity, recency, impact metrics, skill breadth
 * Note: Duration removed as it's not a good quality indicator for internships/part-time work
 */
export function computeExperienceImportance(exp: ExperienceT): number {
  const skillComplexity = getAverageComplexity(exp.skills);
  const recency = computeRecency(exp.dates);

  const hasImpact = (exp.specifics || []).some(s =>
    /return offer|partnership|strategic|production|\d+[+%]|recognized|award|shipped|delivered|enabled/i.test(s)
  );

  // Weighted scoring (duration removed, recency reduced, impact increased)
  const complexityScore = skillComplexity * 5;                        // Complexity is most important
  const recencyScore = recency * 1.5;                                 // Recency reduced from 3x to 1.5x
  const impactScore = hasImpact ? 30 : 0;                             // Impact increased from 20 to 30
  const roleScore = exp.skills.length * 2.5;                          // Skill breadth

  const rawScore = complexityScore + recencyScore + impactScore + roleScore;

  // Normalize to 0-100
  // Max possible: 50 + 15 + 30 + 30 = 125
  return Math.min(Math.round((rawScore / 125) * 100), 100);
}

/**
 * Compute class importance (0-100 scale)
 * Based on: skill complexity, recency, has projects
 */
export function computeClassImportance(cls: ClassT): number {
  const skillComplexity = getAverageComplexity(cls.skills);

  // Parse term for recency (e.g., "Fall 2024", "Spring 2025")
  const termMatch = cls.term.match(/(Fall|Spring|Summer)\s+(\d{4})/i);
  let recency = 5; // Default

  if (termMatch) {
    const season = termMatch[1].toLowerCase();
    const year = parseInt(termMatch[2]);

    // Approximate month based on season
    const seasonMonths = { fall: 9, spring: 3, summer: 6 };
    const month = seasonMonths[season as keyof typeof seasonMonths] || 1;

    const termDate = new Date(year, month - 1);
    const now = new Date();
    const monthsAgo = (now.getTime() - termDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (monthsAgo < 6) recency = 10;
    else if (monthsAgo < 12) recency = 9;
    else if (monthsAgo < 18) recency = 8;
    else if (monthsAgo < 24) recency = 7;
    else if (monthsAgo < 36) recency = 5;
    else recency = 3;
  }

  const hasMiniProjects = (cls.mini_projects || []).length > 0;
  const hasRelatedProjects = (cls.related_projects || []).length > 0;

  // Weighted scoring
  const complexityScore = skillComplexity * 4;                    // Complexity matters
  const recencyScore = recency * 3;                               // Recency matters
  const projectScore = (hasMiniProjects ? 10 : 0) + (hasRelatedProjects ? 15 : 0);
  const skillCountScore = Math.min(cls.skills.length * 2, 20);   // Cap at 20

  const rawScore = complexityScore + recencyScore + projectScore + skillCountScore;

  // Normalize to 0-100
  // Max possible: 40 + 30 + 25 + 20 = 115
  return Math.min(Math.round((rawScore / 115) * 100), 100);
}

/**
 * Compute blog importance (0-100 scale)
 * Simple: based on recency and cross-references
 */
export function computeBlogImportance(blog: { published_date: string; related_experiences?: string[]; related_projects?: string[] }): number {
  // Parse published date
  const pubDate = new Date(blog.published_date);
  const now = new Date();
  const monthsAgo = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

  let recency = 5;
  if (monthsAgo < 6) recency = 10;
  else if (monthsAgo < 12) recency = 8;
  else if (monthsAgo < 24) recency = 6;
  else recency = 3;

  const hasRelatedWork = (blog.related_experiences || []).length + (blog.related_projects || []).length;

  const recencyScore = recency * 5;
  const crossRefScore = hasRelatedWork * 10;

  const rawScore = recencyScore + crossRefScore;

  // Normalize to 0-100
  // Max possible: 50 + 30 = 80
  return Math.min(Math.round((rawScore / 80) * 100), 100);
}

/**
 * Compute rankings for all KB items
 */
export function computeRankings(allItems: KBItem[]): Rankings {
  const skills: ItemRanking[] = [];
  const projects: ItemRanking[] = [];
  const experiences: ItemRanking[] = [];
  const classes: ItemRanking[] = [];
  const blogs: ItemRanking[] = [];

  for (const item of allItems) {
    let importance = 50; // Default

    if (item.kind === 'skill') {
      importance = computeSkillImportance(item as SkillT, allItems);
      skills.push({ id: item.id, kind: item.kind, importance });
    } else if (item.kind === 'project') {
      importance = computeProjectImportance(item as ProjectT);
      projects.push({ id: item.id, kind: item.kind, importance });
    } else if (item.kind === 'experience') {
      importance = computeExperienceImportance(item as ExperienceT);
      experiences.push({ id: item.id, kind: item.kind, importance });
    } else if (item.kind === 'class') {
      importance = computeClassImportance(item as ClassT);
      classes.push({ id: item.id, kind: item.kind, importance });
    } else if (item.kind === 'blog') {
      importance = computeBlogImportance(item as { published_date: string; related_experiences?: string[]; related_projects?: string[] });
      blogs.push({ id: item.id, kind: item.kind, importance });
    }
  }

  // Sort each category by importance (descending)
  skills.sort((a, b) => b.importance - a.importance);
  projects.sort((a, b) => b.importance - a.importance);
  experiences.sort((a, b) => b.importance - a.importance);
  classes.sort((a, b) => b.importance - a.importance);
  blogs.sort((a, b) => b.importance - a.importance);

  // Combine all rankings
  const all = [...skills, ...projects, ...experiences, ...classes, ...blogs]
    .sort((a, b) => b.importance - a.importance);

  return {
    skills,
    projects,
    experiences,
    classes,
    blogs,
    all
  };
}
