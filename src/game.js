const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = 960, H = 540, TILE = 32, COLS = 30, ROWS = 17;
const ui = {
  level: document.querySelector('#level-name'), objective: document.querySelector('#objective'),
  heat: document.querySelector('#heat-value'), heatBar: document.querySelector('#heat-bar'),
  tankIcon: document.querySelector('#tank-icon'), tankName: document.querySelector('#tank-name'),
  tankButton: document.querySelector('#tank-button'), tankWheel: document.querySelector('#tank-wheel'),
  grabButton: document.querySelector('#grab-button'), grabHint: document.querySelector('#grab-hint'),
  counter: document.querySelector('#rescued-counter'), feedback: document.querySelector('#feedback'),
  toast: document.querySelector('#toast'), cover: document.querySelector('#screen-cover'),
  end: document.querySelector('#end-screen'), endTitle: document.querySelector('#end-title'),
  endCopy: document.querySelector('#end-copy'), endEyebrow: document.querySelector('#end-eyebrow')
};
const TANKS = [
  { name: 'WATER', icon: '◉', color: '#ff7959', class: 'A', spray: '#c4e7ed' },
  { name: 'CO₂', icon: '❄', color: '#67c9e2', class: 'C', spray: '#d3f3f5' },
  { name: 'FOAM', icon: '●', color: '#e8ca63', class: 'B', spray: '#e8dda1' },
  { name: 'CRYO', icon: '✳', color: '#a7b6ff', class: 'X', spray: '#b3d5ff' }
];
const LEVELS = [
  { name: 'TRAINING WING', title: 'FIELD 01 — TRAINING WING', evac: 2, heat: 18, valve: true, mains: false, plate: false, meltdown: false,
    civilians: [[8,4],[22,12]], enemies: [['flame',11,5],['flame',24,5]], barrels: [], sparks: [],
    walls: [[15,1,1,6],[15,10,1,6],[1,8,7,1],[9,8,6,1],[16,8,5,1],[22,8,6,1]],
    valveAt: [5,13], exit: [28,8], windows: [[1,3],[28,14]], plateAt: [23,3], mainAt: [20,13] },
  { name: 'SERVER LAB', title: 'FIELD 02 — SERVER LAB', evac: 3, heat: 38, valve: false, mains: true, plate: true, meltdown: false,
    civilians: [[5,4],[21,4],[24,12]], enemies: [['flame',10,4],['spark',18,3],['slime',23,10]], barrels: [[13,4],[26,5],[11,12]], sparks: [[17,2],[18,2],[19,2],[20,2],[20,3],[20,4],[20,5],[19,5],[18,5],[17,5]],
    walls: [[10,1,1,5],[10,7,1,9],[19,1,1,2],[19,7,1,9],[1,8,7,1],[9,8,1,1],[11,8,8,1],[20,8,7,1]],
    valveAt: [5,13], exit: [28,8], windows: [[1,3],[28,14]], plateAt: [25,3], mainAt: [16,6] },
  { name: 'THE REFINERY', title: 'FIELD 03 — MELTDOWN', evac: 4, heat: 62, valve: false, mains: true, plate: true, meltdown: true,
    civilians: [[4,4],[12,3],[22,4],[24,13]], enemies: [['flame',8,5],['spark',18,3],['slime',23,11],['golem',22,8]], barrels: [[6,12],[13,10],[25,4]], sparks: [[18,2],[19,2],[20,2],[21,2],[21,3],[21,4]],
    walls: [[7,1,1,5],[7,7,1,9],[14,1,1,5],[14,7,1,3],[14,12,1,4],[20,1,1,1],[20,6,1,3],[20,11,1,5],[1,8,4,1],[6,8,8,1],[15,8,4,1],[21,8,6,1]],
    valveAt: [4,14], exit: [28,8], windows: [[1,3],[28,14]], plateAt: [24,8], mainAt: [17,13] }
];
const rand = (a,b) => a + Math.random()*(b-a);
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const angleDiff = (a,b) => Math.atan2(Math.sin(a-b),Math.cos(a-b));
let currentLevel = 0, gameStarted = false, paused = false, finished = false;
let level, player, civilians, enemies, particles, barrels, electrified, waterOff, mainsOff, plateOn;
let heat = 18, rescued = 0, tank = 0, aim = 0, sprayHeld = false, sprayClock = 0, worldTime = 0;
let joysticks = { left: null, right: null }, touches = new Map(), toastClock = 0, feedbackClock = 0, feedbackText = '';
let throwBodies = [], exitCooldown = 0, shake = 0;

