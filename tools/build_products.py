# Genera data/products.json a partir del catálogo previo + guía de compras PDF (The Look Primavera Nov 2026)
import json, csv, re, unicodedata, sys
site=json.load(open('/workspace/mk-notes/site_products.json'))
pdf={}
for r in csv.reader(open('/workspace/mk-notes/pdf_items.tsv',encoding='utf-8'),delimiter='\t'):
    if r[0]=='sec': continue
    pdf[r[1]]={'sec':r[0],'name':r[1],'meta':r[2],'price':int(r[3]),'flag':(r[4] if len(r)>4 else '')}
# nombres del sitio que difieren del PDF
ALIAS={'Corrector para Ojos Multi-Beneficios Mary Kay':'Corrector para Rostro Multi-Beneficios Mary Kay'}
RENAME={'Corrector para Ojos Multi-Beneficios Mary Kay':'Corrector para Rostro Multi-Beneficios Mary Kay'}
def slug(s):
    s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','-',s).strip('-')[:70]
# Categorías nuevas: (cat, tag)
def recat(p):
    c,t,n=p['cat'],p['tag'],p['name']
    if c=='Cuidado de la Piel':
        if n.startswith('Loción Reafirmante Corporal'): return ('Cuidado Corporal','Cuerpo · TimeWise Body')
        m={'Línea Mary Kay':'Línea Mary Kay','Set · Línea Mary Kay':'Sets · Línea Mary Kay','TimeWise':'TimeWise','Set · TimeWise':'Sets · TimeWise',
           'Volu-Firm · Pieles Maduras':'TimeWise Repair · Pieles maduras','TimeWise Repair':'TimeWise Repair · Pieles maduras','Clinical Solutions':'Clinical Solutions',
           'Suplementarios':'Limpieza y suplementarios','Set · Suplementarios':'Limpieza y suplementarios','Mascarillas':'Mascarillas','Humectación Extra':'Humectación extra'}
        return ('Cuidado de la Piel',m.get(t,t))
    if c=='Maquillaje':
        m={'Bases':'Rostro · Bases y correctores','Ojos':'Ojos','Ojos · Cejas':'Cejas','Rostro · Polvos':'Rostro · Polvos','Sombras':'Ojos · Sombras','Rostro':'Rostro · Rubor e iluminador','Labios':'Labios'}
        if n.startswith('Corrector'): return ('Maquillaje','Rostro · Bases y correctores')
        return ('Maquillaje',m.get(t,t))
    if c=='Mary Kay At Play':
        return ('Maquillaje',t)  # "At Play · Labios", etc.
    if c=='Fragancias':
        return ('Fragancias Femeninas','Fragancia femenina') if t=='Femenina' else ('Fragancias Masculinas','Fragancia masculina')
    if c=='Cuidado Corporal':
        m={'Manos y Cuerpo':'Manos','Solar':'Protección solar','Labios':'Labios · Satin Lips','Cuerpo':'Cuerpo'}
        if 'Satin Hands' in n: return ('Cuidado Corporal','Manos · Satin Hands')
        return ('Cuidado Corporal',m.get(t,t))
    return (c,t)
DESC_NOTE='Precio con descuento aplicado'
out=[]; updated=[]; kept=[]; used=set()
for i,p in enumerate(site):
    q=dict(p); key=ALIAS.get(p['name'],p['name'])
    q['name']=RENAME.get(p['name'],p['name'])
    q['cat'],q['tag']=recat(p)
    q.pop('note',None)
    if key in pdf:
        d=pdf[key]; used.add(key)
        if d['price']!=p['price']: updated.append((q['name'],p['price'],d['price']))
        q['price']=d['price']
        # meta: tomar la presentación del PDF si el sitio no tenía, o actualizar origen
        q['meta']=d['meta'] if d['meta'] else p.get('meta','')
        if d['flag'].startswith('desc'): q['note']=DESC_NOTE
    else:
        kept.append((q['name'],p['price']))
        if p.get('note'): q['note']=p['note']
    out.append(q)
