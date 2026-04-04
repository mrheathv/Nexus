import { useState, useEffect, useRef, useCallback } from "react";

// ── CARD DEFINITIONS — EVE ONLINE THEMED ─────────────────────────────────────
const CARDS = [
  { id:'merlin',     name:'Merlin',           cost:1, type:'ship',   atk:1, def:1, effect:'Afterburner — engages immediately on deployment.',    color:'#00ccff', icon:'🚀', ability:'haste',       faction:'Caldari'  },
  { id:'punisher',   name:'Punisher',          cost:2, type:'ship',   atk:2, def:3, effect:'Armor Plates — heavily tanked Amarr frigate.',         color:'#ffaa22', icon:'🛡️', ability:null,          faction:'Amarr'    },
  { id:'stiletto',   name:'Stiletto',          cost:3, type:'ship',   atk:3, def:2, effect:'Interdiction Nullifier — cannot be caught or blocked.',color:'#cc44ff', icon:'👻', ability:'unblockable', faction:'Minmatar' },
  { id:'drake',      name:'Drake',             cost:2, type:'ship',   atk:2, def:2, effect:'Missile Salvo — damages enemy ship on warp-in.',       color:'#33ddaa', icon:'🕷️', ability:'zap',         faction:'Caldari'  },
  { id:'revelation', name:'Revelation',        cost:5, type:'ship',   atk:5, def:5, effect:'Doomsday Device — excess damage bleeds through.',      color:'#ff6633', icon:'🦾', ability:'crush',       faction:'Amarr'    },
  { id:'disruptor',  name:'Warp Disruptor',    cost:2, type:'module',             effect:'Point a target — deal 3 damage to any ship or pilot.',  color:'#ff3355', icon:'⚡', ability:'damage3'      },
  { id:'analyzer',   name:'Data Analyzer',     cost:1, type:'module',             effect:'Hack the grid — draw 2 cards from your reserves.',      color:'#44bbff', icon:'📡', ability:'draw2'        },
  { id:'smartbomb',  name:'Smartbomb',         cost:3, type:'module',             effect:'Area pulse — destroy any one enemy ship.',              color:'#ffaa00', icon:'💥', ability:'destroy'      },
  { id:'drone_link', name:'Drone Link Amp',    cost:2, type:'module',             effect:'Augment a friendly ship +2 ATK and +2 shield.',         color:'#88ff44', icon:'🧬', ability:'buff'         },
  { id:'cap_booster',name:'Cap Booster',       cost:0, type:'module',             effect:'Inject capacitor charges — gain 3 extra cap this turn.',color:'#ffdd44', icon:'🔋', ability:'coresurge'    },
];

const FACTION_COLORS = { Caldari:'#00ccff', Amarr:'#ffaa22', Minmatar:'#cc4422', Gallente:'#44cc66' };

// ── UTILITIES ─────────────────────────────────────────────────────────────────
let _uid = 1;
const uid  = () => _uid++;
const shuffle = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]} return b; };
const buildDeck = () => shuffle([...CARDS,...CARDS,...CARDS].map(c=>({...c,uid:uid()})));
const drawN = (g, owner, n) => {
  const deck=[...g[owner].deck], hand=[...g[owner].hand];
  for(let i=0;i<n&&deck.length;i++) hand.push(deck.shift());
  return {...g,[owner]:{...g[owner],deck,hand}};
};
const addLog = (g, msg) => ({...g, log:[msg,...g.log].slice(0,30)});
const checkWinner = g => {
  if(g.player.hp<=0) return {...g,winner:'ai',phase:'game-over'};
  if(g.ai.hp<=0)     return {...g,winner:'player',phase:'game-over'};
  return g;
};

// ── BACKGROUND CONSTANTS ──────────────────────────────────────────────────────
const STARS = Array.from({length:70},(_,i)=>({
  left:`${(i*37+13)%100}%`, top:`${(i*53+7)%100}%`,
  w:(i%4)*.6+.2, delay:(i%6)*.7, dur:2+(i%5)*.8
}));
const NEBULAE = [
  {x:'5%',  y:'10%', w:'420px', h:'260px', color:'#1133aa', op:0.055, dur:'22s', delay:'0s'  },
  {x:'62%', y:'50%', w:'350px', h:'400px', color:'#003366', op:0.045, dur:'28s', delay:'-9s' },
  {x:'70%', y:'2%',  w:'280px', h:'260px', color:'#220066', op:0.04,  dur:'18s', delay:'-4s' },
  {x:'20%', y:'68%', w:'340px', h:'220px', color:'#004422', op:0.035, dur:'32s', delay:'-14s'},
  {x:'40%', y:'25%', w:'220px', h:'220px', color:'#552200', op:0.03,  dur:'24s', delay:'-7s' },
];

// ── OPENAI NARRATIVE ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a Scope News Network correspondent embedded in a capsuleer engagement in New Eden. Report combat events as breaking field dispatches.