function loadLevel(index) {
  currentLevel = index; level = LEVELS[index]; heat = level.heat; rescued = 0; tank = 0; aim = 0;
  waterOff = !level.valve; mainsOff = !level.mains; plateOn = !level.plate; electrified = new Set();
  particles = []; throwBodies = []; sprayClock = 0; finished = false; paused = false;
  player = { x: 3.2*TILE, y: 7.5*TILE, r: 10, speed: 142, holding: null, invuln: 0, face: 0 };
  civilians = level.civilians.map(([x,y],i)=>({x:(x+.5)*TILE,y:(y+.5)*TILE,id:i, rescued:false, held:false, panic:rand(0,6), bob:rand(0,6)}));
  enemies = level.enemies.map(([type,x,y],i)=>({type,x:(x+.5)*TILE,y:(y+.5)*TILE,hp:type==='golem'?3:type==='slime'?2:1,alive:true,frozen:0,stun:0,phase:rand(0,6),target:null,dir:rand(0,Math.PI*2),speed:type==='spark'?88:type==='flame'?39:type==='slime'?22:18,id:i}));
  barrels = level.barrels.map(([x,y])=>({x:(x+.5)*TILE,y:(y+.5)*TILE,alive:true}));
  ui.level.textContent = level.name; ui.objective.textContent = objectiveText();
  ui.counter.textContent = `EVACUATED 0 / ${level.evac}`;
  ui.heatBar.style.width = `${heat}%`; ui.heat.textContent = `${Math.round(heat)}%`;
  ui.grabHint.textContent = level.valve ? 'TURN OFF THE VALVE' : 'RESCUE A CIVILIAN';
  showToast(level.title); updateTank(); updateUi();
}
function objectiveText() {
  const needs=[];
  if (!waterOff) needs.push('SHUT THE VALVE');
  if (!mainsOff) needs.push('CUT THE POWER');
  if (!plateOn) needs.push('HOLD THE SWITCH');
  needs.push(`EVAC ${level.evac-rescued}`);
  return needs.join(' · ');
}
function showToast(text) { ui.toast.textContent=text; ui.toast.classList.add('show'); toastClock=2.2; }
function say(text) { feedbackText=text; ui.feedback.textContent=text; ui.feedback.classList.add('show'); feedbackClock=1.5; }
function updateTank() { ui.tankName.textContent=TANKS[tank].name; ui.tankIcon.textContent=TANKS[tank].icon; ui.tankIcon.style.color=TANKS[tank].color; }
function updateUi() {
  ui.objective.textContent=objectiveText(); ui.counter.textContent=`EVACUATED ${rescued} / ${level.evac}`;
  const nearValve = level.valve && !waterOff && near(level.valveAt);
  const nearMain = level.mains && !mainsOff && near(level.mainAt);
  ui.grabHint.textContent = player.holding ? 'TAP AGAIN TO THROW' : nearValve ? 'TURN OFF THE VALVE' : nearMain ? 'CUT THE ELECTRICAL MAIN' : closestCivilian() ? 'PICK UP CIVILIAN' : 'RESCUE A CIVILIAN';
  ui.grabButton.classList.toggle('carrying',!!player.holding);
}
function near(pos) { return Math.hypot(player.x-(pos[0]+.5)*TILE,player.y-(pos[1]+.5)*TILE)<43; }
function closestCivilian() { let found=null,best=44; for(const c of civilians){if(c.rescued||c.held)continue;const d=Math.hypot(player.x-c.x,player.y-c.y);if(d<best){best=d;found=c}}return found; }
function solidAt(x,y) {
  if(x<8||x>W-8||y<8||y>H-8)return true;
  const c=Math.floor(x/TILE),r=Math.floor(y/TILE);
  for(const [wx,wy,ww,hh] of level.walls) if(c>=wx&&c<wx+ww&&r>=wy&&r<wy+hh) return true;
  // blast door blocks the route until the puzzle is solved
  if(currentLevel===2&&!plateOn&&c===25&&r>=6&&r<=10)return true;
  if(currentLevel===1&&!plateOn&&c===25&&r>=6&&r<=10)return true;
  return false;
}
function moveBody(body,dx,dy,r=body.r||8) {
  let nx=body.x+dx;
  if(!solidAt(nx+r,body.y)&&!solidAt(nx-r,body.y))body.x=nx;
  let ny=body.y+dy;
  if(!solidAt(body.x,ny+r)&&!solidAt(body.x,ny-r))body.y=ny;
}
function isElectric(x,y) { const key=`${Math.floor(x/TILE)},${Math.floor(y/TILE)}`; return electrified.has(key)&&!mainsOff; }
function applySpray(dt) {
  if(!sprayHeld||!gameStarted||paused||finished)return;
  sprayClock-=dt;
  if(sprayClock>0)return;
  sprayClock=.075;
  const spec=TANKS[tank], range=160, angle=aim;
  for(let i=0;i<5;i++) {
    const a=angle+rand(-.22,.22), d=rand(16,range);
    particles.push({x:player.x+Math.cos(a)*d,y:player.y+Math.sin(a)*d,life:rand(.16,.42),max:.42,r:rand(2,5),color:spec.spray,kind:'mist',vx:Math.cos(a)*35,vy:Math.sin(a)*35});
  }
  for(const e of enemies) {
    if(!e.alive||e.frozen>0)continue;
    const d=Math.hypot(e.x-player.x,e.y-player.y), a=Math.atan2(e.y-player.y,e.x-player.x);
    if(d>range||Math.abs(angleDiff(a,angle))>.36)continue;
    const correct=(e.type==='flame'&&tank===0)||(e.type==='spark'&&tank===1)||(e.type==='slime'&&tank===2)||(e.type==='golem'&&tank===3);
    if(correct){
      e.hp-=dt*5.2;
      if(e.type==='golem'&&e.hp<=1.8){e.frozen=999;e.speed=0;say('GOLEM FROZEN — USE IT AS WEIGHT');}
      if(e.hp<=0){e.alive=false;for(let j=0;j<20;j++)burst(e.x,e.y,TANKS[tank].color);say(`${enemyName(e.type)} NEUTRALIZED`);}
    } else if(e.type==='slime'&&e.hp>0) {
      e.stun=.16;
      if(Math.random()<.028&&enemies.length<14){e.hp=1;enemies.push({...e,id:Math.random(),x:e.x+rand(-17,17),y:e.y+rand(-17,17),phase:rand(0,6)});say('WRONG MIX — SLIME SPLIT');}
    }
  }
  for(const b of barrels) {
    if(!b.alive)continue;
    const d=Math.hypot(b.x-player.x,b.y-player.y), a=Math.atan2(b.y-player.y,b.x-player.x);
    if(d<range&&Math.abs(angleDiff(a,angle))<.25&&tank!==1) { b.alive=false;shake=.35;for(let i=0;i<52;i++)burst(b.x,b.y,i%2?'#ff8b57':'#ffc878',rand(45,180));say('FUEL DRUM DETONATED — ROUTE DAMAGED'); heat=Math.min(100,heat+9); }
  }
  if(tank===0) {
    for(let d=20;d<120;d+=16){const x=player.x+Math.cos(angle)*d,y=player.y+Math.sin(angle)*d;if(solidAt(x,y))break;const c=Math.floor(x/TILE),r=Math.floor(y/TILE);if(level.sparks.some(([sx,sy])=>sx===c&&sy===r)&&!mainsOff){electrified.add(`${c},${r}`);}}
  }
}
function enemyName(type){return {flame:'CLASS A FLAME',spark:'SPARK PATROL',slime:'CHEMICAL SLIME',golem:'MAGMA GOLEM'}[type]}
function burst(x,y,color,speed=90){const a=rand(0,Math.PI*2),s=rand(18,speed);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.3,.85),max:.85,r:rand(2,5),color,kind:'spark'});}
function updateEnemies(dt) {
  for(const e of enemies) {
    if(!e.alive)continue;e.phase+=dt;
    if(e.frozen>0&&e.frozen<100){e.frozen-=dt;continue;}if(e.frozen>=100)continue;
    if(e.stun>0){e.stun-=dt;continue;}
    if(e.type==='spark') {
      // Conductive patrol follows its authored metal conduit loop.
      const nodes=level.sparks.map(([x,y])=>({x:(x+.5)*TILE,y:(y+.5)*TILE}));
      let target=nodes[e.target??0];if(!target){e.target=0;target=nodes[0];}
      const d=Math.hypot(target.x-e.x,target.y-e.y);if(d<6)e.target=((e.target||0)+1)%nodes.length;
      else {e.x+=(target.x-e.x)/d*e.speed*dt;e.y+=(target.y-e.y)/d*e.speed*dt;}continue;
    }
    let target=null;
    if(e.type==='flame') {
      let best=250;for(const c of civilians){if(c.rescued||c.held)continue;const d=Math.hypot(e.x-c.x,e.y-c.y);if(d<best){best=d;target=c;}}
      if(!target){const d=Math.hypot(e.x-player.x,e.y-player.y);if(d<135)target=player;}
    }
    const want=target?Math.atan2(target.y-e.y,target.x-e.x):e.dir+Math.sin(e.phase*.7)*.15;
    e.dir+=angleDiff(want,e.dir)*Math.min(1,dt*1.6);
    const v=e.speed*(target?1.18:1);
    const oldX=e.x,oldY=e.y;moveBody(e,Math.cos(e.dir)*v*dt,Math.sin(e.dir)*v*dt,8);
    if(Math.hypot(e.x-oldX,e.y-oldY)<.25){e.dir+=rand(1,2.4);}
    if(e.type==='flame'&&Math.hypot(e.x-player.x,e.y-player.y)<20&&player.invuln<=0){heat=Math.min(100,heat+7);player.invuln=1.1;say('TOO CLOSE — KEEP MOVING');}
  }
}
function update(dt) {
  worldTime+=dt;if(!gameStarted||paused||finished)return;
  if(toastClock>0){toastClock-=dt;if(toastClock<=0)ui.toast.classList.remove('show');}
  if(feedbackClock>0){feedbackClock-=dt;if(feedbackClock<=0)ui.feedback.classList.remove('show');}
  if(player.invuln>0)player.invuln-=dt;if(exitCooldown>0)exitCooldown-=dt;
  const stick=joysticks.left;
  if(stick){const dx=stick.x-stick.ox,dy=stick.y-stick.oy,len=Math.hypot(dx,dy),mag=Math.min(1,len/48);if(len>3){const vx=dx/len*mag,vy=dy/len*mag;moveBody(player,vx*player.speed*dt,vy*player.speed*dt,player.r);player.face=Math.atan2(vy,vx);}}
  if(joysticks.right){const dx=joysticks.right.x-joysticks.right.ox,dy=joysticks.right.y-joysticks.right.oy;if(Math.hypot(dx,dy)>6)aim=Math.atan2(dy,dx);sprayHeld=true;}else sprayHeld=false;
  applySpray(dt);updateEnemies(dt);
  for(const c of civilians){c.bob+=dt*3;if(c.held){c.x=player.x+Math.cos(aim)*13;c.y=player.y+Math.sin(aim)*13;}}
  for(const t of throwBodies){t.vy+=250*dt;t.x+=t.vx*dt;t.y+=t.vy*dt;t.z+=t.vz*dt;t.vz-=390*dt;if(t.z<=0){t.z=0;t.landed=true;const c=t.c;
      const exitD=Math.hypot(c.x-(level.exit[0]+.5)*TILE,c.y-(level.exit[1]+.5)*TILE);
      if(exitD<54||level.windows.some(([x,y])=>Math.hypot(c.x-(x+.5)*TILE,c.y-(y+.5)*TILE)<43)){c.rescued=true;rescued++;say('CIVILIAN EVACUATED — NICE THROW');for(let i=0;i<12;i++)burst(c.x,c.y,'#a8e7c7');}
      else {c.x=clamp(c.x,38,W-38);c.y=clamp(c.y,38,H-38);c.panic=6;}
      throwBodies.splice(throwBodies.indexOf(t),1);updateUi();
    }}
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.kind==='mist'){p.r*=.994;p.vx*=.98;p.vy*=.98;}}
  particles=particles.filter(p=>p.life>0);
  if(level.meltdown){heat=Math.min(100,heat+dt*1.05);if(heat>=100){gameOver(false);}}
  if(!level.meltdown&&worldTime%8<dt)heat=Math.min(100,heat+.2);
  if(isElectric(player.x,player.y)&&player.invuln<=0){heat=Math.min(100,heat+dt*22);if(Math.random()<dt*2)say('LIVE FLOOR — SHUT DOWN THE MAIN');}
  const plateX=(level.plateAt[0]+.5)*TILE,plateY=(level.plateAt[1]+.5)*TILE;
  const weightCiv=civilians.some(c=>!c.rescued&&!c.held&&Math.hypot(c.x-plateX,c.y-plateY)<26);
  const weightGolem=enemies.some(e=>e.alive&&e.type==='golem'&&e.frozen>=100&&Math.hypot(e.x-plateX,e.y-plateY)<26);
  if(level.plate&&!plateOn&&(weightCiv||weightGolem)){plateOn=true;say('PRESSURE PLATE HELD — BLAST DOOR OPEN');updateUi();}
  if(rescued>=level.evac&&waterOff&&mainsOff&&plateOn&&Math.hypot(player.x-(level.exit[0]+.5)*TILE,player.y-(level.exit[1]+.5)*TILE)<50&&exitCooldown<=0){finishLevel();}
  if(worldTime%0.12<dt)updateUi();
  heat=clamp(heat,0,100);ui.heatBar.style.width=`${heat}%`;ui.heat.textContent=`${Math.round(heat)}%`;
}
function gameOver(won){finished=true;ui.end.classList.add('visible');ui.endEyebrow.textContent=won?'SHIFT COMPLETE':'SIGNAL LOST';ui.endTitle.textContent=won?'ALL SAFE.':'TIME IS UP.';ui.endCopy.textContent=won?'The crew is out. Take a breath before the next shift.':'The building crossed its thermal limit. Try a faster route.';document.querySelector('#next-button').textContent=won&&currentLevel<2?'NEXT SHIFT ↗':'TRY AGAIN ↗';}
function finishLevel(){exitCooldown=2;gameOver(true);}
function nextLevel(){ui.end.classList.remove('visible');if(currentLevel<2){loadLevel(currentLevel+1);gameStarted=true;}else{loadLevel(0);gameStarted=false;ui.cover.classList.remove('hidden');}}
function actionTap(){if(!gameStarted||paused||finished)return;
  if(player.holding){const c=player.holding;player.holding=null;c.held=false;const v=255;c.x=player.x+Math.cos(aim)*14;c.y=player.y+Math.sin(aim)*14;throwBodies.push({c,x:c.x,y:c.y,z:0,vx:Math.cos(aim)*v,vy:Math.sin(aim)*v,vz:220});say('CIVILIAN AWAY — GUIDE THEM TO AN EXIT');updateUi();return;}
  if(level.valve&&!waterOff&&near(level.valveAt)){waterOff=true;say('WATER VALVE CLOSED');updateUi();return;}
  if(level.mains&&!mainsOff&&near(level.mainAt)){mainsOff=true;electrified.clear();say('ELECTRICAL MAIN ISOLATED');updateUi();return;}
  const c=closestCivilian();if(c){c.held=true;player.holding=c;say('CIVILIAN SECURED — THROW TOWARD AN EXIT');updateUi();return;}
  if(near(level.exit)){if(rescued<level.evac)say(`${level.evac-rescued} MORE CIVILIAN${level.evac-rescued===1?'':'S'} TO EVACUATE`);else if(!waterOff||!mainsOff||!plateOn)say('THE EXIT IS STILL SEALED');else say('STEP INTO THE EXIT TO COMPLETE THE SHIFT');}
}
function toggleWheel(force){ui.tankWheel.classList.toggle('open',force??!ui.tankWheel.classList.contains('open'));}
function chooseTank(n){tank=n;updateTank();toggleWheel(false);say(`${TANKS[n].name} EXTINGUISHER READY`);}

