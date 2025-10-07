# Mike Veson Portfolio

A modern, interactive personal portfolio built with [Next.js](https://nextjs.org), featuring an AI-powered command palette called **Iris** that helps visitors explore projects, experience, and work using natural language.

## Features

- 🎨 **Modern UI**: Clean, responsive design with dark mode support
- 🤖 **Iris AI Assistant**: Arc-inspired command palette (⌘K) powered by OpenAI for intelligent Q&A
- 🎮 **Interactive Projects**: Including Rack Rush word game
- 📱 **Mobile Optimized**: Fully responsive with proper theme colors
- ⚡ **Performance**: Fast load times with streaming responses and caching

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- OpenAI API key (required for Iris AI features)
- GitHub token (optional, for live commit activity)

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Required for Iris AI Assistant to work
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Enables live GitHub activity in Iris responses
GITHUB_TOKEN=your_github_token_here
```

**Important for Production**: Make sure to add these environment variables to your hosting platform (Vercel, Netlify, etc.) for Iris to work in production.

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
