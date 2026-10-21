'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/language';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { language } = useLanguage();
  const persian = language === 'fa';
  return <main id="main-content" className="section-wrap recovery-page">
    <p className="eyebrow">JUG</p>
    <h1>{persian ? 'مشکلی در نمایش صفحه پیش آمد' : 'This page needs another try'}</h1>
    <p>{persian ? 'دوباره تلاش کن یا به صفحهٔ اصلی برگرد.' : 'Please try again, or return to the home page.'}</p>
    <div className="recovery-actions">
      <button className="button orange" onClick={reset}>{persian ? 'تلاش دوباره' : 'Try again'}</button>
      <Link className="button dark" href="/">{persian ? 'صفحهٔ اصلی' : 'Back to home'}</Link>
    </div>
  </main>;
}