// Pointer IDs are tracked independently so either thumb can move and spray at once.
function localPoint(event){const r=canvas.getBoundingClientRect();return{x:(event.clientX-r.left)*W/r.width,y:(event.clientY-r.top)*H/r.height};}
canvas.addEventListener('pointerdown',e=>{if(!gameStarted||paused||finished)return;canvas.setPointerCapture(e.pointerId);const p=localPoint(e);const side=p.x<W*.5?'left':'right';if(joysticks[side])return;joysticks[side]={id:e.pointerId,ox:p.x,oy:p.y,x:p.x,y:p.y};touches.set(e.pointerId,side);if(side==='right'){aim=Math.atan2(p.y-player.y,p.x-player.x);sprayHeld=true;}e.preventDefault();});
canvas.addEventListener('pointermove',e=>{const side=touches.get(e.pointerId);if(!side)return;const p=localPoint(e);joysticks[side].x=p.x;joysticks[side].y=p.y;if(side==='right'&&Math.hypot(p.x-joysticks.right.ox,p.y-joysticks.right.oy)>6)aim=Math.atan2(p.y-joysticks.right.oy,p.x-joysticks.right.ox);e.preventDefault();});
function releasePointer(e){const side=touches.get(e.pointerId);if(!side)return;touches.delete(e.pointerId);joysticks[side]=null;if(side==='right')sprayHeld=false;}
canvas.addEventListener('pointerup',releasePointer);canvas.addEventListener('pointercancel',releasePointer);canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.querySelector('#start-button').addEventListener('click',()=>{gameStarted=true;ui.cover.classList.add('hidden');showToast(level.title);});
document.querySelector('#next-button').addEventListener('click',nextLevel);
document.querySelector('#pause-button').addEventListener('click',()=>{if(!gameStarted)return;paused=!paused;document.querySelector('#pause-button').textContent=paused?'▶':'Ⅱ';if(paused)say('PAUSED — TAP PLAY TO CONTINUE');});
ui.grabButton.addEventListener('pointerdown',e=>{e.preventDefault();ui.grabButton.classList.add('pressed');});
ui.grabButton.addEventListener('pointerup',e=>{e.preventDefault();ui.grabButton.classList.remove('pressed');actionTap();});
ui.tankButton.addEventListener('click',()=>toggleWheel());
ui.tankWheel.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>chooseTank(Number(button.dataset.tank))));

