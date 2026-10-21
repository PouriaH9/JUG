import catalog from './preview-catalog.json';
export const FRONTEND_ONLY=process.env.NEXT_PUBLIC_FRONTEND_ONLY==='true';
export const BASE_PATH=(process.env.NEXT_PUBLIC_BASE_PATH||'').replace(/\/$/,'');
export const previewCatalog=catalog;
export const PREVIEW_MESSAGE='Browse the collection and lessons. Shopping and accounts will be available soon.';
export function assetPath(path:string){return path.startsWith('/')&&!path.startsWith('//')&&!path.startsWith(BASE_PATH+'/')?BASE_PATH+path:path;}
export function pagePath(page:string){return BASE_PATH+(page==='home'?'/':'/'+(page==='admin'?'adminneda':page)+(FRONTEND_ONLY?'/':''));}
export function pageFromPath(path:string){const relative=BASE_PATH&&(path===BASE_PATH||path.startsWith(BASE_PATH+'/'))?path.slice(BASE_PATH.length):path;const page=relative.split('/').filter(Boolean)[0]||'home';return page==='adminneda'?'admin':page;}
export async function previewRequest(path:string,method='GET'){
 if(method!=='GET')throw new Error(PREVIEW_MESSAGE);
 if(path==='/products')return {products:catalog.products};
 if(path==='/courses')return {courses:catalog.courses};
 if(path==='/settings')return {settings:catalog.settings};
 const product=path.match(/^\/products\/([^/]+)$/);
 if(product){const item=catalog.products.find(p=>p.id===product[1]);if(item)return {product:item};}
 const course=path.match(/^\/courses\/([^/]+)$/);
 if(course){const item=catalog.courses.find(c=>c.id===course[1]);if(item)return {course:item};}
 if(/^\/products\/[^/]+\/reviews$/.test(path))return {reviews:[]};
 throw new Error(PREVIEW_MESSAGE);
}
