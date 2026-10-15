import type { Metadata } from 'next';
import {cookies} from 'next/headers';
import {LanguageProvider} from '@/components/language';
import './globals.css';
import {assetPath} from '@/components/preview-client';
const staticPreview=process.env.JUG_STATIC_PREVIEW==='true';
export async function generateMetadata():Promise<Metadata>{const english=staticPreview?false:(await cookies()).get('jug-language')?.value==='en';return {icons:{icon:assetPath('/assets/jug-logo-transparent.png'),apple:assetPath('/assets/jug-logo-transparent.png')},title:english?'JUG — Find your flow':'جاگ — ریتم خودت را پیدا کن',description:english?'Precision juggling balls for first throws and fearless performances. Premium equipment, practical courses, endless possibility.':'توپ‌های جاگلینگ با تعادل دقیق؛ از اولین پرتاب تا اجرای حرفه‌ای. محصولات باکیفیت، آموزش کاربردی و امکان‌های بی‌پایان.'};}
export default async function Layout({children}:{children:React.ReactNode}){const language=staticPreview?'fa':(await cookies()).get('jug-language')?.value==='en'?'en':'fa';return <html lang={language} dir={language==='fa'?'rtl':'ltr'}><body><LanguageProvider initialLanguage={language}>{children}</LanguageProvider></body></html>}
