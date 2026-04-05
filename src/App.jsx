import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ── SEEDED RNG (for deterministic pixel art) ──────────────────────────────────
const seededRng = seed => {
  let s = Math.abs(seed) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
};
const hashStr = s => [...s].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);

// ── SVG SHIP SILHOUETTES ──────────────────────────────────────────────────────
const PATHS = {
  merlin:     "M22,3 L36,22 L22,44 L8,22 Z",
  rifter:     "M22,3 L26,14 L24,44 L22,47 L20,44 L18,14 Z",
  punisher:   "M19,5 L25,5 L25,15 L33,15 L33,22 L25,22 L25,40 L19,40 L19,22 L11,22 L11,15 L19,15 Z",
  vexor:      "M22,6 L30,10 L36,20 L36,32 L30,42 L22,46 L14,42 L8,32 L8,20 L14,10 Z",
  stiletto:   "M22,2 L25,10 L25,45 L22,48 L19,45 L19,10 Z",
  caracal:    "M22,3 L34,10 L38,24 L34,38 L22,44 L10,38 L6,24 L10,10 Z",
  ishtar:     "M22,4 L30,6 L37,14 L38,24 L36,34 L30,42 L22,45 L14,42 L8,34 L6,24 L7,14 L14,6 Z",
  tempest:    "M20,2 L30,2 L40,10 L42,24 L38,38 L28,46 L20,48 L12,46 L2,38 L-2,24 L2,10 Z",
  drake:      "M14,3 L30,3 L38,10 L40,28 L36,42 L22,48 L8,42 L4,28 L6,10 Z",
  dominix:    "M22,3 L32,6 L40,14 L42,24 L40,34 L32,42 L22,46 L12,42 L4,34 L2,24 L4,14 L12,6 Z",
  raven:      "M22,2 L28,5 L36,3 L40,10 L42,24 L38,40 L28,47 L22,49 L16,47 L6,40 L2,24 L4,10 L8,3 L16,5 Z",
  revelation: "M20,2 L26,2 L26,12 L37,10 L39,17 L29,21 L39,25 L37,35 L26,33 L26,47 L20,47 L20,33 L9,35 L7,25 L17,21 L7,17 L9,10 L20,12 Z",
  drone:      "M22,14 L28,18 L28,30 L22,34 L16,30 L16,18 Z",
};
const DEFAULT_PATH = PATHS.merlin;

function ShipSVG({ id, color, size = 52 }) {
  const path = PATHS[id] || DEFAULT_PATH;
  const gid = `sg-${id}-${size}`;
  return (
    <svg viewBox="0 0 44 52" width={size} height={size} style={{ display:'block', overflow:'visible' }}>
      <defs>
        <filter id={`gf-${gid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id={`gg-${gid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.35"/>
        </linearGradient>
      </defs>
      <path d={path} fill={color} opacity="0.12" filter={`url(#gf-${gid})`}/>
      <path d={path} fill={`url(#gg-${gid})`} stroke={color} strokeWidth="0.8" strokeOpacity="0.7"/>
      <line x1="22" y1="4" x2="22" y2="48" stroke={color} strokeWidth="0.5" strokeOpacity="0.25"/>
    </svg>
  );
}

// ── PIXEL ART PORTRAIT ────────────────────────────────────────────────────────
function PixelArt({ cardId, color, px = 4 }) {
  const pixels = useMemo(() => {
    const rng = seededRng(Math.abs(hashStr(cardId)));
    const W = 7, H = 9, half = Math.ceil(W / 2);
    const result = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < half; x++) {
        if (rng() > 0.42) {
          const bright = rng() > 0.5;
          result.push({ x, y, bright });
          if (x !== W - 1 - x) result.push({ x: W - 1 - x, y, bright });
        }
      }
    }
    return result;
  }, [cardId]);
  return (
    <svg width={7 * px} height={9 * px} style={{ display:'block', imageRendering:'pixelated' }}>
      {pixels.map(({ x, y, bright }) => (
        <rect key={`${x}-${y}`} x={x*px} y={y*px} width={px} height={px}
          fill={color} opacity={bright ? 0.95 : 0.45}/>
      ))}
    </svg>
  );
}

// ── CARDS ─────────────────────────────────────────────────────────────────────
const CARDS = [
  // Caldari — Missiles & Shields (blue)
  { id:'merlin',    name:'Merlin',         cost:1, type:'ship', atk:1, def:2, color:'#38bdf8', faction:'Caldari',  ability:'haste',       row:'front', effect:'Afterburner — attacks the turn it lands' },
  { id:'caracal',   name:'Caracal',        cost:3, type:'ship', atk:2, def:3, color:'#0ea5e9', faction:'Caldari',  ability:'ranged',      row:'back',  effect:'HAMs — fires safely from back row' },
  { id:'drake',     name:'Drake',          cost:4, type:'ship', atk:3, def:4, color:'#0284c7', faction:'Caldari',  ability:'ranged',      row:'back',  effect:'HML — heavy missiles from back row' },
  { id:'raven',     name:'Raven',          cost:6, type:'ship', atk:4, def:5, color:'#0369a1', faction:'Caldari',  ability:'volley',      row:'front', effect:'Torpedo Volley — also hits all enemy ships for 1 on attack' },
  // Amarr — Lasers & Armor (gold)
  { id:'punisher',  name:'Punisher',       cost:2, type:'ship', atk:1, def:4, color:'#fbbf24', faction:'Amarr',    ability:null,          row:'front', effect:'Armor Tank — dense front-line wall' },
  { id:'revelation',name:'Revelation',     cost:7, type:'ship', atk:6, def:6, color:'#f59e0b', faction:'Amarr',    ability:'crush',       row:'front', effect:'Doomsday — excess damage bleeds to the pod' },
  // Minmatar — Projectiles & Speed (orange-red)
  { id:'rifter',    name:'Rifter',         cost:1, type:'ship', atk:2, def:1, color:'#fb923c', faction:'Minmatar', ability:'haste',       row:'front', effect:'AC Burst — fast aggressor, attacks immediately' },
  { id:'stiletto',  name:'Stiletto',       cost:3, type:'ship', atk:3, def:2, color:'#ef4444', faction:'Minmatar', ability:'unblockable', row:'front', effect:'Nullifier — bypasses all front lines, hits pod direct' },
  { id:'tempest',   name:'Tempest',        cost:5, type:'ship', atk:5, def:3, color:'#dc2626', faction:'Minmatar', ability:'burst',       row:'front', effect:'Artillery — first attack this game deals double damage' },
  // Gallente — Drones & Hybrids (green)
  { id:'vexor',     name:'Vexor',          cost:2, type:'ship', atk:1, def:3, color:'#4ade80', faction:'Gallente', ability:'drones',      row:'front', effect:'Drone Bay — spawns a 1/1 Drone token on deploy' },
  { id:'ishtar',    name:'Ishtar',         cost:4, type:'ship', atk:3, def:3, color:'#22c55e', faction:'Gallente', ability:'lifesteal',   row:'front', effect:'Drone Recall — heals 1 HP to self after each attack' },
  { id:'dominix',   name:'Dominix',        cost:6, type:'ship', atk:2, def:7, color:'#16a34a', faction:'Gallente', ability:'drones2',     row:'front', effect:'Swarm Bay — spawns TWO Drone tokens on deploy' },
  // Modules (shared)
  { id:'disruptor', name:'Warp Disruptor', cost:2, type:'module', color:'#f43f5e', icon:'⚡', ability:'damage3',   effect:'Lock & fire — 3 damage to any ship or pod' },
  { id:'analyzer',  name:'Data Analyzer',  cost:1, type:'module', color:'#60a5fa', icon:'📡', ability:'draw2',     effect:'Hack local — draw 2 cards from reserves' },
  { id:'smartbomb', name:'Smartbomb',      cost:3, type:'module', color:'#fb923c', icon:'💥', ability:'destroy',   effect:'Area pulse — obliterate any one ship' },
  { id:'repair',    name:'Rem. Repair',    cost:2, type:'module', color:'#4ade80', icon:'🔧', ability:'heal3',     effect:'Remote reps — restore 3 HP to a friendly ship' },
  { id:'cap_boost', name:'Cap Booster',    cost:0, type:'module', color:'#facc15', icon:'🔋', ability:'coresurge', effect:'Charge inject — gain 3 extra cap this turn' },
  { id:'stasis',    name:'Stasis Web',     cost:2, type:'module', color:'#c084fc', icon:'🕸️', ability:'stasis',    effect:'Webifier — disable an enemy ship for 1 turn' },
  { id:'ecm',       name:'ECM Burst',      cost:3, type:'module', color:'#a78bfa', icon:'📺', ability:'bounce',    effect:'Jamming — return an enemy ship to their hand' },
  { id:'nanite',    name:'Nanite Paste',   cost:1, type:'module', color:'#86efac', icon:'💉', ability:'heal2any',  effect:'Nano-repair — heal 2 HP to any friendly ship' },
];

