import Store from '@/components/store';
import {notFound} from 'next/navigation';
const sections=['shop','learn','account','admin','wishlist','checkout'];
export function generateStaticParams(){return sections.map(section=>({section}))}
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!sections.includes(section))notFound();return <Store initialPage={section}/>}
