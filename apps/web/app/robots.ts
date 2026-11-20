import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.dmpilot.org').replace(/\/$/, '');
  const privatePaths = ['/dashboard', '/admin', '/checkout', '/settings', '/api/'];

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: privatePaths },
      {
        // Search and user-requested retrieval are independent of model training.
        userAgent: ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User'],
        allow: '/',
        disallow: privatePaths,
      },
      {
        // Preserve the existing edge policy, do not opt the site into training.
        userAgent: ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'Google-Extended', 'Applebot-Extended', 'CCBot'],
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
