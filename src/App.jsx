import { useState, useEffect, useRef, useCallback } from "react";

// ── CARDS ─────────────────────────────────────────────────────────────────────
const CARDS = [
  {id:'merlin',    name:'Merlin',         cost:1,type:'ship',  atk:1,def:2,color:'#00ccff',icon:'🚀',ability:'haste',      faction:'Caldari', defaultRow:'front',effect:'Afterburner · attacks immediately on landing'},
  {id:'punisher',  name:'Punisher',       cost:2,type:'ship',  atk:1,def:4,color:'#ffaa22',icon:'🛡️',ability:null,         faction:'Amarr',   defaultRow:'front',effect:'Armor Tank · 4 HP front-line wall'},
  {id:'stiletto',  name:'Stiletto',       cost:3,type:'ship',  atk:3,def:2,color:'#cc44ff',icon:'👻',ability:'unblockable',faction:'Minmatar',defaultRow:'front',effect:'Nullifier · bypasses all blockers, hits pod directly'},
  {id:'drake',     name:'Drake',          cost:3,type:'ship',  atk:2,def:3,color:'#33ddaa',icon:'🎯',ability:'ranged',     faction:'Caldari', defaultRow:'back', effect:'Heavy Missiles · fires full range from back row'},
  {id:'revelation',name:'Revelation',     cost:6,type:'ship',  atk:5,def:5,color:'#ff6633',icon:'🦾',ability:'crush',     faction:'Amarr',   defaultRow:'front',effect:'Doomsday Device · excess damage bleeds to enemy pod'},
  {id:'disruptor', name:'Warp Disruptor', cost:2,type:'module',color:'#ff3355',icon:'⚡',ability:'damage3',effect:'Lock & fire · 3 damage to any ship or pod'},
  {id:'analyzer',  name:'Data Analyzer',  cost:1,type:'module',color:'#44bbff',icon:'📡',ability:'draw2',  effect:'Scan local · draw 2 cards from reserves'},
  {id:'smartbomb', name:'Smartbomb',      cost:3,type:'module',color:'#ffaa00',icon:'💥',ability:'destroy',effect:'Area pulse · obliterate any one ship on the field'},
  {id:'repair',    name:'Remote Repair',  cost:2,type:'module',color:'#88ff44',icon:'🔧',ability:'heal3',  effect:'Remote reps · restore 3 HP to a friendly ship'},
  {id:'cap_boost', name:'Cap Booster',    cost:0,type:'module',color:'#ffdd44',icon:'🔋',ability:'coresurge',effect:'Charge inject · gain 3 extra cap this turn'},
];

// ── UTILS ─────────────────────────────────────────────────────────────────────
let _uid = 1;
const uid = () => _uid++;
const shuffle = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]} return b; };
const buildDeck = () => shuffle([...CARDS,...CARDS,...CARDS].map(c=>({...c,uid:uid()})));
const drawN = (g,owner,n) => {
  const deck=[...g[owner].deck], hand=[...g[owner].hand];
  for(let i=0;i<n&&deck.length;i++) hand.push(deck.shift());
  return {...g,[owner]:{...g[owner],deck,hand}};
};
const checkWinner = g => {
  if(g.player.hp<=0) return {...g,winner:'ai',phase:'game-over'};
  if(g.ai.hp<=0)     return {...g,winner:'player',phase:'game-over'};
  return g;
};
// field is a flat array; ships have .row = 'front' | 'back'
const frontOf = field => field.filter(u=>u.row==='front');
const backOf  = field => field.filter(u=>u.row==='back');
const addKill = (g,k) => ({...g, kills:[{...k,id:uid()},...g.kills].slice(0,35)});

// ── BACKGROUND CONSTANTS ──────────────────────────────────────────────────────
const STARS = Array.from({length:65},(_,i)=>({
  left:`${(i*37+13)%100}%`,top:`${(i*53+7)%100}%`,
  w:(i%4)*.55+.2,delay:(i%6)*.7,dur:2+(i%5)*.8
}));
const NEBULAE = [
  {x:'5%', y:'10%',w:'420px',h:'260px',color:'#1133aa',op:.05, dur:'22s',delay:'0s'  },
  {x:'62%',y:'50%',w:'350px',h:'400px',color:'#003366',op:.04, dur:'28s',delay:'-9s' },
  {x:'70%',y:'2%', w:'280px',h:'260px',color:'#220066',op:.038,dur:'18s',delay:'-4s' },
  {x:'20%',y:'68%',w:'340px',h:'220px',color:'#004422',op:.032,dur:'32s',delay:'-14s'},
  {x:'40%',y:'25%',w:'220px',h:'220px',color:'#552200',op:.028,dur:'24s',delay:'-7s' },
];

// ── AI LOGIC ──────────────────────────────────────────────────────────────────
function aiPlay(g) {
  let hand=[...g.ai.hand], field=[...g.ai.field], aiDeck=[...g.ai.deck];
  let pField=[...g.player.field], pHp=g.player.hp, core=g.ai.core;
  const kills=[];

  for(const card of [...hand].filter(c=>c.cost<=core).sort((a,b)=>b.cost-a.cost)) {
    if(card.cost>core) continue;
    core-=card.cost;
    hand=hand.filter(c=>c.uid!==card.uid);

    if(card.type==='ship') {
      const row=card.ability==='ranged'?'back':'front';
      field.push({...card,currentHp:card.def,tapped:false,justPlayed:true,row});
      kills.push({text:`⚠ Enemy ${card.name} on grid · ${row.toUpperCase()}`,color:'#3a5570'});
    } else {
      switch(card.ability) {
        case 'draw2':
          for(let i=0;i<2&&aiDeck.length;i++) hand.push(aiDeck.shift());
          kills.push({text:`📡 Enemy Data Analyzer — 2 reserves recovered`,color:'#3a5570'});
          break;
        case 'coresurge':
          core+=3;
          kills.push({text:`🔋 Enemy Cap Booster — +3 capacitor`,color:'#3a5570'});
          break;
        case 'damage3': {
          const front=pField.filter(u=>u.row==='front');
          const pool=front.length?front:pField.filter(u=>u.row==='back');
          if(pool.length){
            const t=pool.reduce((a,b)=>a.currentHp<b.currentHp?a:b);
            const hp=t.currentHp-3;
            pField=pField.map(u=>u.uid===t.uid?{...u,currentHp:hp}:u).filter(u=>u.currentHp>0);
            kills.push(hp<=0
              ?{text:`⚡ Enemy Disruptor obliterated your ${t.name}`,color:'#ff4444'}
              :{text:`⚡ Enemy Disruptor hit your ${t.name} · 3 dmg`,color:'#ff7744'});
          } else {
            pHp-=3;
            kills.push({text:`⚡ Enemy Disruptor hit your pod · 3 dmg`,color:'#ff4444'});
          }
          break;
        }
        case 'destroy': {
          const front=pField.filter(u=>u.row==='front');
          const pool=front.length?front:pField.filter(u=>u.row==='back');
          if(pool.length){
            const t=pool.reduce((a,b)=>a.atk>b.atk?a:b);
            pField=pField.filter(u=>u.uid!==t.uid);
            kills.push({text:`💥 Enemy Smartbomb vaporized your ${t.name}`,color:'#ff4444'});
          }
          break;
        }
        case 'heal3': {
          if(field.length){
            const t=field.reduce((a,b)=>a.currentHp<b.currentHp?a:b);
            field=field.map(u=>u.uid===t.uid?{...u,currentHp:Math.min(u.def,u.currentHp+3)}:u);
            kills.push({text:`🔧 Enemy Remote Repair repped ${t.name} · +3 HP`,color:'#3a5570'});
          }
          break;
        }
      }
    }
  }

  return {
    state:{...g,ai:{...g.ai,hand,field,deck:aiDeck,core},player:{...g.player,field:pField,hp:pHp}},
    kills
  };
}