// Tiny pixel-art drawing helpers. Draw into a fixed low-resolution world for a crisp screen.
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function roundRect(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function drawWorld(){
  rect(0,0,W,H,'#19282a');
  // Alternating worn floor tiles and room borders.
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const n=(x*17+y*31)%13;rect(x*TILE,y*TILE,TILE,TILE,n<4?'#263532':'#293a36');
    rect(x*TILE+2,y*TILE+2,28,28,n<4?'#293a35':'#2b3d38');
    if((x+y*3)%11===0)rect(x*TILE+8,y*TILE+8,2,2,'#3b4a3e');
  }
  // Decorative room partitions.
  for(const [x,y,w,h] of level.walls)for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)drawWall(xx*TILE,yy*TILE);
  // Pooled water and sparks; water-created live tiles pulse until CO2 isolates mains.
  if(level.sparks.length){for(const [x,y] of level.sparks){rect(x*TILE+3,y*TILE+3,26,26,'#293c42');rect(x*TILE+8,y*TILE+14,16,4,'#5d7980');rect(x*TILE+14,y*TILE+8,4,16,'#49636c');if(electrified.has(`${x},${y}`)&&!mainsOff){ctx.globalAlpha=.5+Math.sin(worldTime*9+x)*.3;rect(x*TILE+3,y*TILE+3,26,26,'#7ae6ff');ctx.globalAlpha=1;}}}
  if(!waterOff)drawValve();else if(level.valve)drawValve(true);
  if(level.mains)drawMain(mainsOff);
  for(const b of barrels)if(b.alive)drawBarrel(b);
  drawPlate();drawExit();
  for(const [x,y] of level.windows)drawWindow(x,y);
  // Door lintels glint to hint at the puzzle route.
  if(level.plate&&!plateOn){rect(25*TILE+3,7*TILE+2,26,3,'#e5a56c');rect(25*TILE+3,10*TILE-5,26,3,'#e5a56c');}
  drawScorchMarks();
}
function drawWall(x,y){rect(x+1,y+1,30,30,'#172629');rect(x+3,y+3,26,24,'#52605a');rect(x+3,y+3,26,4,'#718077');rect(x+6,y+9,20,2,'#37474a');rect(x+3,y+27,26,3,'#19282a');}
function drawValve(disabled=false){const x=(level.valveAt[0]+.5)*TILE,y=(level.valveAt[1]+.5)*TILE;rect(x-11,y-13,22,25,'#253339');rect(x-8,y-9,16,17,'#5f706d');rect(x-3,y-17,6,7,'#c1c7a6');rect(x-9,y-20,18,4,disabled?'#8fbd9d':'#ed8560');rect(x-2,y-2,4,8,'#d7c58a');if(!disabled)rect(x-1,y-22,2,3,'#ffc278');}
function drawMain(off){const x=(level.mainAt[0]+.5)*TILE,y=(level.mainAt[1]+.5)*TILE;rect(x-11,y-15,22,30,'#20343a');rect(x-8,y-11,16,22,'#647778');rect(x-4,y-8,8,3,off?'#a1dab1':'#ff885f');rect(x-4,y-1,8,8,'#293b3e');rect(x-2,y+2,4,3,off?'#a1dab1':'#fb744f');}
function drawBarrel(b){const x=b.x,y=b.y;rect(x-10,y-12,20,24,'#8e5643');rect(x-8,y-11,16,4,'#d0a363');rect(x-8,y+7,16,4,'#d0a363');rect(x-4,y-5,8,9,'#e8c66b');rect(x-2,y-3,4,5,'#664c39');}
function drawPlate(){const x=(level.plateAt[0]+.5)*TILE,y=(level.plateAt[1]+.5)*TILE;rect(x-13,y-8,26,16,'#17282a');rect(x-10,y-5,20,10,plateOn?'#92d0a0':'#b57654');rect(x-6,y-2,12,4,plateOn?'#d8f4b4':'#e5b075');}
function drawExit(){const x=(level.exit[0]+.5)*TILE,y=(level.exit[1]+.5)*TILE;rect(x-15,y-19,30,38,'#101d20');rect(x-11,y-16,22,32,waterOff&&mainsOff&&plateOn?'#80cda1':'#9a7359');rect(x-7,y-12,14,24,waterOff&&mainsOff&&plateOn?'#a6efb3':'#413b32');rect(x+5,y,y===0?0:2,2,'#f5d686');ctx.globalAlpha=.5+Math.sin(worldTime*3)*.2;rect(x-7,y-12,14,24,'#d8f1ba');ctx.globalAlpha=1;}
function drawWindow(x,y){const cx=(x+.5)*TILE,cy=(y+.5)*TILE;rect(cx-11,cy-9,22,18,'#5e8a88');rect(cx-8,cy-6,16,12,'#b3c18d');rect(cx-1,cy-7,2,14,'#536b64');rect(cx-9,cy-1,18,2,'#536b64');}
function drawScorchMarks(){for(let i=0;i<12;i++){const x=((i*79+41)%900)+25,y=((i*47+73)%470)+35;ctx.globalAlpha=.1;rect(x,y,rand(6,15),2,'#d29a60');ctx.globalAlpha=1;}}
function drawCivilian(c){if(c.rescued||c.held)return;const b=Math.sin(c.bob)*1.5;rect(c.x-8,c.y+5+b,16,3,'#1b2523');rect(c.x-4,c.y-8+b,8,14,'#d5a77f');rect(c.x-5,c.y-11+b,10,7,'#c9b698');rect(c.x-4,c.y-13+b,8,3,'#6b4c3f');rect(c.x-5,c.y+1+b,4,7,'#d5a77f');rect(c.x+1,c.y+1+b,4,7,'#d5a77f');rect(c.x-3,c.y-6+b,2,2,'#4e4b40');if(Math.sin(worldTime*4+c.panic)>0.88){ctx.globalAlpha=.7;rect(c.x-1,c.y-19,2,3,'#f3d996');ctx.globalAlpha=1;}}
function drawEnemy(e){if(!e.alive)return;const x=e.x,y=e.y,pulse=Math.sin(e.phase*8);
  if(e.type==='flame'){rect(x-9,y+8,18,3,'#1b2421');rect(x-7,y-4,14,13,'#c5523c');rect(x-5,y-10+pulse*2,10,13,'#f17946');rect(x-3,y-14+pulse*2,6,9,'#ffc56c');rect(x-3,y,2,3,'#ffe19a');rect(x+2,y,2,3,'#ffe19a');}
  if(e.type==='spark'){rect(x-9,y+8,18,3,'#1b2421');rect(x-7,y-7,14,15,'#367d94');rect(x-4,y-11,8,6,'#a2e8e9');rect(x-2,y-3,4,5,'#f2e7af');ctx.globalAlpha=.6;rect(x-12,y-2,4,3,'#91eaff');rect(x+8,y+2,4,3,'#91eaff');ctx.globalAlpha=1;}
  if(e.type==='slime'){rect(x-10,y+6,20,5,'#1d2925');rect(x-10,y-2+Math.sin(e.phase*2)*2,20,10,'#8ba85c');rect(x-6,y-7,12,8,'#aacb70');rect(x-4,y-4,2,2,'#304c42');rect(x+3,y-4,2,2,'#304c42');}
  if(e.type==='golem'){rect(x-13,y+10,26,4,'#1b2421');rect(x-12,y-7,24,18,'#8f5141');rect(x-9,y-13,18,12,'#a65c44');rect(x-6,y-16,5,5,'#e88d54');rect(x+4,y-15,5,5,'#ed9354');rect(x-6,y-3,4,4,'#ffb963');rect(x+3,y-3,4,4,'#ffb963');}
  if(e.frozen>=100){rect(x-12,y-15,24,26,'#90d4ed88');rect(x-8,y-10,16,18,'#a7dcef88');}
  if(e.hp<(e.type==='golem'?2.8:1.8)){rect(x-9,y-20,18,3,'#33413b');rect(x-8,y-19,Math.max(3,14*e.hp/(e.type==='golem'?3:2)),1,'#ff8965');}
}
function drawPlayer(){const x=player.x,y=player.y;ctx.save();ctx.translate(x,y);ctx.rotate(player.face||aim);if(player.invuln>0&&Math.floor(worldTime*12)%2)ctx.globalAlpha=.42;rect(-8,7,17,4,'#17201e');rect(-7,1,14,9,'#d2744c');rect(-7,-8,14,12,'#8ca28d');rect(-6,-14,12,8,'#d3b792');rect(-5,-17,10,5,'#6b5143');rect(-3,-8,5,5,'#e2ccaa');rect(3,-2,11,4,'#495657');rect(10,-4,8,8,TANKS[tank].color);rect(14,-2,7,4,'#c6c5a6');ctx.restore();if(player.holding){rect(x-4,y-23,8,5,'#d8bc8a');rect(x-3,y-19,6,7,'#d5a77f');}}
function drawParticles(){for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);if(p.kind==='mist'){rect(p.x-p.r,p.y-p.r,p.r*2,p.r*2,p.color);}else{rect(p.x-p.r/2,p.y-p.r/2,p.r,p.r,p.color);}}ctx.globalAlpha=1;}
function drawThrowBodies(){for(const t of throwBodies){const y=t.y-t.z;ctx.globalAlpha=.3;rect(t.x-7,t.y+7,14,3,'#101717');ctx.globalAlpha=1;rect(t.x-4,y-6,8,11,'#d5a77f');rect(t.x-5,y-10,10,7,'#d0b998');rect(t.x-4,y-12,8,3,'#6b4c3f');}}
function drawJoysticks(){for(const side of ['left','right']){const j=joysticks[side];if(!j)continue;const dx=j.x-j.ox,dy=j.y-j.oy,l=Math.hypot(dx,dy),k=Math.min(1,40/(l||1));ctx.globalAlpha=.35;ctx.beginPath();ctx.arc(j.ox,j.oy,41,0,Math.PI*2);ctx.fillStyle='#c2d7c9';ctx.fill();ctx.globalAlpha=.72;ctx.beginPath();ctx.arc(j.ox+dx*k,j.oy+dy*k,18,0,Math.PI*2);ctx.fillStyle=side==='right'?TANKS[tank].color:'#a9e3be';ctx.fill();ctx.globalAlpha=1;}}
function drawAim(){if(!sprayHeld)return;ctx.globalAlpha=.36;ctx.strokeStyle=TANKS[tank].color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(player.x,player.y);ctx.lineTo(player.x+Math.cos(aim)*135,player.y+Math.sin(aim)*135);ctx.stroke();ctx.globalAlpha=1;}
function render(){ctx.clearRect(0,0,W,H);ctx.save();if(shake>0){ctx.translate(rand(-2,2),rand(-2,2));shake-=1/60;}drawWorld();drawAim();for(const c of civilians)drawCivilian(c);for(const e of enemies)drawEnemy(e);drawThrowBodies();drawPlayer();drawParticles();drawJoysticks();ctx.restore();}
let last=performance.now();function frame(now){const dt=Math.min(.04,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(frame);}
loadLevel(0);requestAnimationFrame(frame);
