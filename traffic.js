import * as T from 'three';
import { box, tube } from './town.js';
import { spawnVehicle, vehicleSpecs, animateWheels, updateVehicleLights } from './vehicles.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { clone } from './vendor/utils/SkeletonUtils.js';

const junctions=[[0,0],[48,0],[96,0],[132,0],[48,-48],[96,-48], [48,48],[96,48]];
const lampColors=[0xff3831,0xffb62c,0x55ee9a];
export function createSignals(scene){
  const pole=0x414a4b, boxColor=0x2b3235;
  const bulbGeo=new T.CylinderGeometry(.115,.115,.035,12);bulbGeo.rotateX(Math.PI/2);
  const lights=junctions.map(([x,z],i)=>{
    const heads=[];
    for(const [sx,sz,yaw,axis] of [[1,1,0,'z'],[-1,-1,Math.PI,'z'],[1,-1,Math.PI/2,'x'],[-1,1,-Math.PI/2,'x']]){
      const pivot=new T.Group();pivot.position.set(x+sx*6.88,0,z+sz*6.88);pivot.rotation.y=yaw;scene.add(pivot);
      box(pivot,0xa7a49a,.44,.17,.44,0,.087,0);
      tube(pivot,pole,[0,.12,0],[0,3.58,0],.075,.062);
      const out=-1.95;
      box(pivot,pole,1.97,.10,.10,out*.5,3.50,0);
      box(pivot,boxColor,.40,1,.34,out,3.26,.05);
      const bulbs=lampColors.map((color,j)=>{
        const mat=new T.MeshStandardMaterial({color:new T.Color(color).multiplyScalar(.45),emissive:color,emissiveIntensity:0,roughness:.57});
        const mesh=new T.Mesh(bulbGeo,mat);mesh.position.set(out,3.56-j*.30,.25);pivot.add(mesh);
        box(pivot,boxColor,.265,.046,.16,out,3.68-j*.30,.27);return mat;
      });
      // Stop lines hug the real zebra crossings rather than spanning the whole junction.
      const line=box(pivot,0xe9e0ca,5.17,.014,.17,out*1.65,.051,2.1);line.castShadow=false;
      heads.push({axis,bulbs});
    }
    return {x,z,heads,offset:i*3.33,last:null};
  });
  let elapsed=0;
  function state(junction,axis){
    const t=(elapsed+junction.offset)%23;
    if(axis==='z')return t<8.5?2:t<10.4?1:0;
    return t>=11.5&&t<20?2:t>=20&&t<21.9?1:0;
  }
  function tick(dt,player){
    elapsed+=dt;
    for(const signal of lights){
      const phases=[state(signal,'x'),state(signal,'z')];
      const key=phases.join(',');if(key===signal.last)continue;
      signal.last=key;
      for(const {axis,bulbs} of signal.heads)bulbs.forEach((m,i)=>{m.emissiveIntensity=i===phases[axis==='x'?0:1]?3.8:0;});
    }
  }
  tick(0);
  return {lights,state,tick};
}

