import * as T from 'three';
import { box } from './town.js';

const SAVE_KEY='off-the-grid.progress.v1';
const MODES={free:'Free Roam',delivery:'Delivery',race:'Race'};
const jobs=[
  {name:'Boardwalk Express',from:[3,13,'Old Town Pickup'],to:[149,0,'Boardwalk Kiosk'],limit:75},
  {name:'Harbor Run',from:[103,48,'Harbor Market'],to:[-12,0,'Sunset Plaza'],limit:75},
  {name:'Sandy Special',from:[133,-15,'Marina Corner'],to:[159,41,'South Beach'],limit:55},
];
// Third coordinate: 0 = drive along Z; PI/2 = drive along X.
const route=[[0,14,0],[18,0,Math.PI/2],[61,0,Math.PI/2],[96,23,0],[114,48,Math.PI/2],[132,69,0]];
const spots=[[-48,21],[-61,-48],[-25,48],[-36,0],[-24,-33],[-34,-24],[-24,-15],[0,-20],[21,0],[48,-29],[48,24],[63,24],[75,0],[96,-22],[110,48],[132,-39],[149,-46],[156,-20],[163,15],[153,58]];
const $=id=>document.getElementById(id);
const mint=0x80f4c5, gold=0xffcb57, blue=0x8abfff;
const colors={delivery:'#80f4c5',race:'#8abfff'};
const near=(p,x,z,r,y=1.9)=>Math.abs(p.y)<y && (p.x-x)**2+(p.z-z)**2<=r*r;
function saneTime(t){return Number.isFinite(t)&&t>0?t:null;}
function loadProgress(){
  try {
    const s=JSON.parse(localStorage.getItem(SAVE_KEY))??{};
    return {coins:new Set(Array.isArray(s.coins)?s.coins.filter(i=>Number.isInteger(i)&&i>=0&&i<spots.length):[]),deliveries:Number.isSafeInteger(s.deliveries)&&s.deliveries>=0?s.deliveries:0,best:saneTime(s.best),last:saneTime(s.last)};
  } catch {return {coins:new Set(),deliveries:0,best:null,last:null};}
}
function save(s){try{localStorage.setItem(SAVE_KEY,JSON.stringify({...s,coins:[...s.coins]}));}catch{/* The game still works without storage. */}}
function time(s){if(s==null)return '—';const v=Math.floor(s*100);return `${String(Math.floor(v/6000)).padStart(2,'0')}:${String(Math.floor(v/100)%60).padStart(2,'0')}.${String(v%100).padStart(2,'0')}`;}
function countdown(s){const v=Math.max(0,Math.ceil(s));return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`;}
function text(el,value){if(el.textContent!==value)el.textContent=value;}
function titleProgress(p){
  text($('stat-deliveries'),String(p.deliveries).padStart(2,'0'));
  text($('stat-best'),time(p.best));
  text($('stat-coins'),`${String(p.coins.size).padStart(2,'0')} / ${spots.length}`);
}
let selected='free';
export function wireMissionMenu(){
  const group=$('mission-menu'), modes=[...group.querySelectorAll('[data-mode]')];
  const desc={free:'Explore both districts and hunt for 20 hidden coins.',delivery:'Pick up a parcel and make the drop before the clock runs out.',race:'Run the Harbor Sprint and chase your best time.'};
  function select(btn){
    selected=btn.dataset.mode;
    for(const b of modes){b.setAttribute('aria-checked',String(b===btn));b.tabIndex=b===btn?0:-1;}
    text($('mode-tag'),MODES[selected].toUpperCase());text($('mode-desc'),desc[selected]);
    text($('play-label'),selected==='free'?'Play game':`Start ${MODES[selected].toLowerCase()}`);
  }
  modes.forEach(b=>b.onclick=()=>select(b));
  group.addEventListener('keydown',e=>{
    const move={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[e.key];
    if(!move)return;
    e.preventDefault();const item=modes[(modes.findIndex(b=>b.dataset.mode===selected)+move+modes.length)%modes.length];select(item);item.focus();
  });
  select(modes[0]);titleProgress(loadProgress());
}
export function chosenMode(){return selected;}

function flat(color,opacity=1){return new T.MeshBasicMaterial({color,transparent:opacity!==1,opacity,depthWrite:opacity===1,side:T.DoubleSide,toneMapped:false});}
function mesh(parent,geom,mat,x=0,y=0,z=0){const m=new T.Mesh(geom,mat);m.position.set(x,y,z);parent.add(m);return m;}
function ring(parent,color,r){const m=mesh(parent,new T.RingGeometry(r-.10,r,32),flat(color,.86),0,.14);m.rotation.x=-Math.PI/2;return m;}
function flag(parent,word,color){
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;
  const c=canvas.getContext('2d');c.fillStyle='#13243a';c.beginPath();c.roundRect(5,5,374,86,15);c.fill();c.strokeStyle=color;c.lineWidth=4;c.stroke();
  c.font='bold 42px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(word,192,47,353);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  const badge=new T.Sprite(new T.SpriteMaterial({map,depthWrite:false,toneMapped:false}));badge.scale.set(3.9,.98,1);parent.add(badge);return badge;
}
function gate([x,z,heading],i){
  const root=new T.Group();root.position.set(x,0,z);root.rotation.y=heading;
  const glow=flat(blue), shell=flat(blue,.21), tint=flat(blue,.09);
  for(const s of [-1,1]){
    mesh(root,new T.BoxGeometry(.52,4.6,.53),shell,s*5.25,2.3);
    mesh(root,new T.BoxGeometry(.16,4.65,.17),glow,s*5.25,2.325);
    box(root,0x334f70,1,.16,1,s*5.25,.09,0);
  }
  mesh(root,new T.BoxGeometry(11,.52,.54),shell,0,4.60);
  mesh(root,new T.BoxGeometry(10.65,.15,.17),glow,0,4.60);
  mesh(root,new T.PlaneGeometry(10.4,4.4),tint,0,2.38);
  mesh(root,new T.BoxGeometry(10.5,.018,.22),glow,0,.065);
  flag(root,i===0?'START':i===route.length-1?'FINISH':`GATE 0${i}`,colors.race).position.y=5.22;
  return {root,shell,tint};
}
function dropMarker(isPickup){
  const root=new T.Group();ring(root,mint,2.65);
  const halo=ring(root,mint,2.33);halo.material.opacity=.37;
  const light=mesh(root,new T.CylinderGeometry(.66,1.53,2.65,16,1,true),flat(mint,.12),0,1.36);
  const icon=new T.Group();root.add(icon);icon.position.y=1;
  if(isPickup){
    box(icon,0xc28551,.85,.74,.79);box(icon,0xf5d698,.19,.02,.80,0,.38,0);box(icon,0xf5d698,.19,.26,.021,0,.25,.40);
  }else{
    const jewel=mesh(icon,new T.OctahedronGeometry(.55),flat(mint));jewel.scale.y=1.25;
  }
  flag(root,isPickup?'PICKUP':'DROP-OFF',colors.delivery).position.y=3.32;
  return {root,icon,halo,light};
}
function makeCoin(parent,[x,z]){
  const anchor=new T.Group();anchor.position.set(x,.7,z);parent.add(anchor);
  const coin=new T.Group();anchor.add(coin);
  const surface=new T.MeshStandardMaterial({color:gold,emissive:0xb65e13,emissiveIntensity:.5,metalness:.20,roughness:.44,flatShading:true});
  const token=mesh(coin,new T.CylinderGeometry(.34,.34,.11,12),surface);token.rotation.x=Math.PI/2;
  const trim=flat(0xffdf82);
  for(const side of [-1,1]){
    mesh(coin,new T.TorusGeometry(.265,.025,5,12),trim,0,0,side*.057);
    mesh(coin,new T.PlaneGeometry(.18,.18),trim,0,0,side*.062).rotation.z=Math.PI/4;
  }
  return anchor;
}
// Sweep across a gate's thin plane, not just within a point-radius. This also works at full speed.
function contactGate(prev,p,[x,z,yaw]){
  const s=Math.sin(yaw),c=Math.cos(yaw),a=(prev.x-x)*s+(prev.z-z)*c,b=(p.x-x)*s+(p.z-z)*c;
  if(a===b||a*b>0)return false;
  const k=a/(a-b), wx=T.MathUtils.lerp(prev.x,p.x,k)-x,wz=T.MathUtils.lerp(prev.z,p.z,k)-z;
  return Math.abs(wx*c-wz*s)<=5.25 && T.MathUtils.lerp(prev.y,p.y,k)<3.5;
}

export function createMissions(scene,sound){
  const progress=loadProgress(), world=new T.Group();scene.add(world);
  const coins=spots.map(at=>makeCoin(world,at)), gates=route.map(gate);
  const parcel=dropMarker(true), drop=dropMarker(false);
  world.add(parcel.root,drop.root,...gates.map(x=>x.root));
  const panel=$('mission-hud'), timer=$('mission-clock'), label=$('mission-title'), detail=$('mission-detail'), record=$('race-record'), step=$('mission-step'), restart=$('mission-restart');
  const tracker=$('coin-count'), toast=$('coin-toast');
  let mode='free',state='idle',clock=0,anim=0,jobIndex=progress.deliveries%jobs.length,index=0,lastPos=null,toastUntil=0,toastName='',personal=false;
  function sync(){
    titleProgress(progress);text(tracker,String(progress.coins.size).padStart(2,'0'));text($('hud-mode'),MODES[mode].toUpperCase());
    panel.hidden=mode==='free';panel.dataset.mission=mode;record.hidden=mode!=='race';
    restart.hidden=state!=='done'&&state!=='failed';
    timer.classList.toggle('urgent',mode==='delivery'&&state==='drop'&&clock<=12);
    if(mode==='delivery'){
      const job=jobs[jobIndex];
      text(label,job.name);text(step,'DELIVERY / '+String(jobIndex+1).padStart(2,'0'));
      text(timer,countdown(state==='pickup'?job.limit:clock));
      text(detail,state==='pickup'?`Pick up at ${job.from[2]}`:state==='drop'?`Deliver to ${job.to[2]}`:state==='done'?`Delivered to ${job.to[2]}`:'Time’s up. Try the route again.');
      text(restart,state==='done'?'Next job':'Retry');
    }else if(mode==='race'){
      text(label,'Harbor Sprint');text(step,state==='staged'?'RACE / READY':`RACE / ${Math.max(0,index-1)} OF ${route.length-1}`);
      text(timer,time(clock));text(restart,'Race again');
      text(detail,state==='done'?(personal?'New personal best!':'Sprint complete'):state==='staged'?'Cross the start gate to begin':index===route.length-1?'Head through the finish gate':`Drive or run through gate ${index}`);
      text($('race-last'),time(progress.last));text($('race-best'),time(progress.best));
    }
    toast.hidden=anim>toastUntil||!toastName;
    if(!toast.hidden)text(toast,toastName);
  }
  function updateMarkers(){
    parcel.root.visible=mode==='delivery'&&state==='pickup';drop.root.visible=mode==='delivery'&&state==='drop';
    for(let i=0;i<gates.length;i++)gates[i].root.visible=mode==='race'&&(state==='staged'||state==='running')&&(i===index||i===index+1);
    coins.forEach((coin,i)=>coin.visible=!progress.coins.has(i));
  }
  function reset(next=mode){
    mode=Object.hasOwn(MODES,next)?next:'free';state=mode==='delivery'?'pickup':mode==='race'?'staged':'idle';
    clock=0;index=0;lastPos=null;toastUntil=0;toastName='';personal=false;
    jobIndex=progress.deliveries%jobs.length;
    const {from,to}=jobs[jobIndex];parcel.root.position.set(from[0],0,from[1]);drop.root.position.set(to[0],0,to[1]);
    updateMarkers();sync();
  }
  function update(dt,seconds,p){
    anim+=dt;
    for(let i=0;i<coins.length;i++){
      if(progress.coins.has(i))continue;
      const coin=coins[i];coin.rotation.y=anim*2.8+i;coin.position.y=.72+Math.sin(anim*3+i)*.12;
      if(near(p,...spots[i],1.55)){
        progress.coins.add(i);save(progress);coin.visible=false;sound.cue('coin');
        toastName=progress.coins.size===spots.length?'COAST COMPLETE · 20 / 20':'COIN FOUND +1';toastUntil=anim+1.8;
      }
    }
    if(mode==='delivery'){
      const job=jobs[jobIndex], marker=state==='pickup'?parcel:drop;
      marker.icon.rotation.y=anim*1.8;marker.icon.position.y=1.15+Math.sin(anim*3)*.14;
      marker.halo.scale.setScalar(.98+Math.sin(anim*3)*.05);
      if(state==='pickup'&&near(p,job.from[0],job.from[1],2.65)){
        state='drop';clock=job.limit;sound.cue('checkpoint');updateMarkers();
      }else if(state==='drop'){
        clock=Math.max(0,clock-seconds);
        if(!clock){state='failed';updateMarkers();sound.cue('fail');}
        else if(near(p,job.to[0],job.to[1],2.8)){state='done';progress.deliveries++;save(progress);sound.cue('complete');updateMarkers();}
      }
    }else if(mode==='race'){
      if(state==='running')clock+=seconds;
      if((state==='staged'||state==='running')&&lastPos&&contactGate(lastPos,p,route[index])){
        index++;
        if(index===route.length){
          state='done';progress.last=clock;personal=progress.best==null||clock<progress.best;
          if(personal)progress.best=clock;
          save(progress);sound.cue('complete');
        }else{state='running';sound.cue('checkpoint');}
        updateMarkers();
      }
      for(let i=0;i<gates.length;i++){
        gates[i].shell.opacity=i===index?.28+.10*Math.sin(4*anim):.10;
        gates[i].tint.opacity=i===index?.13:.04;
      }
    }
    if(lastPos)lastPos.copy(p);else lastPos=p.clone();
  }
  function map(c,x,z){
    c.fillStyle='#f9c95b';
    for(let i=0;i<spots.length;i++)if(!progress.coins.has(i)){
      const [a,b]=spots[i];c.beginPath();c.arc(x(a),z(b),1.2,0,Math.PI*2);c.fill();
    }
    if(mode==='delivery'&&(state==='pickup'||state==='drop')){
      const job=jobs[jobIndex],pt=state==='pickup'?job.from:job.to;
      marker(c,x(pt[0]),z(pt[1]),colors.delivery);
    }else if(mode==='race'&&(state==='staged'||state==='running')){
      c.strokeStyle='#8abfff80';c.lineWidth=1;c.setLineDash([3,2]);c.beginPath();
      // Mark the ordered gates. This is a guide, not an off-road driving line.
      for(let i=index;i<route.length;i++){const [a,b]=route[i];if(i===index)c.moveTo(x(a),z(b));else c.lineTo(x(a),z(b));}c.stroke();c.setLineDash([]);
      for(let i=index;i<route.length;i++){
        const [a,b]=route[i];if(i===index)marker(c,x(a),z(b),colors.race);else{c.fillStyle='#8abfff';c.fillRect(x(a)-1.5,z(b)-1.5,3,3);}
      }
    }
  }
  reset();
  return {reset,update,sync,map,restart,get mode(){return mode;},get state(){return state;},get progress(){return progress;}};
}
function marker(c,x,z,color){
  c.beginPath();c.arc(x,z,4.7,0,Math.PI*2);c.strokeStyle='#14283b';c.lineWidth=2;c.stroke();c.fillStyle=color;c.fill();
  c.beginPath();c.arc(x,z,1.45,0,Math.PI*2);c.fillStyle='#162e42';c.fill();
}
