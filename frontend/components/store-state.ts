type CartItem={productId:string;quantity:number};
/** Browser storage can be stale or malformed; only accept usable cart rows. */
export function readSavedCart(raw:string|null):CartItem[]{
 try{const value:unknown=JSON.parse(raw||'[]');if(!Array.isArray(value))return [];const items=new Map<string,number>();for(const item of value){if(!item||typeof item.productId!=='string'||!item.productId||!Number.isSafeInteger(item.quantity)||item.quantity<1)continue;items.set(item.productId,Math.min(999,(items.get(item.productId)||0)+item.quantity))}return [...items].map(([productId,quantity])=>({productId,quantity}))}catch{return []}
}
export function readSavedProgress(raw:string|null,lessons:{title:string}[]):string[]{
 try{const value:unknown=JSON.parse(raw||'[]');if(!Array.isArray(value))return [];return [...new Set(value.filter((title):title is string=>typeof title==='string'&&lessons.some(lesson=>lesson.title===title)))]}catch{return []}
}