const posAt=(lane,d)=>lane.path.getPoint(((d%lane.length)+lane.length)%lane.length/lane.length);
function makeLane(corners){
  const points=corners.map(([x,z])=>new T.Vector3(x,.045,z)),path=new T.CurvePath();
  const stops=points.map((p,i)=>{
    const old=points.at(i-1),next=points[(i+1)%points.length];
    const a=p.clone().sub(old).normalize(),b=next.clone().sub(p).normalize();
    const c=p.clone().add(new T.Vector3(-a.z-b.z,0,a.x+b.x).multiplyScalar(2.67));
    const round=4.8;
    return [c.clone().addScaledVector(a,-round),c,c.clone().addScaledVector(b,round)];
  });
  for(let i=0;i<stops.length;i++){
    const [a,b,c]=stops[i];path.add(new T.QuadraticBezierCurve3(a,b,c));path.add(new T.LineCurve3(c,stops[(i+1)%stops.length][0]));
  }
  return {path,length:path.getLength()};
}
const deltaAngle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function makeTraffic(scene,signals){
  const loops=[
    [[-48,-48],[48,-48],[48,0],[-48,0]],
    [[0,0],[48,0],[48,48],[0,48]],
    [[48,-48],[96,-48],[96,0],[48,0]],
    [[96,0],[132,0],[132,48],[96,48]],
  ];
  const lanes=loops.flatMap(r=>[r,[...r].reverse()]).map(makeLane);
  const variants=vehicleSpecs.filter(v=>v.lamps);
  const cars=lanes.map((lane,i)=>{
    const v=spawnVehicle(variants[i%variants.length]);scene.add(v.root);
    const line=[];
    for(let d=0;d<lane.length;d+=.36){
      const p=posAt(lane,d), ahead=posAt(lane,d+.6), dx=ahead.x-p.x,dz=ahead.z-p.z;
      const axis=Math.abs(dx)>Math.abs(dz)?'x':'z';
      for(const signal of signals.lights){
        const along=axis==='x'?signal.x-p.x:signal.z-p.z, across=axis==='x'?signal.z-p.z:signal.x-p.x;
        if(Math.sign(along)!==Math.sign(axis==='x'?dx:dz)||Math.abs(across)>5||Math.abs(Math.abs(along)-8.2)>.44)continue;
        if(!line.some(l=>l.signal===signal&&Math.abs(d-l.d)<17))line.push({d,axis,signal});
      }
    }
    const d=(13+i*19.1)%lane.length;
    return {v,lane,line,d,speed:0,limit:7.5+(i%4)*.89,stopped:false};
  });
  function tick(dt,player){
    for(const [i,car] of cars.entries()){
      const {v,lane,line}=car, p=posAt(lane,car.d), ahead=posAt(lane,car.d+.66);
      let max=car.limit, stop=null;
      for(const mark of line){
        const distance=(mark.d-car.d+lane.length)%lane.length;
        if(distance>19||signals.state(mark.signal,mark.axis)===2)continue;
        if(stop===null||stop>distance)stop=distance;
        max=Math.min(max,Math.sqrt(distance*8));
      }
      if(player.y<2&&p.distanceToSquared(player)<49)max=Math.min(max,2.3);
      for(const other of cars){
        if(other===car||!other.v.root.visible)continue;
        const dx=other.v.root.position.x-p.x,dz=other.v.root.position.z-p.z, ux=(ahead.x-p.x)/.66,uz=(ahead.z-p.z)/.66;
        const alongside=Math.abs(dx*uz-dz*ux),front=dx*ux+dz*uz;
        if(front>0&&front<7&&alongside<1.45)max=Math.min(max,Math.max(0,(front-3.8)*1.7));
      }
      car.speed+=T.MathUtils.clamp(max-car.speed,-9*dt,3.8*dt);
      const travel=car.speed*dt;
      car.stopped=stop!==null&&stop<=.04;
      car.d=(car.d+(stop===null?travel:Math.min(stop,travel)))%lane.length;
      if(car.stopped)car.speed=0;
      const pos=posAt(lane,car.d), dir=posAt(lane,car.d+.55), further=posAt(lane,car.d+2);
      v.root.position.copy(pos);v.heading=Math.atan2(pos.x-dir.x,pos.z-dir.z);v.root.rotation.y=v.heading;
      v.root.visible=pos.distanceToSquared(player)>2.65**2&&pos.distanceToSquared(player)<150**2;
      const angle=Math.atan2(dir.x-further.x,dir.z-further.z);
      animateWheels(v,dt,car.speed,T.MathUtils.clamp(deltaAngle(v.heading,angle)*3,-1,1));
      updateVehicleLights(v,true,max<car.limit-.5||car.stopped);
    }
  }
  return {cars,tick};
}

