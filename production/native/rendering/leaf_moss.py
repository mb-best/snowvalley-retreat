"""Fine, tapered moss shoots attached to scanned surface; metres, Z-up.
Study geometry only: no cushions, spherical clumps, or face-sized green plates.
"""
import numpy as np


def generate_leaf_moss(vertices, normals, faces, seed=1597, maximum=12000):
    rng = np.random.default_rng(seed)
    triangles = vertices[faces]
    weights = np.linalg.norm(np.cross(triangles[:, 1]-triangles[:, 0], triangles[:, 2]-triangles[:, 0]), axis=1)
    weights /= weights.sum()
    positions, shades, indices = [], [], []
    count = 0
    def triangle(a, b, c, color):
        k = len(positions)
        positions.extend((a, b, c))
        shades.extend((color*.78, color, color*1.08))
        indices.append((k, k+1, k+2))
    for face_id in rng.choice(len(faces), 260000, p=weights):
        a, b = rng.random(2)
        if a+b > 1: a, b = 1-a, 1-b
        bary = np.array([1-a-b, a, b])
        p = bary @ triangles[face_id]
        n = bary @ normals[faces[face_id]]
        n /= max(np.linalg.norm(n), 1e-8)
        if n[2] < .08: continue
        # Broad, irregular colonies modulated by finer gaps. Continuous density
        # produces scattered outer shoots instead of a clipped polygon boundary.
        field = .50+.23*np.sin(5.3*p[0]+3.8*p[1])+.16*np.sin(11*p[1]-4*p[2]+1.8*p[0])
        density = np.clip((field-.35)/.5, 0, 1)**1.7
        density *= .55+.45*np.sin(p[0]*48+p[1]*36+p[2]*25)**2
        if rng.random() > density*(.3+.7*n[2])*.72: continue
        ref = np.array([0., 0., 1.]) if abs(n[2]) < .94 else np.array([1., 0., 0.])
        u = np.cross(n, ref); u /= np.linalg.norm(u)
        v = np.cross(n, u)
        phase = rng.uniform(0, 2*np.pi)
        lean = (u*np.cos(phase)+v*np.sin(phase))*rng.uniform(.10, .38)
        axis = n+lean; axis /= np.linalg.norm(axis)
        length = rng.uniform(.0035, .010)*( .65+.35*density)
        root = p+n*.00025
        tone = rng.random()
        color = np.array([.038+.038*tone, .078+.068*tone, .012+.018*tone])
        # A thin tapered stem, followed by six alternating pointed leaves.
        tip = root+axis*length
        triangle(root-u*.00013, root+u*.00013, tip, color*.65)
        for j in range(6):
            angle = phase+j*2.399963
            direction = u*np.cos(angle)+v*np.sin(angle)
            side = np.cross(axis, direction); side /= np.linalg.norm(side)
            attach = root+axis*length*(.18+j*.115)
            leaf_length = rng.uniform(.0014, .0033)*(1-j*.065)
            width = leaf_length*rng.uniform(.12, .20)
            mid = attach+direction*leaf_length*.44+axis*leaf_length*.30
            end = attach+direction*leaf_length*.70+axis*leaf_length*.78
            ridge = mid+axis*width*.28
            left, right = mid+side*width, mid-side*width
            triangle(attach, left, ridge, color)
            triangle(left, end, ridge, color)
            triangle(end, right, ridge, color*.92)
            triangle(right, attach, ridge, color*.92)
        count += 1
        if count >= maximum: break
    if not count: raise ValueError('No suitable attachment positions')
    p = np.asarray(positions, np.float32)
    f = np.asarray(indices, np.uint32)
    cross = np.cross(p[f[:, 1]]-p[f[:, 0]], p[f[:, 2]]-p[f[:, 0]])
    cross /= np.maximum(np.linalg.norm(cross, axis=1, keepdims=True), 1e-12)
    return p, np.repeat(cross, 3, axis=0), np.asarray(shades, np.float32), f, count
