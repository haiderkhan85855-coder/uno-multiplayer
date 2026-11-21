import * as T from 'three';
import { mergeGeometries } from './vendor/utils/BufferGeometryUtils.js';

export const LIMIT = 78;
export const ROADS = [-48, 0, 48];
export const asphalt = 0x394859;
const materialCache = new Map();
export function material(color) {
  if (!materialCache.has(color)) materialCache.set(color, new T.MeshStandardMaterial({color, roughness: .9, flatShading: true}));
  return materialCache.get(color);
}
export function box(parent, color, w,h,d,x=0,y=0,z=0) {
  const obj = new T.Mesh(new T.BoxGeometry(w,h,d), material(color));
  obj.position.set(x,y,z); obj.castShadow = obj.receiveShadow = true;
  parent.add(obj); return obj;
}
export function tube(parent, color, a, b, radius, tipRadius = radius, sides = 8) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
  const obj = new T.Mesh(new T.CylinderGeometry(tipRadius,radius,delta.length(),sides), material(color));
  obj.position.copy(start).addScaledVector(delta,.5);
  obj.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
  obj.castShadow = obj.receiveShadow = true; parent.add(obj); return obj;
}
function facet(parent, color, size, x,y,z, sx=1,sy=1,sz=1) {
  const m = new T.Mesh(new T.IcosahedronGeometry(size,0),material(color));
  m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function ground(parent,color,w,d,x,z,y=0) {
  const obj = box(parent,color,w,.1,d,x,y-.05,z); obj.castShadow = false; return obj;
}
function batch(group, scene) {
  const groups = new Map();
  group.updateMatrixWorld(true);
  group.traverse(obj => {
    if (!obj.isMesh) return;
    const key = `${obj.material.id}:${obj.castShadow}`;
    if (!groups.has(key)) groups.set(key,{material:obj.material,shadow:obj.castShadow,geoms:[]});
    const source = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
    source.applyMatrix4(obj.matrixWorld);
    groups.get(key).geoms.push(source);
    obj.geometry.dispose();
  });
  for (const {material,shadow,geoms} of groups.values()) {
    const mesh = new T.Mesh(mergeGeometries(geoms),material);
    mesh.castShadow = shadow; mesh.receiveShadow = true; scene.add(mesh);
    geoms.forEach(g=>g.dispose());
  }
}

export function makeTown(scene) {
  const group = new T.Group(), colliders = [], buildings = [], cameraBlockers = [];
  let seed = 314159;
  const random = () => ((seed = (Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  const rand = (a,b) => a+(b-a)*random();
  const pick = list => list[Math.floor(random()*list.length)];
  const sand = 0xe8c99d, pave = 0xf3daba, paint = 0xffe5ae, ink = 0x2c3f4c;
  const addCollider = (x,z,w,d,h) => { const c = {x,z,w,d,h}; colliders.push(c); if(h>3)cameraBlockers.push(c); return c; };
  function sign(parent, text, x,y,z,w,h,bg,fg) {
    const canvas = document.createElement('canvas'); canvas.width=256; canvas.height=64;
    const ctx=canvas.getContext('2d'); ctx.fillStyle=bg; ctx.fillRect(0,0,256,64);
    ctx.font='bold 28px system-ui'; ctx.fillStyle=fg; ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,32,238);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture}));
    mesh.position.set(x,y,z); parent.add(mesh);
  }
  ground(group,0x4889ab,1500,1500,0,0,-.95);
  box(group,0xd4ad85,160,2.6,160,0,-1.32,0);
  ground(group,sand,158,158,0,0,.015);
  for(let i=0;i<8;i++) {
    const x=rand(145,310), z=rand(-240,230);
    facet(group,0x6c9c9b,rand(10,30),x,-2,z,1,.31,1.4);
  }
  for(let i=0;i<112;i++) {
    let x=rand(-135,180), z=rand(-136,136);
    if (Math.abs(x)<84 && Math.abs(z)<84) continue;
    const wave=ground(group,pick([0x619ab7,0x5593b1,0x76aac0]),rand(1,4),.08,x,z,-.926);
    wave.rotation.y=.20;
  }
  for(const r of ROADS) {
    ground(group,asphalt,12,155,r,0,.028); ground(group,asphalt,155,12,0,r,.027);
    for(let j=-72;j<=72;j+=4) {
      if(ROADS.some(v=>Math.abs(v-j)<10))continue;
      ground(group,paint,.14,1.9,r,j,.040); ground(group,paint,1.9,.14,j,r,.040);
    }
    for(const s of [-1,1]) {
      for (const r2 of ROADS) for(let p=-4;p<=4;p+=1.13) {
        ground(group,0xf5e3c9,.53,1.65,r+p,r2+s*7.3,.042);
        ground(group,0xf5e3c9,1.65,.53,r2+s*7.3,r+p,.042);
      }
    }
  }
  for(const z of [-77,77]) {
    ground(group,pave,156,4.5,0,z,.095);
    box(group,0xdebf96,158,.55,.41,0,.26,z+Math.sign(z)*2.35);
  }
  for(const x of [-77,77]) {
    ground(group,pave,4.5,156,x,0,.095);
    box(group,0xdebf96,.41,.55,158,x+Math.sign(x)*2.35,.26,0);
  }
  function tree(x,z,palm=false,scale=1) {
    if(palm) {
      tube(group,0xa27b53,[x,0,z],[x+.35*scale,4.8*scale,z],.24*scale,.13*scale,7);
      const colors=[0x779e49,0x94ae50,0x618b41];
      const p=new T.Group();p.position.set(x+.35*scale,4.8*scale,z);group.add(p);
      for(let i=0;i<7;i++) {
        const rad=i/7*Math.PI*2, a=Math.sin(rad), b=Math.cos(rad);
        const m=facet(p,colors[i%3],1,1.02*a*scale,.05,1.02*b*scale,.45*scale,.26*scale,1.42*scale);
        m.rotation.y=rad; m.rotation.x=.14;
      }
    } else {
      const h=rand(1.8,2.5)*scale;
      tube(group,0x956a4d,[x,0,z],[x,h,z],.23*scale,.13*scale);
      facet(group,0x759a4d,1.55*scale,x,h+.56*scale,z,1,1.14,1).rotation.y=rand(0,4);
      facet(group,0xa0b35e,1.05*scale,x+.85*scale,h+.52*scale,z+.36*scale);
      facet(group,0x578052,.9*scale,x-.66*scale,h+.42*scale,z-.51*scale);
    }
    addCollider(x,z,.5*scale,.5*scale,2.5);
  }
  function lamp(x,z,yaw=0) {
    const p=new T.Group(); p.position.set(x,.06,z); p.rotation.y=yaw; group.add(p);
    tube(p,ink,[0,0,0],[0,4.25,0],.09,.062); tube(p,ink,[0,4.25,0],[.58,4.42,0],.066);
    box(p,ink,.5,.16,.25,.76,4.43,0);box(p,0xffe5a4,.37,.035,.18,.76,4.33,0);
  }
  function bench(x,z,yaw=0) {
    const p=new T.Group();p.position.set(x,0,z);p.rotation.y=yaw;group.add(p);
    for(const a of [-.8,.8]){box(p,ink,.11,.52,.40,a,.28,0);box(p,ink,.08,.33,.08,a,.65,-.16);}
    box(p,0xb7734c,2,.10,.53,0,.54,0);box(p,0xb7734c,2,.25,.095,0,.82,-.18);
  }
  const schemes = [ [0xdb7658,0xa95640,0xffd18a],[0xf0ddb8,0xc77454,0xa65841],[0xf1bd86,0xb35845,0xffe0aa],[0x82a99f,0x527784,0xffd580],[0xefac96,0xab5c53,0xffe1b4],[0xf3cf74,0xbe7645,0xffeac0],[0xd3ded0,0x5b7a8b,0x83b9b1] ];
  function house(x,z,w,d,h,yaw,scheme,shop) {
    const [wall,roof,trim]=scheme, p=new T.Group();p.position.set(x,0,z);p.rotation.y=yaw;group.add(p);
    const swap=Math.abs(Math.sin(yaw))>.5;
    const bounds = addCollider(x,z,swap?d:w,swap?w:d,h+1);
    buildings.push({...bounds,color:wall});
    box(p,wall,w,h,d,0,h/2,0);box(p,trim,w+.15,.24,d+.15,0,h-.08,0);box(p,roof,w+.28,.28,d+.28,0,h+.13,0);
    if(!shop){
      const ridge=rand(.8,1.65), shape=new T.Shape();
      shape.moveTo(-w/2-.17,0);shape.lineTo(w/2+.17,0);shape.lineTo(0,ridge);shape.closePath();
      const geom=new T.ExtrudeGeometry(shape,{depth:d+.38,bevelEnabled:false});
      const m=new T.Mesh(geom,material(roof));m.position.set(0,h+.22,-d/2-.19);m.castShadow=m.receiveShadow=true;p.add(m);
      box(p,wall,.58,1.2,.58,w*.24,h+.66,-d*.1);
    }else{
      box(p,wall,w*.32,.58,d*.35,w*.20,h+.47,-d*.1);box(p,trim,w*.32+.12,.12,d*.35+.12,w*.20,h+.81,-d*.1);
    }
    const cols=Math.max(2,Math.round(w/2.7));
    for(let floor=0;floor<Math.floor(h/2.6);floor++) {
      const y=1.54+floor*2.6;
      for(let i=0;i<cols;i++) {
        const wx=w*((i+.5)/cols-.5);
        if(floor===0&&i===0) {
          box(p,trim,1.18,2.22,.10,wx,1.11,d/2);box(p,ink,.91,2.03,.12,wx,1.03,d/2+.04);
          if(shop)box(p,0x608c9b,.73,1.39,.13,wx,1.27,d/2+.061);
        } else {
          const ww=floor===0&&shop?1.55:.94;
          box(p,trim,ww+.23,1.35,.13,wx,y,d/2);box(p,0x446577,ww,1.15,.15,wx,y,d/2+.038);
          box(p,0x7395a0,.12,1.13,.04,wx,y,d/2+.127);box(p,trim,ww+.30,.13,.27,wx,y-.66,d/2+.04);
        }
      }
      for (const dir of [-1,1]) for(const pos of [-.24,.24]) {
        box(p,trim,.13,1.25,1.07,dir*w/2,y,d*pos);box(p,0x456474,.15,1.04,.85,dir*(w/2+.05),y,d*pos);
      }
    }
    if(shop) {
      const stripes=Math.ceil(w/.54),size=w/stripes;
      for(let i=0;i<stripes;i++) {
        const stripe=box(p,i%2===0?trim:roof,size+.015,.11,1.30,(i+.5)*size-w/2,2.62,d/2+.55);
        stripe.rotation.x=.26;
      }
      return {p,z:d/2+.09};
    }
  }
  const spans=[[-73,-54],[-42,-6],[6,42],[54,73]];
  for (let i=0;i<4;i++) for(let j=0;j<4;j++) {
    const [left,right]=spans[i],[top,bottom]=spans[j],cx=(left+right)/2,cz=(top+bottom)/2;
    ground(group,pave,right-left,bottom-top,cx,cz,.092);
    ground(group,(i+j)%3===0?0xaaba72:0xd6b88e,right-left-4,bottom-top-4,cx,cz,.098);
    if((i===1&&j===1)||(i===3&&j===2)) {
      ground(group,0xb3bf7e,right-left-6,bottom-top-6,cx,cz,.103);
      ground(group,pave,2.4,bottom-top-4,cx,cz,.110);ground(group,pave,right-left-4,2.4,cx,cz,.111);
      for(const a of [-1,1]) for(const b of [-1,1]) {tree(cx+a*(right-left)*.30,cz+b*(bottom-top)*.30,i===3);bench(cx+a*2.8,cz+b*3.5,a*Math.PI/2);}
      if(i===1) {
        const fountain=new T.Mesh(new T.CylinderGeometry(3,3.15,.53,14),material(0xe9decc));fountain.position.set(cx,.32,cz);fountain.castShadow=true;group.add(fountain);
        const pool=new T.Mesh(new T.CylinderGeometry(2.72,2.72,.05,14),material(0x66aab5));pool.position.set(cx,.61,cz);group.add(pool);tube(group,0xf3dfbb,[cx,.5,cz],[cx,2,cz],.24,.46);addCollider(cx,cz,5.35,5.35,1);
      }
    } else {
      const zs=bottom-top>25?[top+7.6,bottom-7.6]:[cz];
      const xs=right-left>25?[left+8,right-8]:[cx];
      for(let a=0;a<xs.length;a++)for(let b=0;b<zs.length;b++) {
        const special=(i===2&&j===2&&a===0&&b===1)||(i===1&&j===2&&a===1&&b===1)||(i===2&&j===1&&a===0&&b===1);
        const h=special?5.6:pick([3.2,5.5,5.6,7.95]);
        const s=house(xs[a],zs[b],rand(7.8,10.7),rand(6.5,9.0),h,b===0&&zs.length===2?Math.PI:0,special?schemes[i===1?3:0]:pick(schemes),special);
        if(s) {
          const text=i===1?'COASTAL GARAGE':j===1?'THE BOARDWALK':'SUNSET CAFÉ';
          // Text planes stay separate from the batched static town.
          const board=new T.Group();board.position.copy(s.p.position);board.rotation.copy(s.p.rotation);scene.add(board);
          sign(board,text,0,3.28,s.z,4.15,.92,'#263e4b','#fff0c8');
        }
      }
      tree(left+2.15,bottom-2.3,i>=2,rand(.75,1.18));
      if(zs.length>1)tree(right-2.3,top+2.1,i>=2,rand(.8,1.15));
    }
    lamp(left+1.25,top+1.18,Math.PI); lamp(right-1.25,bottom-1.18);
  }
  for(const z of [-68,-34,-17,16,34,67]) {tree(76.6,z,true,rand(.85,1.15));lamp(76.9,z+4,Math.PI);if(Math.abs(z)<45)bench(76.3,z+1.8,-Math.PI/2);}
  for(const x of [-65,-26,20,65]) tree(x,76.7,true,.88);
  for (const z of [-52,-18,19,57]) {
    const boat=new T.Group();boat.position.set(88+rand(0,12),-.85,z);boat.rotation.y=rand(-.7,.7);group.add(boat);
    const hull=facet(boat,pick([0xe28d5c,0xf5e4bf,0x79b1b3]),1,0,.1,0,.83,.47,1.95);hull.rotation.y=.15;
    box(boat,0xf4e7cb,.93,.07,1.55,0,.34,.05);box(boat,0x876551,.93,.13,.30,0,.40,-.22);
  }
  batch(group,scene);
  return {colliders,buildings,cameraBlockers};
}
