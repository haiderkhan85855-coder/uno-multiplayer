import * as T from 'three';
import { box, tube, material } from './town.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const rubber=0x292d35, glass=0x354f68, black=0x323b43, cream=0xffebbc;
function wheel(parent,x,y,z,r,width) {
  const spin=new T.Group();spin.position.set(x,y,z);parent.add(spin);
  tube(spin,rubber,[-width/2,0,0],[width/2,0,0],r,r,14);
  tube(spin,0xc6c6b8,[-width/2-.012,0,0],[width/2+.012,0,0],r*.54,r*.54,12);
  box(spin,0x777f81,width+.027,r*.60,r*.13);
  return spin;
}
function car(color) {
  const mesh=new T.Group(), wheels=[];
  for(const x of [-.86,.86]) for(const z of [-1.27,1.23]) wheels.push(wheel(mesh,x,.36,z,.36,.30));
  box(mesh,color,1.78,.54,3.82,0,.64,0);
  box(mesh,color,1.70,.19,3.49,0,.96,.09);
  box(mesh,black,1.80,.18,3.92,0,.42,0);
  box(mesh,color,1.64,.15,1.04,0,1.00,-1.30);
  box(mesh,glass,1.45,.48,1.95,0,1.29,.24);
  box(mesh,color,1.51,.14,1.87,0,1.56,.25);
  for(const x of [-.74,.74]) {
    for(const z of [-.71,.37,1.2])box(mesh,color,.085,.53,.13,x,1.31,z);
    box(mesh,black,.12,.10,.35,x*1.25,1.13,-.64);
    box(mesh,cream,.29,.17,.061,x*.92,.75,-1.92);
    box(mesh,0xcb5449,.31,.16,.055,x*.95,.75,1.92);
    box(mesh,black,.055,.051,.22,x*1.21,.91,.43);
  }
  box(mesh,cream,.45,.12,.058,0,.58,-1.94);box(mesh,black,.72,.21,.055,0,.79,-1.917);
  box(mesh,cream,.45,.12,.058,0,.62,1.94);
  return {mesh,wheels};
}

function scooter(color) {
  const mesh=new T.Group(), wheels=[wheel(mesh,0,.285,-.66,.285,.15),wheel(mesh,0,.285,.66,.285,.16)];
  box(mesh,color,.43,.19,1.04,0,.37,.07);
  box(mesh,black,.39,.055,.79,0,.48,-.02);
  const rear=box(mesh,color,.53,.43,.77,0,.59,.50);rear.rotation.x=-.09;
  box(mesh,black,.40,.13,.61,0,.86,.43);
  box(mesh,0xe57256,.25,.135,.07,0,.64,.90);
  const shield=box(mesh,color,.43,.67,.17,0,.68,-.48);shield.rotation.x=-.19;
  const fender=box(mesh,color,.24,.10,.42,0,.58,-.66);fender.rotation.x=.095;
  tube(mesh,black,[0,.28,-.66],[0,1.18,-.44],.06);
  tube(mesh,black,[-.29,1.19,-.46],[.29,1.19,-.46],.053);
  for(const s of [-1,1]) {tube(mesh,black,[s*.22,1.18,-.46],[s*.30,1.36,-.52],.018);box(mesh,glass,.15,.095,.048,s*.32,1.38,-.52);}
  box(mesh,cream,.29,.18,.085,0,1.06,-.54);
  return {mesh,wheels};
}