function aiAttack(g) {
  const eligible = [
    ...frontOf(g.ai.field).filter(u=>!u.tapped&&(!u.justPlayed||u.ability==='haste')),
    ...backOf(g.ai.field).filter(u=>u.ability==='ranged'&&!u.tapped&&(!u.justPlayed||u.ability==='haste')),
  ];
  const seen=new Set();
  const atkers=eligible.filter(u=>{if(seen.has(u.uid))return false;seen.add(u.uid);return true;});
  if(!atkers.length) return {state:g,kills:[]};

  let aiField=g.ai.field.map(u=>atkers.find(a=>a.uid===u.uid)?{...u,tapped:true}:u);
  let pField=[...g.player.field];
  let pHp=g.player.hp;
  const kills=[], used=new Set();

  for(const atk of atkers) {
    if(atk.ability==='unblockable') {
      pHp-=atk.atk;
      kills.push({text:`👻 Enemy ${atk.name} NULLIFIER → your pod · ${atk.atk} dmg`,color:'#ff4444'});
      continue;
    }
    const pFront=pField.filter(u=>u.row==='front'&&!used.has(u.uid));
    const pBack=pField.filter(u=>u.row==='back'&&!used.has(u.uid));
    const blocker=pFront[0]||pBack[0];
    if(blocker){
      used.add(blocker.uid);
      const ah=atk.currentHp-blocker.atk, bh=blocker.currentHp-atk.atk;
      if(ah<=0){
        aiField=aiField.filter(u=>u.uid!==atk.uid);
        kills.push({text:`✅ Your ${blocker.name} destroyed enemy ${atk.name}`,color:'#44ff88'});
      }
      if(bh<=0){
        if(atk.ability==='crush'&&bh<0){
          pHp+=bh;
          kills.push({text:`☠ Enemy ${atk.name} DOOMSDAY · ${blocker.name} + ${Math.abs(bh)} overflow`,color:'#ff4444'});
        } else {
          kills.push({text:`☠ Enemy ${atk.name} destroyed your ${blocker.name}`,color:'#ff4444'});
        }
        pField=pField.filter(u=>u.uid!==blocker.uid);
      } else pField=pField.map(u=>u.uid===blocker.uid?{...u,currentHp:bh}:u);
    } else {
      pHp-=atk.atk;
      kills.push({text:`💥 Enemy ${atk.name} → your pod · ${atk.atk} dmg`,color:'#ff4444'});
    }
  }
  return {state:{...g,ai:{...g.ai,field:aiField},player:{...g.player,field:pField,hp:pHp}},kills};
}

function runAiTurn(s) {
  let g={...s};
  g=drawN(g,'ai',1);
  const newMax=Math.min(10,g.ai.maxCore+1);
  g={...g,ai:{...g.ai,maxCore:newMax,core:newMax,field:g.ai.field.map(u=>({...u,tapped:false,justPlayed:false}))}};
  const {state:s2,kills:k1}=aiPlay(g); g=s2;
  const {state:s3,kills:k2}=aiAttack(g); g=s3;
  for(const k of [...k1,...k2]) g=addKill(g,{...k,turn:s.turn});
  g=checkWinner(g);
  if(g.phase!=='game-over'){
    const t=g.turn+1, pm=Math.min(10,g.player.maxCore+1);
    g=drawN(g,'player',1);
    g={...g,phase:'player-play',turn:t,aiThinking:false,attackers:[],selectedCard:null,pendingDeploy:null,
      player:{...g.player,maxCore:pm,core:pm,field:g.player.field.map(u=>({...u,tapped:false,justPlayed:false}))}};
  } else g={...g,aiThinking:false};
  return {newState:g};
}

