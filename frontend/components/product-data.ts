import {translate,type Language} from './language';

export type Product={id:string;slug?:string;name:string;description:string;nameFa?:string;nameEn?:string;descriptionFa?:string;descriptionEn?:string;subtitleFa?:string;subtitleEn?:string;price:number;category:string;color:string;weight:number;stock:number;image?:string;images?:string[];featured?:boolean;rating?:number};
export const productName=(p:Product,language:Language)=>language==='fa'?(p.nameFa||translate(p.name,language)):(p.nameEn||p.name);
export const productDescription=(p:Product,language:Language)=>language==='fa'?(p.descriptionFa||translate(p.description,language)):(p.descriptionEn||p.description);
export const productSubtitle=(p:Product,language:Language)=>(language==='fa'?p.subtitleFa:p.subtitleEn)||translate(p.category==='set'?'A little rhythm. A lot of possibility.':'Find balance, one ball at a time.',language);
export const productImages=(p:Product)=>{const all=[...new Set([p.image,...(p.images||[])].filter((x):x is string=>!!x))];const cover=all.find(url=>!(/\.(mp4|webm)(?:[?#]|$)/i.test(url)));return cover?[cover,...all.filter(url=>url!==cover)]:all};
export const ballColor=(color:string)=>color?.startsWith('#')?color:color?.toLowerCase().includes('charcoal')?'#43483d':color?.toLowerCase().includes('ivory')?'#ded7c6':color?.toLowerCase().includes('green')?'#a4a68f':'#df5d26';
export const productMoney=(amount:number,language:Language)=>new Intl.NumberFormat(language==='fa'?'fa-IR':'en-US').format(amount)+(language==='fa'?' تومان':' toman');
