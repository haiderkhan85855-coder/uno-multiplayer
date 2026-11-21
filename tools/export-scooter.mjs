// Offline authoring tool only. The shipped game loads the finished GLB with no build step.
// npm install --no-save --no-package-lock @gltf-transform/core
import * as T from '../vendor/three.module.js';
import { Document, NodeIO } from '@gltf-transform/core';

const doc=new Document(), buffer=doc.createBuffer(), scene=doc.createScene('Seafoam Scooter');
const root=doc.createNode('Scooter');scene.addChild(root);
const material=(name,hex,r=.75)=>doc.createMaterial(name).setBaseColorFactor([...new T.Color(hex).toArray(),1]).setMetallicFactor(0).setRoughnessFactor(r);
const shell=material('Seafoam enamel',0x46b7a9,.48), edge=material('Cream accent',0xf6ddbd);
const frame=material('Dark teal steel',0x29575d), black=material('Rubber',0x283139), leather=material('Saddle leather',0x583d36);
const chrome=material('Brushed aluminum',0xb2c4be), lamp=material('Headlight glass',0xffe6a5), red=material('Brake light',0xe67958);
function node(parent,name,[x=0,y=0,z=0]=[], rotation=[0,0,0]){
  const n=doc.createNode(name).setTranslation([x,y,z]).setRotation(new T.Quaternion().setFromEuler(new T.Euler(...rotation)).toArray());parent.addChild(n);return n;
}
function mesh(parent,name,geometry,mat,position=[],rotation=[]){
  const prim=doc.createPrimitive().setMaterial(mat);
  for(const [key,semantic] of [['position','POSITION'],['normal','NORMAL']]){
    prim.setAttribute(semantic,doc.createAccessor().setType('VEC3').setArray(geometry.getAttribute(key).array).setBuffer(buffer));
  }
  if(geometry.index)prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(geometry.index.array).setBuffer(buffer));
  const obj=doc.createMesh(name).addPrimitive(prim);node(parent,name,position,rotation).setMesh(obj);
  geometry.dispose();
}
function capsule(parent,name,mat,p,scale,rot=[]){const g=new T.SphereGeometry(1,12,8);g.scale(...scale);mesh(parent,name,g,mat,p,rot);}
function link(parent,name,mat,a,b,r,tip=r){
  const start=new T.Vector3(...a),end=new T.Vector3(...b), delta=end.clone().sub(start);
  const mid=start.addScaledVector(delta,.5);
  const g=new T.CylinderGeometry(tip,r,delta.length(),9);
  const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
  g.applyQuaternion(q);mesh(parent,name,g,mat,mid.toArray());
}
function sidePanel(name,mat,outline,width,bevel){
  const shape=new T.Shape(outline.map(([y,z])=>new T.Vector2(-z,y)));
  const g=new T.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSegments:2,bevelSize:bevel,bevelThickness:bevel,steps:1});
  g.translate(0,0,-width/2);g.rotateY(Math.PI/2);mesh(root,name,g,mat);
}
sidePanel('Step-through body',shell,[[.32,-.34],[.43,-.36],[.72,-.51],[.90,-.50],[.91,-.41],[.73,-.32],[.47,-.24],[.46,.23],[.58,.33],[.64,.61],[.56,.77],[.36,.71],[.30,.23]],.32,.045);
capsule(root,'Front apron',shell,[0,.70,-.43],[.26,.30,.077],[-.24,0,0]);
capsule(root,'Rear engine cover',shell,[0,.51,.53],[.284,.257,.45]);
capsule(root,'Step pad',black,[0,.455,-.015],[.216,.032,.455]);
capsule(root,'Leather double seat',leather,[0,.78,.37],[.214,.098,.389],[.08,0,0]);
capsule(root,'Saddle piping',edge,[0,.742,.37],[.219,.045,.383],[.08,0,0]);
capsule(root,'Front mudguard',shell,[0,.516,-.69],[.163,.101,.315]);
capsule(root,'Tail light',red,[0,.577,.933],[.127,.064,.043]);
for(const i of [-1,1]){
  link(root,'Fork stay',chrome,[i*.069,.286,-.69],[i*.060,1.035,-.447],.037,.031);
  link(root,'Rear strut',chrome,[i*.11,.286,.67],[i*.193,.56,.50],.036,.027);
  link(root,'Mirror stem',chrome,[i*.196,1.115,-.448],[i*.302,1.29,-.465],.014);
  capsule(root,'Mirror housing',frame,[i*.306,1.30,-.467],[.089,.058,.027]);
  capsule(root,'Mirror glass',chrome,[i*.307,1.30,-.444],[.075,.047,.009]);
  link(root,'Rear chrome strip',chrome,[i*.238,.544,.32],[i*.229,.544,.747],.019,.012);
}
link(root,'Handlebar',frame,[-.284,1.105,-.449],[.284,1.105,-.449],.04);
capsule(root,'Steering cowl',shell,[0,1.06,-.444],[.221,.108,.125]);
capsule(root,'Headlight rim',chrome,[0,1.06,-.546],[.116,.105,.034]);
capsule(root,'Headlight',lamp,[0,1.06,-.574],[.094,.085,.022]);
for(const [name,z] of [['FrontWheel',-.69],['RearWheel',.67]]){
  const wheelNode=node(root,name,[0,.285,z]);
  mesh(wheelNode,'Tire',new T.TorusGeometry(.222,.063,9,18),black,[0,0,0],[0,Math.PI/2,0]);
  link(wheelNode,'Rim',chrome,[-.067,0,0],[.067,0,0],.167);
  for(const i of [-1,1]){
    for(let t=0;t<5;t++){
      const a=t*(Math.PI*2/5);
      link(wheelNode,'Hub detail',frame,[i*.071,0,0],[i*.073,.124*Math.cos(a),.124*Math.sin(a)],.018);
    }
    capsule(wheelNode,'Axle cover',chrome,[i*.086,0,0],[.022,.056,.056]);
  }
}
await new NodeIO().write(new URL('../models/seafoam-scooter.glb',import.meta.url).pathname,doc);
