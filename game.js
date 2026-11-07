import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#a9d8db');
scene.fog = new THREE.Fog('#a9d8db', 30, 105);
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .1, 180);
camera.position.set(0, 6.4, 12.8);
const hemi = new THREE.HemisphereLight('#e5fbff', '#534b47', 2.15); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0c9', 3.3); sun.position.set(-7, 13, 9); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -15; sun.shadow.camera.right = 15; sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15; scene.add(sun);
const fill = new THREE.DirectionalLight('#9cd6ff', 1.25); fill.position.set(7, 5, -12); scene.add(fill);

const mat = (color, roughness=.72, metalness=0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const M = {
  asphalt: mat('#293846'), track: mat('#5d6260'), rail: mat('#b8c2bd',.28,.72), sleeper: mat('#574e45'),
  yellow: mat('#ffc443',.42), dark: mat('#1b2b38'), white: mat('#f3eee1'), red: mat('#e95343'), blue: mat('#327ac0'), green: mat('#65a858'), orange: mat('#f28a39'), purple: mat('#8a62ae'),
  concrete: mat('#c4b8a0'), steel: mat('#7e9298',.36,.55), glass: mat('#5b9da7',.3,.28), window: mat('#f3bf62',.44), brickRed: mat('#d65b47'), brickBlue: mat('#3280b6'), brickGreen: mat('#76b957'),
  skin: mat('#f0b879'), hair: mat('#6b432d'), gold: mat('#ffca42',.32,.42), coinSide: mat('#c9821f',.36,.38)
};
function box(parent, x,y,z, w,h,d, material, cast=true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
  mesh.position.set(x,y,z); mesh.castShadow=cast; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function cylinder(parent,x,y,z,r,h,material,segments=12,rot=0){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),material);mesh.position.set(x,y,z);mesh.rotation.z=rot;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function stud(parent,x,y,z,r=.075,material=M.yellow){return cylinder(parent,x,y,z,r,.07,material,10);}

// Track bed, rails and the rhythmic brick-built sleepers.
const trackBed=box(scene,0,-.34,-37,6.65,.42,110,M.asphalt,false);
for(const x of [-1.03,1.03]){box(scene,x,-.045,-37,.16,.17,110,M.rail,false);box(scene,x,-.145,-37,.39,.09,110,M.sleeper,false);}
for(const x of [-3.17,3.17]) box(scene,x,-.13,-37,.16,.08,110,M.yellow,false);
const sleepers=[];
for(let i=0;i<36;i++){const g=new THREE.Group();g.position.set(0,0,-i*3.1);box(g,0,-.105,0,6.25,.12,.43,M.sleeper,false);for(let x=-3;x<=3;x+=.48)stud(g,x,-.01,0,.065, i%3===0?M.yellow:M.concrete);scene.add(g);sleepers.push(g);}
// Platform edges and repeating brick-built city blocks.
const buildings=[];
for(const side of [-1,1]){
  const x=side*5.25;
  const platform=box(scene,x,-.22,-37,3.25,.35,110,mat('#bbb29e'),false);
  box(scene,side*3.72,-.025,-37,.16,.08,110,M.yellow,false);
  for(let i=0;i<12;i++){
    const group=new THREE.Group(); const z=-i*10-8; group.position.set(side*(7.2+Math.random()*1.1),0,z);
    const h=5+Math.random()*9,w=3.1+Math.random()*2.2,d=4+Math.random()*2;
    const colors=side===-1?[M.brickRed,M.concrete,M.brickBlue,M.brickGreen]:[M.concrete,M.brickBlue,M.brickRed,M.brickGreen];
    const base=colors[i%colors.length];box(group,0,h/2-.2,0,w,h,d,base);
    for(let y=.8;y<h-1;y+=1.35)for(let xx=-w/2+.55;xx<w/2-.3;xx+=.92){
      const win=box(group,xx,y,d/2+.018,.46,.64,.04,(i%4===0&&y>2)?M.window:M.glass,false);
      if((i+Math.round(y)+Math.round(xx*2))%4===0)box(group,xx,y-.39,d/2+.045,.53,.08,.08,M.white,false);
    }
    for(let xx=-w/2+.45;xx<w/2;xx+=.68)stud(group,xx,h+.01,0,.09,i%2?M.red:M.yellow);
    if(i%3===0){box(group,0,h+.7,0,w*.56,.95,.5,M.yellow);box(group,0,h+.73,.27,w*.39,.51,.06,M.dark,false);}
    scene.add(group);buildings.push({group,side});
  }
}
function makeTrain(z,lane,color=M.blue){
 const g=new THREE.Group();g.position.set(lane*2.08,0,z);const c=mat(color,.35,.15);
 box(g,0,1.72,0,1.86,3.3,10,c);box(g,0,3.4,.15,1.72,.18,9.5,M.white);
 box(g,0,1.95,5.04,1.48,1.2,.06,M.dark,false);box(g,-.38,1.98,5.09,.48,.75,.03,M.glass,false);box(g,.38,1.98,5.09,.48,.75,.03,M.glass,false);
 for(let z0=-4;z0<4.2;z0+=1.5){box(g,-.88,2.1,z0,.035,.9,.03,M.steel,false);box(g,.88,2.1,z0,.035,.9,.03,M.steel,false);box(g,0,3.18,z0,.9,.04,.03,M.steel,false);}
 for(const zz of [-3.3,3.3])for(const x of [-.65,.65]){cylinder(g,x,.45,zz,.28,.18,M.dark,12);cylinder(g,x,.45,zz,.12,.2,M.steel,12);}
 for(const x of [-.6,.6])box(g,x,.22,5.08,.24,.14,.08,M.yellow);
 scene.add(g);return {group:g,lane,type:'train',hitZ:4.6};
}
const obstacles=[]; const coins=[]; const effects=[];
const runnerRoot=new THREE.Group();scene.add(runnerRoot);runnerRoot.position.set(0,0,1.25);
let avatarParts={};
const roster=[
 {name:'JAKE',desc:'THE STREET SMART',shirt:'#f2eee0',pants:'#397fcb',hair:'#efc944',cap:'#efc944',accent:'#3c89d6',skin:'#e8aa73'},
 {name:'TAN BOT',desc:'BUILT DIFFERENT',shirt:'#ca9b64',pants:'#b98c57',hair:'#858b89',cap:'#a7b0aa',accent:'#5ed6cf',skin:'#d5b17d'},
 {name:'ZACK',desc:'THE NEON RIDER',shirt:'#252f38',pants:'#313b42',hair:'#62bd49',cap:'#62bd49',accent:'#75d84e',skin:'#cf9369'},
 {name:'TRICKY',desc:'THE QUICK THINKER',shirt:'#df573f',pants:'#e5e5dd',hair:'#e34e43',cap:'#e34e43',accent:'#ffe17a',skin:'#edbb8d'}
].map(o=>({...o,shirtMat:mat(o.shirt),pantsMat:mat(o.pants),hairMat:mat(o.hair),capMat:mat(o.cap),accentMat:mat(o.accent),skinMat:mat(o.skin)}));
let selected=0;
function buildRunner(){
 while(runnerRoot.children.length)runnerRoot.remove(runnerRoot.children[0]);
 const c=roster[selected]; const body=new THREE.Group();runnerRoot.add(body);
 const torso=box(body,0,1.42,0,.78,.85,.43,c.shirtMat);for(let x of [-.2,.2])stud(body,x,1.87,.05,.07,c.accentMat);
 const neck=cylinder(body,0,1.92,0,.13,.16,c.skinMat,12);
 const head=new THREE.Group();head.position.set(0,2.28,0);body.add(head);box(head,0,0,0,.57,.53,.51,c.skinMat);box(head,0,.23,-.005,.61,.12,.55,c.hairMat);
 if(selected===0||selected===2){box(head,0,.31,0,.64,.1,.56,c.capMat);box(head,0,.24,.28,.52,.08,.18,c.capMat);}
 else if(selected===3){for(let x of [-.24,0,.24])box(head,x,.28,0,.18,.22,.35,c.hairMat);}
 else {for(let x of [-.2,.2]){box(head,x,.2,-.25,.13,.29,.12,c.hairMat);}}
 box(head,-.13,-.04,.262,.045,.045,.018,M.dark,false);box(head,.13,-.04,.262,.045,.045,.018,M.dark,false);box(head,0,-.16,.27,.12,.035,.018,mat('#a94f44'),false);
 if(selected===1){box(head,0,.03,.29,.48,.09,.04,c.accentMat,false);box(head,0,-.12,.29,.18,.1,.04,M.dark,false);}
 const arms=[],legs=[];
 for(const side of [-1,1]){
   const arm=new THREE.Group();arm.position.set(side*.48,1.72,0);body.add(arm);box(arm,side*.02,-.26,0,.25,.49,.28,c.shirtMat);cylinder(arm,side*.02,-.54,0,.13,.18,c.skinMat,10);box(arm,side*.02,-.57,.015,.24,.15,.25,c.skinMat);arms.push(arm);
   const leg=new THREE.Group();leg.position.set(side*.2,1.02,0);body.add(leg);box(leg,0,-.36,0,.31,.64,.34,c.pantsMat);box(leg,0,-.71,.1,.37,.18,.57,side<0?M.white:c.accentMat);stud(leg,0,-.605,.16,.07,M.yellow);legs.push(leg);
 }
 avatarParts={body,head,arms,legs,torso};
}
buildRunner();

// Reusable brick obstacles and collectible golden studs.
function spawnObstacle(lane,z,type){
 const g=new THREE.Group();g.position.set(lane*2.08,0,z);
 if(type==='train'){
   const train=makeTrain(z,lane,Math.random()<.5?'#357da6':'#d55b49');
   obstacles.push(train);return train;
 }else if(type==='crate'){
   box(g,0,.65,0,1.45,1.3,1.08,M.orange);box(g,0,.65,.56,1.1,.12,.06,M.yellow,false);box(g,0,.65,-.56,1.1,.12,.06,M.yellow,false);box(g,0,.65,0,.12,1.05,1.15,M.yellow,false);
   for(let x=-.48;x<=.49;x+=.32)for(let z0=-.32;z0<=.33;z0+=.32)stud(g,x,1.31,z0,.075,M.orange);
 }else if(type==='barrier'){
   box(g,0,.73,0,1.9,.35,.48,M.red);box(g,0,.73,.25,1.7,.16,.04,M.white,false);
   for(const x of [-.7,.7]){box(g,x,.35,0,.15,.7,.15,M.dark);box(g,x,.18,.04,.42,.12,.35,M.yellow);}
   for(let x=-.72;x<=.73;x+=.36)stud(g,x,.95,0,.07,M.red);
 }else{
   // A low overhead sign: slide under it.
   box(g,0,2.05,0,2.25,.34,.4,M.red);box(g,0,2.05,.22,1.95,.13,.04,M.yellow,false);
   for(const x of [-.94,.94])box(g,x,1.12,0,.17,1.86,.22,M.dark);
   for(let x=-.92;x<=.93;x+=.38)stud(g,x,2.24,0,.07,M.red);
 }
 scene.add(g);const o={group:g,lane,type,hitZ:type==='barrier'?1.05:type==='crate'?1.02:1.04};obstacles.push(o);return o;
}
function spawnCoin(lane,z,y=1.35){
 const g=new THREE.Group();g.position.set(lane*2.08,y,z);
 cylinder(g,0,0,0,.31,.105,M.coinSide,16);
 cylinder(g,0,0,.055,.25,.12,M.gold,16);
 cylinder(g,0,0,.12,.105,.025,M.yellow,12);
 for(let a=0;a<8;a++){const angle=a*Math.PI/4;stud(g,Math.cos(angle)*.17,Math.sin(angle)*.17,.13,.035,M.yellow);}
 scene.add(g);coins.push({group:g,lane,taken:false});return g;
}
function populate(){
 for(const o of obstacles)scene.remove(o.group);obstacles.length=0;
 for(const c of coins)scene.remove(c.group);coins.length=0;
 let z=-22;
 for(let i=0;i<13;i++){
   z-=8+Math.random()*4;const lane=Math.floor(Math.random()*3)-1;
   const type=Math.random()<.14?'train':['crate','barrier','sign'][Math.floor(Math.random()*3)];spawnObstacle(lane,z,type);
   if(Math.random()<.54){const coinLane=Math.floor(Math.random()*3)-1;for(let j=1;j<=4;j++)spawnCoin(coinLane,z-j*1.25,1.2+Math.sin(j*.7)*.25);}
   else {const other=(lane+ (Math.random()<.5?1:-1));for(let j=0;j<3;j++)spawnCoin(Math.max(-1,Math.min(1,other)),z-4-j*1.2);}
 }
 for(let row=0;row<8;row++){let lane=Math.floor(Math.random()*3)-1;for(let j=0;j<5;j++)spawnCoin(lane,-15-row*18-j*1.2,1.35);}
}

let state='menu', distance=0, collected=0, speed=12, lane=0, laneTarget=0, jumpV=0, jumping=false, sliding=false, slideTimer=0, stumbleTimer=0, spawnDistance=0, lastTime=0, soundOn=false, audio;
let best=Number(localStorage.getItem('brickline-best')||0);$('best-distance').textContent=`${best} m`;
function setScreen(id,visible){$(id).classList.toggle('visible',visible);$(id).classList.toggle('hidden-screen',!visible);}
function setCharacter(){const c=roster[selected];$('character-name').textContent=c.name;$('character-desc').textContent=c.desc;$('character-index').textContent=`0${selected+1} / 04`;$('avatar').style.setProperty('--shirt',c.shirt);$('avatar').style.setProperty('--hair',c.hair);buildRunner();}
function beep(freq=520,duration=.08){if(!soundOn)return;try{audio??=new AudioContext();const o=audio.createOscillator(),gain=audio.createGain();o.frequency.value=freq;o.type='sine';gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(gain);gain.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}}
function toast(text){const t=$('toast');t.textContent=text;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),1050);}
function startRun(){
 state='playing';distance=0;collected=0;speed=12;lane=0;laneTarget=0;jumping=false;jumpV=0;sliding=false;slideTimer=0;stumbleTimer=0;spawnDistance=0;runnerRoot.position.set(0,0,1.25);runnerRoot.scale.set(1,1,1);runnerRoot.rotation.set(0,0,0);avatarParts.body.visible=true;avatarParts.legs.forEach(leg=>leg.visible=true);
 populate();$('distance').innerHTML='0<span>m</span>';$('stud-count').textContent='0';setScreen('menu',false);setScreen('game-over',false);setScreen('pause-screen',false);$('bottom-hint').classList.add('off');$('hud').style.opacity='1';beep(640,.11);
}
function endRun(){state='over';const meters=Math.floor(distance);$('final-distance').textContent=`${meters} m`;$('final-studs').textContent=`${collected} studs`;
 if(meters>best){best=meters;localStorage.setItem('brickline-best',best);toast('NEW PERSONAL BEST');} $('best-distance').textContent=`${best} m`;setTimeout(()=>setScreen('game-over',true),450);beep(140,.35);}
