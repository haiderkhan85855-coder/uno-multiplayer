import * as T from 'three';

// A tiny generated HDR-like sky supplies broad reflections without a network texture.
export function makeSunsetEnvironment(renderer,scene){
  const width=128,height=64, pixels=new Float32Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const v=y/(height-1),angle=x/width*Math.PI*2, horizon=Math.exp(-Math.pow((v-.51)*5.5,2));
    const sun=Math.pow(Math.max(0,Math.cos(angle-2.3)),42)*Math.exp(-Math.pow((v-.44)*16,2));
    const sky=Math.max(0,1-v*1.62),i=(y*width+x)*4;
    pixels[i]=.14+sky*.29+horizon*.49+sun*4;
    pixels[i+1]=.16+sky*.42+horizon*.25+sun*2.66;
    pixels[i+2]=.19+sky*.65+horizon*.13+sun*1.41;pixels[i+3]=1;
  }
  const source=new T.DataTexture(pixels,width,height,T.RGBAFormat,T.FloatType);
  source.mapping=T.EquirectangularReflectionMapping;source.needsUpdate=true;
  const pmrem=new T.PMREMGenerator(renderer);const env=pmrem.fromEquirectangular(source);
  scene.environment=env.texture;scene.environmentIntensity=.48;
  source.dispose();pmrem.dispose();
}

