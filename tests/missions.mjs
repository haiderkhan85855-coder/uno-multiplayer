// Optional integration test using real game input in Chromium and read-only simulation telemetry.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const url=process.env.GAME_URL||'http://localhost:8000/';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:480,height:360}});
try {
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/game.js',async handle=>{
    const response=await handle.fetch();const js=await response.text();
    await handle.fulfill({response,body:js+'\nwindow.testGame=()=>game;'});
  });
  const wait=(fn,arg)=>page.waitForFunction(fn,arg,{timeout:45000});
  const get=id=>page.locator(`#${id}`).textContent();
  const position=()=>page.evaluate(()=>window.testGame().player.root.position.toArray());
  const until=async (key,axis,threshold,sign,run=true)=>{
    if(run)await page.keyboard.down('Shift');
    await page.keyboard.down(key);
    try{await wait(({axis,threshold,sign})=>sign*window.testGame().player.root.position[axis]>=sign*threshold,{axis,threshold,sign});}
    catch(error){console.error('Movement stalled',key,axis,threshold,await position(),await get('mission-detail'));throw error;}
    finally{await page.keyboard.up(key);if(run)await page.keyboard.up('Shift');}
  };
  const select=async (label)=>{
    await page.getByRole('radio',{name:label,exact:true}).click();
    await page.getByRole('button',{name:`Start ${label.toLowerCase()}`}).click();
    await wait(()=>window.testGame?.()?.state==='play');
  };
  const back=async()=>{await page.keyboard.press('Escape');await page.getByRole('button',{name:'Back to title'}).click();};
  await page.goto(url);
  await select('Delivery');
  await wait(()=>window.testGame().player.anim?.actions.walk&&window.testGame().missions.state==='pickup');
  assert.match(await get('mission-detail'),/Old Town Pickup/);
  assert.equal(await get('mission-clock'),'01:15');
  await until('a','x',-.9,-1);
  await until('w','z',13.1,-1);
  await until('d','x',2.7,1,false);
  await wait(()=>window.testGame().missions.state==='drop');
  assert.match(await get('mission-detail'),/Boardwalk Kiosk/);
  await wait(()=>document.getElementById('mission-clock').textContent!=='01:15');
  await page.keyboard.press('Escape');
  const paused=await get('mission-clock');
  await page.waitForTimeout(1200);
  assert.equal(await get('mission-clock'),paused);
  await page.keyboard.press('Escape');
  await until('w','z',4,-1);
  await until('w','z',.55,-1,false);
  if((await position())[2]<-1.25)await until('s','z',-.5,1,false);
  await until('d','x',22.5,1);
  await wait(()=>window.testGame().missions.progress.coins.size>0);
  await until('d','x',147.3,1);
  await wait(()=>window.testGame().missions.state==='done');
  assert.match(await get('mission-detail'),/Delivered/);
  console.log('PASS: picked up and delivered a package across both districts; countdown paused correctly');
  await page.getByRole('button',{name:'Next job'}).click();
  await wait(()=>window.testGame().missions.state==='pickup');
  assert.match(await get('mission-title'),/Harbor Run/);
  await back();
  assert.equal(await get('stat-deliveries'),'01');
  assert.ok(parseInt(await get('stat-coins'))>=1);
  await select('Race');
  assert.match(await get('mission-detail'),/start gate/);
  await until('a','x',-1.8,-1);
  await until('w','z',.4,-1);
  await wait(()=>window.testGame().missions.state==='running');
  await until('d','x',95.7,1);
  await until('s','z',47.65,1);
  await until('d','x',131.65,1);
  await until('s','z',69.6,1);
  await wait(()=>window.testGame().missions.state==='done');
  assert.match(await get('race-last'),/^\d{2}:\d{2}\.\d{2}$/);
  assert.equal(await get('race-last'),await get('race-best'));
  assert.match(await get('mission-detail'),/best/i);
  assert.equal(await page.evaluate(()=>window.testGame().missions.progress.deliveries),1);
  const time=await get('race-best'), coins=await get('coin-count');
  console.log(`PASS: ran all 6 glowing gates in order (${time}); ${coins} coins recorded`);
  await page.getByRole('button',{name:'Mute sound'}).click();
  assert.equal(await page.getByRole('button',{name:'Unmute sound'}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Unmute sound'}).click();
  await page.reload();
  await page.waitForFunction(()=>document.getElementById('stat-deliveries').textContent==='01');
  assert.equal(await get('stat-best'),time);assert.match(await get('stat-coins'),new RegExp(`^${coins} / 20$`));
  await page.getByRole('button',{name:'Play game'}).click();
  await wait(()=>window.testGame?.()?.state==='play');
  await page.evaluate(()=>{
    const g=window.testGame();const v=g.vehicles[0];
    v.root.position.set(140,.04,0);v.heading=-Math.PI/2;v.root.rotation.y=v.heading;
    g.camYaw=-Math.PI/2;g.player.root.position.set(136.8,.04,0);
  });
  await wait(()=>document.getElementById('prompt-label').textContent==='Enter Car');
  await page.keyboard.press('e');await wait(()=>window.testGame().active?.id==='car');
  await page.keyboard.down('w');await wait(()=>window.testGame().active.root.position.x>156);
  await page.keyboard.up('w');assert.equal(await get('district-name'),'Sunset Beach');
  await page.keyboard.press('e');await wait(()=>!window.testGame().active);
  assert.ok((await position())[0]>151);
  assert.deepEqual(errors,[]);
  console.log('PASS: persistent title stats, audio mute toggle, drive onto beach and dismount, no loading or browser errors');
}finally{await browser.close();}
