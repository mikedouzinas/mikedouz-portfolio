/**
 * GitHub Integration for Recent Activity
 * 
 * Fetches recent commits from the portfolio repository to provide
 * "now" context in Iris answers. Caches results for 24 hours and
 * gracefully degrades if GITHUB_TOKEN is missing or rate-limited.
 */

import { config } from './config';

interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

interface CommitSummary {
  recentCommits: GitHubCommit[];
  lastUpdated: string;
  totalCommits: number;
  summary: string; // Human-readable summary for Iris context
}

// In-memory cache with TTL
declare global {
  var __githubCommitCache: {
    data: CommitSummary | null;
    timestamp: number;
    expiry: number;
  } | undefined;
}

/**
 * Get recent commits with caching
 * Returns cached data if available and fresh, otherwise fetches new data
 */
export async function getRecentCommits(): Promise<CommitSummary | null> {
  const cache = globalThis.__githubCommitCache;
  const now = Date.now();
  
  // Return cached data if valid and not expired
  if (cache && cache.data && now < cache.expiry) {
    return cache.data;
  }
  
  // Check if GitHub integration is available
  if (!process.env.GITHUB_TOKEN) {
    console.log('GitHub token not available, skipping commit fetch');
    return null;
  }
  
  try {
    const commits = await fetchCommitsFromGitHub();
    const summary = generateCommitSummary(commits);
    
    // Cache the result
    globalThis.__githubCommitCache = {
      data: summary,
      timestamp: now,
      expiry: now + config.commitTtlMs
    };
    
    console.log(`Fetched ${commits.length} recent commits from GitHub`);
    return summary;
  } catch (error) {
    console.warn('Failed to fetch GitHub commits:', error);
    
    // Return cached data if available, even if expired
    if (cache && cache.data) {
      console.log('Using stale commit cache due to fetch error');
      return cache.data;
    }
    
    return null;
  }
}

/**
 * Fetch commits directly from GitHub API
 */
