// Browser integration: staging only changes starting positions, then real keyboard input drives each traversal.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const url=process.env.GAME_URL||'http://localhost:8000/';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:490,height:375}});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/game.js',async route=>{
    const response=await route.fetch();
    const js=await response.text();
    await route.fulfill({response,body:js+'\nwindow.testGame=()=>game;'});
  });
  const wait=(fn,arg)=>page.waitForFunction(fn,arg,{timeout:45000});
  const stage=({x,y=.04,z,heading=0,distance=3.07})=>page.evaluate(({x,y,z,heading,distance})=>{
    const g=window.testGame(), v=g.vehicles.find(v=>v.id==='car');
    v.root.position.set(x,y,z);v.heading=heading;v.root.rotation.y=heading;v.speed=0;v.fall=0;
    g.camYaw=heading;g.player.root.position.set(x+Math.sin(heading)*distance,y,z+Math.cos(heading)*distance);
  },{x,y,z,heading,distance});
  const enter=async()=>{
    await wait(()=>document.querySelector('#prompt-label').textContent==='Enter Car');
    await page.keyboard.press('e');await wait(()=>window.testGame().active?.id==='car');
  };
  const drive=async(fn,arg)=>{
    await page.keyboard.down('w');
    try{await wait(fn,arg);}catch(error){console.error(await page.evaluate(()=>{const g=window.testGame(),v=g.active;return {position:v?.root.position.toArray(),speed:v?.speed,fall:v?.fall,quality:g.quality};}));throw error;}finally{await page.keyboard.up('w');}
  };
  await page.goto(url);
  await page.getByRole('button',{name:'Play game'}).click();
  await wait(()=>window.testGame?.()?.state==='play');
  await stage({x:-3.1,z:-13});await enter();
  await page.keyboard.press('h');
  await wait(()=>window.testGame().beams.every(l=>l.intensity===0));
  await page.keyboard.press('h');
  await wait(()=>window.testGame().beams.every(l=>l.intensity>0));
  await drive(()=>window.testGame().active.root.position.y>5.35);
  await wait(()=>!document.querySelector('#map-level').hidden);
  assert.equal(await page.locator('#district-name').textContent(),'Market Flyover');
  await drive(()=>{const p=window.testGame().active.root.position;return p.z<-74.2&&p.y<.12;});
  await wait(()=>document.querySelector('#map-level').hidden);
  await page.keyboard.press('e');await wait(()=>!window.testGame().active);
  console.log('PASS: sedan headlights toggle, climb Market Flyover, upper minimap, descend to street, dismount');

  await page.keyboard.press('r');
  await stage({x:155,z:74.5});await enter();
  await drive(()=>window.testGame().active.root.position.y>6.05);
  await wait(()=>document.querySelector('#district-name').textContent==='Coast Viaduct');
  await drive(()=>{const p=window.testGame().active.root.position;return p.z<-73.3&&p.y<.15;});
  await page.keyboard.press('e');await wait(()=>!window.testGame().active);
  console.log('PASS: drove up and across the Coast Viaduct and returned to beach level');

  await page.keyboard.press('r');
  await stage({x:-3.1,y:5.44,z:-53.3,heading:-Math.PI/2,distance:2.4});await enter();
  await page.keyboard.down('w');
  await wait(()=>{const v=window.testGame().active;return v.root.position.x>-.32&&v.root.position.y<4.9;});
  await wait(()=>window.testGame().active.root.position.x>1.7&&window.testGame().active.root.position.y<.13);
  await page.keyboard.up('w');
  await page.keyboard.press('e');await wait(()=>!window.testGame().active);
  console.log('PASS: drove through a guardrail opening and landed back on the lower road');

  await page.keyboard.press('r');
  await stage({x:3.15,z:17});await enter();
  const initialSignal=await page.evaluate(()=>window.testGame().signals.lights[0].last);
  await drive(()=>window.testGame().active.root.position.z<-8&&window.testGame().active.root.position.y<.15);
  await page.keyboard.down('s');
  await wait(()=>window.testGame().active.lighting.tail.emissiveIntensity>1);
  await page.keyboard.up('s');
  await wait(initial=>window.testGame().signals.lights[0].last!==initial,initialSignal);
  await wait(()=>window.testGame().traffic.cars.some(c=>c.stopped&&c.speed===0));
  assert.equal(await page.evaluate(()=>window.testGame().traffic.cars.length),8);
  await page.keyboard.press('r');
  await page.evaluate(()=>{const g=window.testGame();g.camYaw=0;g.player.root.position.set(155,.04,74.8);});
  await page.keyboard.down('Shift');await page.keyboard.down('w');
  await wait(()=>window.testGame().player.root.position.y>5.5);
  await page.keyboard.up('w');await page.keyboard.up('Shift');
  console.log('PASS: ran up the Coast Viaduct on foot');
  assert.deepEqual(errors,[]);
  console.log('PASS: drove through the signalized junction, observed a light phase change and NPCs stopping; no browser or asset errors');
} finally {await browser.close();}
