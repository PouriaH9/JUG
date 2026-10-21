import Store from '@/components/store';
import {notFound} from 'next/navigation';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { pageTitle } from '@/components/page-titles';
const sections=['shop','learn','account','adminneda','wishlist','checkout'];
export async function generateMetadata({params}:{params:Promise<{section:string}>}):Promise<Metadata>{
 const {section}=await params;
 if(!sections.includes(section))return {title:'404 | JUG',robots:{index:false,follow:false}};
 const language=process.env.JUG_STATIC_PREVIEW!=='true'&&(await cookies()).get('jug-language')?.value==='en'?'en':'fa';
 return {title:pageTitle(section==='adminneda'?'admin':section,language),alternates:{canonical:`/${section}`},...(!['shop','learn'].includes(section)?{robots:{index:false,follow:false}}:{})};
}
export function generateStaticParams(){return sections.map(section=>({section}))}
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!sections.includes(section))notFound();return <Store initialPage={section==='adminneda'?'admin':section}/>}