function motorcycle(color) {
  const mesh=new T.Group(), wheels=[wheel(mesh,0,.30,-.78,.30,.19),wheel(mesh,0,.30,.77,.30,.23)];
  tube(mesh,black,[0,.32,.75],[0,.51,.02],.09);tube(mesh,black,[0,.46,.03],[0,.88,-.27],.12);
  box(mesh,0x9aa0a3,.41,.34,.46,0,.51,.035);
  const tank=box(mesh,color,.46,.30,.57,0,.79,-.23);tank.rotation.x=-.23;
  box(mesh,black,.36,.12,.65,0,.84,.37);box(mesh,color,.35,.14,.47,0,.75,.59);
  box(mesh,0xd64e48,.22,.09,.046,0,.78,.83);
  for(const dir of [-1,1])tube(mesh,0xb4b6ad,[dir*.12,.30,-.78],[dir*.12,1.01,-.44],.045);
  tube(mesh,black,[-.32,1.05,-.47],[.32,1.05,-.47],.049);
  box(mesh,cream,.31,.19,.12,0,.94,-.64);
  tube(mesh,0xb4b6ad,[.24,.42,.85],[.22,.39,-.13],.058);
  return {mesh,wheels};
}

function bikeWheel(parent,z) {
  const obj=new T.Group();obj.position.set(0,.35,z);parent.add(obj);
  for(const [color,r,thickness] of [[rubber,.316,.034],[0xcbd5ce,.283,.016]]) {
    const ring=new T.Mesh(new T.TorusGeometry(r,thickness,6,18),material(color));
    ring.rotation.y=Math.PI/2;ring.castShadow=true;obj.add(ring);
  }
  for(let i=0;i<4;i++) {
    const a=i*Math.PI/4,y=Math.cos(a)*.28,z=Math.sin(a)*.28;
    tube(obj,0xadbcbf,[0,y,z],[0,-y,-z],.009,.009,5);
  }
  tube(obj,black,[-.064,0,0],[.064,0,0],.036);
  return obj;
}
function bicycle(color) {
  const mesh=new T.Group(), wheels=[bikeWheel(mesh,-.73),bikeWheel(mesh,.69)];
  const crank=[0,.39,.12], seat=[0,.87,.28], head=[0,.84,-.49];
  for(const [a,b] of [[crank,seat],[seat,head],[head,crank]])tube(mesh,color,a,b,.036,.032);
  for(const s of [-1,1]) {
    tube(mesh,color,[s*.059,.35,.69],[s*.034,.87,.28],.022);
    tube(mesh,color,[s*.059,.35,.69],[s*.068,.39,.12],.025);
    tube(mesh,color,[s*.055,.35,-.73],[s*.028,.84,-.49],.028);
  }
  tube(mesh,0x9ba4a4,seat,[0,1.01,.33],.026);
  tube(mesh,0x9ba4a4,head,[0,1.07,-.40],.032);
  tube(mesh,black,[-.25,1.08,-.38],[.25,1.08,-.38],.025);
  box(mesh,black,.21,.071,.30,0,1.026,.31);
  box(mesh,0xee6a52,.12,.09,.045,0,.92,.44);
  for(const s of [-1,1]) {
    tube(mesh,black,[s*.092,.39,.12],[s*.092,.39+s*.11,.12-s*.10],.018);
    box(mesh,black,.13,.038,.09,s*.151,.39+s*.11,.12-s*.10);
  }
  return {mesh,wheels};
}

