// lib/iris/load.ts
import fs from "node:fs/promises"
import path from "node:path"
import {
  Profile, type ProfileT,
  Contact, type ContactT,
  ProjectsArray, type ProjectT,
  ExperienceArray, type ExperienceT,
  ClassesArray, type ClassT,
  SkillsArray, type SkillT,
  BlogsArray, type BlogT,
  type StoryT,
  type ValueT,
  type InterestT,
  type EducationT,
  type BioT,
  type KBItem
} from "./schema"

/** Root data dirs */
const KB_DIR = path.join(process.cwd(), "src/data/iris/kb")

/** Helpers */
async function readJSON<T>(p: string): Promise<T> {
  const raw = await fs.readFile(p, "utf8")
  return JSON.parse(raw) as T
}
function fp(...segs: string[]) { return path.join(KB_DIR, ...segs) }

/** ---- Loaders for each file ---- */
export async function loadProfile(): Promise<ProfileT> {
  const data = await readJSON<unknown>(fp("profile.json"))
  return Profile.parse(data)
}

export async function loadContact(): Promise<ContactT> {
  const data = await readJSON<unknown>(fp("contact.json"))
  return Contact.parse(data)
}

export async function loadProjects(): Promise<ProjectT[]> {
  const data = await readJSON<unknown>(fp("projects.json"))
  const parsed = ProjectsArray.parse(data)
  return parsed.map(p => ({ ...p, kind: "project" as const }))
}

export async function loadExperience(): Promise<ExperienceT[]> {
  const data = await readJSON<unknown>(fp("experience.json"))
  const parsed = ExperienceArray.parse(data)
  return parsed.map(e => ({ ...e, kind: "experience" as const }))
}

export async function loadClasses(): Promise<ClassT[]> {
  const data = await readJSON<unknown>(fp("classes.json"))
  const parsed = ClassesArray.parse(data)
  return parsed.map(c => ({ ...c, kind: "class" as const }))
}

export async function loadSkills(): Promise<SkillT[]> {
  const data = await readJSON<unknown>(fp("skills.json"))
  const parsed = SkillsArray.parse(data)
  // Add the 'kind' property so skills can be treated as KB items for retrieval
  return parsed.map(s => ({ ...s, kind: "skill" as const }))
}

export async function loadBlogs(): Promise<BlogT[]> {
  const data = await readJSON<{ blog_posts: unknown[] }>(fp("blogs.json"))
  const parsed = BlogsArray.parse(data.blog_posts)
  return parsed.map((b, idx) => ({ 
    ...b, 
    id: b.id || `blog_${idx}`,
    kind: "blog" as const 
  }))
}

export async function loadStories(): Promise<StoryT[]> {
  // Extract stories from profile.family.stories
  const profile = await loadProfile()
  const stories = profile.family?.stories || []
  return stories.map(s => ({
    ...s,
    kind: "story" as const
  }))
}

export async function loadValues(): Promise<ValueT[]> {
  // Extract values from profile.key_values
  const profile = await loadProfile()
  const values = profile.key_values || []
  return values.map((v) => ({
    id: `value_${v.value.toLowerCase().replace(/\s+/g, '_')}`,
    value: v.value,
    why: v.why,
    kind: "value" as const
  }))
}

export async function loadInterests(): Promise<InterestT[]> {
  // Extract interests from profile.interests
  const profile = await loadProfile()
  const interests = profile.interests || []
  return interests.map((i) => ({
    id: `interest_${i.interest.toLowerCase().replace(/\s+/g, '_')}`,
    interest: i.interest,
    why: i.why,
    kind: "interest" as const
  }))
}

export async function loadEducation(): Promise<EducationT[]> {
  // Extract education from profile.education
  // Creates searchable KB items for school, degree, GPA, and graduation info
  const profile = await loadProfile()
  const education = profile.education || []
  return education.map((e, idx) => ({
    id: `education_${idx}`,
    school: e.school,
    degree: e.degree,
    gpa: e.gpa,
    expected_grad: e.expected_grad,
    kind: "education" as const
  }))
}

export async function loadBio(): Promise<BioT[]> {
  // Extract bio info from profile (name, headline, bio text, and meta fields)
  // This makes core profile information searchable for queries like "what's mike's headline?"
  // Meta fields (work_authorization, location, availability, language_proficiency) are now included
  // so Iris can answer questions about work eligibility, location, and language skills
  const profile = await loadProfile()
  return [{
    id: 'bio_profile',
    name: profile.name,
    headline: profile.headline,
    bio: profile.bio,
    work_authorization: profile.work_authorization,
    location: profile.location,
    availability: profile.availability,
    language_proficiency: profile.language_proficiency,
    kind: "bio" as const
  }]
}

/** ---- Combined content for retrieval (all KB items) ---- */
export async function loadKBItems(): Promise<KBItem[]> {
  // Load all document types including skills so they're available for semantic search
  // Skills can now be retrieved when users ask "what are Mike's skills?"
  const [projects, experience, classes, blogs, stories, values, interests, education, bio, skills] = await Promise.all([
    loadProjects(),
    loadExperience(),
    loadClasses(),
    loadBlogs(),
    loadStories(),
    loadValues(),
    loadInterests(),
    loadEducation(),
    loadBio(),
    loadSkills(),
  ])
  const items: KBItem[] = [
    ...projects,
    ...experience,
    ...classes,
    ...blogs,
    ...stories,
    ...values,
    ...interests,
    ...education,
    ...bio,
    ...skills,
  ]

  // sanity: unique ids
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new Error(`Duplicate KB id detected: ${item.id}`)
    }
    seen.add(item.id)
  }

  return items
}

/** ---- Convenience: flat "everything" (for admin/debug) ---- */
export async function loadAll() {
  // Meta information is now part of profile, so no separate meta loading needed
  const [profile, contact, skills, items] = await Promise.all([
    loadProfile(),
    loadContact(),
    loadSkills(),
    loadKBItems(),
  ])
  return { profile, contact, skills, items }
}

/** ---------- Alias Index for Micro-Planner ---------- */

/**
 * Compact alias entry for planner use
 * Contains only essential identifying information (no long text)
 */
export interface AliasEntry {
  id: string;
  type: string;
  name: string;
  aliases: string[];
}

/**
 * Builds a compact alias index from KB items
 * Extracts names and aliases only - used by micro-planner for fast alias resolution
 * 
 * Professional comment: This provides a lightweight name/alias index that the planner
 * can use without loading full item summaries, keeping planner calls token-efficient.
 */
export function buildAliasIndex(items: KBItem[]): AliasEntry[] {
  return items
    .map(item => {
      // Extract name based on item type
      let name = '';
      if ('title' in item && item.title) {
        name = item.title;
      } else if ('name' in item && item.name) {
        name = item.name;
      } else if ('company' in item && item.company) {
        name = item.company;
      } else if ('role' in item && item.role) {
        name = item.role;
      } else if ('value' in item && item.value) {
        name = item.value;
      } else if ('interest' in item && item.interest) {
        name = item.interest;
      } else if ('school' in item && item.school) {
        name = item.school;
      }

      // Extract aliases if present (only Skills have aliases property)
      const aliases = item.kind === 'skill' && 'aliases' in item && Array.isArray(item.aliases) 
        ? item.aliases 
        : [];

      return {
        id: item.id,
        type: item.kind,
        name,
        aliases
      };
    })
    .filter(entry => entry.name); // Only include items with names
}