function initGame() {
  let s={
    phase:'player-play',turn:1,winner:null,aiThinking:false,
    selectedCard:null,pendingDeploy:null,attackers:[],targeting:null,
    kills:[{id:uid(),turn:0,text:'⚡ Fleet engagement initiated in New Eden local',color:'#4488cc'}],
    player:{hp:20,core:1,maxCore:1,deck:buildDeck(),hand:[],field:[]},
    ai:   {hp:20,core:1,maxCore:1,deck:buildDeck(),hand:[],field:[]},
  };
  s=drawN(s,'player',5); s=drawN(s,'ai',5);
  return s;
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [started, setStarted] = useState(false);
  const [g,       setG]       = useState(null);
  const [particles,  setParticles]  = useState([]);
  const [screenFx,   setScreenFx]   = useState('');
  const [beams,      setBeams]      = useState([]);

  const timerRef   = useRef(null);
  const aiLockRef  = useRef(false);

  // ── VISUAL HELPERS ──────────────────────────────────────────────────────────
  const spawnParticles = useCallback((zone,color,count=12)=>{
    const zones={hand:{x:50,y:90},pFront:{x:50,y:65},pBack:{x:50,y:76},aiFront:{x:50,y:33},aiBack:{x:50,y:22},center:{x:50,y:50}};
    const {x,y}=zones[zone]||zones.center;
    const ps=Array.from({length:count},(_,i)=>({id:uid(),x,y,angle:(i/count)*360+(Math.random()-.5)*22,dist:45+Math.random()*85,color,size:3+Math.random()*4,dur:.45+Math.random()*.4}));
    setParticles(prev=>[...prev,...ps]);
    setTimeout(()=>setParticles(prev=>prev.filter(p=>!ps.find(n=>n.id===p.id))),950);
  },[]);

  const triggerFx   = useCallback((fx,dur=520)=>{setScreenFx(fx);setTimeout(()=>setScreenFx(''),dur);},[]);
  const triggerBeam = useCallback((color,fromPlayer=true)=>{
    const id=uid();
    setBeams(prev=>[...prev,{id,color,fromPlayer}]);
    setTimeout(()=>setBeams(prev=>prev.filter(b=>b.id!==id)),680);
  },[]);

  // ── AI TURN EFFECT — properly fixed ────────────────────────────────────────
  // The real bug: React cleanup was firing between dep-change and re-run, clearing
  // the timer. Fix: ref lock + reset in cleanup so StrictMode double-invoke works.
  useEffect(()=>{
    if(!g||g.phase!=='ai-turn') return;
    if(aiLockRef.current) return;
    aiLockRef.current=true;
    const captured=g;
    timerRef.current=setTimeout(()=>{
      try {
        const {newState}=runAiTurn(captured);
        const prevHp=captured.player.hp;
        setG(newState);
        aiLockRef.current=false;
        if(newState.player.hp<prevHp){
          const dmg=prevHp-newState.player.hp;
          triggerBeam(dmg>=3?'#ff3344':'#ff7733',false);
          setTimeout(()=>triggerFx(dmg>=3?'big-chroma':'chroma',dmg>=3?700:480),200);
          spawnParticles('pFront','#ff3344',dmg>=3?16:10);
        }
        if(newState.ai.field.length>captured.ai.field.length) spawnParticles('aiFront','#0088ff',8);
      } catch(err){
        console.error('AI error:',err);
        aiLockRef.current=false;
        setG(s=>({...s,phase:'player-play',aiThinking:false,turn:(s.turn||1)+1,player:{...s.player,core:s.player.maxCore}}));
      }
    },1600);
    // Reset lock in cleanup — critical for StrictMode double-invoke to work correctly
    return()=>{clearTimeout(timerRef.current);aiLockRef.current=false;};
  },[g?.phase]);

  // ── GAME ACTIONS ────────────────────────────────────────────────────────────
  const selectCard = cUid => {
    if(!g||g.phase!=='player-play'||g.targeting||g.pendingDeploy) return;
    setG(s=>({...s,selectedCard:s.selectedCard===cUid?null:cUid}));
  };

  const handleCardAction = cUid => {
    if(!g||g.phase!=='player-play') return;
    const card=g.player.hand.find(c=>c.uid===cUid);
    if(!card||card.cost>g.player.core) return;

    if(card.type==='ship') {
      setG(s=>({...s,selectedCard:null,pendingDeploy:card}));
      return;
    }

    // Module play
    setG(s=>{
      if(s.phase!=='player-play') return s;
      const c=s.player.hand.find(x=>x.uid===cUid);
      if(!c||c.cost>s.player.core) return s;
      let ns={...s,selectedCard:null,pendingDeploy:null,
        player:{...s.player,core:s.player.core-c.cost,hand:s.player.hand.filter(x=>x.uid!==cUid)}};
      if(['damage3','destroy','heal3'].includes(c.ability)){
        ns={...ns,targeting:{ability:c.ability,name:c.name}};
      } else {
        if(c.ability==='draw2'){ns=drawN(ns,'player',2);ns=addKill(ns,{turn:s.turn,text:`📡 Data Analyzer — you draw 2 cards`,color:'#4488cc'});}
        if(c.ability==='coresurge'){ns={...ns,player:{...ns.player,core:ns.player.core+3}};ns=addKill(ns,{turn:s.turn,text:`🔋 Cap Booster — +3 capacitor`,color:'#4488cc'});}
      }
      return checkWinner(ns);
    });
    spawnParticles('hand',card.color,12);
    if(!['draw2','coresurge'].includes(card.ability)) setTimeout(()=>triggerFx('chroma',450),80);
  };

  const deployToRow = row => {
    if(!g?.pendingDeploy) return;
    const card=g.pendingDeploy;
    if(card.cost>g.player.core) return;
    setG(s=>{
      if(!s.pendingDeploy) return s;
      const c=s.pendingDeploy;
      if(c.cost>s.player.core) return s;
      const unit={...c,currentHp:c.def,tapped:c.ability!=='haste',justPlayed:c.ability!=='haste',row};
      let ns={...s,pendingDeploy:null,selectedCard:null,
        player:{...s.player,core:s.player.core-c.cost,hand:s.player.hand.filter(x=>x.uid!==c.uid),field:[...s.player.field,unit]}};
      ns=addKill(ns,{turn:s.turn,text:`🚀 Your ${c.name} on grid · ${row.toUpperCase()}`,color:'#4488cc'});
      return checkWinner(ns);
    });
    spawnParticles(row==='front'?'pFront':'pBack',card.color,14);
    if(card.ability==='haste') triggerBeam(card.color,true);
  };

  const handleTarget = (type,tUid) => {
    if(!g?.targeting) return;
    const {ability,name}=g.targeting;
    setG(s=>{
      if(!s.targeting) return s;
      const {ability:ab,name:nm}=s.targeting;
      let ns={...s,targeting:null};
      if(ab==='damage3'){
        if(type==='ai-ship'){
          const t=ns.ai.field.find(u=>u.uid===tUid);if(!t)return s;
          const hp=t.currentHp-3;
          ns={...ns,ai:{...ns.ai,field:ns.ai.field.map(u=>u.uid===tUid?{...u,currentHp:hp}:u).filter(u=>u.currentHp>0)}};
          ns=addKill(ns,{turn:s.turn,text:hp<=0?`⚡ ${nm} obliterated enemy ${t.name}`:`⚡ ${nm} hit enemy ${t.name} · 3 dmg`,color:'#44ff88'});
        } else if(type==='ai-pod'){
          ns={...ns,ai:{...ns.ai,hp:ns.ai.hp-3}};
          ns=addKill(ns,{turn:s.turn,text:`⚡ ${nm} hit enemy pod · 3 dmg`,color:'#44ff88'});
        }
      } else if(ab==='destroy'&&type==='ai-ship'){
        const t=ns.ai.field.find(u=>u.uid===tUid);if(!t)return s;
        ns={...ns,ai:{...ns.ai,field:ns.ai.field.filter(u=>u.uid!==tUid)}};
        ns=addKill(ns,{turn:s.turn,text:`💥 ${nm} obliterated enemy ${t.name}`,color:'#44ff88'});
      } else if(ab==='heal3'&&type==='player-ship'){
        const t=ns.player.field.find(u=>u.uid===tUid);if(!t)return s;
        ns={...ns,player:{...ns.player,field:ns.player.field.map(u=>u.uid===tUid?{...u,currentHp:Math.min(u.def,u.currentHp+3)}:u)}};
        ns=addKill(ns,{turn:s.turn,text:`🔧 ${nm} repped your ${t.name} · +3 HP`,color:'#4488cc'});
      }
      return checkWinner(ns);
    });
    if(ability==='damage3'){triggerBeam('#ff3355',true);setTimeout(()=>triggerFx('chroma',480),150);spawnParticles('aiFront','#ff3355',12);}
    if(ability==='destroy'){spawnParticles('aiFront','#ffaa00',18);setTimeout(()=>triggerFx('big-chroma',600),100);}
    if(ability==='heal3') spawnParticles('pFront','#88ff44',10);
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
    const primaryColor=g.player.field.find(u=>g.attackers.includes(u.uid))?.color||'#00ccff';
    setG(s=>{
      if(!s.attackers.length) return {...s,phase:'ai-turn',attackers:[]};
      const atkers=s.attackers.map(id=>s.player.field.find(u=>u.uid===id)).filter(Boolean);
      let pField=s.player.field.map(u=>s.attackers.includes(u.uid)?{...u,tapped:true}:u);
      let aiField=[...s.ai.field], aiHp=s.ai.hp;
      const kills=[], used=new Set();

      for(const atk of atkers){
        if(atk.ability==='unblockable'){
          aiHp-=atk.atk;
          kills.push({text:`👻 Your ${atk.name} NULLIFIER → enemy pod · ${atk.atk} dmg`,color:'#44ff88'});
          continue;
        }
        const aiFront=aiField.filter(u=>u.row==='front'&&!used.has(u.uid));
        const aiBack=aiField.filter(u=>u.row==='back'&&!used.has(u.uid));
        const blocker=aiFront[0]||aiBack[0];
        if(blocker){
          used.add(blocker.uid);
          const ah=atk.currentHp-blocker.atk, bh=blocker.currentHp-atk.atk;
          if(ah<=0){pField=pField.filter(u=>u.uid!==atk.uid);kills.push({text:`☠ Enemy ${blocker.name} destroyed your ${atk.name}`,color:'#ff4444'});}
          if(bh<=0){
            if(atk.ability==='crush'&&bh<0){aiHp+=bh;kills.push({text:`⚔ Your ${atk.name} DOOMSDAY · ${blocker.name} + ${Math.abs(bh)} overflow`,color:'#44ff88'});}
            else kills.push({text:`✅ Your ${atk.name} destroyed enemy ${blocker.name}`,color:'#44ff88'});
            aiField=aiField.filter(u=>u.uid!==blocker.uid);
          } else aiField=aiField.map(u=>u.uid===blocker.uid?{...u,currentHp:bh}:u);
        } else {
          aiHp-=atk.atk;
          kills.push({text:`💥 Your ${atk.name} → enemy pod · ${atk.atk} dmg`,color:'#44ff88'});
        }
      }
      let ns={...s,player:{...s.player,field:pField},ai:{...s.ai,field:aiField,hp:aiHp},attackers:[],phase:'ai-turn'};
      for(const k of kills) ns=addKill(ns,{...k,turn:s.turn});
      return checkWinner(ns);
    });
    triggerBeam(primaryColor,true);
    spawnParticles('aiFront',primaryColor,14);
    setTimeout(()=>triggerFx('chroma',400),180);
  };

  const goAttack    = () => setG(s=>({...s,phase:'player-attack',selectedCard:null,targeting:null,pendingDeploy:null}));
  const endTurn     = () => setG(s=>({...s,phase:'ai-turn',attackers:[],selectedCard:null,targeting:null,pendingDeploy:null}));
  const cancelTarget = () => setG(s=>({...s,targeting:null}));
  const cancelDeploy = () => setG(s=>({...s,pendingDeploy:null,selectedCard:null}));
  const resetGame   = () => { setStarted(false); setG(null); setParticles([]); setScreenFx(''); setBeams([]); };

  if(!started) return <IntroScreen onStart={()=>{setG(initGame());setStarted(true);}}/>;
  if(!g) return null;

  const phaseLabel={'player-play':'DEPLOY PHASE','player-attack':'ENGAGE PHASE','ai-turn':'ENEMY FLEET ACTIVE','game-over':'ENGAGEMENT OVER'}[g.phase]||g.phase;
  const isTargeting=!!g.targeting;
  const isPendingDeploy=!!g.pendingDeploy;

  const fxFilter=screenFx==='big-chroma'
    ?'drop-shadow(5px 0 0 rgba(255,50,50,.7)) drop-shadow(-5px 0 0 rgba(0,140,255,.7))'
    :screenFx==='chroma'
    ?'drop-shadow(2px 0 0 rgba(255,50,50,.5)) drop-shadow(-2px 0 0 rgba(0,140,255,.5))'
    :'none';

  // Which enemy ships can be targeted
  const aiShipTargetable = u => isTargeting && ['damage3','destroy'].includes(g.targeting.ability);
  const playerShipTargetable = u => isTargeting && g.targeting.ability==='heal3';
  const canAttack = u => g.phase==='player-attack'&&!u.tapped&&(u.row==='front'||(u.row==='back'&&u.ability==='ranged'));

  return (
    <div style={{minHeight:'100vh',background:'#01030a',color:'#c8d8e8',fontFamily:"'Exo 2',sans-serif",
      position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',
      filter:fxFilter,transition:'filter .08s ease'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;900&family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#0a1830}
        @keyframes twinkle{0%,100%{opacity:.08}50%{opacity:.5}}
        @keyframes nebulaDrift{0%{transform:translate(0,0) scale(1)}33%{transform:translate(13px,-9px) scale(1.05)}66%{transform:translate(-10px,13px) scale(.96)}100%{transform:translate(0,0) scale(1)}}
        @keyframes scanline{0%{top:-2px}100%{top:101%}}
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
        @keyframes flicker{0%,100%{opacity:1}91.5%{opacity:1}92%{opacity:.15}92.5%{opacity:1}97%{opacity:.55}97.5%{opacity:1}}
        @keyframes unitDeploy{0%{opacity:0;transform:translateY(26px) scale(.76)}65%{transform:translateY(-6px) scale(1.1)}100%{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes unitGlow{0%,100%{box-shadow:0 0 5px var(--gc),0 0 12px var(--gc)22}50%{box-shadow:0 0 14px var(--gc),0 0 30px var(--gc)44}}
        @keyframes particleOut{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(.2)}}
        @keyframes beamSlide{0%{transform:scaleX(0);opacity:1}55%{transform:scaleX(1);opacity:.9}100%{transform:scaleX(1);opacity:0}}
        @keyframes killSlide{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes targetPulse{0%,100%{border-color:var(--tc)44}50%{border-color:var(--tc)cc}}
        .card-lift{transition:transform .15s ease,box-shadow .15s ease;cursor:pointer}
        .card-lift:hover{transform:translateY(-9px) scale(1.07);z-index:20}
        .btn-eve{transition:all .18s ease}
        .btn-eve:hover:not(:disabled){filter:brightness(1.5)}
        .unit-deploy{animation:unitDeploy .42s cubic-bezier(.2,1.35,.6,1) forwards}
        .unit-glow{animation:unitGlow 2.8s ease-in-out infinite}
        .kill-entry{animation:killSlide .35s ease}
        .target-pulse{animation:targetPulse 1s ease-in-out infinite}
        .narrating{animation:pulse 1.3s infinite}
      `}</style>

      {/* BACKGROUND */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
        {NEBULAE.map((n,i)=>(
          <div key={i} style={{position:'absolute',left:n.x,top:n.y,width:n.w,height:n.h,
            background:n.color,borderRadius:'50%',filter:`blur(${i%2===0?'58px':'78px'})`,opacity:n.op,
            animation:`nebulaDrift ${n.dur} ${n.delay} ease-in-out infinite`}}/>
        ))}
        {STARS.map((s,i)=>(
          <div key={i} style={{position:'absolute',left:s.left,top:s.top,width:`${s.w}px`,height:`${s.w}px`,
            borderRadius:'50%',background:i%7===0?'#aaccff':i%4===0?'#ffddaa':'#ffffff',
            animation:`twinkle ${s.dur}s ${s.delay}s infinite`}}/>
        ))}
        <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,60,140,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,60,140,.018) 1px,transparent 1px)',backgroundSize:'48px 48px'}}/>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at center,transparent 28%,rgba(1,3,10,.88) 100%)'}}/>
      </div>
      <div style={{position:'fixed',left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(0,100,220,.08),transparent)',animation:'scanline 12s linear infinite',zIndex:1,pointerEvents:'none'}}/>

      {/* PARTICLES */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:50,overflow:'hidden'}}>
        {particles.map(p=>{const rad=p.angle*Math.PI/180;return(
          <div key={p.id} style={{position:'absolute',left:`calc(${p.x}% - ${p.size/2}px)`,top:`calc(${p.y}% - ${p.size/2}px)`,
            width:`${p.size}px`,height:`${p.size}px`,borderRadius:'50%',background:p.color,
            boxShadow:`0 0 ${p.size*2.5}px ${p.color}`,'--tx':`${Math.cos(rad)*p.dist}px`,'--ty':`${Math.sin(rad)*p.dist}px`,
            animation:`particleOut ${p.dur}s ease-out forwards`}}/>
        );})}
      </div>

      {/* BEAMS */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:40,overflow:'hidden'}}>
        {beams.map(b=>(
          <div key={b.id} style={{position:'absolute',left:0,right:0,top:b.fromPlayer?'65%':'32%',height:'2px',
            background:`linear-gradient(${b.fromPlayer?'90deg':'270deg'},transparent,${b.color},${b.color}dd,transparent)`,
            boxShadow:`0 0 10px ${b.color},0 0 25px ${b.color}77`,
            transformOrigin:b.fromPlayer?'left center':'right center',
            animation:'beamSlide .6s ease-out forwards'}}/>
        ))}
      </div>

      {/* MAIN LAYOUT */}
      <div style={{position:'relative',zIndex:2,display:'flex',gap:'10px',padding:'8px',maxWidth:'1120px',margin:'0 auto',width:'100%',height:'100vh',overflow:'hidden'}}>

        {/* LEFT: TACTICAL BOARD */}
        <div style={{flex:'0 0 530px',display:'flex',flexDirection:'column',gap:'4px',minWidth:0,overflow:'hidden'}}>

          {/* Header */}
          <div style={{textAlign:'center',paddingBottom:'3px',fontFamily:'Orbitron'}}>
            <div style={{fontSize:'7px',letterSpacing:'5px',color:'#003399',marginBottom:'1px'}}>TURN {g.turn} · {phaseLabel}</div>
            <div style={{fontSize:'15px',fontWeight:900,letterSpacing:'5px',
              background:'linear-gradient(135deg,#0088dd,#0044aa,#4488ff)',
              WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
              animation:'flicker 9s infinite'}}>NEW EDEN PROTOCOL</div>
          </div>

          {/* Enemy status */}
          <StatusBar label="HOSTILE CAPSULEER" hp={g.ai.hp} handCount={g.ai.hand.length} isPlayer={false}
            isTargetable={isTargeting&&g.targeting.ability==='damage3'}
            onTarget={()=>handleTarget('ai-pod',null)}/>

          {/* Enemy BACK row */}
          <TacticalRow
            label="LONG RANGE" ships={backOf(g.ai.field)} isPlayerRow={false}
            attackers={[]} targeting={g.targeting}
            canTargetShip={u=>aiShipTargetable(u)}
            onShipClick={u=>handleTarget('ai-ship',u.uid)}/>

          {/* Enemy FRONT row */}
          <TacticalRow
            label="FRONT LINE" ships={frontOf(g.ai.field)} isPlayerRow={false} isFront
            attackers={[]} targeting={g.targeting}
            canTargetShip={u=>aiShipTargetable(u)}
            onShipClick={u=>handleTarget('ai-ship',u.uid)}/>

          {/* Control zone */}
          <ControlZone
            phase={g.phase} attackerCount={g.attackers.length}
            aiThinking={g.phase==='ai-turn'}
            isTargeting={isTargeting} targetName={g.targeting?.name}
            isPendingDeploy={isPendingDeploy} pendingName={g.pendingDeploy?.name}
            onAttack={goAttack} onResolve={resolveAttack} onEnd={endTurn}
            onCancelTarget={cancelTarget} onCancelDeploy={cancelDeploy}
            onDeployFront={()=>deployToRow('front')} onDeployBack={()=>deployToRow('back')}/>

          {/* Player FRONT row */}
          <TacticalRow
            label="FRONT LINE" ships={frontOf(g.player.field)} isPlayerRow isFront
            attackers={g.attackers} targeting={g.targeting}
            canTargetShip={u=>playerShipTargetable(u)}
            canSelectAttacker={u=>canAttack(u)}
            onShipClick={u=>{
              if(playerShipTargetable(u)) handleTarget('player-ship',u.uid);
              else toggleAttacker(u.uid);
            }}/>

          {/* Player BACK row */}
          <TacticalRow
            label="LONG RANGE" ships={backOf(g.player.field)} isPlayerRow
            attackers={g.attackers} targeting={g.targeting}
            canTargetShip={u=>playerShipTargetable(u)}
            canSelectAttacker={u=>canAttack(u)}
            onShipClick={u=>{
              if(playerShipTargetable(u)) handleTarget('player-ship',u.uid);
              else toggleAttacker(u.uid);
            }}/>

          {/* Player status */}
          <StatusBar label="YOUR CAPSULEER" hp={g.player.hp} core={g.player.core} maxCore={g.player.maxCore} isPlayer/>

          {/* Hand */}
          <Hand cards={g.player.hand} selected={g.selectedCard} pendingDeploy={g.pendingDeploy}
            core={g.player.core} phase={g.phase}
            onSelect={selectCard} onAction={handleCardAction}/>
        </div>

        {/* RIGHT: KILL FEED */}
        <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden'}}>
          <div style={{fontFamily:'Orbitron',fontSize:'7px',letterSpacing:'4px',color:'#002255',padding:'4px 0 8px',borderBottom:'1px solid #07121f'}}>
            ◈ SCOPE KILL FEED — LIVE
          </div>

          {/* Legend */}
          <div style={{display:'flex',gap:'10px',padding:'5px 0',borderBottom:'1px solid #060e1a',marginBottom:'4px'}}>
            {[['#44ff88','YOUR KILLS'],['#ff4444','YOUR LOSSES'],['#4488cc','EVENTS']].map(([c,l])=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:'3px'}}>
                <div style={{width:'6px',height:'6px',borderRadius:'50%',background:c,boxShadow:`0 0 4px ${c}`}}/>
                <span style={{fontFamily:'Orbitron',fontSize:'5.5px',letterSpacing:'1px',color:'#1a2a38'}}>{l}</span>
              </div>
            ))}
          </div>

          {/* Positioning guide */}
          <div style={{background:'rgba(0,0,0,.3)',border:'1px solid #07121f',padding:'6px 8px',marginBottom:'6px',borderRadius:'2px'}}>
            <div style={{fontFamily:'Orbitron',fontSize:'6px',letterSpacing:'2px',color:'#1a3050',marginBottom:'4px'}}>TACTICAL GUIDE</div>
            {[
              ['FRONT LINE','Blocks incoming attacks. All ships can attack from here.'],
              ['LONG RANGE','Protected row. Only RANGED ships (Drake) can attack from here.'],
              ['NULLIFIER','Stiletto bypasses all blocking — hits pod directly.'],
              ['DOOMSDAY','Revelation bleeds excess damage through to pod.'],
            ].map(([k,v])=>(
              <div key={k} style={{display:'flex',gap:'6px',marginBottom:'2px'}}>
                <span style={{fontFamily:'Orbitron',fontSize:'6px',color:'#1e3a52',minWidth:'70px',flexShrink:0}}>{k}</span>
                <span style={{fontFamily:'Share Tech Mono',fontSize:'9px',color:'#1a2a38',lineHeight:1.4}}>{v}</span>
              </div>
            ))}
          </div>

          {/* Kill feed entries */}
          <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:'3px',paddingRight:'2px'}}>
            {g.kills.map((k,i)=>(
              <div key={k.id} className="kill-entry" style={{
                display:'flex',gap:'6px',padding:'4px 6px',
                background:i===0?'rgba(0,0,0,.35)':'transparent',
                borderLeft:`2px solid ${i===0?k.color:k.color+'33'}`,
                transition:'all .3s',
              }}>
                <span style={{fontFamily:'Orbitron',fontSize:'6px',color:'#0a1828',minWidth:'20px',flexShrink:0,paddingTop:'1px'}}>T{k.turn}</span>
                <span style={{fontFamily:'Share Tech Mono',fontSize:'10px',color:i===0?k.color:i<4?k.color+'aa':'#1a2838',lineHeight:1.4,transition:'color .4s'}}>{k.text}</span>
              </div>
            ))}
          </div>

          <button onClick={resetGame} className="btn-eve" style={{background:'transparent',border:'1px solid #06101a',color:'#0d1e2e',padding:'6px',fontFamily:'Orbitron',fontSize:'7px',letterSpacing:'2px',cursor:'pointer',marginTop:'6px'}}>
            ⏻ DISCONNECT FROM LOCAL
          </button>
        </div>
      </div>

      {g.winner&&<WinnerOverlay winner={g.winner} onReset={resetGame}/>}
    </div>
  );
}

// ── INTRO SCREEN ──────────────────────────────────────────────────────────────
function IntroScreen({onStart}) {
  return (
    <div style={{minHeight:'100vh',background:'#010208',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;900&family=Share+Tech+Mono&family=Orbitron:wght@700;900&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes nd{0%{transform:translate(0,0)}50%{transform:translate(14px,-10px)}100%{transform:translate(0,0)}}@keyframes flicker{0%,100%{opacity:1}92%{opacity:1}93%{opacity:.2}94%{opacity:1}}`}</style>
      {[{x:'8%',y:'15%',c:'#001155'},{x:'65%',y:'50%',c:'#002244'},{x:'55%',y:'5%',c:'#110033'}].map((n,i)=>(
        <div key={i} style={{position:'absolute',left:n.x,top:n.y,width:'360px',height:'260px',background:n.c,borderRadius:'50%',filter:'blur(72px)',opacity:.06,animation:`nd ${18+i*5}s ease-in-out infinite`}}/>
      ))}
      <div style={{textAlign:'center',padding:'48px',maxWidth:'480px',width:'100%',position:'relative',zIndex:2}}>
        <div style={{fontSize:'8px',letterSpacing:'7px',color:'#002244',fontFamily:'Orbitron',marginBottom:'6px'}}>CAPSULEER AUTHENTICATION</div>
        <div style={{fontSize:'26px',fontWeight:900,letterSpacing:'4px',fontFamily:'Orbitron',
          background:'linear-gradient(135deg,#0088dd,#0044aa,#4488ff)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
          animation:'flicker 7s infinite',marginBottom:'24px'}}>NEW EDEN PROTOCOL</div>
        <div style={{textAlign:'left',marginBottom:'20px'}}>
          {[
            ['FRONT / BACK ROWS','Deploy ships to front (combat) or back (protected). Only ranged ships fire from back.'],
            ['FRONT BLOCKS FIRST','Attackers must clear your front row before hitting back or your pod.'],
            ['NULLIFIER','Stiletto bypasses rows entirely — hits pod direct.'],
            ['DOOMSDAY','Revelation bleeds excess damage through to the enemy capsuleer.'],
          ].map(([k,v])=>(
            <div key={k} style={{display:'flex',gap:'10px',marginBottom:'8px',borderLeft:'1px solid #0a1828',paddingLeft:'10px'}}>
              <span style={{fontFamily:'Orbitron',fontSize:'7px',color:'#004488',minWidth:'90px',flexShrink:0,paddingTop:'2px'}}>{k}</span>
              <span style={{fontFamily:'Share Tech Mono',fontSize:'10px',color:'#1a2e40',lineHeight:1.6}}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={onStart} style={{width:'100%',background:'rgba(0,100,200,.08)',border:'1px solid #004488',color:'#0088cc',padding:'14px',fontFamily:'Orbitron',fontSize:'10px',letterSpacing:'4px',cursor:'pointer',transition:'all .2s'}}>
          ⟶ WARP IN
        </button>
      </div>
    </div>
  );
}

// ── STATUS BAR ────────────────────────────────────────────────────────────────
function StatusBar({label,hp,handCount,core,maxCore,isPlayer,isTargetable,onTarget}) {
  const hpColor=hp>12?'#00aaff':hp>6?'#ffaa22':'#ff3344';
  return (
    <div onClick={isTargetable?onTarget:undefined} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 10px',
      background:isTargetable?'rgba(255,50,50,.08)':'rgba(0,0,0,.5)',
      border:`1px solid ${isTargetable?'#ff334455':'rgba(0,80,160,.15)'}`,
      cursor:isTargetable?'pointer':'default',boxShadow:isTargetable?'0 0 18px #ff334422':'none',transition:'all .2s'}}>
      <span style={{fontFamily:'Orbitron',fontSize:'7px',letterSpacing:'3px',color:isTargetable?'#ff5566':'#0a2040'}}>
        {isTargetable?'🎯 CLICK TO TARGET POD':label}
      </span>
      <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
        <div style={{fontFamily:'Orbitron',fontSize:'14px',fontWeight:700,color:hpColor,textShadow:`0 0 10px ${hpColor}66`,transition:'color .4s'}}>{isPlayer?'♦':'☠'} {hp}</div>
        {!isPlayer&&<span style={{fontSize:'8px',color:'#0a1828',fontFamily:'Orbitron'}}>✋{handCount}</span>}
        {isPlayer&&maxCore&&<CapBar core={core} max={maxCore}/>}
      </div>
    </div>
  );
}

function CapBar({core,max}) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:'3px'}}>
      <span style={{fontFamily:'Orbitron',fontSize:'6px',color:'#0a2040',letterSpacing:'1px'}}>CAP</span>
      <div style={{display:'flex',gap:'2px'}}>
        {Array.from({length:max},(_,i)=>(
          <div key={i} style={{width:'8px',height:'8px',background:i<core?'#ffaa22':'#07100a',border:`1px solid ${i<core?'#ffaa22':'#0e1a0e'}`,boxShadow:i<core?'0 0 4px #ffaa2299':'none',transition:'all .25s'}}/>
        ))}
      </div>
      <span style={{fontFamily:'Orbitron',fontSize:'10px',fontWeight:700,color:'#ffaa22'}}>{core}/{max}</span>
    </div>
  );
}

