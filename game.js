(() => {
'use strict';
const canvas = document.getElementById('screen'), ctx = canvas.getContext('2d');
const W=960,H=540, WALL=19, toolNames=['WATER','FOAM','CRYO','CO2'];
const toolColors=['#ff9b36','#73806b','#9eeaff','#bd7aff'];
const $=id=>document.getElementById(id);
let state, last=performance.now(), toastTimer=0, paused=false, pointerId={move:null,aim:null};
const controls={move:{x:0,y:0,active:false},aim:{x:0,y:0,active:false}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y), rand=(a,b)=>a+Math.random()*(b-a);
const rooms=[
 {x:38,y:117,w:274,h:174}, {x:342,y:117,w:274,h:174}, {x:646,y:117,w:274,h:174},
 {x:38,y:324,w:274,h:174}, {x:342,y:324,w:274,h:174}, {x:646,y:324,w:274,h:174}
];
const civiliansSeed=[
 {x:120,y:205,type:'worker',name:'MIRA'}, {x:474,y:178,type:'elder',name:'MR. VALE'},
 {x:765,y:236,type:'kid',name:'JUN'}, {x:527,y:423,type:'medic',name:'NURSE ELI'}
];
const furnitureSeed=[
 {x:83,y:151,w:61,h:25,type:'desk'},{x:218,y:237,w:48,h:24,type:'cabinet'},
 {x:396,y:145,w:74,h:27,type:'table'},{x:538,y:236,w:38,h:27,type:'cabinet'},
 {x:702,y:154,w:52,h:26,type:'sofa'},{x:825,y:227,w:42,h:26,type:'desk'},
 {x:73,y:366,w:50,h:29,type:'sofa'},{x:220,y:447,w:52,h:24,type:'desk'},
 {x:387,y:363,w:62,h:25,type:'desk'},{x:545,y:448,w:43,h:27,type:'cabinet'},
 {x:692,y:366,w:53,h:25,type:'table'},{x:825,y:445,w:58,h:26,type:'cabinet'}
];
function newFloor(floor=1,keep={score:0,rescuedTotal:0,upgrades:0}){
 const civilians=civiliansSeed.map((c,i)=>({...c,x:c.x+(floor%2?0:12),y:c.y+(floor%2?0:8),rescued:false,carried:false,heat:0,id:i}));
 const fires=[]; const starts=[[264,174,0],[425,249,1],[851,174,2],[80,449,3],[578,362,0],[748,441,1]];
 starts.slice(0,Math.min(3+floor,6)).forEach((p,i)=>fires.push({x:p[0],y:p[1],type:p[2],r:rand(13,20),health:1,spread:rand(4,8),seed:i,age:rand(0,5),alive:true}));
 const enemies=[]; for(let i=0;i<Math.min(2+floor,7);i++){const room=rooms[(i*2+floor)%rooms.length];const kinds=['circle','blocker','sweeper','figure8','leash'];enemies.push({x:room.x+room.w*.5,y:room.y+room.h*.5,homeX:room.x+room.w*.5,homeY:room.y+room.h*.5,type:(i+floor-1)%4,kind:kinds[(i+floor-1)%kinds.length],phase:Math.random()*6.28,r:10,hp:1,alive:true,stun:0});}
 state={floor,score:keep.score,rescuedTotal:keep.rescuedTotal,upgrades:keep.upgrades,player:{x:72,y:290,hp:100,heat:0,angle:0,invuln:0,speed:138,carrying:null},civilians,fires,enemies,foam:[],particles:[],powerups:floor===1?[{x:300,y:400,kind:'cool'}]:[],tool:0,cooldown:0,spray:0,sprayAge:0,roomObjective:0,gameOver:false,floorDone:false,combo:0,comboTimer:0,damageFlash:0};
 $('floor').textContent=String(floor).padStart(2,'0');$('total').textContent=civilians.length;$('endCard').hidden=true;paused=false;
 say(floor===1?'CREW DEPLOYED · KEEP YOUR COOL':'NEW FLOOR · CREW BACK IN ACTION'); updateUI();
}
function say(text){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2450)}
function roomAt(x,y){return rooms.find(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h)}
function circleRect(cx,cy,r,b){const x=clamp(cx,b.x,b.x+b.w),y=clamp(cy,b.y,b.y+b.h);return (cx-x)**2+(cy-y)**2<r*r}
function collides(x,y,r){if(x-r<25||x+r>935||y-r<102||y+r>515)return true;for(const b of furnitureSeed)if(circleRect(x,y,r,b))return true;
 // Partition walls have broad, deliberately open door gaps.
 const walls=[{x:322,y:117,w:12,h:174,gap:68,vertical:true},{x:626,y:117,w:12,h:174,gap:68,vertical:true},{x:322,y:324,w:12,h:174,gap:68,vertical:true},{x:626,y:324,w:12,h:174,gap:68,vertical:true},{x:38,y:301,w:274,h:14,gap:74},{x:342,y:301,w:274,h:14,gap:74},{x:646,y:301,w:274,h:14,gap:74}];
 for(const w of walls){if(w.vertical){if(x+r>w.x&&x-r<w.x+w.w&&!(y>w.y+86&&y<w.y+86+w.gap))return true;}else if(y+r>w.y&&y-r<w.y+w.h&&!(x>w.x+(w.w-w.gap)/2&&x<w.x+(w.w+w.gap)/2))return true;}return false}
function moveBody(o,dx,dy,r){if(!collides(o.x+dx,o.y,r))o.x+=dx;if(!collides(o.x,o.y+dy,r))o.y+=dy}
function nearestCivilian(){let best=null,d=Infinity;for(const c of state.civilians){if(c.rescued||c.carried)continue;const n=dist(state.player,c);if(n<d){best=c;d=n}}return d<37?best:null}
function nearExit(){const p=state.player;return p.x<67&&p.y>246&&p.y<318||p.x>893&&p.y>246&&p.y<318||[[424,117],[728,117],[120,498],[473,498],[820,498]].some(([x,y])=>Math.abs(p.x-x)<25&&Math.abs(p.y-y)<25)}
function action(){if(state.gameOver||state.floorDone)return;if(state.player.carrying){if(nearExit()){const c=state.player.carrying;c.rescued=true;c.carried=false;state.player.carrying=null;state.score+=250+Math.max(0,Math.floor((100-state.player.heat)*.6));state.rescuedTotal++;state.combo++;state.comboTimer=8;if(state.combo>1)state.score+=state.combo*40;say(`${c.name} RESCUED · +${250+Math.max(0,Math.floor((100-state.player.heat)*.6))}  ${state.combo>1?'· '+state.combo+'× COMBO':''}`);checkFloor();updateUI();}else say('EVAC AT THE MAIN DOOR OR A WINDOW');return;}
 const c=nearestCivilian();if(c){c.carried=true;state.player.carrying=c;state.player.speed=108;say(`${c.name} SECURED · GET TO AN EXIT`);updateUI();}else say('GET CLOSER TO A SURVIVOR');}
function checkFloor(){const rescued=state.civilians.filter(c=>c.rescued).length,required=Math.ceil(state.civilians.length*.6);if(rescued>=required){state.floorDone=true;showEnd(true);}else if(rescued+state.civilians.filter(c=>!c.rescued).length<required){state.gameOver=true;showEnd(false);}}
function showEnd(won){$('endCard').hidden=false;$('endEyebrow').textContent=won?'FLOOR COMPLETE':'CREW DOWN';$('endTitle').textContent=won?'ALL CLEAR!':'CREW DOWN';$('endText').textContent=won?'The team is safe. Ready for the next floor?':'The fire got too close. The crew needs a reset.';$('endIcon').textContent=won?'✦':'✚';$('endRescued').textContent=`${state.civilians.filter(c=>c.rescued).length} / ${state.civilians.length}`;$('endGrade').textContent=grade();$('continueButton').textContent=won?'NEXT FLOOR  →':'TRY AGAIN  ↻';}
function grade(){const n=state.score+(state.combo*120)+(state.player.hp*4)-(state.player.heat*1.2);return n>2000?'S':n>1350?'A':n>750?'B':'C'}
function switchTool(){state.tool=(state.tool+1)%4;$('toolName').textContent=toolNames[state.tool];$('toolButton').style.setProperty('--tool-color',toolColors[state.tool]);say(`${toolNames[state.tool]} CANISTER SELECTED`);updateUI()}
function sprayStart(){if(state.cooldown>0||state.gameOver||state.floorDone)return;state.spray=1;state.sprayAge=0;}
function sprayRelease(){if(state.spray){state.spray=0;state.cooldown=12;state.sprayAge=0;updateUI();}}
function makeBurst(x,y,color,n=12){for(let i=0;i<n;i++){const a=rand(0,Math.PI*2),v=rand(28,110);state.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.25,.65),max:.65,color,size:rand(2,5)});}}
function extinguish(dt){if(!state.spray)return;state.sprayAge+=dt;const p=state.player,range=p.carrying?108:142,angle=p.angle;let hits=0;
 for(const e of state.enemies){if(!e.alive)continue;const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy),da=Math.atan2(dy,dx);if(d<range&&Math.abs(Math.atan2(Math.sin(da-angle),Math.cos(da-angle)))<.43){if(e.type===state.tool){e.hp-=dt*1.35;hits++;if(e.hp<=0){e.alive=false;makeBurst(e.x,e.y,toolColors[e.type],22);state.score+=100;state.combo++;state.comboTimer=8;say(`${toolNames[state.tool]} HIT · +100`);}}else{e.stun=Math.max(e.stun,.14);hits++;}}}
 for(const f of state.fires){if(!f.alive)continue;const dx=f.x-p.x,dy=f.y-p.y,d=Math.hypot(dx,dy),da=Math.atan2(dy,dx);if(d<range&&Math.abs(Math.atan2(Math.sin(da-angle),Math.cos(da-angle)))<.5){if(f.type===state.tool){f.health-=dt*.34;if(f.health<=0){f.alive=false;makeBurst(f.x,f.y,'#ffe9a7',19);state.score+=30;}}else{f.health=Math.max(.15,f.health-dt*.025);}}}
}
function update(dt){if(paused||state.gameOver||state.floorDone)return;const p=state.player;dt=Math.min(dt,.035);if(state.cooldown>0)state.cooldown=Math.max(0,state.cooldown-dt);if(state.comboTimer>0){state.comboTimer-=dt;if(state.comboTimer<=0)state.combo=0;}if(p.invuln>0)p.invuln-=dt;if(state.damageFlash>0)state.damageFlash-=dt;
 const mx=controls.move.x,my=controls.move.y,mag=Math.hypot(mx,my);if(mag>.08)moveBody(p,mx/mag*p.speed*dt,my/mag*p.speed*dt,9);
 if(controls.aim.active&&Math.hypot(controls.aim.x,controls.aim.y)>.13){p.angle=Math.atan2(controls.aim.y,controls.aim.x);if(!state.spray&&state.cooldown<=0)sprayStart();}else if(state.spray)sprayRelease();
 extinguish(dt);
 for(const f of state.fires){if(!f.alive)continue;f.age+=dt;f.spread-=dt;if(f.spread<=0&&state.fires.length<9&&Math.random()<.23){const candidates=rooms.filter(r=>Math.hypot((r.x+r.w/2)-f.x,(r.y+r.h/2)-f.y)<350&&!state.fires.some(q=>q.alive&&Math.hypot(q.x-(r.x+r.w/2),q.y-(r.y+r.h/2))<70));if(candidates.length){const r=candidates[Math.floor(Math.random()*candidates.length)];const x=clamp(r.x+rand(35,r.w-35),r.x+25,r.x+r.w-25),y=clamp(r.y+rand(30,r.h-30),r.y+25,r.y+r.h-25);state.fires.push({x,y,type:Math.floor(Math.random()*4),r:rand(12,18),health:1,spread:rand(5,9),seed:Math.random()*9,age:0,alive:true});}f.spread=rand(5,9);}}
 let heat=0;for(const f of state.fires){if(!f.alive)continue;const d=dist(p,f);if(d<100)heat+=Math.max(0,(100-d)/100)*38;for(const c of state.civilians){if(!c.rescued&&dist(c,f)<c.heat+f.r+44)c.heat=Math.min(100,c.heat+dt*5);}}
 p.heat=clamp(p.heat+(heat>0?heat*dt*.3:-dt*10),0,100);if(heat>0&&p.invuln<=0&&Math.random()<dt*(heat/100)*1.8)damage(4);
 for(const e of state.enemies){if(!e.alive)continue;e.phase+=dt*(e.kind==='sweeper'?1.5:1);let tx=e.homeX,ty=e.homeY;if(e.kind==='circle'){tx=e.homeX+Math.cos(e.phase)*35;ty=e.homeY+Math.sin(e.phase)*35;}else if(e.kind==='blocker'){tx=e.homeX+Math.sin(e.phase*.6)*42;}else if(e.kind==='sweeper'){tx=e.homeX+Math.sin(e.phase)*70;ty=e.homeY+Math.cos(e.phase*.55)*12;}else if(e.kind==='figure8'){tx=e.homeX+Math.sin(e.phase)*42;ty=e.homeY+Math.sin(e.phase*2)*22;}else{const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy);if(d<150){tx=p.x;ty=p.y;}else{tx=e.homeX+Math.sin(e.phase*.5)*24;ty=e.homeY+Math.cos(e.phase*.5)*24;}}if(e.stun>0)e.stun-=dt;else{let dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy);if(d>2)moveBody(e,dx/d*32*dt,dy/d*32*dt,9);}if(dist(e,p)<18&&p.invuln<=0)damage(12);}
 if(state.player.carrying){state.player.carrying.x=p.x-13;state.player.carrying.y=p.y+9;}
 for(const c of state.civilians){if(c.rescued||c.carried)continue;if(c.heat>75){c.x+=Math.sin(performance.now()/400+c.id)*dt*7;}for(const f of state.fires){if(f.alive&&dist(c,f)<f.r+13&&p.invuln<=0&&dist(p,c)<35)damage(7);}}
 for(const pu of state.powerups){if(!pu.used&&dist(p,pu)<20){pu.used=true;if(pu.kind==='cool'){p.heat=Math.max(0,p.heat-42);p.hp=Math.min(100,p.hp+15);say('COOLANT PICKUP · HEAT -42 · CREW +15');}}}
 state.particles=state.particles.filter(q=>q.life>0);for(const q of state.particles){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.96;q.vy*=.96;}
 updateUI();
}
function damage(amount){if(state.player.invuln>0)return;state.player.hp=Math.max(0,state.player.hp-amount);state.player.invuln=.8;state.damageFlash=.25;if(state.player.hp<=0){state.gameOver=true;showEnd(false);}else if(state.player.hp<30)say('CREW CRITICAL · KEEP MOVING');}
function updateUI(){if(!state)return;$('score').textContent=String(state.score).padStart(4,'0');$('rescued').textContent=state.civilians.filter(c=>c.rescued).length;$('grade').textContent=grade();$('heatFill').style.width=`${state.player.heat}%`;$('healthFill').style.width=`${state.player.hp}%`;$('healthLabel').textContent=`${Math.ceil(state.player.hp)}%`;$('heatLabel').textContent=state.player.heat>70?'DANGER':state.player.heat>35?'ELEVATED':'NOMINAL';$('heatFill').style.background=state.player.heat>70?'#fa4e44':'';$('toolName').textContent=toolNames[state.tool];$('toolStatus').textContent=state.cooldown>0?`${Math.ceil(state.cooldown)}s COOLDOWN`:state.spray?'SPRAYING':'READY';$('cooldownLabel').textContent=state.cooldown>0?'RELEASED · RECHARGING':state.spray?'HOLD TO EXTINGUISH':'HOLD TO SPRAY';$('toolStatus').style.color=state.cooldown>0?'#ffc06b':state.spray?'#ffe09a':'#9cf2bf';$('objectiveText').textContent=state.player.carrying?'EVACUATE AT THE MAIN DOOR · ←':`FIND THE SURVIVORS · ${state.civilians.filter(c=>!c.rescued).length} SIGNAL${state.civilians.filter(c=>!c.rescued).length===1?'':'S'}`;$('carryTag').classList.toggle('visible',!!state.player.carrying);$('actionLabel').textContent=state.player.carrying?'DROP OFF':'RESCUE';$('actionButton').style.opacity=state.player.carrying||nearestCivilian()?1:.83;}
function rr(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function draw(){const sx=canvas.clientWidth/W,sy=canvas.clientHeight/H;if(canvas.width!==Math.round(canvas.clientWidth*devicePixelRatio)||canvas.height!==Math.round(canvas.clientHeight*devicePixelRatio)){canvas.width=Math.round(canvas.clientWidth*devicePixelRatio);canvas.height=Math.round(canvas.clientHeight*devicePixelRatio);}ctx.setTransform(devicePixelRatio*sx,0,0,devicePixelRatio*sy,0,0);ctx.imageSmoothingEnabled=false;
 ctx.fillStyle='#19282a';ctx.fillRect(0,0,W,H);
 // subtle floor tile grid
 for(let y=104;y<520;y+=28)for(let x=28;x<940;x+=28){ctx.fillStyle=((x/28+y/28)%2<1)?'#253432':'#273633';ctx.fillRect(x,y,27,27);ctx.fillStyle='#34423a';ctx.fillRect(x+4,y+4,1,1);}
 // building perimeter and interior rooms
 ctx.fillStyle='#3b4134';ctx.fillRect(24,103,912,414);ctx.fillStyle='#263432';ctx.fillRect(30,109,900,402);
 for(let y=117;y<505;y+=28)for(let x=38;x<922;x+=28){ctx.fillStyle=((x/28+y/28)%2<1)?'#293936':'#2c3c37';ctx.fillRect(x,y,27,27);ctx.fillStyle='#34453e';ctx.fillRect(x+5,y+5,1,1);}
 // partition walls with door gaps
 const partitions=[{x:322,y:117,w:12,h:174,v:1},{x:626,y:117,w:12,h:174,v:1},{x:322,y:324,w:12,h:174,v:1},{x:626,y:324,w:12,h:174,v:1},{x:38,y:301,w:274,h:14},{x:342,y:301,w:274,h:14},{x:646,y:301,w:274,h:14}];
 for(const a of partitions){if(a.v){ctx.fillStyle='#4b4d3b';ctx.fillRect(a.x,a.y,12,86);ctx.fillRect(a.x,a.y+154,12,20);ctx.fillStyle='#737054';ctx.fillRect(a.x,a.y,12,3);ctx.fillRect(a.x,a.y+154,12,3);}else{const gx=a.x+(a.w-74)/2;ctx.fillStyle='#4b4d3b';ctx.fillRect(a.x,a.y,a.w/2-37,a.h);ctx.fillRect(gx+74,a.y,a.w-(gx-a.x)-74,a.h);ctx.fillStyle='#737054';ctx.fillRect(a.x,a.y,a.w/2-37,2);ctx.fillRect(gx+74,a.y,a.w-(gx-a.x)-74,2);}}
 // room numbers and exits
 rooms.forEach((r,i)=>{ctx.fillStyle='#748078';ctx.globalAlpha=.42;ctx.font='9px monospace';ctx.fillText(`ZONE 0${i+1}`,r.x+9,r.y+14);ctx.globalAlpha=1;});
 rr(26,252,11,62,4,'#d96742','#ffc27b');ctx.fillStyle='#fff0c8';ctx.fillRect(31,276,2,12);ctx.save();ctx.translate(53,286);ctx.rotate(-Math.PI/2);ctx.fillStyle='#ffcf73';ctx.font='8px monospace';ctx.textAlign='center';ctx.fillText('MAIN EXIT',0,0);ctx.restore();
 // windows as bright exit slots
 for(const [x,y] of [[424,109],[728,109],[120,505],[473,505],[820,505]]){ctx.fillStyle='#b8d7c5';ctx.fillRect(x,y,34,4);ctx.fillStyle='#77a5a0';ctx.fillRect(x+3,y+1,28,2);ctx.fillStyle='#d3b873';ctx.fillRect(x-2,y-2,38,2);}
 // furniture, fixed obstacles
 for(const b of furnitureSeed){const fill=b.type==='sofa'?'#436253':b.type==='cabinet'?'#74664c':b.type==='table'?'#806c4e':'#58675b';rr(b.x,b.y+3,b.w,b.h,3,'#151f1d');rr(b.x,b.y,b.w,b.h,3,fill,'#a3986b');ctx.fillStyle='rgba(255,235,174,.22)';ctx.fillRect(b.x+4,b.y+3,b.w-8,2);if(b.type==='desk'){ctx.fillStyle='#d0b879';ctx.fillRect(b.x+b.w*.63,b.y+5,8,7);}}
 // exit beacon and power-up
 let pulse=.5+.5*Math.sin(performance.now()/220);ctx.globalAlpha=.25+.2*pulse;ctx.fillStyle='#ffae56';ctx.beginPath();ctx.arc(39,282,23,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
 for(const q of state.powerups){if(q.used)continue;ctx.fillStyle='#8de4be';ctx.globalAlpha=.18+.15*pulse;ctx.beginPath();ctx.arc(q.x,q.y,18,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#bcf3c9';ctx.fillRect(q.x-5,q.y-6,10,12);ctx.fillRect(q.x-8,q.y-3,16,6);}
 for(const f of state.fires)if(f.alive)drawFire(f);
 for(const c of state.civilians)if(!c.rescued&&!c.carried)drawCivilian(c);
 for(const e of state.enemies)if(e.alive)drawEnemy(e);
 if(state.spray)drawSpray();
 for(const q of state.particles){ctx.globalAlpha=clamp(q.life/q.max,0,1);ctx.fillStyle=q.color;ctx.fillRect(q.x,q.y,q.size,q.size);}ctx.globalAlpha=1;
 drawPlayer();
 // small air-haze wash over hottest locations
 for(const f of state.fires)if(f.alive){const d=dist(state.player,f);if(d<150){const a=ctx.createRadialGradient(f.x,f.y,8,f.x,f.y,f.r+25);a.addColorStop(0,'rgba(250,102,39,.11)');a.addColorStop(1,'rgba(250,102,39,0)');ctx.fillStyle=a;ctx.fillRect(f.x-f.r-25,f.y-f.r-25,(f.r+25)*2,(f.r+25)*2);}}
}
function drawFire(f){const time=performance.now()/150+f.seed,scale=1+.1*Math.sin(time);const palettes=[['#ff5b2d','#ffae34','#ffe277'],['#332e30','#554340','#ff7a42'],['#64c8f1','#a6f3ff','#e1ffff'],['#8d4bda','#42c887','#b8ff79']][f.type];
 const flick=ctx.createRadialGradient(f.x,f.y,2,f.x,f.y,f.r*1.65);flick.addColorStop(0,palettes[1]+'55');flick.addColorStop(1,palettes[0]+'00');ctx.fillStyle=flick;ctx.beginPath();ctx.arc(f.x,f.y,f.r*1.65,0,Math.PI*2);ctx.fill();
 for(let i=0;i<4;i++){const a=time+i*Math.PI/2,rx=f.x+Math.cos(a)*f.r*.45,ry=f.y+Math.sin(a)*f.r*.3;ctx.fillStyle=palettes[i%3];ctx.beginPath();ctx.moveTo(rx-f.r*.45,ry+f.r*.4);ctx.lineTo(rx-f.r*.22,ry-f.r*(.75+.15*Math.sin(time+i)));ctx.lineTo(rx+f.r*.12,ry-f.r*.15);ctx.lineTo(rx+f.r*.42,ry+f.r*.4);ctx.closePath();ctx.fill();}
 ctx.fillStyle=palettes[2];ctx.fillRect(f.x-3,f.y-4,6,6);if(f.type===1){ctx.fillStyle='#201f22';ctx.fillRect(f.x-7,f.y+7,5,3);ctx.fillRect(f.x+4,f.y+3,4,4);}if(f.type===3){ctx.globalAlpha=.4;ctx.fillStyle=palettes[1];ctx.beginPath();ctx.arc(f.x+Math.sin(time)*10,f.y-12,5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}}
function drawCivilian(c){const x=Math.round(c.x),y=Math.round(c.y),shirt=c.type==='worker'?'#4c91a0':c.type==='elder'?'#b98d61':c.type==='kid'?'#d67c70':'#79ad85';ctx.fillStyle='#161e1c';ctx.fillRect(x-6,y+5,12,7);ctx.fillStyle=shirt;ctx.fillRect(x-5,y-4,10,11);ctx.fillStyle='#efc49a';ctx.fillRect(x-4,y-10,8,7);ctx.fillStyle=c.type==='elder'?'#dad2bb':'#514c40';ctx.fillRect(x-5,y-11,10,3);ctx.fillStyle='#e2d5b6';ctx.fillRect(x-6,y+12,4,3);ctx.fillRect(x+2,y+12,4,3);if(c.heat>45){ctx.fillStyle='#ffd164';ctx.fillRect(x-9,y-20,18,2);ctx.fillStyle='#ff814b';ctx.fillRect(x-9,y-20,18*c.heat/100,2);} }
function drawEnemy(e){const x=Math.round(e.x),y=Math.round(e.y),clrs=[['#ff772d','#ffe27a'],['#292529','#ff7445'],['#79dcf5','#d9ffff'],['#a65fe6','#a8f48c']][e.type];const glow=ctx.createRadialGradient(x,y,2,x,y,18);glow.addColorStop(0,clrs[0]+'88');glow.addColorStop(1,clrs[0]+'00');ctx.fillStyle=glow;ctx.fillRect(x-18,y-18,36,36);ctx.fillStyle='#18221f';ctx.fillRect(x-8,y+5,16,6);ctx.fillStyle=clrs[0];ctx.fillRect(x-7,y-5,14,12);ctx.fillStyle=clrs[1];ctx.fillRect(x-5,y-10,10,7);ctx.fillStyle='#fff4c2';ctx.fillRect(x-4,y-3,2,2);ctx.fillRect(x+2,y-3,2,2);if(e.type===1){ctx.fillStyle='#161518';ctx.fillRect(x-10,y+3,20,6);ctx.fillStyle='#ff6840';ctx.fillRect(x-2,y+4,4,2);}if(e.type===3){ctx.globalAlpha=.5;ctx.fillStyle=clrs[1];ctx.fillRect(x-12,y-11,4,4);ctx.fillRect(x+8,y-7,4,4);ctx.globalAlpha=1;}}
function drawPlayer(){const p=state.player,x=Math.round(p.x),y=Math.round(p.y);if(p.invuln>0&&Math.floor(performance.now()/80)%2)return;ctx.fillStyle='#101a18';ctx.fillRect(x-8,y+8,16,6);ctx.fillStyle='#deb94d';ctx.fillRect(x-6,y-2,12,13);ctx.fillStyle='#f0cb61';ctx.fillRect(x-7,y+1,14,4);ctx.fillStyle='#d94c3e';ctx.fillRect(x-6,y-10,12,7);ctx.fillStyle='#f36b4c';ctx.fillRect(x-5,y-12,10,3);ctx.fillStyle='#ffecb6';ctx.fillRect(x-1,y-6,3,2);ctx.fillStyle='#d7dbb2';ctx.fillRect(x+7,y-1,6,3);ctx.fillStyle='#8c8f76';ctx.fillRect(x-2,y+10,4,4);if(state.damageFlash>0){ctx.globalAlpha=.55;ctx.fillStyle='#ff293b';ctx.fillRect(x-10,y-13,20,29);ctx.globalAlpha=1;}if(state.player.carrying){ctx.fillStyle='#e7c194';ctx.fillRect(x-12,y-17,8,8);ctx.fillStyle='#4d9b91';ctx.fillRect(x-12,y-9,9,13);}}
function drawSpray(){const p=state.player,range=p.carrying?108:142;ctx.save();ctx.translate(p.x,p.y-2);ctx.rotate(p.angle);const col=toolColors[state.tool];ctx.globalAlpha=.12;ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(range,-range*.36);ctx.lineTo(range,range*.36);ctx.lineTo(0,5);ctx.closePath();ctx.fill();ctx.globalAlpha=.7;for(let i=0;i<13;i++){const t=(i+1)/14,x=t*range,y=rand(-1,1)*t*range*.32;ctx.fillStyle=i%3===0?'#fff5cd':col;ctx.fillRect(x,y,3,3);}ctx.restore();}
function setStick(which,event){const zone=which==='move'?'moveZone':'aimZone',base=$(zone).querySelector('.stick-base'),rect=base.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,scale=rect.width/2;let dx=(event.clientX-cx)/scale,dy=(event.clientY-cy)/scale,m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m;}controls[which].x=dx;controls[which].y=dy;controls[which].active=true;const k=base.querySelector('.stick-knob');k.style.left=`${50+dx*31}%`;k.style.top=`${50+dy*31}%`;}
function resetStick(which){controls[which].x=0;controls[which].y=0;controls[which].active=false;const k=$(which==='move'?'moveZone':'aimZone').querySelector('.stick-knob');k.style.left='50%';k.style.top='50%';if(which==='aim')sprayRelease();}
function immersive(){if(screen.orientation?.lock)screen.orientation.lock('landscape').catch(()=>{});if(!document.fullscreenElement&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{});}
function bindStick(which){const el=$(which==='move'?'moveZone':'aimZone');el.addEventListener('pointerdown',e=>{e.preventDefault();immersive();pointerId[which]=e.pointerId;el.setPointerCapture(e.pointerId);setStick(which,e);if(which==='aim')sprayStart();});el.addEventListener('pointermove',e=>{if(pointerId[which]===e.pointerId)setStick(which,e);});const end=e=>{if(pointerId[which]!==e.pointerId)return;pointerId[which]=null;resetStick(which);};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);}
bindStick('move');bindStick('aim');$('toolButton').addEventListener('pointerdown',e=>e.stopPropagation());$('toolButton').addEventListener('click',()=>{immersive();switchTool()});$('actionButton').addEventListener('pointerdown',e=>e.stopPropagation());$('actionButton').addEventListener('click',()=>{immersive();action()});$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'▶':'Ⅱ';if(paused)say('PAUSED · TAP PLAY TO CONTINUE');});$('continueButton').addEventListener('click',()=>{if(state.floorDone){const keep={score:state.score,rescuedTotal:state.rescuedTotal,upgrades:state.upgrades};newFloor(state.floor+1,keep);}else newFloor(state.floor,{score:state.score,rescuedTotal:state.rescuedTotal,upgrades:state.upgrades});});window.addEventListener('contextmenu',e=>e.preventDefault());window.addEventListener('resize',()=>{canvas.style.width='100%';canvas.style.height='100%'});
function frame(now){const dt=(now-last)/1000;last=now;update(dt);draw();requestAnimationFrame(frame);}
newFloor();requestAnimationFrame(frame);
})();
