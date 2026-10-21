import Store from '@/components/store';
import type { Metadata } from 'next';
export const metadata:Metadata={alternates:{canonical:'/'}};
export default function Page(){return <Store/>}
