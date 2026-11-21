import * as T from 'three';
import { mergeGeometries } from './vendor/utils/BufferGeometryUtils.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { aggregateTexture, makeStreetDetails } from './streetscape.js';

export const LIMIT = 78;
export const HORIZONTAL_ROADS = [-48,0,48];
export const VERTICAL_ROADS = [-48,0,48,96,132];
export const BOUNDS = {left:-78,right:167,top:-LIMIT,bottom:LIMIT};
export const DISTRICT_LINE=79;
export const BOARDWALK=148;
export const SHORE=168;
export const ROAD_END=144;
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
    if(obj.material.userData.worldTile){
      const pos=source.getAttribute('position'),uv=source.getAttribute('uv'),repeat=obj.material.userData.worldTile;
      const n=source.getAttribute('normal'), facade=obj.material.userData.facade;
      if(uv)for(let i=0;i<uv.count;i++){
        if(facade&&Math.abs(n.getY(i))<.5)uv.setXY(i,(Math.abs(n.getX(i))>.55?pos.getZ(i):pos.getX(i))/repeat,pos.getY(i)/repeat);
        else uv.setXY(i,pos.getX(i)/repeat,pos.getZ(i)/repeat);
      }
    }
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
  for(const [color,side,repeat] of [[asphalt,false,5.8],[pave,true,5.0]]){
    const m=material(color);m.map=aggregateTexture(side);m.userData.worldTile=repeat;
  }
  const litGlass=[0xb5825e,0xd4a16e,0xefbd8b];
  for(const col of litGlass){const m=material(col);m.emissive.setHex(col);m.emissiveIntensity=.72;m.roughness=.43;}
  const bulb=material(0xffe5a4);bulb.emissive.setHex(0xffc87c);bulb.emissiveIntensity=2.3;
  const addCollider = (x,z,w,d,h) => { const c = {x,z,w,d,h}; colliders.push(c); if(h>3)cameraBlockers.push(c); return c; };
  function sign(parent, text, x,y,z,w,h,bg,fg) {
    const canvas = document.createElement('canvas'); canvas.width=256; canvas.height=64;
    const ctx=canvas.getContext('2d'); ctx.fillStyle=bg; ctx.fillRect(0,0,256,64);
    ctx.font='bold 28px system-ui'; ctx.fillStyle=fg; ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,32,238);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture}));
    mesh.position.set(x,y,z); parent.add(mesh);
  }
  const width=ROAD_END+79, center=(ROAD_END-79)/2;
  ground(group,0x417c94,1500,1500,0,0,-.95);
  box(group,0xcda578,SHORE+79,2.6,160,(SHORE-79)/2,-1.32,0);
  ground(group,sand,width,158,center,0,.015);
  ground(group,0xf2d3a0,SHORE-ROAD_END,158,(SHORE+ROAD_END)/2,0,.018);
  ground(group,0xe1b989,2.6,158,SHORE-1.25,0,.022);
  // Independent random stream keeps the original town and parked ride surroundings stable.
  const townSeed=seed;
  for(let i=0;i<10;i++) {
    const x=rand(203,385), z=rand(-290,290);
    facet(group,pick([0x98978d,0x8e958b,0x7e9092]),rand(13,39),x,-4,z,1,.32,1.65);
  }
  for(let i=0;i<160;i++) {
    const x=rand(-155,265), z=rand(-168,168);
    if (x>-84&&x<173&&Math.abs(z)<83) continue;
    const wave=ground(group,pick([0x6191a4,0x53869d,0x79a5b2]),rand(1,4),.08,x,z,-.926);
    wave.rotation.y=.2;
  }
  seed=townSeed;
  for(let i=0;i<8;i++){rand(145,310);rand(-240,230);rand(10,30);}
  for(let i=0;i<112;i++){const x=rand(-135,180),z=rand(-136,136);if(Math.abs(x)<84&&Math.abs(z)<84)continue;random();random();}
  for(const x of VERTICAL_ROADS) {
    ground(group,asphalt,12,155,x,0,.028);
    for(let z=-72;z<=72;z+=4)if(!HORIZONTAL_ROADS.some(v=>Math.abs(v-z)<10))ground(group,paint,.14,1.9,x,z,.040);
  }
  for(const z of HORIZONTAL_ROADS){
    ground(group,asphalt,width,12,center,z,.027);
    for(let x=-72;x<=140;x+=4)if(!VERTICAL_ROADS.some(v=>Math.abs(v-x)<10))ground(group,paint,1.9,.14,x,z,.040);
    for(const x of VERTICAL_ROADS)for(const s of [-1,1])for(let p=-4;p<=4;p+=1.13){
      ground(group,0xf5e3c9,.53,1.65,x+p,z+s*7.3,.042);
      ground(group,0xf5e3c9,1.65,.53,x+s*7.3,z+p,.042);
    }
  }
  for(const z of [-77,77]) {
    ground(group,pave,width,4.5,center,z,.095);
    box(group,0xdebf96,width,.55,.41,center,.26,z+Math.sign(z)*2.35);
  }
  ground(group,pave,4.5,156,-77,0,.095);
  box(group,0xdebf96,.41,.55,158,-79.35,.26,0);
  function tree(x,z,palm=false,scale=1){
    const big=palm==='park';
    if(palm===true){
      // Segmented, curved trunks and tapered fronds instead of a single solid canopy.
      const trunk=[[-.20,0,0],[-.12,1.34,.01],[.10,2.8,-.05],[.36,4.17,-.095],[.48,5.02,-.14]];
      const world=([a,b,c])=>[x+a*scale,b*scale,z+c*scale];
      for(let i=1;i<trunk.length;i++){
        const radius=(.266-i*.031)*scale;
        tube(group,i%2?0x947153:0x9f7d5f,world(trunk[i-1]),world(trunk[i]),radius,radius*.86,10);
        const start=world(trunk[i-1]),end=world(trunk[i]);
        for(let j=1;j<=3;j++){
          const a=start.map((n,k)=>n+(end[k]-n)*(j*.24));
          tube(group,0x836951,a,[a[0],a[1]+.042*scale,a[2]],radius*(1-j*.034),radius*(1-j*.041),9);
        }
      }
      const p=new T.Group();p.position.set(...world(trunk.at(-1)));p.scale.setScalar(scale);group.add(p);
      const greens=[0x69864a,0x839751,0x4e743d,0x728d49];
      for(let i=0;i<12;i++){
        const l=1.60+Math.sin(i*4.12)*.41+(i<7?.48:0),a=i*2.39, positions=[],uv=[];
        const span=t=>[0,Math.sin(Math.PI*t)*(.45+(i%3)*.10)-t*t*(i<7?.49:.15),l*t];
        for(let j=0;j<7;j++){
          const t=j/7,q=(j+1)/7,[,y,zz]=span(t),[,dy,dz]=span(q);
          const w=.29*Math.sin(Math.PI*t)**.66,k=.29*Math.sin(Math.PI*q)**.66;
          for(const s of [-1,1]){
            positions.push(0,y,zz,s*w,y-.1*w,zz-.06,0,dy,dz,0,dy,dz,s*w,y-.1*w,zz-.06,s*k,dy-.1*k,dz-.06);
            uv.push(0,0,1,0,0,1,0,1,1,0,1,1);
          }
        }
        const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
        const m=new T.Mesh(geo,material(greens[i%greens.length]));m.material.side=T.DoubleSide;m.castShadow=m.receiveShadow=true;m.rotation.y=a;p.add(m);
      }
      facet(p,0x736646,.25,0,-.07,0,.8,.75,.84);
    }else{
      const height=(big?3.4:2.28)*scale;
      tube(group,0x80674e,[x,0,z],[x+.12*scale,height,z+.045],.26*scale,.10*scale,10);
      const colors=big?[0x63824c,0x779251,0x557748,0x8c9b56]:[0x7d9957,0x687f49,0x8c9e5d,0x749050];
      for(let i=0;i<7;i++){
        const a=i*2.39996,r=(i===0?0:.75+.34*Math.sin(i*3.14))*scale*(big?1.5:1);
        const dx=Math.sin(a)*r,dz=Math.cos(a)*r,y=height+(.79+(i%3)*.24)*scale;
        if(i)tube(group,0x80674e,[x,height*.64,z],[x+dx*.79,y-.5*scale,z+dz*.79],.12*scale,.035*scale,7);
        const radius=(big?1.46:1.06)*scale*(1+i%3*.075);
        const m=new T.Mesh(new T.IcosahedronGeometry(radius,1),material(colors[i%4]));
        m.position.set(x+dx,y,z+dz);m.scale.set(1,.93+(i%2)*.23,1);m.rotation.y=a;m.castShadow=m.receiveShadow=true;group.add(m);
      }
    }
    addCollider(x,z,.5*scale,.5*scale,big?2.9:2.5);
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
  const plaster=aggregateTexture('plaster');
  function house(x,z,w,d,h,yaw,scheme,shop) {
    const [wall,roof,trim]=scheme, surface=material(wall);
    surface.map=plaster;surface.userData.worldTile=3.7;surface.userData.facade=true;
    const p=new T.Group();p.position.set(x,0,z);p.rotation.y=yaw;group.add(p);
    const swap=Math.abs(Math.sin(yaw))>.5;
    const bounds = addCollider(x,z,swap?d:w,swap?w:d,h+1);
    buildings.push({...bounds,color:wall});
    box(p,wall,w,h,d,0,h/2,0);box(p,trim,w+.15,.24,d+.15,0,h-.08,0);box(p,roof,w+.28,.28,d+.28,0,h+.13,0);
    const tower=h>9;
    if(!shop&&!tower){
      const ridge=rand(.8,1.65), shape=new T.Shape();
      shape.moveTo(-w/2-.17,0);shape.lineTo(w/2+.17,0);if(Math.round(x+z)%3===0){shape.lineTo(w*.18,ridge);shape.lineTo(-w*.22,ridge*.8);}else shape.lineTo(0,ridge);shape.closePath();
      const geom=new T.ExtrudeGeometry(shape,{depth:d+.38,bevelEnabled:false});
      const m=new T.Mesh(geom,material(roof));m.position.set(0,h+.22,-d/2-.19);m.castShadow=m.receiveShadow=true;p.add(m);
      box(p,wall,.58,1.2,.58,w*.24,h+.66,-d*.1);
    }else{
      box(p,wall,w*.32,.58,d*.35,w*.20,h+.47,-d*.1);box(p,trim,w*.32+.12,.12,d*.35+.12,w*.20,h+.81,-d*.1);
    }
    if(tower||shop){
      const tankColor=tower?0x799199:0xa99b87;
      for(const dx of [-.49,.49])box(p,0x6c6d68,.11,.47,1.24,w*.2+dx,h+.33,-d*.17);
      tube(p,tankColor,[w*.2,h+.5,-d*.17],[w*.2,h+1.13,-d*.17],.55,.55,12);
      tube(p,0xabb0aa,[w*.2,h+1.13,-d*.17],[w*.2,h+1.27,-d*.17],.55,.30,12);
      if(tower){
        tube(p,0x5d6669,[-w*.28,h,-d*.24],[-w*.28,h+2.45,-d*.24],.045,.035);
        for(let j=0;j<4;j++)box(p,0xbec0b4,1.01-j*.14,.043,.055,-w*.28,h+1.6+j*.18,-d*.24);
        for(let k=1;k<h/2.6;k++)box(p,trim,w+.13,.11,d+.12,0,k*2.6,0);
      }
    }
    const stone=0xbca68d;
    box(p,stone,w+.07,.35,d+.07,0,.18,0);
    for(const s of [-1,1])box(p,trim,.15,h-.45,.12,s*(w/2-.13),h/2,d/2+.043);
    const glassAt=(k)=>Math.abs(k+Math.floor(x*.54-z*.43))%7<3?litGlass[Math.abs(k)%3]:0x486675;
    const cols=Math.max(2,Math.round(w/2.7));
    for(let floor=0;floor<Math.floor(h/2.6);floor++) {
      const y=1.54+floor*2.6;
      for(let i=0;i<cols;i++) {
        const wx=w*((i+.5)/cols-.5);
        if(floor===0&&i===0) {
          box(p,trim,1.18,2.22,.10,wx,1.11,d/2);box(p,ink,.91,2.03,.12,wx,1.03,d/2+.04);
          box(p,0xad875b,.086,.093,.061,wx+.28,1.06,d/2+.135);
          if(shop)box(p,0x608c9b,.73,1.39,.13,wx,1.27,d/2+.061);
        } else {
          const ww=floor===0&&shop?1.55:.94;
          box(p,trim,ww+.23,1.35,.13,wx,y,d/2);box(p,glassAt(floor*3+i),ww,1.15,.15,wx,y,d/2+.038);
          box(p,0x7395a0,.12,1.13,.04,wx,y,d/2+.127);box(p,trim,ww+.30,.13,.27,wx,y-.66,d/2+.04);
          box(p,0x94a3a2,ww,.044,.027,wx,y-.12,d/2+.128);
          if(tower&&floor>0&&i%2===0){
            box(p,trim,1.76,.14,.71,wx,y-.81,d/2+.36);
            for(let j=-2;j<=2;j++)box(p,0x536466,.039,.64,.042,wx+j*.32,y-.46,d/2+.69);
            box(p,0x536466,1.68,.046,.049,wx,y-.15,d/2+.68);
          }
        }
      }
      for (const dir of [-1,1]) for(const pos of [-.24,.24]) {
        box(p,trim,.13,1.25,1.07,dir*w/2,y,d*pos);box(p,glassAt(floor*4+dir+(pos>0?2:0)),.15,1.04,.85,dir*(w/2+.05),y,d*pos);
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
      for(const a of [-1,1]) for(const b of [-1,1]) {tree(cx+a*(right-left)*.30,cz+b*(bottom-top)*.30,i===3?true:'park');bench(cx+a*2.8,cz+b*3.5,a*Math.PI/2);}
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
  // Lantern Bay: a second neighborhood connected by all three east–west streets.
  const eastBlocks=[[82,90],[102,126],[138,143]];
  for(let i=0;i<eastBlocks.length;i++)for(let j=0;j<spans.length;j++){
    const [left,right]=eastBlocks[i],[top,bottom]=spans[j], x=(left+right)/2,z=(top+bottom)/2;
    ground(group,pave,right-left,bottom-top,x,z,.094);
    lamp(left+1,top+1,Math.PI);lamp(right-1,bottom-1);
    if(i===2){
      for(const t of [top+4,bottom-4]){tree(x,t,true,.92);bench(x+.9,t+2,-Math.PI/2);}
    }else if(i===1&&j===2){
      ground(group,0xa2b17c,right-left-3,bottom-top-3,x,z,.101);
      ground(group,0xe9cfaa,2.2,bottom-top,x,z,.109);
      ground(group,0xe9cfaa,right-left,2.2,x,z,.109);
      for(const d of [-1,1])for(const a of [-1,1]){tree(x+d*7,z+a*10,true,1.05);bench(x+d*6,z+a*6,Math.PI/2);}
      const market=new T.Group();market.position.set(x,0,z);scene.add(market);
      sign(market,'LANTERN BAY',0,2.6,0,4.4,.9,'#244b58','#ffe9b4');
      for(const d of [-1,1])tube(group,0x744d3a,[x+d*1.9,0,z],[x+d*1.9,3.1,z],.09);
    }else{
      const double=bottom-top>25;
      for(const zz of double?[top+8.8,bottom-8.8]:[z]){
        const name=j===0?'MARINA BAKERY':j===3?'LANTERN MARKET':'BAY GUESTHOUSE';
        const shop=i===1;
        const tall=(i===1?(j===0?17.9:j===1?(zz<z?21.6:13.4):j===3?11.9:6.25):(j===0||j===1?8.6:5.0));
        const model=house(x,zz,i===0?5.1:12.1,shop?9.4:8.5,tall,zz<z?Math.PI:0,schemes[(j*2+i+3)%schemes.length],shop);
        if(model){const p=new T.Group();p.position.copy(model.p.position);p.rotation.copy(model.p.rotation);scene.add(p);sign(p,name,0,3.35,model.z,4.7,.85,'#284b56','#ffe9b4');}
      }
      if(i===1)for(const dz of [-5.3,5.3])tree(left+2,z+dz,true,rand(.77,1.18));
    }
  }
  // Fill the interiors of existing blocks without narrowing mission roads or moving the parked rides.
  for(const [x,z,w,d,h,scheme,yaw,name] of [[23,23,9,11,7.9,3,Math.PI,'CITRUS BAKERY'],[-24,25,10,9,7.9,4,0,'SEASIDE PANTRY'],[25,-24,11,8,6.2,1,0,'PORT SIDE CAFÉ'],[-28,19,6,8,4.8,2,Math.PI,null],[69,-28,4.3,9,8.0,2,0,null],[60,62,8.1,6.8,10.8,6,0,null],[68,69,5.9,6.1,7.2,3,0,null],[105,-61,4.2,8,12.2,0,0,null],[123.3,-27,4.5,7.2,12.8,4,0,null]]){
    const c=house(x,z,w,d,h,yaw,schemes[scheme],!!name);
    if(c){const p=new T.Group();p.position.copy(c.p.position);p.rotation.copy(c.p.rotation);scene.add(p);sign(p,name,0,3.29,c.z,4.6,.74,'#3c4b4b','#fee4ad');}
  }
  for(const z of [-68,-34,-17,16,34,67]) {tree(76.6,z,true,rand(.85,1.15));lamp(76.9,z+4,Math.PI);if(Math.abs(z)<45)bench(76.3,z+1.8,-Math.PI/2);}
  for(const x of [-65,-26,20,65,104,140])tree(x,76.7,true,.88);
  // A flat, curb-free boardwalk and beach work with the existing walking and driving physics.
  ground(group,0xa06c51,7.2,157,BOARDWALK,0,.081);
  for(let i=-102;i<=102;i++)ground(group,pick([0xb78662,0xc99b72,0xbe906b,0xd0a078]),7.1,.746,BOARDWALK,i*.765,.086);
  for(const x of [BOARDWALK-3.4,BOARDWALK+3.4])ground(group,0x9a694f,.15,156,x,0,.093);
  for(const z of [-69,-56,-37,-20,23,38,56,69]){
    lamp(144.75,z,0);
    if(Math.abs(z)>22)bench(151,z,Math.PI/2);
  }
  const kiosk=house(143.6,16,4.8,5,3.25,Math.PI/2,[0x82b5a6,0x446e79,0xf3d384],true);
  const kioskSign=new T.Group();kioskSign.position.copy(kiosk.p.position);kioskSign.rotation.copy(kiosk.p.rotation);scene.add(kioskSign);
  sign(kioskSign,'BOARDWALK',0,3.10,kiosk.z,3.2,.55,'#244b58','#fff2bb');
  for(const [x,z] of [[162.4,-69],[162.2,-36],[162,-12],[162.5,12],[162.3,37],[162.4,68]])tree(x,z,true,1.03);
  for(const [x,z,rotation,col] of [[159,-63,.2,0xdc775f],[158,-31,.4,0x529da4],[160,-8,1,0xe4a653],[158,22,.1,0xd5786f],[160,49,.25,0x65a9aa],[161,67,.5,0xe6a953]]){
    const p=new T.Group();p.position.set(x,0,z);p.rotation.y=rotation;group.add(p);
    tube(p,0xd5ba94,[0,0,0],[0,2.42,0],.058);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,b=a+Math.PI/4;
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([0,2.6,0,Math.sin(a)*1.62,1.96,Math.cos(a)*1.62,Math.sin(b)*1.62,1.96,Math.cos(b)*1.62],3));
      geo.computeVertexNormals();geo.setAttribute('uv',new T.Float32BufferAttribute([.5,1,0,0,1,0],2));
      // Face each umbrella panel upward with its normal, so the deck receives its shadow.
      const m=new T.Mesh(geo,material(i%2?0xf9e2ba:col));m.material.side=T.DoubleSide;m.castShadow=true;p.add(m);
    }
    for(const z of [-.72,.72]){
      const lounge=box(p,0xf9e0b7,1.43,.08,.49,0,.28,z);lounge.rotation.z=.09;
      box(p,col,1.38,.055,.37,0,.335,z).rotation.z=.09;
      for(const x of [-.56,.56])box(p,0xa27a60,.07,.25,.5,x,.14,z);
    }
  }
  for (const z of [-52,-18,19,57]) {
    const boat=new T.Group();boat.position.set(179+rand(0,20),-.66,z);boat.rotation.y=rand(-.7,.7);group.add(boat);
    const hull=facet(boat,pick([0xe28d5c,0xf5e4bf,0x79b1b3]),1,0,.1,0,.83,.47,1.95);hull.rotation.y=.15;
    box(boat,0xf4e7cb,.93,.07,1.55,0,.34,.05);box(boat,0x876551,.93,.13,.30,0,.40,-.22);
  }
  const propSites=[[110,14],[118,14],[110,34],[118,34]];
  const fallbacks=propSites.map(([x,z])=>{
    const root=new T.Group();root.position.set(x,0,z);scene.add(root);addCollider(x,z,.44,.44,2.5);
    tube(root,0x956a4d,[0,0,0],[0,2.4,0],.22,.12);
    facet(root,0x789e54,1.64,0,2.9,0,1,1.18,1);
    return root;
  });
  new GLTFLoader().load('models/kenney-tree.glb',({scene:tree})=>{
    const size=new T.Box3().setFromObject(tree).getSize(new T.Vector3());
    if(size.y<=0)return;
    tree.scale.setScalar(4.8/size.y);
    tree.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    fallbacks.forEach((root,i)=>{
      const model=tree.clone(true);model.rotation.y=i*1.4;
      root.traverse(o=>{if(o.isMesh)o.geometry.dispose();});root.clear();root.add(model);
    });
  },undefined,()=>console.info('Using the procedural park trees.'));
  new GLTFLoader().load('models/traffic/palm.glb',({scene:palm})=>{
    const native=new T.Box3().setFromObject(palm),height=native.max.y-native.min.y;
    if(height<=0)return;
    const k=3.48/height;palm.scale.setScalar(k);
    for(const [i,[x,z]] of [[151.7,-37],[151.6,39],[143.5,53],[144.2,-60]].entries()){
      const site=palm.clone(true);site.rotation.y=.9+i*1.7;site.position.set(x,-native.min.y*k,z);
      site.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(site);
    }
  },undefined,()=>console.info('Keeping the hand-built shoreline palms.'));
  makeStreetDetails(group,scene,{box,tube,ground,facet,h:material,zRoads:HORIZONTAL_ROADS,xRoads:VERTICAL_ROADS,end:ROAD_END,sign});
  batch(group,scene);
  const atmosphere = makeAtmosphere(scene);
  return {colliders,buildings,cameraBlockers,update:atmosphere};
}

export const HAZE = 0xf1b996;
function makeAtmosphere(scene){
  const sky=new T.Mesh(new T.SphereGeometry(410,32,20),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,toneMapped:false,fog:false,
    vertexShader:`varying vec3 vDir; void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vDir;
      void main(){
        vec3 p=normalize(vDir), light=normalize(vec3(.46,.106,-.88));
        float up=max(0.,p.y), dotSun=max(0.,dot(p,light));
        vec3 c=mix(vec3(.99,.73,.59),vec3(.28,.46,.64),smoothstep(0.,.64,up));
        c=mix(c,vec3(1.,.86,.64),pow(dotSun,12.)*.62*exp(-up*5.));
        c=mix(c,vec3(1.,.89,.68),smoothstep(.99945,.9997,dotSun));
        gl_FragColor=vec4(c,1.);
      }`
  }));
  sky.frustumCulled=false;sky.renderOrder=-20;scene.add(sky);
  const clouds=new T.Group();
  const cloudGeo=new T.IcosahedronGeometry(1,1);
  const cloudMats=[0xffd0ad,0xf2baa8,0xf7bb9b,0xe2b9b3].map(color=>new T.MeshBasicMaterial({color,toneMapped:false,fog:false}));
  const positions=[[-148,32,-155,1],[-78,24,-183,.85],[57,43,-138,1.22],[161,38,-168,1.3],[264,34,-139,1.1],[253,51,-21,1.32],[238,37,108,.86],[203,44,191,1.25],[58,45,177,1.28],[-44,37,187,1],[-158,40,107,1.3]];
  positions.forEach(([x,y,z,k],i)=>{
    const group=new T.Group();group.position.set(x,y,z);
    for(let j=0;j<5;j++){
      const m=new T.Mesh(cloudGeo,cloudMats[(i+j)%cloudMats.length]);
      m.position.set(k*(j-2)*8,k*Math.sin(j*1.1)*1.7,k*Math.sin(j)*3);
      m.scale.set((12+Math.cos(j)*3)*k,(1.65+Math.sin(j*1.7)*.59)*k,(4.8+Math.cos(j))*k);group.add(m);
    }
    clouds.add(group);
  });
  scene.add(clouds);
  const waveMat=new T.ShaderMaterial({
    uniforms:{time:{value:0}},transparent:true,depthWrite:false,toneMapped:false,
    vertexShader:`varying vec3 world;void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`uniform float time;varying vec3 world;
      void main(){
        float crest=167.2+.77*sin(time*1.55+world.z*.17)+.28*sin(world.z*.6-time);
        float along=world.x-crest;
        float foam=exp(-abs(along)*5.)*.79;
        foam+=exp(-abs(along-2.1-.4*sin(time+world.z*.26))*4.)*.36;
        float water=smoothstep(-.32,.34,along)*(1.-smoothstep(8.,15.,along));
        vec3 col=mix(vec3(.33,.64,.67),vec3(1.,.93,.78),clamp(foam*1.26,0.,1.));
        float edge=1.-smoothstep(74.,79.,abs(world.z));
        float fade=1.-smoothstep(100.,245.,distance(cameraPosition,world));
        gl_FragColor=vec4(col,clamp(max(foam,water*.56),0.,1.)*edge*fade);
      }`
  });
  const waves=new T.Mesh(new T.PlaneGeometry(21,158),waveMat);
  waves.rotation.x=-Math.PI/2;waves.position.set(174,.025,0);scene.add(waves);
  let clock=0;
  return (dt,camera)=>{clock+=dt;sky.position.copy(camera.position);waveMat.uniforms.time.value=clock;clouds.position.x=6*Math.sin(clock*.013);};
}