const DRONE_TOKEN = { id:'drone', name:'Drone', cost:0, type:'ship', atk:1, def:1, color:'#4ade80', faction:'Gallente', ability:null, row:'front', effect:'Basic autonomous combat drone' };

// ── UTILS ─────────────────────────────────────────────────────────────────────
let _uid = 1;
const uid = () => _uid++;
const shuffle = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]} return b; };
const buildDeck = () => shuffle([...CARDS,...CARDS].map(c=>({...c,uid:uid()})));
const drawN = (g,o,n) => { const d=[...g[o].deck],h=[...g[o].hand]; for(let i=0;i<n&&d.length;i++) h.push(d.shift()); return {...g,[o]:{...g[o],deck:d,hand:h}}; };
const frontOf = f => f.filter(u=>u.row==='front');
const backOf  = f => f.filter(u=>u.row==='back');
const checkWinner = g => g.player.hp<=0?{...g,winner:'ai',phase:'game-over'}:g.ai.hp<=0?{...g,winner:'player',phase:'game-over'}:g;
const addToast = (g,msg,color='#60a5fa') => ({...g,toasts:[{id:uid(),msg,color,ts:Date.now()},...g.toasts].slice(0,8)});

const spawnDrones = (field, n, forAi=false) => {
  const drones = Array.from({length:n}, ()=>({...DRONE_TOKEN, uid:uid(), currentHp:1, tapped:false, justPlayed:true, isToken:true}));
  return [...field, ...drones];
};

// ── AI LOGIC ──────────────────────────────────────────────────────────────────
function aiPlayCards(g) {
  let hand=[...g.ai.hand], field=[...g.ai.field], deck=[...g.ai.deck];
  let pField=[...g.player.field], pHp=g.player.hp, core=g.ai.core;
  const toasts=[];
  for(const card of [...hand].filter(c=>c.cost<=core).sort((a,b)=>b.cost-a.cost)) {
    if(card.cost>core) continue;
    core-=card.cost; hand=hand.filter(c=>c.uid!==card.uid);
    if(card.type==='ship') {
      const row=card.ability==='ranged'?'back':'front';
      const unit={...card,currentHp:card.def,tapped:false,justPlayed:true,row};
      field.push(unit);
      if(card.ability==='drones')  field=spawnDrones(field,1,true);
      if(card.ability==='drones2') field=spawnDrones(field,2,true);
      toasts.push({msg:`Enemy ${card.name} on grid [${row.toUpperCase()}]`,color:'#94a3b8'});
    } else {
      switch(card.ability) {
        case 'draw2': for(let i=0;i<2&&deck.length;i++) hand.push(deck.shift()); toasts.push({msg:'Enemy Data Analyzer — draws 2',color:'#94a3b8'}); break;
        case 'coresurge': core+=3; toasts.push({msg:'Enemy Cap Booster +3 cap',color:'#94a3b8'}); break;
        case 'heal3': { if(field.length){const t=field.reduce((a,b)=>a.currentHp<b.currentHp?a:b);field=field.map(u=>u.uid===t.uid?{...u,currentHp:Math.min(u.def,u.currentHp+3)}:u);toasts.push({msg:`Enemy repped ${t.name} +3 HP`,color:'#94a3b8'});}break;}
        case 'heal2any': { if(field.length){const t=field.reduce((a,b)=>a.currentHp<b.currentHp?a:b);field=field.map(u=>u.uid===t.uid?{...u,currentHp:Math.min(u.def,u.currentHp+2)}:u);toasts.push({msg:`Enemy Nanite repped ${t.name} +2 HP`,color:'#94a3b8'});}break;}
        case 'damage3': { const pool=frontOf(pField).length?frontOf(pField):backOf(pField); if(pool.length){const t=pool.reduce((a,b)=>a.currentHp<b.currentHp?a:b);const hp=t.currentHp-3;pField=pField.map(u=>u.uid===t.uid?{...u,currentHp:hp}:u).filter(u=>u.currentHp>0);toasts.push({msg:hp<=0?`Enemy Disruptor destroyed ${t.name}`:`Enemy Disruptor hit ${t.name} -3`,color:'#f87171'});}else{pHp-=3;toasts.push({msg:'Enemy Disruptor hits your pod -3',color:'#f87171'});}break;}
        case 'destroy': { const pool=frontOf(pField).length?frontOf(pField):backOf(pField);if(pool.length){const t=pool.reduce((a,b)=>a.atk>b.atk?a:b);pField=pField.filter(u=>u.uid!==t.uid);toasts.push({msg:`Enemy Smartbomb destroyed your ${t.name}`,color:'#f87171'});}break;}
        case 'stasis': { const pool=pField.filter(u=>!u.stunned&&!u.tapped);if(pool.length){const t=pool.reduce((a,b)=>a.atk>b.atk?a:b);pField=pField.map(u=>u.uid===t.uid?{...u,tapped:true,stunned:true}:u);toasts.push({msg:`Enemy Stasis Web disabled your ${t.name}`,color:'#f87171'});}break;}
        case 'bounce': { const pool=frontOf(pField).length?frontOf(pField):backOf(pField);if(pool.length){const t=pool.reduce((a,b)=>a.atk>b.atk?a:b);pField=pField.filter(u=>u.uid!==t.uid);toasts.push({msg:`Enemy ECM returned your ${t.name} to hand — but it's lost`,color:'#f87171'});}break;}
      }
    }
  }
  return {state:{...g,ai:{...g.ai,hand,field,deck,core},player:{...g.player,field:pField,hp:pHp}},toasts};
}

function aiDoAttack(g) {
  const seen=new Set();
  const eligible=[
    ...frontOf(g.ai.field).filter(u=>!u.tapped&&(!u.justPlayed||u.ability==='haste')),
    ...backOf(g.ai.field).filter(u=>u.ability==='ranged'&&!u.tapped&&(!u.justPlayed||u.ability==='haste')),
  ].filter(u=>{if(seen.has(u.uid))return false;seen.add(u.uid);return true;});
  if(!eligible.length) return {state:g,toasts:[]};
  let aiField=g.ai.field.map(u=>eligible.find(a=>a.uid===u.uid)?{...u,tapped:true}:u);
  let pField=[...g.player.field], pHp=g.player.hp;
  const toasts=[],used=new Set();
  for(const atk of eligible) {
    let atkDmg=atk.atk;
    if(atk.ability==='burst'&&!atk.bursted){atkDmg*=2;aiField=aiField.map(u=>u.uid===atk.uid?{...u,bursted:true}:u);}
    if(atk.ability==='unblockable'){pHp-=atkDmg;toasts.push({msg:`Enemy ${atk.name} NULLIFIER → your pod -${atkDmg}`,color:'#f87171'});continue;}
    const blocker=frontOf(pField).find(u=>!used.has(u.uid))||backOf(pField).find(u=>!used.has(u.uid));
    if(blocker){
      used.add(blocker.uid);
      const ah=atk.currentHp-blocker.atk, bh=blocker.currentHp-atkDmg;
      if(ah<=0){aiField=aiField.filter(u=>u.uid!==atk.uid);toasts.push({msg:`Your ${blocker.name} destroyed enemy ${atk.name}`,color:'#4ade80'});}
      else if(atk.ability==='lifesteal'){aiField=aiField.map(u=>u.uid===atk.uid?{...u,currentHp:Math.min(u.def,ah+1)}:u);}
      if(bh<=0){
        if(atk.ability==='crush'&&bh<0){pHp+=bh;toasts.push({msg:`DOOMSDAY — ${blocker.name} gone + ${Math.abs(bh)} overflow`,color:'#f87171'});}
        else toasts.push({msg:`Enemy ${atk.name} destroyed your ${blocker.name}`,color:'#f87171'});
        pField=pField.filter(u=>u.uid!==blocker.uid);
      } else pField=pField.map(u=>u.uid===blocker.uid?{...u,currentHp:bh}:u);
    } else {pHp-=atkDmg;toasts.push({msg:`Enemy ${atk.name} → your pod -${atkDmg}`,color:'#f87171'});}
    // Volley: also 1 dmg to all player ships
    if(atk.ability==='volley'){
      pField=pField.map(u=>({...u,currentHp:u.currentHp-1})).filter(u=>u.currentHp>0);
      toasts.push({msg:`${atk.name} TORPEDO VOLLEY — 1 dmg to all your ships`,color:'#f87171'});
    }
  }
  return {state:{...g,ai:{...g.ai,field:aiField},player:{...g.player,field:pField,hp:pHp}},toasts};
}

