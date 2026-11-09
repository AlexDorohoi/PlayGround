(() => {
'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const W=960,H=540,TAU=Math.PI*2;
const input={hold:false};
const state={screen:'title',last:0,elapsed:0,countdown:3,campaign:0,best:Number(localStorage.getItem('kr-best')||0),distance:0,cameraX:0,cameraY:0,shake:0,chips:0,upgrades:{jump:0,spin:0,stamina:0,blast:0},checkpoint:0,newRecord:false,ghost:null};
const course={length:16400,points:[],gaps:[],chips:[],checkpoints:[],hazards:[]};
const robot={x:80,y:0,vx:0,vy:0,angle:0,spin:0,turns:0,airSpin:0,chain:0,power:1,grounded:true,alive:true,limbs:[true,true,true,true],badHits:0,detached:[],particles:[],trail:[],head:null,launchTimer:0,hitFlash:0,brake:false};
const rand=seed=>{let x=Math.sin(seed*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function makeCourse(){
 course.points=[];
 for(let x=0,i=0;x<=course.length;x+=80,i++){
  let y=418+Math.sin(x*.0014)*34+Math.sin(x*.0031+1.1)*17+Math.sin(x*.0067)*6;
  if(x<430)y=423-(x/430)*103+Math.sin(x*.018)*2;
  y+=(rand(i+8)-.5)*7;
  for(const [cx,amp,width] of [[1450,-52,200],[2430,44,260],[3650,-66,240],[5020,54,300],[6320,-46,260],[7770,72,320],[9250,-65,260],[10800,54,270],[12450,-58,250],[14300,62,340]]){let d=(x-cx)/width;if(Math.abs(d)<1)y+=amp*(1-d*d);}
  course.points.push({x,y:Math.max(270,Math.min(490,y))});
 }
 course.gaps=[[1940,2070],[4480,4615],[7020,7180],[10020,10170],[13200,13350],[15180,15330]];
 course.checkpoints=[{x:3000,label:'CHECKPOINT 1: METEORS',name:'METEOR BELT'},{x:6650,label:'CHECKPOINT 2: MOON',name:'LUNAR RUN'},{x:11000,label:'CHECKPOINT 3: BLACK HOLE',name:'EVENT HORIZON'},{x:14600,label:'CHECKPOINT 4: ASTEROID FIELD',name:'FINAL ORBIT'}];
 course.chips=[];for(let i=0;i<16;i++)course.chips.push({x:950+i*930,type:['jump','spin','stamina','blast'][i%4],taken:false});
 course.hazards=[{x:2580,type:'meteor'},{x:5370,type:'meteor'},{x:8350,type:'mine'},{x:11720,type:'meteor'},{x:13820,type:'mine'}];
}
function groundAt(x){if(x<0)x=0;if(x>course.length)return null;for(const[a,b]of course.gaps)if(x>=a&&x<=b)return null;const n=course.points;let lo=0,hi=n.length-1;while(lo<hi-1){let m=(lo+hi)>>1;if(n[m].x<=x)lo=m;else hi=m;}const a=n[lo],b=n[Math.min(lo+1,n.length-1)],t=(x-a.x)/(b.x-a.x);return a.y+(b.y-a.y)*t;}
function startRun(){state.screen='countdown';state.elapsed=0;state.countdown=3;state.distance=0;state.cameraX=0;state.cameraY=0;state.shake=0;state.chips=0;state.checkpoint=0;state.newRecord=false;course.chips.forEach(c=>c.taken=false);
 Object.assign(robot,{x:85,y:groundAt(85)-34,vx:0,vy:0,angle:0,spin:0,turns:0,airSpin:0,chain:0,power:1,grounded:true,alive:true,limbs:[true,true,true,true],badHits:0,detached:[],particles:[],trail:[],head:null,launchTimer:0,hitFlash:0,brake:false});}
function fireLaunch(){robot.vx=285;robot.vy=-415;robot.grounded=false;robot.airSpin=0;state.screen='playing';pop(95,groundAt(95)-20,18,'#ffb94e');}
function pop(x,y,n,color){for(let i=0;i<n;i++){let a=Math.random()*TAU,s=40+Math.random()*180;{const life=.35+Math.random()*.55;robot.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life,max:life,color,size:2+Math.random()*3});}}}
function actionDown(e){if(e)e.preventDefault();input.hold=true;}function actionUp(){input.hold=false;}
function canvasPoint(e){let r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
canvas.addEventListener('pointerdown',e=>{let p=canvasPoint(e);if(state.screen==='playing'||state.screen==='countdown'){actionDown(e);return;}click(p.x,p.y);});window.addEventListener('pointerup',actionUp);window.addEventListener('pointercancel',actionUp);
window.addEventListener('keydown',e=>{if(['Space','KeyF','ArrowDown'].includes(e.code)){e.preventDefault();input.hold=true;}if(e.code==='Escape'&&state.screen==='playing')state.screen='paused';if(e.code==='Enter'){if(state.screen==='title')state.screen='ready';else if(state.screen==='ready')state.screen='select';else if(state.screen==='select')startRun();else if(state.screen==='finish'||state.screen==='paused')state.screen='title';}});
window.addEventListener('keyup',e=>{if(['Space','KeyF','ArrowDown'].includes(e.code))input.hold=false;});
function click(x,y){if(state.screen==='title'){state.screen='ready';return;}if(state.screen==='ready'){state.screen='select';return;}if(state.screen==='select'){if(y>345){startRun();return;}state.campaign=Math.max(0,Math.min(2,Math.floor((x-210)/190)));return;}if(state.screen==='paused'){if(y>320){state.screen='playing';return;}if(y>260){startRun();return;}state.screen='title';}if(state.screen==='finish'){if(y>350)startRun();else state.screen='title';}}
function update(dt){state.elapsed+=dt;if(state.screen==='countdown'){state.countdown-=dt;if(state.countdown<=0)fireLaunch();}if(state.screen==='playing')step(dt);}
function step(dt){const r=robot;if(!r.alive)return;let brake=input.hold;r.brake=brake;let spinRate=brake?1.18:6.15+state.upgrades.spin*.12;r.spin=spinRate;r.angle+=spinRate*dt;if(!r.grounded)r.airSpin+=spinRate*dt;
 r.vx+=(brake?-35:38)*dt;r.vx=Math.max(185,Math.min(560,r.vx));r.vy+=880*dt;if(brake){r.vy-=90*dt;r.angle-=Math.sin(r.angle)*.5*dt;}r.x+=r.vx*dt;r.y+=r.vy*dt;
 let ground=groundAt(r.x),extent=14+26*Math.abs(Math.cos(r.angle));
 if(ground!==null&&r.vy>0&&r.y+extent>=ground){let feet=Math.cos(r.angle)>.72&&Math.abs(Math.sin(r.angle))<.70;
  if(!r.limbs.some(Boolean)&&r.head===null)launchHead();
  else if(feet){let turns=Math.floor(r.airSpin/TAU),boost=turns===0?0:turns===1?.2:turns===2?.5:.5+(turns-2)*.2;r.chain+=turns;r.power=Math.min(3.2,r.power+boost);let p=r.power;r.vy=-Math.min(720,405*p);r.vx=Math.min(590,r.vx+58+50*p);r.y=ground-39;r.angle=Math.round(r.angle/TAU)*TAU+.04;r.airSpin=0;r.turns=0;r.grounded=false;r.hitFlash=.34;pop(r.x,r.y+28,12+Math.floor(p*4),'#ffe574');}
  else{r.power=1;r.chain=0;r.airSpin=0;r.turns=0;r.vy=-Math.min(235,105+state.upgrades.jump*4);r.vx=Math.max(190,r.vx-40);r.y=ground-extent;r.badHits++;r.hitFlash=.18;state.shake=5;pop(r.x,r.y+12,7,'#ff8b67');damageLimb();}
 }
 if(r.head){r.head.x+=r.head.vx*dt;r.head.y+=r.head.vy*dt;r.head.vy+=660*dt;r.head.angle+=r.head.spin*dt;}
 for(const d of r.detached){d.x+=d.vx*dt;d.y+=d.vy*dt;d.vy+=650*dt;d.angle+=d.spin*dt;d.life-=dt;}r.detached=r.detached.filter(d=>d.life>0);
 for(const p of r.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=170*dt;p.life-=dt;}r.particles=r.particles.filter(p=>p.life>0);
 if(r.vx>360&&Math.random()<dt*14)r.trail.push({x:r.x-22,y:r.y+rand(r.x)*10-5,life:.32});r.trail.forEach(p=>p.life-=dt);r.trail=r.trail.filter(p=>p.life>0);
 for(const c of course.chips){let g=groundAt(c.x);if(!c.taken&&Math.abs(c.x-r.x)<26&&g!==null&&Math.abs(r.y-(g-84))<90){c.taken=true;collectChip(c);}}
 while(state.checkpoint<course.checkpoints.length&&r.x>course.checkpoints[state.checkpoint].x){state.checkpoint++;pop(r.x,groundAt(r.x)||400,22,'#fff180');}
 state.distance=Math.max(0,Math.floor((r.x-85)/10));state.cameraX+=(r.x-330-state.cameraX)*Math.min(1,dt*4);state.cameraY+=(r.y-270-state.cameraY)*Math.min(1,dt*2.7);state.shake=Math.max(0,state.shake-dt*18);r.hitFlash=Math.max(0,r.hitFlash-dt);
 if(r.x>course.length||r.y>760)finishRun();
}
function collectChip(c){c.taken=true;state.chips++;state.upgrades[c.type]++;pop(c.x,groundAt(c.x)-84,13,'#6cf3ff');}
function damageLimb(){let r=robot;if(r.badHits<1+state.upgrades.stamina)return;let i=[0,1,2,3].find(k=>r.limbs[k]);if(i===undefined)return;r.limbs[i]=false;r.badHits=0;let o=[[-10,-9],[10,-9],[-8,21],[8,21]][i];r.detached.push({x:r.x+o[0],y:r.y+o[1],vx:(Math.random()-.5)*140,vy:-90-Math.random()*100,angle:r.angle,spin:(Math.random()-.5)*12,life:8,type:i});pop(r.x+o[0],r.y+o[1],6,'#ffb7a4');}
function launchHead(){let r=robot;r.head={x:r.x,y:r.y-20,vx:Math.max(250,Math.cos(r.angle)*430),vy:Math.sin(r.angle)*430-160,angle:r.angle,spin:7};r.alive=false;pop(r.x,r.y,20,'#fff278');state.shake=11;setTimeout(()=>{if(state.screen==='playing')finishRun();},900);}
function finishRun(){if(state.screen==='finish')return;state.newRecord=state.distance>state.best;if(state.newRecord){state.best=state.distance;localStorage.setItem('kr-best',String(state.best));state.ghost={x:robot.x,angle:robot.angle,distance:state.distance};}state.screen='finish';}

function draw(){
  ctx.clearRect(0,0,W,H); drawSky();
  ctx.save();
  let sx=(Math.random()-.5)*state.shake,sy=(Math.random()-.5)*state.shake;ctx.translate(sx,sy);
  drawTerrain();drawCourseObjects();drawGhost();drawRobot();drawEffects();ctx.restore();
  if(state.screen==='playing'||state.screen==='countdown')drawHud();
  if(state.screen==='title')drawTitle(); if(state.screen==='ready')drawReady(); if(state.screen==='select')drawSelect();
  if(state.screen==='countdown')drawCountdown(); if(state.screen==='paused')drawPause();if(state.screen==='finish')drawFinish();
}
function drawSky(){
  const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#11152e');grad.addColorStop(.52,'#29244b');grad.addColorStop(1,'#77435d');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  // Far nebula ribbons
  ctx.globalAlpha=.12;for(let i=0;i<5;i++){ctx.fillStyle=['#5066c7','#bb5c9d','#4ac3c2'][i%3];ctx.beginPath();ctx.ellipse(180+i*210,140+(i%2)*50,230,45,Math.sin(i)*.1,0,TAU);ctx.fill();}ctx.globalAlpha=1;
  for(let i=0;i<105;i++){const wx=i*137+rand(i+20)*100, x=((wx-state.cameraX*.12)%1150+1150)%1150-80, y=18+rand(i+90)*300;ctx.fillStyle=i%8===0?'#96f7ff':'#d5e8ff';ctx.globalAlpha=.35+rand(i+5)*.65;ctx.fillRect(Math.floor(x),Math.floor(y),i%9===0?2:1,i%9===0?2:1);}ctx.globalAlpha=1;
  const px=(v,s)=>((v-state.cameraX*s)%1500+1500)%1500-220;
  drawPlanet(px(650,.19),145,57,'#ad76a4','#efadba');drawPlanet(px(2240,.22),98,29,'#668eb6','#a9e3ea');
  // distant black-hole vortex
  let bx=px(4400,.16);ctx.save();ctx.translate(bx,194);ctx.rotate(state.elapsed*.03);ctx.strokeStyle='#c48cff';ctx.lineWidth=7;ctx.globalAlpha=.5;ctx.beginPath();ctx.ellipse(0,0,66,21,-.3,0,TAU);ctx.stroke();ctx.strokeStyle='#71e7ee';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,49,14,.4,0,TAU);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle='#080916';ctx.beginPath();ctx.arc(0,0,25,0,TAU);ctx.fill();ctx.restore();
  // silhouettes and orbiting rocks
  for(let i=0;i<9;i++){let x=px(i*410+300,.32),y=252+rand(i+51)*68;ctx.fillStyle='#302c4a';ctx.beginPath();ctx.arc(x,y,12+rand(i)*15,0,TAU);ctx.fill();ctx.fillStyle='#706080';ctx.fillRect(x-9,y-4,9,4);}
  ctx.fillStyle='#17172e';ctx.beginPath();ctx.moveTo(0,362);for(let x=0;x<=W;x+=40){ctx.lineTo(x,320+Math.sin((x+state.cameraX*.28)*.006)*28+Math.sin(x*.019)*8);}ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
}
function drawPlanet(x,y,r,c1,c2){ctx.save();ctx.fillStyle=c1;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();ctx.fillStyle=c2;ctx.globalAlpha=.56;ctx.beginPath();ctx.ellipse(x-r*.28,y-r*.27,r*.45,r*.23,-.5,0,TAU);ctx.fill();ctx.globalAlpha=.5;ctx.strokeStyle='#e2b9d1';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(x,y,r*1.35,r*.27,-.23,0,TAU);ctx.stroke();ctx.restore();}
function sx(x){return x-state.cameraX+330;}
function sy(y){return y-state.cameraY+270;}
function drawTerrain(){
  const left=Math.max(0,state.cameraX-100),right=Math.min(course.length,state.cameraX+W+450), pts=course.points.filter(p=>p.x>=left&&p.x<=right);
  for(let g=0;g<=course.gaps.length;g++){
    const start=g===0?left:course.gaps[g-1][1], end=g===course.gaps.length?right:course.gaps[g][0];
    const part=pts.filter(p=>p.x>=start-80&&p.x<=end+80);if(part.length<2)continue;
    ctx.beginPath();const first=part[0];ctx.moveTo(sx(first.x),sy(first.y));for(let i=1;i<part.length;i++)ctx.lineTo(sx(part[i].x),sy(part[i].y));ctx.lineTo(sx(part[part.length-1].x),H+100);ctx.lineTo(sx(first.x),H+100);ctx.closePath();
    let grad=ctx.createLinearGradient(0,330,0,H);grad.addColorStop(0,'#744557');grad.addColorStop(.22,'#52334c');grad.addColorStop(1,'#202039');ctx.fillStyle=grad;ctx.fill();
    ctx.beginPath();ctx.moveTo(sx(first.x),sy(first.y));for(let i=1;i<part.length;i++)ctx.lineTo(sx(part[i].x),sy(part[i].y));ctx.strokeStyle='#ff676d';ctx.lineWidth=3;ctx.stroke();
    // Scattered pixel strata
    for(let i=0;i<part.length;i+=2){const p=part[i];let x=sx(p.x);if(x>-20&&x<W+10){ctx.fillStyle=i%4?'#a95b65':'#f18a72';ctx.globalAlpha=.35;ctx.fillRect(x,sy(p.y)+8+(i%3)*7,18,3);}}ctx.globalAlpha=1;
  }
  // Sloped danger edges and gap glints
  for(const [a,b] of course.gaps){let x=sx(a),x2=sx(b);if(x>-40&&x<W+40){ctx.fillStyle='#f7a164';ctx.fillRect(x-4,sy(groundAt(a)||420),5,12);ctx.fillRect(x2-2,sy(groundAt(b)||420),5,12);ctx.fillStyle='#ffcb70';for(let i=0;i<4;i++)ctx.fillRect(x+12+i*13,sy(groundAt(a)||420)+38+i%2*4,5,2);}}
  drawStartRamp();
}
function drawStartRamp(){const x=sx(0);if(x<-140||x>500)return;let y=sy(groundAt(0));ctx.fillStyle='#d2a37d';ctx.fillRect(x-25,y-38,17,40);ctx.fillStyle='#ffcf79';ctx.fillRect(x-28,y-41,25,6);ctx.strokeStyle='#8c7485';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(x+38,y-4);ctx.lineTo(x+92,y-75);ctx.lineTo(x+78,y-130);ctx.stroke();ctx.strokeStyle='#ffbd60';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+38,y-4);ctx.lineTo(x+92,y-75);ctx.stroke();ctx.fillStyle='#d6e5ea';ctx.fillRect(x+70,y-139,17,18);ctx.fillStyle='#ff8161';ctx.fillRect(x+74,y-121,8,7);}
function drawCourseObjects(){
  for(const cp of course.checkpoints){let x=sx(cp.x),g=groundAt(cp.x);if(x<-170||x>W+170||g===null)continue;const crossed=state.checkpoint>course.checkpoints.indexOf(cp);ctx.fillStyle='#53435d';ctx.fillRect(x,sy(g)-100,4,100);ctx.fillStyle=crossed?'#7affd1':'#ffe273';ctx.fillRect(x+4,sy(g)-97,145,27);ctx.fillStyle='#212341';ctx.font='8px "Press Start 2P",monospace';ctx.fillText(cp.label,x+10,sy(g)-80);ctx.fillStyle='#ff746d';ctx.fillRect(x+4,sy(g)-70,124,3);}
  for(const c of course.chips){if(c.taken)continue;let g=groundAt(c.x);if(g===null)g=425;let x=sx(c.x),y=sy(g)-84+Math.sin(state.elapsed*3+c.x)*4;if(x<-30||x>W+30)continue;const colors={jump:'#ffe16e',spin:'#c08aff',stamina:'#6bffc7',blast:'#ff786c'};ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle=colors[c.type];ctx.fillRect(-9,-9,18,18);ctx.fillStyle='#fff9d6';ctx.fillRect(-4,-4,8,8);ctx.restore();ctx.fillStyle='#17172b';ctx.font='7px "Press Start 2P",monospace';ctx.fillText(c.type[0].toUpperCase(),x-3,y+3);}
  for(const h of course.hazards){let x=sx(h.x),g=groundAt(h.x)||400;if(x<-60||x>W+60)continue;let y=sy(g)-50+Math.sin(state.elapsed*2+h.x)*5;ctx.fillStyle=h.type==='meteor'?'#ff8059':'#8c83e7';ctx.beginPath();ctx.arc(x,y,15,0,TAU);ctx.fill();ctx.fillStyle='#ffd28c';ctx.fillRect(x-5,y-7,8,5);ctx.fillStyle='#523c68';ctx.fillRect(x+6,y+5,7,5);ctx.strokeStyle='#ffbf73';ctx.beginPath();ctx.moveTo(x-15,y+11);ctx.lineTo(x-32,y+26);ctx.stroke();}
  for(let i=0;i<5;i++){const wx=1500+i*2600,x=sx(wx);if(x<-150||x>W+150)continue;ctx.fillStyle='#4b4969';ctx.beginPath();ctx.arc(x,sy(390)-70,43+rand(i)*14,0,TAU);ctx.fill();ctx.fillStyle='#8880a0';ctx.fillRect(x-22,sy(390)-81,17,7);ctx.fillRect(x+8,sy(390)-62,20,6);}
}
function drawGhost(){if(!state.ghost||state.screen==='title')return;let g=groundAt(robot.x-250);if(g===null)return;ctx.save();ctx.globalAlpha=.38;drawBot(sx(robot.x-250),sy(g-39),robot.angle,'#8df4ff',[true,true,true,true],false);ctx.restore();}
function drawRobot(){let r=robot;for(const d of r.detached){ctx.save();ctx.translate(sx(d.x),sy(d.y));ctx.rotate(d.angle);ctx.strokeStyle='#e65f66';ctx.lineWidth=7;ctx.lineCap='square';if(d.type<2){ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(d.type===0?-14:14,12);ctx.stroke();}else{ctx.beginPath();ctx.moveTo(0,-2);ctx.lineTo(d.type===2?-8:8,17);ctx.stroke();}ctx.restore();}if(r.head){ctx.save();ctx.translate(sx(r.head.x),sy(r.head.y));ctx.rotate(r.head.angle);drawHead('#ffdd9c');ctx.restore();}if(r.alive)drawBot(sx(r.x),sy(r.y),r.angle,'#f3c87e',r.limbs,true);}
function drawBot(x,y,angle,color,limbs,face){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.lineCap='square';ctx.lineJoin='miter';ctx.fillStyle='#556783';ctx.fillRect(-18,-12,7,19);ctx.fillStyle='#ff836f';ctx.fillRect(-19,-8,5,4);ctx.fillStyle='#9daab0';ctx.fillRect(-10,-19,20,34);ctx.fillStyle=color;ctx.fillRect(-8,-16,16,26);ctx.fillStyle='#f9e3a9';ctx.fillRect(-5,-12,10,5);ctx.fillStyle='#435369';ctx.fillRect(-5,0,10,6);
 if(limbs[0]){ctx.strokeStyle='#d5dad3';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-9,-12);ctx.lineTo(-16,-4);ctx.lineTo(-18,3);ctx.stroke();ctx.fillStyle='#ff9f70';ctx.fillRect(-21,1,7,6);}if(limbs[1]){ctx.strokeStyle='#d5dad3';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(9,-12);ctx.lineTo(16,-4);ctx.lineTo(18,3);ctx.stroke();ctx.fillStyle='#ff9f70';ctx.fillRect(14,1,7,6);}if(limbs[2]){ctx.strokeStyle='#cbd3d0';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-6,13);ctx.lineTo(-9,22);ctx.lineTo(-8,29);ctx.stroke();ctx.fillStyle='#f1d081';ctx.fillRect(-14,27,12,5);}if(limbs[3]){ctx.strokeStyle='#cbd3d0';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(6,13);ctx.lineTo(9,22);ctx.lineTo(8,29);ctx.stroke();ctx.fillStyle='#f1d081';ctx.fillRect(2,27,12,5);}
 ctx.fillStyle='#a2abb2';ctx.fillRect(-8,-30,16,12);ctx.fillStyle=color;ctx.fillRect(-6,-28,12,8);ctx.fillStyle='#ff735f';ctx.fillRect(-4,-25,3,3);ctx.fillRect(2,-25,3,3);ctx.fillStyle='#d7eee1';ctx.fillRect(-2,-22,5,2);if(face){ctx.fillStyle='#6beeff';ctx.fillRect(7,-9,4,4);if(robot.hitFlash>0){ctx.strokeStyle='#fff38a';ctx.lineWidth=2;ctx.strokeRect(-22,-34,44,68);}}if(robot.vx>360){ctx.fillStyle='#ff9b46';ctx.beginPath();ctx.moveTo(-16,3);ctx.lineTo(-30+rand(state.elapsed*70)*-16,9);ctx.lineTo(-16,12);ctx.fill();ctx.fillStyle='#fff2a1';ctx.fillRect(-27,6,10,3);}ctx.restore();}