const fourWheels=['wheel-front-left','wheel-front-right','wheel-back-left','wheel-back-right'];
const roadModel=(id,scale)=>({url:`models/traffic/${id}.glb`,yaw:Math.PI,scale,wheelRadius:.3*scale,wheels:fourWheels,wheelDirection:-1,paint:true});
// Heading zero is forward along -Z. Dimensions and speeds use meters and seconds.
export const vehicleSpecs = [
  {id:'car',name:'Car',color:0xf6b52f,spawn:[3.15,24,0],max:21,reverse:6,accel:7,brake:17,drag:1.9,steer:1.60,radius:1.00,axle:1,range:3.45,camera:8.5,
    build:car,model:roadModel('sedan',1.52),lamps:[.69,.73,-1.91,1.94],variant:'Sedan'},
  {id:"scooter",name:"Scooter",color:0x39bfb7,spawn:[-17,3.7,-Math.PI/2],max:13.7,reverse:3.7,accel:5.8,brake:12,drag:2.0,steer:2.46,radius:.38,axle:.55,range:2.4,camera:6.2,wheelRadius:.285,lean:.22,seat:[.91,.37],build:scooter,
    model:{url:'models/seafoam-scooter.glb',wheels:['FrontWheel','RearWheel'],seat:[.87,.36]}},
  {id:'motorcycle',name:'Motorcycle',color:0xed7150,spawn:[18,-3.65,Math.PI/2],max:26,reverse:4,accel:10,brake:16,drag:2.6,steer:1.92,radius:.47,axle:.66,range:2.65,camera:6.9,wheelRadius:.30,lean:.30,seat:[.89,.40],build:motorcycle,
    model:{url:'models/kenney-motorcycle.glb',yaw:Math.PI, wheels:['wheel-front','wheel-back'],wheelDirection:-1}},
  {id:'bicycle',name:'Bicycle',color:0x81ac62,spawn:[74.2,17,Math.PI],max:8.5,reverse:2.9,accel:3.8,brake:10,drag:1.15,steer:3.10,radius:.34,axle:.58,range:2.35,camera:5.8,wheelRadius:.35,lean:.23,seat:[1.06,.31],build:bicycle,
    model:{url:'models/quaternius-bicycle.glb',scale:1.12,yaw:Math.PI,wheelRadius:.338,wheelAxis:[0,1,0],wheels:['FrontWheel','BackWheel'],seat:[1.0,.35],palette:{Bike:0x81ac62,Handle:0xd8bd9a}}},
  {id:'suv',name:'SUV',color:0x58a495,spawn:[51.2,66,0],max:20,reverse:5.2,accel:6.4,brake:15,drag:2.2,steer:1.43,radius:1.02,axle:1.13,range:3.55,camera:8.9,
    build:car,model:roadModel('suv',1.47),lamps:[.70,.91,-2.09,2.04]},
  {id:'pickup',name:'Pickup',color:0xe1d3b5,spawn:[-51.3,-67,Math.PI],max:18.7,reverse:6.8,accel:5.9,brake:15,drag:1.75,steer:1.28,radius:1.02,axle:1.14,range:3.55,camera:9.2,
    build:car,model:roadModel('truck',1.54),lamps:[.69,.82,-2.10,2.08]},
  {id:'sports',name:'Sports Car',color:0xd44b49,spawn:[134.9,29,Math.PI],max:29,reverse:5.8,accel:10.6,brake:20,drag:2.7,steer:1.82,radius:.90,axle:1.00,range:3.40,camera:8.4,
    build:car,model:roadModel('sports',1.52),lamps:[.67,.65,-1.91,1.95]},
];

export function spawnVehicle(spec) {
  const root=new T.Group(), {mesh,wheels}=spec.build(spec.color);
  root.add(mesh);
  const vehicle={...spec,root,mesh,wheels,speed:0,heading:0};
  pivotWheels(vehicle,w=>w.position.z<-.25);
  if(spec.lamps)vehicle.lighting=makeLights(vehicle);
  resetVehicle(vehicle);
  if(spec.model) mountAsset(vehicle);
  return vehicle;
}
export function resetVehicle(v) {
  const [x,z,heading]=v.spawn;
  v.root.position.set(x,.035,z);v.heading=heading;v.root.rotation.y=heading;v.mesh.rotation.set(0,0,0);v.speed=0;v.fall=0;v.steering=0;updateVehicleLights(v,false,false);
}

