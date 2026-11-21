import * as T from 'three';
import { mergeGeometries } from './vendor/utils/BufferGeometryUtils.js';

// The same piecewise-linear profiles drive the render mesh, physics, and minimap.
export const flyovers=[
  {name:'Market Flyover',x:-3.1,width:5.5,profile:[[-74,0],[-56,5.4],[-39,5.4],[-19,0]],piers:[-58,-38],gaps:[[-55,-52],[-44,-41]]},
  {name:'Coast Viaduct',x:155,width:6.8,profile:[[-73,0],[-52,6.1],[52,6.1],[73,0]],piers:[-55,-36,-14,14,35,55],gaps:[[-25,-18],[18,25]]},
];
export const GROUND=.04;
export function heightAt(bridge,z){
  const points=bridge.profile;
  for(let i=1;i<points.length;i++){
    const [a,u]=points[i-1],[b,v]=points[i];
    if(z>=a&&z<=b)return u+(v-u)*(z-a)/(b-a);
  }
  return null;
}
function bridgeAt(x,z){
  for(const b of flyovers)if(Math.abs(x-b.x)<=b.width*.5){const h=heightAt(b,z);if(h!==null)return b;}
  return null;
}
export function deckAt(x,z){const b=bridgeAt(x,z);return b?heightAt(b,z)+GROUND:null;}
export function surfaceAt(x,z,y,step=.28){
  const deck=deckAt(x,z);
  return deck!==null&&deck<=y+step?deck:GROUND;
}
export function onFlyover(x,z,y){const b=bridgeAt(x,z);return b&&y>1.15&&Math.abs(y-heightAt(b,z)-GROUND)<.46?b:null;}
function railGap(b,z){return b.gaps.some(([a,c])=>z>=a&&z<=c);}
export function bridgeBlocks(x,z,r,y,bodyHeight){
  for(const b of flyovers){
    const h=heightAt(b,z);if(h===null)continue;
    const cross=Math.abs(x-b.x),edge=b.width/2;
    if(cross-r>=edge+.08)continue;
    const deck=h+GROUND;
    // The deck remains solid from the side, but there is clearance on the street below.
    if(y<deck-.29&&y+bodyHeight>deck-.44)return true;
    if(h>.55&&y>=deck-.21&&y<deck+1&&Math.abs(cross-edge)<r+.035&&!railGap(b,z))return true;
  }
  return false;
}
export function deckOccludes(x,z,y){const h=deckAt(x,z);return h!==null&&y<=h+.11&&y>=h-.48;}

export function makeFlyovers(scene){
  const palette={concrete:0xb9a99a,fascia:0x8a8179,asphalt:0x494e55,white:0xece2cc,gold:0xe2ae59,steel:0x727c7f,dark:0x414a4d};
  const sets={};
  function cuboid(key,x,y,z,w,h,d,pitch=0){
    const geo=new T.BoxGeometry(w,h,d);geo.rotateX(pitch);geo.translate(x,y,z);
    (sets[key]??=[]).push(geo);
  }
  function strip(b,key,x,w,thick,start,end,raise){
    const a=heightAt(b,start), c=heightAt(b,end), length=Math.hypot(end-start,c-a);
    cuboid(key,x,(a+c)/2+GROUND+raise,(start+end)/2,w,thick,length+.018,-Math.atan2(c-a,end-start));
  }
  const piers=[];
  for(const b of flyovers){
    for(let i=1;i<b.profile.length;i++){
      const a=b.profile[i-1][0],c=b.profile[i][0];
      strip(b,'concrete',b.x,b.width,.38,a,c,-.20);
      strip(b,'asphalt',b.x,b.width-.28,.075,a,c,-.023);
      for(const s of [-1,1]){
        strip(b,'fascia',b.x+s*(b.width/2-.08),.20,.25,a,c,-.26);
        strip(b,'white',b.x+s*(b.width/2-.32),.09,.016,a,c,.024);
      }
      for(let z=a+.5;z<c-1.9;z+=4.1)strip(b,'gold',b.x,.1,.017,z,z+1.8,.026);
      const breaks=[a,c,...b.gaps.flat().filter(z=>z>a&&z<c)].sort((x,y)=>x-y);
      for(let j=1;j<breaks.length;j++){
        const lo=breaks[j-1],hi=breaks[j];if(railGap(b,(lo+hi)/2))continue;
        for(const s of [-1,1]){
          const x=b.x+s*(b.width/2-.06);
          for(const [y,h] of [[.42,.14],[.84,.13]])strip(b,'steel',x,.14,h,lo,hi,y);
          for(let z=lo+.64;z<hi;z+=3.45)cuboid('dark',x,heightAt(b,z)+.44,z,.14,.88,.18);
        }
      }
    }
    for(const z of b.piers){
      const h=heightAt(b,z)-.38;
      cuboid('concrete',b.x,h*.5,z,1.05,h,1.25);
      cuboid('concrete',b.x,h-.17,z,b.width-.65,.33,1.25);
      cuboid('fascia',b.x,.16,z,1.54,.32,1.7);
      piers.push({x:b.x,z,w:1.12,d:1.3,h:h-.05,bridgePier:true});
    }
  }
  for(const [key,geos] of Object.entries(sets)){
    const mesh=new T.Mesh(mergeGeometries(geos),new T.MeshStandardMaterial({color:palette[key],roughness:.86}));
    geos.forEach(g=>g.dispose());mesh.castShadow=key!=='white'&&key!=='gold';mesh.receiveShadow=true;scene.add(mesh);
  }
  return piers;
}
