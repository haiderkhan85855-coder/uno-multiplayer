// Optional developer test. Requires playwright-core and a local Chromium executable.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const url = process.env.GAME_URL || 'http://localhost:8000/';
const fallbacks = process.env.FALLBACKS === '1';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 500 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  if (fallbacks) await page.route('**/*.glb', route => route.fulfill({contentType:'application/octet-stream',body:Buffer.from('incomplete model')}));
  await page.route('**/game.js', async route => {
    const response = await route.fetch();
    const body = await response.text();
    // Inspect the live renderer simulation without shipping a production test hook.
    await route.fulfill({response,body:body+'\nwindow.testGame = () => game;'});
  });
  const wait = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 30000 });
  const walkToPrompt = async name => {
    await page.keyboard.down('w');
    await wait(() => +document.getElementById('speed').textContent >= 15);
    await wait(name => !document.getElementById('prompt').hidden && document.getElementById('prompt-label').textContent === `Enter ${name}`, name);
    await page.keyboard.up('w');
  };
  const takeRide = async (id, name) => {
    await page.keyboard.press('e');
    await wait(id => window.testGame().active?.id === id, id);
    await wait(name => document.getElementById('ride').textContent === name.toUpperCase(), name);
    const before = await page.evaluate(() => window.testGame().active.root.position.toArray());
    await page.keyboard.down('w');
    await wait(() => +document.getElementById('speed').textContent >= 12);
    await wait(([x,,z]) => {
      const pos = window.testGame().active.root.position;
      return Math.hypot(pos.x-x,pos.z-z) > 2;
    }, before);
    const heading = await page.evaluate(() => window.testGame().active.heading);
    await page.keyboard.down('d');
    await wait(h => Math.abs(window.testGame().active.heading-h) > .13, heading);
    await page.keyboard.up('d');
    await page.keyboard.up('w');
    await page.keyboard.press('e');
    await wait(() => window.testGame().active === null && window.testGame().player.root.visible);
    await wait(() => document.getElementById('ride').textContent === 'ON FOOT');
    console.log(`PASS: walk to ${name}, enter, accelerate, steer, exit`);
  };
  await page.goto(url);
  assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), 'OFF THEGRID.');
  await page.getByRole('button', { name: 'Play game' }).click();
  await wait(() => window.testGame?.()?.state === 'play');
  assert.equal(await page.locator('#ride').textContent(),'ON FOOT');
  assert.equal(await page.locator('#speed').textContent(),'0');
  await walkToPrompt('Car');
  await takeRide('car','Car');

  await page.keyboard.press('r');
  await page.keyboard.press('Space');
  await wait(() => window.testGame().player.root.position.y > .5);
  await wait(() => window.testGame().player.grounded);
  await page.keyboard.down('Shift');await page.keyboard.down('w');
  await wait(() => +document.getElementById('speed').textContent >= 30);
  await page.keyboard.up('w');await page.keyboard.up('Shift');
  await page.mouse.move(340,240);await page.mouse.down();await page.mouse.move(445,270,{steps:4});await page.mouse.up();
  await wait(() => Math.abs(window.testGame().camYaw) > .4 && window.testGame().camPitch > .5);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Resume'}).click();
  await wait(() => window.testGame().state === 'play');
  console.log('PASS: running, jumping, orbiting, reset, pause and resume');

  for (const [id,name] of [['scooter','Scooter'],['motorcycle','Motorcycle'],['bicycle','Bicycle']]) {
    // Stage each independent test just behind the parked ride, then approach using the keyboard.
    await page.keyboard.press('r');
    await page.evaluate(id => {
      const game = window.testGame(), v = game.vehicles.find(v => v.id === id);
      const [x,z,h] = v.spawn;
      game.camYaw = h;
      game.player.root.position.set(x+4.8*Math.sin(h),.04,z+4.8*Math.cos(h));
    }, id);
    await walkToPrompt(name);
    await takeRide(id,name);
  }
  if (fallbacks) {
    assert.ok(await page.evaluate(() => window.testGame().player.figure.visible));
    assert.deepEqual(await page.evaluate(() => window.testGame().vehicles.map(v => v.wheels.length)), [4,2,2,2]);
  } else {
    await wait(() => window.testGame().vehicles.find(v=>v.id==='car').wheels.some(w=>w.name==='wheel_frontLeft'));
    await wait(() => window.testGame().vehicles.find(v=>v.id==='motorcycle').wheels.some(w=>w.name==='wheel-front'));
    await wait(() => window.testGame().vehicles.find(v=>v.id==='scooter').wheels.some(w=>w.name==='RearWheel'));
    await wait(() => window.testGame().vehicles.find(v=>v.id==='bicycle').wheels.some(w=>w.name==='BackWheel'));
    await wait(() => !!window.testGame().player.anim?.actions.run);
  }
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Back to title'}).click();
  await page.getByRole('button',{name:'Play game'}).click();
  await wait(() => window.testGame().state === 'play' && window.testGame().active === null);
  assert.deepEqual(errors, []);
  console.log(`PASS: ${fallbacks?'all model fallbacks worked':'all vehicle GLBs and the animated runner loaded'}, return to title and replay, no page/console errors or bad HTTP responses`);
} finally { await browser.close(); }
