// Reconstruye el catálogo prerenderizado de index.html (para buscadores / sin JS) desde data/products.json
const fs=require("fs");
const P=JSON.parse(fs.readFileSync(__dirname+"/../data/products.json","utf8")).sort((a,b)=>a.sort-b.sort);
const CAT_ORDER=["Cuidado de la Piel","Maquillaje","Fragancias Femeninas","Fragancias Masculinas","Cuidado Corporal","Brochas y Accesorios"];
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>"$"+Number(n).toLocaleString("es-AR");
const wa=t=>`https://api.whatsapp.com/send?phone=5492615119576&amp;text=${encodeURIComponent(t)}`;
function thumb(p){const f=p.isNew?'<span class="flag new">¡Nuevo!</span>':(p.feat?'<span class="flag">Destacado</span>':'');
 if(p.img) return `<div class="thumb has-img"><img src="/${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">${f}</div>`;
 const i=(p.name.match(/[A-Za-zÁÉÍÓÚÑ]/)||["M"])[0].toUpperCase();
 return `<div class="thumb"><div class="thumb-fallback"><span class="mono">${esc(i)}</span><small>${esc(p.tag)}</small></div>${f}</div>`;}
function card(p){return `<article class="card" data-pid="${esc(p.id)}">${thumb(p)}<div class="card-body"><span class="tag">${esc(p.tag)}</span><h3>${esc(p.name)}</h3><p class="meta">${esc(p.meta)}</p>${p.tones?`<p class="tones">${esc(p.tones)}</p>`:''}<div class="price-row"><span class="price">${fmt(p.price)}</span>${p.note?`<span class="price-note">${esc(p.note)}</span>`:''}</div><div class="card-actions"><a class="add-btn" href="${wa(`¡Hola Nélida! Quería consultar por: ${p.name} (${fmt(p.price)}). ¿Está disponible?`)}" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a></div></div></article>`;}
let html="";
CAT_ORDER.forEach(c=>{const it=P.filter(p=>p.cat===c); if(!it.length) return;
 html+=`<section class="cat-block"><div class="cat-head"><h2>${esc(c)}</h2><span class="count">${it.length} productos</span><span class="rule"></span></div><div class="grid">${it.map(card).join("")}</div></section>\n`;});
let h=fs.readFileSync(__dirname+"/../index.html","utf8");
const a=h.indexOf('<main id="catalog">'), b=h.indexOf('</main>',a);
h=h.slice(0,a)+'<main id="catalog">'+html+h.slice(b);
fs.writeFileSync(__dirname+"/../index.html",h);
console.log("prerender ok", P.length);
