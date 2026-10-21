'use client';

import {createContext,useContext,useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import {useLanguage} from './language';

type Theme='dark'|'light';
const ThemeContext=createContext({theme:'dark' as Theme,toggle:()=>{}});
export function ThemeProvider({children,initialTheme}:{children:React.ReactNode;initialTheme:Theme}){
 const [theme,setTheme]=useState<Theme>(initialTheme);
 useEffect(()=>{
  if(process.env.NEXT_PUBLIC_FRONTEND_ONLY==='true'){
   const saved=document.cookie.split('; ').find(value=>value.startsWith('jug-theme='))?.split('=')[1];
   if(saved==='light'||saved==='dark')setTheme(saved);
  }
 },[]);
 useEffect(()=>{
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#ffffff':'#17120f');
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content',theme);
 },[theme]);
 const toggle=()=>{const next=theme==='dark'?'light':'dark';document.cookie=`jug-theme=${next};path=/;max-age=31536000;SameSite=Lax`;setTheme(next)};
 return <ThemeContext.Provider value={{theme,toggle}}>{children}</ThemeContext.Provider>;
}
export function ThemeToggle(){
 const {theme,toggle}=useContext(ThemeContext),{language}=useLanguage();
 const label=theme==='dark'?(language==='fa'?'حالت روشن':'Light mode'):(language==='fa'?'حالت تاریک':'Dark mode');
 return <button type="button" onClick={toggle} aria-label={label}>{theme==='dark'?<Sun size={19} aria-hidden="true"/>:<Moon size={19} aria-hidden="true"/>}{label}</button>;
}
