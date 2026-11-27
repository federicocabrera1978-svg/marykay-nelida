import json,re,subprocess,urllib.parse,html,os,concurrent.futures as cf
from mapping import M
from PIL import Image
os.makedirs('raw',exist_ok=True)
def get(site,q):
    u=("https://www.marykay.com.mx/on/demandware.store/Sites-marykay-mx-Site/es_MX/Search-Show?q=" if site=='mx' else "https://www.marykay.com/en-us/search?q=")+urllib.parse.quote(q)
    h=subprocess.run(['curl','-sL','-A','Mozilla/5.0',u],capture_output=True,text=True).stdout
    return [(html.unescape(m.group(2)),html.unescape(m.group(1))) for m in re.finditer(r'<img class="tile-image"\s+src="([^"]+)"\s+alt="([^"]*)"',h)]
def do(k):
    site,q,a=M[k]; r=get(site,q)
    hit=[x for x in r if x[0].strip().startswith(a.strip())]
    if not hit: return k,None
    alt,u=hit[0]; base=u.split('?')[0].replace(' ','%20')
    # original (no resize params) via dw/image path -> use static path
    orig=base.replace('/dw/image/v2/BLVX_PRD/','/') if 'BLVX_PRD' in base else re.sub(r'/dw/image/v2/[A-Z_]+/','/',base)
    out=f'raw/{k}'
    rc=subprocess.run(['curl','-sL','-A','Mozilla/5.0','-o',out,'-w','%{http_code}',orig],capture_output=True,text=True).stdout
    try: sz=Image.open(out).size
    except Exception: sz=None
    if rc!='200' or not sz:
        orig=base+'?sw=2000&sh=2000&sm=fit'
        rc=subprocess.run(['curl','-sL','-A','Mozilla/5.0','-o',out,'-w','%{http_code}',orig],capture_output=True,text=True).stdout
        sz=Image.open(out).size
    return k,{'site':'marykay.com.mx' if site=='mx' else 'marykay.com','alt':alt,'url':orig,'size':sz}
with cf.ThreadPoolExecutor(6) as ex: res=dict(ex.map(do,list(M)))
json.dump(res,open('fetched.json','w'),ensure_ascii=False,indent=1)
for k,v in res.items(): print(k, v and (v['size'],v['alt']) )