function runAiTurn(s) {
  let g={...s};
  g=drawN(g,'ai',1);
  const nMax=Math.min(10,g.ai.maxCore+1);
  // Untap — stunned ships skip one untap
  const aiUntapped=g.ai.field.map(u=>u.stunned?{...u,stunned:false}:u.tapped?{...u,tapped:false,justPlayed:false}:{...u,justPlayed:false});
  g={...g,ai:{...g.ai,maxCore:nMax,core:nMax,field:aiUntapped}};
  const {state:s2,toasts:t1}=aiPlayCards(g); g=s2;
  const {state:s3,toasts:t2}=aiDoAttack(g); g=s3;
  for(const t of [...t1,...t2]) g=addToast(g,t.msg,t.color);
  g=checkWinner(g);
  if(g.phase!=='game-over'){
    const t=g.turn+1, pm=Math.min(10,g.player.maxCore+1);
    g=drawN(g,'player',1);
    // Untap player ships (stunned skip)
    const pUntapped=g.player.field.map(u=>u.stunned?{...u,stunned:false}:u.tapped?{...u,tapped:false,justPlayed:false}:{...u,justPlayed:false});
    g={...g,phase:'player-play',turn:t,aiThinking:false,attackers:[],selectedCard:null,pendingDeploy:null,
      player:{...g.player,maxCore:pm,core:pm,field:pUntapped}};
    g=addToast(g,`Turn ${t} — your move, capsuleer`,'#38bdf8');
  } else g={...g,aiThinking:false};
  return {newState:g};
}

function initGame() {
  let s={phase:'player-play',turn:1,winner:null,aiThinking:false,
    selectedCard:null,pendingDeploy:null,attackers:[],targeting:null,
    toasts:[{id:uid(),msg:'Fleet engaged. New Eden local is hot.',color:'#38bdf8',ts:Date.now()}],
    player:{hp:20,core:1,maxCore:1,deck:buildDeck(),hand:[],field:[]},
    ai:   {hp:20,core:1,maxCore:1,deck:buildDeck(),hand:[],field:[]},
  };
  s=drawN(s,'player',5); s=drawN(s,'ai',5);
  return s;
}

