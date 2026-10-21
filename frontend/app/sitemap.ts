import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://jug-liard.vercel.app').replace(/\/$/, '');
  return ['', '/shop', '/learn'].map(path => ({ url: `${site}${path}`, changeFrequency: 'weekly', priority: path ? 0.8 : 1 }));
}
