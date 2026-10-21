'use client';
import {useState} from 'react';
import {ArrowRight,Plus} from 'lucide-react';
import {motion} from 'framer-motion';
import ProductGallery,{isProductVideo,productThumbnail} from './product-gallery';
import {translate,type Language} from './language';
import {assetPath} from './preview-client';
import {type Product,productName,productDescription,productSubtitle,productImages,productMoney,ballColor} from './product-data';

export function ProductCard({product:p,language,index=0,onOpen,preview=false}:{product:Product;language:Language;index?:number;onOpen?:()=>void;preview?:boolean}){
 const t=(text:string)=>translate(text,language),name=productName(p,language),image=productImages(p).find(url=>!isProductVideo(url));
 const [failedImage,setFailedImage]=useState<string>();
 return <motion.article className="product-card" initial={false}><div className={'product-art art-'+index%3} onClick={onOpen} role={preview?undefined:'button'} tabIndex={preview?undefined:0} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onOpen?.()}}} aria-label={t('View ')+name}><span className="product-tag">{t(p.category==='set'?'THE COMPLETE SET':'SINGLE BALL')}</span>{(!image||failedImage===image)&&<div className={'balls '+(p.category==='set'?'three':'one')} style={{'--ball':ballColor(p.color)} as React.CSSProperties}><i/><i/><i/></div>}{image&&failedImage!==image&&<img key={image} className="product-custom-image" loading={index<2?'eager':'lazy'} decoding="async" src={assetPath(productThumbnail(image))} alt={name} onError={()=>setFailedImage(image)}/>}</div><div className="product-info"><div><button type="button" className="text-button product-name" onClick={onOpen}>{name}</button><p>{productSubtitle(p,language)}</p></div></div><span className="price">{productMoney(p.price,language)}</span><button type="button" className="product-details-button" onClick={onOpen}>{t('View details and buy')}<ArrowRight size={18} aria-hidden="true"/></button></motion.article>;
}

export function ProductDetails({product:p,language,onAdd,disabled=false,preview=false}:{product:Product;language:Language;onAdd?:()=>void;disabled?:boolean;preview?:boolean}){
 const t=(text:string)=>translate(text,language),name=productName(p,language);
 return <><ProductGallery key={p.id} name={name} images={productImages(p)} languageOverride={language}><div className={'balls '+(p.category==='set'?'three':'one')} style={{'--ball':ballColor(p.color)} as React.CSSProperties}><i/><i/><i/></div></ProductGallery><div className="product-detail-copy"><div className="eyebrow">{t('THE JUG COLLECTION /')} {t(p.category)}</div><h2>{name}</h2><p className="product-description">{productDescription(p,language)}</p><div className="detail-specs"><span>{p.weight}{t('g')}<br/><small>{t('Ball weight')}</small></span><span>{t(p.category==='set'?'3 balls':'1 ball')}<br/><small>{t('In the box')} 📦</small></span></div><h3>{productMoney(p.price,language)}</h3><button type="button" className="button orange full" disabled={disabled||preview||p.stock<1} onClick={onAdd}>{p.stock<1?(language==='fa'?'ناموجود':'Sold out'):t('Add to bag')} <Plus size={18}/></button></div></>;
}
