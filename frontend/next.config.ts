import type { NextConfig } from 'next';
const config: NextConfig = {
  distDir:process.env.NEXT_DIST_DIR||'.next',
  async rewrites(){return process.env.VERCEL ? [] : [{source:'/api/:path*',destination:process.env.API_ORIGIN ? process.env.API_ORIGIN+'/api/:path*' : 'http://127.0.0.1:8080/api/:path*'}]},
};
export default config;
