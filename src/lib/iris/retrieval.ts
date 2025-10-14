/**
 * Retrieval-Augmented Generation (RAG) System
 * 
 * Implements semantic search over the knowledge base using OpenAI embeddings.
 * Chunks KB content, generates embeddings, and performs top-k similarity search
 * to provide relevant context for answer generation.
 */

import { OpenAI } from 'openai';
import { config } from './config';

// Type definitions for knowledge base data
interface Experience {
  company: string;
  role: string;
  dates: string;
  location: string;
  stack: string[];
  impact: string[];
}

interface Project {
  name: string;
  description: string;
  route: string;
  stack: string[];
}

interface PlaygroundProject {
  name: string;
  description: string;
  route: string;
  status: string;
}

interface Value {
  name: string;
  description: string;
}

interface ContactMethod {
  type: string;
  value: string;
  description: string;
}

interface Route {
  path: string;
  title: string;
  description: string;
}

interface Interest {
  name: string;
  description: string;
}

interface BlogPost {
  title: string;
  url: string;
  published_date: string;
  context: string;
  summary: string;
  key_themes: string[];
}

interface Profile {
  tagline: string;
  current_work: string;
  location: string;
  languages: {
    native: string[];
    fluent: string[];
    learning: string[];
  };
  interests: string[];
  availability_status: string;
  full_name?: {
    english: string;
    greek: string;
    note: string;
  };
  family?: {
    parents: {
      father: string;
      mother: string;
    };
    siblings: Array<{
      name: string;
      relation: string;
    }>;
    grandfathers: {
      paternal: string;
      maternal: string;
    };
    legacy: string;
  };
  entrepreneurship_history?: {
    veson_nautical: {
      founded_by: string;
      company_name_origin: string;
      mother_role: string;
      mike_involvement: string;
      legacy: string;
    };
    influence: string;
  };
}

interface KBData {
  profile?: Profile;
  experience?: { experiences: Experience[] };
  projects?: { projects: Project[] };
  playground?: { playground_projects: PlaygroundProject[] };
  values?: { core_values: Value[] };
  contact?: { contact_methods: ContactMethod[]; response_time: string; availability: string };
  site_map?: { routes: Route[] };
  fun?: { interests: Interest[]; hobbies: string[] };
  blogs?: { blog_posts: BlogPost[] };
}

// Cache embeddings in memory for the runtime session
declare global {
  var __irisEmbeds: Map<string, number[]> | undefined;
  var __irisChunks: KBChunk[] | undefined;
}

export interface KBChunk {
  id: string;
  content: string;
  source: string;      // Which KB file it came from
  section?: string;    // Which section within that file
  route?: string;      // Associated route if available
  metadata: {
    type: 'profile' | 'experience' | 'project' | 'playground' | 'value' | 'contact' | 'route' | 'fun' | 'blog';
    entity?: string;   // Company name, project name, etc.
    weight?: number;   // Relevance boost for this chunk
  };
}

export interface RetrievalResult {
  chunks: KBChunk[];
  routes: string[];    // Relevant internal routes to include in answers
  totalTime: number;   // Performance monitoring
}

/**
 * Initialize the retrieval system by loading and processing KB
 * Call this once on app startup or first API request
 */
export async function initializeRetrieval(): Promise<void> {
  if (globalThis.__irisChunks && globalThis.__irisEmbeds) {
    return; // Already initialized
  }
  
  try {
    const startTime = Date.now();
    
    // Load and chunk the knowledge base
    const chunks = await loadAndChunkKB();
    globalThis.__irisChunks = chunks;
    
    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks);
    globalThis.__irisEmbeds = new Map(
      chunks.map((chunk, index) => [chunk.id, embeddings[index]])
    );
    
    const elapsedMs = Date.now() - startTime;
    console.log(`Iris retrieval initialized: ${chunks.length} chunks, ${elapsedMs}ms`);
  } catch (error) {
    console.error('Failed to initialize retrieval:', error);
    // Initialize with empty data to prevent crashes
    globalThis.__irisChunks = [];
    globalThis.__irisEmbeds = new Map();
  }
}