function drawHead(color){ctx.fillStyle='#a2abb2';ctx.fillRect(-8,-9,16,17);ctx.fillStyle=color;ctx.fillRect(-6,-7,12,13);ctx.fillStyle='#ff705f';ctx.fillRect(-4,-3,3,3);ctx.fillRect(2,-3,3,3);}
function drawEffects(){for(const p of robot.trail){ctx.globalAlpha=Math.max(0,p.life/.32);ctx.fillStyle='#ff9b55';ctx.fillRect(sx(p.x),sy(p.y),12*p.life/.32,3);}ctx.globalAlpha=1;for(const p of robot.particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(sx(p.x),sy(p.y),p.size,p.size);}ctx.globalAlpha=1;}
function panel(x,y,w,h,alpha=.88){ctx.fillStyle=`rgba(18,22,47,${alpha})`;ctx.fillRect(x,y,w,h);ctx.strokeStyle='#6befff';ctx.lineWidth=2;ctx.strokeRect(x+.5,y+.5,w-1,h-1);ctx.fillStyle='#f66c73';ctx.fillRect(x,y,w,4);}
function txt(s,x,y,size=10,color='#f7f0d7',align='left'){ctx.font=`${size}px "Press Start 2P",monospace`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(s,x,y);ctx.textAlign='left';}
function button(label,x,y,w,h,sub=''){ctx.fillStyle='#34395b';ctx.fillRect(x,y,w,h);ctx.fillStyle='#7887a1';ctx.fillRect(x,y,w,4);ctx.fillStyle='#ffce69';ctx.fillRect(x+5,y+h-5,w-10,2);ctx.strokeStyle='#97f6ff';ctx.strokeRect(x+.5,y+.5,w-1,h-1);txt(label,x+w/2,y+h/2-3,10,'#fff2c4','center');if(sub)txt(sub,x+w/2,y+h-9,6,'#a5deeb','center');}
function drawHud(){panel(18,16,255,67,.77);txt('DISTANCE',32,36,9,'#94ecf3');txt(`${String(state.distance).padStart(4,'0')} m`,32,60,17,'#fff2c4');panel(785,16,157,67,.77);txt('BOUNCE',800,34,8,'#94ecf3');txt(`x${robot.power.toFixed(1)}`,800,57,15,robot.power>1?'#ffe16e':'#f7f0d7');txt(`SPINS ${Math.floor(robot.airSpin/TAU)}`,925,57,7,'#c7c0e8','right');ctx.fillStyle='#252b4a';ctx.fillRect(18,94,152,8);ctx.fillStyle='#ffdc69';ctx.fillRect(18,94,152*Math.min(1,robot.power/3.2),8);txt('BOOST CHARGE',18,113,6,'#b3c5dc');panel(370,16,220,38,.68);txt(state.checkpoint?course.checkpoints[state.checkpoint-1].name:'COSMIC RUN • SECTOR 01',480,36,7,'#ffe7a0','center');panel(18,474,216,47,.73);txt(`CHIPS ${state.chips} / 16`,31,493,8,'#76f1f5');txt(`J${state.upgrades.jump} S${state.upgrades.spin} T${state.upgrades.stamina} E${state.upgrades.blast}`,31,510,7,'#c7c5e1');panel(784,474,158,47,.73);txt(input.hold?'BRAKE / STEADY':'HOLD  SPACE / F',863,497,7,input.hold?'#ffe16e':'#cae8ec','center');if(robot.hitFlash>0){ctx.globalAlpha=robot.hitFlash*2;ctx.fillStyle='#fff295';ctx.fillRect(0,0,W,5);ctx.globalAlpha=1;}if(state.checkpoint>0&&state.elapsed<state.checkpoint*1.6+1.6){let cp=course.checkpoints[state.checkpoint-1];panel(300,93,360,35,.86);txt(cp.label,480,112,8,'#ffe279','center');}}
function drawTitle(){ctx.fillStyle='rgba(9,11,26,.36)';ctx.fillRect(0,0,W,H);panel(170,62,620,393,.91);txt('KAMIKAZE',480,129,31,'#ffe16e','center');txt('ROBOTS',480,177,34,'#f6f2df','center');txt('COSMIC RUN',480,219,10,'#76edfa','center');ctx.fillStyle='#ff6c70';ctx.fillRect(320,238,320,3);txt('A RETRO ROCKET-RIDING RAGDOLL RALLY',480,266,8,'#c9c4df','center');drawBot(260,363,Math.sin(state.elapsed)*.14,'#f3c87e',[true,true,true,true],true);ctx.fillStyle='#ff9c54';ctx.fillRect(224,370,23,5);ctx.fillStyle='#fff0a0';ctx.fillRect(210,371,13,3);button('START RUN',365,324,230,54,'ENTER / TAP');txt('BEST RUN',480,406,7,'#98a8c9','center');txt(`${state.best} m`,480,430,10,'#fff1c8','center');txt('SPACE / F / TOUCH  •  HOLD TO STEADY',480,484,7,'#9fbed0','center');}
function drawReady(){ctx.fillStyle='rgba(8,10,24,.52)';ctx.fillRect(0,0,W,H);panel(190,83,580,366,.94);txt('ROBOT READY',480,126,17,'#ffe16e','center');drawBot(310,267,Math.sin(state.elapsed)*.12,'#f3c87e',[true,true,true,true],true);txt('UNIT 07  /  “SPARK”',525,200,9,'#82f5ff');txt('AUTO-RUNNER • TURBO CORE',525,226,7,'#c9c1dd');txt('ROLL TO BUILD POWER',525,276,8,'#fff0c1');txt('FEET-FIRST LANDINGS STACK BOUNCE',525,298,6,'#bfc4db');txt('BAD IMPACTS SHED LIMBS',525,318,6,'#ff9b85');button('CONTINUE',365,365,230,50,'TAP / ENTER');}
function drawSelect(){ctx.fillStyle='rgba(8,10,24,.52)';ctx.fillRect(0,0,W,H);panel(128,54,704,430,.94);txt('TOURNAMENT SELECT',480,93,15,'#ffe16e','center');txt('CHOOSE YOUR RUN',480,122,7,'#99eef4','center');const cards=[['01','METEOR','MILE','6,000 m','REWARD  2 CHIPS'],['02','LUNAR','CIRCUIT','10,000 m','REWARD  3 CHIPS'],['03','EVENT','HORIZON','14,000 m','REWARD  4 CHIPS']];cards.forEach((c,i)=>{let x=160+i*215;ctx.fillStyle=state.campaign===i?'#394263':'#252a49';ctx.fillRect(x,157,194,163);ctx.strokeStyle=state.campaign===i?'#ffe16e':'#64728e';ctx.strokeRect(x+.5,157.5,193,162);txt(c[0],x+16,179,8,'#77efff');txt(c[1],x+97,215,11,'#f6edce','center');txt(c[2],x+97,236,10,'#f6edce','center');txt(c[3],x+97,270,7,'#8fe7eb','center');txt(c[4],x+97,299,6,'#f1bd76','center');});txt('YOUR CHIPS',480,357,8,'#92edf2','center');txt('JUMP     SPIN     STAMINA     EXPLOSION',480,382,7,'#ded8eb','center');txt('SLOW PROGRESSION • TOUGHER RIVALS AHEAD',480,407,6,'#a9bad0','center');button('LAUNCH TOURNAMENT',330,431,300,42,'TAP / ENTER');}
function drawCountdown(){ctx.fillStyle='rgba(13,15,34,.18)';ctx.fillRect(0,0,W,H);panel(378,137,204,182,.87);let n=Math.max(1,Math.ceil(state.countdown));txt('DIG ARM',480,168,8,'#8ff5ff','center');txt(String(n),480,231,53,'#ffe16e','center');txt(n===1?'LAUNCH!':'READY',480,282,9,'#fff2c4','center');}
function drawPause(){ctx.fillStyle='rgba(5,7,18,.62)';ctx.fillRect(0,0,W,H);panel(320,139,320,270,.95);txt('RUN PAUSED',480,183,16,'#ffe16e','center');button('RESUME',365,223,230,43,'ESC / TAP');button('RESTART',365,278,230,43);button('MAIN MENU',365,333,230,43);}
function drawFinish(){ctx.fillStyle='rgba(5,7,18,.6)';ctx.fillRect(0,0,W,H);panel(280,103,400,338,.96);txt(robot.head?'HEADS UP!':'RUN COMPLETE',480,148,15,'#ffe16e','center');txt('DISTANCE',480,202,8,'#8ceff2','center');txt(`${state.distance} m`,480,239,24,'#fff2d0','center');txt(state.newRecord?'NEW BEST RUN!':`BEST ${state.best} m`,480,277,8,state.newRecord?'#ffe16e':'#bcc5db','center');txt(`CHIPS COLLECTED: ${state.chips}`,480,316,7,'#84f1de','center');button('RUN AGAIN',355,351,250,47,'TAP / ENTER');txt('ENTER TO RETURN TO MENU',480,420,6,'#9fa9c6','center');}
function frame(now){let dt=Math.min(.033,(now-state.last)/1000||0);state.last=now;update(dt);draw();requestAnimationFrame(frame);}
makeCourse();robot.y=groundAt(robot.x)-39;requestAnimationFrame(frame);
})();
