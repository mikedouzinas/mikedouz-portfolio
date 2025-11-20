/**
 * Manual complexity ratings for skills (1-10 scale)
 *
 * Complexity Levels:
 * 1-3: Basic/Foundational - Simple tools, markup, basic concepts
 * 4-6: Intermediate - Common languages, standard frameworks, core CS concepts
 * 7-8: Advanced - Systems programming, ML/AI, complex architectures
 * 9-10: Expert - Deep learning, compilers, distributed systems, cutting-edge tech
 *
 * Used to rank skills in dropdowns and compute project/experience importance
 */

export const SKILL_COMPLEXITY: Record<string, number> = {
  // ========================================
  // LANGUAGES (Programming & Markup)
  // ========================================
  'python': 6,              // Intermediate, widely used
  'typescript': 7,          // Advanced (superset of JS, type systems)
  'java': 6,                // Intermediate, standard OOP language
  'c_lang': 8,              // Advanced (manual memory, systems level)
  'csharp': 6,              // Intermediate (similar to Java)
  'r_lang': 5,              // Intermediate (specialized for stats)
  'swift': 6,               // Intermediate (iOS development)
  'assembly': 9,            // Expert (lowest level, architecture-specific)

  // ========================================
  // FRAMEWORKS & LIBRARIES
  // ========================================
  'react': 7,               // Advanced (complex state management, hooks)
  'nextjs': 8,              // Advanced (SSR, routing, optimization)
  'swiftui': 7,             // Advanced (declarative iOS UI)
  'framer_motion': 5,       // Intermediate (animation library)
  'tailwind_css': 4,        // Intermediate-low (utility CSS)
  'pytorch': 9,             // Expert (deep learning framework)
  'opencv': 8,              // Advanced (computer vision library)
  'pandas': 6,              // Intermediate (data manipulation)
  'numpy': 6,               // Intermediate (numerical computing)
  'scikit_learn': 7,        // Advanced (ML algorithms)
  'sentence_transformers': 8, // Advanced (NLP embeddings)
  'faiss': 8,               // Advanced (vector search)
  'streamlit': 4,           // Intermediate-low (rapid prototyping)
  'avfoundation': 7,        // Advanced (iOS audio/video)

  // ========================================
  // TOOLS & SERVICES
  // ========================================
  'firebase': 4,            // Intermediate-low (backend-as-a-service)
  'supabase': 5,            // Intermediate (Postgres + APIs)
  'docker': 7,              // Advanced (containerization)
  'aws': 7,                 // Advanced (cloud infrastructure)
  'power_bi': 5,            // Intermediate (BI tool)
  'dotnet': 6,              // Intermediate (.NET framework)
  'google_document_ai': 6,  // Intermediate (document parsing API)
  'ci_cd': 6,               // Intermediate (DevOps pipelines)
  'xcode': 4,               // Intermediate-low (IDE)
  'antlr': 8,               // Advanced (parser generator)

  // ========================================
  // CS FUNDAMENTALS & CONCEPTS
  // ========================================
  'algorithms': 8,          // Advanced (design & analysis)
  'data_structures': 7,     // Advanced (trees, graphs, hash tables)
  'oop': 5,                 // Intermediate (basic paradigm)
  'discrete_math': 7,       // Advanced (mathematical foundations)
  'proofs': 8,              // Advanced (correctness proofs)
  'graphs': 7,              // Advanced (graph algorithms)
  'functional_programming': 8, // Advanced (paradigm shift)
  'programming_languages': 9,  // Expert (language design, type systems)
  'parsing': 8,             // Advanced (compiler front-end)
  'compilers': 9,           // Expert (full compilation pipeline)

  // ========================================
  // SYSTEMS & ARCHITECTURE
  // ========================================
  'computer_architecture': 8,  // Advanced (CPU, memory hierarchy)
  'systems_programming': 9,    // Expert (OS-level programming)
  'operating_systems': 9,      // Expert (kernel concepts)
  'concurrency': 9,            // Expert (threads, race conditions)
  'memory_management': 8,      // Advanced (malloc, garbage collection)
  'networking_basics': 6,      // Intermediate (protocols, sockets)
  'systems_security_basics': 7, // Advanced (buffer overflows, ROP)
  'parallel_computing': 8,     // Advanced (multi-core, GPU)
  'multicore_systems': 8,      // Advanced (parallelism)
  'performance_engineering': 8, // Advanced (optimization)

  // ========================================
  // AI & MACHINE LEARNING
  // ========================================
  'machine_learning': 8,    // Advanced (classical ML)
  'deep_learning': 9,       // Expert (neural networks)
  'transformers': 10,       // Expert (state-of-the-art NLP/Vision)
  'computer_vision': 8,     // Advanced (image processing, detection)
  'nlp': 8,                 // Advanced (text processing)
  'diffusion_models': 10,   // Expert (cutting-edge generative)
  'rag': 8,                 // Advanced (retrieval-augmented generation)
  'openai_api': 5,          // Intermediate (API usage)
  'speech_recognition': 7,  // Advanced (ASR systems)
  'tts': 6,                 // Intermediate (text-to-speech)

  // ========================================
  // DATA SCIENCE & ANALYTICS
  // ========================================
  'data_mining': 7,         // Advanced (pattern discovery)
  'feature_engineering': 7, // Advanced (feature design)
  'model_evaluation': 7,    // Advanced (metrics, validation)
  'data_extraction': 6,     // Intermediate (ETL)
  'data_warehousing': 7,    // Advanced (OLAP, data modeling)
  'olap': 7,                // Advanced (multidimensional analysis)
  'probability': 7,         // Advanced (mathematical foundations)
  'statistics': 7,          // Advanced (inference, testing)
  'hypothesis_testing': 6,  // Intermediate (statistical tests)
  'data_analysis_basics': 4, // Intermediate-low (exploratory)

  // ========================================
  // PRODUCT & DESIGN
  // ========================================
  'product_management': 6,  // Intermediate (strategy, roadmaps)
  'user_research': 5,       // Intermediate (interviews, testing)
  'ux_design': 6,           // Intermediate (wireframes, flows)
  'entrepreneurship': 5,    // Intermediate (venture building)
  'product_discovery': 5,   // Intermediate (customer development)
  'leadership': 6,          // Intermediate (team management)
  'writing': 5,             // Intermediate (communication)
  'research_writing': 5,    // Intermediate (academic writing)
  'ai_ethics_policy': 6,    // Intermediate (ethical considerations)

  // ========================================
  // SPECIALIZED DOMAINS
  // ========================================
  'api_integration': 5,     // Intermediate (REST, GraphQL)
  'rule_engines': 7,        // Advanced (business logic systems)
  'ios_development': 7,     // Advanced (platform-specific)

  // ========================================
  // DEFAULT FALLBACK
  // ========================================
  // Any unmapped skill will default to 5 (intermediate) in ranking algorithms
};

/**
 * Get complexity score for a skill
 * Returns mapped value or default of 5 if not found
 */
export function getSkillComplexity(skillId: string): number {
  return SKILL_COMPLEXITY[skillId] ?? 5;
}

/**
 * Get average complexity of a list of skills
 * Useful for computing project/experience complexity
 */
export function getAverageComplexity(skillIds: string[]): number {
  if (skillIds.length === 0) return 5;

  const sum = skillIds.reduce((acc, id) => acc + getSkillComplexity(id), 0);
  return sum / skillIds.length;
}
