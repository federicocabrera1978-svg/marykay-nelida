/* Catálogo Mary Kay · Nélida — lógica pública (sin claves de escritura: solo la clave publicable de Supabase, protegida por RLS) */
(function(){
"use strict";
/* ====== CONFIGURACIÓN ====== */
const WA_NUMBER = "5492615119576"; // +54 9 261 511-9576  (Nélida)
const SELLER = "Nélida";
const SB_URL = "https://xdvzbxgmfwbwllocmhui.supabase.co";
const SB_KEY = "sb_publishable_FdznLUqqhXXYB_GlnRW5DA_WdVj0BvY";
const CAT_ORDER = ["Cuidado de la Piel","Maquillaje","Fragancias Femeninas","Fragancias Masculinas","Cuidado Corporal","Brochas y Accesorios"];
const NEW_CHIP = "Novedades";

/* ====== UTILIDADES ====== */
const fmt = n => "$" + Number(n).toLocaleString("es-AR");
// api.whatsapp.com conserva los emojis (wa.me los rompía al redirigir)
const waBase = txt => `https://api.whatsapp.com/send?phone=${WA_NUMBER}&text=${encodeURIComponent(txt)}`;
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);

let PRODUCTS = [];
const cart = {}; // {id: qty}
const byId = id => PRODUCTS.find(p=>p.id===id);
const soldOut = p => p.stock === 0;

/* ====== ESTADÍSTICAS ANÓNIMAS ====== */
const OPT_KEY="mk_no_stats", VID_KEY="mk_vid";
function statsOn(){ try{ return localStorage.getItem(OPT_KEY)!=="1"; }catch(e){ return false; } }
function visitorId(){
  try{
    let v=localStorage.getItem(VID_KEY);
    if(!v){ v=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36)).toLowerCase(); localStorage.setItem(VID_KEY,v); }
    return v;
  }catch(e){ return null; }
}
function track(kind, productId){
  if(!statsOn()) return;
  const vid=visitorId(); if(!vid) return;
  const body={visitor_id:vid,kind};
  if(productId) body.product_id=productId;
  fetch(SB_URL+"/rest/v1/events",{method:"POST",keepalive:true,headers:{apikey:SB_KEY,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(body)}).catch(()=>{});
}
const seenThisSession=new Set();
let viewObserver=null, viewTimers=new Map();
function observeViews(){
  if(!("IntersectionObserver" in window)) return;
  if(viewObserver) viewObserver.disconnect();
  viewObserver=new IntersectionObserver(entries=>{
    entries.forEach(en=>{
      const id=en.target.dataset.pid;
      if(en.isIntersecting && en.intersectionRatio>=0.6){
        if(seenThisSession.has(id)||viewTimers.has(id)) return;
        viewTimers.set(id,setTimeout(()=>{ seenThisSession.add(id); viewTimers.delete(id); track("product_view",id); },1500));
      } else if(viewTimers.has(id)){ clearTimeout(viewTimers.get(id)); viewTimers.delete(id); }
    });
  },{threshold:[0,0.6]});
  document.querySelectorAll("#catalog [data-pid]").forEach(el=>viewObserver.observe(el));
}

/* ====== WHATSAPP GENERAL ====== */
const generalMsg = `¡Hola ${SELLER}! Te escribo desde tu catálogo online de Mary Kay. Quería hacerte una consulta 😊`;
["topWa","floatWa","footWa"].forEach(id=>{const el=$(id); if(el) el.href = waBase(generalMsg);});

/* ====== CHIPS ====== */
const chipsEl=$("chips"); let activeCat="Todos";
function buildChips(){
  chipsEl.innerHTML="";
  const cats=["Todos", ...(PRODUCTS.some(p=>p.is_new)?[NEW_CHIP]:[]), ...CAT_ORDER];
  cats.forEach(c=>{
    const b=document.createElement("button");
    b.className="chip"+(c===activeCat?" active":"");
    b.textContent=c;
    b.addEventListener("click",()=>{activeCat=c;[...chipsEl.children].forEach(x=>x.classList.toggle("active",x.textContent===c));render();});
    chipsEl.appendChild(b);
  });
  const footCats=$("footCats"); footCats.innerHTML="";
  CAT_ORDER.forEach(c=>{const a=document.createElement("a");a.textContent=c;a.href="#catalogo";a.addEventListener("click",()=>{activeCat=c;[...chipsEl.children].forEach(x=>x.classList.toggle("active",x.textContent===c));render();});footCats.appendChild(a);});
}

/* ====== RENDER ====== */
const catalogEl=$("catalog"), searchEl=$("search");
searchEl.addEventListener("input", render);
function thumb(p){
  const flags=(p.is_new?'<span class="flag new">¡Nuevo!</span>':(p.feat?'<span class="flag">Destacado</span>':''))+(soldOut(p)?'<span class="flag out">Sin stock</span>':'');
  if(p.img) return `<div class="thumb has-img"><img src="/${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">${flags}</div>`;
  const initial=(p.name.match(/[A-Za-zÁÉÍÓÚÑ]/)||["M"])[0].toUpperCase();
  return `<div class="thumb"><div class="thumb-fallback"><span class="mono">${esc(initial)}</span><small>${esc(p.tag)}</small></div>${flags}</div>`;
}
function card(p){
  const out=soldOut(p);
  const askTxt = out ? `¡Hola ${SELLER}! Vi que ${p.name} figura sin stock. ¿Me avisás cuando vuelva a entrar?`
                     : `¡Hola ${SELLER}! Quería consultar por: ${p.name} (${fmt(p.price)}). ¿Está disponible?`;
  return `<article class="card${out?' is-out':''}" data-pid="${esc(p.id)}">
    ${thumb(p)}
    <div class="card-body">
      <span class="tag">${esc(p.tag)}</span>
      <h3>${esc(p.name)}</h3>
      <p class="meta">${esc(p.meta)}</p>
      ${p.tones?`<p class="tones">${esc(p.tones)}</p>`:''}
      <div class="price-row">
        <span class="price">${fmt(p.price)}</span>
        ${p.note?`<span class="price-note">${esc(p.note)}</span>`:''}
      </div>
      <div class="card-actions">
        ${out?`<button class="add-btn" disabled>Sin stock</button>`:`<button class="add-btn" data-add="${esc(p.id)}">＋ Agregar al pedido</button>`}
        <a class="ask-btn" target="_blank" rel="noopener noreferrer" href="${waBase(askTxt)}" title="${out?'Consultar cuándo vuelve':'Consultar este producto'}">
          <svg viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24z"/></svg>
        </a>
      </div>
    </div>
  </article>`;
}
function render(){
  const q=searchEl.value.trim().toLowerCase();
  const visible=PRODUCTS
    .filter(p=> activeCat==="Todos" || (activeCat===NEW_CHIP ? p.is_new : p.cat===activeCat))
    .filter(p=> !q || (p.name+" "+p.tag+" "+p.meta+" "+(p.tones||"")+" "+p.cat).toLowerCase().includes(q));
  if(!visible.length){ catalogEl.innerHTML=`<p class="no-results">No encontramos productos con esa búsqueda 🌸</p>`; return; }
  let html="";
  const groups = activeCat===NEW_CHIP ? [NEW_CHIP] : (activeCat==="Todos"?CAT_ORDER:[activeCat]);
  groups.forEach(cat=>{
    const items = cat===NEW_CHIP ? visible : visible.filter(p=>p.cat===cat);
    if(!items.length) return;
    html+=`<section class="cat-block"><div class="cat-head"><h2>${esc(cat)}</h2><span class="count">${items.length} productos</span><span class="rule"></span></div><div class="grid">${items.map(card).join("")}</div></section>`;
  });
  catalogEl.innerHTML=html;
  catalogEl.querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",()=>{
    const id=btn.dataset.add; cart[id]=(cart[id]||0)+1;
    btn.textContent="✓ Agregado"; btn.classList.add("added");
    setTimeout(()=>{btn.textContent="＋ Agregar al pedido";btn.classList.remove("added");},1100);
    track("add_to_cart",id); updateCart();
  }));
  observeViews();
}

