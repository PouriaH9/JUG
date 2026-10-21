export function normalizeContactPhone(value:string){
 return value.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[\s()-]/g,'');
}

export function validateContact(phone:string,city:string,fa:boolean){
 const errors:{phone?:string;city?:string}={};
 if(!phone.trim())errors.phone=fa?'شماره تماس را وارد کنید.':'Enter your phone number.';
 else if(!/^\+?[0-9]{8,15}$/.test(normalizeContactPhone(phone)))errors.phone=fa?'شماره تماس باید ۸ تا ۱۵ رقم باشد؛ فقط ارقام و علامت + در ابتدای شماره مجاز است.':'Use 8–15 digits, with an optional + at the start.';
 const length=Array.from(city.trim()).length;
 if(!length)errors.city=fa?'نام شهر را وارد کنید.':'Enter your city.';
 else if(length<2||length>100)errors.city=fa?'نام شهر باید بین ۲ تا ۱۰۰ نویسه باشد.':'City must contain 2–100 characters.';
 return errors;
}

export function contactFailure(error:unknown,fa:boolean){
 const {status,message}=error as {status?:number;message?:string} || {};
 const say=(persian:string,english:string)=>fa?persian:english;
 if(message==='Preview unavailable')return say('ثبت سفارش در نسخهٔ نمایشی فعال نیست.','Order submission is unavailable in preview mode.');
 if(message==='Empty cart')return say('سبد خرید خالی است. ابتدا محصولی اضافه کنید.','Your bag is empty. Add a product first.');
 if(status===429)return say('تعداد درخواست‌ها زیاد است. کمی صبر کنید و دوباره تلاش کنید.','Too many requests. Wait a little and try again.');
 if(status&&status>=500)return say('سرویس ثبت سفارش موقتاً در دسترس نیست. اطلاعات شما حفظ شده؛ کمی بعد دوباره تلاش کنید.','The order service is temporarily unavailable. Your details are preserved; try again shortly.');
 if(message==='Enter a valid phone number and city')return say('شماره تماس یا نام شهر معتبر نیست. شماره باید ۸ تا ۱۵ رقم و نام شهر ۲ تا ۱۰۰ نویسه باشد.','Invalid phone or city. Use 8–15 phone digits and 2–100 characters for the city.');
 if(message==='Product unavailable or insufficient stock')return say('یکی از محصولات موجود نیست یا موجودی کافی ندارد. سبد خرید را بررسی کنید.','A product is unavailable or has insufficient stock. Review your bag.');
 if(message==='Invalid quantity'||message==='Cart must contain 1–50 items')return say('تعداد محصولات سبد معتبر نیست. سبد خرید را بررسی کنید.','The bag contains an invalid quantity or number of products. Review your bag.');
 if(message==='Invalid submission reference')return say('شناسهٔ درخواست معتبر نیست. فرم را ببندید و دوباره از سبد خرید باز کنید.','The submission reference is invalid. Close this form and reopen it from your bag.');
 if(status===401||status===403)return say('دسترسی به ثبت سفارش تأیید نشد. صفحه را تازه کنید و دوباره تلاش کنید.','Order submission access was denied. Refresh the page and try again.');
 if(error instanceof TypeError)return say('ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی و دوباره تلاش کنید.','Could not connect to the server. Check your connection and try again.');
 return say('ثبت سفارش تأیید نشد. اطلاعات شما حفظ شده؛ دوباره تلاش کنید.','Order submission could not be confirmed. Your details are preserved; try again.');
}
