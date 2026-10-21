import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://jug-liard.vercel.app').replace(/\/$/, '');
  if (process.env.VERCEL_ENV === 'preview' || process.env.JUG_STATIC_PREVIEW === 'true') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/account', '/checkout', '/wishlist'] },
    sitemap: `${site}/sitemap.xml`,
  };
}
