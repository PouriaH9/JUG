import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'JUG — Find your flow',description:'Precision juggling balls for first throws and fearless performances. Premium equipment, practical courses, endless possibility.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