// ── TACTICAL ROW ──────────────────────────────────────────────────────────────
function TacticalRow({label,ships,isPlayerRow,isFront,attackers,targeting,canTargetShip,canSelectAttacker,onShipClick}) {
  const isEmpty=ships.length===0;
  return (
    <div style={{display:'flex',gap:'4px',alignItems:'stretch',minHeight:isFront?'92px':'78px',
      background:isFront?'rgba(0,30,60,.22)':'rgba(0,10,20,.15)',
      border:`1px solid ${isFront?'rgba(0,80,160,.12)':'rgba(0,40,80,.08)'}`,
      borderRadius:'2px',padding:'4px'}}>
      {/* Row label */}
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        width:'20px',flexShrink:0,gap:'2px'}}>
        {label.split(' ').map((word,i)=>(
          <div key={i} style={{fontFamily:'Orbitron',fontSize:'5px',letterSpacing:'1.5px',color:isFront?'#1a3a60':'#0d2030',writingMode:'vertical-rl',textOrientation:'mixed',transform:'rotate(180deg)'}}>
            {word}
          </div>
        ))}
      </div>
      {/* Ships */}
      <div style={{flex:1,display:'flex',gap:'5px',flexWrap:'wrap',alignItems:'center'}}>
        {isEmpty&&<div style={{color:'#071018',fontFamily:'Orbitron',fontSize:'7px',margin:'auto',letterSpacing:'3px'}}>
          {isPlayerRow?`— ${label} EMPTY —`:`— ENEMY ${label} CLEAR —`}
        </div>}
        {ships.map(unit=>{
          const isAtk=attackers?.includes(unit.uid);
          const isTgt=canTargetShip?.(unit);
          const selectable=isTgt||(canSelectAttacker?.(unit));
          const bc=isAtk?'#ff6633':isTgt?'#ffaa22':unit.color;
          return (
            <div key={unit.uid}
              className={`${selectable?'card-lift':''} ${unit.justPlayed?'unit-deploy':''} unit-glow`}
              onClick={selectable?()=>onShipClick(unit):undefined}
              style={{'--gc':unit.color,'--tc':isTgt?'#ffaa22':'transparent',
                width:'66px',minHeight:isFront?'78px':'68px',
                background:`linear-gradient(160deg,#03080f,${unit.color}18)`,
                border:`1px solid ${bc}${isAtk||isTgt?'99':'66'}`,
                padding:'4px 3px',textAlign:'center',position:'relative',
                opacity:unit.tapped?.45:1,
                transform:unit.tapped?'rotate(9deg) translateY(3px)':'none',
                transition:'opacity .3s,transform .3s',cursor:selectable?'pointer':'default',
              }}>
              {isAtk&&<div style={{position:'absolute',top:'-11px',left:'50%',transform:'translateX(-50%)',fontSize:'5.5px',color:'#ff6633',fontFamily:'Orbitron',whiteSpace:'nowrap'}}>⚔ ENGAGING</div>}
              {isTgt&&<div className="target-pulse" style={{'--tc':'#ffaa22',position:'absolute',inset:0,border:'2px solid #ffaa2266',pointerEvents:'none'}}/>}
              {unit.ability==='ranged'&&<div style={{position:'absolute',top:'2px',left:'2px',fontFamily:'Orbitron',fontSize:'5px',color:unit.color,letterSpacing:'0px'}}>RANGED</div>}
              <div style={{fontSize:'18px',margin:`${unit.ability==='ranged'?'8px':isFront?'4px':'2px'} 0 2px`}}>{unit.icon}</div>
              <div style={{fontSize:'6px',fontFamily:'Orbitron',color:unit.color,lineHeight:1.2,marginBottom:'1px',textShadow:`0 0 6px ${unit.color}66`}}>{unit.name}</div>
              <div style={{fontSize:'5.5px',fontFamily:'Orbitron',color:unit.color+'77',marginBottom:'2px'}}>{unit.faction}</div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',fontWeight:700}}>
                <span style={{color:'#ff6633'}}>⚔{unit.atk}</span>
                <span style={{color:'#00aaff'}}>♦{unit.currentHp}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CONTROL ZONE ──────────────────────────────────────────────────────────────
function ControlZone({phase,attackerCount,aiThinking,isTargeting,targetName,isPendingDeploy,pendingName,onAttack,onResolve,onEnd,onCancelTarget,onCancelDeploy,onDeployFront,onDeployBack}) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
      background:'rgba(0,0,0,.35)',border:'1px solid rgba(0,80,160,.1)',padding:'6px 8px',minHeight:'58px'}}>
      {isPendingDeploy?(
        <>
          <div style={{fontFamily:'Orbitron',fontSize:'7px',color:'#0066aa',letterSpacing:'1px',textAlign:'center'}}>
            DEPLOY <span style={{color:'#44aaff'}}>{pendingName}</span> TO:
          </div>
          <EveBtn label="▲ FRONT LINE" color="#00aaff" onClick={onDeployFront}/>
          <EveBtn label="▼ LONG RANGE" color="#33ddaa" onClick={onDeployBack}/>
          <EveBtn label="✕" color="#ff6633" onClick={onCancelDeploy}/>
        </>
      ):isTargeting?(
        <>
          <div style={{fontFamily:'Orbitron',fontSize:'7px',color:'#ffaa22',textAlign:'center',letterSpacing:'1px'}}>🎯 {targetName} — select target</div>
          <EveBtn label="✕ CANCEL" color="#ffaa22" onClick={onCancelTarget}/>
        </>
      ):(
        <>
          {phase==='player-play'   &&<EveBtn label="⚔ ENGAGE" color="#ff6633" onClick={onAttack}/>}
          {phase==='player-attack' &&<EveBtn label={`✓ RESOLVE (${attackerCount} attacking)`} color="#ff6633" onClick={onResolve} active/>}
          <EveBtn label={aiThinking?'⟳ ENEMY FLEET ACTIVE':'END TURN ▶'} color="#0088cc" disabled={phase==='ai-turn'||phase==='game-over'} onClick={onEnd}/>
          {phase==='player-attack'&&<div style={{fontFamily:'Share Tech Mono',fontSize:'9px',color:'#1a2a38'}}>Click ships to select attackers · Front row + Ranged only</div>}
          {phase==='player-play'&&<div style={{fontFamily:'Share Tech Mono',fontSize:'9px',color:'#1a2a38'}}>Click card → select row to deploy · or click ENGAGE</div>}
        </>
      )}
    </div>
  );
}

