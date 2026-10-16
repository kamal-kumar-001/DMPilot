import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.dmpilot.org';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/admin/', '/checkout/', '/settings/', '/api/'],
      },
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'ClaudeBot',
          'anthropic-ai',
          'PerplexityBot',
          'Google-Extended',
          'Applebot-Extended',
          'CCBot',
        ],
        allow: [
          '/',
          '/pricing',
          '/about',
          '/contact',
          '/privacy',
          '/terms',
          '/llms.txt',
          '/llms-full.txt',
        ],
        disallow: ['/dashboard/', '/admin/', '/checkout/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
