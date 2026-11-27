import json,os,numpy as np,pymupdf as fitz
from PIL import Image, ImageChops
R='/workspace/marykay-nelida'
P=json.load(open(f'{R}/data/products.json'))
F=json.load(open('fetched.json'))
src=fitz.open('/workspace/mkpdf/cat.pdf')
d=fitz.open(); pages=[12,22,25,27,28,32,40]
for pn in pages: d.insert_pdf(src,from_page=pn-1,to_page=pn-1)
for p in d:
    for b in p.get_text('words'): p.add_redact_annot(fitz.Rect(b[:4]))
    p.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)
idx={pn:i for i,pn in enumerate(pages)}
# (page, box, mode) mode 'trim'=white bg trim, 'life'=keep bg
H={
'refrescante-liquido-renovador-timewise':(12,(318,5,412,252),'life'),
'compacto-perfect-palette-mary-kay-vacio':(22,(672,290,930,540),'trim'),
'mascara-para-pestanas-lash-love-negra':(25,(25,460,190,510),'life'),
'balsamos-para-labios-con-color-mary-kay-edicion-limitada':(27,(510,250,664,402),'life'),
'balsamo-labial-at-play-edicion-limitada':(28,(673,115,724,258),'trim'),
'lapices-labiales-mate-efecto-polvo-at-play':(28,(523,225,578,460),'trim'),
'crema-para-manos-con-karite':(32,(342,370,435,585),'life'),
'mary-kay-at-play':(40,(110,155,365,595),'life'),
}
def square(im,bg,margin):
    W,H_=im.size; s=int(max(W,H_)*margin)
    c=Image.new('RGB',(s,s),bg); c.paste(im,((s-W)//2,(s-H_)//2)); return c
def trim(im,bg,th=18):
    diff=ImageChops.difference(im,Image.new('RGB',im.size,bg)).convert('L').point(lambda v:255 if v>th else 0)
    bb=diff.getbbox(); return im.crop(bb) if bb else im
def corners(im):
    a=np.asarray(im).astype(int); k=8
    c=np.concatenate([a[:k,:k].reshape(-1,3),a[:k,-k:].reshape(-1,3),a[-k:,:k].reshape(-1,3),a[-k:,-k:].reshape(-1,3)])
    return tuple(int(v) for v in np.median(c,0)), c.std(0).max()
def edgecolor(im):
    a=np.asarray(im).astype(int)
    e=np.concatenate([a[0],a[-1],a[:,0],a[:,-1]]); return tuple(int(v) for v in np.median(e,0))
os.makedirs(f'{R}/img/p/lg',exist_ok=True); os.makedirs(f'{R}/img/p/sm',exist_ok=True)
sources={}; 
for p in P:
    i=p['id']
    if i in F:
        im=Image.open(f'raw/{i}').convert('RGBA'); bgw=Image.new('RGBA',im.size,(255,255,255,255)); im=Image.alpha_composite(bgw,im).convert('RGB')
        bg,sd=corners(im)
        if sd<6: im=trim(im,bg)
        im=square(im,bg,1.10); nat=min(Image.open(f'raw/{i}').size)
        s=F[i]; sources[i]={'fuente':'oficial '+s['site'],'nombre_oficial':s['alt'].strip(),'url':s['url'],'resolucion_original':f"{s['size'][0]}x{s['size'][1]}"}
    elif i in H:
        pn,b,mode=H[i]; info=[x for x in src[pn-1].get_image_info() if fitz.Rect(x['bbox']).intersects(fitz.Rect(b))]
        ppi=max((x['width']/fitz.Rect(x['bbox']).width*72 for x in info),default=150)
        pix=d[idx[pn]].get_pixmap(clip=fitz.Rect(b),dpi=int(ppi*2))
        im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
        if mode=='trim': im=trim(im,(255,255,255)); bg=(255,255,255)
        else: bg=edgecolor(im)
        im=square(im,bg,1.06 if mode=='life' else 1.10)
        nat=int(max((b[2]-b[0]),(b[3]-b[1]))*ppi/72)
        sources[i]={'fuente':'PDF catálogo (imagen embebida, página %d)'%pn,'caja_pt':list(b),'resolucion_nativa_aprox':f'~{nat}px lado mayor ({int(ppi)} ppi)'}
    elif os.path.exists(f'/workspace/mk-notes/photos/out/{i}.jpg'):
        im=Image.open(f'/workspace/mk-notes/photos/out/{i}.jpg').convert('RGB'); nat=600
        sources[i]={'fuente':'PDF catálogo (guía de precios, recorte previo)','resolucion_nativa_aprox':'imagen embebida pequeña (~60-170px); sin versión oficial con match seguro'}
    else:
        sources[i]={'fuente':'sin foto','motivo':'no aparece en el PDF ni en marykay.com.mx / marykay.com'}; p.pop('img',None); continue
    lg=min(1600,max(800,nat)) if i in F else max(800,min(1600,nat))
    if i not in F and i not in H: lg=800
    im.resize((lg,lg),Image.LANCZOS).save(f'{R}/img/p/lg/{i}.webp','WEBP',quality=84,method=6)
    im.resize((800,800),Image.LANCZOS).save(f'{R}/img/p/{i}.webp','WEBP',quality=82,method=6)
    im.resize((400,400),Image.LANCZOS).save(f'{R}/img/p/sm/{i}.webp','WEBP',quality=80,method=6)
    p['img']=f'img/p/{i}.webp'; sources[i]['salida']={'sm':400,'md':800,'lg':lg}
json.dump(P,open(f'{R}/data/products.json','w',encoding='utf-8'),ensure_ascii=False,indent=0)
json.dump(sources,open(f'{R}/tools/photos/sources.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
from collections import Counter
print(Counter(v['fuente'].split(' (')[0] if 'PDF' not in v['fuente'] else v['fuente'][:40] for v in sources.values()))