function EveBtn({label,color,disabled,onClick,active}){
  return <button onClick={onClick} disabled={disabled} className="btn-eve" style={{background:active?`${color}18`:'rgba(0,0,0,.4)',border:`1px solid ${disabled?'#0a0f18':color+'55'}`,color:disabled?'#0d1828':color,padding:'6px 10px',fontFamily:'Orbitron',fontSize:'7.5px',letterSpacing:'1.5px',cursor:disabled?'not-allowed':'pointer',flexShrink:0,boxShadow:active?`0 0 10px ${color}44`:'none'}}>{label}</button>;
}

// ── HAND ──────────────────────────────────────────────────────────────────────
function Hand({cards,selected,pendingDeploy,core,phase,onSelect,onAction}) {
  return (
    <div style={{display:'flex',gap:'4px',padding:'3px 0 4px',overflowX:'auto',alignItems:'flex-end',minHeight:'112px',flexShrink:0}}>
      {cards.length===0&&<div style={{color:'#080f18',fontFamily:'Orbitron',fontSize:'7px',margin:'auto',letterSpacing:'3px'}}>NO CARDS IN RESERVE</div>}
      {cards.map(card=>{
        const isPending=pendingDeploy?.uid===card.uid;
        const sel=selected===card.uid||isPending;
        const affordable=card.cost<=core;
        const canPlay=affordable&&phase==='player-play';
        return (
          <div key={card.uid} className="card-lift"
            onClick={sel&&canPlay?()=>onAction(card.uid):()=>onSelect(card.uid)}
            style={{width:'72px',minHeight:'100px',flexShrink:0,
              background:sel?`linear-gradient(160deg,${card.color}22,${card.color}0a)`:'linear-gradient(160deg,#07090f,#03050a)',
              border:`1px solid ${sel?card.color:isPending?card.color+'88':'#0d1520'}`,
              padding:'5px 3px',
              boxShadow:sel?`0 0 20px ${card.color}55,0 0 42px ${card.color}18,0 -5px 16px ${card.color}28`:'0 2px 8px rgba(0,0,0,.7)',
              opacity:!affordable&&!sel?.28:1,transform:sel?'translateY(-13px)':'none',position:'relative',textAlign:'center'}}>
            <div style={{position:'absolute',top:'2px',right:'2px',background:'#ffaa2212',border:'1px solid #ffaa2244',padding:'0 3px',color:'#ffaa22',fontFamily:'Orbitron',fontSize:'7px',fontWeight:700}}>{card.cost}</div>
            <div style={{position:'absolute',top:'3px',left:'3px',width:'5px',height:'5px',background:card.color,boxShadow:`0 0 5px ${card.color}`,clipPath:'polygon(50% 0%,100% 50%,50% 100%,0% 50%)'}}/>
            <div style={{fontSize:'19px',margin:'5px 0 2px'}}>{card.icon}</div>
            <div style={{fontSize:'6.5px',fontFamily:'Orbitron',color:card.color,lineHeight:1.2,marginBottom:'1px',textShadow:`0 0 7px ${card.color}66`}}>{card.name}</div>
            {card.faction&&<div style={{fontSize:'5.5px',fontFamily:'Orbitron',color:card.color+'66',marginBottom:'2px'}}>{card.faction}</div>}
            {card.type==='ship'&&<div style={{display:'flex',justifyContent:'center',gap:'4px',fontSize:'9px',fontWeight:700,marginBottom:'1px'}}><span style={{color:'#ff6633'}}>⚔{card.atk}</span><span style={{color:'#00aaff'}}>♦{card.def}</span></div>}
            <div style={{fontSize:'5.5px',color:'#1a2e3e',lineHeight:1.3,marginBottom:'2px'}}>{card.effect}</div>
            {sel&&card.type==='ship'&&canPlay&&!isPending&&<div style={{position:'absolute',bottom:'-13px',left:'50%',transform:'translateX(-50%)',fontSize:'6px',color:'#00aaff',fontFamily:'Orbitron',whiteSpace:'nowrap'}}>▲ CHOOSE ROW</div>}
            {sel&&card.type==='module'&&canPlay&&<div style={{position:'absolute',bottom:'-13px',left:'50%',transform:'translateX(-50%)',fontSize:'6px',color:'#00aaff',fontFamily:'Orbitron',whiteSpace:'nowrap'}}>▲ ACTIVATE</div>}
            {isPending&&<div style={{position:'absolute',bottom:'-13px',left:'50%',transform:'translateX(-50%)',fontSize:'6px',color:'#33ddaa',fontFamily:'Orbitron',whiteSpace:'nowrap'}}>DEPLOYING...</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── WINNER OVERLAY ────────────────────────────────────────────────────────────
function WinnerOverlay({winner,onReset}) {
  const won=winner==='player';
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,1,8,.97)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:200,fontFamily:'Orbitron'}}>
      <div style={{fontSize:'48px',marginBottom:'12px'}}>{won?'🏆':'💀'}</div>
      <div style={{fontSize:'9px',letterSpacing:'6px',color:won?'#0088ff':'#ff3344',marginBottom:'4px'}}>{won?'GF IN LOCAL':'PODDED'}</div>
      <div style={{fontSize:'28px',fontWeight:900,letterSpacing:'4px',
        background:won?'linear-gradient(135deg,#00aaff,#44ccff)':'linear-gradient(135deg,#ff3344,#ff7744)',
        WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:'6px'}}>
        {won?'VICTORY':'DEFEAT'}
      </div>
      <div style={{fontFamily:'Share Tech Mono',fontSize:'11px',color:'#1a2e40',marginBottom:'28px',textAlign:'center'}}>
        {won?'Sovereignty secured. Clone contract expired.':'Ship destroyed. Pod express activated.'}
      </div>
      <button onClick={onReset} style={{background:'rgba(0,100,200,.08)',border:'1px solid #004488',color:'#0088cc',padding:'11px 32px',fontFamily:'Orbitron',fontSize:'9px',letterSpacing:'3px',cursor:'pointer'}}>
        ↺ RESHIP &amp; REDOCK
      </button>
    </div>
  );
}
