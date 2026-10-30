"""Bake a continuous, broken moss underlayer in the scan's existing UV atlas.
Original texture is read-only. The derived PNG and mask are separate outputs.
"""
import numpy as np
from PIL import Image


def bake_carpet(vertices, normals, uv, faces, source, output):
    image = np.asarray(Image.open(source).convert('RGB'), dtype=np.float32)/255
    h, w = image.shape[:2]
    mask = np.zeros((h, w), dtype=np.float32)
    pixels = uv*np.array([w, h])-.5
    for ids in faces:
        t = pixels[ids]
        lo = np.maximum(np.ceil(t.min(axis=0)).astype(int), 0)
        hi = np.minimum(np.floor(t.max(axis=0)).astype(int), [w-1, h-1])
        if np.any(hi < lo): continue
        a, b, c = t
        denominator = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(denominator) < 1e-10: continue
        yy, xx = np.mgrid[lo[1]:hi[1]+1, lo[0]:hi[0]+1]
        s = ((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/denominator
        t0 = ((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/denominator
        b0 = np.stack((s,t0,1-s-t0),axis=-1)
        inside = (b0.min(axis=-1)>=-1e-6)
        if not inside.any(): continue
        p = b0@vertices[ids]
        n = b0@normals[ids]
        n /= np.maximum(np.linalg.norm(n,axis=-1,keepdims=True),1e-8)
        field = .50+.23*np.sin(5.3*p[...,0]+3.8*p[...,1])+.16*np.sin(11*p[...,1]-4*p[...,2]+1.8*p[...,0])
        density = np.clip((field-.35)/.5,0,1)
        density = density*density*(3-2*density)
        grain = .5+.5*np.sin(p[...,0]*231+p[...,1]*183+np.sin(p[...,2]*159)*2)
        holes = .55+.45*np.sin(p[...,0]*48+p[...,1]*36+p[...,2]*25)**2
        slope = np.clip((n[...,2]-.08)/.5,0,1)
        alpha = density*holes*slope*(.65+.35*grain)*.92
        region = mask[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
        region[inside] = np.maximum(region[inside],alpha[inside])
    # Existing UV shells and original base-colour image remain unmodified.
    # Island dilation and mip filtering still need engine validation.
    luminance = image@np.array([.2126,.7152,.0722])
    rng = np.random.default_rng(1597)
    fine = rng.random((h,w))
    green = np.array([.23,.34,.085])[None,None,:]*(.6+.65*luminance[...,None])
    green *= (.78+.35*fine)[...,None]
    result = image*(1-mask[...,None])+green*mask[...,None]
    path = output/'moss-carpet-basecolor.png'
    Image.fromarray(np.uint8(np.clip(result*255+.5,0,255))).save(path)
    Image.fromarray(np.uint8(mask*255+.5)).save(output/'moss-carpet-mask.png')
    return path
