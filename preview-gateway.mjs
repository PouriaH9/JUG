import http from 'node:http';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';

const config = JSON.parse(readFileSync(process.env.JUG_PREVIEW_CONFIG, 'utf8'));
const passwordHash = createHash('sha256').update(config.password).digest();
const sessions = new Map();
const attempts = new Map();
const secure = process.env.JUG_PREVIEW_LOCAL_TEST !== 'true';
const ttl = 12 * 60 * 60 * 1000;
const cookieName = 'jug_preview_access';
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function send(res, status, body, type='text/html; charset=utf-8') {
  res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
  res.end(body);
}
function form(res, error='') {
  send(res, 200, `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JUG private preview</title><style>body{margin:0;background:#22231f;color:#f4f2eb;font:16px Arial,sans-serif;min-height:100dvh;display:grid;place-items:center}main{width:min(330px,80vw);padding:35px}h1{font-size:72px;letter-spacing:-6px;margin:0 0 25px;color:#ed682c}p{line-height:1.6;color:#cbcbbf}input,button{box-sizing:border-box;width:100%;padding:16px;margin-top:12px;font:inherit;border:1px solid #5c5e50;border-radius:2px}input{background:#30322a;color:white}button{background:#ed682c;color:white;border:0;cursor:pointer}.error{color:#ffb291}</style><main><h1>JUG.</h1><p>A private first look.<br>Enter the preview password to explore.</p><form method="post" action="/preview-login"><label for="password">Preview password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="100"><button>Open JUG</button></form>${error?`<p class="error" role="alert">${escapeHtml(error)}</p>`:''}<p style="font-size:12px">Test storefront · no real payments</p></main></html>`);
}
function session(req) {
  const value=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!value)return false;
  const key=createHash('sha256').update(value).digest('hex');
  const expires=sessions.get(key);
  if(!expires||expires<Date.now()){sessions.delete(key);return false}
  return true;
}
function sameOrigin(req) {
  if(!req.headers.origin)return true;
  try{
    const origin=new URL(req.headers.origin);
    const expected=JSON.parse(readFileSync(process.env.JUG_PREVIEW_CONFIG,'utf8')).publicHostname;
    return origin.host===req.headers.host || (origin.protocol==='https:'&&origin.host===expected);
  }catch{return false}
}
function proxy(req,res,port) {
  const headers={...req.headers};
  const upstreamHost='127.0.0.1:'+port;
  headers.host=upstreamHost;
  delete headers.origin;
  delete headers['x-forwarded-host'];
  delete headers['x-forwarded-for'];
  delete headers['cf-connecting-ip'];
  delete headers['cf-ray'];
  headers.cookie=(headers.cookie||'').split(';').filter(v=>!v.trim().startsWith(cookieName+'=')).join(';');
  const upstream=http.request({hostname:'127.0.0.1',port,path:req.url,method:req.method,headers},reply=>{
    res.writeHead(reply.statusCode,{...reply.headers,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
    reply.pipe(res);
  });
  upstream.setTimeout(30000,()=>upstream.destroy());
  upstream.on('error',()=>{if(!res.headersSent)send(res,502,'JUG is temporarily unavailable. Please try again.','text/plain; charset=utf-8');else res.destroy()});
  req.pipe(upstream);
}

const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD','POST','PUT','DELETE','OPTIONS'].includes(req.method))return send(res,405,'Method not allowed','text/plain');
  const path=new URL(req.url,'http://localhost').pathname;
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!sameOrigin(req))return send(res,403,'Cross-origin request rejected','text/plain');
  if(path==='/preview-login') {
    if(req.method==='GET')return form(res);
    if(req.method!=='POST')return send(res,405,'Method not allowed','text/plain');
    const ip=req.headers['cf-connecting-ip']||req.socket.remoteAddress;
    let attempt=attempts.get(ip);
    if(!attempt||attempt.until<Date.now())attempt={count:0,until:Date.now()+15*60000};
    attempts.set(ip,attempt);
    if(attempt.count>=8)return send(res,429,'Too many attempts. Try again in 15 minutes.','text/plain');
    let body='';
    try{for await(const chunk of req){body+=chunk;if(body.length>1024)return send(res,413,'Request too large','text/plain')}}catch{return}
    const submitted=new URLSearchParams(body).get('password')||'';
    const hash=createHash('sha256').update(submitted).digest();
    if(!timingSafeEqual(hash,passwordHash)){attempt.count++;return form(res,'That password did not match. Please try again.')}
    attempts.delete(ip);
    const token=randomBytes(32).toString('hex');
    sessions.set(createHash('sha256').update(token).digest('hex'),Date.now()+ttl);
    res.writeHead(303,{'Location':'/','Cache-Control':'no-store','Set-Cookie':`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttl/1000}${secure?'; Secure':''}`});
    return res.end();
  }
  if(!session(req)) {
    if(path.startsWith('/api/'))return send(res,401,JSON.stringify({error:'Preview access required'}),'application/json');
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,401,'Preview access required','text/plain');
    res.writeHead(303,{'Location':'/preview-login','Cache-Control':'no-store'});return res.end();
  }
  if(path.startsWith('/_next/webpack-hmr')||path.startsWith('/__nextjs'))return send(res,404,'Not found','text/plain');
  proxy(req,res,path.startsWith('/api/')?8080:3002);
});
server.requestTimeout=30000;
server.headersTimeout=10000;
server.listen(3001,'127.0.0.1',()=>console.log('JUG protected preview gateway ready on 127.0.0.1:3001'));
const cleanup=setInterval(()=>{const now=Date.now();for(const [k,v]of sessions)if(v<now)sessions.delete(k);for(const [k,v]of attempts)if(v.until<now)attempts.delete(k)},60000);cleanup.unref();