/**
 * Perform semantic search to retrieve relevant KB chunks
 * Returns top-k most similar chunks for the given query
 */
export async function retrieveRelevantChunks(
  query: string,
  topK: number = config.topK
): Promise<RetrievalResult> {
  const startTime = Date.now();
  
  // Ensure retrieval system is initialized
  if (!globalThis.__irisChunks || !globalThis.__irisEmbeds) {
    await initializeRetrieval();
  }
  
  const chunks = globalThis.__irisChunks || [];
  const embeddings = globalThis.__irisEmbeds || new Map();
  
  if (chunks.length === 0) {
    return {
      chunks: [],
      routes: [],
      totalTime: Date.now() - startTime
    };
  }
  
  try {
    // Get query embedding
    const queryEmbedding = await embedQuery(query);
    
    // Calculate similarities
    const similarities = chunks.map(chunk => {
      const chunkEmbedding = embeddings.get(chunk.id);
      if (!chunkEmbedding) {
        return { chunk, similarity: 0 };
      }
      
      const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
      
      // Apply metadata boosts
      let boostedSimilarity = similarity;
      if (chunk.metadata.weight) {
        boostedSimilarity *= chunk.metadata.weight;
      }
      
      return { chunk, similarity: boostedSimilarity };
    });
    
    // Sort by similarity and take top-k
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topChunks = similarities.slice(0, topK).map(item => item.chunk);
    
    // Extract relevant routes
    const routes = Array.from(new Set(
      topChunks
        .map(chunk => chunk.route)
        .filter(Boolean)
    )) as string[];
    
    return {
      chunks: topChunks,
      routes,
      totalTime: Date.now() - startTime
    };
  } catch (error) {
    console.error('Retrieval error:', error);
    return {
      chunks: [],
      routes: [],
      totalTime: Date.now() - startTime
    };
  }
}

/**
 * Load knowledge base files and chunk them for embedding
 * Converts structured KB data into searchable text chunks
 */
