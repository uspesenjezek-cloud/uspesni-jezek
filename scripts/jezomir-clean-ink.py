from pathlib import Path
from PIL import Image
import numpy as np
root=Path('C:/Users/jkjob/Desktop/uspesen jezik git/app/assets')
out=Path('output/jezomir-edge');out.mkdir(exist_ok=True)
for k,v in dict(cena=2,obseg=4,placilo=2,pogodba=3,garancija=2,tveganja=2).items():
 a=np.array(Image.open(root/f'jezomir-{k}-four-v{v}.png').convert('RGBA'));b=a.copy();r=a[:,:,:3].astype(float)
 teal=(r[:,:,1]-r[:,:,0]>10)&(r[:,:,2]-r[:,:,0]>8)&(a[:,:,3]>0)
 core=teal&(r[:,:,0]<90)
 b[:,:,:3][core]=[8,126,128]
 if k=='obseg':
  pale=teal&(r[:,:,0]>165)
  b[:,:,:3][pale]=np.uint8(np.clip(r[pale]+[-4,3,0],0,255))
 assert np.array_equal(a[:,:,3],b[:,:,3])
 unchanged=~core
 if k=='obseg':unchanged&=~pale
 assert np.array_equal(a[unchanged],b[unchanged])
 Image.fromarray(b).save(out/f'jezomir-{k}-edge-v3.png')
 print(k,'original edge pixels preserved')
