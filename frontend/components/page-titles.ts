export function pageTitle(section: string, language: 'fa' | 'en'): string {
  const titles: Record<string, [string, string]> = {
    shop: ['مجموعه توپ‌های جاگلینگ', 'Juggling ball collection'],
    learn: ['آموزش جاگلینگ', 'Learn to juggle'],
    account: ['حساب کاربری', 'Your account'],
    wishlist: ['علاقه‌مندی‌ها', 'Your wishlist'],
    checkout: ['تکمیل سفارش', 'Checkout'],
    admin: ['مدیریت فروشگاه', 'Store administration'],
  };
  const title = titles[section];
  return title ? `${title[language === 'fa' ? 0 : 1]} | ${language === 'fa' ? 'جاگ' : 'JUG'}` : language === 'fa' ? 'جاگ — توپ های جاگلنیگ حرفه ای' : 'JUG — Find your flow';
}