function pauseRun(){if(state==='playing'){state='paused';setScreen('pause-screen',true);}else if(state==='paused'){state='playing';setScreen('pause-screen',false);lastTime=performance.now();}}
function action(name){if(state!=='playing')return;
 if(name==='left')laneTarget=Math.max(-1,laneTarget-1);
 if(name==='right')laneTarget=Math.min(1,laneTarget+1);
 if(name==='jump'&&!jumping&&!sliding){jumping=true;jumpV=7.8;beep(420,.07);}
 if(name==='slide'&&!jumping){sliding=true;slideTimer=.72;beep(230,.07);}
}
window.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup','arrowdown',' ','a','d','w','s'].includes(key))e.preventDefault();if(key==='arrowleft'||key==='a')action('left');if(key==='arrowright'||key==='d')action('right');if(key==='arrowup'||key==='w'||key===' ')action('jump');if(key==='arrowdown'||key==='s')action('slide');if(key==='escape'||key==='p')pauseRun();if(state==='menu'&&key==='enter')startRun();if(state==='over'&&key==='enter')startRun();});
$('prev-character').onclick=()=>{selected=(selected+3)%4;setCharacter();};$('next-character').onclick=()=>{selected=(selected+1)%4;setCharacter();};$('start-btn').onclick=startRun;$('again-btn').onclick=startRun;$('home-btn').onclick=()=>{setScreen('game-over',false);setScreen('menu',true);$('bottom-hint').classList.remove('off');};$('pause-btn').onclick=pauseRun;$('resume-btn').onclick=pauseRun;$('quit-btn').onclick=()=>{state='menu';setScreen('pause-screen',false);setScreen('menu',true);$('bottom-hint').classList.remove('off');};$('sound-btn').onclick=()=>{soundOn=!soundOn;$('sound-btn').textContent=soundOn?'♫':'♩';if(soundOn){audio??=new AudioContext();beep();}};
document.querySelectorAll('.touch-controls button').forEach(button=>{button.addEventListener('pointerdown',e=>{e.preventDefault();action(button.dataset.action);});});

