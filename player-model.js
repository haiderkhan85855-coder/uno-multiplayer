import * as T from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { clone } from './vendor/utils/SkeletonUtils.js';

// The procedural figures remain available if either the model or its locomotion clips fail to load.
export function loadRunner(player,rider){
  new GLTFLoader().load('models/quaternius-runner.glb',({scene,animations})=>{
    const clipNames={idle:'Idle',walk:'Walk',run:'Run',jump:'Jump',sit:'SitDown'};
    const clips=Object.fromEntries(Object.entries(clipNames).map(([id,name])=>[id,animations.find(clip=>clip.name===name)]));
    if(!clips.idle||!clips.walk||!clips.run)return;
    const colors={Shirt:0x398e88,Pants:0x34465e};
    scene.rotation.y=Math.PI;scene.scale.setScalar(.54);
    scene.traverse(o=>{
      if(!o.isMesh)return;
      o.castShadow=true;o.receiveShadow=true;
      for(const mat of Array.isArray(o.material)?o.material:[o.material]){
        if(Object.hasOwn(colors,mat.name))mat.color.setHex(colors[mat.name]);
      }
    });
    if(clips.sit){
      const seated=clone(scene),sitter=new T.AnimationMixer(seated);
      const pose=sitter.clipAction(clips.sit).play();pose.time=clips.sit.duration-.01;sitter.update(0);
      // Anchor the seated rig by its hips so the same pose works for all three two-wheelers.
      const hips=seated.getObjectByName('Hips')??seated.getObjectByName('Body');
      if(hips){
        const anchor=hips.getWorldPosition(new T.Vector3());
        seated.position.set(-anchor.x,.72-anchor.y,-anchor.z);
        rider.root.add(seated);rider.figure.visible=false;
      }
    }
    const mixer=new T.AnimationMixer(scene),actions={};
    for(const id of ['idle','walk','run','jump'])if(clips[id])actions[id]=mixer.clipAction(clips[id]);
    if(actions.jump){actions.jump.setLoop(T.LoopOnce,1);actions.jump.clampWhenFinished=true;}
    actions.idle.play();mixer.update(0);
    player.root.add(scene);player.figure.visible=false;
    player.anim={mixer,actions,current:'idle'};
  },undefined,()=>console.info('Using the stylized fallback runner.'));
}
export function animateRunner(player,dt,speed){
  const a=player.anim;if(!a)return;
  const key=!player.grounded&&a.actions.jump?'jump':speed<.15?'idle':speed<5?'walk':'run';
  if(key!==a.current){a.actions[a.current].fadeOut(.14);a.actions[key].reset().fadeIn(.14).play();a.current=key;}
  a.actions[key].timeScale=key==='walk'?1.13:key==='run'?1.18:1;
  a.mixer.update(dt);
}
