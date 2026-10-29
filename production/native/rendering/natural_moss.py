"""Sparse-to-dense moss cushions with small leaf tips, no solid painted surface.
Returns a separate editable mesh in the same metre coordinate frame as the rock.
"""
import numpy as np


def generate_natural_moss(vertices, normals, faces, seed=1597, maximum=6500):
    rng=np.random.default_rng(seed)
    triangles=vertices[faces]
    weights=np.linalg.norm(np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0]),axis=1)
    weights/=weights.sum()
    positions=[];surface_normals=[];colours=[];indices=[]
    count=0
    for face_id in rng.choice(len(faces),140000,p=weights):
        a,b=rng.random(2)
        if a+b>1:a,b=1-a,1-b
        p=triangles[face_id,0]*(1-a-b)+triangles[face_id,1]*a+triangles[face_id,2]*b
        n=normals[faces[face_id,0]]*(1-a-b)+normals[faces[face_id,1]]*a+normals[faces[face_id,2]]*b
        n/=max(np.linalg.norm(n),1e-8)
        if n[2]<.05:continue
        patch=.5+.26*np.sin(6*p[0]+4*p[1])+.16*np.sin(13*p[1]-5*p[2]+2*p[0])
        t=np.clip((patch-.39)/.48,0,1)
        suitability=t**3*(.28+.72*np.clip(n[2],0,1))
        if rng.random()>suitability*.42:continue
        ref=np.array([0,0,1.]) if abs(n[2])<.94 else np.array([1.,0,0])
        u=np.cross(n,ref);u/=np.linalg.norm(u);v=np.cross(n,u)
        radius=rng.uniform(.004,.010)*(0.65+.5*suitability)
        height=rng.uniform(.0015,.0045)
        tone=rng.random()
        color=np.array([.055+.055*tone,.105+.085*tone,.018+.022*tone])
        root=p+n*.0005
        k=len(positions)
        phase=rng.uniform(0,np.pi*2)
        # Two rounded rings, with a low apex. Millimetre-scale shapes catch
        # grazing light while broken population density makes soft boundaries.
        for ring in range(2):
            r=radius*(1 if ring==0 else .55)
            h=height*(.08 if ring==0 else .72)
            for j in range(8):
                angle=phase+j*np.pi/4
                radial=u*np.cos(angle)+v*np.sin(angle)
                point=root+radial*r+n*h
                normal=n*(.55 if ring==0 else .88)+radial*(.84 if ring==0 else .48)
                normal/=np.linalg.norm(normal)
                positions.append(point);surface_normals.append(normal)
                colours.append(color*(.83+.17*ring)*(1+rng.uniform(-.09,.09)))
        positions.append(root+n*height);surface_normals.append(n);colours.append(color*1.05)
        for j in range(8):
            nxt=(j+1)%8
            indices.extend([[k+j,k+nxt,k+8+j],[k+nxt,k+8+nxt,k+8+j],[k+8+j,k+8+nxt,k+16]])
        # Very small leaves rise above the cushion. Avoid the earlier large
        # five-point rosette silhouette that read as a flowering ground plant.
        for leaf in range(3):
            angle=phase+leaf*2.39996
            direction=u*np.cos(angle)+v*np.sin(angle);side=np.cross(n,direction)
            length=rng.uniform(.0012,.0026)
            start=root+n*height*.7
            mid=start+direction*length*.5+n*length*.45
            tip=start+direction*length*.8+n*length*.8
            points=[start,mid+side*length*.16,tip,mid-side*length*.16]
            normal=np.cross(points[1]-points[0],points[2]-points[0]);normal/=max(np.linalg.norm(normal),1e-8)
            q=len(positions);positions.extend(points);surface_normals.extend([normal]*4);colours.extend([color*1.08]*4)
            indices.extend([[q,q+1,q+2],[q,q+2,q+3]])
        count+=1
        if count>=maximum:break
    if not count:raise ValueError('No suitable moss attachment positions')
    return np.asarray(positions,np.float32),np.asarray(surface_normals,np.float32),np.asarray(colours,np.float32),np.asarray(indices,np.uint32),count