// Falling limbs and loose bricks after a collision.
function scatter(){
 if(stumbleTimer>0)return;stumbleTimer=.65;const limb=avatarParts.legs[Math.random()<.5?0:1];limb.visible=false;
 for(let i=0;i<14;i++){const piece=new THREE.Mesh(new THREE.BoxGeometry(.12+Math.random()*.16,.1+Math.random()*.13,.12),[M.red,M.blue,M.yellow,M.green,M.white][i%5]);piece.position.set(runnerRoot.position.x+(Math.random()-.5)*.8,.7+Math.random()*1.7,runnerRoot.position.z+(Math.random()-.5)*.4);piece.castShadow=true;scene.add(piece);effects.push({mesh:piece,v:new THREE.Vector3((Math.random()-.5)*5,2+Math.random()*5,Math.random()*3),life:1.2});}
 runnerRoot.rotation.z=.35;toast('BRICK BITS!');
}
function updateGame(dt){
 if(state!=='playing')return;
 distance+=speed*dt*.8;speed=Math.min(23,12+distance/180);const advance=speed*dt;
 $('distance').innerHTML=`${Math.floor(distance)}<span>m</span>`;
 lane+=(laneTarget-lane)*Math.min(1,dt*13);runnerRoot.position.x=lane*2.08;
 if(jumping){jumpV-=18*dt;runnerRoot.position.y+=jumpV*dt;if(runnerRoot.position.y<=0){runnerRoot.position.y=0;jumping=false;jumpV=0;}}
 if(sliding){slideTimer-=dt;if(slideTimer<=0){sliding=false;}}
 runnerRoot.scale.y=sliding?.58:1;if(sliding)runnerRoot.position.y=-.04;else if(!jumping)runnerRoot.position.y=0;
 const runT=performance.now()*.012;
 if(!jumping){avatarParts.legs[0].rotation.x=Math.sin(runT)*.63;avatarParts.legs[1].rotation.x=-Math.sin(runT)*.63;avatarParts.arms[0].rotation.x=-Math.sin(runT)*.58;avatarParts.arms[1].rotation.x=Math.sin(runT)*.58;avatarParts.body.rotation.z=(laneTarget-lane)*-.08;avatarParts.head.rotation.y=Math.sin(runT*.5)*.05;}
 if(stumbleTimer>0){stumbleTimer-=dt;if(stumbleTimer<=0){endRun();}}
 for(const s of sleepers){s.position.z+=advance;if(s.position.z>12)s.position.z-=111.6;}
 for(const b of buildings){b.group.position.z+=advance*.72;if(b.group.position.z>20)b.group.position.z-=120;}
 // Spawn ahead in an endless stream; obstacles are kept in a safe, readable rhythm.
 spawnDistance+=advance;if(spawnDistance>10.5){spawnDistance=0;const z=-82;const l=Math.floor(Math.random()*3)-1;const type=Math.random()<.14?'train':['crate','barrier','sign'][Math.floor(Math.random()*3)];spawnObstacle(l,z,type);if(Math.random()<.76){const free=Math.random()<.65?l:(Math.random()<.5?Math.max(-1,l-1):Math.min(1,l+1));for(let j=1;j<=5;j++)spawnCoin(free,z-j*1.18,1.28+Math.sin(j*.7)*.22);}}
 for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i];o.group.position.z+=advance;if(o.type==='train'){}if(o.group.position.z>11){scene.remove(o.group);obstacles.splice(i,1);continue;}
   if(Math.abs(o.group.position.z-runnerRoot.position.z)<o.hitZ&&Math.abs(o.lane-lane)<.48&&state==='playing'){
     const safe=(o.type==='sign'&&sliding)||(o.type!=='sign'&&o.type!=='train'&&jumping&&runnerRoot.position.y>.83);
     if(!safe){scatter();break;}
   }
 }
 for(let i=coins.length-1;i>=0;i--){const c=coins[i];c.group.position.z+=advance;c.group.rotation.y+=dt*2.4;c.group.position.y+=Math.sin(performance.now()*.004+c.group.position.z)*dt*.13;if(c.group.position.z>11){scene.remove(c.group);coins.splice(i,1);continue;}
   if(!c.taken&&Math.abs(c.group.position.z-runnerRoot.position.z)<.72&&Math.abs(c.lane-lane)<.48&&runnerRoot.position.y<1.6){c.taken=true;collected++;$('stud-count').textContent=collected;scene.remove(c.group);beep(760+collected%5*60,.045);coins.splice(i,1);}
 }
 for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;e.v.y-=12*dt;e.mesh.position.addScaledVector(e.v,dt);e.mesh.rotation.x+=dt*5;e.mesh.rotation.z+=dt*4;if(e.life<=0){scene.remove(e.mesh);effects.splice(i,1);}}
 camera.position.x+=(lane*.28-camera.position.x)*dt*2;camera.lookAt(lane*.16,1.05,-5.7);
}
function idleUpdate(dt){
 runnerRoot.position.y=Math.sin(performance.now()*.0016)*.035;
 avatarParts.legs[0].rotation.x=Math.sin(performance.now()*.002)*.14;avatarParts.legs[1].rotation.x=-avatarParts.legs[0].rotation.x;
 for(const s of coins)s.group.rotation.y+=dt;
}
function resize(){renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<700?48:43;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.04,(now-lastTime)/1000||0);lastTime=now;updateGame(dt);if(state!=='playing')idleUpdate(dt);renderer.render(scene,camera);}
requestAnimationFrame(frame);