const loader = new GLTFLoader(), assets=new Map(), axleAxis=new T.Vector3(1,0,0);
function loadAsset(url){
  if(!assets.has(url))assets.set(url,loader.loadAsync(url));
  return assets.get(url);
}
function mountAsset(v) {
  const {url,yaw=0,scale=1,wheels=[],wheelDirection=1,wheelAxis,matte=false,paint=false,palette={},wheelRadius,seat}=v.model;
  loadAsset(url).then(({scene:asset})=>{
    const scene=asset.clone(true);
    scene.rotation.y=yaw;scene.scale.setScalar(scale);
    const used=new Map();
    scene.traverse(obj=>{
      if(!obj.isMesh)return;
      const tune=m=>{
        const body=obj.name==='body'||obj.name==='spoiler';
        const key=`${m.id}:${body}`;
        if(used.has(key))return used.get(key);
        const out=m.clone();
        if(matte){out.metalness=0;out.roughness=.87;}
        if(paint){out.metalness=body?.22:.06;out.roughness=body?.38:.74;out.envMapIntensity=body?.66:.34;}
        if(Object.hasOwn(palette,out.name))out.color.setHex(palette[out.name]);
        used.set(key,out);return out;
      };
      obj.material=Array.isArray(obj.material)?obj.material.map(tune):tune(obj.material);
      obj.castShadow=obj.receiveShadow=true;
    });
    const wrapper=new T.Group();wrapper.add(scene);
    const ground=new T.Box3().setFromObject(wrapper).min.y;
    scene.position.y=-ground;
    wrapper.rotation.copy(v.mesh.rotation);
    if(v.lighting)wrapper.add(v.lighting.parts);
    // Riders and attachments live under mesh and transfer if the asset loads mid-ride.
    for(const child of v.attachments?.slice()??[])wrapper.add(child);
    v.mesh.traverse(obj=>{if(obj.isMesh)obj.geometry.dispose();});
    v.root.remove(v.mesh);v.mesh=wrapper;v.root.add(wrapper);
    v.wheels=wheels.map(name=>scene.getObjectByName(name)).filter(Boolean);
    pivotWheels(v,w=>/front/i.test(w.name));
    v.wheelDirection=wheelDirection;
    if(wheelRadius)v.wheelRadius=wheelRadius;
    if(wheelAxis)v.wheelAxis=new T.Vector3(...wheelAxis);
    if(seat){v.seat=seat;for(const rider of v.attachments??[])rider.position.set(0,seat[0]-.69,seat[1]);}
  }).catch(() => console.info(`Using the low-poly fallback for ${v.name}.`));
}

function pivotWheels(v,isFront){
  v.frontPivots=[];
  for(const wheel of v.wheels){
    if(!isFront(wheel))continue;
    const p=new T.Group();p.position.copy(wheel.position);wheel.parent.add(p);p.add(wheel);wheel.position.set(0,0,0);v.frontPivots.push(p);
  }
}
export function animateWheels(v,dt,speed,turn){
  v.steering=T.MathUtils.lerp(v.steering??0,turn*.46,1-Math.exp(-12*dt));
  for(const p of v.frontPivots)p.rotation.y=v.steering;
  for(const wheel of v.wheels)wheel.rotateOnAxis(v.wheelAxis??axleAxis,-speed*dt*(v.wheelDirection??1)/(v.wheelRadius??.36));
}
const lampOff=0xccd6d8, frontGlow=new T.Color(0xffe9b9), rearGlow=new T.Color(0xff2922);
const lensGeo=new T.BoxGeometry(.32,.118,.025);
function makeLights(v){
  const [x,y,front,rear]=v.lamps,parts=new T.Group();v.mesh.add(parts);
  const head=new T.MeshStandardMaterial({color:lampOff,roughness:.47});
  const tail=new T.MeshStandardMaterial({color:0x9e2b27,roughness:.49});
  for(const s of [-1,1]){
    const a=new T.Mesh(lensGeo,head);a.position.set(s*x,y,front-.02);parts.add(a);
    const b=new T.Mesh(lensGeo,tail);b.position.set(s*x,y-.01,rear+.025);parts.add(b);
  }
  return {parts,head,tail};
}
export function updateVehicleLights(v,lit,braking){
  if(!v.lighting)return;
  const {head,tail}=v.lighting;
  head.emissive.copy(frontGlow);head.emissiveIntensity=lit?1.9:0;
  tail.emissive.copy(rearGlow);tail.emissiveIntensity=braking?2.7:lit?.43:0;
}