async function loadAndChunkKB(): Promise<KBChunk[]> {
  const chunks: KBChunk[] = [];
  let chunkId = 0;
  
  try {
    // Load all KB files
    const [profile, experience, projects, playground, values, contact, siteMap, fun, blogs] = await Promise.all([
      import('@/data/iris/kb/profile.json'),
      import('@/data/iris/kb/experience.json'),
      import('@/data/iris/kb/projects.json'), 
      import('@/data/iris/kb/playground.json'),
      import('@/data/iris/kb/values.json'),
      import('@/data/iris/kb/contact.json'),
      import('@/data/iris/kb/site_map.json'),
      import('@/data/iris/kb/fun.json'),
      import('@/data/iris/kb/blogs.json')
    ]);
    
    // Process profile - Basic Info
    const profileData = profile.default;
    chunks.push({
      id: `chunk-${chunkId++}`,
      content: `Mike Veson is a ${profileData.tagline}. Currently ${profileData.current_work}. Located in ${profileData.location}. Speaks ${profileData.languages.native.join(', ')} natively, fluent in ${profileData.languages.fluent.join(', ')}, and learning ${profileData.languages.learning.join(', ')}. ${profileData.availability_status}.`,
      source: 'profile',
      metadata: { type: 'profile', weight: 1.2 }
    });
    
    // Process profile - Full Name (low priority - background info only)
    if (profileData.full_name) {
      chunks.push({
        id: `chunk-${chunkId++}`,
        content: `Mike's full name is ${profileData.full_name.english} (in English) and ${profileData.full_name.greek} (in Greek). ${profileData.full_name.note}.`,
        source: 'profile',
        section: 'full_name',
        metadata: { type: 'profile', weight: 0.8 }
      });
    }
    
    // Process profile - Family (low priority - background info only)
    if (profileData.family) {
      const family = profileData.family;
      const siblingsText = family.siblings.map(s => `${s.name} (${s.relation})`).join(' and ');
      chunks.push({
        id: `chunk-${chunkId++}`,
        content: `Mike's family: His parents are ${family.parents.father} and ${family.parents.mother}. His siblings are ${siblingsText}. His grandfathers are ${family.grandfathers.paternal} and ${family.grandfathers.maternal}. ${family.legacy}`,
        source: 'profile',
        section: 'family',
        metadata: { type: 'profile', weight: 0.8 }
      });
    }
    
    // Process profile - Entrepreneurship History (medium priority - relevant to professional journey)
    if (profileData.entrepreneurship_history) {
      const vh = profileData.entrepreneurship_history.veson_nautical;
      chunks.push({
        id: `chunk-${chunkId++}`,
        content: `${vh.founded_by}. ${vh.company_name_origin}. ${vh.mother_role}. ${vh.mike_involvement}. ${vh.legacy} ${profileData.entrepreneurship_history.influence}`,
        source: 'profile',
        section: 'entrepreneurship',
        metadata: { type: 'profile', weight: 1.1 }
      });
    }
    
    // Process experience
    const experienceData = experience.default as KBData['experience'];
    experienceData?.experiences?.forEach((exp: Experience) => {
      chunks.push({
        id: `chunk-${chunkId++}`,
        content: `Mike worked at ${exp.company} as a ${exp.role} from ${exp.dates} in ${exp.location}. Used technologies: ${exp.stack.join(', ')}. Key impacts: ${exp.impact.join('. ')}.`,
        source: 'experience',
        section: exp.company,
        metadata: { 
          type: 'experience', 
          entity: exp.company,
          weight: 1.1 
        }
      });
    });
    
    // Process projects
    const projectsData = projects.default as KBData['projects'];
    projectsData?.projects?.forEach((project: Project) => {
      chunks.push({
        id: `chunk-${chunkId++}`,
        content: `${project.name}: ${project.description}. Built with ${project.stack.join(', ')}.`,
        source: 'projects',
        section: project.name,
        route: project.route,
        metadata: { 
          type: 'project',
          entity: project.name,
          weight: 1.3
        }
      });
    });
    
    // Process playground
    const playgroundData = playground.default as KBData['playground'];
    playgroundData?.playground_projects?.forEach((project: PlaygroundProject) => {
      chunks.push({
        id: `chunk-${chunkId++}`,
        content: `${project.name}: ${project.description}. Status: ${project.status}.`,
        source: 'playground',
        section: project.name,
        route: project.route,
        metadata: {
          type: 'playground',
          entity: project.name,
          weight: 1.0
        }
      });
    });
    
    // Process values
    const valuesData = values.default as KBData['values'];
    valuesData?.core_values?.forEach((value: Value) => {
      chunks.push({
        id: `chunk-${chunkId++}`,
        content: `${value.name}: ${value.description}`,
        source: 'values',
        section: value.name,
        metadata: { type: 'value', weight: 1.1 }
      });
    });
    
    // Process contact
    const contactData = contact.default as KBData['contact'];
    const contactText = `Contact Mike via ${contactData?.contact_methods?.map((method: ContactMethod) => 
      `${method.type}: ${method.value} (${method.description})`
    ).join(', ') || 'email'}. ${contactData?.response_time || 'Quick response'}. ${contactData?.availability || 'Available for opportunities'}.`;
    
    chunks.push({
      id: `chunk-${chunkId++}`,
      content: contactText,
      source: 'contact',
      metadata: { type: 'contact', weight: 1.2 }
    });
    
    // Process site map
    const siteMapData = siteMap.default as KBData['site_map'];
    siteMapData?.routes?.forEach((route: Route) => {
      chunks.push({
        id: `chunk-${chunkId++}`,
        content: `${route.title} page (${route.path}): ${route.description}`,
        source: 'site_map',
        route: route.path,
        metadata: { type: 'route', weight: 0.8 }
      });
    });
    
    // Process fun facts
    const funData = fun.default as KBData['fun'];
    const interestsText = funData?.interests?.map((interest: Interest) => 
      `${interest.name}: ${interest.description}`
    ).join('. ') || '';
    const hobbiesText = `Hobbies include: ${funData?.hobbies?.join(', ') || 'various interests'}.`;
    
    chunks.push({
      id: `chunk-${chunkId++}`,
      content: `${interestsText} ${hobbiesText}`,
      source: 'fun',
      metadata: { type: 'fun', weight: 0.9 }
    });
    
    // Process blog posts (high priority for professional storytelling)
    const blogsData = blogs.default as KBData['blogs'];
    blogsData?.blog_posts?.forEach((post: BlogPost) => {
      chunks.push({
        id: `chunk-${chunkId++}`,
        content: `Blog post: "${post.title}" (${post.url}). ${post.context}. ${post.summary}. Key themes: ${post.key_themes.join('. ')}.`,
        source: 'blogs',
        section: post.title,
        route: post.url,
        metadata: { 
          type: 'blog',
          entity: post.title,
          weight: 1.2 
        }
      });
    });
    
    // Apply chunking if any content exceeds chunk size
    const finalChunks: KBChunk[] = [];
    chunks.forEach(chunk => {
      if (chunk.content.length <= config.chunkSize) {
        finalChunks.push(chunk);
      } else {
        // Split large chunks while preserving sentence boundaries
        const subChunks = splitIntoChunks(chunk.content, config.chunkSize);
        subChunks.forEach((content, index) => {
          finalChunks.push({
            ...chunk,
            id: `${chunk.id}-${index}`,
            content
          });
        });
      }
    });
    
    return finalChunks;
  } catch (error) {
    console.error('Failed to load and chunk KB:', error);
    return [];
  }
}

