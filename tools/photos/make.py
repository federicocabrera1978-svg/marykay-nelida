import sys, numpy as np, pymupdf as fitz
from PIL import Image, ImageDraw
sys.path.insert(0,'/workspace/mk-notes/photos'); from spec import S
nt=fitz.open('/workspace/mkpdf/notext.pdf'); orig=fitz.open('/workspace/mkpdf/cat.pdf')
OUT='/workspace/mk-notes/photos/out'; import os; os.makedirs(OUT,exist_ok=True)
def finish(im,trim):
    if trim:
        a=np.asarray(im).astype(int); nonw=(255*3-a.sum(2))>45
        rows=np.where(nonw.mean(1)>0.01)[0]; cols=np.where(nonw.mean(0)>0.01)[0]
        if len(rows): im=im.crop((max(0,cols[0]-6),max(0,rows[0]-6),min(im.width,cols[-1]+6),min(im.height,rows[-1]+6)))
        W,H=im.size; side=int(max(W,H)*1.12)
        can=Image.new('RGB',(side,side),'white'); can.paste(im,((side-W)//2,(side-H)//2))
    else:
        W,H=im.size; a=np.asarray(im)
        if H>=W:
            edge=np.concatenate([a[:,:3].reshape(-1,3),a[:,-3:].reshape(-1,3)]).mean(0)
            can=Image.new('RGB',(H,H),tuple(int(v) for v in edge)); can.paste(im,((H-W)//2,0))
        else:
            edge=np.concatenate([a[:3].reshape(-1,3),a[-3:].reshape(-1,3)]).mean(0)
            can=Image.new('RGB',(W,W),tuple(int(v) for v in edge)); can.paste(im,(0,(W-H)//2))
    can=can.resize((600,600),Image.LANCZOS) if can.width>=200 else can.resize((600,600),Image.BICUBIC)
    return can
only=set(sys.argv[1:])
for pid,pg,box,trim in S:
    if only and pid not in only: continue
    src = nt if pg>=35 else orig
    pix=src[pg-1].get_pixmap(clip=fitz.Rect(box),dpi=450 if trim else 220)
    im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
    finish(im,trim).save(f'{OUT}/{pid}.jpg',quality=82,optimize=True)
print('ok')
