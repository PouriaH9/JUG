'use client';

import {createContext,useContext,useEffect,useState,useCallback} from 'react';
import persian from './fa.json';

export type Language='fa'|'en';
const dictionary:Record<string,string>=persian;
export function translate(text:string,language:Language):string {
 if(language==='en')return text;
 if(dictionary[text])return dictionary[text];
 const trimmed=text.trim();
 if(dictionary[trimmed])return text.replace(trimmed,dictionary[trimmed]);
 const paragraphs=text.replace(/\r\n/g,'\n').split('\n\n');
 if(paragraphs.length>1)return paragraphs.map(part=>translate(part,language)).join('\n\n');
 if(text.startsWith('Complete shipping address required: '))return 'لطفاً همهٔ بخش‌های نشانی ارسال را کامل کنید.';
 return text;
}
const LanguageContext=createContext({language:'fa' as Language,t:(text:string)=>translate(text,'fa'),toggleLanguage:()=>{}});

export function LanguageProvider({children,initialLanguage='fa'}:{children:React.ReactNode;initialLanguage?:Language}) {
 const [language,setLanguage]=useState<Language>(initialLanguage);
 useEffect(()=>{if(process.env.NEXT_PUBLIC_FRONTEND_ONLY!=='true')return;const saved=document.cookie.split('; ').find(value=>value.startsWith('jug-language='))?.split('=')[1];if(saved==='en'||saved==='fa')setLanguage(saved);},[]);
 useEffect(()=>{document.documentElement.lang=language;document.documentElement.dir=language==='fa'?'rtl':'ltr';document.title=language==='fa'?'جاگ — ریتم خودت را پیدا کن':'JUG — Find your flow';},[language]);
 const toggleLanguage=()=>{const next=language==='fa'?'en':'fa';document.cookie=`jug-language=${next};path=/;max-age=31536000;SameSite=Lax`;setLanguage(next);};
 const t=useCallback((text:string)=>translate(text,language),[language]);
 return <LanguageContext.Provider value={{language,t,toggleLanguage}}>{children}</LanguageContext.Provider>;
}
export const useLanguage=()=>useContext(LanguageContext);
function Flag({english}:{english:boolean}){return <svg aria-hidden="true" viewBox="0 0 60 40" width="24" height="16" className="language-flag">{english?<><path fill="#012169" d="M0 0h60v40H0z"/><path stroke="#fff" strokeWidth="8" d="m0 0 60 40M60 0 0 40"/><path stroke="#c8102e" strokeWidth="3" d="m0 0 60 40M60 0 0 40"/><path stroke="#fff" strokeWidth="13" d="M30 0v40M0 20h60"/><path stroke="#c8102e" strokeWidth="7" d="M30 0v40M0 20h60"/></>:<><path fill="#239f40" d="M0 0h60v14H0z"/><path fill="#fff" d="M0 14h60v12H0z"/><path fill="#da0000" d="M0 26h60v14H0z"/><path fill="none" stroke="#da0000" strokeWidth="1.5" d="M30 15v10m-4-9q-4 6 4 8m4-8q4 6-4 8m-2-8 2 2 2-2"/></>}</svg>;}
export function LanguageSwitch(){const {language,toggleLanguage}=useLanguage();return <button className="language-switch" onClick={toggleLanguage} aria-label={language==='fa'?'Switch to English':'تغییر زبان به فارسی'} title={language==='fa'?'English':'فارسی'}><Flag english={language==='fa'}/><span className="language-code">{language==='fa'?'EN':'فا'}</span></button>;}