NEW=[
 ('Bálsamo Limpiador Facial Mary Kay Edición Limitada','Cuidado de la Piel','Línea Coreana · K-Beauty','img/balsamo-limpiador-coreano.jpg',True),
 ('Gel Humectante con Colágeno Mary Kay Edición Limitada','Cuidado de la Piel','Línea Coreana · K-Beauty','img/gel-colageno-coreano.jpg',True),
 ('Parches Faciales con Gel de Caracol Mary Kay Edición Limitada','Cuidado de la Piel','Línea Coreana · K-Beauty','img/parches-caracol.jpg',True),
 ('Set TimeWise Repair Volu-Firm','Cuidado de la Piel','Sets · TimeWise Repair','img/set-timewise-repair.jpg',False),
 ('Crema Facial Nocturna Efecto Reparador Volu-Firm','Cuidado de la Piel','TimeWise Repair · Pieles maduras',None,False),
 ('Microexfoliante Refinador TimeWise','Cuidado de la Piel','Limpieza y suplementarios',None,False),
 ('Minimizador de Poros TimeWise','Cuidado de la Piel','Limpieza y suplementarios',None,False),
 ('Bases de Maquillaje Mate TimeWise 3D (nueva)','Maquillaje','Rostro · Bases y correctores','img/bases-timewise-3d-nuevas.jpg',True),
 ('Bases de Maquillaje Luminosas TimeWise 3D (nueva)','Maquillaje','Rostro · Bases y correctores','img/bases-timewise-3d-nuevas.jpg',True),
 ('Bálsamos para Labios con Color Mary Kay Edición Limitada','Maquillaje','Labios','img/balsamo-labios-color.jpg',False),
]
NEWNAMES={'Bases de Maquillaje Mate TimeWise 3D (nueva)':'Base de Maquillaje Mate TimeWise 3D · Nueva fórmula',
          'Bases de Maquillaje Luminosas TimeWise 3D (nueva)':'Base de Maquillaje Luminosa TimeWise 3D · Nueva fórmula'}
TONES={'Bases de Maquillaje Mate TimeWise 3D (nueva)':'18 tonos: Light 2 a Deep 6','Bases de Maquillaje Luminosas TimeWise 3D (nueva)':'18 tonos: Light 2 a Deep 6',
       'Bálsamos para Labios con Color Mary Kay Edición Limitada':'Passionfruit Kiss · Raspberry Sorbet · Dulce Latte'}
newlist=[]
for n,c,t,img,feat in NEW:
    d=pdf[n]; used.add(n)
    q={'cat':c,'tag':t,'name':NEWNAMES.get(n,n),'meta':d['meta'],'price':d['price'],'isNew':True}
    if n in TONES: q['tones']=TONES[n]
    if img: q['img']=img
    if feat: q['feat']=True
    out.append(q); newlist.append(q['name'])
# Ajuste: la versión anterior de las bases TW3D 30 ml
for q in out:
    if q['name'] in ('Base de Maquillaje Mate TimeWise 3D','Base de Maquillaje Luminosa TimeWise 3D'):
        q['name']+=' (versión anterior)'
unused=[k for k in pdf if k not in used]
CAT_ORDER=["Cuidado de la Piel","Maquillaje","Fragancias Femeninas","Fragancias Masculinas","Cuidado Corporal","Brochas y Accesorios"]
# orden: por categoría (estable)
out.sort(key=lambda q: CAT_ORDER.index(q['cat']))
seen=set()
for k,q in enumerate(out):
    s=slug(q['name']); 
    while s in seen: s+='-2'
    seen.add(s); q['id']=s; q['sort']=(k+1)*10
json.dump(out,open('/workspace/marykay-nelida/data/products.json','w',encoding='utf-8'),ensure_ascii=False,indent=0)
rep={'total':len(out),'updated':updated,'kept_no_pdf':kept,'new':newlist,'pdf_unused':unused,'cats':{c:sum(1 for q in out if q['cat']==c) for c in CAT_ORDER}}
json.dump(rep,open('/workspace/mk-notes/build_report.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(out),'updated',len(updated),'kept',kept,'new',len(newlist),'unused',unused, rep['cats'])
