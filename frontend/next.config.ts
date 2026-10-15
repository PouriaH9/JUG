import type { NextConfig } from 'next';
const staticPreview=process.env.JUG_STATIC_PREVIEW==='true';
const config:NextConfig={
 distDir:process.env.NEXT_DIST_DIR||'.next',
 ...(staticPreview?{output:'export',trailingSlash:true,basePath:process.env.NEXT_PUBLIC_BASE_PATH||'/JUG',images:{unoptimized:true}}:{}),
 ...(!staticPreview?{async rewrites(){return process.env.VERCEL?[]:[{source:'/api/:path*',destination:(process.env.API_ORIGIN||'http://127.0.0.1:8080')+'/api/:path*'}]}}:{}),
};
export default config;
