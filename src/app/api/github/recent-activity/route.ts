import { NextRequest, NextResponse } from 'next/server';

/**
 * Fetch recent activity/commits for a GitHub repo
 * GET /api/github/recent-activity?repo=owner/name
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repo = searchParams.get('repo'); // e.g., "mikedouzinas/HiLiTe"

  if (!repo) {
    return NextResponse.json(
      { error: 'Missing repo parameter' },
      { status: 400 }
    );
  }

  try {
    const headers: Record<string, string> = {};
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }

    // Fetch last 5 commits
    const response = await fetch(
      `https://api.github.com/repos/${repo}/commits?per_page=5`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    interface GitHubCommit {
      sha: string;
      commit: {
        message: string;
        author: {
          name: string;
          date: string;
        };
      };
    }

    const commits = await response.json() as GitHubCommit[];

    const formatted = commits.map((c) => ({
      message: c.commit.message.split('\n')[0], // First line only
      date: c.commit.author.date,
      sha: c.sha.slice(0, 7),
      author: c.commit.author.name
    }));

    return NextResponse.json({
      repo,
      commits: formatted,
      count: formatted.length
    });
  } catch (error) {
    console.error('[GitHub Activity] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GitHub activity' },
      { status: 500 }
    );
  }
}
