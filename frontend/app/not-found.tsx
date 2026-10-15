'use client';
import Link from 'next/link';
import {assetPath} from '@/components/preview-client';
import {useLanguage,LanguageSwitch} from '@/components/language';
export default function NotFound(){const {language}=useLanguage();return <><header><Link className="logo" href="/" aria-label={language==='fa'?'صفحهٔ اصلی جاگ':'JUG home'}><img src={assetPath("/assets/jug-logo-transparent.png")} alt="JUG" width={72} height={72}/></Link><div className="header-actions"><LanguageSwitch/></div></header><main className="section-wrap inner-page empty-state"><h1>404</h1><h2>{language==='fa'?'صفحه پیدا نشد':'Page not found'}</h2><p>{language==='fa'?'این صفحه در دسترس نیست.':'This page is unavailable.'}</p><Link className="button orange" href="/">{language==='fa'?'بازگشت به خانه':'Back to home'}</Link></main></>;}
