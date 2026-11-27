/* Panel de Nélida — usa Supabase Auth (email + contraseña) y la API REST. Toda la seguridad la hace RLS en la base. */
(function(){
"use strict";
const SB_URL="https://xdvzbxgmfwbwllocmhui.supabase.co";
const SB_KEY="sb_publishable_FdznLUqqhXXYB_GlnRW5DA_WdVj0BvY";
const SESSION_KEY="mk_admin_session";
const LOGIN_DOMAIN="marykay-nelida.vercel.app";
const toEmail=u=>{u=String(u||"").trim().toLowerCase();return u.includes("@")?u:u+"@"+LOGIN_DOMAIN;};
let currentEmail="";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>"$"+Number(n||0).toLocaleString("es-AR",{maximumFractionDigits:0});
const toast=t=>{const el=$("toast");el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);};
const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
const fdate=s=>s?new Date(s).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"}):"";
const fday=s=>s?s.split("-").reverse().join("/"):"";

/* ====== SESIÓN ====== */
let session=null;
function saveSession(d){ session={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Date.now()+(d.expires_in||3600)*1000}; localStorage.setItem(SESSION_KEY,JSON.stringify(session)); }
function loadSession(){ try{ session=JSON.parse(localStorage.getItem(SESSION_KEY)||"null"); }catch(e){ session=null; } }
function clearSession(){ session=null; localStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY+"_u"); }
async function auth(grant,body){
  const r=await fetch(`${SB_URL}/auth/v1/token?grant_type=${grant}`,{method:"POST",headers:{apikey:SB_KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.access_token) throw new Error(d.error_description||d.msg||"No se pudo entrar");
  saveSession(d); return d;
}
async function token(){
  if(!session) throw new Error("sin sesión");
  if(Date.now()>session.expires_at-60000){ await auth("refresh_token",{refresh_token:session.refresh_token}); }
  return session.access_token;
}
async function api(path,opts={}){
  const t=await token();
  const r=await fetch(SB_URL+"/rest/v1/"+path,{...opts,headers:{apikey:SB_KEY,Authorization:"Bearer "+t,"Content-Type":"application/json",...(opts.headers||{})}});
  if(r.status===401){ clearSession(); showLogin("Tu sesión venció. Entrá de nuevo."); throw new Error("401"); }
  if(!r.ok){ const d=await r.json().catch(()=>({})); throw new Error(d.message||("Error "+r.status)); }
  return r.status===204?null:r.json().catch(()=>null);
}
const rpc=(fn,args)=>api("rpc/"+fn,{method:"POST",body:JSON.stringify(args||{})});

function showLogin(msg){ $("loginView").classList.remove("hidden"); $("appView").classList.add("hidden"); $("logoutBtn").classList.add("hidden"); $("pwBtn").classList.add("hidden"); $("pwView").classList.add("hidden"); $("loginMsg").textContent=msg||""; $("loginMsg").className="msg err"; }
async function showApp(){
  const ok=await rpc("is_admin").catch(()=>false);
  if(ok!==true){ clearSession(); showLogin("Esta cuenta no tiene permiso de administración."); return; }
  $("loginView").classList.add("hidden"); $("appView").classList.remove("hidden"); $("logoutBtn").classList.remove("hidden"); $("pwBtn").classList.remove("hidden");
  loadProducts(); loadMembers();
}
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); $("loginMsg").textContent="Entrando…"; $("loginMsg").className="msg";
  try{ currentEmail=toEmail($("loginEmail").value); localStorage.setItem(SESSION_KEY+"_u",currentEmail); await auth("password",{email:currentEmail,password:$("loginPass").value}); $("loginPass").value=""; await showApp(); }
  catch(err){ $("loginMsg").textContent="Usuario o contraseña incorrectos."; $("loginMsg").className="msg err"; }
});
$("logoutBtn").addEventListener("click",async()=>{ try{ const t=await token(); await fetch(SB_URL+"/auth/v1/logout",{method:"POST",headers:{apikey:SB_KEY,Authorization:"Bearer "+t}}); }catch(e){} clearSession(); showLogin(""); });


