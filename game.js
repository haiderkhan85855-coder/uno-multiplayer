import * as T from 'three';
import { box, material, makeTown, HORIZONTAL_ROADS, VERTICAL_ROADS, BOUNDS, DISTRICT_LINE, ROAD_END, BOARDWALK, SHORE, HAZE, asphalt } from './town.js';
import { vehicleSpecs, spawnVehicle, resetVehicle, makeTraffic } from './vehicles.js';
import { createMissions, wireMissionMenu, chosenMode } from './missions.js';
import { createSound } from './sound.js';
import { loadRunner, animateRunner } from './player-model.js';

const $ = id => document.getElementById(id);
const ui = Object.fromEntries(['viewport','landing','hud','ride','speed','minimap','prompt','prompt-label','visit','visit-label','pause','reset','resume','back','pause-screen','touch'].map(id=>[id,$(id)]));
const clamp = T.MathUtils.clamp;
const approach = (value,target,step) => value + clamp(target-value,-step,step);
const angleDelta = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));
const SMOOTH = (rate,dt) => 1 - Math.exp(-rate*dt);
const INITIAL = [3.15,.04,34];
const inputCodes = new Set(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space','KeyE','KeyR','Escape']);
let game;
wireMissionMenu();

function makePlayer(scene) {
  const root = new T.Group(), figure = new T.Group(); root.add(figure); scene.add(root);
  const legs=[], arms=[], skin=0xb97856;
  function joint(x,y,color,l,w,foot=false) {
    const pivot = new T.Group();pivot.position.set(x,y,0); figure.add(pivot);
    box(pivot,color,w,l,w*.96,0,-l/2,0);
    if(foot)box(pivot,0xeee1c5,w+.025,.105,w*1.48,0,-l+.024,-.045);
    else box(pivot,skin,w*.84,.13,w*.84,0,-l-.034,0);
    return pivot;
  }
  for(const sign of [-1,1]) {
    legs.push(joint(sign*.126,.72,0x30425a,.65,.19,true));
    arms.push(joint(sign*.325,1.28,0x24a792,.37,.143));
  }
  box(figure,0x26a894,.53,.61,.30,0,1.03,0);
  box(figure,0x1c7c78,.43,.32,.105,0,1.04,.161);
  box(figure,0x46c2a4,.37,.045,.12,0,.96,.166);
  box(figure,skin,.18,.12,.16,0,1.35,0);
  const head=new T.Mesh(new T.DodecahedronGeometry(.244,0),material(skin));head.position.y=1.52;head.castShadow=true;figure.add(head);
  box(figure,0xf7bf58,.35,.12,.34,0,1.67,0);box(figure,0xf7bf58,.33,.047,.20,0,1.615,-.197);
  return {root,figure,legs,arms,heading:0,phase:0,vertical:0,grounded:true};
}
function vehicleBadge(vehicle) {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
  const c=canvas.getContext('2d');c.beginPath();c.roundRect(22,5,212,52,15);c.fillStyle='#152942';c.fill();
  c.strokeStyle='#465b6f';c.lineWidth=2;c.stroke();
  c.fillStyle='#ffcb57';c.beginPath();c.arc(52,31,6,0,Math.PI*2);c.fill();
  c.font='700 23px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff4de';c.fillText(vehicle.name.toUpperCase(),141,31,151);
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
  const sprite=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
  sprite.scale.set(2.18,.55,1);sprite.position.y=2.32;vehicle.root.add(sprite);return sprite;
}
function createGame() {
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.21;
  const scene=new T.Scene();scene.background=new T.Color(HAZE);scene.fog=new T.FogExp2(HAZE,.0044);
  scene.add(new T.HemisphereLight(0xffe5cc,0xa89bb8,1.85));
  const sun=new T.DirectionalLight(0xffc486,2.72);scene.add(sun,sun.target);sun.castShadow=true;
  sun.shadow.mapSize.set(1536,1536);Object.assign(sun.shadow.camera,{left:-31,right:31,top:31,bottom:-31,near:.1,far:144});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00024;sun.shadow.normalBias=.035;
  const town=makeTown(scene), camera=new T.PerspectiveCamera(57,1,.11,560);
  const player=makePlayer(scene), rider=makePlayer(scene);
  rider.root.visible=false;loadRunner(player,rider);
  const sound=createSound(),missions=createMissions(scene,sound),traffic=makeTraffic(scene);
  const vehicles=vehicleSpecs.map(spec=>{const v=spawnVehicle(spec);scene.add(v.root);v.badge=vehicleBadge(v);return v;});
  const g={renderer,scene,camera,town,player,rider,vehicles,active:null,sun,sound,missions,traffic,keys:new Set(),touchKeys:new Map(),seen:new Set(),
    state:'title',camYaw:0,camPitch:.43,cameraFocus:new T.Vector3(),drag:null,lastDrag:-Infinity,last:0,noticeUntil:0, map:document.createElement('canvas')};
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Town view. Drag to orbit the camera.');
  ui.viewport.replaceChildren(renderer.domElement);
  prepareMap(g);setupInput(g);resize(g);reset(g);
  return g;
}
function resize(g) {
  g.camera.aspect=innerWidth/Math.max(1,innerHeight);g.camera.updateProjectionMatrix();g.renderer.setSize(innerWidth,innerHeight,false);
}
function setState(g,state) {
  g.keys.clear();g.touchKeys.clear();g.drag=null;g.state=state;g.last=0;
  ui.landing.hidden=state!=='title';ui.viewport.hidden=state==='title';ui.hud.hidden=state==='title';
  ui['pause-screen'].hidden=state!=='paused';ui.hud.inert=state==='paused';
  if(state==='play')g.sound.unlock();
  g.sound.setPlaying(state==='play');
  if(state==='play')g.renderer.domElement.focus({preventScroll:true});
  if(state==='paused')ui.resume.focus();
  if(state==='title')$('play').focus();
}
function reset(g,mode=g.missions.mode) {
  g.missions.reset(mode);
  dismountRider(g);g.active=null;g.seen.clear();g.noticeUntil=0;g.vehicles.forEach(resetVehicle);
  const p=g.player;p.root.position.set(...INITIAL);p.root.visible=true;p.heading=0;p.root.rotation.y=0;p.vertical=0;p.grounded=true;p.phase=0;
  p.figure.position.y=0;for(const j of [...p.arms,...p.legs])j.rotation.x=0;
  g.camYaw=0;g.camPitch=.43;g.lastDrag=-Infinity;
  updateCamera(g,0,true);g.town.update(0,g.camera);updateHud(g,0);
}
function setupInput(g) {
  function press(code) {
    if(code==='KeyE')interact(g);
    if(code==='KeyR')reset(g);
    if(code==='Space'&&!g.active&&g.player.grounded){g.player.vertical=6.7;g.player.grounded=false;}
  }
  window.addEventListener('keydown',event=>{
    const {code}=event;
    if(g.state==='title'||!inputCodes.has(code)) return;
    if(code==='Escape'&&!event.repeat){event.preventDefault();setState(g,g.state==='paused'?'play':'paused');return;}
    if(g.state!=='play'||(event.target instanceof HTMLButtonElement&&code==='Space'))return;
    event.preventDefault();
    if(!g.keys.has(code)&&!event.repeat)press(code);
    g.keys.add(code);
  });
  window.addEventListener('keyup',e=>g.keys.delete(e.code));
  window.addEventListener('blur',()=>{g.keys.clear();g.touchKeys.clear();g.drag=null;});
  window.addEventListener('resize',()=>resize(g));
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&g.state==='play')setState(g,'paused');});
  const view=g.renderer.domElement;
  view.addEventListener('pointerdown',e=>{
    if(g.state!=='play'||e.button!==0||g.drag)return;
    view.setPointerCapture(e.pointerId);g.drag={id:e.pointerId,x:e.clientX,y:e.clientY};
  });
  view.addEventListener('pointermove',e=>{
    if(g.drag?.id!==e.pointerId)return;
    g.camYaw=angleDelta(0,g.camYaw-(e.clientX-g.drag.x)*.008);
    g.camPitch=clamp(g.camPitch+(e.clientY-g.drag.y)*.006,.12,1.21);
    g.drag.x=e.clientX;g.drag.y=e.clientY;g.lastDrag=performance.now();
  });
  const stopDrag=e=>{if(g.drag?.id===e.pointerId)g.drag=null;};
  view.addEventListener('lostpointercapture',stopDrag);view.addEventListener('pointerup',stopDrag);view.addEventListener('pointercancel',stopDrag);
  for(const button of ui.touch.querySelectorAll('button')) {
    button.addEventListener('pointerdown',e=>{
      if(g.state!=='play')return;
      e.preventDefault();button.setPointerCapture(e.pointerId);
      const code=button.dataset.key;g.touchKeys.set(e.pointerId,code);press(code);
    });
    const stop=e=>g.touchKeys.delete(e.pointerId);
    for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,stop);
  }
  ui.pause.onclick=()=>setState(g,'paused');ui.resume.onclick=()=>setState(g,'play');
  g.missions.restart.onclick=()=>{reset(g);view.focus();};
  $('sound-toggle').onclick=()=>{
    const muted=g.sound.toggle(g.state==='play'), button=$('sound-toggle');
    button.setAttribute('aria-pressed',String(muted));button.setAttribute('aria-label',muted?'Unmute sound':'Mute sound');button.title=muted?'Unmute sound':'Mute sound';
    button.querySelector('use').setAttribute('href',muted?'#i-mute':'#i-sound');view.focus();
  };
  ui.back.onclick=()=>setState(g,'title');ui.reset.onclick=()=>{reset(g);view.focus();};
}
function nearest(g) {
  const p=g.player.root.position;
  let dist=Infinity, best=null;
  if(p.y>1.2)return null;
  for(const v of g.vehicles) {
    const d=Math.hypot(p.x-v.root.position.x,p.z-v.root.position.z);
    if(d<v.range&&d<dist){dist=d;best=v;}
  }
  return best;
}
function interact(g) {
  const p=g.player, v=g.active;
  if(v) {
    const pos=v.root.position, yaw=v.heading, gap=v.radius+.63;
    // Try both sides, then either end before giving up on an obstructed exit.
    for(const [right,back] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const off=right?gap:(v.axle+gap);
      const x=pos.x+(right*Math.cos(yaw)+back*Math.sin(yaw))*off;
      const z=pos.z+(-right*Math.sin(yaw)+back*Math.cos(yaw))*off;
      if(blocked(g,x,z,.33,.04))continue;
      v.speed=0;dismountRider(g);g.active=null;p.root.position.set(x,.04,z);p.heading=yaw;p.root.rotation.y=yaw;p.root.visible=true;p.vertical=0;p.grounded=true;
      return;
    }
  } else {
    const next=nearest(g);if(!next)return;
    g.active=next;mountRider(g,next);p.root.visible=false;g.lastDrag=-Infinity;
    if(!g.seen.has(next.id)) {g.seen.add(next.id);g.noticeUntil=performance.now()+2400;ui['visit-label'].textContent=`${next.name}  ·  ${g.seen.size} / ${g.vehicles.length}`;}
  }
}
function mountRider(g,v) {
  if(!v.seat)return;
  const r=g.rider,[y,z]=v.seat;
  v.attachments=[r.root];v.mesh.add(r.root);r.root.visible=true;
  r.root.position.set(0,y-.69,z);r.figure.rotation.x=-.23;
  for(let i=0;i<2;i++) {r.legs[i].rotation.x=.68;r.arms[i].rotation.x=1.03;r.arms[i].rotation.z=i?-.15:.15;}
}
function dismountRider(g) {
  if(g.active)g.active.attachments=[];
  g.rider.root.removeFromParent();g.rider.root.visible=false;
}
function blocked(g,x,z,r,y,skip) {
  if(x-r<BOUNDS.left||x+r>BOUNDS.right||z-r<BOUNDS.top||z+r>BOUNDS.bottom)return true;
  for(const b of g.town.colliders) {
    if(y>=b.h)continue;
    const dx=Math.max(Math.abs(x-b.x)-b.w/2,0), dz=Math.max(Math.abs(z-b.z)-b.d/2,0);
    if(dx*dx+dz*dz<r*r)return true;
  }
  for(const v of g.vehicles) {
    if(v===skip||y>1.45)continue;
    const dx=x-v.root.position.x,dz=z-v.root.position.z, s=Math.sin(v.heading),c=Math.cos(v.heading);
    if(dx*dx+dz*dz>(r+v.radius+v.axle)**2)continue;
    const localX=dx*c-dz*s,localZ=dx*s+dz*c;
    if(localX*localX+Math.max(Math.abs(localZ)-v.axle,0)**2<(r+v.radius)**2)return true;
  }
  return false;
}
function stepPlayer(g,dt,key) {
  const p=g.player,pos=p.root.position;
  if(!p.grounded){pos.y+=p.vertical*dt;p.vertical-=18*dt;if(pos.y<=.04){pos.y=.04;p.vertical=0;p.grounded=true;}}
  const right=+key('KeyD')-key('KeyA'), forward=+key('KeyW')-key('KeyS');
  const running=key('ShiftLeft')||key('ShiftRight');
  const beforeX=pos.x,beforeZ=pos.z;
  if(right||forward) {
    const s=Math.sin(g.camYaw),c=Math.cos(g.camYaw), m=(running?8.4:4.4)/Math.hypot(right,forward);
    const x=(right*c-forward*s)*m, z=(-right*s-forward*c)*m;
    const direction=Math.atan2(-x,-z);p.heading+=angleDelta(p.heading,direction)*SMOOTH(15,dt);p.root.rotation.y=p.heading;
    if(!blocked(g,pos.x+x*dt,pos.z,.33,pos.y))pos.x+=x*dt;
    if(!blocked(g,pos.x,pos.z+z*dt,.33,pos.y))pos.z+=z*dt;
  }
  const speed=Math.hypot(pos.x-beforeX,pos.z-beforeZ)/dt || 0;
  animateRunner(p,dt,speed);
  const scale=speed>.1?(running?.89:.64):0;
  p.phase+=speed*2.1*dt;
  const swing=p.grounded?Math.sin(p.phase)*scale:.46;
  for(let i=0;i<2;i++) {
    const sign=i?1:-1;
    p.legs[i].rotation.x=T.MathUtils.lerp(p.legs[i].rotation.x,sign*swing,SMOOTH(20,dt));
    p.arms[i].rotation.x=T.MathUtils.lerp(p.arms[i].rotation.x,-sign*swing*.72,SMOOTH(20,dt));
  }
  p.figure.position.y=p.grounded?Math.abs(swing)*.055:0;
  return speed;
}
const X_AXIS=new T.Vector3(1,0,0);
function stepVehicle(g,dt,key) {
  const v=g.active,pos=v.root.position;
  const throttle=+key('KeyW')-key('KeyS'), turn=+key('KeyA')-key('KeyD');
  const target=throttle>0?v.max:throttle<0?-v.reverse:0;
  const opposing=throttle*v.speed<0;
  v.speed=approach(v.speed,target,(opposing?v.brake:throttle?v.accel:v.drag)*dt);
  const yaw=v.heading+turn*v.steer*Math.sign(v.speed)*Math.min(Math.abs(v.speed)/2.4,1)*dt*(1-.34*Math.min(Math.abs(v.speed)/v.max,1));
  function can(x,z,h){
    const sx=Math.sin(h)*v.axle,sz=Math.cos(h)*v.axle;
    return !blocked(g,x-sx,z-sz,v.radius,.04,v)&&!blocked(g,x,z,v.radius,.04,v)&&!blocked(g,x+sx,z+sz,v.radius,.04,v);
  }
  const nx=pos.x-Math.sin(yaw)*v.speed*dt,nz=pos.z-Math.cos(yaw)*v.speed*dt;
  if(can(nx,nz,yaw)) {pos.x=nx;pos.z=nz;v.heading=yaw;}
  else {if(can(pos.x,pos.z,yaw))v.heading=yaw;v.speed=0;}
  v.root.rotation.y=v.heading;
  for(const wheel of v.wheels)wheel.rotateOnAxis(v.wheelAxis??X_AXIS,-v.speed*dt*(v.wheelDirection??1)/(v.wheelRadius??.36));
  v.mesh.rotation.z=T.MathUtils.lerp(v.mesh.rotation.z,turn*(v.lean??.027)*Math.min(Math.abs(v.speed)/4,1),SMOOTH(7,dt));
  if(v.id==='bicycle') {
    g.rider.phase+=v.speed*dt*3.6;
    const pedal=Math.sin(g.rider.phase)*.26;
    g.rider.legs[0].rotation.x=.71+pedal;g.rider.legs[1].rotation.x=.71-pedal;
  }
  return Math.abs(v.speed);
}
const SUN_OFFSET=new T.Vector3(38,21,-59);
const focus = new T.Vector3(), desired = new T.Vector3(), offset = new T.Vector3(), ray=new T.Ray(), hit=new T.Vector3(), bounds=new T.Box3();
function updateCamera(g,dt,snap=false) {
  const a=g.active, target=a?.root ?? g.player.root;
  if(a&&!g.drag&&performance.now()-g.lastDrag>1500)g.camYaw+=angleDelta(g.camYaw,a.heading)*SMOOTH(2.8,dt);
  focus.copy(target.position);focus.y+=a?1.08:1.42;
  if(snap)g.cameraFocus.copy(focus);else g.cameraFocus.lerp(focus,SMOOTH(a?11:14,dt));
  const distance=a?a.camera:6.45, h=Math.cos(g.camPitch)*distance;
  offset.set(Math.sin(g.camYaw)*h,Math.sin(g.camPitch)*distance,Math.cos(g.camYaw)*h);
  ray.origin.copy(g.cameraFocus);ray.direction.copy(offset).normalize();
  let len=distance;
  for(const b of g.town.cameraBlockers) {
    if(Math.abs(b.x-focus.x)>17||Math.abs(b.z-focus.z)>17)continue;
    bounds.min.set(b.x-b.w/2,-.03,b.z-b.d/2);bounds.max.set(b.x+b.w/2,b.h,b.z+b.d/2);
    if(!bounds.containsPoint(ray.origin)&&ray.intersectBox(bounds,hit))len=Math.min(len,Math.max(.35,ray.origin.distanceTo(hit)-.21));
  }
  desired.copy(g.cameraFocus).addScaledVector(ray.direction,len);g.camera.position.copy(desired);
  g.camera.lookAt(g.cameraFocus);
  g.sun.target.position.copy(target.position);g.sun.position.copy(target.position).add(SUN_OFFSET);
}
const mapScale=140/(BOUNDS.right-BOUNDS.left);
const mapX=n=>10+(n-BOUNDS.left)*mapScale, mapZ=n=>80+n*mapScale;
function prepareMap(g) {
  const m=g.map;m.width=m.height=160;
  const c=m.getContext('2d'), top=mapZ(BOUNDS.top),height=(BOUNDS.bottom-BOUNDS.top)*mapScale;
  function land(a,b,color){c.fillStyle=color;c.fillRect(mapX(a),top,(b-a)*mapScale,height);}
  c.fillStyle='#345b70';c.fillRect(0,0,160,160);
  land(BOUNDS.left,DISTRICT_LINE,'#a39473');land(DISTRICT_LINE,ROAD_END,'#a39580');land(ROAD_END,SHORE,'#e2be83');
  c.fillStyle=`#${asphalt.toString(16)}`;
  for(const road of VERTICAL_ROADS)c.fillRect(mapX(road-6),top,12*mapScale,height);
  for(const road of HORIZONTAL_ROADS)c.fillRect(mapX(BOUNDS.left),mapZ(road-6),(ROAD_END-BOUNDS.left)*mapScale,12*mapScale);
  c.fillStyle='#baa16a';c.fillRect(mapX(BOARDWALK-3),top,6*mapScale,height);
  for(const b of g.town.buildings){c.fillStyle=`#${b.color.toString(16)}`;c.fillRect(mapX(b.x-b.w/2),mapZ(b.z-b.d/2),b.w*mapScale,b.d*mapScale);}
  c.textAlign='center';c.font='600 6px system-ui';c.fillStyle='#f6ddba';c.fillText('SUNSET',mapX(-6),25);c.fillText('LANTERN BAY',mapX(113),25);
}
function updateHud(g,speed) {
  const a=g.active, near=a?null:nearest(g), prompt=a?`Exit ${a.name}`:near?`Enter ${near.name}`:'';
  const label=a?a.name.toUpperCase():'ON FOOT', velocity=String(Math.round(speed*3.6));
  if(ui.ride.textContent!==label)ui.ride.textContent=label;
  if(ui.speed.textContent!==velocity)ui.speed.textContent=velocity;
  ui.prompt.hidden=!prompt;
  if(ui['prompt-label'].textContent!==prompt)ui['prompt-label'].textContent=prompt;
  ui.visit.hidden=performance.now()>g.noticeUntil;
  const m=ui.minimap.getContext('2d');
  m.clearRect(0,0,160,160);m.save();m.beginPath();m.roundRect(3,3,154,154,10);m.clip();m.drawImage(g.map,0,0);
  g.missions.map(m,mapX,mapZ);
  for(const v of g.vehicles) {
    v.badge.visible=v!==a&&v.root.position.distanceToSquared((a??g.player).root.position)<32**2;
    if(v===a)continue;
    m.beginPath();m.arc(mapX(v.root.position.x),mapZ(v.root.position.z),3,0,Math.PI*2);m.fillStyle=`#${v.color.toString(16)}`;m.fill();m.strokeStyle='#1d2e42';m.stroke();
  }
  const p=a??g.player,pos=p.root.position;
  const district=pos.x>BOARDWALK+3?'Sunset Beach':pos.x>DISTRICT_LINE?'Lantern Bay':'Sunset District';
  if($('district-name').textContent!==district)$('district-name').textContent=district;
  m.translate(mapX(pos.x),mapZ(pos.z));m.rotate(-p.heading);
  m.beginPath();m.moveTo(0,-6);m.lineTo(4,4);m.lineTo(0,2);m.lineTo(-4,4);m.closePath();m.fillStyle='#fff2c9';m.fill();m.lineWidth=1.1;m.strokeStyle='#13243a';m.stroke();m.restore();
}
function animate(g,time) {
  requestAnimationFrame(t=>animate(g,t));
  if(g.state!=='play')return;
  const seconds=g.last?Math.max(0,(time-g.last)/1000):0;g.last=time;
  // Small collision steps preserve handling even on displays that are slow to render.
  const frame=seconds?clamp(seconds,.001,.30):1/60;
  const steps=Math.ceil(frame/.034), dt=frame/steps;
  const held=new Set(g.touchKeys.values());
  const key=code=>g.keys.has(code)||held.has(code);
  let speed=0;
  for(let i=0;i<steps;i++){
    speed=g.active?stepVehicle(g,dt,key):stepPlayer(g,dt,key);
    g.missions.update(dt,seconds/steps,(g.active??g.player).root.position);
  }
  const pos=(g.active??g.player).root.position;
  g.missions.sync();g.sound.tick(frame,g.active,speed,g.player.grounded,pos.x,pos.z);
  g.traffic(frame,pos);updateCamera(g,frame);g.town.update(frame,g.camera);updateHud(g,speed);
  g.renderer.render(g.scene,g.camera);
}
export function startGame() {
  if(!game){game=createGame();requestAnimationFrame(t=>animate(game,t));}
  reset(game,chosenMode());setState(game,'play');
}