// Sidewalk routes deliberately avoid driving lanes; walkers yield sideways, not into traffic.
const walks=[[-6.9,10,-6.9,38,-1,0],[6.95,12,6.95,39,1,0],[10,6.87,39,6.87,0,1],[-38,-6.95,-10,-6.95,0,-1], [102.2,6.96,125.3,6.96,0,1],[149.1,28,149.1,61,1,0],[149.2,-64,149.2,-27,1,0]];
export function createPedestrians(scene){
  const shirts=[0x346879,0xfbcd87,0xa55046,0x51795f,0xbe806b,0x56679b,0x84a096];
  const walkers=walks.map(([x,z,endX,endZ,sideX,sideZ],i)=>{
    const root=new T.Group();scene.add(root);
    const fallback=new T.Group();root.add(fallback);
    const legs=[-.115,.115].map(x=>{const l=new T.Group();l.position.set(x,.65,0);fallback.add(l);box(l,0x34435a,.18,.61,.20,0,-.29,0);return l;});
    box(fallback,shirts[i],.45,.54,.28,0,.95,0);box(fallback,0xb57b5d,.25,.26,.26,0,1.39,0);
    const a=new T.Vector3(x,.07,z),b=new T.Vector3(endX,.07,endZ);
    return {root,fallback,legs,a,b,sideX,sideZ,offset:0,t:(i*.38)%1,dir:i%2?1:-1,heading:0};
  });
  new GLTFLoader().load('models/quaternius-runner.glb',({scene:base,animations})=>{
    const walk=animations.find(a=>a.name==='Walk'),idle=animations.find(a=>a.name==='Idle');if(!walk||!idle)return;
    walkers.forEach((w,i)=>{
      const model=clone(base);model.rotation.y=Math.PI;model.scale.setScalar(.48+(i%3)*.022);
      model.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;
        const tone=m=>{const copy=m.clone();if(m.name==='Shirt')copy.color.setHex(shirts[i]);return copy;};
        o.material=Array.isArray(o.material)?o.material.map(tone):tone(o.material);
      });
      const mixer=new T.AnimationMixer(model),moving=mixer.clipAction(walk).play(),still=mixer.clipAction(idle).play();
      still.setEffectiveWeight(0);moving.time=i*.29;
      w.model={mixer,moving,still};w.fallback.visible=false;w.root.add(model);
    });
  },undefined,()=>console.info('Using the procedural pedestrians.'));
  const basePos=new T.Vector3();let time=0;
  return {walkers,tick(dt,player,active,npcs){
    time+=dt;
    for(const [i,w] of walkers.entries()){
      const pos=basePos.lerpVectors(w.a,w.b,w.t);
      const near=active&&player.y<2&&Math.hypot(player.x-pos.x,player.z-pos.z)<5.2;
      const alongside=npcs.some(({v})=>v.root.visible&&Math.hypot(v.root.position.x-pos.x,v.root.position.z-pos.z)<3.4);
      const yieldTo=near||alongside;
      w.offset=T.MathUtils.lerp(w.offset,yieldTo?.83:0,1-Math.exp(-dt*5));
      if(!yieldTo){
        w.t+=w.dir*(1.22+(i%3)*.11)*dt/w.a.distanceTo(w.b);
        if(w.t<0||w.t>1){w.t=T.MathUtils.clamp(w.t,0,1);w.dir*=-1;}
      }
      w.root.position.set(pos.x+w.sideX*w.offset,pos.y,pos.z+w.sideZ*w.offset);
      const angle=Math.atan2((w.a.x-w.b.x)*w.dir,(w.a.z-w.b.z)*w.dir);
      w.heading+=deltaAngle(w.heading,angle)*(1-Math.exp(-dt*10));w.root.rotation.y=w.heading;
      w.root.visible=w.root.position.distanceToSquared(player)<84**2;
      if(!w.root.visible)continue;
      if(w.model){w.model.moving.setEffectiveWeight(yieldTo?.18:1);w.model.still.setEffectiveWeight(yieldTo?.82:0);w.model.mixer.update(dt*.84);}
      else for(const [j,l] of w.legs.entries())l.rotation.x=yieldTo?0:Math.sin(time*5+i+j*Math.PI)*.42;
    }
  }};
}