// ── STARS ─────────────────────────────────────────────────────────────────────
const STARS = Array.from({length:80},(_,i)=>({
  left:`${(i*41+7)%100}%`,top:`${(i*67+13)%100}%`,
  w:(i%5)*.45+.15,delay:(i%7)*.65,dur:2.5+(i%6)*.9,
  tint:i%7===0?'#93c5fd':i%9===0?'#fcd34d':'#ffffff'
}));

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,    setScreen]    = useState('intro');
  const [g,         setG]         = useState(null);
  const [particles, setParticles] = useState([]);
  const [beams,     setBeams]     = useState([]);
  const [screenFx,  setScreenFx]  = useState('');
  const aiLockRef = useRef(false);
  const timerRef  = useRef(null);

  // ── FX ────────────────────────────────────────────────────────────────────
  const spawnP = useCallback((zone,color,n=10)=>{
    const Z={aBack:{x:50,y:16},aFront:{x:50,y:30},pFront:{x:50,y:58},pBack:{x:50,y:72},hand:{x:50,y:90}};
    const {x,y}=Z[zone]||{x:50,y:50};
    const ps=Array.from({length:n},(_,i)=>({id:uid(),x,y,angle:(i/n)*360+(Math.random()-.5)*25,dist:40+Math.random()*85,color,size:2+Math.random()*4,dur:.4+Math.random()*.35}));
    setParticles(p=>[...p,...ps]);
    setTimeout(()=>setParticles(p=>p.filter(x=>!ps.find(n=>n.id===x.id))),900);
  },[]);
  const triggerFx   = useCallback((fx,d=500)=>{setScreenFx(fx);setTimeout(()=>setScreenFx(''),d);},[]);
  const triggerBeam = useCallback((color,fromPlayer=true)=>{
    const id=uid(); setBeams(b=>[...b,{id,color,fromPlayer}]);
    setTimeout(()=>setBeams(b=>b.filter(x=>x.id!==id)),680);
  },[]);

  // ── AI TURN (properly fixed) ─────────────────────────────────────────────
  useEffect(()=>{
    if(!g||g.phase!=='ai-turn') return;
    if(aiLockRef.current) return;
    aiLockRef.current=true;
    const snap=g;
    timerRef.current=setTimeout(()=>{
      try {
        const {newState}=runAiTurn(snap);
        const prevHp=snap.player.hp;
        setG(newState);
        aiLockRef.current=false;
        if(newState.winner){setScreen('over');return;}
        if(newState.player.hp<prevHp){
          const d=prevHp-newState.player.hp;
          triggerBeam(d>=3?'#f43f5e':'#fb923c',false);
          setTimeout(()=>triggerFx(d>=3?'big-chroma':'chroma',d>=3?700:480),180);
          spawnP('pFront','#f43f5e',d>=3?14:8);
        }
      } catch(err){
        console.error(err); aiLockRef.current=false;
        setG(s=>({...s,phase:'player-play',turn:s.turn+1,player:{...s.player,core:s.player.maxCore}}));
      }
    },1600);
    return()=>{clearTimeout(timerRef.current);aiLockRef.current=false;};
  },[g?.phase]);

  // ── GAME ACTIONS ──────────────────────────────────────────────────────────
  const startGame = () => { setG(initGame()); setScreen('game'); };
  const resetGame = () => { setG(null); setScreen('intro'); setParticles([]); setBeams([]); setScreenFx(''); aiLockRef.current=false; };

  const selectCard = cUid => {
    if(!g||g.phase!=='player-play'||g.targeting||g.pendingDeploy) return;
    setG(s=>({...s,selectedCard:s.selectedCard===cUid?null:cUid,pendingDeploy:null}));
  };

  const activateCard = (cUid, row=null) => {
    if(!g||g.phase!=='player-play') return;
    const card=g.player.hand.find(c=>c.uid===cUid);
    if(!card||card.cost>g.player.core) return;
    if(card.type==='ship'&&row){ deployToRow(row); return; }
    if(card.type==='ship'){ return; } // ship deploy handled via action bar
    // Module
    setG(s=>{
      const c=s.player.hand.find(x=>x.uid===cUid); if(!c||c.cost>s.player.core) return s;
      let ns={...s,selectedCard:null,pendingDeploy:null,
        player:{...s.player,core:s.player.core-c.cost,hand:s.player.hand.filter(x=>x.uid!==cUid)}};
      if(['damage3','destroy','heal3','heal2any','stasis','bounce'].includes(c.ability)){
        ns={...ns,targeting:{ability:c.ability,name:c.name,uid:cUid}};
      } else {
        if(c.ability==='draw2'){ns=drawN(ns,'player',2);ns=addToast(ns,'Data Analyzer — you draw 2','#60a5fa');}
        if(c.ability==='coresurge'){ns={...ns,player:{...ns.player,core:ns.player.core+3}};ns=addToast(ns,'Cap Booster — +3 cap','#facc15');}
      }
      return checkWinner(ns);
    });
    spawnP('hand',card.color,12);
    setTimeout(()=>triggerFx('chroma',420),60);
  };

  const deployToRow = row => {
    // Works from either selectedCard (ship selected in hand) or pendingDeploy (legacy)
    const card = g?.player.hand.find(c=>c.uid===g?.selectedCard) || g?.pendingDeploy;
    if(!card||card.cost>g.player.core) return;
    if(row==='back'&&card.ability!=='ranged') return; // only ranged ships go back
    setG(s=>{
      const selCard = s.player.hand.find(c=>c.uid===s.selectedCard) || s.pendingDeploy;
      const c=selCard; if(!c||c.cost>s.player.core) return s;
      const unit={...c,currentHp:c.def,tapped:c.ability!=='haste',justPlayed:c.ability!=='haste',row};
      let pField=[...s.player.field,unit];
      if(c.ability==='drones')  pField=spawnDrones(pField,1);
      if(c.ability==='drones2') pField=spawnDrones(pField,2);
      let ns={...s,pendingDeploy:null,selectedCard:null,
        player:{...s.player,core:s.player.core-c.cost,hand:s.player.hand.filter(x=>x.uid!==c.uid&&x.uid!==selCard?.uid),field:pField}};
      ns=addToast(ns,`${c.name} on grid — ${row.toUpperCase()}`,'#60a5fa');
      return checkWinner(ns);
    });
    spawnP(row==='front'?'pFront':'pBack',card.color,14);
    if(card.ability==='haste') triggerBeam(card.color,true);
    setTimeout(()=>spawnP(row==='front'?'pFront':'pBack','#ffffff',6),200);
  };

  const handleTarget = (type, tUid) => {
    if(!g?.targeting) return;
    const {ability,name}=g.targeting;
    setG(s=>{
      if(!s.targeting) return s;
      const {ability:ab,name:nm}=s.targeting;
      let ns={...s,targeting:null};
      if(ab==='damage3'){
        if(type==='ai-ship'){const t=ns.ai.field.find(u=>u.uid===tUid);if(!t)return s;const hp=t.currentHp-3;ns={...ns,ai:{...ns.ai,field:ns.ai.field.map(u=>u.uid===tUid?{...u,currentHp:hp}:u).filter(u=>u.currentHp>0)}};ns=addToast(ns,hp<=0?`${nm} obliterated enemy ${t.name}`:`${nm} hit ${t.name} -3`,'#4ade80');}
        else if(type==='ai-pod'){ns={...ns,ai:{...ns.ai,hp:ns.ai.hp-3}};ns=addToast(ns,`${nm} → enemy pod -3`,'#4ade80');}
      } else if(ab==='destroy'&&type==='ai-ship'){const t=ns.ai.field.find(u=>u.uid===tUid);if(!t)return s;ns={...ns,ai:{...ns.ai,field:ns.ai.field.filter(u=>u.uid!==tUid)}};ns=addToast(ns,`${nm} obliterated enemy ${t.name}`,'#4ade80');}
      else if(ab==='stasis'&&type==='ai-ship'){const t=ns.ai.field.find(u=>u.uid===tUid);if(!t)return s;ns={...ns,ai:{...ns.ai,field:ns.ai.field.map(u=>u.uid===tUid?{...u,tapped:true,stunned:true}:u)}};ns=addToast(ns,`${nm} webbed enemy ${t.name} — disabled 1 turn`,'#4ade80');}
      else if(ab==='bounce'&&type==='ai-ship'){const t=ns.ai.field.find(u=>u.uid===tUid);if(!t)return s;ns={...ns,ai:{...ns.ai,field:ns.ai.field.filter(u=>u.uid!==tUid)}};ns=addToast(ns,`${nm} jammed enemy ${t.name} off grid`,'#4ade80');}
      else if(ab==='heal3'&&type==='player-ship'){const t=ns.player.field.find(u=>u.uid===tUid);if(!t)return s;ns={...ns,player:{...ns.player,field:ns.player.field.map(u=>u.uid===tUid?{...u,currentHp:Math.min(u.def,u.currentHp+3)}:u)}};ns=addToast(ns,`${nm} repped ${t.name} +3 HP`,'#4ade80');}
      else if(ab==='heal2any'&&type==='player-ship'){const t=ns.player.field.find(u=>u.uid===tUid);if(!t)return s;ns={...ns,player:{...ns.player,field:ns.player.field.map(u=>u.uid===tUid?{...u,currentHp:Math.min(u.def,u.currentHp+2)}:u)}};ns=addToast(ns,`${nm} repped ${t.name} +2 HP`,'#4ade80');}
      return checkWinner(ns);
    });
    if(['damage3','destroy','stasis','bounce'].includes(ability)){triggerBeam('#f43f5e',true);setTimeout(()=>triggerFx('chroma',480),140);spawnP('aFront','#f43f5e',12);}
    if(ability==='heal3'||ability==='heal2any') spawnP('pFront','#4ade80',10);
  };

  const toggleAttacker = cUid => {
    if(!g||g.phase!=='player-attack') return;
    const u=g.player.field.find(x=>x.uid===cUid);
    if(!u||u.tapped) return;
    if(u.row==='back'&&u.ability!=='ranged') return;
    setG(s=>{const has=s.attackers.includes(cUid);return{...s,attackers:has?s.attackers.filter(x=>x!==cUid):[...s.attackers,cUid]};});
  };

  const resolveAttack = () => {
    if(!g) return;
    const primaryColor=g.player.field.find(u=>g.attackers.includes(u.uid))?.color||'#38bdf8';
    setG(s=>{
      if(!s.attackers.length) return {...s,phase:'ai-turn',attackers:[]};
      const atkers=s.attackers.map(id=>s.player.field.find(u=>u.uid===id)).filter(Boolean);
      let pField=s.player.field.map(u=>s.attackers.includes(u.uid)?{...u,tapped:true}:u);
      let aiField=[...s.ai.field], aiHp=s.ai.hp;
      const toasts=[], used=new Set();
      for(const atk of atkers){
        let atkDmg=atk.atk;
        const isFirstBurst=atk.ability==='burst'&&!atk.bursted;
        if(isFirstBurst){atkDmg*=2;pField=pField.map(u=>u.uid===atk.uid?{...u,bursted:true}:u);}
        if(atk.ability==='unblockable'){aiHp-=atkDmg;toasts.push({msg:`${atk.name} NULLIFIER → enemy pod -${atkDmg}`,color:'#4ade80'});continue;}
        const blocker=frontOf(aiField).find(u=>!used.has(u.uid))||backOf(aiField).find(u=>!used.has(u.uid));
        if(blocker){
          used.add(blocker.uid);
          const ah=atk.currentHp-blocker.atk, bh=blocker.currentHp-atkDmg;
          if(ah<=0){pField=pField.filter(u=>u.uid!==atk.uid);toasts.push({msg:`Enemy ${blocker.name} destroyed your ${atk.name}`,color:'#f87171'});}
          else {
            if(atk.ability==='lifesteal') pField=pField.map(u=>u.uid===atk.uid?{...u,currentHp:Math.min(u.def,ah+1)}:u);
          }
          if(bh<=0){
            if(atk.ability==='crush'&&bh<0){aiHp+=bh;toasts.push({msg:`DOOMSDAY overflow +${Math.abs(bh)} hits enemy pod`,color:'#4ade80'});}
            else toasts.push({msg:`Your ${atk.name} destroyed enemy ${blocker.name}`,color:'#4ade80'});
            aiField=aiField.filter(u=>u.uid!==blocker.uid);
          } else aiField=aiField.map(u=>u.uid===blocker.uid?{...u,currentHp:bh}:u);
        } else {aiHp-=atkDmg;toasts.push({msg:`${atk.name} → enemy pod -${atkDmg}`,color:'#4ade80'});}
        if(atk.ability==='volley'){
          aiField=aiField.map(u=>({...u,currentHp:u.currentHp-1})).filter(u=>u.currentHp>0);
          toasts.push({msg:`${atk.name} TORPEDO VOLLEY — all enemy ships -1`,color:'#4ade80'});
        }
      }
      let ns={...s,player:{...s.player,field:pField},ai:{...s.ai,field:aiField,hp:aiHp},attackers:[],phase:'ai-turn'};
      for(const t of toasts) ns=addToast(ns,t.msg,t.color);
      ns=checkWinner(ns);
      if(ns.winner) setTimeout(()=>setScreen('over'),600);
      return ns;
    });
    triggerBeam(primaryColor,true);
    spawnP('aFront',primaryColor,14);
    setTimeout(()=>triggerFx('chroma',400),180);
  };

  const goAttack    = () => setG(s=>({...s,phase:'player-attack',selectedCard:null,targeting:null,pendingDeploy:null}));
  const endTurn     = () => setG(s=>({...s,phase:'ai-turn',attackers:[],selectedCard:null,targeting:null,pendingDeploy:null}));
  const cancelTgt   = () => setG(s=>({...s,targeting:null}));
  const cancelDeploy= () => setG(s=>({...s,pendingDeploy:null,selectedCard:null}));

  if(screen==='intro') return <Intro onStart={startGame}/>;
  if(screen==='over'&&g) return <GameOver winner={g.winner} onReset={resetGame}/>;
  if(!g) return null;

  const isTargeting=!!g.targeting;
  const isPending=!!g.pendingDeploy;
  const isAiTurn=g.phase==='ai-turn';
  const fxFilter=screenFx==='big-chroma'?'drop-shadow(7px 0 0 rgba(244,63,94,.75)) drop-shadow(-7px 0 0 rgba(56,189,248,.75))':screenFx==='chroma'?'drop-shadow(3px 0 0 rgba(244,63,94,.55)) drop-shadow(-3px 0 0 rgba(56,189,248,.55))':'none';

  const canAtkShip = () => isTargeting&&['damage3','destroy','stasis','bounce'].includes(g.targeting.ability);
  const canHealShip = () => isTargeting&&['heal3','heal2any'].includes(g.targeting.ability);
  const canAttack = u => g.phase==='player-attack'&&!u.tapped&&(u.row==='front'||(u.row==='back'&&u.ability==='ranged'));

  return (
    <div style={{width:'100vw',height:'100vh',background:'#060d1a',color:'#e2e8f0',
      fontFamily:"'Barlow Condensed',sans-serif",position:'relative',overflow:'hidden',
      display:'flex',flexDirection:'column',filter:fxFilter,transition:'filter .07s'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Orbitron:wght@700;900&family=Share+Tech+Mono&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes twinkle{0%,100%{opacity:.06}50%{opacity:.42}}
        @keyframes pOut{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(.15)}}
        @keyframes beamAnim{0%{transform:scaleX(0);opacity:1}55%{transform:scaleX(1);opacity:.9}100%{opacity:0}}
        @keyframes flip3d{0%{transform:rotateY(0)}50%{transform:rotateY(90deg) scale(.85)}100%{transform:rotateY(0)}}
        @keyframes deployBounce{0%{opacity:0;transform:translateY(-28px) scale(.78)}65%{transform:translateY(5px) scale(1.08)}100%{opacity:1;transform:none}}
        @keyframes toastSlide{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}
        @keyframes aiPulse{0%,100%{opacity:.35}50%{opacity:1}}
        @keyframes unitGlow{0%,100%{box-shadow:0 0 6px var(--gc)}50%{box-shadow:0 0 18px var(--gc),0 0 36px var(--gc)33}}
        @keyframes popIn{0%{opacity:0;transform:translateX(-50%) translateY(4px) scale(.92)}100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
        @keyframes targetRing{0%,100%{box-shadow:0 0 0 2px var(--tc)}50%{box-shadow:0 0 0 4px var(--tc),0 0 16px var(--tc)}}
        .card-hand{transition:transform .14s,box-shadow .14s;cursor:pointer;transform-style:preserve-3d}
        .card-hand:hover{z-index:30}
        .unit-glow{animation:unitGlow 2.8s ease-in-out infinite}
        .unit-deploy{animation:deployBounce .42s cubic-bezier(.2,1.35,.5,1) forwards}
        .flip-anim{animation:flip3d .45s ease-in-out}
        .btn{transition:all .14s;cursor:pointer}
        .btn:hover:not(:disabled){filter:brightness(1.35);transform:translateY(-1px)}
        .btn:disabled{opacity:.3;cursor:not-allowed}
        .ai-blink{animation:aiPulse 1s infinite}
        .toast-in{animation:toastSlide .25s ease}
        .popup-in{animation:popIn .18s ease}
      `}</style>

      {/* STARS */}
      <div style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none'}}>
        {STARS.map((s,i)=>(<div key={i} style={{position:'absolute',left:s.left,top:s.top,width:`${s.w}px`,height:`${s.w}px`,borderRadius:'50%',background:s.tint,animation:`twinkle ${s.dur}s ${s.delay}s infinite`}}/>))}
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 80% 50% at 20% 50%,rgba(30,58,138,.14) 0%,transparent 60%)'}}/>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 60% 40% at 80% 30%,rgba(88,28,135,.09) 0%,transparent 60%)'}}/>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at center,transparent 38%,rgba(6,13,26,.72) 100%)'}}/>
      </div>

      {/* PARTICLES */}
      <div style={{position:'fixed',inset:0,zIndex:60,pointerEvents:'none'}}>
        {particles.map(p=>{const r=p.angle*Math.PI/180;return(<div key={p.id} style={{position:'absolute',left:`calc(${p.x}% - ${p.size/2}px)`,top:`calc(${p.y}% - ${p.size/2}px)`,width:`${p.size}px`,height:`${p.size}px`,borderRadius:'50%',background:p.color,boxShadow:`0 0 ${p.size*3}px ${p.color}`,'--tx':`${Math.cos(r)*p.dist}px`,'--ty':`${Math.sin(r)*p.dist}px`,animation:`pOut ${p.dur}s ease-out forwards`}}/>);})}
      </div>

      {/* BEAMS */}
      <div style={{position:'fixed',inset:0,zIndex:55,pointerEvents:'none'}}>
        {beams.map(b=>(<div key={b.id} style={{position:'absolute',left:0,right:0,top:b.fromPlayer?'62%':'36%',height:'3px',background:`linear-gradient(${b.fromPlayer?90:270}deg,transparent,${b.color}ee,transparent)`,boxShadow:`0 0 12px ${b.color},0 0 30px ${b.color}66`,transformOrigin:b.fromPlayer?'left':'right',animation:'beamAnim .62s ease-out forwards'}}/>))}
      </div>

      {/* TOASTS */}
      <div style={{position:'fixed',top:'10px',right:'10px',zIndex:70,display:'flex',flexDirection:'column',gap:'4px',alignItems:'flex-end',pointerEvents:'none'}}>
        {g.toasts.slice(0,6).map((t,i)=>(
          <div key={t.id} className="toast-in" style={{padding:'5px 10px',background:'rgba(6,13,26,.93)',border:`1px solid ${t.color}44`,borderLeft:`3px solid ${t.color}`,borderRadius:'6px',fontFamily:'Share Tech Mono',fontSize:'11px',color:i===0?t.color:`${t.color}88`,maxWidth:'260px',backdropFilter:'blur(10px)'}}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* BOARD */}
      <div style={{position:'relative',zIndex:2,display:'flex',flexDirection:'column',height:'100vh',padding:'8px 14px',gap:'5px'}}>

        {/* Enemy header */}
        <EveHeader label="HOSTILE CAPSULEER" hp={g.ai.hp} handCount={g.ai.hand.length}
          isEnemy turn={g.turn} phaseLabel={g.phase} isAiTurn={isAiTurn}
          isTargetable={isTargeting&&g.targeting.ability==='damage3'}
          onTarget={()=>handleTarget('ai-pod',null)}/>

        {/* Enemy zones */}
        <BattleRow label="LONG RANGE" ships={backOf(g.ai.field)} isPlayer={false}
          canTarget={canAtkShip()} onShipClick={u=>handleTarget('ai-ship',u.uid)}/>
        <BattleRow label="FRONT LINE" ships={frontOf(g.ai.field)} isPlayer={false} isFront
          canTarget={canAtkShip()} onShipClick={u=>handleTarget('ai-ship',u.uid)}/>

        {/* Action bar */}
        <ActionBar phase={g.phase} isPending={isPending} pendingName={g.pendingDeploy?.name}
          isTargeting={isTargeting} targetName={g.targeting?.name}
          attackerCount={g.attackers.length} isAiTurn={isAiTurn}
          selectedCard={g.selectedCard?g.player.hand.find(c=>c.uid===g.selectedCard):null}
          onAttack={goAttack} onResolve={resolveAttack} onEndTurn={endTurn}
          onFront={()=>deployToRow('front')} onBack={()=>deployToRow('back')}
          onCancelDeploy={cancelDeploy} onCancelTarget={cancelTgt}
          onUseModule={()=>{ if(g.selectedCard){ activateCard(g.selectedCard); }}}
          onCancelSelect={()=>setG(s=>({...s,selectedCard:null}))}/>

        {/* Player zones */}
        <BattleRow label="FRONT LINE" ships={frontOf(g.player.field)} isPlayer isFront
          attackers={g.attackers} canTarget={canHealShip()} canAttack={canAttack}
          onShipClick={u=>{if(canHealShip())handleTarget('player-ship',u.uid);else toggleAttacker(u.uid);}}/>
        <BattleRow label="LONG RANGE" ships={backOf(g.player.field)} isPlayer
          attackers={g.attackers} canTarget={canHealShip()} canAttack={canAttack}
          onShipClick={u=>{if(canHealShip())handleTarget('player-ship',u.uid);else toggleAttacker(u.uid);}}/>

        {/* Player compact status */}
        <div style={{display:'flex',alignItems:'center',gap:'10px',flexShrink:0,padding:'2px 4px'}}>
          <div style={{width:'32px',height:'32px',borderRadius:'50%',flexShrink:0,
            background:'linear-gradient(135deg,#0c4a6e,#075985)',
            border:'2px solid #0284c744',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',
            boxShadow:'0 0 14px #0284c722'}}>♦</div>
          <div style={{lineHeight:1}}>
            <div style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'22px',
              color:g.player.hp>12?'#38bdf8':g.player.hp>6?'#fbbf24':'#f43f5e',
              textShadow:`0 0 12px ${g.player.hp>12?'rgba(56,189,248,.5)':g.player.hp>6?'rgba(251,191,36,.5)':'rgba(244,63,94,.5)'}`}}>
              {g.player.hp}
            </div>
            <div style={{fontFamily:'Orbitron',fontSize:'6px',color:'#1e3a5f',letterSpacing:'2px'}}>HULL</div>
          </div>

          <CapBar core={g.player.core} max={g.player.maxCore}/>
        </div>

        {/* Hand */}
        <Hand cards={g.player.hand} selected={g.selectedCard} pendingUid={g.pendingDeploy?.uid}
          core={g.player.core} phase={g.phase} onSelect={selectCard} onActivate={activateCard}
          isPending={isPending} pendingDeploy={g.pendingDeploy}/>
      </div>
    </div>
  );
}

// ── EVE HEADER ────────────────────────────────────────────────────────────────
function EveHeader({label,hp,handCount,core,maxCore,isEnemy,isPlayer,turn,phaseLabel,isAiTurn,isTargetable,onTarget}) {
  const hpColor=hp>12?'#38bdf8':hp>6?'#fbbf24':'#f43f5e';
  return (
    <div style={{display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
      <div style={{width:'44px',height:'44px',borderRadius:'50%',flexShrink:0,
        background:isEnemy?'linear-gradient(135deg,#1e1b4b,#312e81)':'linear-gradient(135deg,#0c4a6e,#075985)',
        border:`2px solid ${isEnemy?'#4338ca44':'#0284c744'}`,
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',
        boxShadow:isEnemy?'0 0 18px #4338ca22':'0 0 18px #0284c722'}}>
        {isEnemy?'☠':'♦'}
      </div>
      <div style={{flex:1}}>
        <div style={{fontFamily:'Orbitron',fontSize:'8px',letterSpacing:'3px',color:'#334155',marginBottom:'3px'}}>{label}</div>
        <div onClick={isTargetable?onTarget:undefined} style={{cursor:isTargetable?'pointer':'default',display:'flex',alignItems:'center',gap:'8px',padding:isTargetable?'3px 6px':0,border:isTargetable?'1px solid #f43f5e55':'1px solid transparent',borderRadius:'6px',background:isTargetable?'rgba(244,63,94,.07)':'transparent',transition:'all .2s'}}>
          {isTargetable&&<span style={{fontFamily:'Orbitron',fontSize:'7px',color:'#f43f5e',letterSpacing:'2px'}}>🎯 TARGET POD</span>}

          <span style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'16px',color:hpColor,textShadow:`0 0 10px ${hpColor}`,minWidth:'32px',textAlign:'right'}}>{hp}</span>
        </div>
      </div>
      {isEnemy&&<div style={{textAlign:'center',padding:'4px 10px',background:'rgba(0,0,0,.4)',border:'1px solid #1e293b',borderRadius:'6px'}}>
        <div style={{fontFamily:'Share Tech Mono',fontSize:'16px',color:'#334155'}}>{handCount}</div>
        <div style={{fontFamily:'Orbitron',fontSize:'6px',color:'#1e293b',letterSpacing:'1px'}}>HAND</div>
      </div>}
      {isEnemy&&<div style={{textAlign:'center',padding:'4px 12px',background:isAiTurn?'rgba(244,63,94,.08)':'rgba(56,189,248,.05)',border:`1px solid ${isAiTurn?'#f43f5e44':'#38bdf833'}`,borderRadius:'6px',minWidth:'100px'}}>
        <div style={{fontFamily:'Orbitron',fontSize:'8px',letterSpacing:'2px',color:isAiTurn?'#f43f5e':'#38bdf8',...(isAiTurn?{animation:'aiPulse 1s infinite'}:{})}} className={isAiTurn?'ai-blink':''}>{isAiTurn?'ENEMY TURN':`TURN ${turn}`}</div>
        <div style={{fontFamily:'Orbitron',fontSize:'6px',color:'#1e293b',letterSpacing:'1px',marginTop:'2px'}}>{isAiTurn?'PROCESSING':phaseLabel==='player-play'?'DEPLOY':phaseLabel==='player-attack'?'ENGAGE':'ENDED'}</div>
      </div>}
      {isPlayer&&maxCore&&<CapBar core={core} max={maxCore}/>}
    </div>
  );
}

function CapBar({core,max}) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'3px',flexShrink:0}}>
      <div style={{display:'flex',gap:'3px',flexWrap:'wrap',justifyContent:'flex-end',maxWidth:'120px'}}>
        {Array.from({length:max},(_,i)=>(
          <div key={i} style={{width:'11px',height:'11px',borderRadius:'2px',
            background:i<core?'#fbbf24':'rgba(255,255,255,.05)',
            border:`1px solid ${i<core?'#fbbf24':'#1e293b'}`,
            boxShadow:i<core?'0 0 6px #fbbf2477':'none',transition:'all .22s'}}/>
        ))}
      </div>
      <div style={{fontFamily:'Orbitron',fontSize:'7px',color:'#fbbf24',letterSpacing:'2px'}}>CAP {core}/{max}</div>
    </div>
  );
}

// ── BATTLE ROW ────────────────────────────────────────────────────────────────
function BattleRow({label,ships,isPlayer,isFront,attackers=[],canTarget,canAttack,onShipClick}) {
  const playerColor=isPlayer?'rgba(56,189,248,':'rgba(244,63,94,';
  return (
    <div style={{flex:1,display:'flex',gap:'8px',alignItems:'center',
      background:`${playerColor}${isFront?'.07)':'.04)'}`,
      border:`1px solid ${playerColor}${isFront?'.15)':'.08)'}`,
      borderRadius:'8px',padding:'6px 10px 6px 6px',position:'relative',minHeight:0}}>
      <div style={{fontFamily:'Orbitron',fontSize:'6px',letterSpacing:'3px',writingMode:'vertical-rl',
        transform:'rotate(180deg)',color:`${playerColor}${isFront?'.4)':'.22)'}`,flexShrink:0,marginRight:'2px'}}>
        {label}
      </div>
      <div style={{flex:1,display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',justifyContent:'center'}}>
        {ships.length===0&&<div style={{fontFamily:'Orbitron',fontSize:'7px',letterSpacing:'3px',color:`${playerColor}.1)`}}>
          {isPlayer?'NO SHIPS DEPLOYED':'ZONE CLEAR'}
        </div>}
        {ships.map(unit=>{
          const isAtk=attackers.includes(unit.uid);
          const bc=isAtk?'#fb923c':canTarget?'#fbbf24':unit.color;
          const selectable=canTarget||(canAttack?.(unit));
          return (
            <div key={unit.uid}
              className={`unit-glow ${unit.justPlayed?'unit-deploy':''}`}
              onClick={selectable?()=>onShipClick(unit):undefined}
              style={{'--gc':`${unit.color}55`,
                width:'78px',minHeight:isFront?'96px':'82px',
                background:`linear-gradient(175deg,rgba(10,18,38,.96),rgba(10,18,38,.85),${unit.color}1a)`,
                border:`2px solid ${bc}${isAtk||canTarget?'cc':'55'}`,
                borderRadius:'10px',padding:'6px 5px 5px',textAlign:'center',position:'relative',
                opacity:unit.tapped?.48:1,
                transform:unit.tapped?'rotate(11deg)':isAtk?'translateY(-5px)':'none',
                transition:'opacity .28s,transform .28s',cursor:selectable?'pointer':'default',
                boxShadow:isAtk?`0 0 20px ${unit.color}55,0 6px 18px rgba(0,0,0,.5)`:canTarget?'0 0 16px #fbbf2455':'0 3px 10px rgba(0,0,0,.5)',
              }}>
              {isAtk&&<div style={{position:'absolute',top:'-13px',left:'50%',transform:'translateX(-50%)',fontFamily:'Orbitron',fontSize:'5.5px',color:'#fb923c',whiteSpace:'nowrap',textShadow:'0 0 8px #fb923c'}}>⚔ ATTACKING</div>}
              {canTarget&&<div style={{position:'absolute',top:'-13px',left:'50%',transform:'translateX(-50%)',fontFamily:'Orbitron',fontSize:'5.5px',color:'#fbbf24',whiteSpace:'nowrap'}}>🎯 CLICK</div>}
              {unit.stunned&&<div style={{position:'absolute',top:'3px',right:'3px',fontFamily:'Orbitron',fontSize:'7px',color:'#c084fc'}}>🕸️</div>}
              {/* SVG silhouette background */}
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',opacity:.18,pointerEvents:'none',overflow:'hidden',borderRadius:'9px'}}>
                <ShipSVG id={unit.id} color={unit.color} size={isFront?62:52}/>
              </div>
              <div style={{position:'relative',zIndex:1}}>
                <div style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'7.5px',color:'#f1f5f9',lineHeight:1.2,marginBottom:'2px'}}>{unit.name}</div>
                {unit.faction&&<div style={{fontFamily:'Share Tech Mono',fontSize:'7px',color:`${unit.color}99`,marginBottom:'4px'}}>{unit.faction}</div>}
                {unit.ability==='ranged'&&<div style={{fontFamily:'Orbitron',fontSize:'5.5px',color:unit.color,background:`${unit.color}22`,borderRadius:'3px',padding:'1px 4px',marginBottom:'4px',letterSpacing:'1px',display:'inline-block'}}>RANGED</div>}
                <div style={{display:'flex',justifyContent:'space-between',padding:'3px 4px',background:'rgba(0,0,0,.5)',borderRadius:'5px',border:'1px solid rgba(255,255,255,.06)'}}>
                  <div style={{textAlign:'center',flex:1}}>
                    <div style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'13px',color:'#fb923c',lineHeight:1}}>{unit.atk}</div>
                    <div style={{fontFamily:'Orbitron',fontSize:'5px',color:'#fb923c55',letterSpacing:'1px'}}>ATK</div>
                  </div>
                  <div style={{width:'1px',background:'rgba(255,255,255,.07)'}}/>
                  <div style={{textAlign:'center',flex:1}}>
                    <div style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'13px',color:'#38bdf8',lineHeight:1}}>{unit.currentHp}</div>
                    <div style={{fontFamily:'Orbitron',fontSize:'5px',color:'#38bdf855',letterSpacing:'1px'}}>HP</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ACTION BAR ────────────────────────────────────────────────────────────────
function ActionBar({phase,isPending,pendingName,isTargeting,targetName,attackerCount,isAiTurn,
  selectedCard,onAttack,onResolve,onEndTurn,onFront,onBack,onCancelDeploy,onCancelTarget,onUseModule,onCancelSelect}) {
  const isShipSelected = selectedCard?.type==='ship';
  const isModuleSelected = selectedCard?.type==='module';
  const hasSelection = !!selectedCard;
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
      padding:'6px 14px',background:'rgba(6,13,26,.9)',
      border:'1px solid rgba(255,255,255,.06)',borderRadius:'8px',
      backdropFilter:'blur(12px)',flexShrink:0,minHeight:'54px',flexWrap:'wrap'}}>
      {/* Ship selected — show row picker */}
      {isShipSelected&&!isPending&&!isTargeting&&phase==='player-play'&&<>
        <span style={{fontFamily:'Orbitron',fontSize:'9px',color:'#60a5fa',letterSpacing:'1px'}}>
          DEPLOY <b style={{color:selectedCard.color}}>{selectedCard.name}</b>
          {selectedCard.ability!=='ranged'&&<span style={{color:'#334155'}}> — front line only</span>}
        </span>
        <Btn label="▲ FRONT LINE" color="#38bdf8" onClick={onFront}/>
        {selectedCard?.ability==='ranged'&&<Btn label="▼ BACK ROW" color="#34d399" onClick={onBack}/>}
        <Btn label="✕" color="#64748b" onClick={onCancelSelect} small/>
      </>}
      {/* Module selected — show use button */}
      {isModuleSelected&&!isPending&&!isTargeting&&phase==='player-play'&&<>
        <span style={{fontFamily:'Orbitron',fontSize:'9px',color:'#60a5fa',letterSpacing:'1px'}}>
          ACTIVATE <b style={{color:selectedCard.color}}>{selectedCard.name}</b>?
        </span>
        <Btn label={`⚡ USE — ${selectedCard.name}`} color={selectedCard.color} onClick={onUseModule}/>
        <Btn label="✕" color="#64748b" onClick={onCancelSelect} small/>
      </>}
      {/* Pending deploy (from old flow, kept as fallback) */}
      {isPending&&!isShipSelected&&<>
        <span style={{fontFamily:'Orbitron',fontSize:'9px',color:'#60a5fa',letterSpacing:'1px'}}>DEPLOY <b style={{color:'#f1f5f9'}}>{pendingName}</b> TO ROW:</span>
        <Btn label="▲ FRONT LINE" color="#38bdf8" onClick={onFront}/>
        {selectedCard?.ability==='ranged'&&<Btn label="▼ BACK ROW" color="#34d399" onClick={onBack}/>}
        <Btn label="✕" color="#64748b" onClick={onCancelDeploy} small/>
      </>}
      {isTargeting&&<>
        <span style={{fontFamily:'Orbitron',fontSize:'9px',color:'#fbbf24',letterSpacing:'1px'}}>🎯 {targetName} — CLICK A TARGET ON THE BOARD ABOVE</span>
        <Btn label="✕ CANCEL" color="#64748b" onClick={onCancelTarget} small/>
      </>}
      {!hasSelection&&!isPending&&!isTargeting&&<>
        {phase==='player-play'&&<><Btn label="⚔ ENGAGE PHASE" color="#fb923c" onClick={onAttack}/><span style={{fontFamily:'Share Tech Mono',fontSize:'10px',color:'#1e293b'}}>Click a card below to select it</span></>}
        {phase==='player-attack'&&<><Btn label={`✓ RESOLVE${attackerCount?` (${attackerCount})`:''}`} color="#fb923c" onClick={onResolve} active={attackerCount>0}/><span style={{fontFamily:'Share Tech Mono',fontSize:'10px',color:'#1e293b'}}>Click your ships to declare attackers</span></>}
        {isAiTurn&&<span style={{fontFamily:'Orbitron',fontSize:'9px',color:'#f43f5e',letterSpacing:'3px'}} className="ai-blink">⟳ ENEMY FLEET ACTIVE...</span>}
        <Btn label="END TURN ▶" color="#38bdf8" disabled={phase==='ai-turn'||phase==='game-over'} onClick={onEndTurn}/>
      </>}
    </div>
  );
}

function Btn({label,color,disabled,onClick,active,small}){
  return (<button onClick={onClick} disabled={disabled} className="btn" style={{background:active?`${color}22`:'rgba(255,255,255,.04)',border:`1px solid ${disabled?'rgba(255,255,255,.05)':active?color:color+'55'}`,color:disabled?'#1e293b':color,padding:small?'5px 10px':'7px 14px',fontFamily:'Orbitron',fontSize:small?'7px':'8px',letterSpacing:'2px',borderRadius:'6px',flexShrink:0,boxShadow:active?`0 0 14px ${color}55`:'',textShadow:disabled?'none':`0 0 8px ${color}55`}}>{label}</button>);
}

// ── HAND ──────────────────────────────────────────────────────────────────────
function Hand({cards,selected,pendingUid,core,phase,onSelect,onActivate}) {
  const canPlay = phase==='player-play';
  return (
    <div style={{display:'flex',gap:'6px',justifyContent:'center',alignItems:'flex-end',
      padding:'2px 0 3px',flexShrink:0,overflowX:'auto',minHeight:'128px',
      overflowY:'visible',position:'relative'}}>
      {cards.length===0&&<div style={{fontFamily:'Orbitron',fontSize:'9px',letterSpacing:'3px',color:'#0f172a',margin:'auto'}}>RESERVE EMPTY</div>}
      {cards.map((card,i)=>{
        const isPend=pendingUid===card.uid;
        const isSel=selected===card.uid||isPend;
        const affordable=card.cost<=core&&canPlay;
        const ci=i-Math.floor(cards.length/2);
        return (
          <div key={card.uid} style={{position:'relative',flexShrink:0,zIndex:isSel?50:20-Math.abs(ci)}}>
            {/* No popup — actions live in the action bar for reliable clicking */}
            {/* CARD */}
            <div className="card-hand"
              onClick={()=>isSel?null:onSelect(card.uid)}
              style={{width:'96px',minHeight:'132px',
                background:`linear-gradient(175deg,#0d1629,#080e1c,${card.color}1e)`,
                border:`2px solid ${isSel?card.color:affordable?card.color+'44':'#1e293b'}`,
                borderRadius:'11px',padding:'7px 5px 6px',textAlign:'center',position:'relative',
                transform:isSel?`translateY(-22px) rotate(0deg)`:`translateY(${Math.abs(ci)*1.5}px) rotate(${ci*2.2}deg)`,
                boxShadow:isSel?`0 0 28px ${card.color}77,0 0 60px ${card.color}22,0 -10px 28px ${card.color}33`
                  :affordable?`0 0 10px ${card.color}22,0 4px 14px rgba(0,0,0,.6)`:'0 4px 10px rgba(0,0,0,.5)',
                opacity:!affordable&&!isSel?.3:1,
                transition:'transform .14s,box-shadow .14s,opacity .14s',
                cursor:isSel?'default':'pointer',
              }}>
              {/* Cost badge */}
              <div style={{position:'absolute',top:'-9px',right:'-9px',width:'24px',height:'24px',borderRadius:'50%',
                background:affordable?card.color:'#1e293b',border:`2px solid ${affordable?'rgba(255,255,255,.3)':'#0f172a'}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontFamily:'Orbitron',fontWeight:700,fontSize:'11px',
                color:affordable?'#0f172a':'#334155',
                boxShadow:affordable?`0 0 10px ${card.color}88`:'',zIndex:2}}>
                {card.cost}
              </div>
              {/* Faction/type dot */}
              <div style={{position:'absolute',top:'5px',left:'5px',width:'6px',height:'6px',
                borderRadius:'50%',background:card.color,boxShadow:`0 0 8px ${card.color}`,zIndex:2}}/>

              {/* Art area: pixel art + SVG silhouette */}
              <div style={{position:'relative',width:'100%',height:'54px',
                display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'4px',overflow:'hidden'}}>
                {/* SVG background silhouette */}
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',opacity:.45}}>
                  <ShipSVG id={card.id} color={card.color} size={50}/>
                </div>
                {/* Pixel art portrait */}
                <div style={{position:'relative',zIndex:1,filter:`drop-shadow(0 0 4px ${card.color})`}}>
                  <PixelArt cardId={card.id} color={card.color} px={5}/>
                </div>
              </div>

              <div style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'9px',color:'#f1f5f9',lineHeight:1.2,marginBottom:'1px'}}>{card.name}</div>
              {card.faction&&<div style={{fontFamily:'Share Tech Mono',fontSize:'7px',color:`${card.color}99`,marginBottom:'3px'}}>{card.faction}</div>}
              {card.type==='ship'&&(
                <div style={{display:'flex',justifyContent:'space-between',padding:'2px 4px',
                  background:'rgba(0,0,0,.55)',borderRadius:'5px',border:'1px solid rgba(255,255,255,.05)',marginBottom:'3px'}}>
                  <span style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'13px',color:'#fb923c'}}>{card.atk}</span>
                  <span style={{fontFamily:'Orbitron',fontSize:'8px',color:'#334155',alignSelf:'center'}}>·</span>
                  <span style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'13px',color:'#38bdf8'}}>{card.def}</span>
                </div>
              )}
              <div style={{fontFamily:'Share Tech Mono',fontSize:'7px',color:'#1e3a5f',lineHeight:1.35}}>{card.effect}</div>
              {affordable&&!isSel&&<div style={{position:'absolute',bottom:'-13px',left:'50%',transform:'translateX(-50%)',fontFamily:'Orbitron',fontSize:'6px',color:card.color,whiteSpace:'nowrap',opacity:.7,pointerEvents:'none'}}>▲ SELECT</div>}
              {isSel&&affordable&&<div style={{position:'absolute',bottom:'-13px',left:'50%',transform:'translateX(-50%)',fontFamily:'Orbitron',fontSize:'6px',color:'#f1f5f9',whiteSpace:'nowrap',fontWeight:'bold',pointerEvents:'none'}}>↑ CHOOSE ROW ABOVE</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── INTRO ─────────────────────────────────────────────────────────────────────
function Intro({onStart}) {
  const factions=[
    {name:'CALDARI',color:'#38bdf8',ships:'Merlin · Caracal · Drake · Raven',style:'Missiles & back-row fire support'},
    {name:'AMARR',color:'#fbbf24',ships:'Punisher · Revelation',style:'Armor tanking & Doomsday devastation'},
    {name:'MINMATAR',color:'#fb923c',ships:'Rifter · Stiletto · Tempest',style:'Speed, nullifiers & artillery burst'},
    {name:'GALLENTE',color:'#4ade80',ships:'Vexor · Ishtar · Dominix',style:'Drone swarms & lifesteal sustained damage'},
  ];
  return (
    <div style={{width:'100vw',height:'100vh',background:'#030712',display:'flex',alignItems:'center',justifyContent:'center',overflow:'auto',padding:'20px'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Orbitron:wght@700;900&family=Share+Tech+Mono&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{maxWidth:'600px',width:'100%',textAlign:'center'}}>
        <div style={{fontFamily:'Orbitron',fontSize:'9px',letterSpacing:'7px',color:'#1e3a8a',marginBottom:'8px'}}>CAPSULEER BRIEFING</div>
        <div style={{fontFamily:'Orbitron',fontWeight:900,fontSize:'36px',letterSpacing:'5px',
          background:'linear-gradient(135deg,#38bdf8,#6366f1,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:'4px'}}>
          NEW EDEN
        </div>
        <div style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'13px',letterSpacing:'8px',color:'#1e3a8a',marginBottom:'28px'}}>PROTOCOL</div>

        {/* Factions */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'20px',textAlign:'left'}}>
          {factions.map(f=>(
            <div key={f.name} style={{padding:'10px 12px',background:'rgba(255,255,255,.02)',border:`1px solid ${f.color}33`,borderLeft:`3px solid ${f.color}`,borderRadius:'6px'}}>
              <div style={{fontFamily:'Orbitron',fontSize:'9px',color:f.color,letterSpacing:'2px',marginBottom:'4px'}}>{f.name}</div>
              <div style={{fontFamily:'Share Tech Mono',fontSize:'9px',color:'#334155',marginBottom:'3px'}}>{f.ships}</div>
              <div style={{fontFamily:'Share Tech Mono',fontSize:'8px',color:'#1e293b'}}>{f.style}</div>
            </div>
          ))}
        </div>

        {/* Rules */}
        <div style={{display:'flex',flexDirection:'column',gap:'5px',marginBottom:'24px',textAlign:'left'}}>
          {[
            {k:'FRONT LINE',c:'#fb923c',v:'Ships here block attackers. All ships can attack from front.'},
            {k:'BACK ROW',c:'#34d399',v:'Safe from direct attack. Only RANGED ships (Caracal, Drake) can fire from here.'},
            {k:'NULLIFIER',c:'#c084fc',v:'Stiletto bypasses all rows — hits the enemy pod directly.'},
            {k:'DOOMSDAY',c:'#f97316',v:"Revelation's excess combat damage bleeds through to the enemy pod."},
            {k:'DRONES',c:'#4ade80',v:'Vexor spawns 1 Drone (1/1), Dominix spawns 2. Drones appear on your front line.'},
            {k:'BURST',c:'#dc2626',v:"Tempest deals DOUBLE damage on its first attack ever."},
            {k:'VOLLEY',c:'#0369a1',v:'Raven hits all enemy ships for 1 on top of normal combat damage.'},
            {k:'LIFESTEAL',c:'#22c55e',v:'Ishtar heals 1 HP back to itself after each attack it survives.'},
          ].map(({k,c,v})=>(
            <div key={k} style={{display:'flex',gap:'10px',padding:'5px 10px',background:'rgba(255,255,255,.015)',border:'1px solid rgba(255,255,255,.04)',borderRadius:'6px',alignItems:'flex-start'}}>
              <div style={{fontFamily:'Orbitron',fontSize:'7.5px',color:c,minWidth:'78px',flexShrink:0,paddingTop:'2px',letterSpacing:'1px'}}>{k}</div>
              <div style={{fontFamily:'Share Tech Mono',fontSize:'10px',color:'#475569',lineHeight:1.5}}>{v}</div>
            </div>
          ))}
        </div>

        <button onClick={onStart} style={{background:'rgba(56,189,248,.08)',border:'2px solid #38bdf855',color:'#38bdf8',
          padding:'14px 48px',fontFamily:'Orbitron',fontWeight:700,fontSize:'13px',letterSpacing:'5px',
          cursor:'pointer',borderRadius:'8px',boxShadow:'0 0 30px #38bdf822',
          textShadow:'0 0 12px #38bdf8',transition:'all .2s'}}>
          ⟶ WARP IN
        </button>
        <div style={{fontFamily:'Share Tech Mono',fontSize:'9px',color:'#0f172a',marginTop:'10px'}}>
          No API key needed · 20 unique cards · 4 factions
        </div>
      </div>
    </div>
  );
}

// ── GAME OVER ─────────────────────────────────────────────────────────────────
function GameOver({winner,onReset}) {
  const won=winner==='player';
  return (
    <div style={{width:'100vw',height:'100vh',background:'rgba(3,7,18,.97)',
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'Orbitron'}}>
      <div style={{fontSize:'64px',marginBottom:'14px'}}>{won?'🏆':'💀'}</div>
      <div style={{fontSize:'10px',letterSpacing:'8px',color:won?'#38bdf8':'#f43f5e',marginBottom:'6px'}}>{won?'GF IN LOCAL':'PODDED'}</div>
      <div style={{fontSize:'38px',fontWeight:900,letterSpacing:'5px',
        background:won?'linear-gradient(135deg,#38bdf8,#7dd3fc)':'linear-gradient(135deg,#f43f5e,#fb7185)',
        WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:'10px'}}>
        {won?'VICTORY':'DEFEAT'}
      </div>
      <div style={{fontFamily:'Share Tech Mono',fontSize:'12px',color:'#334155',marginBottom:'32px'}}>
        {won?'Sovereignty secured. Clone contract expired.':'Pod express activated. New clone ready.'}
      </div>
      <button onClick={onReset} style={{background:'rgba(56,189,248,.08)',border:'2px solid #38bdf855',color:'#38bdf8',
        padding:'13px 38px',fontFamily:'Orbitron',fontSize:'10px',letterSpacing:'4px',
        cursor:'pointer',borderRadius:'8px',boxShadow:'0 0 24px #38bdf822',textShadow:'0 0 10px #38bdf8'}}>
        ↺ RESHIP &amp; REDOCK
      </button>
    </div>
  );
}