export function aggregateTexture(sidewalk=false){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'), image=ctx.createImageData(128,128);
  let seed=sidewalk?476:704;
  const plaster=sidewalk==='plaster';
  function rand(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const broad=Math.sin(x*Math.PI/32)*Math.cos(y*Math.PI/32)*4;
    const tone=(plaster?244:215)+broad+(rand()-.5)*(plaster?13:sidewalk?24:34);
    const seam=sidewalk&&!plaster&&(x%32===0||y%32===0)?14:0, i=(y*128+x)*4;
    image.data[i]=image.data[i+1]=image.data[i+2]=tone-seam;image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  const tex=new T.CanvasTexture(canvas);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  return tex;
}

export function makeStreetDetails(group,scene,{box,tube,ground,facet,h,zRoads,xRoads,end,sign}){
  const steel=0x49545a, stone=0xc5b7a5;
  for(const z of zRoads)for(const side of [-1,1]){
    for(let x=-76;x<end-2;x+=2.85){
      if(xRoads.some(v=>Math.abs(v-x)<8.6))continue;
      box(group,stone,2.79,.10,.24,x,.071,z+side*6.06);
    }
  }
  for(const x of xRoads)for(const side of [-1,1]){
    for(let z=-75;z<76;z+=2.85){
      if(zRoads.some(v=>Math.abs(v-z)<8.6))continue;
      box(group,stone,.24,.10,2.79,x+side*6.06,.072,z);
    }
  }
  for(const [x,z] of [[1.4,18],[-2,40],[0,-31],[49,34],[94,19],[133,43],[17,-2],[62,2],[117,1],[-24,2],[40,46],[109,-46],[-52,-30],[133,-19]]){
    const cover=new T.Mesh(new T.CylinderGeometry(.39,.39,.028,16),h(0x555457));cover.position.set(x,.047,z);group.add(cover);
    for(let i=-2;i<=2;i++)box(group,0x3d4143,.036,.012,.58-Math.abs(i)*.055,x+i*.12,.065,z).castShadow=false;
  }
  const puddleMat=new T.MeshPhysicalMaterial({color:0x536875,metalness:.44,roughness:.095,clearcoat:.96,clearcoatRoughness:.12,transparent:true,opacity:.72,polygonOffset:true,polygonOffsetFactor:-2});
  puddleMat.envMapIntensity=1.7;
  for(const [x,z,w,d,angle] of [[5.1,31,1.94,.77,.13],[-4.55,16,1.69,.53,.4],[41,3.8,2.1,.70,.07],[92,3.45,1.86,.65,.74],[130,61,.83,1.35,0],[26,49,1.81,.54,.11],[139,-1.5,1.64,.7,.17],[-20,-45,1.7,.50,.2]]){
    const shape=new T.Shape();for(let i=0;i<18;i++){
      const a=i*Math.PI/9,scale=1+.13*Math.sin(i*3.78)+.08*Math.cos(i*1.5);
      shape[i===0?'moveTo':'lineTo'](Math.cos(a)*w*scale,Math.sin(a)*d*scale);
    }shape.closePath();
    const mesh=new T.Mesh(new T.ShapeGeometry(shape),puddleMat);mesh.rotation.set(-Math.PI/2,0,angle);mesh.position.set(x,.048,z);scene.add(mesh);
  }
  function bin(x,z,c=0x4b625f){
    tube(group,c,[x,.10,z],[x,.83,z],.25,.29,10);
    tube(group,steel,[x,.79,z],[x,.86,z],.29,.31,10);box(group,0x323b40,.29,.025,.15,x,.875,z);
  }
  for(const [x,z] of [[6.75,10.3],[-7.2,37.4],[28,6.95],[56,-7],[77.7,4.9],[107,6.9],[120.6,7],[139.45,20],[145.4,-31],[149,62],[-38.4,-7],[-7,-27.3]])bin(x,z);
  const shelterGlass=new T.MeshStandardMaterial({color:0x86a6aa,transparent:true,opacity:.32,depthWrite:false,roughness:.24,metalness:.10,side:T.DoubleSide});
  for(const [x,z,facing,station] of [[10.75,8.04,Math.PI,'SUNSET LINE · 01'],[107.4,-7.75,0,'LANTERN TRANSIT'],[140.4,33.6,-Math.PI/2,'BOARDWALK STOP']]){
    const p=new T.Group();p.position.set(x,0,z);p.rotation.y=facing;group.add(p);
    for(const i of [-1,1]){
      box(p,steel,.105,2.74,.1,i*1.58,1.38,-.64);
      box(p,steel,.105,2.74,.1,i*1.58,1.38,.58);
      box(p,0x766954,.12,.47,.48,i*1.05,.37,-.39);
    }
    box(p,0x435e62,3.46,.18,1.65,0,2.73,0);box(p,0xaf815a,2.54,.10,.43,0,.59,-.39);
    const screen=new T.Group();screen.position.copy(p.position);screen.rotation.copy(p.rotation);scene.add(screen);
    const glass=new T.Mesh(new T.PlaneGeometry(3.1,1.78),shelterGlass);glass.position.set(0,1.47,-.66);screen.add(glass);
    sign(screen,station,0,2.54,.67,2.9,.24,'#2d535e','#ffe7b2');
  }
  for(const [x,z,yaw,label] of [[-1.4,-16.6,0,'↑  MARKET FLYOVER'],[-1.4,-75.7,Math.PI,'↑  MARKET FLYOVER'],[150.7,-72,Math.PI,'↑  COAST VIADUCT'],[150.6,72,0,'↑  COAST VIADUCT'],[73.2,-6.7,0,'LANTERN BAY  →'],[136.6,6.5,0,'SUNSET BEACH  →']]){
    const t=new T.Group();t.position.set(x,.06,z);t.rotation.y=yaw;group.add(t);
    tube(t,steel,[0,0,0],[0,2.34,0],.058);box(t,0x28464d,2.79,.56,.09,0,2.30,0);
    const s=new T.Group();s.position.copy(t.position);s.rotation.copy(t.rotation);scene.add(s);
    sign(s,label,0,2.30,.054,2.7,.48,'#315755','#f6ebcc');
  }
  let seed=1758;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const beds=[[-36,-38],[-12,-38],[-36,-10],[-12,-10],[56,10],[70,10],[56,36],[69,37],[105,13],[122,14],[106,36],[123,36],[7,36],[-7,-32],[41,7],[141,39],[142,-37],[152,43]];
  for(const [x,z] of beds){
    ground(group,0x6e7a4e,2.12,1.48,x,z,.112);
    for(let j=0;j<4;j++)facet(group,[0x6c8751,0x597749,0x83965d][j%3],.51,x+(j-1.5)*.39,.32+.20*rand(),z+.26*(rand()-.5),1,.76,.9);
    for(let j=0;j<10;j++){
      const gx=x+(rand()-.5)*1.8,gz=z+(rand()-.5)*1.3,gh=.13+rand()*.20;
      tube(group,0x657649,[gx,.10,gz],[gx+.035,.10+gh,gz+.026],.013,.005,4);
      if(j<6)facet(group,[0xe28b75,0xe8b63d,0xe8dbb2,0xae849b][j%4],.082,gx+.035,.12+gh,gz+.026,1,.42,1);
    }
  }
  const grass=new T.BufferGeometry();grass.setAttribute('position',new T.Float32BufferAttribute([-.044,0,0,.032,0,0,.060,.27,.019,-.049,0,.04,.02,0,.015,-.025,.20,.091,0,0,-.05,.041,0,.034,.02,.17,-.09],3));grass.computeVertexNormals();
  const blades=new T.InstancedMesh(grass,new T.MeshStandardMaterial({color:0xabbd72,roughness:1,side:T.DoubleSide}),beds.length*33);
  const stamp=new T.Object3D();
  for(const [i,[x,z]] of beds.entries())for(let j=0;j<33;j++){
    stamp.position.set(x+(rand()-.5)*3.4,.10,z+(rand()-.5)*2.65);stamp.rotation.y=rand()*6.283;const scale=.37+rand()*.85;stamp.scale.set(scale,scale,scale);stamp.updateMatrix();
    blades.setMatrixAt(i*33+j,stamp.matrix);blades.setColorAt(i*33+j,new T.Color().setHSL(.24+rand()*.07,.27+rand()*.24,.42+rand()*.22));
  }
  blades.receiveShadow=true;scene.add(blades);
}