When given a game event, write EXACTLY 2 sentences in the style of EVE Online lore broadcasts. Requirements:
- Second person ("your", "you") addressing the capsuleer
- Reference the specific ship or module by its exact EVE Online name
- Use EVE terminology: capsuleer, pod, New Eden, CONCORD, warp, grid, local, shields, armor, hull
- Tone: cold, clinical, terse — like a Scope News ticker mixed with in-game combat logs
- Never use the word "battle" or "epic"
- Each dispatch should feel like a CONCORD after-action report fragment`;

async function fetchNarrative(apiKey, event, context) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},
      body: JSON.stringify({
        model:"gpt-4o-mini", max_tokens:110, temperature:0.85,
        messages:[
          {role:"system", content:SYSTEM_PROMPT},
          {role:"user", content:`COMBAT EVENT: ${event}\n\nSITUATION: Turn ${context.turn}. Your hull integrity: ${context.playerHp}/20. Enemy integrity: ${context.aiHp}/20. Your grid: ${context.playerField||'empty'}. Enemy grid: ${context.aiField||'empty'}.`}
        ]
      })
    });
    const data = await res.json();
    if(data.error) return `[SCOPE FEED ERROR: ${data.error.message}]`;
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch(e) { return `[COMMS JAMMED: ${e.message}]`; }
}

// ── AI OPPONENT ───────────────────────────────────────────────────────────────
function aiPlay(g) {
  let hand=[...g.ai.hand],field=[...g.ai.field],pField=[...g.player.field],pHp=g.player.hp,core=g.ai.core;
  const logs=[],events=[];
  for(const card of [...hand].filter(c=>c.cost<=core).sort((a,b)=>b.cost-a.cost)) {
    if(card.cost>core) continue;
    core-=card.cost; hand=hand.filter(c=>c.uid!==card.uid);
    if(card.type==='ship') {
      const unit={...card,currentHp:card.def,tapped:false,justPlayed:true};
      if(card.ability==='zap'&&pField.length){
        const t=pField.reduce((a,b)=>a.currentHp<b.currentHp?a:b);
        pField=pField.map(u=>u.uid===t.uid?{...u,currentHp:u.currentHp-1}:u).filter(u=>u.currentHp>0);
        logs.push(`🚀 ${card.name} missile salvo hits ${t.name}!`);
        events.push(`Enemy ${card.name} dropped out of warp and immediately launched missiles into your ${t.name}.`);
      } else { logs.push(`🚀 Enemy deployed ${card.name}.`); events.push(`An enemy ${card.name} has entered the grid.`); }
      field.push(unit);
    } else {
      switch(card.ability){
        case 'draw2': logs.push(`📡 Enemy used Data Analyzer.`); events.push(`Enemy capsuleer ran a Data Analyzer on the local beacon, pulling two additional modules from reserves.`); break;
        case 'coresurge': core+=3; logs.push(`🔋 Enemy Cap Booster +3.`); events.push(`Enemy injected capacitor charges. Their systems are running hot.`); break;
        case 'damage3':
          if(pField.length){const t=pField.reduce((a,b)=>a.currentHp<b.currentHp?a:b);const hp=t.currentHp-3;pField=pField.map(u=>u.uid===t.uid?{...u,currentHp:hp}:u).filter(u=>u.currentHp>0);logs.push(`⚡ Warp Disruptor → ${t.name} -3`);events.push(`Enemy Warp Disruptor locked your ${t.name}${hp<=0?' and tore through its hull':' for 3 damage'}. CONCORD has logged the engagement.`);}
          else{pHp-=3;logs.push(`⚡ Warp Disruptor → your hull -3`);events.push(`The enemy Warp Disruptor bypassed your fleet and hit your pod directly for 3 damage.`);}
          break;
        case 'destroy':
          if(pField.length){const t=pField.reduce((a,b)=>a.atk>b.atk?a:b);pField=pField.filter(u=>u.uid!==t.uid);logs.push(`💥 Smartbomb → ${t.name} destroyed`);events.push(`Enemy Smartbomb detonated. Your ${t.name} is a wreck field. Pod is away.`);}
          break;
        case 'buff':
          if(field.length){const t=field.reduce((a,b)=>a.atk>b.atk?a:b);field=field.map(u=>u.uid===t.uid?{...u,atk:u.atk+2,currentHp:u.currentHp+2}:u);logs.push(`🧬 Drone Link → ${t.name} +2/+2`);events.push(`Enemy Drone Link Amplifier brought ${t.name} to full combat readiness. Threat level elevated.`);}
          break;
      }
    }
  }
  return {state:{...g,ai:{...g.ai,hand,field,core},player:{...g.player,field:pField,hp:pHp}},logs,events};
}

function aiAttack(g) {
  const atkers=g.ai.field.filter(u=>!u.tapped&&(u.ability==='haste'||!u.justPlayed));
  if(!atkers.length) return {state:g,logs:[],events:[]};
  const logs=[`🎯 Enemy fleet engaging: ${atkers.map(u=>u.name).join(', ')}`], events=[];
  let aiField=[...g.ai.field],pField=[...g.player.field],pHp=g.player.hp;
  aiField=aiField.map(u=>atkers.find(a=>a.uid===u.uid)?{...u,tapped:true}:u);
  const used=new Set();
  for(const atk of atkers){
    if(atk.ability==='unblockable'){pHp-=atk.atk;logs.push(`👻 ${atk.name} nullified interdiction — ${atk.atk} dmg`);events.push(`Enemy ${atk.name} burned through with its Interdiction Nullifier active. ${atk.atk} damage applied directly to your hull.`);continue;}
    const blocker=pField.find(u=>!used.has(u.uid));
    if(blocker){
      used.add(blocker.uid);
      const ah=atk.currentHp-blocker.atk,bh=blocker.currentHp-atk.atk;
      if(ah<=0){aiField=aiField.filter(u=>u.uid!==atk.uid);events.push(`Your ${blocker.name} held tackle on enemy ${atk.name} until its hull gave out. Enemy ship destroyed.`);}
      else aiField=aiField.map(u=>u.uid===atk.uid?{...u,currentHp:ah}:u);
      if(bh<=0){if(atk.ability==='crush'&&bh<0){pHp+=bh;events.push(`Enemy ${atk.name} fired its Doomsday Device. Your ${blocker.name} is gone and ${Math.abs(bh)} overflow hit your pod.`);}
      else events.push(`Enemy ${atk.name} destroyed your ${blocker.name}. Insurance has been notified.`);
      pField=pField.filter(u=>u.uid!==blocker.uid);}
      else pField=pField.map(u=>u.uid===blocker.uid?{...u,currentHp:bh}:u);
    } else {pHp-=atk.atk;logs.push(`💥 ${atk.name} hits your hull for ${atk.atk}`);events.push(`Enemy ${atk.name} broke through with no defenders in range. ${atk.atk} hull damage applied.`);}
  }
  return {state:{...g,ai:{...g.ai,field:aiField},player:{...g.player,field:pField,hp:pHp}},logs,events};
}

function runAiTurn(s) {
  let g={...s};
  g=drawN(g,'ai',1);
  const newMax=Math.min(10,g.ai.maxCore+1);
  g={...g,ai:{...g.ai,maxCore:newMax,core:newMax,field:g.ai.field.map(u=>({...u,tapped:false,justPlayed:false}))}};
  const {state:s2,logs:l1,events:e1}=aiPlay(g); g=s2;
  const {state:s3,logs:l2,events:e2}=aiAttack(g); g=s3;
  for(const l of [...l1,...l2]) g=addLog(g,l);
  g=checkWinner(g);
  if(g.phase!=='game-over'){
    const t=g.turn+1,pm=Math.min(10,g.player.maxCore+1);
    g=drawN(g,'player',1);
    g={...g,phase:'player-play',turn:t,aiThinking:false,attackers:[],selectedCard:null,
      player:{...g.player,maxCore:pm,core:pm,field:g.player.field.map(u=>({...u,tapped:false,justPlayed:false}))}};
    g=addLog(g,`📻 Turn ${t} — your orders, capsuleer.`);
  } else g={...g,aiThinking:false};
  return {newState:g, events:[...e1,...e2]};
}

function initGame() {
  let s={
    phase:'player-play',turn:1,winner:null,aiThinking:false,
    selectedCard:null,attackers:[],targeting:null,
    log:['📻 NEW EDEN PROTOCOL online.','Deploy ships, then ENGAGE or END TURN.'],
    player:{hp:20,core:1,maxCore:1,deck:buildDeck(),hand:[],field:[]},
    ai:    {hp:20,core:1,maxCore:1,deck:buildDeck(),hand:[],field:[]},
  };
  s=drawN(s,'player',5); s=drawN(s,'ai',5);
  return s;
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [apiKey,     setApiKey]     = useState('');
  const [keyInput,   setKeyInput]   = useState('');
  const [keyError,   setKeyError]   = useState('');
  const [g,          setG]          = useState(null);
  const [story,      setStory]      = useState([]);
  const [narLoading, setNarLoading] = useState(false);
  const [particles,  setParticles]  = useState([]);
  const [screenFx,   setScreenFx]   = useState('');
  const [beams,      setBeams]      = useState([]);

  const storyRef      = useRef(null);
  const timerRef      = useRef(null);
  const queueRef      = useRef([]);
  const processingRef = useRef(false);
  const keyRef        = useRef('');
  // ── THE REAL FIX: a ref lock so React StrictMode double-invoke can't cancel the timer ──
  const aiLockRef     = useRef(false);

  // ── VISUAL HELPERS ────────────────────────────────────────────────────────
  const spawnParticles = useCallback((zone, color, count=12) => {
    const zones={hand:{x:50,y:87},playerField:{x:50,y:63},aiField:{x:50,y:33},center:{x:50,y:50}};
    const {x,y}=zones[zone]||zones.center;
    const ps=Array.from({length:count},(_,i)=>({
      id:uid(), x, y,
      angle:(i/count)*360+(Math.random()-.5)*22,
      dist:50+Math.random()*90,
      color, size:3+Math.random()*4,
      dur:0.5+Math.random()*0.45,
    }));
    setParticles(prev=>[...prev,...ps]);
    setTimeout(()=>setParticles(prev=>prev.filter(p=>!ps.find(n=>n.id===p.id))),1000);
  },[]);

  const triggerFx = useCallback((fx, duration=520)=>{
    setScreenFx(fx);
    setTimeout(()=>setScreenFx(''),duration);
  },[]);

  const triggerBeam = useCallback((color, fromPlayer=true)=>{
    const id=uid();
    setBeams(prev=>[...prev,{id,color,fromPlayer}]);
    setTimeout(()=>setBeams(prev=>prev.filter(b=>b.id!==id)),700);
  },[]);

  // ── NARRATIVE QUEUE ───────────────────────────────────────────────────────
  const processQueue = useCallback(async()=>{
    if(processingRef.current||!queueRef.current.length) return;
    processingRef.current=true;
    const {event,context}=queueRef.current.shift();
    setNarLoading(true);
    const text=await fetchNarrative(keyRef.current,event,context);
    if(text){
      setStory(prev=>[{text,turn:context.turn},...prev].slice(0,20));
      setTimeout(()=>storyRef.current?.scrollTo({top:0,behavior:'smooth'}),50);
    }
    setNarLoading(false);
    processingRef.current=false;
    if(queueRef.current.length) setTimeout(processQueue,400);
  },[]);

  const enqueueNarrative = useCallback((event,context)=>{
    queueRef.current.push({event,context});
    processQueue();
  },[processQueue]);

  // ── AI TURN EFFECT — FIXED ────────────────────────────────────────────────
  // Root cause of the stuck bug: aiThinking was in the dep array.
  // Setting aiThinking:true triggered cleanup which CANCELLED the timer.
  // Fix: use a ref lock, depend only on phase, never cancel mid-flight.
  useEffect(()=>{
    if(!g || g.phase!=='ai-turn') return;
    if(aiLockRef.current) return; // already processing
    aiLockRef.current = true;

    const capturedState = g;
    timerRef.current = setTimeout(()=>{
      try {
        const {newState, events} = runAiTurn(capturedState);
        const prevHp = capturedState.player.hp;
        const ctx = {
          turn:capturedState.turn, playerHp:capturedState.player.hp, aiHp:capturedState.ai.hp,
          playerField:capturedState.player.field.map(u=>u.name).join(', ')||'empty',
          aiField:capturedState.ai.field.map(u=>u.name).join(', ')||'empty',
        };
        setG(newState);
        aiLockRef.current = false;

        if(newState.player.hp < prevHp){
          const dmg=prevHp-newState.player.hp;
          triggerBeam(dmg>=3?'#ff3344':'#ff7733',false);
          setTimeout(()=>triggerFx(dmg>=3?'big-chroma':'chroma',dmg>=3?700:480),200);
          spawnParticles('playerField','#ff3344',dmg>=3?16:10);
        }
        if(newState.ai.field.length>capturedState.ai.field.length) spawnParticles('aiField','#0088ff',8);

        for(const ev of events) enqueueNarrative(ev, ctx);
        if(newState.winner) enqueueNarrative(
          newState.winner==='ai'
            ? 'Your pod has been destroyed. CONCORD has logged the loss. Clone activated.'
            : 'Enemy capsuleer has been podded. Sovereignty secured. GF in local.',
          {...ctx, playerHp:newState.player.hp, aiHp:newState.ai.hp}
        );
      } catch(err){
        console.error('AI turn error:',err);
        aiLockRef.current = false;
        setG(s=>({...s,phase:'player-play',aiThinking:false,turn:(s.turn||1)+1,player:{...s.player,core:s.player.maxCore}}));
      }
    }, 1600);

    // cleanup: only clear timer, do NOT reset aiLockRef (that would re-trigger)
    return () => clearTimeout(timerRef.current);
  }, [g?.phase]); // ← only phase in deps, NOT aiThinking

  // Reset lock when phase leaves ai-turn
  useEffect(()=>{
    if(g?.phase !== 'ai-turn') aiLockRef.current = false;
  },[g?.phase]);

  // ── ENV KEY AUTO-LOAD ─────────────────────────────────────────────────────
  useEffect(()=>{
    const envKey=import.meta.env.VITE_OPENAI_KEY;
    if(envKey&&!g){
      keyRef.current=envKey; setApiKey(envKey);
      setG(initGame()); setStory([]);
      enqueueNarrative('Capsuleer, your connection to the New Eden grid has been established. An enemy fleet has been detected in local.',{turn:1,playerHp:20,aiHp:20,playerField:'empty',aiField:'empty'});
    }
  },[]);

  const startGame=()=>{
    if(!keyInput.trim().startsWith('sk-')){setKeyError('Key should start with sk-');return;}
    setKeyError('');
    const key=keyInput.trim(); keyRef.current=key; setApiKey(key);
    setG(initGame()); setStory([]);
    enqueueNarrative('Capsuleer, your connection to the New Eden grid has been established. An enemy fleet has been detected in local.',{turn:1,playerHp:20,aiHp:20,playerField:'empty',aiField:'empty'});
  };

  const resetGame=()=>{
    setG(null);setStory([]);setApiKey('');setKeyInput('');
    keyRef.current='';processingRef.current=false;queueRef.current=[];
    setParticles([]);setScreenFx('');setBeams([]);
    aiLockRef.current=false;
  };

  // ── GAME ACTIONS ──────────────────────────────────────────────────────────
  const selectCard=cUid=>{
    if(!g||g.phase!=='player-play'||g.targeting) return;
    setG(s=>({...s,selectedCard:s.selectedCard===cUid?null:cUid}));
  };

  const playCard=cUid=>{
    if(!g) return;
    const card=g.player.hand.find(c=>c.uid===cUid);
    if(!card||card.cost>g.player.core) return;
    const ctx={turn:g.turn,playerHp:g.player.hp,aiHp:g.ai.hp,
      playerField:g.player.field.map(u=>u.name).join(',')||'empty',
      aiField:g.ai.field.map(u=>u.name).join(',')||'empty'};
    setG(s=>{
      if(s.phase!=='player-play') return s;
      const c=s.player.hand.find(x=>x.uid===cUid);
      if(!c||c.cost>s.player.core) return s;
      let ns={...s,selectedCard:null,player:{...s.player,core:s.player.core-c.cost,hand:s.player.hand.filter(x=>x.uid!==cUid)}};
      if(c.type==='ship'){
        const unit={...c,currentHp:c.def,tapped:c.ability!=='haste',justPlayed:c.ability!=='haste'};
        if(c.ability==='zap'&&ns.ai.field.length){
          const t=ns.ai.field.reduce((a,b)=>a.currentHp<b.currentHp?a:b);
          ns={...ns,ai:{...ns.ai,field:ns.ai.field.map(u=>u.uid===t.uid?{...u,currentHp:u.currentHp-1}:u).filter(u=>u.currentHp>0)}};
          ns=addLog(ns,`🚀 ${c.name} missile hits ${t.name}!`);
          setTimeout(()=>enqueueNarrative(`Your ${c.name} landed on grid and immediately volleyed missiles into enemy ${t.name}.`,ctx),0);
        } else {ns=addLog(ns,`🚀 ${c.name} on grid.`);setTimeout(()=>enqueueNarrative(`Your ${c.name} has landed on the engagement grid.`,ctx),0);}
        ns={...ns,player:{...ns.player,field:[...ns.player.field,unit]}};
      } else {
        if(['damage3','destroy','buff'].includes(c.ability)){ns={...ns,targeting:{ability:c.ability,name:c.name}};ns=addLog(ns,`🎯 ${c.name} — select a target.`);}
        else {
          if(c.ability==='draw2'){ns=drawN(ns,'player',2);ns=addLog(ns,'📡 Data Analyzer — +2 cards.');setTimeout(()=>enqueueNarrative(`Your Data Analyzer cracked the local beacon. Two reserve modules pulled from storage.`,ctx),0);}
          if(c.ability==='coresurge'){ns={...ns,player:{...ns.player,core:ns.player.core+3}};ns=addLog(ns,'🔋 Cap Booster — +3 cap!');setTimeout(()=>enqueueNarrative(`Capacitor charges injected. Your systems are running at peak efficiency.`,ctx),0);}
        }
      }
      return checkWinner(ns);
    });
    spawnParticles('hand', card.color, 14);
    if(card.type==='module') setTimeout(()=>triggerFx('chroma',450),80);
    if(card.ability==='haste') triggerBeam(card.color,true);
  };

  const handleTarget=(type,tUid)=>{
    if(!g?.targeting) return;
    const {ability,name}=g.targeting;
    const ctx={turn:g.turn,playerHp:g.player.hp,aiHp:g.ai.hp,
      playerField:g.player.field.map(u=>u.name).join(',')||'empty',
      aiField:g.ai.field.map(u=>u.name).join(',')||'empty'};
    setG(s=>{
      if(!s.targeting) return s;
      const {ability:ab,name:nm}=s.targeting;
      let ns={...s,targeting:null};
      if(ab==='damage3'){
        if(type==='ai-unit'){const t=ns.ai.field.find(u=>u.uid===tUid);if(!t)return s;const hp=t.currentHp-3;ns={...ns,ai:{...ns.ai,field:ns.ai.field.map(u=>u.uid===tUid?{...u,currentHp:hp}:u).filter(u=>u.currentHp>0)}};ns=addLog(ns,`⚡ ${nm} → ${t.name} -3${hp<=0?' (destroyed)':''}!`);setTimeout(()=>enqueueNarrative(`Your Warp Disruptor locked enemy ${t.name} and applied 3 damage${hp<=0?'. Ship destroyed, wreck on field':''}.`,ctx),0);}
        else if(type==='ai-player'){ns={...ns,ai:{...ns.ai,hp:ns.ai.hp-3}};ns=addLog(ns,'⚡ Disruptor → enemy pod -3!');setTimeout(()=>enqueueNarrative(`Your Warp Disruptor bypassed the enemy fleet and hit their pod directly for 3 hull damage.`,ctx),0);}
      } else if(ab==='destroy'&&type==='ai-unit'){const t=ns.ai.field.find(u=>u.uid===tUid);if(!t)return s;ns={...ns,ai:{...ns.ai,field:ns.ai.field.filter(u=>u.uid!==tUid)}};ns=addLog(ns,`💥 Smartbomb → ${t.name} gone!`);setTimeout(()=>enqueueNarrative(`Smartbomb detonated in range of enemy ${t.name}. Hull integrity reached zero. Pod is away.`,ctx),0);}
      else if(ab==='buff'&&type==='player-unit'){const t=ns.player.field.find(u=>u.uid===tUid);if(!t)return s;ns={...ns,player:{...ns.player,field:ns.player.field.map(u=>u.uid===tUid?{...u,atk:u.atk+2,currentHp:u.currentHp+2}:u)}};ns=addLog(ns,`🧬 Drone Link → ${t.name} +2/+2!`);setTimeout(()=>enqueueNarrative(`Drone Link Amplifier brought your ${t.name} to full combat spec. Weapons hot.`,ctx),0);}
      return checkWinner(ns);
    });
    if(ability==='damage3'){triggerBeam('#ff3355',true);setTimeout(()=>triggerFx('chroma',480),150);spawnParticles('aiField','#ff3355',12);}
    if(ability==='destroy'){spawnParticles('aiField','#ffaa00',18);setTimeout(()=>triggerFx('big-chroma',600),100);}
    if(ability==='buff') spawnParticles('playerField','#88ff44',10);
  };

  const toggleAttacker=uid=>{
    if(!g||g.phase!=='player-attack') return;
    setG(s=>{const u=s.player.field.find(x=>x.uid===uid);if(!u||u.tapped)return s;const has=s.attackers.includes(uid);return{...s,attackers:has?s.attackers.filter(x=>x!==uid):[...s.attackers,uid]};});
  };

  const resolveAttack=()=>{
    if(!g) return;
    const primaryColor=g.player.field.find(u=>g.attackers.includes(u.uid))?.color||'#00ccff';
    setG(s=>{
      if(!s.attackers.length) return {...s,phase:'ai-turn',attackers:[]};
      let aiField=[...s.ai.field],pField=s.player.field.map(u=>s.attackers.includes(u.uid)?{...u,tapped:true}:u),aiHp=s.ai.hp;
      const logs=[],events=[],used=new Set();
      for(const atkUid of s.attackers){
        const atk=s.player.field.find(u=>u.uid===atkUid);if(!atk)continue;
        const ctx={turn:s.turn,playerHp:s.player.hp,aiHp,playerField:s.player.field.map(u=>u.name).join(',')||'empty',aiField:aiField.map(u=>u.name).join(',')||'empty'};
        if(atk.ability==='unblockable'){aiHp-=atk.atk;logs.push(`👻 ${atk.name} nullifier active — ${atk.atk} dmg`);events.push({ev:`Your ${atk.name} burned through with Interdiction Nullifier active, applying ${atk.atk} damage directly to the enemy capsuleer.`,ctx});continue;}
        const blocker=aiField.find(u=>!used.has(u.uid));
        if(blocker){
          used.add(blocker.uid);const ah=atk.currentHp-blocker.atk,bh=blocker.currentHp-atk.atk;
          if(ah<=0){pField=pField.filter(u=>u.uid!==atkUid);logs.push(`⚔ ${atk.name} lost — both destroyed`);events.push({ev:`Your ${atk.name} traded with enemy ${blocker.name}. Both ships are wrecks on the field.`,ctx});}
          else{pField=pField.map(u=>u.uid===atkUid?{...u,currentHp:ah,tapped:true}:u);if(bh<=0)events.push({ev:`Your ${atk.name} broke through enemy ${blocker.name}'s tank and destroyed it.`,ctx});}
          if(bh<=0){if(atk.ability==='crush'&&bh<0){aiHp+=bh;logs.push(`💥 Doomsday overflow ${Math.abs(bh)}`);events.push({ev:`Revelation's Doomsday Device obliterated enemy ${blocker.name} and ${Math.abs(bh)} excess damage bled through to the pod.`,ctx});}
          else logs.push(`✅ ${blocker.name} destroyed`);aiField=aiField.filter(u=>u.uid!==blocker.uid);}
          else aiField=aiField.map(u=>u.uid===blocker.uid?{...u,currentHp:bh}:u);
        } else {aiHp-=atk.atk;logs.push(`💥 ${atk.name} → ${atk.atk} hull dmg`);events.push({ev:`Your ${atk.name} encountered no resistance and applied ${atk.atk} direct damage to the enemy capsuleer.`,ctx});}
      }
      let ns={...s,player:{...s.player,field:pField},ai:{...s.ai,field:aiField,hp:aiHp},attackers:[],phase:'ai-turn'};
      for(const l of logs) ns=addLog(ns,l);
      ns=checkWinner(ns);
      for(const {ev,ctx} of events) setTimeout(()=>enqueueNarrative(ev,ctx),0);
      if(ns.winner) setTimeout(()=>enqueueNarrative(ns.winner==='player'?'Enemy pod destroyed. GF in local. Sovereignty secured.':'Your pod has been destroyed. CONCORD clone contract activated.',{turn:s.turn,playerHp:ns.player.hp,aiHp:ns.ai.hp}),0);
      return ns;
    });
    triggerBeam(primaryColor,true);
    spawnParticles('aiField',primaryColor,14);
    setTimeout(()=>triggerFx('chroma',400),180);
  };

  const goAttack =()=>setG(s=>({...s,phase:'player-attack',selectedCard:null,targeting:null}));
  const endTurn  =()=>setG(s=>({...s,phase:'ai-turn',attackers:[],selectedCard:null,targeting:null}));
  const cancelTgt=()=>setG(s=>({...s,targeting:null}));

  if(!g) return <InitScreen keyInput={keyInput} setKeyInput={setKeyInput} keyError={keyError} onStart={startGame}/>;

  const phaseLabel={'player-play':'DEPLOY PHASE','player-attack':'ENGAGE PHASE','ai-turn':'ENEMY FLEET ACTIVE','game-over':'ENGAGEMENT OVER'}[g.phase]||g.phase;
  const isTargeting=!!g.targeting;
  const fxFilter=screenFx==='big-chroma'
    ?'drop-shadow(5px 0 0 rgba(255,50,50,.7)) drop-shadow(-5px 0 0 rgba(0,150,255,.7))'
    :screenFx==='chroma'
    ?'drop-shadow(2px 0 0 rgba(255,50,50,.5)) drop-shadow(-2px 0 0 rgba(0,150,255,.5))'
    :'none';

  return (
    <div style={{minHeight:'100vh',background:'#01030a',color:'#c8d8e8',fontFamily:"'Exo 2',sans-serif",
      position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',
      filter:fxFilter,transition:'filter .08s ease'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;900&family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#0a1830}
        @keyframes twinkle{0%,100%{opacity:.08}50%{opacity:.5}}
        @keyframes nebulaDrift{0%{transform:translate(0,0) scale(1)}33%{transform:translate(12px,-9px) scale(1.05)}66%{transform:translate(-10px,13px) scale(.96)}100%{transform:translate(0,0) scale(1)}}
        @keyframes scanline{0%{top:-2px}100%{top:101%}}
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
        @keyframes flicker{0%,100%{opacity:1}91.5%{opacity:1}92%{opacity:.2}92.5%{opacity:1}97%{opacity:.6}97.5%{opacity:1}}
        @keyframes unitDeploy{0%{opacity:0;transform:translateY(28px) scale(.75)}65%{transform:translateY(-6px) scale(1.09)}100%{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes unitGlow{0%,100%{box-shadow:0 0 5px var(--gc),0 0 12px var(--gc)22}50%{box-shadow:0 0 14px var(--gc),0 0 30px var(--gc)44,0 0 55px var(--gc)15}}
        @keyframes particleOut{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(.2)}}
        @keyframes beamSlide{0%{transform:scaleX(0);opacity:1}55%{transform:scaleX(1);opacity:.9}100%{transform:scaleX(1);opacity:0}}
        @keyframes storySlide{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
        @keyframes warping{0%,100%{clip-path:inset(0)}33%{clip-path:inset(2px 0 2px 0)}66%{clip-path:inset(0 2px 0 2px)}}
        .card-lift{transition:transform .15s ease,box-shadow .15s ease;cursor:pointer}
        .card-lift:hover{transform:translateY(-10px) scale(1.07);z-index:20}
        .btn-eve{transition:all .18s ease;clip-path:polygon(8px 0%,100% 0%,100% calc(100% - 8px),calc(100% - 8px) 100%,0% 100%,0% 8px)}
        .btn-eve:hover:not(:disabled){filter:brightness(1.5)}
        .unit-deploy{animation:unitDeploy .44s cubic-bezier(.2,1.4,.6,1) forwards}
        .unit-glow{animation:unitGlow 2.8s ease-in-out infinite}
        .story-entry{animation:storySlide .4s ease}
        .narrating{animation:pulse 1.3s infinite}
        .warp-text{animation:warping 3s infinite}
      `}</style>

      {/* NEBULA + STARS */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
        {NEBULAE.map((n,i)=>(
          <div key={i} style={{position:'absolute',left:n.x,top:n.y,width:n.w,height:n.h,
            background:n.color,borderRadius:'50%',filter:`blur(${i%2===0?'60px':'80px'})`,opacity:n.op,
            animation:`nebulaDrift ${n.dur} ${n.delay} ease-in-out infinite`}}/>
        ))}
        {STARS.map((s,i)=>(
          <div key={i} style={{position:'absolute',left:s.left,top:s.top,
            width:`${s.w}px`,height:`${s.w}px`,borderRadius:'50%',
            background:i%8===0?'#aaccff':i%5===0?'#ffddaa':'#ffffff',
            animation:`twinkle ${s.dur}s ${s.delay}s infinite`}}/>
        ))}
        <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,80,160,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,80,160,.02) 1px,transparent 1px)',backgroundSize:'48px 48px'}}/>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at center,transparent 30%,rgba(1,3,10,.85) 100%)'}}/>
      </div>

      {/* SCANLINE */}
      <div style={{position:'fixed',left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(0,120,255,.08),transparent)',animation:'scanline 12s linear infinite',zIndex:1,pointerEvents:'none'}}/>

      {/* PARTICLES */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:50,overflow:'hidden'}}>
        {particles.map(p=>{
          const rad=p.angle*Math.PI/180;
          return <div key={p.id} style={{position:'absolute',left:`calc(${p.x}% - ${p.size/2}px)`,top:`calc(${p.y}% - ${p.size/2}px)`,width:`${p.size}px`,height:`${p.size}px`,borderRadius:'50%',background:p.color,boxShadow:`0 0 ${p.size*2.5}px ${p.color}`,'--tx':`${Math.cos(rad)*p.dist}px`,'--ty':`${Math.sin(rad)*p.dist}px`,animation:`particleOut ${p.dur}s ease-out forwards`}}/>;
        })}
      </div>

      {/* ATTACK BEAMS */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:40,overflow:'hidden'}}>
        {beams.map(b=>(
          <div key={b.id} style={{position:'absolute',left:0,right:0,top:b.fromPlayer?'63%':'37%',height:'2px',
            background:`linear-gradient(${b.fromPlayer?'90deg':'270deg'},transparent,${b.color},${b.color}dd,transparent)`,
            boxShadow:`0 0 10px ${b.color},0 0 25px ${b.color}77`,
            transformOrigin:b.fromPlayer?'left center':'right center',
            animation:'beamSlide .6s ease-out forwards'}}/>
        ))}
      </div>

      {/* MAIN LAYOUT */}
      <div style={{position:'relative',zIndex:2,display:'flex',gap:'8px',padding:'8px',maxWidth:'1100px',margin:'0 auto',width:'100%',height:'100vh',overflow:'hidden'}}>

        {/* GAME BOARD */}
        <div style={{flex:'0 0 490px',display:'flex',flexDirection:'column',gap:'5px',minWidth:0}}>
          {/* Header */}
          <div style={{padding:'2px 0 4px',fontFamily:'Orbitron'}}>
            <div style={{fontSize:'7px',letterSpacing:'5px',color:'#0044aa88',marginBottom:'1px',textAlign:'center'}}>TURN {g.turn} · {phaseLabel}</div>
            <div style={{textAlign:'center',fontSize:'16px',fontWeight:900,letterSpacing:'5px',
              background:'linear-gradient(135deg,#00aaff,#0066dd,#4488ff)',
              WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
              animation:'flicker 9s infinite'}} className="warp-text">NEW EDEN PROTOCOL</div>
          </div>

          <StatusBar label="HOSTILE CAPSULEER" hp={g.ai.hp} handCount={g.ai.hand.length} isPlayer={false}
            isTargetable={isTargeting&&g.targeting.ability==='damage3'} onTarget={()=>handleTarget('ai-player',null)}/>
          <BattleField units={g.ai.field} isPlayer={false} attacking={[]} targeting={g.targeting}
            onUnitClick={id=>{if(isTargeting&&['damage3','destroy'].includes(g.targeting.ability)) handleTarget('ai-unit',id);}}/>
          <ControlZone log={g.log} phase={g.phase} attackerCount={g.attackers.length}
            aiThinking={g.phase==='ai-turn'} isTargeting={isTargeting} targetName={g.targeting?.name}
            onAttack={goAttack} onResolve={resolveAttack} onEnd={endTurn} onCancel={cancelTgt}/>
          <BattleField units={g.player.field} isPlayer={true} attacking={g.attackers} targeting={g.targeting}
            onUnitClick={id=>{if(isTargeting&&g.targeting.ability==='buff') handleTarget('player-unit',id); else toggleAttacker(id);}}/>
          <StatusBar label="YOUR CAPSULEER" hp={g.player.hp} core={g.player.core} maxCore={g.player.maxCore} isPlayer={true}/>
          <Hand cards={g.player.hand} selected={g.selectedCard} core={g.player.core} phase={g.phase}
            onSelect={selectCard} onPlay={playCard}/>
        </div>

        {/* SCOPE FEED */}
        <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden'}}>
          <div style={{fontFamily:'Orbitron',fontSize:'7px',letterSpacing:'4px',color:'#003388',padding:'3px 0 8px',borderBottom:'1px solid #081428'}}>
            ◈ SCOPE NEWS NETWORK — FIELD DISPATCH
          </div>
          {narLoading&&(
            <div className="narrating" style={{display:'flex',alignItems:'center',gap:'6px',padding:'6px 0',color:'#0066aa66',fontFamily:'Orbitron',fontSize:'7px',letterSpacing:'2px'}}>
              <div style={{display:'flex',gap:'3px'}}>{[0,1,2].map(i=><div key={i} style={{width:'3px',height:'3px',borderRadius:'50%',background:'#0088cc',animation:`pulse 1s ${i*.2}s infinite`}}/>)}</div>
              INCOMING TRANSMISSION
            </div>
          )}
          <div ref={storyRef} style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:'14px',padding:'10px 0'}}>
            {story.length===0&&!narLoading&&<div style={{color:'#081828',fontFamily:'Share Tech Mono',fontSize:'11px',lineHeight:1.7,marginTop:'20px'}}>standing by for combat data...</div>}
            {story.map((entry,i)=>(
              <div key={i} className="story-entry" style={{borderLeft:`2px solid ${i===0?'#003388':'#0a1828'}`,paddingLeft:'12px'}}>
                <div style={{fontFamily:'Orbitron',fontSize:'6px',color:'#0a2040',letterSpacing:'2px',marginBottom:'3px'}}>TURN {entry.turn} · DISPATCH #{story.length-i} · NEW EDEN</div>
                <div style={{fontFamily:'Share Tech Mono',fontSize:'12px',lineHeight:1.85,color:i===0?'#7799bb':i===1?'#3d5570':'#253545',transition:'color .5s'}}>{entry.text}</div>
              </div>
            ))}
          </div>
          <button onClick={resetGame} className="btn-eve" style={{background:'transparent',border:'1px solid #081428',color:'#0d1e30',padding:'6px',fontFamily:'Orbitron',fontSize:'7px',letterSpacing:'2px',cursor:'pointer',marginTop:'6px'}}>
            ⏻ DISCONNECT FROM LOCAL
          </button>
        </div>
      </div>

      {g.winner&&<WinnerOverlay winner={g.winner} lastStory={story[0]?.text} onReset={resetGame}/>}
    </div>
  );
}

// ── INIT SCREEN ───────────────────────────────────────────────────────────────
function InitScreen({keyInput,setKeyInput,keyError,onStart}) {
  return (
    <div style={{minHeight:'100vh',background:'#010208',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;900&family=Share+Tech+Mono&family=Orbitron:wght@700;900&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes nd{0%{transform:translate(0,0)}50%{transform:translate(14px,-10px)}100%{transform:translate(0,0)}}@keyframes flicker{0%,100%{opacity:1}92%{opacity:1}93%{opacity:.25}94%{opacity:1}}`}</style>
      {[{x:'8%',y:'15%',c:'#001155'},{x:'65%',y:'50%',c:'#002244'},{x:'55%',y:'5%',c:'#110033'}].map((n,i)=>(
        <div key={i} style={{position:'absolute',left:n.x,top:n.y,width:'350px',height:'250px',background:n.c,borderRadius:'50%',filter:'blur(70px)',opacity:.06,animation:`nd ${18+i*5}s ease-in-out infinite`}}/>
      ))}
      <div style={{textAlign:'center',padding:'40px',maxWidth:'440px',width:'100%',position:'relative',zIndex:2}}>
        <div style={{fontSize:'8px',letterSpacing:'7px',color:'#00224488',fontFamily:'Orbitron',marginBottom:'6px'}}>CAPSULEER AUTHENTICATION</div>
        <div style={{fontSize:'26px',fontWeight:900,letterSpacing:'4px',fontFamily:'Orbitron',
          background:'linear-gradient(135deg,#0088dd,#0044aa,#4488ff)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
          animation:'flicker 7s infinite',marginBottom:'2px'}}>NEW EDEN PROTOCOL</div>
        <div style={{fontSize:'9px',letterSpacing:'3px',color:'#0a2040',fontFamily:'Orbitron',marginBottom:'28px'}}>AI-POWERED ENGAGEMENT SYSTEM</div>
        <div style={{color:'#1a2e40',fontFamily:'Share Tech Mono',fontSize:'11px',lineHeight:1.85,marginBottom:'28px',textAlign:'left',borderLeft:'2px solid #081828',paddingLeft:'14px'}}>
          Capsuleer, authenticate to the New Eden engagement grid. Your tactical decisions will be documented by an embedded Scope News correspondent in real time.
        </div>
        <label style={{fontFamily:'Orbitron',fontSize:'7px',letterSpacing:'2px',color:'#004488',display:'block',marginBottom:'6px'}}>OPENAI API KEY</label>
        <input type="password" placeholder="sk-..." value={keyInput} onChange={e=>setKeyInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onStart()}
          style={{width:'100%',background:'#030810',border:'1px solid #0a1c30',color:'#6688aa',padding:'10px 12px',fontFamily:'Share Tech Mono',fontSize:'12px',outline:'none',clipPath:'polygon(6px 0%,100% 0%,100% calc(100% - 6px),calc(100% - 6px) 100%,0% 100%,0% 6px)'}}/>
        {keyError&&<div style={{color:'#ff4444',fontSize:'9px',fontFamily:'Orbitron',marginTop:'4px',letterSpacing:'1px'}}>{keyError}</div>}
        <div style={{color:'#081420',fontFamily:'Share Tech Mono',fontSize:'9px',marginTop:'4px'}}>Key used locally — not stored or transmitted outside OpenAI.</div>
        <button onClick={onStart} style={{width:'100%',background:'rgba(0,100,200,.08)',border:'1px solid #004488',color:'#0088cc',padding:'12px',fontFamily:'Orbitron',fontSize:'9px',letterSpacing:'3px',cursor:'pointer',marginTop:'16px',clipPath:'polygon(8px 0%,100% 0%,100% calc(100% - 8px),calc(100% - 8px) 100%,0% 100%,0% 8px)',transition:'all .2s'}}>
          ⟶ CONNECT TO THE GRID
        </button>
        <div style={{color:'#080f18',fontFamily:'Share Tech Mono',fontSize:'9px',marginTop:'12px'}}>Uses GPT-4o-mini · ~$0.001 per engagement</div>
      </div>
    </div>
  );
}

// ── STATUS BAR ────────────────────────────────────────────────────────────────
function StatusBar({label,hp,handCount,core,maxCore,isPlayer,isTargetable,onTarget}) {
  const hpColor=hp>12?'#00aaff':hp>6?'#ffaa22':'#ff3344';
  return (
    <div onClick={isTargetable?onTarget:undefined} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 10px',
      background:isTargetable?'rgba(255,50,50,.08)':'rgba(0,0,0,.5)',
      border:`1px solid ${isTargetable?'#ff334455':'rgba(0,80,160,.2)'}`,
      cursor:isTargetable?'pointer':'default',
      boxShadow:isTargetable?'0 0 18px #ff334422':isPlayer?'inset 0 0 20px rgba(0,80,160,.08)':'none',
      transition:'all .2s',clipPath:'polygon(0 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)'}}>
      <span style={{fontFamily:'Orbitron',fontSize:'7px',letterSpacing:'3px',color:isTargetable?'#ff3344':'#0a2040'}}>{isTargetable?'🎯 SELECT TARGET':label}</span>
      <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
        <div style={{fontFamily:'Orbitron',fontSize:'14px',fontWeight:700,color:hpColor,textShadow:`0 0 10px ${hpColor}66`,transition:'color .4s'}}>
          {isPlayer?'♦':'☠'} {hp}
        </div>
        {!isPlayer&&handCount!==undefined&&<span style={{fontSize:'8px',color:'#0a1828',fontFamily:'Orbitron'}}>✋{handCount}</span>}
        {isPlayer&&maxCore&&<CapBar core={core} max={maxCore}/>}
      </div>
    </div>
  );
}