/* ====== CAMBIAR CONTRASEÑA ====== */
function pwShow(on){ $("pwView").classList.toggle("hidden",!on); $("appView").classList.toggle("hidden",on); $("pwMsg").textContent=""; if(on){ $("pwForm").reset(); $("pwUser").value=currentEmail||localStorage.getItem(SESSION_KEY+"_u")||""; $("pwOld").focus(); } }
$("pwBtn").addEventListener("click",()=>pwShow(true));
$("pwCancel").addEventListener("click",()=>pwShow(false));
$("pwForm").addEventListener("submit",async e=>{
  e.preventDefault(); const m=$("pwMsg"); m.className="msg";
  const n1=$("pwNew").value, n2=$("pwNew2").value;
  if(n1.length<8){ m.textContent="La contraseña nueva tiene que tener al menos 8 caracteres."; m.className="msg err"; return; }
  if(n1!==n2){ m.textContent="Las dos contraseñas nuevas no coinciden."; m.className="msg err"; return; }
  const email=currentEmail||localStorage.getItem(SESSION_KEY+"_u")||"";
  m.textContent="Guardando…";
  try{ await auth("password",{email,password:$("pwOld").value}); }
  catch(err){ m.textContent="La contraseña actual no es correcta."; m.className="msg err"; return; }
  try{
    const t=await token();
    const r=await fetch(SB_URL+"/auth/v1/user",{method:"PUT",headers:{apikey:SB_KEY,Authorization:"Bearer "+t,"Content-Type":"application/json"},body:JSON.stringify({password:n1})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.msg||d.error_description||d.message||("Error "+r.status));
    $("pwForm").reset(); pwShow(false); toast("Listo: contraseña cambiada ✅");
  }catch(err){ m.textContent="No se pudo cambiar: "+err.message; m.className="msg err"; }
});

/* ====== PESTAÑAS ====== */
$("tabs").addEventListener("click",e=>{
  const b=e.target.closest("button[data-tab]"); if(!b) return;
  if(Object.keys(changes).length && b.dataset.tab!=="productos" && !confirm("Tenés cambios de productos sin guardar. ¿Seguir igual?")) return;
  [...$("tabs").children].forEach(x=>x.classList.toggle("active",x===b));
  document.querySelectorAll(".tab").forEach(s=>s.classList.toggle("hidden",s.id!=="tab-"+b.dataset.tab));
  if(b.dataset.tab==="estadisticas") loadStats();
  if(b.dataset.tab==="ventas") loadSales();
  if(b.dataset.tab==="red") loadMembers();
});

/* ====== PRODUCTOS ====== */
let products=[], changes={};
async function loadProducts(){
  products=await api("products?select=id,cat,tag,name,meta,price,stock,active,sort&order=sort.asc");
  const cats=[...new Set(products.map(p=>p.cat))];
  $("pCat").innerHTML='<option value="">Todas las categorías</option>'+cats.map(c=>`<option>${esc(c)}</option>`).join("");
  changes={}; renderProducts(); paintSave();
}
function current(p){ return {...p,...(changes[p.id]||{})}; }
function renderProducts(){
  const q=$("pSearch").value.trim().toLowerCase(), cat=$("pCat").value, onlyOut=$("pOnlyOut").checked;
  let lastCat=null, html="";
  products.map(current).filter(p=>(!cat||p.cat===cat)&&(!q||(p.name+" "+p.tag).toLowerCase().includes(q))&&(!onlyOut||p.stock===0)).forEach(p=>{
    if(p.cat!==lastCat){ html+=`<h3 class="cathead">${esc(p.cat)}</h3>`; lastCat=p.cat; }
    html+=`<div class="prow${changes[p.id]?' changed':''}${p.stock===0?' out':''}" data-id="${esc(p.id)}">
      <div class="pname"><b>${esc(p.name)}</b><small>${esc(p.tag)}${p.meta?' · '+esc(p.meta):''}</small></div>
      <label><span class="lbl">Precio $</span><input type="number" min="0" step="1" inputmode="numeric" data-f="price" value="${p.price}"></label>
      <label><span class="lbl">Stock</span><input type="number" min="0" step="1" inputmode="numeric" data-f="stock" value="${p.stock==null?'':p.stock}" placeholder="—"></label>
      <button type="button" class="outbtn" data-out="1">${p.stock===0?'Hay stock':'Sin stock'}</button>
    </div>`;
  });
  $("pList").innerHTML=html||'<p class="muted">No hay productos con ese filtro.</p>';
}
function setChange(id,field,val){
  const orig=products.find(p=>p.id===id); const c=changes[id]||{};
  if(val===orig[field]) delete c[field]; else c[field]=val;
  if(Object.keys(c).length) changes[id]=c; else delete changes[id];
  const row=document.querySelector(`.prow[data-id="${CSS.escape(id)}"]`);
  if(row){ row.classList.toggle("changed",!!changes[id]); const cur=current(orig); row.classList.toggle("out",cur.stock===0); row.querySelector("[data-out]").textContent=cur.stock===0?"Hay stock":"Sin stock"; }
  paintSave();
}
$("pList").addEventListener("input",e=>{
  const inp=e.target.closest("input[data-f]"); if(!inp) return;
  const id=inp.closest(".prow").dataset.id, f=inp.dataset.f, raw=inp.value.trim();
  if(f==="price"){ const v=parseInt(raw,10); if(isNaN(v)||v<0) return; setChange(id,"price",v); }
  else { setChange(id,"stock", raw===""?null:Math.max(0,parseInt(raw,10)||0)); }
});
$("pList").addEventListener("click",e=>{
  const b=e.target.closest("[data-out]"); if(!b) return;
  const row=b.closest(".prow"), id=row.dataset.id, cur=current(products.find(p=>p.id===id));
  const nv = cur.stock===0 ? null : 0;
  row.querySelector('input[data-f="stock"]').value = nv==null?"":nv;
  setChange(id,"stock",nv);
});
["pSearch","pCat","pOnlyOut"].forEach(id=>$(id).addEventListener("input",renderProducts));
function paintSave(){ const n=Object.keys(changes).length; $("saveInfo").textContent=n?`${n} producto${n>1?'s':''} con cambios sin guardar`:"Sin cambios"; $("saveBtn").disabled=!n; }
$("saveBtn").addEventListener("click",async()=>{
  const ids=Object.keys(changes); if(!ids.length) return;
  $("saveBtn").disabled=true; $("saveInfo").textContent="Guardando…";
  let ok=0, fail=0;
  for(const id of ids){
    try{ const res=await api(`products?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(changes[id])});
      if(res&&res.length){ Object.assign(products.find(p=>p.id===id),res[0]); delete changes[id]; ok++; } else fail++; }
    catch(e){ fail++; }
  }
  renderProducts(); paintSave();
  toast(fail?`Se guardaron ${ok}. No se pudieron guardar ${fail}: probá de nuevo.`:`¡Listo! Se guardaron ${ok} cambio${ok>1?'s':''}.`);
});
window.addEventListener("beforeunload",e=>{ if(Object.keys(changes).length){ e.preventDefault(); e.returnValue=""; } });

/* ====== ESTADÍSTICAS ====== */
async function loadStats(){
  const days=parseInt($("sDays").value,10);
  try{
    const [byDay,top,vis]=await Promise.all([rpc("stats_visits_by_day",{days}),rpc("stats_top_products",{days,lim:20}),rpc("stats_visitors",{days,lim:100})]);
    $("sDaysTable").innerHTML=byDay.length?`<table><tr><th>Día</th><th class="num">Visitas</th><th class="num">Personas</th><th class="num">Productos vistos</th></tr>${byDay.map(r=>`<tr><td>${fday(r.day)}</td><td class="num">${r.visits}</td><td class="num">${r.visitors}</td><td class="num">${r.product_views}</td></tr>`).join("")}</table>`:'<p class="muted">Todavía no hay visitas en este período.</p>';
    $("sTop").innerHTML=top.length?`<table><tr><th>Producto</th><th class="num">Vistas</th><th class="num">Personas</th></tr>${top.map(r=>`<tr><td>${esc(r.name||r.product_id)}</td><td class="num">${r.views}</td><td class="num">${r.visitors}</td></tr>`).join("")}</table>`:'<p class="muted">Sin datos todavía.</p>';
    $("sVisitors").innerHTML=vis.length?`<table><tr><th>Visitante</th><th>Primera vez</th><th>Última vez</th><th class="num">Visitas</th><th>Productos que miró</th></tr>${vis.map(r=>`<tr><td>#${esc(r.visitor_id.slice(0,6))}</td><td>${fdate(r.first_seen)}</td><td>${fdate(r.last_seen)}</td><td class="num">${r.visits}</td><td>${r.products.length?r.products.map(esc).join(", "):'<span class="muted">—</span>'}</td></tr>`).join("")}</table>`:'<p class="muted">Sin datos todavía.</p>';
  }catch(e){ toast("No se pudieron cargar las estadísticas."); }
}
$("sReload").addEventListener("click",loadStats); $("sDays").addEventListener("change",loadStats);

/* ====== MI RED ====== */
let members=[], salesTotals={};
async function loadMembers(){
  try{
    members=await api("network_members?select=*&order=name.asc");
    const sales=await api("sales?select=member_id,amount");
    salesTotals={}; sales.forEach(s=>{salesTotals[s.member_id]=(salesTotals[s.member_id]||0)+Number(s.amount);});
  }catch(e){ return; }
  const opts=members.map(m=>`<option value="${m.id}">${esc(m.name)}${m.status==='inactiva'?' (inactiva)':''}</option>`).join("");
  const keepS=$("mSponsor").value; $("mSponsor").innerHTML='<option value="">— Directamente yo —</option>'+opts; $("mSponsor").value=keepS;
  const keepV=$("vMember").value; $("vMember").innerHTML='<option value="">Elegí una persona…</option>'+opts; $("vMember").value=keepV;
  renderTree();
}
function renderTree(){
  if(!members.length){ $("mTree").innerHTML='<p class="muted">Todavía no cargaste a nadie. Usá el formulario para sumar la primera persona.</p>'; return; }
  const kids={}; members.forEach(m=>{ const k=m.sponsor_id&&members.some(x=>x.id===m.sponsor_id)?m.sponsor_id:0; (kids[k]=kids[k]||[]).push(m); });
  const count=id=>(kids[id]||[]).reduce((a,m)=>a+1+count(m.id),0);
  const node=(m,depth)=>{ if(depth>20) return ""; const ch=kids[m.id]||[]; const n=count(m.id);
    return `<li><span class="mem ${m.status}" data-mid="${m.id}"><b>${esc(m.name)}</b><small>${n?`a cargo: ${n}`:''}${salesTotals[m.id]?` · ventas ${fmt(salesTotals[m.id])}`:''}${m.joined_on?` · desde ${fday(m.joined_on)}`:''}</small></span>${ch.length?`<ul>${ch.map(c=>node(c,depth+1)).join("")}</ul>`:''}</li>`; };
  $("mTree").innerHTML=`<div class="tree"><ul>${(kids[0]||[]).map(m=>node(m,0)).join("")}</ul></div>`;
}
$("mTree").addEventListener("click",e=>{
  const el=e.target.closest("[data-mid]"); if(!el) return;
  const m=members.find(x=>x.id==el.dataset.mid); if(!m) return;
  $("mId").value=m.id; $("mName").value=m.name; $("mContact").value=m.contact||""; $("mJoined").value=m.joined_on||"";
  $("mSponsor").value=m.sponsor_id||""; $("mStatus").value=m.status; $("mNotes").value=m.notes||"";
  $("mFormTitle").textContent="Editar: "+m.name; window.scrollTo({top:0,behavior:"smooth"});
});
function resetMember(){ $("mForm").reset(); $("mId").value=""; $("mFormTitle").textContent="Sumar una persona"; }
$("mCancel").addEventListener("click",()=>{ resetMember(); $("mMsg").textContent=""; });
function isDescendant(candidate, id){ let cur=members.find(m=>m.id==candidate), guard=0; while(cur&&guard++<50){ if(cur.id==id) return true; cur=members.find(m=>m.id===cur.sponsor_id); } return false; }
$("mForm").addEventListener("submit",async e=>{
  e.preventDefault(); const id=$("mId").value;
  const sponsor=$("mSponsor").value?parseInt($("mSponsor").value,10):null;
  if(id && sponsor && isDescendant(sponsor,parseInt(id,10))){ $("mMsg").textContent="Esa persona no puede estar a cargo de alguien de su propio grupo."; $("mMsg").className="msg err"; return; }
  const body={name:$("mName").value.trim(),contact:$("mContact").value.trim()||null,joined_on:$("mJoined").value||null,sponsor_id:sponsor,status:$("mStatus").value,notes:$("mNotes").value.trim()||null};
  try{
    if(id) await api(`network_members?id=eq.${id}`,{method:"PATCH",body:JSON.stringify(body)});
    else await api("network_members",{method:"POST",body:JSON.stringify(body)});
    $("mMsg").textContent="Guardado ✓"; $("mMsg").className="msg ok"; resetMember(); loadMembers();
  }catch(err){ $("mMsg").textContent="No se pudo guardar."; $("mMsg").className="msg err"; }
});

/* ====== VENTAS ====== */
$("vDate").value=today();
async function loadSales(){
  if(!members.length) await loadMembers();
  let sales=[]; try{ sales=await api("sales?select=id,member_id,sale_date,amount,detail&order=sale_date.desc,id.desc&limit=1000"); }catch(e){ return; }
  const name=id=>(members.find(m=>m.id===id)||{}).name||"—";
  const byM={}, byMonth={};
  sales.forEach(s=>{ byM[s.member_id]=(byM[s.member_id]||0)+Number(s.amount); const k=s.sale_date.slice(0,7); byMonth[k]=(byMonth[k]||0)+Number(s.amount); });
  $("vByMember").innerHTML=Object.keys(byM).length?`<table><tr><th>Persona</th><th class="num">Total</th></tr>${Object.entries(byM).sort((a,b)=>b[1]-a[1]).map(([id,t])=>`<tr><td>${esc(name(+id))}</td><td class="num">${fmt(t)}</td></tr>`).join("")}</table>`:'<p class="muted">Sin ventas todavía.</p>';
  const mname=k=>{const [y,m]=k.split("-");return new Date(+y,+m-1,1).toLocaleDateString("es-AR",{month:"long",year:"numeric"});};
  $("vByMonth").innerHTML=Object.keys(byMonth).length?`<table><tr><th>Mes</th><th class="num">Total</th></tr>${Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).map(([k,t])=>`<tr><td>${esc(mname(k))}</td><td class="num">${fmt(t)}</td></tr>`).join("")}</table>`:'';
  $("vList").innerHTML=sales.length?`<table><tr><th>Fecha</th><th>Persona</th><th class="num">Monto</th><th>Detalle</th><th></th></tr>${sales.slice(0,200).map(s=>`<tr><td>${fday(s.sale_date)}</td><td>${esc(name(s.member_id))}</td><td class="num">${fmt(s.amount)}</td><td>${esc(s.detail||"")}</td><td><button class="btn small danger" data-del="${s.id}">Borrar</button></td></tr>`).join("")}</table>`:'<p class="muted">Todavía no anotaste ventas.</p>';
}
$("vForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const body={member_id:parseInt($("vMember").value,10),sale_date:$("vDate").value,amount:Number($("vAmount").value),detail:$("vDetail").value.trim()||null};
  if(!body.member_id){ $("vMsg").textContent="Elegí una persona."; $("vMsg").className="msg err"; return; }
  try{ await api("sales",{method:"POST",body:JSON.stringify(body)}); $("vMsg").textContent="Venta guardada ✓"; $("vMsg").className="msg ok"; $("vAmount").value=""; $("vDetail").value=""; loadSales(); loadMembers(); }
  catch(err){ $("vMsg").textContent="No se pudo guardar."; $("vMsg").className="msg err"; }
});
$("vList").addEventListener("click",async e=>{
  const b=e.target.closest("[data-del]"); if(!b) return;
  if(!confirm("¿Borrar esta venta?")) return;
  try{ await api(`sales?id=eq.${b.dataset.del}`,{method:"DELETE"}); toast("Venta borrada"); loadSales(); loadMembers(); }catch(err){ toast("No se pudo borrar."); }
});

/* ====== INICIO ====== */
loadSession();
if(session){ showApp().catch(()=>showLogin("")); } else showLogin("");
})();
