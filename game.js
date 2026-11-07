(() => {
'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const toast = document.getElementById('toast');
const scanlines = document.getElementById('scanlines');
const W=960,H=640,T=32,OX=32,OY=88,COLS=24,ROWS=16;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const tanks=[
  {name:'WATER',color:'#f36c55',symbol:'●',hint:'CLASS A · WOOD'},
  {name:'CO₂',color:'#64c7ec',symbol:'◉',hint:'CLASS C · ELECTRICAL'},
  {name:'FOAM',color:'#f1ca58',symbol:'◆',hint:'CLASS B · CHEMICAL'},
  {name:'CRYO',color:'#d2f3ff',symbol:'❄',hint:'EXTREME HEAT · MAGMA'}
];
let map=Array.from({length:ROWS},()=>Array(COLS).fill(0)); // 0 floor, 1 wall, 2 furniture
function wall(x,y){if(x>=0&&x<COLS&&y>=0&&y<ROWS)map[y][x]=1;}
function block(x,y){if(x>=0&&x<COLS&&y>=0&&y<ROWS)map[y][x]=2;}
// Outer shell; gaps are open windows and the south rescue exit.
for(let x=0;x<COLS;x++){wall(x,0);wall(x,ROWS-1);}
for(let y=0;y<ROWS;y++){wall(0,y);wall(COLS-1,y);}
[4,10,17].forEach(x=>{map[0][x]=0;map[0][x+1]=0;});
map[ROWS-1][11]=0;map[ROWS-1][12]=0;
// Room dividers, with wide doorways into the central corridors.
for(let x=2;x<22;x++){if(![7,8,15,16].includes(x)){wall(x,5);wall(x,10);}}
for(let y=2;y<14;y++){if(![3,4,8,9,12].includes(y)){wall(7,y);wall(16,y);}}
// Furnishings / obstacles.
[[3,3],[4,3],[5,7],[3,8],[11,3],[12,3],[14,7],[19,3],[20,3],[19,7],[4,12],[11,12],[12,12],[19,12]].forEach(p=>block(p[0],p[1]));
const isSolid=(x,y)=>{const tx=Math.floor((x-OX)/T),ty=Math.floor((y-OY)/T);return tx<0||ty<0||tx>=COLS||ty>=ROWS||map[ty][tx]!==0;};
const player={x:OX+12*T,y:OY+13*T,angle:-Math.PI/2,carrying:null,hp:100,invuln:0};
let tank=0,temperature=29,score=0,saved=0,gameState='title',gameOverReason='',scanOn=true,radial=false;
let fires=[],floods=[],steam=[],particles=[],sprayClock=0,spreadClock=0,toastTimer=0,elapsed=0;
const victims=[
 {x:OX+4*T,y:OY+4*T,panic:0,carried:false,saved:false,name:'MIA'},
 {x:OX+12*T,y:OY+8*T,panic:0,carried:false,saved:false,name:'ELI'},
 {x:OX+20*T,y:OY+9*T,panic:0,carried:false,saved:false,name:'JUNE'},
 {x:OX+4*T,y:OY+12*T,panic:0,carried:false,saved:false,name:'OTTO'}
];
const makeFire=(tx,ty,type)=>({x:OX+(tx+.5)*T,y:OY+(ty+.5)*T,type,hp:100,r:12,age:Math.random()*5});
 fires=[makeFire(5,2,0),makeFire(13,4,1),makeFire(19,5,2),makeFire(11,8,3),makeFire(20,12,0)];
const exits=[{x:OX+12*T,y:OY+15*T,type:'EXIT',color:'#71e2a2'}];
const windows=[{x:OX+4.5*T,y:OY,type:'WINDOW'},{x:OX+10.5*T,y:OY,type:'WINDOW'},{x:OX+17.5*T,y:OY,type:'WINDOW'}];
const controls={joy:null,aim:null,spray:false,buttonIds:new Set()};
function notify(message){toast.textContent=message;toast.classList.add('show');toastTimer=1.6;}
function cellOf(x,y){return {x:Math.floor((x-OX)/T),y:Math.floor((y-OY)/T)};}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function text(str,x,y,size=12,color='#f3e8c8',align='left',font='700'){ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=`${font} ${size}px "Space Mono", monospace`;ctx.fillText(str,x,y);}
function drawWorld(){
  rect(0,0,W,H,'#11191b');
  // Building floor tiles and subtle room lighting.
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const px=OX+x*T,py=OY+y*T;
    if(map[y][x]===1){rect(px,py,T,T,'#354346');rect(px+1,py+1,T-2,T-2,'#283639');rect(px,py+T-5,T,5,'#1d292b');rect(px+2,py+3,4,2,'#71807a');}
    else if(map[y][x]===2){rect(px,py,T,T,'#45504b');rect(px+3,py+4,26,23,'#6a5441');rect(px+5,py+6,22,17,'#87694d');rect(px+3,py+23,26,4,'#352f2a');}
    else {rect(px,py,T,T,(x+y)%2?'#55554a':'#5b5a4d');rect(px+1,py+1,T-2,T-2,(x+y)%2?'#5e5c4e':'#625f50');rect(px,py,T,1,'#716c5a');}
  }
  // Room labels and architectural cues.
  text('SLEEPING QUARTERS',OX+4*T,OY+1.5*T,8,'#b4a98d');text('CONTROL ROOM',OX+11*T,OY+1.5*T,8,'#b4a98d');text('BREAK ROOM',OX+19*T,OY+1.5*T,8,'#b4a98d');
  text('STORAGE',OX+3*T,OY+6*T,8,'#b4a98d');text('SERVICE HALL',OX+11.5*T,OY+6*T,8,'#b4a98d');text('KITCHEN',OX+19*T,OY+6*T,8,'#b4a98d');
  // Windows along the north wall.
  for(const w of windows){rect(w.x-19,OY-4,38,10,'#c8d6c6');rect(w.x-16,OY-2,32,5,'#82afb0');rect(w.x-2,OY-3,3,8,'#d9e3cc');}
  // South exit, marked like a rescue bay.
  rect(OX+11*T,OY+(ROWS-1)*T,2*T,T,'#2d4d40');rect(OX+11*T+5,OY+(ROWS-1)*T+4,54,24,'#46785a');rect(OX+11*T+10,OY+(ROWS-1)*T+8,44,20,'#9bce83');text('SAFE ZONE',OX+12*T,OY+(ROWS-1)*T+16,8,'#163425','center');
  // Electrified flood and thrown steam hazards.
  for(const f of floods){rect(OX+f.x*T+2,OY+f.y*T+2,T-4,T-4,'#397eac99');text('ϟ',OX+(f.x+.5)*T,OY+(f.y+.5)*T,19,'#9ceaff','center');}
  for(const s of steam){ctx.globalAlpha=clamp(s.life/2,0,.7);ctx.fillStyle='#deded0';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  // Windows and exit destination glows.
  ctx.globalAlpha=.22;ctx.fillStyle='#76e3a1';ctx.beginPath();ctx.arc(exits[0].x,exits[0].y,34,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  for(const f of fires)drawFire(f);
  for(const p of particles){ctx.globalAlpha=clamp(p.life/.55,0,1);rect(p.x-2,p.y-2,4,4,p.color);ctx.globalAlpha=1;}
  for(const v of victims)if(!v.saved&&!v.carried)drawVictim(v);
  drawPlayer();
}
function drawFire(f){
  const colors=['#ff7048','#70dcfa','#eec951','#c994ff'];
  const color=colors[f.type],pulse=Math.sin(elapsed*8+f.age)*2;
  ctx.globalAlpha=.16;ctx.fillStyle=color;ctx.beginPath();ctx.arc(f.x,f.y,26+pulse,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  // Pixel flame clusters.
  const flick=Math.sin(elapsed*10+f.age)*3;
  rect(f.x-10,f.y-8,20,16,'#a8372c');rect(f.x-7,f.y-15-flick,8,13,color);rect(f.x+1,f.y-13+flick,9,12,'#ffb34e');rect(f.x-4,f.y-5,8,9,'#ffe19a');
  if(f.type===1){text('ϟ',f.x,f.y-21,14,'#dcf8ff','center');}else if(f.type===2){text('!',f.x,f.y-21,12,'#fff0a5','center');}else if(f.type===3){text('✦',f.x,f.y-21,12,'#f1d8ff','center');}
  rect(f.x-12,f.y+16,24,3,'#211d1a');rect(f.x-12,f.y+16,24*f.hp/100,3,color);
}
function drawVictim(v){
  const z=v.z||0;
  ctx.fillStyle='#0006';ctx.fillRect(v.x-8,v.y+7,17,4);
  if(z>0){ctx.globalAlpha=.72;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(v.x,v.y+7,8+z*.08,3+z*.02,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  rect(v.x-6,v.y-7-z,12,15,'#5c9a8b');rect(v.x-5,v.y-12-z,10,8,'#e3b58a');rect(v.x-7,v.y-14-z,14,4,'#42443f');
  rect(v.x-8,v.y-2-z,3,7,'#e7c39c');rect(v.x+5,v.y-2-z,3,7,'#e7c39c');
  if(Math.sin(elapsed*9+v.panic)>0)text('!',v.x+11,v.y-17-z,12,'#ffe47d','center');
}
function drawPlayer(){
  let x=player.x,y=player.y;
  if(player.carrying){drawVictim({x,y:y-18,panic:0});}
  ctx.fillStyle='#0007';ctx.fillRect(x-9,y+8,19,5);
  rect(x-8,y-7,16,19,'#b76832');rect(x-6,y-8,12,14,'#e0ad4c');rect(x-7,y+5,5,8,'#303b3b');rect(x+2,y+5,5,8,'#303b3b');
  // Red helmet and front brim orient with the nozzle.
  ctx.save();ctx.translate(x,y-7);ctx.rotate(player.angle);rect(-7,-8,14,10,'#b9473b');rect(-3,-10,8,4,'#ed6451');rect(3,-2,8,3,'#8e302b');rect(1,-5,2,2,'#ffe1a0');ctx.restore();
}
function drawHud(){
  rect(0,0,W,82,'#151e20');rect(0,80,W,3,'#8a5740');
  text('HOTLINE',28,25,14,'#f1e7c5');text('9',103,24,17,'#ff7651');text('FIRE & RESCUE',28,49,9,'#94a59d');
  text('BUILDING HEAT',252,18,8,'#b8b7a3');rect(252,29,335,15,'#343c3b');rect(28,66,79,14,'#263235');text(`CRT ${scanOn?'ON':'OFF'}`,67,73,7,scanOn?'#83d8aa':'#96a59d','center');rect(254,31,331,11,'#1c2727');
  const heatColor=temperature>75?'#f25e43':temperature>50?'#f0b74f':'#75d69c';rect(254,31,327*temperature/100,11,heatColor);
  text(`${Math.floor(temperature)}%`,594,37,11,heatColor);text('COLLAPSE',252,58,8,'#899891');
  text('SCORE',660,18,8,'#99a69d');text(String(score).padStart(5,'0'),660,39,17,'#f6e8c7');
  text('SURVIVORS',745,18,8,'#99a69d');text(`${saved} / ${victims.length}`,745,39,14,'#8ce0a7');
  // Active tank quick-select.
  ctx.fillStyle='#293538';ctx.fillRect(866,10,70,62);ctx.strokeStyle=tanks[tank].color;ctx.lineWidth=2;ctx.strokeRect(867,11,68,60);
  text(tanks[tank].symbol,885,34,22,tanks[tank].color,'center');text('TANK',918,24,7,'#96a59d','center');text(tanks[tank].name,918,47,8,tanks[tank].color,'center');
  ctx.strokeStyle='#ffffff35';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(20,82);ctx.lineTo(940,82);ctx.stroke();
  // Room hazard markers.
  text('FLOOR 03   ·   EAST WING',OX+8,OY-21,8,'#b8b29d');text('RESCUE BAY ↓',OX+12*T,OY+ROWS*T+11,8,'#92d7a4','center');
  drawControls();
}
function drawControls(){
  const joy=controls.joy;
  if(joy){ctx.globalAlpha=.6;ctx.strokeStyle='#d9e8d7';ctx.lineWidth=2;ctx.beginPath();ctx.arc(joy.sx,joy.sy,49,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#b8d5c8';ctx.beginPath();ctx.arc(joy.x,joy.y,22,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  else{ctx.globalAlpha=.24;ctx.strokeStyle='#e2e8d6';ctx.lineWidth=2;ctx.beginPath();ctx.arc(112,520,48,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#e2e8d6';ctx.beginPath();ctx.arc(112,520,19,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;text('MOVE',112,580,8,'#e5e5d0','center');}
  // Current aim ray, clear of the world map for instant feedback.
  if(controls.aim){ctx.strokeStyle=tanks[tank].color+'90';ctx.lineWidth=2;ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(player.x,player.y);ctx.lineTo(player.x+Math.cos(player.angle)*100,player.y+Math.sin(player.angle)*100);ctx.stroke();ctx.setLineDash([]);}
  button(752,526,39,'GRAB',player.carrying?'THROW':'GRAB','#f2ca65',player.carrying);
  button(865,526,43,'SPRAY','HOLD',tanks[tank].color,controls.spray);
  if(radial)drawWheel();
}
function button(x,y,r,label,sub,color,active){
  ctx.globalAlpha=active?.94:.73;ctx.fillStyle=active?color:'#182326';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=active?'#fff1c8':'#d6d5bd';ctx.lineWidth=2;ctx.stroke();ctx.globalAlpha=1;
  text(label,x,y-5,10,active?'#172022':'#f3e8c8','center');text(sub,x,y+11,7,active?'#172022':'#9eaaa0','center');
}
function drawWheel(){
  ctx.fillStyle='#071012bb';ctx.fillRect(0,0,W,H);
  text('SELECT EXTINGUISHER',480,194,12,'#f0e5c4','center');
  const cx=480,cy=340,r=103;
  for(let i=0;i<4;i++){
    const a=-Math.PI/2+i*Math.PI/2,px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;
    ctx.fillStyle=i===tank?tanks[i].color:'#283537';ctx.beginPath();ctx.arc(px,py,42,0,Math.PI*2);ctx.fill();ctx.strokeStyle=tanks[i].color;ctx.lineWidth=2;ctx.stroke();
    text(tanks[i].symbol,px,py-8,21,i===tank?'#192225':tanks[i].color,'center');text(tanks[i].name,px,py+17,8,i===tank?'#192225':'#f3e8c8','center');
  }
  ctx.fillStyle='#172225';ctx.beginPath();ctx.arc(cx,cy,47,0,Math.PI*2);ctx.fill();text('TANK',cx,cy-5,9,'#f4e9cb','center');text('WHEEL',cx,cy+10,7,'#98a79e','center');
  text('TAP A TANK · TAP OUTSIDE TO CLOSE',480,479,9,'#b8c5b8','center');
}
function pointerPos(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
function onDown(e){
  e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=pointerPos(e);
  if(gameState==='title'){gameState='playing';notify('GET EVERYONE TO THE SAFE ZONE');return;}
  if(gameState==='over'||gameState==='won'){resetGame();return;}
  if(radial){
    const dx=p.x-480,dy=p.y-340,d=Math.hypot(dx,dy);
    if(d>45&&d<160){const a=Math.atan2(dy,dx);tank=Math.round((a+Math.PI/2)/(Math.PI/2)+4)%4;notify(`${tanks[tank].name} SELECTED · ${tanks[tank].hint}`);}
    radial=false;return;
  }
  if(p.y<84&&p.x>850){radial=true;return;}
  if(p.y<84&&p.x<120){scanOn=!scanOn;scanlines.classList.toggle('off',!scanOn);return;}
  if(p.x>810&&p.y>475){controls.spray=true;controls.buttonIds.add(e.pointerId);return;}
  if(p.x>690&&p.x<810&&p.y>475){action();return;}
  if(p.x<W*.53&&p.y>H*.46){controls.joy={id:e.pointerId,sx:p.x,sy:p.y,x:p.x,y:p.y};return;}
  if(p.x>W*.45){controls.aim={id:e.pointerId,x:p.x,y:p.y};aimAt(p.x,p.y);return;}
}
function onMove(e){
  const p=pointerPos(e);
  if(controls.joy?.id===e.pointerId){controls.joy.x=p.x;controls.joy.y=p.y;}
  if(controls.aim?.id===e.pointerId){controls.aim.x=p.x;controls.aim.y=p.y;aimAt(p.x,p.y);}
}
function onUp(e){
  if(controls.joy?.id===e.pointerId)controls.joy=null;
  if(controls.aim?.id===e.pointerId)controls.aim=null;
  if(controls.buttonIds.has(e.pointerId)){controls.buttonIds.delete(e.pointerId);if(!controls.buttonIds.size)controls.spray=false;}
}
function aimAt(x,y){const dx=x-player.x,dy=y-player.y;if(Math.hypot(dx,dy)>3)player.angle=Math.atan2(dy,dx);}
canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onUp);
function action(){
  if(player.carrying){throwVictim(player.carrying);return;}
  const v=victims.filter(v=>!v.saved&&!v.carried&&!v.flight).sort((a,b)=>dist(player,a)-dist(player,b))[0];
  if(v&&dist(player,v)<48){player.carrying=v;v.carried=true;notify(`${v.name} SECURED · FIND A WINDOW OR EXIT`);}
  else notify('NO SURVIVOR IN REACH');
}
function throwVictim(v){
  const targets=[...windows,...exits];let candidates=targets.map(t=>{const dx=t.x-player.x,dy=t.y-player.y,d=Math.hypot(dx,dy),dot=(dx*Math.cos(player.angle)+dy*Math.sin(player.angle))/Math.max(1,d);return {t,d,dot};}).filter(o=>o.dot>.63&&o.d<430).sort((a,b)=>a.d-b.d);
  const dest=candidates[0]?.t;
  const dx=dest?dest.x-player.x:Math.cos(player.angle)*150,dy=dest?dest.y-player.y:Math.sin(player.angle)*150;
  const flight=.82;
  v.x=player.x;v.y=player.y;v.z=0;v.flight={sx:v.x,sy:v.y,dx,dy,dest,time:flight,elapsed:0};v.carried=false;player.carrying=null;
  notify(dest?`THROWING ${v.name} · ${dest.type}`:'NO SAFE LANDING — AIM AT A WINDOW OR EXIT');
}
function tickFlight(v,dt){
  const f=v.flight;if(!f)return;
  f.elapsed+=dt;const t=clamp(f.elapsed/f.time,0,1);v.x=f.sx+f.dx*t;v.y=f.sy+f.dy*t;v.z=Math.sin(t*Math.PI)*42;
  if(t>=1){v.flight=null;v.z=0;
    if(f.dest&&dist(v,f.dest)<52){v.saved=true;saved++;score+=500;temperature=Math.max(0,temperature-18);notify(`${v.name} RESCUED  +500  ·  HEAT −18%`);}
    else{v.x=clamp(v.x,OX+T,OX+(COLS-1)*T);v.y=clamp(v.y,OY+T,OY+(ROWS-1)*T);notify(`${v.name} LANDED · PICK THEM UP AGAIN`);}
  }
}
function fireSpray(dt){
  if(!controls.spray)return;sprayClock-=dt;if(sprayClock>0)return;sprayClock=.075;
  const x=player.x+Math.cos(player.angle)*20,y=player.y+Math.sin(player.angle)*20;
  const speed=410;particles.push({x,y,vx:Math.cos(player.angle)*speed,vy:Math.sin(player.angle)*speed,life:.55,color:tanks[tank].color,type:tank,r: tank===1?10:4});
}
function hitFire(p,f){
  const range=tank===1?24:16;if(dist(p,f)>range)return;
  const correct=f.type===tank;let damage=correct?(tank===1?22:18):f.type===0&&tank===2?3:2;
  if(f.type===1&&tank===0){const c=cellOf(f.x,f.y);if(!f.flooded){f.flooded=true;floods.push({x:c.x,y:c.y,life:8});notify('ELECTRIFIED FLOOD! WATER IS DANGEROUS');}damage=0;}
  if(f.type===2&&tank===0&&!f.flared){f.flared=true;f.hp=Math.min(100,f.hp+25);temperature=Math.min(100,temperature+7);f.r=20;notify('FLARE-UP! FOAM IS REQUIRED');}
  if(f.type===3&&tank===0){if(!f.steamed){f.steamed=true;steam.push({x:f.x,y:f.y,r:60,life:2.4});notify('STEAM BLINDNESS · CRYO REQUIRED');}damage=0;}
  if(correct)f.hp-=damage;
  else if(f.type===0&&tank===2)f.hp-=damage;
  if(Math.random()<.42)particles.push({x:f.x+(Math.random()-.5)*18,y:f.y+(Math.random()-.5)*18,vx:(Math.random()-.5)*30,vy:-25-Math.random()*30,life:.5,color:correct?'#d8f6df':'#ffb35a',type:-1});
}
  function update(dt){
  elapsed+=dt;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toast.classList.remove('show');}
  if(gameState!=='playing'||radial)return;
  const joy=controls.joy;let mx=0,my=0;
  if(joy){mx=joy.x-joy.sx;my=joy.y-joy.sy;const mag=Math.hypot(mx,my);if(mag>7){mx/=Math.max(48,mag);my/=Math.max(48,mag);}else mx=my=0;}
  const speed=155*(player.carrying?.78:1),nx=player.x+mx*speed*dt,ny=player.y+my*speed*dt;
  if(!isSolid(nx,player.y))player.x=nx;if(!isSolid(player.x,ny))player.y=ny;
  player.x=clamp(player.x,OX+T/2,OX+(COLS-.5)*T);player.y=clamp(player.y,OY+T/2,OY+(ROWS-.5)*T);
  player.invuln=Math.max(0,player.invuln-dt);
  for(const v of victims){if(v.saved||v.carried)continue;if(v.flight){tickFlight(v,dt);continue;}let nearest=null,nd=Infinity;for(const f of fires){const d=dist(v,f);if(d<nd){nd=d;nearest=f;}}v.panic+=dt;if(nearest&&nd<95&&Math.sin(v.panic*4)>-.35){const a=Math.atan2(v.y-nearest.y,v.x-nearest.x),vx=v.x+Math.cos(a)*25*dt,vy=v.y+Math.sin(a)*25*dt;if(!isSolid(vx,v.y))v.x=vx;if(!isSolid(v.x,vy))v.y=vy;}}
  fireSpray(dt);
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.vx*=.985;p.vy*=.985;if(p.type>=0){for(const f of fires){hitFire(p,f);if(dist(p,f)<25)break;}}}
  particles=particles.filter(p=>p.life>0&&p.x>OX-T&&p.x<OX+(COLS+1)*T&&p.y>OY-T&&p.y<OY+(ROWS+1)*T);
  for(const f of fires){f.age+=dt;f.r=12+Math.sin(elapsed*7+f.age)*2;}fires=fires.filter(f=>f.hp>0);
  spreadClock+=dt;if(spreadClock>2.7&&fires.length<12){spreadClock=0;const source=fires[Math.floor(Math.random()*fires.length)];if(source){const c=cellOf(source.x,source.y),dirs=[[1,0],[-1,0],[0,1],[0,-1]].sort(()=>Math.random()-.5);for(const [dx,dy] of dirs){const x=c.x+dx,y=c.y+dy;if(x>0&&y>0&&x<COLS-1&&y<ROWS-1&&map[y][x]===0&&!fires.some(f=>{const q=cellOf(f.x,f.y);return q.x===x&&q.y===y;})&&Math.random()<.42){fires.push(makeFire(x,y,source.type));break;}}}}
  temperature=Math.min(100,temperature+dt*(.09+fires.length*.035));
  for(const f of fires)if(dist(player,f)<30&&player.invuln===0){player.hp-=18;player.invuln=.7;notify('TOO CLOSE TO THE FLAMES');}
  for(const h of floods){h.life-=dt;const c=cellOf(player.x,player.y);if(c.x===h.x&&c.y===h.y&&player.invuln===0){player.hp-=14;player.invuln=.7;notify('ELECTRIFIED! MOVE!');}}
  floods=floods.filter(h=>h.life>0);for(const s of steam)s.life-=dt;steam=steam.filter(s=>s.life>0);
  if(temperature>=100){gameState='over';gameOverReason='THE BUILDING COLLAPSED';}else if(player.hp<=0){gameState='over';gameOverReason='CREW MEMBER DOWN';}else if(saved===victims.length){gameState='won';score+=Math.floor(player.hp*2);notify('ALL SURVIVORS EVACUATED');}
}
function resetGame(){
  map=Array.from({length:ROWS},()=>Array(COLS).fill(0));for(let x=0;x<COLS;x++){wall(x,0);wall(x,ROWS-1);}for(let y=0;y<ROWS;y++){wall(0,y);wall(COLS-1,y);}[4,10,17].forEach(x=>{map[0][x]=0;map[0][x+1]=0;});map[ROWS-1][11]=0;map[ROWS-1][12]=0;
  for(let x=2;x<22;x++)if(![7,8,15,16].includes(x)){wall(x,5);wall(x,10);}for(let y=2;y<14;y++)if(![3,4,8,9,12].includes(y)){wall(7,y);wall(16,y);}
  [[3,3],[4,3],[5,7],[3,8],[11,3],[12,3],[14,7],[19,3],[20,3],[19,7],[4,12],[11,12],[12,12],[19,12]].forEach(p=>block(p[0],p[1]));
  player.x=OX+12*T;player.y=OY+13*T;player.angle=-Math.PI/2;player.carrying=null;player.hp=100;player.invuln=0;
  for(let i=0;i<victims.length;i++){const p=[[4,4],[12,8],[20,9],[4,12]][i];Object.assign(victims[i],{x:OX+p[0]*T,y:OY+p[1]*T,panic:0,carried:false,saved:false,flight:null,z:0});}
  fires=[makeFire(5,2,0),makeFire(13,4,1),makeFire(19,5,2),makeFire(11,8,3),makeFire(20,12,0)];floods=[];steam=[];particles=[];temperature=29;score=0;saved=0;tank=0;elapsed=0;spreadClock=0;controls.joy=null;controls.aim=null;controls.spray=false;radial=false;gameState='playing';
}
function drawOverlay(){
  if(gameState==='title'){
    ctx.fillStyle='#081012cc';ctx.fillRect(0,0,W,H);rect(180,130,600,386,'#192426');rect(180,130,600,4,'#f0734c');
    text('HOTLINE 9',480,199,18,'#ff7953','center');text('THE BUILDING ISN’T EMPTY.',480,243,24,'#f3e8c8','center');
    text('Find the trapped crew. Match the fire. Get them out.',480,284,12,'#aebcb1','center');
    text('MOVE  left stick',480,334,11,'#e7dfc8','center');text('AIM  drag on right  ·  SPRAY  hold button',480,357,11,'#e7dfc8','center');text('GRAB / THROW  rescue button  ·  TANK  top-right',480,380,11,'#e7dfc8','center');
    rect(347,422,266,48,'#ec704d');text('TAP TO ENTER',480,446,13,'#172022','center');
    text('4 fires · 4 survivors · one way out',480,495,9,'#96a69b','center');
  } else if(gameState==='over'||gameState==='won'){
    ctx.fillStyle='#091012d9';ctx.fillRect(0,0,W,H);rect(255,208,450,230,'#192426');rect(255,208,450,4,gameState==='won'?'#77dda0':'#ee6349');
    text(gameState==='won'?'BUILDING CLEARED':'SIGNAL LOST',480,267,22,gameState==='won'?'#8ae0a6':'#ff7357','center');
    text(gameState==='won'?'Every survivor made it out.':' '+gameOverReason,480,310,11,'#e8e0ca','center');
    text(`SCORE  ${String(score).padStart(5,'0')}     SURVIVORS  ${saved}/${victims.length}`,480,348,12,'#f3e8c8','center');
    rect(359,385,242,35,'#d96a4a');text('TAP TO TRY AGAIN',480,402,11,'#172022','center');
  }
}
let lastFrame=0;
function frame(timestamp){
  const dt=lastFrame?Math.min((timestamp-lastFrame)/1000,.05):0;
  lastFrame=timestamp;
  update(dt);
  drawWorld();
  drawHud();
  drawOverlay();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