function CapBar({core,max}) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
      <span style={{fontFamily:'Orbitron',fontSize:'7px',color:'#0a2040',letterSpacing:'1px'}}>CAP</span>
      <div style={{display:'flex',gap:'2px'}}>
        {Array.from({length:max},(_,i)=>(
          <div key={i} style={{width:'9px',height:'9px',
            background:i<core?'#ffaa22':'#08100a',
            border:`1px solid ${i<core?'#ffaa22':'#0e1a0e'}`,
            boxShadow:i<core?'0 0 5px #ffaa2299':'none',
            transition:'all .25s',
            clipPath:'polygon(2px 0%,100% 0%,100% calc(100% - 2px),calc(100% - 2px) 100%,0% 100%,0% 2px)'}}/>
        ))}
      </div>
      <span style={{fontFamily:'Orbitron',fontSize:'11px',fontWeight:700,color:'#ffaa22'}}>{core}/{max}</span>
    </div>
  );
}

// ── BATTLE FIELD ──────────────────────────────────────────────────────────────
function BattleField({units,isPlayer,attacking,targeting,onUnitClick}) {
  const tgtable=()=>!targeting?false:(!isPlayer&&['damage3','destroy'].includes(targeting.ability))||(isPlayer&&targeting.ability==='buff');
  const canSel=u=>tgtable()||(isPlayer&&!targeting&&!u.tapped);
  return (
    <div style={{display:'flex',gap:'6px',padding:'6px',minHeight:'100px',flexWrap:'wrap',alignItems:'center',
      background:'rgba(0,0,0,.22)',border:'1px solid rgba(0,80,160,.1)',
      clipPath:'polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)'}}>
      {units.length===0&&<div style={{color:'#081520',fontFamily:'Orbitron',fontSize:'7px',margin:'auto',letterSpacing:'4px'}}>{isPlayer?'— YOUR FLEET —':'— ENEMY FLEET —'}</div>}
      {units.map(unit=>{
        const isAtk=attacking.includes(unit.uid),isTgt=tgtable(),sel=canSel(unit);
        const bc=isAtk?'#ff6633':isTgt?'#ffaa22':unit.color;
        return (
          <div key={unit.uid}
            className={`${sel?'card-lift':''} ${unit.justPlayed?'unit-deploy':''} unit-glow`}
            onClick={sel?()=>onUnitClick(unit.uid):undefined}
            style={{'--gc':unit.color,
              width:'72px',minHeight:'94px',
              background:`linear-gradient(160deg,#03080f,${unit.color}18)`,
              border:`1px solid ${bc}77`,padding:'5px 4px',textAlign:'center',position:'relative',
              opacity:unit.tapped?.45:1,
              transform:unit.tapped?'rotate(9deg) translateY(3px)':'none',
              transition:'opacity .3s,transform .3s',cursor:sel?'pointer':'default',
              clipPath:'polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)'}}>
            {isAtk&&<div style={{position:'absolute',top:'-11px',left:'50%',transform:'translateX(-50%)',fontSize:'6px',color:'#ff6633',fontFamily:'Orbitron',whiteSpace:'nowrap',textShadow:'0 0 6px #ff6633'}}>⚔ ENGAGING</div>}
            {isTgt&&<div style={{position:'absolute',inset:0,border:'1px solid #ffaa2277',pointerEvents:'none'}}/>}
            <div style={{fontSize:'20px',marginBottom:'2px'}}>{unit.icon}</div>
            <div style={{fontSize:'6px',fontFamily:'Orbitron',color:unit.color,lineHeight:1.2,marginBottom:'1px',textShadow:`0 0 7px ${unit.color}66`}}>{unit.name}</div>
            {unit.faction&&<div style={{fontSize:'5.5px',fontFamily:'Orbitron',color:unit.color+'88',marginBottom:'3px'}}>{unit.faction}</div>}
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',fontWeight:700}}>
              <span style={{color:'#ff6633'}}>⚔{unit.atk}</span>
              <span style={{color:'#00aaff'}}>♦{unit.currentHp}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── CONTROL ZONE ──────────────────────────────────────────────────────────────
function ControlZone({log,phase,attackerCount,aiThinking,isTargeting,targetName,onAttack,onResolve,onEnd,onCancel}) {
  const logColors=['#99bbcc','#6688aa','#445566','#2d3f50','#1e2d3a'];
  return (
    <div style={{display:'flex',gap:'8px',background:'rgba(0,0,0,.32)',border:'1px solid rgba(0,80,160,.08)',padding:'5px'}}>
      <div style={{flex:1,height:'70px',overflowY:'auto',fontSize:'9px',lineHeight:'1.65',fontFamily:'Share Tech Mono'}}>
        {log.map((l,i)=><div key={i} style={{color:logColors[Math.min(i,logColors.length-1)],transition:'color .3s'}}>{l}</div>)}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'4px',justifyContent:'center',minWidth:'120px'}}>
        {isTargeting?(<>
          <div style={{fontFamily:'Orbitron',fontSize:'7px',color:'#ffaa22',textAlign:'center',letterSpacing:'1px'}}>🎯 {targetName}</div>
          <div style={{fontFamily:'Orbitron',fontSize:'6px',color:'#332200',textAlign:'center'}}>select a target</div>
          <EveBtn label="✕ CANCEL" color="#ffaa22" onClick={onCancel}/>
        </>):(<>
          {phase==='player-play'   &&<EveBtn label="⚔ ENGAGE" color="#ff6633" onClick={onAttack}/>}
          {phase==='player-attack' &&<EveBtn label={`✓ RESOLVE (${attackerCount})`} color="#ff6633" onClick={onResolve} active/>}
          <EveBtn label={aiThinking?'⟳ ENEMY FLEET...':'END TURN'} color="#0088cc" disabled={phase==='ai-turn'||phase==='game-over'} onClick={onEnd}/>
        </>)}
      </div>
    </div>
  );
}
function EveBtn({label,color,disabled,onClick,active}){
  return <button onClick={onClick} disabled={disabled} className="btn-eve" style={{background:active?`${color}18`:'rgba(0,0,0,.35)',border:`1px solid ${disabled?'#0a0f18':color+'66'}`,color:disabled?'#0d1828':color,padding:'5px 6px',fontFamily:'Orbitron',fontSize:'7.5px',letterSpacing:'1.5px',cursor:disabled?'not-allowed':'pointer',boxShadow:active?`0 0 10px ${color}44`:'none'}}>{label}</button>;
}

// ── HAND ──────────────────────────────────────────────────────────────────────
function Hand({cards,selected,core,phase,onSelect,onPlay}) {
  return (
    <div style={{display:'flex',gap:'4px',padding:'3px 0 6px',overflowX:'auto',alignItems:'flex-end',minHeight:'120px'}}>
      {cards.length===0&&<div style={{color:'#080f18',fontFamily:'Orbitron',fontSize:'7px',margin:'auto',letterSpacing:'3px'}}>NO MODULES IN RESERVE</div>}
      {cards.map(card=>{
        const sel=selected===card.uid,affordable=card.cost<=core,canPlay=affordable&&phase==='player-play';
        return (
          <div key={card.uid} className="card-lift"
            onClick={sel&&canPlay?()=>onPlay(card.uid):()=>onSelect(card.uid)}
            style={{width:'80px',minHeight:'112px',flexShrink:0,
              background:sel?`linear-gradient(160deg,${card.color}1e,${card.color}0a)`:'linear-gradient(160deg,#07090f,#03050a)',
              border:`1px solid ${sel?card.color:'#0d1520'}`,padding:'6px 4px',
              boxShadow:sel?`0 0 22px ${card.color}55,0 0 45px ${card.color}18,0 -6px 18px ${card.color}28`:'0 2px 8px rgba(0,0,0,.7)',
              opacity:!affordable&&!sel?.3:1,transform:sel?'translateY(-14px)':'none',position:'relative',textAlign:'center',
              clipPath:'polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)'}}>
            <div style={{position:'absolute',top:'2px',right:'3px',background:'#ffaa2212',border:'1px solid #ffaa2244',padding:'0 3px',color:'#ffaa22',fontFamily:'Orbitron',fontSize:'7px',fontWeight:700,clipPath:'polygon(3px 0%,100% 0%,100% 100%,0% 100%,0% 3px)'}}>{card.cost}</div>
            <div style={{position:'absolute',top:'3px',left:'3px',width:'5px',height:'5px',background:card.color,boxShadow:`0 0 6px ${card.color}`,clipPath:'polygon(50% 0%,100% 50%,50% 100%,0% 50%)'}}/>
            <div style={{fontSize:'20px',margin:'5px 0 2px'}}>{card.icon}</div>
            <div style={{fontSize:'6.5px',fontFamily:'Orbitron',color:card.color,lineHeight:1.2,marginBottom:'1px',textShadow:`0 0 7px ${card.color}66`}}>{card.name}</div>
            {card.faction&&<div style={{fontSize:'5.5px',fontFamily:'Orbitron',color:card.color+'77',marginBottom:'2px'}}>{card.faction}</div>}
            {card.type==='ship'&&<div style={{display:'flex',justifyContent:'center',gap:'5px',fontSize:'10px',fontWeight:700,marginBottom:'2px'}}><span style={{color:'#ff6633'}}>⚔{card.atk}</span><span style={{color:'#00aaff'}}>♦{card.def}</span></div>}
            <div style={{fontSize:'5.5px',color:'#1a2e40',lineHeight:1.35}}>{card.effect}</div>
            {sel&&canPlay&&<div style={{position:'absolute',bottom:'-14px',left:'50%',transform:'translateX(-50%)',fontSize:'6px',color:'#00aaff',fontFamily:'Orbitron',whiteSpace:'nowrap',textShadow:'0 0 6px #00aaff'}}>▲ DEPLOY</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── WINNER OVERLAY ────────────────────────────────────────────────────────────
function WinnerOverlay({winner,lastStory,onReset}) {
  const won=winner==='player';
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,1,8,.97)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:200,fontFamily:'Orbitron'}}>
      <div style={{fontSize:'50px',marginBottom:'12px'}}>{won?'🏆':'💀'}</div>
      <div style={{fontSize:'11px',letterSpacing:'6px',color:won?'#00aaff':'#ff3344',marginBottom:'4px'}}>{won?'GF IN LOCAL':'PODDED'}</div>
      <div style={{fontSize:'30px',fontWeight:900,letterSpacing:'4px',
        background:won?'linear-gradient(135deg,#00aaff,#44ccff)':'linear-gradient(135deg,#ff3344,#ff7744)',
        WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:'5px'}}>
        {won?'VICTORY':'DEFEAT'}
      </div>
      {lastStory&&<div style={{maxWidth:'400px',fontFamily:'Share Tech Mono',fontSize:'12px',lineHeight:1.85,color:'#1a2e40',textAlign:'center',margin:'18px 0 28px',borderLeft:'2px solid #081828',padding:'0 16px'}}>{lastStory}</div>}
      <button onClick={onReset} style={{background:'rgba(0,100,200,.08)',border:'1px solid #004488',color:'#0088cc',padding:'11px 30px',fontFamily:'Orbitron',fontSize:'9px',letterSpacing:'3px',cursor:'pointer',clipPath:'polygon(8px 0%,100% 0%,100% calc(100% - 8px),calc(100% - 8px) 100%,0% 100%,0% 8px)'}}>
        ↺ RESHIP &amp; REDOCK
      </button>
    </div>
  );
}
