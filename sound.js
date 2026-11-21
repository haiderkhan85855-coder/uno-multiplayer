// All audio is synthesized locally. Sources are created only after a play click.
export function createSound(){
  let ctx,master,engine,engineLow,driveFilter,driveGain,surfGain,surfFilter,noise,muted=false,step=0;
  function unlock(){
    try {
      if(!ctx){
        const Audio=window.AudioContext||window.webkitAudioContext;
        if(!Audio)return;
        ctx=new Audio();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
        const drive=ctx.createGain();drive.gain.value=0;driveGain=drive;
        driveFilter=ctx.createBiquadFilter();driveFilter.type='lowpass';driveFilter.frequency.value=180;driveFilter.Q.value=1;
        driveFilter.connect(drive).connect(master);
        engine=ctx.createOscillator();engine.type='sawtooth';engine.frequency.value=39;engine.connect(driveFilter);engine.start();
        engineLow=ctx.createOscillator();engineLow.type='triangle';engineLow.frequency.value=20;
        const lowMix=ctx.createGain();lowMix.gain.value=.47;engineLow.connect(lowMix).connect(driveFilter);engineLow.start();
        noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
        const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
        const surf=ctx.createBufferSource();surf.buffer=noise;surf.loop=true;
        surfFilter=ctx.createBiquadFilter();surfFilter.type='lowpass';surfFilter.frequency.value=400;
        surfGain=ctx.createGain();surfGain.gain.value=0;surf.connect(surfFilter).connect(surfGain).connect(master);surf.start();
      }
      if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    }catch{/* WebGL play is available without audio. */}
  }
  function setPlaying(playing){if(master)master.gain.setTargetAtTime(playing&&!muted?.56:0,ctx.currentTime,.04);}
  function toggle(playing){muted=!muted;setPlaying(playing);return muted;}
  const tunes={coin:[783.99,1174.66,1567.98],checkpoint:[440,659.25],complete:[523.25,659.25,783.99,1046.5],fail:[329.63,261.63]};
  function cue(id){
    if(ctx?.state!=='running'||!master||!tunes[id])return;
    const now=ctx.currentTime, notes=tunes[id], gap=id==='coin'?.062:.108;
    notes.forEach((hz,i)=>{
      const o=ctx.createOscillator(),g=ctx.createGain(),t=now+i*gap;
      o.type=id==='complete'?'triangle':'sine';o.frequency.value=hz;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.16,t+.012);
      g.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(g).connect(master);o.start(t);o.stop(t+.26);
    });
  }
  function tick(dt,vehicle,speed,grounded,x,z){
    if(ctx?.state!=='running'||!surfGain)return;
    const now=ctx.currentTime;
    const drive=vehicle&&vehicle.id!=='bicycle', ratio=vehicle?speed/vehicle.max:0;
    const base=vehicle?.id==='motorcycle'?56:vehicle?.id==='scooter'?67:34;
    const hz=base+ratio*(vehicle?.id==='car'?88:115);
    engine.frequency.setTargetAtTime(hz,now,.12);engineLow.frequency.setTargetAtTime(hz*.5,now,.13);
    driveFilter.frequency.setTargetAtTime(170+ratio*520,now,.15);
    driveGain.gain.setTargetAtTime(drive?.08+ratio*.065:0,now,.09);
    const beach=Math.max(0,Math.min(1,(x-127)/38))*Math.max(0,Math.min(1,(86-Math.abs(z))/19));
    const wash=.72+.24*Math.sin(now*1.18)+.11*Math.sin(now*.64+1);
    surfFilter.frequency.setTargetAtTime(330+225*wash,now,.3);
    surfGain.gain.setTargetAtTime(beach*.27*wash,now,.33);
    if(vehicle||!grounded||speed<.25){step=0;return;}
    step+=dt*speed;
    if(step<1.05)return;
    step%=1.05;
    const src=ctx.createBufferSource(),g=ctx.createGain(),filter=ctx.createBiquadFilter();
    src.buffer=noise;filter.type='lowpass';filter.frequency.value=x>147?810:460;
    g.gain.setValueAtTime(.001,now);g.gain.exponentialRampToValueAtTime(.22,now+.009);g.gain.exponentialRampToValueAtTime(.001,now+.105);
    src.connect(filter).connect(g).connect(master);src.start(now,Math.random()*1.75,.12);
  }
  return {unlock,setPlaying,toggle,cue,tick};
}
