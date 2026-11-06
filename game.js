(() => {
  'use strict';
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const wheelCanvas = document.getElementById('wheelCanvas');
  const wctx = wheelCanvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const W = 1000, H = 650;
  const colors = { mint:'#8fe0ae', amber:'#efac65', red:'#ef6c60', blue:'#80b9c9', water:'#70b9de', co2:'#b9cbd0', wet:'#d8a85f', powder:'#e4c475' };
  const extinguishers = [
    {id:'water', name:'Water', cls:'CLASS A', color:colors.water, icon:'◉', label:'WATER / CLASS A'},
    {id:'co2', name:'CO₂', cls:'CLASS C', color:colors.co2, icon:'❄', label:'CO₂ / CLASS C'},
    {id:'wet', name:'Wet Chem', cls:'CLASS K', color:colors.wet, icon:'✳', label:'WET CHEM / CLASS K'},
    {id:'powder', name:'Dry Powder', cls:'CLASS B', color:colors.powder, icon:'✣', label:'DRY POWDER / CLASS B'}
  ];
  const tools = [
    {id:'route', name:'Route Paint', sub:'EVACUATION HOSE', icon:'↗', color:'#83dca2'},
    {id:'tape', name:'Danger Tape', sub:'MARK HAZARD BOUNDARY', icon:'▧', color:'#ee9571'},
    {id:'mount', name:'Wall Mount', sub:'INSTALL EXTINGUISHER', icon:'⊞', color:'#9bb9cd'}
  ];
  let selectedExt = 0, selectedTool = 0, phase = 'prep', elapsed = 0, drillDuration = 70, prepDuration = 120;
  let lastTime = 0, toastTimer = 0, pointer = {x:500,y:350}, mouseDown = false, drawing = null, wheelMode = '', wheelIndex = 0, exploded = 0, soundOn = false;
  const keys = new Set(), particles = [], sprayCooldown = {v:0};
  const player = {x:500,y:355,angle:0,speed:178,radius:12,walk:0};
  const fires = [
    {id:'serverFire',name:'Server rack',type:'C',x:270,y:170,r:13,intensity:.62,alive:true,spread:0,tag:'ELECTRICAL'},
    {id:'kitchenFire',name:'Fryer',type:'K',x:742,y:166,r:15,intensity:.68,alive:true,spread:0,tag:'COOKING OIL'}
  ];
  const hazards = [
    {id:'transformer',name:'Transformer',kind:'ELECTRICAL',x:374,y:204,r:76,blastTimer:0,active:true,marked:false,icon:'ϟ'},
    {id:'generator',name:'Backup generator',kind:'VOLATILE',x:638,y:474,r:72,blastTimer:0,active:true,marked:false,icon:'⚙'},
    {id:'gas',name:'Gas cylinders',kind:'PRESSURIZED',x:828,y:222,r:68,blastTimer:0,active:true,marked:false,icon:'◉'}
  ];
  const occupants = [
    {id:'N-01',name:'Server technician',x:183,y:250,home:{x:183,y:250},route:null,segment:1,progress:0,evacuated:false,stopped:false,color:'#d4b28c'},
    {id:'N-02',name:'Kitchen staff',x:809,y:270,home:{x:809,y:270},route:null,segment:1,progress:0,evacuated:false,stopped:false,color:'#ba9acc'}
  ];
  const exits = [{id:'A',x:72,y:350,side:'WEST'},{id:'B',x:928,y:350,side:'EAST'}];
  const mounts = [
    {id:'M-01',x:144,y:118,room:'SERVER ROOM',required:'co2',installed:null},
    {id:'M-02',x:856,y:117,room:'TEST KITCHEN',required:'wet',installed:null}
  ];
  const obstacles = [
    {x:228,y:126,w:94,h:24},{x:228,y:126,w:18,h:76},{x:292,y:126,w:30,h:76},
    {x:676,y:123,w:98,h:27},{x:676,y:123,w:20,h:65},{x:752,y:123,w:22,h:65},
    {x:582,y:450,w:92,h:34},{x:742,y:448,w:48,h:35},{x:343,y:469,w:47,h:58},
    {x:505,y:296,w:42,h:68},{x:470,y:90,w:20,h:176}
  ];
  const wallRects = [
    {x:100,y:72,w:3,h:246},{x:100,y:315,w:145,h:3},{x:307,y:315,w:128,h:3},{x:432,y:72,w:3,h:120},{x:432,y:232,w:3,h:86},
    {x:557,y:72,w:3,h:246},{x:557,y:315,w:88,h:3},{x:714,y:315,w:114,h:3},{x:897,y:72,w:3,h:246},
    {x:100,y:405,w:3,h:202},{x:100,y:604,w:335,h:3},{x:432,y:405,w:3,h:202},{x:100,y:405,w:140,h:3},{x:300,y:405,w:135,h:3},
    {x:557,y:405,w:3,h:202},{x:557,y:604,w:343,h:3},{x:897,y:405,w:3,h:202},{x:557,y:405,w:100,h:3},{x:722,y:405,w:178,h:3},
    {x:482,y:72,w:3,h:73},{x:482,y:215,w:3,h:103}
  ];

  function resize(){
    const rect=canvas.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(rect.width*dpr); canvas.height=Math.round(rect.height*dpr);
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  }
  window.addEventListener('resize',resize); resize();
  function worldPoint(ev){const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)/r.width*W,y:(ev.clientY-r.top)/r.height*H}}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');toastTimer=2.2}
  function validatePathAgainst(nodes,circles){
    const unsafe=[];
    if(!nodes||nodes.length<2)return{safe:false,unsafe};
    for(let i=0;i<circles.length;i++){
      const h=circles[i];if(h.active===false)continue;let hit=false;
      const radius=Number.isFinite(h.r)?h.r:Number.isFinite(h.radius)?h.radius:0;
      for(let j=1;j<nodes.length&&!hit;j++){
        const a=nodes[j-1],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
        const t=len?clamp(((h.x-a.x)*dx+(h.y-a.y)*dy)/len,0,1):0;
        const px=a.x+dx*t,py=a.y+dy*t;if(Math.hypot(px-h.x,py-h.y)<radius+9)hit=true;
      }
      if(hit)unsafe.push(h.id??i);
    }
    return{safe:unsafe.length===0,unsafe};
  }
  function routeSafety(nodes){return validatePathAgainst(nodes,hazards.filter(h=>h.active))}
  // Public validator for custom route nodes and hazard circles.
  window.validatePathSafety = (pathNodes,hazardCircles=hazards) => validatePathAgainst(pathNodes,hazardCircles);
  function drawLine(points,color,width=2,dash=[]){if(!points||points.length<2)return;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([])}

  function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
  function drawFloor(){
    ctx.fillStyle='#19272b';ctx.fillRect(0,0,W,H);
    // subtle concrete grid and speckle
    ctx.strokeStyle='#253337';ctx.lineWidth=1;
    for(let x=0;x<=W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for(let y=0;y<=H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    ctx.fillStyle='#1b2b2e';ctx.fillRect(0,0,W,61);ctx.fillRect(0,620,W,30);
    // Room floor insets
    [[103,75,329,240],[560,75,337,240],[103,408,329,194],[560,408,337,194]].forEach((r,i)=>{ctx.fillStyle=i%2?'#1d2b2d':'#1c2a2d';ctx.fillRect(...r)});
    ctx.fillStyle='#1a292b';ctx.fillRect(0,319,W,81);
    // floor markings
    ctx.setLineDash([5,6]);ctx.strokeStyle='#384748';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,360);ctx.lineTo(W,360);ctx.stroke();ctx.setLineDash([]);
    for(let x=20;x<W;x+=24){ctx.fillStyle='#354346';ctx.fillRect(x,330,1,7);ctx.fillRect(x,383,1,7)}
    // walls
    ctx.fillStyle='#435254';for(const r of wallRects)ctx.fillRect(r.x,r.y,r.w,r.h);
    ctx.fillStyle='#62716f';for(const r of wallRects){if(r.w>30)ctx.fillRect(r.x,r.y,r.w,1)}
    // room labels
    const rooms=[['SERVER ROOM',122,94,'A-01'],['TEST KITCHEN',579,94,'A-02'],['SUPPORT / STORAGE',122,428,'B-01'],['OPEN WORKSPACE',579,428,'B-02']];
    for(const [name,x,y,code] of rooms){ctx.fillStyle='#607170';ctx.font='500 9px "DM Mono", monospace';ctx.letterSpacing='1px';ctx.fillText(name,x,y);ctx.fillStyle='#3d4c4d';ctx.font='8px "DM Mono", monospace';ctx.fillText(code, x+210,y)}
    // door threshold lights
    [[245,315],[432,192],[645,315],[828,315],[240,405],[657,405]].forEach(([x,y])=>{ctx.fillStyle='#76b88e';ctx.fillRect(x,y,62,2);ctx.fillStyle='#547a65';ctx.fillRect(x,y+3,62,1)});
    // obstacles / furniture
    for(const r of obstacles){ctx.fillStyle='#2d3d3f';ctx.fillRect(r.x+3,r.y+4,r.w,r.h);rounded(r.x,r.y,r.w,r.h,3,'#354649','#506164');ctx.fillStyle='#415356';ctx.fillRect(r.x+5,r.y+4,Math.max(4,r.w-10),2)}
    // exit arrows
    for(const e of exits)drawExit(e);
  }
  function drawExit(e){
    const left=e.side==='WEST', x=e.x, y=e.y;ctx.save();ctx.translate(x,y);if(!left)ctx.scale(-1,1);
    ctx.shadowColor='#65d793';ctx.shadowBlur=15;rounded(-24,-21,48,42,4,'#173c2a','#68cb8c');ctx.shadowBlur=0;
    ctx.fillStyle='#a8f0bf';ctx.font='700 8px "DM Mono", monospace';ctx.textAlign='center';ctx.fillText('EXIT',0,-7);ctx.beginPath();ctx.moveTo(-7,1);ctx.lineTo(5,1);ctx.lineTo(5,-5);ctx.lineTo(15,6);ctx.lineTo(5,17);ctx.lineTo(5,11);ctx.lineTo(-7,11);ctx.closePath();ctx.fill();ctx.restore();
  }
  function drawHazards(now){
    hazards.forEach((h,i)=>{
      if(!h.active)return;const t=now/1000;
      ctx.save();ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,Math.PI*2);ctx.fillStyle='rgba(219,78,67,.055)';ctx.fill();ctx.setLineDash([5,5]);ctx.lineWidth=h.marked?2:1.2;ctx.strokeStyle=h.marked?'#f6a15f':'rgba(234,103,88,.64)';ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(h.x,h.y,h.r+3+Math.sin(t*2+i)*2,0,Math.PI*2);ctx.strokeStyle='rgba(227,93,82,.12)';ctx.stroke();
      ctx.fillStyle='#8c5045';ctx.fillRect(h.x-3,h.y-3,6,6);ctx.fillStyle='#ef7966';ctx.beginPath();ctx.arc(h.x,h.y,3,0,Math.PI*2);ctx.fill();
      if(h.marked){ctx.strokeStyle='#f0a166';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(h.x,h.y,h.r+8,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}
      ctx.restore();
    });
  }
  function drawEquipment(){
    // server racks
    for(let i=0;i<3;i++){const x=222+i*35;rounded(x,139,22,44,2,'#26393e','#506368');ctx.fillStyle=i===1?'#e77d62':'#66c68c';ctx.fillRect(x+4,145,3,3);ctx.fillStyle='#597176';ctx.fillRect(x+4,153,14,2);ctx.fillRect(x+4,160,14,2);ctx.fillStyle='#2c4449';ctx.fillRect(x+4,168,14,10)}
    // fryer / kitchen counter
    rounded(684,132,90,35,3,'#384647','#61716d');ctx.fillStyle='#596866';ctx.fillRect(690,137,78,4);for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(701+i*27,151,7,0,Math.PI*2);ctx.fillStyle='#273335';ctx.fill();ctx.strokeStyle='#8e9b91';ctx.stroke();ctx.fillStyle='#d99c57';ctx.beginPath();ctx.arc(701+i*27,151,3,0,Math.PI*2);ctx.fill()}
    // transformer
    rounded(353,187,39,34,3,'#4b5048','#a08f61');ctx.fillStyle='#c2ab71';for(let i=0;i<4;i++)ctx.fillRect(358+i*7,193,3,18);ctx.fillStyle='#efbb68';ctx.font='10px sans-serif';ctx.fillText('ϟ',366,182);
    // generator
    rounded(617,455,45,38,4,'#454a40','#a18a58');ctx.fillStyle='#bd9a57';ctx.fillRect(623,460,33,4);ctx.fillStyle='#80918a';ctx.beginPath();ctx.arc(639,477,10,0,Math.PI*2);ctx.strokeStyle='#929d86';ctx.stroke();ctx.beginPath();ctx.moveTo(639,468);ctx.lineTo(639,486);ctx.moveTo(630,477);ctx.lineTo(648,477);ctx.stroke();
    // cylinders
    for(let i=0;i<2;i++){rounded(813+i*15,204,11,30,4,'#806650','#c49b65');ctx.fillStyle='#d0b179';ctx.fillRect(816+i*15,200,5,5);ctx.fillStyle='#a68058';ctx.fillRect(816+i*15,210,5,3)}
    // mount points
    mounts.forEach(m=>{ctx.save();rounded(m.x-10,m.y-13,20,27,3,m.installed?'#244234':'#222f31',m.installed?'#6ac58c':'#65716d');if(m.installed){ctx.fillStyle=extinguishers.find(e=>e.id===m.installed)?.color||'#9bd7a9';ctx.fillRect(m.x-3,m.y-9,6,17);ctx.fillRect(m.x+3,m.y-6,4,3)}else{ctx.strokeStyle='#8a9a91';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(m.x,m.y-1,5,Math.PI,0);ctx.stroke();ctx.fillStyle='#82928d';ctx.font='8px "DM Mono"';ctx.textAlign='center';ctx.fillText('MOUNT',m.x,m.y+23)}ctx.restore()});
  }
  function drawFires(now){
    fires.forEach((f,i)=>{if(!f.alive)return;const pulse=Math.sin(now/135+i*3)*2, radius=f.r+4+pulse+f.intensity*6;
      const g=ctx.createRadialGradient(f.x,f.y,2,f.x,f.y,radius*2.6);g.addColorStop(0,'rgba(255,235,154,.88)');g.addColorStop(.28,'rgba(255,147,67,.78)');g.addColorStop(.62,'rgba(238,85,49,.36)');g.addColorStop(1,'rgba(238,85,49,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(f.x,f.y,radius*2.6,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.translate(f.x,f.y);for(let j=0;j<4;j++){const a=(now/420+j*Math.PI/2+i)*.5;const px=Math.cos(a)*radius*.37,py=Math.sin(a)*radius*.27;ctx.beginPath();ctx.ellipse(px,py-(j%2?3:0),4+j%2,7+j%3,Math.sin(a),0,Math.PI*2);ctx.fillStyle=j%2?'#ffb35a':'#ffe18c';ctx.globalAlpha=.78;ctx.fill()}ctx.globalAlpha=1;ctx.beginPath();ctx.arc(0,0,6+f.intensity*4,0,Math.PI*2);ctx.fillStyle='#ffe0a0';ctx.fill();ctx.restore();
      ctx.fillStyle='#db9a68';ctx.font='8px "DM Mono", monospace';ctx.textAlign='center';ctx.fillText(f.type==='C'?'ELECTRICAL SPARK':'GREASE FIRE',f.x,f.y+32);
    });
  }
  function drawRoutes(){
    for(const o of occupants){if(!o.route)continue;const safety=routeSafety(o.route.nodes);const color=safety.safe?'#73e69b':'#f0a25f';ctx.save();ctx.shadowColor=color;ctx.shadowBlur=10;drawLine(o.route.nodes,color,3,safety.safe?[]:[7,5]);ctx.shadowBlur=0;
      for(let i=1;i<o.route.nodes.length;i++){const a=o.route.nodes[i-1],b=o.route.nodes[i],d=Math.hypot(b.x-a.x,b.y-a.y);if(d<12)continue;const t=.55, x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,angle=Math.atan2(b.y-a.y,b.x-a.x);ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(-5,-4);ctx.lineTo(2,0);ctx.lineTo(-5,4);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();ctx.restore()}
      const first=o.route.nodes[0],last=o.route.nodes[o.route.nodes.length-1];ctx.beginPath();ctx.arc(first.x,first.y,4,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.beginPath();ctx.arc(last.x,last.y,5,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();ctx.restore();
    }
    if(drawing){ctx.save();ctx.shadowColor='#8ce3a5';ctx.shadowBlur=10;drawLine(drawing.nodes,'#9be9ae',3);ctx.restore()}
  }
  function drawOccupants(){
    occupants.forEach((o,i)=>{if(o.evacuated)return;const bob=phase==='drill'?Math.sin(elapsed*8+i)*1.5:0;ctx.save();ctx.translate(o.x,o.y+bob);
      ctx.beginPath();ctx.ellipse(0,9,10,5,0,0,Math.PI*2);ctx.fillStyle='#0a1112';ctx.fill();ctx.fillStyle=o.color;ctx.beginPath();ctx.arc(0,-2,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e2c7a6';ctx.beginPath();ctx.arc(0,-9,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#243332';ctx.fillRect(-6,-5,12,4);
      ctx.strokeStyle='#dae5da';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,1,12,-2.6,-.6);ctx.stroke();ctx.fillStyle='#e9f1e7';ctx.font='7px "DM Mono", monospace';ctx.textAlign='center';ctx.fillText(o.id,0,-20);if(o.stopped){ctx.fillStyle='#f08d67';ctx.fillText('WAITING',0,22)}ctx.restore()});
  }
  function drawPlayer(now){
    ctx.save();ctx.translate(player.x,player.y);ctx.beginPath();ctx.ellipse(0,13,13,7,0,0,Math.PI*2);ctx.fillStyle='#0b1214';ctx.fill();
    // feet
    ctx.fillStyle='#263a37';ctx.beginPath();ctx.ellipse(-5,9,4,5,player.walk?Math.sin(player.walk)*.5:0,0,Math.PI*2);ctx.ellipse(5,9,4,5,player.walk?Math.sin(player.walk+Math.PI)*.5:0,0,Math.PI*2);ctx.fill();
    // torso always follows movement, independent helmet/aim
    ctx.rotate(player.angle);ctx.shadowColor='#72d49a';ctx.shadowBlur=10;ctx.fillStyle='#537861';ctx.beginPath();ctx.roundRect(-8,-9,16,19,5);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#9dc9a7';ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle='#d5bc8d';ctx.beginPath();ctx.arc(0,-10,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d7a45e';ctx.beginPath();ctx.arc(0,-12,7,Math.PI,Math.PI*2);ctx.lineTo(7,-10);ctx.lineTo(-7,-10);ctx.closePath();ctx.fill();ctx.fillStyle='#334a41';ctx.fillRect(-6,-5,12,3);
    // hose + twin line arc indicator
    ctx.strokeStyle='#263b37';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(3,-1);ctx.lineTo(13,-3);ctx.stroke();ctx.strokeStyle='#aabeb0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(11,-3);ctx.lineTo(19,-3);ctx.stroke();ctx.restore();
    const sx=player.x+Math.cos(player.angle)*20,sy=player.y+Math.sin(player.angle)*20;ctx.save();ctx.setLineDash([3,5]);ctx.strokeStyle='rgba(181,231,193,.47)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sx+Math.cos(player.angle+.1)*3,sy+Math.sin(player.angle+.1)*3);ctx.lineTo(sx+Math.cos(player.angle)*130,sy+Math.sin(player.angle)*130);ctx.moveTo(sx+Math.cos(player.angle-.1)*3,sy+Math.sin(player.angle-.1)*3);ctx.lineTo(sx+Math.cos(player.angle)*130,sy+Math.sin(player.angle)*130);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    if(mouseDown&&wheelMode===''){ctx.beginPath();ctx.arc(sx,sy,4+Math.sin(now/45),0,Math.PI*2);ctx.fillStyle=extinguishers[selectedExt].color;ctx.fill()}
  }
  function drawParticles(){for(const p of particles){ctx.globalAlpha=clamp(p.life/.45,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1}
  function drawMarkers(){for(const h of hazards)if(h.marked){ctx.fillStyle='#f0a166';ctx.font='8px "DM Mono", monospace';ctx.textAlign='center';ctx.fillText('KEEP CLEAR',h.x,h.y-h.r-12)}}
  function render(now){
    ctx.clearRect(0,0,W,H);drawFloor();drawHazards(now);drawEquipment();drawRoutes();drawFires(now);drawMarkers();drawOccupants();drawParticles();drawPlayer(now);
    if(phase==='prep'){ctx.fillStyle='#d9e7dc';ctx.font='8px "DM Mono", monospace';ctx.fillText('PRE-DRILL / ACTIVE RESPONSE',20,30)}else if(phase==='drill'){ctx.fillStyle='#efaa66';ctx.font='8px "DM Mono", monospace';ctx.fillText('LIVE SIMULATION / EVACUATION IN PROGRESS',20,30)}
  }

  function buildLists(){
    $('extinguisherList').innerHTML=extinguishers.map((e,i)=>`<div class="inventory-item ${i===selectedExt?'selected':''}" data-ext="${i}"><span class="item-icon" style="color:${e.color}">${e.icon}</span><span class="item-copy"><strong>${e.name}</strong><small>${e.cls}</small></span><span class="item-number">${i+1}</span></div>`).join('');
    $('toolList').innerHTML=tools.map((t,i)=>`<div class="tool-item ${i===selectedTool?'selected':''}" data-tool="${i}"><span class="item-icon" style="color:${t.color}">${t.icon}</span><span class="item-copy"><strong>${t.name}</strong><small>${t.sub}</small></span></div>`).join('');
    document.querySelectorAll('[data-ext]').forEach(el=>el.addEventListener('click',()=>selectExt(+el.dataset.ext)));
    document.querySelectorAll('[data-tool]').forEach(el=>el.addEventListener('click',()=>selectTool(+el.dataset.tool)));
  }
  function selectExt(i){selectedExt=(i+extinguishers.length)%extinguishers.length;buildLists();$('equippedLabel').innerHTML=`<i style="background:${extinguishers[selectedExt].color}"></i> ${extinguishers[selectedExt].label}`;updateWheelName()}
  function selectTool(i){selectedTool=(i+tools.length)%tools.length;buildLists();const hints=['CLICK + DRAG TO PAINT EVACUATION ROUTE','CLICK A BLAST CIRCLE TO FLAG ITS BOUNDARY','CLICK AN EMPTY MOUNT TO INSTALL YOUR EQUIPPED EXTINGUISHER'];$('toolHint').innerHTML=`<span class="mouse-icon">⌁</span> ${hints[selectedTool]}`;updateNote()}
  function updateNote(){const note=['Draw from an occupant to an EXIT. Any segment through a red blast radius makes that evac route unsafe.','Tap a red blast zone to lay visible boundary tape. Marked hazards remain dangerous to route planning.','Mounts are color-coded by room: the server room needs CO₂; the kitchen needs Wet Chemical.'][selectedTool];$('fieldNote').textContent=note}
  function readiness(){const fireDone=fires.every(f=>!f.alive),mountDone=mounts.every(m=>!!m.installed),routeDone=occupants.every(o=>o.route&&routeSafety(o.route.nodes).safe);let n=18+(fireDone?23:0)+(mountDone?20:0)+(occupants.filter(o=>o.route&&routeSafety(o.route.nodes).safe).length*19);n=clamp(n,18,100);$('readinessValue').textContent=`${n}%`;$('readinessBar').style.width=`${n}%`;
    $('objFire').classList.toggle('done',fireDone);$('objMount').classList.toggle('done',mountDone);$('objRoute').classList.toggle('done',routeDone);
  }
  function updateHud(){
    $('phaseLabel').textContent=phase==='prep'?'PRE-DRILL':phase==='drill'?'LIVE DRILL':'DEBRIEF';
    const activeHazards=hazards.filter(h=>h.active).length;
    const liveFires=fires.filter(f=>f.alive).length;
    document.querySelector('.incident-main .incident-number').textContent=String(activeHazards).padStart(2,'0');
    document.querySelector('.incident-main div span').textContent=`${activeHazards} active zone${activeHazards===1?'':'s'} · ${liveFires} live fire${liveFires===1?'':'s'}`;
    const left=phase==='prep'?Math.max(0,prepDuration-elapsed):phase==='drill'?Math.max(0,drillDuration-elapsed):0;
    $('clockLabel').textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(Math.floor(left%60)).padStart(2,'0')}`;
    $('alarmState').textContent=phase==='drill'?'ACTIVE':'OFF';$('incidentChip').textContent=phase==='drill'?'LIVE':phase==='done'?'CLOSED':'STANDBY';$('incidentNumber').textContent=String(hazards.filter(h=>h.active).length).padStart(2,'0');
    $('occupantCount').textContent=String(occupants.filter(o=>!o.evacuated).length).padStart(2,'0');
    const rows=hazards.map(h=>{const linked=fires.some(f=>f.alive&&dist(f,h)<h.r*.72);return `<div class="hazard-row"><span class="hazard-symbol ${linked?'live':''}">${h.icon}</span><span class="hazard-info"><strong>${h.name}</strong><small>${h.kind} · ${Math.round(h.r/15)}M BLAST ZONE</small></span><span class="hazard-status ${linked?'':'safe'}">${linked?'MONITOR':'STABLE'}</span></div>`}).join('');$('hazardList').innerHTML=rows;
    const routeRows=occupants.filter(o=>o.route).map(o=>{const safe=routeSafety(o.route.nodes).safe;return `<div class="route-row ${safe?'':'unsafe'}"><span class="route-mark">${safe?'↗':'⚠'}</span><span>${o.id} → EXIT ${o.route.exit.id}</span><span class="hazard-status ${safe?'safe':''}">${safe?'SAFE':'UNSAFE'}</span></div>`}).join('');
    $('routeList').innerHTML=routeRows||'<div class="empty-routes"><span>↗</span><p>No routes marked yet.<br><b>Choose Route Paint</b> and draw from an occupant to an exit.</p></div>';
    $('routeCount').textContent=`${occupants.filter(o=>o.route&&routeSafety(o.route.nodes).safe).length} / 2`;
    $('routeWarning').classList.toggle('visible',occupants.some(o=>o.route&&!routeSafety(o.route.nodes).safe));readiness();
  }
  function updateWheelName(){const item=wheelMode==='ext'?extinguishers[wheelIndex]:tools[wheelIndex];$('wheelType').textContent=wheelMode==='ext'?'EXTINGUISHER':'FIELD TOOL';$('wheelName').textContent=item.name.toUpperCase();drawWheel()}
  function drawWheel(){
    const c=wctx,ww=wheelCanvas.width,hh=wheelCanvas.height,cx=ww/2,cy=hh/2,r=145,inner=66; c.clearRect(0,0,ww,hh);const list=wheelMode==='ext'?extinguishers:tools,step=Math.PI*2/list.length,start=-Math.PI/2-step/2;
    list.forEach((item,i)=>{const a0=start+i*step+.035,a1=start+(i+1)*step-.035,mid=(a0+a1)/2,active=i===wheelIndex;c.beginPath();c.arc(cx,cy,r,a0,a1);c.arc(cx,cy,inner,a1,a0,true);c.closePath();c.fillStyle=active?'rgba(75,132,95,.94)':'rgba(24,38,40,.95)';c.fill();c.strokeStyle=active?'#a6e8b7':'#4a605b';c.lineWidth=active?2:1;c.stroke();const x=cx+Math.cos(mid)*104,y=cy+Math.sin(mid)*104;c.beginPath();c.arc(x,y,18,0,Math.PI*2);c.fillStyle=active?'#264936':'#202f31';c.fill();c.strokeStyle=item.color;c.lineWidth=1.5;c.stroke();c.fillStyle=item.color;c.font='bold 17px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(item.icon,x,y);c.fillStyle=active?'#e4f2e7':'#a2b1ab';c.font='500 8px "DM Mono", monospace';c.fillText(item.name.toUpperCase(),cx+Math.cos(mid)*124,cy+Math.sin(mid)*124+25)});
    c.beginPath();c.arc(cx,cy,inner-4,0,Math.PI*2);c.fillStyle='#10191c';c.fill();c.strokeStyle='#40534d';c.stroke();
  }
  function openWheel(mode){wheelMode=mode;wheelIndex=mode==='ext'?selectedExt:selectedTool;$('wheelOverlay').classList.add('visible');updateWheelName()}
  function closeWheel(){if(!wheelMode)return;if(wheelMode==='ext')selectExt(wheelIndex);else selectTool(wheelIndex);wheelMode='';$('wheelOverlay').classList.remove('visible')}
  function wheelStep(delta){if(!wheelMode)return;const max=wheelMode==='ext'?extinguishers.length:tools.length;wheelIndex=(wheelIndex+(delta>0?1:-1)+max)%max;updateWheelName()}

  function circleHit(p,r){return Math.hypot(pointer.x-p.x,pointer.y-p.y)<r}
  function startRoute(){
    const nearest=occupants.filter(o=>!o.evacuated).sort((a,b)=>dist(a,pointer)-dist(b,pointer))[0];if(!nearest||dist(nearest,pointer)>54){toast('START ROUTE NEAR AN OCCUPANT');return}
    drawing={occupant:nearest,nodes:[{x:nearest.x,y:nearest.y},{...pointer}]};
  }
  function finishRoute(){
    if(!drawing)return;const o=drawing.occupant;let nodes=drawing.nodes.filter((p,i,a)=>i===0||dist(p,a[i-1])>5);const end=nodes[nodes.length-1];const exit=exits.slice().sort((a,b)=>dist(a,end)-dist(b,end))[0];if(dist(end,exit)>95){toast('FINISH THE ROUTE AT AN EXIT');drawing=null;return}
    nodes[0]={x:o.home.x,y:o.home.y};nodes.push({x:exit.x,y:exit.y});o.route={nodes,exit};o.stopped=false;drawing=null;const result=routeSafety(nodes);toast(result.safe?`${o.id} ROUTE LOCKED · SAFE TO EVACUATE`:'UNSAFE ROUTE · AVOID BLAST ZONE');updateHud();
  }
  function actionAtPoint(){
    if(selectedTool===1){const h=hazards.slice().sort((a,b)=>dist(a,pointer)-dist(b,pointer))[0];if(h&&dist(h,pointer)<h.r+25){h.marked=!h.marked;toast(h.marked?'BOUNDARY TAPE DEPLOYED':'BOUNDARY TAPE REMOVED')}else toast('PLACE TAPE AT A VOLATILE OBJECT');return}
    if(selectedTool===2){const m=mounts.slice().sort((a,b)=>dist(a,pointer)-dist(b,pointer))[0];if(!m||dist(m,pointer)>42){toast('MOVE CLOSER TO AN EMPTY WALL MOUNT');return}if(m.installed){toast('WALL MOUNT ALREADY EQUIPPED');return}m.installed=extinguishers[selectedExt].id;if(m.installed!==m.required)toast(`WRONG TYPE · ${m.room} NEEDS ${extinguishers.find(e=>e.id===m.required).name.toUpperCase()}`);else toast(`${m.room} MOUNT EQUIPPED CORRECTLY`);updateHud();return}
  }
  function nearestFire(p){let best=null,bd=Infinity;for(const f of fires)if(f.alive){const d=dist(f,p);if(d<bd){bd=d;best=f}}return best}
  function explode(h,reason){if(!h.active)return;h.active=false;exploded++;for(const o of occupants)if(!o.evacuated&&dist(o,h)<h.r*1.35)o.stopped=true;toast(reason||`${h.name.toUpperCase()} EXPLOSION · BLAST ZONE CLEARED`);if(phase==='drill')finishDrill(false);updateHud()}
  function sprayHit(f){const ext=extinguishers[selectedExt],near=nearestFire({x:f.x,y:f.y});if(!near||dist(near,f)>near.r+13)return;
    if(ext.id==='water'&&near.type==='C'){const h=hazards.find(h=>h.id==='transformer');explode(h,'WATER ON LIVE ELECTRICAL · EXPLOSION');near.alive=false;updateHud();return}
    if(ext.id==='water'&&near.type==='K'){near.intensity=clamp(near.intensity+.17,0,1.8);near.r+=3;toast('GREASE FIRE FLARE-UP · WATER IS UNSAFE');return}
    const effective=(near.type==='C'&&ext.id==='co2')||(near.type==='K'&&ext.id==='wet')||(near.type==='A'&&ext.id==='water');
    near.intensity-=effective?.065:.012;if(near.intensity<=0){near.alive=false;toast(`${near.name.toUpperCase()} SUPPRESSED`);updateHud()}else if(!effective&&Math.random()<.018)toast('WEAK AGENT · SELECT A MATCHING EXTINGUISHER');
  }
  function emitSpray(dt){if(!mouseDown||selectedTool!==0||wheelMode)return;sprayCooldown.v-=dt;if(sprayCooldown.v>0)return;sprayCooldown.v=.045;const e=extinguishers[selectedExt];const a=player.angle+(Math.random()-.5)*.24;const sx=player.x+Math.cos(player.angle)*19,sy=player.y+Math.sin(player.angle)*19;const speed=270+Math.random()*110;const p={x:sx,y:sy,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:.45+Math.random()*.16,size:1.6+Math.random()*2.2,color:e.color};particles.push(p);sprayHit({x:sx+Math.cos(a)*85,y:sy+Math.sin(a)*85});}
  function solidAt(x,y){if(x<26||x>974||y<30||y>622)return true;for(const r of [...wallRects,...obstacles])if(x+player.radius>r.x&&x-player.radius<r.x+r.w&&y+player.radius>r.y&&y-player.radius<r.y+r.h)return true;return false}
  function movePlayer(dt){let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;const nx=player.x+dx*player.speed*dt,ny=player.y+dy*player.speed*dt;if(!solidAt(nx,player.y))player.x=nx;if(!solidAt(player.x,ny))player.y=ny;if(dx||dy)player.walk+=dt*12;player.angle=Math.atan2(pointer.y-player.y,pointer.x-player.x)}

  function startDrill(){if(phase!=='prep')return;phase='drill';elapsed=0;occupants.forEach(o=>{o.segment=1;o.progress=0;o.stopped=false});$('incidentChip').textContent='LIVE';toast('ALARM ACTIVE · EVACUATION DRILL STARTED');updateHud()}
  function finishDrill(forcedFailure=false){if(phase==='done')return;phase='done';const evacuated=occupants.filter(o=>o.evacuated).length;const allSafe=evacuated===occupants.length&&exploded===0&&occupants.every(o=>!o.stopped);let score=Math.round(evacuated/occupants.length*100-exploded*28);score=clamp(score,0,100);$('resultIcon').textContent=allSafe?'✓':'!';$('resultIcon').style.borderColor=allSafe?'#67b885':'#be6c4c';$('resultIcon').style.color=allSafe?'#a4e0b7':'#f1a17c';$('resultIcon').style.background=allSafe?'#1a3828':'#3b2721';$('resultTitle').textContent=allSafe?'DRILL PASSED':forcedFailure?'SAFETY FAILURE':'DRILL COMPLETE';$('resultCopy').textContent=allSafe?'Every evacuee reached a safe exit. Excellent work, Marshal.':`${evacuated} of ${occupants.length} occupants evacuated · ${exploded} blast event${exploded===1?'':'s'} recorded.`;$('evacStat').textContent=`${evacuated} / ${occupants.length}`;$('scoreStat').textContent=`${score}%`;$('timeStat').textContent=`00:${String(Math.min(70,Math.floor(elapsed))).padStart(2,'0')}`;$('drillOverlay').classList.add('visible');updateHud()}
  function updateVictims(dt){
    if(phase!=='drill')return;
    for(const o of occupants){if(o.evacuated||!o.route)continue;const safety=routeSafety(o.route.nodes);if(!safety.safe){o.stopped=true;continue}o.stopped=false;
      let target=o.route.nodes[Math.min(o.segment,o.route.nodes.length-1)];let d=dist(o,target),step=53*dt;if(d<=step+2){o.x=target.x;o.y=target.y;if(o.segment<o.route.nodes.length-1)o.segment++;else{if(dist(o, o.route.exit)<35)o.evacuated=true}}else{o.x+=(target.x-o.x)/d*step;o.y+=(target.y-o.y)/d*step}
    }
    if(occupants.every(o=>o.evacuated))finishDrill();
  }
  function update(dt,now){
    if(phase==='prep'||phase==='drill')elapsed+=dt;
    if(phase==='prep'&&elapsed>=prepDuration)startDrill();
    if(phase==='drill'){
      // Test fires grow while alarms sound. A fire reaching a volatile object starts a visible countdown.
      for(const f of fires)if(f.alive){f.intensity=clamp(f.intensity+dt*.004,0,.98);f.spread+=dt;if(f.spread>9){f.spread=0;f.r=Math.min(34,f.r+.7)}
        for(const h of hazards)if(h.active&&dist(f,h)<h.r+f.r&&h.blastTimer===0)h.blastTimer=11;
      }
      for(const h of hazards)if(h.active&&h.blastTimer>0){h.blastTimer-=dt;if(h.blastTimer<=0){explode(h,`${h.name.toUpperCase()} OVERHEATED · BLAST EVENT`);break}}
      if(phase==='drill'&&elapsed>=drillDuration)finishDrill();
    }
    movePlayer(dt);emitSpray(dt);updateVictims(dt);
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1)}
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show')}
    updateHud();render(now);
  }
  function frame(now){const dt=Math.min(.04,(now-lastTime)/1000||0);lastTime=now;update(dt,now);requestAnimationFrame(frame)}

  canvas.addEventListener('pointermove',ev=>{pointer=worldPoint(ev);if(drawing){const last=drawing.nodes[drawing.nodes.length-1];if(dist(pointer,last)>8)drawing.nodes.push({...pointer})}});
  canvas.addEventListener('pointerdown',ev=>{if(phase==='done')return;pointer=worldPoint(ev);mouseDown=true;canvas.setPointerCapture?.(ev.pointerId);if(selectedTool===0&&wheelMode==='')startRoute()});
  window.addEventListener('pointerup',ev=>{if(!mouseDown)return;mouseDown=false;if(drawing)finishRoute();else if(selectedTool!==0&&canvas.matches(':hover'))actionAtPoint()});
  canvas.addEventListener('wheel',ev=>{if(wheelMode){ev.preventDefault();wheelStep(ev.deltaY)}},{passive:false});
  window.addEventListener('keydown',ev=>{
    const k=ev.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))ev.preventDefault();
    if((k==='q'||k==='e')&&!ev.repeat){openWheel(k==='q'?'ext':'tool');return}
    if(wheelMode&&(k==='arrowleft'||k==='arrowup')){wheelStep(-1);return}if(wheelMode&&(k==='arrowright'||k==='arrowdown')){wheelStep(1);return}
    if(k==='enter'){startDrill();return}if(k==='escape'&&wheelMode){closeWheel();return}
    if('wasd'.includes(k)||k.startsWith('arrow'))keys.add(k);
    if(/^[1-4]$/.test(k))selectExt(+k-1);if(k==='5'||k==='6'||k==='7')selectTool(+k-5);
    if(k===' '){mouseDown=true}
  });
  window.addEventListener('keyup',ev=>{const k=ev.key.toLowerCase();keys.delete(k);if(k==='q'||k==='e')closeWheel();if(k===' ')mouseDown=false});
  $('startBtn').addEventListener('click',startDrill);
  $('resetBtn').addEventListener('click',()=>location.reload());
  $('playAgain').addEventListener('click',()=>location.reload());
  $('zoomBtn').addEventListener('click',()=>{player.x=500;player.y=355;toast('VIEW CENTERED ON FIELD MARSHAL')});
  $('soundBtn').addEventListener('click',ev=>{soundOn=!soundOn;ev.currentTarget.style.color=soundOn?'#9be2bd':'';toast(soundOn?'AUDIO CUES ENABLED':'AUDIO CUES MUTED')});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)keys.clear()});
  buildLists();updateNote();updateHud();requestAnimationFrame(frame);
})();