/**
 * Generate embeddings for all chunks using OpenAI
 */
async function generateEmbeddings(chunks: KBChunk[]): Promise<number[][]> {
  if (chunks.length === 0) return [];
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  try {
    // Batch process embeddings (OpenAI allows up to 2048 inputs per request)
    const batchSize = 100; // Conservative batch size for reliability
    const allEmbeddings: number[][] = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(chunk => chunk.content);
      
      const response = await openai.embeddings.create({
        model: config.models.embedding,
        input: texts,
        encoding_format: 'float'
      });
      
      const embeddings = response.data.map(item => item.embedding);
      allEmbeddings.push(...embeddings);
    }
    
    return allEmbeddings;
  } catch (error) {
    console.error('Failed to generate embeddings:', error);
    // Return zero vectors as fallback
    return chunks.map(() => new Array(1536).fill(0)); // text-embedding-3-small dimension
  }
}

/**
 * Generate embedding for a single query
 */
async function embedQuery(query: string): Promise<number[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  try {
    const response = await openai.embeddings.create({
      model: config.models.embedding,
      input: [query],
      encoding_format: 'float'
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Failed to embed query:', error);
    return new Array(1536).fill(0); // Fallback zero vector
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Split text into chunks while preserving sentence boundaries
 */
function splitIntoChunks(text: string, maxChunkSize: number): string[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    const testChunk = currentChunk ? `${currentChunk}. ${trimmedSentence}` : trimmedSentence;
    
    if (testChunk.length <= maxChunkSize) {
      currentChunk = testChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = trimmedSentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks.length > 0 ? chunks : [text.substring(0, maxChunkSize)];
}

/**
 * Get retrieval system statistics for monitoring
 */
export function getRetrievalStats(): {
  chunksLoaded: number;
  embeddingsGenerated: number;
  memoryUsage: string;
} {
  const chunks = globalThis.__irisChunks || [];
  const embeddings = globalThis.__irisEmbeds || new Map();
  
  // Rough memory calculation (embeddings are the main usage)
  const embeddingMemoryMB = (embeddings.size * 1536 * 4) / (1024 * 1024);
  
  return {
    chunksLoaded: chunks.length,
    embeddingsGenerated: embeddings.size,
    memoryUsage: `~${embeddingMemoryMB.toFixed(1)}MB`
  };
}
