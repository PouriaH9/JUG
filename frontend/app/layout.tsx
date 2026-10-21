import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type {CSSProperties} from 'react';
import { LanguageProvider } from '@/components/language';
import { ThemeProvider } from '@/components/theme';
import { assetPath } from '@/components/preview-client';
import './globals.css';
import './editorial.css';
import './light.css';
import './entrance.css';
import './typography.css';
import './performance.css';
import './product-details.css';
import './contact-success.css';
import './product-editor.css';

const staticPreview = process.env.JUG_STATIC_PREVIEW === 'true';
export const viewport: Viewport = { themeColor: '#17120f', colorScheme: 'dark' };

export async function generateMetadata(): Promise<Metadata> {
  const english = !staticPreview && (await cookies()).get('jug-language')?.value === 'en';
  const title = english ? 'JUG — Find your flow' : 'جاگ — توپ های جاگلنیگ حرفه ای';
  const description = english
    ? 'Explore JUG juggling balls and practical lessons. Find your rhythm, from your first throw to a confident three-ball cascade.'
    : 'توپ‌های جاگلینگ جاگ و آموزش‌های کاربردی را کشف کن؛ از اولین پرتاب تا اجرای روان سه توپ، ریتم خودت را پیدا کن.';
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://jug-liard.vercel.app'),
    title,
    description,
    applicationName: 'JUG',
    icons: { icon: assetPath('/assets/jug-logo-transparent.png'), apple: assetPath('/assets/jug-logo-transparent.png') },
    openGraph: {
      type: 'website', siteName: 'JUG', title, description,
      locale: english ? 'en_US' : 'fa_IR',
      images: [{ url: assetPath('/assets/jug-ball.png'), alt: english ? 'JUG juggling ball' : 'توپ جاگلینگ جاگ' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [assetPath('/assets/jug-ball.png')] },
    robots: process.env.VERCEL_ENV === 'preview' || staticPreview ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const language = !staticPreview && (await cookies()).get('jug-language')?.value === 'en' ? 'en' : 'fa';
  const theme = !staticPreview && (await cookies()).get('jug-theme')?.value === 'light' ? 'light' : 'dark';
  return <html lang={language} dir={language === 'fa' ? 'rtl' : 'ltr'} data-theme={theme} style={{'--font-english':'"JUG English",Georgia,serif','--font-persian':'"JUG Persian",Tahoma,sans-serif'} as CSSProperties}><head><link rel="preload" href={assetPath(language==='fa'?'/fonts/estedad-arabic-variable.woff2':'/fonts/cormorant-garamond-latin-variable.woff2')} as="font" type="font/woff2" crossOrigin="anonymous"/><style>{`@font-face{font-family:"JUG Persian";src:url("${assetPath('/fonts/estedad-arabic-variable.woff2')}") format("woff2");font-weight:100 900;font-display:swap}@font-face{font-family:"JUG English";src:url("${assetPath('/fonts/cormorant-garamond-latin-variable.woff2')}") format("woff2");font-weight:300 700;font-display:swap}`}</style></head><body><LanguageProvider initialLanguage={language}><ThemeProvider initialTheme={theme}>{children}</ThemeProvider></LanguageProvider></body></html>;
}