/* ====== CARRITO ====== */
const fab=$("orderFab"), badge=$("fabBadge"), overlay=$("overlay"), drawer=$("drawer"), drawerBody=$("drawerBody"), totalEl=$("total");
const cartCount=()=>Object.values(cart).reduce((a,b)=>a+b,0);
const cartTotal=()=>Object.entries(cart).reduce((s,[i,q])=>s+(byId(i)?byId(i).price*q:0),0);
function updateCart(){
  Object.keys(cart).forEach(i=>{ if(!byId(i)) delete cart[i]; });
  const count=cartCount(); badge.textContent=count; fab.classList.toggle("show",count>0); totalEl.textContent=fmt(cartTotal());
  if(!count){ drawerBody.innerHTML=`<p class="empty-cart">Todavía no agregaste productos.<br>Explorá el catálogo y sumá tus favoritos 🌸</p>`; return; }
  drawerBody.innerHTML=Object.entries(cart).map(([i,q])=>{const p=byId(i); return `<div class="line-item">
      <div class="li-info"><h4>${esc(p.name)}</h4><p class="li-meta">${esc(p.tag)} · ${esc(p.meta)}</p>
        <div class="li-controls"><button class="qty-btn" data-dec="${esc(i)}">−</button><span class="qty-num">${q}</span><button class="qty-btn" data-inc="${esc(i)}">＋</button></div></div>
      <div class="li-right"><span class="li-price">${fmt(p.price*q)}</span><button class="li-remove" data-rm="${esc(i)}">quitar</button></div></div>`;}).join("");
  drawerBody.querySelectorAll("[data-inc]").forEach(b=>b.addEventListener("click",()=>{cart[b.dataset.inc]++;updateCart();}));
  drawerBody.querySelectorAll("[data-dec]").forEach(b=>b.addEventListener("click",()=>{const i=b.dataset.dec;cart[i]--;if(cart[i]<=0)delete cart[i];updateCart();}));
  drawerBody.querySelectorAll("[data-rm]").forEach(b=>b.addEventListener("click",()=>{delete cart[b.dataset.rm];updateCart();}));
}
const openDrawer=()=>{overlay.classList.add("show");drawer.classList.add("show");};
const closeDrawer=()=>{overlay.classList.remove("show");drawer.classList.remove("show");};
fab.addEventListener("click",openDrawer); overlay.addEventListener("click",closeDrawer); $("closeDrawer").addEventListener("click",closeDrawer);
$("sendOrder").addEventListener("click",()=>{
  if(!cartCount()){alert("Agregá al menos un producto a tu pedido 🌸");return;}
  let msg=`¡Hola ${SELLER}! 🌸 Quiero hacer este pedido desde tu catálogo Mary Kay:\n\n`;
  Object.entries(cart).forEach(([i,q])=>{const p=byId(i); msg+=`• ${q} × ${p.name} (${p.meta}) — ${fmt(p.price*q)}\n`;});
  msg+=`\nTotal estimado: ${fmt(cartTotal())}\n\n¿Me confirmás disponibilidad y cómo coordinamos el pago y la entrega? ¡Gracias!`;
  track("order_sent"); window.open(waBase(msg),"_blank","noopener");
});

