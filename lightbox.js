// Vista ampliada de fotos de producto (sin JS inline, compatible con CSP)
(function(){
  var lb,img,cap,closeBtn,lastFocus;
  function build(){
    lb=document.createElement('div'); lb.className='lb'; lb.hidden=true;
    lb.setAttribute('role','dialog'); lb.setAttribute('aria-modal','true'); lb.setAttribute('aria-label','Foto ampliada');
    lb.innerHTML='<button type="button" class="lb-close" aria-label="Cerrar">&times;</button><figure class="lb-fig"><img class="lb-img" alt=""><figcaption class="lb-cap"></figcaption></figure>';
    document.body.appendChild(lb);
    img=lb.querySelector('.lb-img'); cap=lb.querySelector('.lb-cap'); closeBtn=lb.querySelector('.lb-close');
    closeBtn.addEventListener('click',close);
    lb.addEventListener('click',function(e){ if(e.target===lb||e.target.classList.contains('lb-fig')) close(); });
    lb.addEventListener('keydown',function(e){ if(e.key==='Tab'){ e.preventDefault(); closeBtn.focus(); } });
  }
  function open(btn){
    if(!lb) build();
    lastFocus=btn; var t=btn.querySelector('img');
    img.src=t ? (t.currentSrc||t.src) : ''; // muestra la miniatura al instante
    var full=btn.getAttribute('data-full'); var hi=new Image(); hi.onload=function(){ img.src=full; }; hi.src=full;
    img.alt=t?t.alt:''; cap.textContent=t?t.alt:'';
    lb.hidden=false; document.documentElement.classList.add('lb-open');
    requestAnimationFrame(function(){ lb.classList.add('show'); closeBtn.focus(); });
  }
  function close(){
    if(!lb||lb.hidden) return;
    lb.classList.remove('show'); lb.hidden=true; img.removeAttribute('src');
    document.documentElement.classList.remove('lb-open');
    if(lastFocus) lastFocus.focus();
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.zoom-btn'); if(b){ e.preventDefault(); open(b); }
  });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') close(); });
})();
