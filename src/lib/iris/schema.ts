// lib/iris/schema.ts
import { z } from "zod"

/** ---------- Core shared primitives ---------- */

export const Link = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
})

export const DateRange = z.object({
  start: z.string().min(1), // "YYYY" or "YYYY-MM"
  end: z.string().optional(), // omit or "present"
})

export const Id = z.string().min(1) // stable, unique

/** ---------- Profile / Meta / Contact ---------- */

export const Profile = z.object({
  name: z.string().min(1),
  headline: z.string().min(1),
  bio: z.string().min(1),
  
  // Meta information previously in meta.json (now merged into profile)
  // These fields provide important context about work authorization, location, availability, and languages
  work_authorization: z.string().optional(),
  location: z.string().optional(),
  availability: z.string().optional(),
  language_proficiency: z.array(z.string()).default([]),
  
  education: z.array(
    z.object({
      school: z.string(),
      degree: z.string(),
      gpa: z.string().optional(),
      expected_grad: z.string().optional(),
    })
  ).default([]),

  // optional family block you added (kept flexible)
  family: z.object({
    parents: z.array(z.string()).optional(),
    siblings: z.array(z.string()).optional(),
    pets: z.array(z.object({ name: z.string(), note: z.string().optional() })).optional(),
    grandparents: z.array(z.string()).optional(),
    stories: z.array(z.object({
      id: Id,
      title: z.string(),
      text: z.string(),
    })).optional()
  }).optional(),

  key_values: z.array(z.object({
    value: z.string(),
    why: z.string(),
  })).default([]),

  interests: z.array(z.object({
    interest: z.string(),
    why: z.string(),
  })).default([])
})

export type ProfileT = z.infer<typeof Profile>

export const Contact = z.object({
  email: z.string().min(1),
  linkedin: z.string().min(1),
  github: z.string().min(1).optional(),
  booking: z.object({
    enabled: z.boolean(),
    link: z.string().min(1).optional(),
  }).optional(),
})
export type ContactT = z.infer<typeof Contact>

/** ---------- Skills (single evidence list + aliases) ---------- */

export const Evidence = z.object({
  type: z.enum(["project","experience","class","blog"]),
  id: Id,
})

// Skill schema without kind (for parsing JSON files)
const SkillBase = z.object({
  id: Id,
  name: z.string(),
  type: z.enum(["language","framework","library","tool","service","technology","domain","technique","algorithm","concept","skill","paradigm","model_family","tooling"]).default("skill"),
  aliases: z.array(z.string()).default([]),
  description: z.string().optional(),
  evidence: z.array(Evidence).default([]), // single place for where it's used/learned
})

// Public type with kind discriminator to enable skills as retrievable KB items
export const Skill = SkillBase.extend({ kind: z.literal("skill") })
export type SkillT = z.infer<typeof Skill>

/** ---------- Content entities: project / experience / class / blog ---------- */

const BaseContent = z.object({
  id: Id,
  title: z.string(),
  summary: z.string(),                 // what shows on cards / list views
  specifics: z.array(z.string()).default([]), // deeper bullets Iris can use
  skills: z.array(Id).default([]),     // references -> skills.json ids
  tags: z.array(z.string()).default([]),
  links: z.record(z.string(), z.string()).default({}), // { github, demo, url, etc. }
  aliases: z.array(z.string()).default([]),
})

// Schemas without kind (for parsing JSON files)
const ProjectBase = BaseContent.extend({
  tech_stack: z.array(z.string()).default([]),
  architecture: z.string().optional(),
  dates: DateRange, // Date range for when the project was worked on
})

const ExperienceBase = z.object({
  id: Id,
  company: z.string(),
  role: z.string(),
  dates: DateRange,
  location: z.string().optional(),
  summary: z.string(),
  specifics: z.array(z.string()).default([]),
  skills: z.array(Id).default([]),
  tags: z.array(z.string()).default([]),
  links: z.record(z.string(), z.string()).default({}),
  aliases: z.array(z.string()).default([]),
})

const ClassBase = BaseContent.extend({
  institution: z.string(),
  term: z.string(),         // e.g., "Fall 2024"
  professor: z.string().optional(),
})

const BlogBase = z.object({
  id: Id.optional(),
  title: z.string(),
  url: z.string(),
  published_date: z.string(),
  context: z.string().optional(),
  summary: z.string(),
  class: z.string().optional(),
  tags: z.array(z.string()).default([]),
})

// Public types with kind discriminator
export const Project = ProjectBase.extend({ kind: z.literal("project") })
export type ProjectT = z.infer<typeof Project>

export const Experience = ExperienceBase.extend({ kind: z.literal("experience") })
export type ExperienceT = z.infer<typeof Experience>

export const Class = ClassBase.extend({ kind: z.literal("class") })
export type ClassT = z.infer<typeof Class>