/* ====== AVISO DE PRIVACIDAD ====== */
const optBtn=$("statsOptOut");
function paintOpt(){ if(optBtn) optBtn.textContent = statsOn() ? "No registrar mis visitas" : "Volver a permitir estadísticas"; }
if(optBtn){ optBtn.addEventListener("click",()=>{ try{ if(statsOn()){localStorage.setItem(OPT_KEY,"1");localStorage.removeItem(VID_KEY);} else localStorage.removeItem(OPT_KEY);}catch(e){} paintOpt(); }); paintOpt(); }

/* ====== CARGA DE DATOS ====== */
function normalize(list){ return list.map(p=>({id:p.id,cat:p.cat,tag:p.tag||"",name:p.name,meta:p.meta||"",price:p.price,stock:(p.stock===undefined?null:p.stock),tones:p.tones||"",note:p.note||"",feat:!!p.feat,is_new:!!(p.is_new||p.isNew),img:p.img||"",sort:p.sort||0})).sort((a,b)=>a.sort-b.sort); }
async function load(){
  try{
    const r=await fetch(SB_URL+"/rest/v1/products?select=id,cat,tag,name,meta,price,stock,tones,note,feat,is_new,img,sort&active=eq.true&order=sort.asc",{headers:{apikey:SB_KEY}});
    if(!r.ok) throw new Error(r.status);
    const d=await r.json(); if(!Array.isArray(d)||!d.length) throw new Error("vacío");
    PRODUCTS=normalize(d);
  }catch(e){
    try{ const r=await fetch("/data/products.json"); PRODUCTS=normalize(await r.json()); }catch(e2){ PRODUCTS=[]; }
  }
  buildChips(); render(); updateCart();
}
try{ if(!sessionStorage.getItem("mk_visit")){ sessionStorage.setItem("mk_visit","1"); track("visit"); } }catch(e){}
load();
})();