async function fetchCommitsFromGitHub(): Promise<GitHubCommit[]> {
  const { owner, name } = config.repo;
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    throw new Error('GitHub token not available');
  }
  
  // Fetch last 10 commits from the main/master branch
  const url = `https://api.github.com/repos/${owner}/${name}/commits?per_page=10&since=${getDateDaysAgo(7)}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'iris-portfolio-assistant'
    }
  });
  
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(`GitHub API rate limited: ${response.statusText}`);
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  
  const commits = await response.json();
  
  return commits.map((commit: { sha: string; commit: { message: string; author: { name: string; date: string } }; html_url: string }) => ({
    sha: commit.sha.substring(0, 7), // Short SHA
    message: commit.commit.message.split('\n')[0], // First line only
    author: commit.commit.author.name,
    date: commit.commit.author.date,
    url: commit.html_url
  }));
}

/**
 * Generate a human-readable summary of recent activity
 * This summary is used in Iris system prompts for context
 */
function generateCommitSummary(commits: GitHubCommit[]): CommitSummary {
  if (commits.length === 0) {
    return {
      recentCommits: [],
      lastUpdated: new Date().toISOString(),
      totalCommits: 0,
      summary: "No recent portfolio updates in the last week."
    };
  }
  
  const now = new Date();
  const recentCommits = commits.slice(0, 5); // Top 5 most recent
  
  // Categorize commits by type (based on conventional commit patterns)
  const categories = {
    features: [] as string[],
    fixes: [] as string[],
    docs: [] as string[],
    style: [] as string[],
    refactor: [] as string[],
    other: [] as string[]
  };
  
  recentCommits.forEach(commit => {
    const message = commit.message.toLowerCase();
    
    if (message.startsWith('feat') || message.includes('add') || message.includes('new')) {
      categories.features.push(commit.message);
    } else if (message.startsWith('fix') || message.includes('bug') || message.includes('issue')) {
      categories.fixes.push(commit.message);
    } else if (message.startsWith('docs') || message.includes('readme') || message.includes('documentation')) {
      categories.docs.push(commit.message);
    } else if (message.startsWith('style') || message.includes('ui') || message.includes('design')) {
      categories.style.push(commit.message);
    } else if (message.startsWith('refactor') || message.includes('cleanup') || message.includes('improve')) {
      categories.refactor.push(commit.message);
    } else {
      categories.other.push(commit.message);
    }
  });
  
  // Generate natural language summary
  const summaryParts: string[] = [];
  
  if (categories.features.length > 0) {
    summaryParts.push(`Added ${categories.features.length} new feature${categories.features.length > 1 ? 's' : ''}`);
  }
  
  if (categories.fixes.length > 0) {
    summaryParts.push(`fixed ${categories.fixes.length} bug${categories.fixes.length > 1 ? 's' : ''}`);
  }
  
  if (categories.style.length > 0) {
    summaryParts.push(`made ${categories.style.length} UI improvement${categories.style.length > 1 ? 's' : ''}`);
  }
  
  if (categories.refactor.length > 0) {
    summaryParts.push(`refactored ${categories.refactor.length} component${categories.refactor.length > 1 ? 's' : ''}`);
  }
  
  if (categories.docs.length > 0) {
    summaryParts.push(`updated documentation`);
  }
  
  const lastCommitDate = new Date(recentCommits[0].date);
  const daysAgo = Math.floor((now.getTime() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24));
  
  let summary = '';
  if (summaryParts.length > 0) {
    summary = `Recent portfolio updates (last commit ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago): ` +
              summaryParts.join(', ') + '.';
  } else {
    summary = `Portfolio was last updated ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago with ${commits.length} recent change${commits.length !== 1 ? 's' : ''}.`;
  }
  
  return {
    recentCommits,
    lastUpdated: now.toISOString(),
    totalCommits: commits.length,
    summary
  };
}

/**
 * Get ISO date string for N days ago (for GitHub API since parameter)
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/**
 * Check if there are recent commits (within 24 hours)
 * Useful for determining if "now" context should include recent activity
 */
export async function hasRecentActivity(): Promise<boolean> {
  try {
    const summary = await getRecentCommits();
    if (!summary || summary.recentCommits.length === 0) {
      return false;
    }
    
    const lastCommitDate = new Date(summary.recentCommits[0].date);
    const hoursAgo = (Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60);
    
    return hoursAgo <= 24;
  } catch (error) {
    console.warn('Error checking recent activity:', error);
    return false;
  }
}

/**
 * Get a formatted string of recent activity for inclusion in answers
 * Returns null if no recent activity or if GitHub integration is unavailable
 */
export async function getRecentActivityContext(): Promise<string | null> {
  try {
    const summary = await getRecentCommits();
    if (!summary) {
      return null;
    }

    return summary.summary;
  } catch (error) {
    console.warn('Error getting recent activity context:', error);
    return null;
  }
}

/**
 * Fetch commits for a specific repository
 * Used for "Fetch recent updates" quick action on projects
 * @param repo - Repository in format "owner/name" (e.g., "mikedouzinas/hilite")
 * @returns Formatted string with recent commits or null if unavailable
 */
export async function getRepoCommits(repo: string): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.log('GitHub token not available, skipping repo commit fetch');
    return null;
  }

  try {
    // Fetch last 5 commits from the repository
    const url = `https://api.github.com/repos/${repo}/commits?per_page=5`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'iris-portfolio-assistant'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return `Repository ${repo} not found or not accessible.`;
      }
      if (response.status === 403) {
        throw new Error('GitHub API rate limited');
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const commits = await response.json();

    if (!commits || commits.length === 0) {
      return `No recent commits found for ${repo}.`;
    }

    // Format commits as human-readable text
    const formattedCommits = commits.map((commit: {
      sha: string;
      commit: { message: string; author: { name: string; date: string } };
      html_url: string
    }) => {
      const shortSha = commit.sha.substring(0, 7);
      const message = commit.commit.message.split('\n')[0]; // First line only
      const date = new Date(commit.commit.author.date);
      const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
      const timeAgo = daysAgo === 0 ? 'today' :
                      daysAgo === 1 ? 'yesterday' :
                      `${daysAgo} days ago`;

      return `- ${shortSha}: ${message} (${timeAgo})`;
    }).join('\n');

    return `Recent commits for ${repo}:\n${formattedCommits}`;
  } catch (error) {
    console.warn(`Failed to fetch commits for ${repo}:`, error);
    return `Unable to fetch recent commits for ${repo}. GitHub may be unavailable or rate limited.`;
  }
}

/**
 * Force refresh the commit cache (for testing or manual refresh)
 */
export async function refreshCommitCache(): Promise<CommitSummary | null> {
  // Clear existing cache
  globalThis.__githubCommitCache = undefined;
  
  // Fetch fresh data
  return await getRecentCommits();
}

/**
 * Get cache statistics for monitoring
 */
export function getGitHubCacheStats(): {
  cached: boolean;
  lastFetch: string | null;
  expiresIn: number; // minutes
  commitCount: number;
} {
  const cache = globalThis.__githubCommitCache;
  
  if (!cache || !cache.data) {
    return {
      cached: false,
      lastFetch: null,
      expiresIn: 0,
      commitCount: 0
    };
  }
  
  const now = Date.now();
  const expiresInMs = Math.max(0, cache.expiry - now);
  const expiresInMinutes = Math.floor(expiresInMs / (1000 * 60));
  
  return {
    cached: true,
    lastFetch: new Date(cache.timestamp).toISOString(),
    expiresIn: expiresInMinutes,
    commitCount: cache.data.totalCommits
  };
}

/**
 * Health check for GitHub integration
 * Returns status and any configuration issues
 */
export function getGitHubIntegrationHealth(): {
  available: boolean;
  tokenConfigured: boolean;
  repoConfigured: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const tokenConfigured = !!process.env.GITHUB_TOKEN;
  const repoConfigured = !!(config.repo.owner && config.repo.name);
  
  if (!tokenConfigured) {
    issues.push('GITHUB_TOKEN environment variable not set');
  }
  
  if (!repoConfigured) {
    issues.push('Repository owner/name not configured');
  }
  
  return {
    available: tokenConfigured && repoConfigured,
    tokenConfigured,
    repoConfigured, 
    issues
  };
}