export const Blog = BlogBase.extend({ 
  id: Id, 
  kind: z.literal("blog") 
})
export type BlogT = z.infer<typeof Blog>

/** ---------- Story (from profile.family.stories) ---------- */

const StoryBase = z.object({
  id: Id,
  title: z.string().min(1),
  text: z.string().min(1),
})
export const Story = StoryBase.extend({
  kind: z.literal("story")
})
export type StoryT = z.infer<typeof Story>

/** ---------- Value (from profile.key_values) ---------- */

const ValueBase = z.object({
  id: Id,
  value: z.string().min(1),
  why: z.string().min(1),
})
export const Value = ValueBase.extend({
  kind: z.literal("value")
})
export type ValueT = z.infer<typeof Value>

/** ---------- Interest (from profile.interests) ---------- */

const InterestBase = z.object({
  id: Id,
  interest: z.string().min(1),
  why: z.string().min(1),
})
export const Interest = InterestBase.extend({
  kind: z.literal("interest")
})
export type InterestT = z.infer<typeof Interest>

/** ---------- Education (from profile.education) ---------- */

const EducationBase = z.object({
  id: Id,
  school: z.string().min(1),
  degree: z.string().min(1),
  gpa: z.string().optional(),
  expected_grad: z.string().optional(),
})
export const Education = EducationBase.extend({
  kind: z.literal("education")
})
export type EducationT = z.infer<typeof Education>

/** ---------- Bio (from profile.bio + headline + meta fields) ---------- */

const BioBase = z.object({
  id: Id,
  name: z.string().min(1),
  headline: z.string().min(1),
  bio: z.string().min(1),
  // Include meta fields so they're available for retrieval
  // This ensures Iris can answer questions about work authorization, location, availability, and languages
  work_authorization: z.string().optional(),
  location: z.string().optional(),
  availability: z.string().optional(),
  language_proficiency: z.array(z.string()).default([]),
})
export const Bio = BioBase.extend({
  kind: z.literal("bio")
})
export type BioT = z.infer<typeof Bio>

/** ---------- Union + arrays ---------- */

// For parsing raw JSON (without kind)
export const ProjectsArray = z.array(ProjectBase)
export const ExperienceArray = z.array(ExperienceBase)
export const ClassesArray = z.array(ClassBase)
export const SkillsArray = z.array(SkillBase)  // Parse JSON without kind, then add it in load.ts
export const BlogsArray = z.array(BlogBase)
export const StoriesArray = z.array(StoryBase)
export const ValuesArray = z.array(ValueBase)
export const InterestsArray = z.array(InterestBase)
export const EducationArray = z.array(EducationBase)
export const BioArray = z.array(BioBase)

export type KBItem =
  | ProjectT
  | ExperienceT
  | ClassT
  | BlogT
  | StoryT
  | ValueT
  | InterestT
  | EducationT
  | BioT
  | SkillT  // Adding SkillT so skills can be retrieved as standalone documents

export const KBItemKinds = ["project","experience","class","blog","story","value","interest","education","bio","skill"] as const

/** ---------- Synthesis Upgrade Types ---------- */

/**
 * Entity identified by the micro-planner
 * Used for alias resolution and type guessing
 */
export interface PlannerEntity {
  name: string;
  typeGuess?: 'project'|'experience'|'class'|'blog'|'story'|'value'|'skill'|'education'|'bio';
  confidence: number; // 0..1
}

/**
 * Retrieval plan specifying which types to search and quotas per type
 * Used to diversify retrieval for evaluative queries
 */
export interface RetrievalPlan {
  types: Array<'project'|'experience'|'class'|'blog'|'story'|'value'|'skill'|'education'|'bio'>;
  topKPerType: Partial<Record<'project'|'experience'|'class', number>>;
  needDiversity: boolean;
  fields: string[]; // e.g., ['title','summary','specifics','dates','skills','metrics']
}

/**
 * Result from micro-planner including routing decision and risk assessment
 * Helps determine whether to use general semantic search vs specific item search
 */
export interface PlannerResult {
  routedIntent: 'contact'|'filter_query'|'specific_item'|'personal'|'general';
  entities: PlannerEntity[];
  plan: RetrievalPlan;
  risk: {
    entityLinkScore: number;      // 0..1
    coverageRatio: number;        // hits/expected
    expectedConcepts: string[];
    matchedConcepts: string[];
  }
}

/**
 * Signals computed from evidence packs
 * Used to determine whether to suggest contact via UI directive
 */
export interface EvidenceSignals {
  evidenceCount: number;
  hasMetrics: boolean;
  entityLinkScore: number; // 0..1
  freshnessMonths: number; // 0 = this month
  coverageRatio: number;   // 0..1
}

/**
 * Self-check confidence from generator
 * Used to assess answer quality and trigger contact directive if needed
 */
export interface SelfCheck {
  confidence: number; // 0..1
}
