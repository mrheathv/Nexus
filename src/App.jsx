import { useState, useEffect, useRef, useCallback } from "react";

// ── CARDS ─────────────────────────────────────────────────────────────────────
const CARDS = [
  {id:'merlin',    name:'Merlin',        cost:1,type:'ship',  atk:1,def:2,color:'#38bdf8',icon:'🚀',ability:'haste',      faction:'Caldari', defaultRow:'front',effect:'Afterburner — attacks the turn it lands'},
  {id:'punisher',  name:'Punisher',      cost:2,type:'ship',  atk:1,def:4,color:'#fbbf24',icon:'🛡️',ability:null,         faction:'Amarr',   defaultRow:'front',effect:'Armor Tank — tough front-line brawler'},
  {id:'stiletto',  name:'Stiletto',      cost:3,type:'ship',  atk:3,def:2,color:'#c084fc',icon:'👻',ability:'unblockable',faction:'Minmatar',defaultRow:'front',effect:'Nullifier — bypasses all blockers'},
  {id:'drake',     name:'Drake',         cost:3,type:'ship',  atk:2,def:3,color:'#34d399',icon:'🎯',ability:'ranged',     faction:'Caldari', defaultRow:'back', effect:'Heavy Missiles — fires from back row'},
  {id:'revelation',name:'Revelation',    cost:6,type:'ship',  atk:5,def:5,color:'#f97316',icon:'🌟',ability:'crush',     faction:'Amarr',   defaultRow:'front',effect:'Doomsday — excess damage hits the pod'},
  {id:'disruptor', name:'Warp Disruptor',cost:2,type:'module',color:'#f43f5e',icon:'⚡',ability:'damage3',effect:'Lock & fire — 3 damage to anything'},
  {id:'analyzer',  name:'Data Analyzer', cost:1,type:'module',color:'#60a5fa',icon:'📡',ability:'draw2',  effect:'Hack local — draw 2 cards'},
  {id:'smartbomb', name:'Smartbomb',     cost:3,type:'module',color:'#fb923c',icon:'💥',ability:'destroy',effect:'Area pulse — destroy any ship'},
  {id:'repair',    name:'Rem. Repair',   cost:2,type:'module',color:'#4ade80',icon:'🔧',ability:'heal3',  effect:'Remote reps — restore 3 HP to a ship'},
  {id:'cap_boost', name:'Cap Booster',   cost:0,type:'module',color:'#facc15',icon:'🔋',ability:'coresurge',effect:'Charge inject — gain 3 cap this turn'},
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
const frontOf = f => f.filter(u=>u.row==='front');
const backOf  = f => f.filter(u=>u.row==='back');
const addToast = (g,msg,color='#60a5fa') => ({
  ...g, toasts:[{id:uid(),msg,color,ts:Date.now()},...g.toasts].slice(0,8)
});

// ── STARS ─────────────────────────────────────────────────────────────────────
const STARS = Array.from({length:80},(_,i)=>({
  left:`${(i*41+7)%100}%`,top:`${(i*61+11)%100}%`,
  w:(i%5)*.5+.2,delay:(i%7)*.6,dur:2.5+(i%6)*.9,
  blue:i%6===0,gold:i%9===0
}));

// ── AI LOGIC ──────────────────────────────────────────────────────────────────
function aiPlayCards(g) {
  let hand=[...g.ai.hand],field=[...g.ai.field],deck=[...g.ai.deck];
  let pField=[...g.player.field],pHp=g.player.hp,core=g.ai.core;
  const toasts=[];
  for(const card of [...hand].filter(c=>c.cost<=core).sort((a,b)=>b.cost-a.cost)) {
    if(card.cost>core) continue;
    core-=card.cost; hand=hand.filter(c=>c.uid!==card.uid);
    if(card.type==='ship') {
      const row=card.ability==='ranged'?'back':'front';
      field.push({...card,currentHp:card.def,tapped:false,justPlayed:true,row});
      toasts.push({msg:`Enemy deploys ${card.name}`,color:'#94a3b8'});
    } else {
      switch(card.ability){
        case 'draw2': for(let i=0;i<2&&deck.length;i++) hand.push(deck.shift()); toasts.push({msg:`Enemy Data Analyzer — draws 2`,color:'#94a3b8'}); break;
        case 'coresurge': core+=3; toasts.push({msg:`Enemy Cap Booster — +3 cap`,color:'#94a3b8'}); break;
        case 'damage3': {
          const pool=frontOf(pField).length?frontOf(pField):backOf(pField);
          if(pool.length){const t=pool.reduce((a,b)=>a.currentHp<b.currentHp?a:b);const hp=t.currentHp-3;pField=pField.map(u=>u.uid===t.uid?{...u,currentHp:hp}:u).filter(u=>u.currentHp>0);toasts.push({msg:hp<=0?`Enemy Disruptor destroyed your ${t.name}`:`Enemy Disruptor hit ${t.name} for 3`,color:'#f87171'});}
          else{pHp-=3;toasts.push({msg:`Enemy Disruptor hits your pod — 3 dmg`,color:'#f87171'});}
          break;
        }
        case 'destroy': {
          const pool=frontOf(pField).length?frontOf(pField):backOf(pField);
          if(pool.length){const t=pool.reduce((a,b)=>a.atk>b.atk?a:b);pField=pField.filter(u=>u.uid!==t.uid);toasts.push({msg:`Enemy Smartbomb destroyed your ${t.name}`,color:'#f87171'});}
          break;
        }
        case 'heal3': {
          if(field.length){const t=field.reduce((a,b)=>a.currentHp<b.currentHp?a:b);field=field.map(u=>u.uid===t.uid?{...u,currentHp:Math.min(u.def,u.currentHp+3)}:u);toasts.push({msg:`Enemy repped ${t.name} +3 HP`,color:'#94a3b8'});}
          break;
        }
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
  let pField=[...g.player.field],pHp=g.player.hp;
  const toasts=[],used=new Set();
  for(const atk of eligible){
    if(atk.ability==='unblockable'){pHp-=atk.atk;toasts.push({msg:`${atk.name} NULLIFIER → your pod -${atk.atk}`,color:'#f87171'});continue;}
    const blocker=frontOf(pField).find(u=>!used.has(u.uid))||backOf(pField).find(u=>!used.has(u.uid));
    if(blocker){
      used.add(blocker.uid);
      const ah=atk.currentHp-blocker.atk,bh=blocker.currentHp-atk.atk;
      if(ah<=0){aiField=aiField.filter(u=>u.uid!==atk.uid);toasts.push({msg:`Your ${blocker.name} destroyed enemy ${atk.name}`,color:'#4ade80'});}
      if(bh<=0){
        if(atk.ability==='crush'&&bh<0){pHp+=bh;toasts.push({msg:`DOOMSDAY — ${blocker.name} gone + ${Math.abs(bh)} overflow`,color:'#f87171'});}
        else toasts.push({msg:`Enemy ${atk.name} destroyed your ${blocker.name}`,color:'#f87171'});
        pField=pField.filter(u=>u.uid!==blocker.uid);
      } else pField=pField.map(u=>u.uid===blocker.uid?{...u,currentHp:bh}:u);
    } else {pHp-=atk.atk;toasts.push({msg:`Enemy ${atk.name} → your pod -${atk.atk}`,color:'#f87171'});}
  }
  return {state:{...g,ai:{...g.ai,field:aiField},player:{...g.player,field:pField,hp:pHp}},toasts};
}

function runAiTurn(s) {
  let g={...s};
  g=drawN(g,'ai',1);
  const newMax=Math.min(10,g.ai.maxCore+1);
  g={...g,ai:{...g.ai,maxCore:newMax,core:newMax,field:g.ai.field.map(u=>({...u,tapped:false,justPlayed:false}))}};
  const {state:s2,toasts:t1}=aiPlayCards(g); g=s2;
  const {state:s3,toasts:t2}=aiDoAttack(g); g=s3;
  for(const t of [...t1,...t2]) g=addToast(g,t.msg,t.color);
  g=checkWinner(g);
  if(g.phase!=='game-over'){
    const t=g.turn+1,pm=Math.min(10,g.player.maxCore+1);
    g=drawN(g,'player',1);
    g={...g,phase:'player-play',turn:t,aiThinking:false,attackers:[],selectedCard:null,pendingDeploy:null,
      player:{...g.player,maxCore:pm,core:pm,field:g.player.field.map(u=>({...u,tapped:false,justPlayed:false}))}};
    g=addToast(g,`Turn ${t} — your move, capsuleer`,'#38bdf8');
  } else g={...g,aiThinking:false};
  return {newState:g};
}

function initGame() {
  let s={
    phase:'player-play',turn:1,winner:null,aiThinking:false,
    selectedCard:null,pendingDeploy:null,attackers:[],targeting:null,
    toasts:[{id:uid(),msg:'Fleet engaged in New Eden local',color:'#38bdf8',ts:Date.now()}],
    player:{hp:20,core:1,maxCore:1,deck:buildDeck(),hand:[],field:[]},
    ai:   {hp:20,core:1,maxCore:1,deck:buildDeck(),hand:[],field:[]},
  };
  s=drawN(s,'player',5); s=drawN(s,'ai',5);
  return s;
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,   setScreen]   = useState('intro'); // 'intro'|'game'|'over'
  const [g,        setG]        = useState(null);
  const [particles,setParticles]= useState([]);
  const [beams,    setBeams]    = useState([]);
  const [screenFx, setScreenFx] = useState('');
  const aiLockRef = useRef(false);
  const timerRef  = useRef(null);

  // ── FX HELPERS ──────────────────────────────────────────────────────────────
  const spawnParticles = useCallback((zone,color,n=10)=>{
    const Z={aiBack:{x:50,y:18},aiFront:{x:50,y:32},pFront:{x:50,y:58},pBack:{x:50,y:72},hand:{x:50,y:88}};
    const {x,y}=Z[zone]||{x:50,y:50};
    const ps=Array.from({length:n},(_,i)=>({id:uid(),x,y,angle:(i/n)*360,dist:40+Math.random()*80,color,size:2.5+Math.random()*4,dur:.4+Math.random()*.4}));
    setParticles(p=>[...p,...ps]);
    setTimeout(()=>setParticles(p=>p.filter(x=>!ps.find(n=>n.id===x.id))),900);
  },[]);

  const triggerFx = useCallback((fx,d=500)=>{setScreenFx(fx);setTimeout(()=>setScreenFx(''),d);},[]);
  const triggerBeam = useCallback((color,fromPlayer=true)=>{
    const id=uid();
    setBeams(b=>[...b,{id,color,fromPlayer}]);
    setTimeout(()=>setBeams(b=>b.filter(x=>x.id!==id)),650);
  },[]);

  // ── AI TURN ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!g||g.phase!=='ai-turn') return;
    if(aiLockRef.current) return;
    aiLockRef.current=true;
    const snap=g;
    timerRef.current=setTimeout(()=>{
      try{
        const {newState}=runAiTurn(snap);
        const prevHp=snap.player.hp;
        setG(newState);
        aiLockRef.current=false;
        if(newState.player.hp<prevHp){
          const d=prevHp-newState.player.hp;
          triggerBeam(d>=3?'#f43f5e':'#fb923c',false);
          setTimeout(()=>triggerFx(d>=3?'big-chroma':'chroma',d>=3?700:480),180);
          spawnParticles('pFront','#f43f5e',d>=3?14:8);
        }
        if(newState.winner) setScreen('over');
      }catch(err){
        console.error(err);
        aiLockRef.current=false;
        setG(s=>({...s,phase:'player-play',turn:s.turn+1,player:{...s.player,core:s.player.maxCore}}));
      }
    },1600);
    return()=>{clearTimeout(timerRef.current);aiLockRef.current=false;};
  },[g?.phase]);

  // ── ACTIONS ──────────────────────────────────────────────────────────────────
  const startGame = () => { setG(initGame()); setScreen('game'); };
  const resetGame = () => { setG(null); setScreen('intro'); setParticles([]); setBeams([]); setScreenFx(''); aiLockRef.current=false; };

  const selectCard = uid => {
    if(!g||g.phase!=='player-play'||g.targeting||g.pendingDeploy) return;
    setG(s=>({...s,selectedCard:s.selectedCard===uid?null:uid}));
  };

  const activateCard = cUid => {
    if(!g||g.phase!=='player-play') return;
    const card=g.player.hand.find(c=>c.uid===cUid);
    if(!card||card.cost>g.player.core) return;
    if(card.type==='ship'){setG(s=>({...s,pendingDeploy:card,selectedCard:null}));return;}
    setG(s=>{
      const c=s.player.hand.find(x=>x.uid===cUid);
      if(!c||c.cost>s.player.core) return s;
      let ns={...s,selectedCard:null,pendingDeploy:null,
        player:{...s.player,core:s.player.core-c.cost,hand:s.player.hand.filter(x=>x.uid!==cUid)}};
      if(['damage3','destroy','heal3'].includes(c.ability)){ns={...ns,targeting:{ability:c.ability,name:c.name}};}
      else{
        if(c.ability==='draw2'){ns=drawN(ns,'player',2);ns=addToast(ns,'Data Analyzer — you draw 2','#60a5fa');}
        if(c.ability==='coresurge'){ns={...ns,player:{...ns.player,core:ns.player.core+3}};ns=addToast(ns,'Cap Booster — +3 cap','#facc15');}
      }
      return checkWinner(ns);
    });
    spawnParticles('hand',card.color,12);
  };

  const deployToRow = row => {
    if(!g?.pendingDeploy) return;
    const card=g.pendingDeploy;
    setG(s=>{
      if(!s.pendingDeploy||s.pendingDeploy.cost>s.player.core) return s;
      const c=s.pendingDeploy;
      const unit={...c,currentHp:c.def,tapped:c.ability!=='haste',justPlayed:c.ability!=='haste',row};
      let ns={...s,pendingDeploy:null,selectedCard:null,
        player:{...s.player,core:s.player.core-c.cost,hand:s.player.hand.filter(x=>x.uid!==c.uid),field:[...s.player.field,unit]}};
      ns=addToast(ns,`${c.name} on grid — ${row.toUpperCase()}`,'#60a5fa');
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
        if(type==='ai-ship'){const t=ns.ai.field.find(u=>u.uid===tUid);if(!t)return s;const hp=t.currentHp-3;ns={...ns,ai:{...ns.ai,field:ns.ai.field.map(u=>u.uid===tUid?{...u,currentHp:hp}:u).filter(u=>u.currentHp>0)}};ns=addToast(ns,hp<=0?`${nm} destroyed enemy ${t.name}`:`${nm} hit ${t.name} for 3`,'#4ade80');}
        else if(type==='ai-pod'){ns={...ns,ai:{...ns.ai,hp:ns.ai.hp-3}};ns=addToast(ns,`${nm} hits enemy pod — 3 dmg`,'#4ade80');}
      }else if(ab==='destroy'&&type==='ai-ship'){const t=ns.ai.field.find(u=>u.uid===tUid);if(!t)return s;ns={...ns,ai:{...ns.ai,field:ns.ai.field.filter(u=>u.uid!==tUid)}};ns=addToast(ns,`${nm} obliterated ${t.name}`,'#4ade80');}
      else if(ab==='heal3'&&type==='player-ship'){const t=ns.player.field.find(u=>u.uid===tUid);if(!t)return s;ns={...ns,player:{...ns.player,field:ns.player.field.map(u=>u.uid===tUid?{...u,currentHp:Math.min(u.def,u.currentHp+3)}:u)}};ns=addToast(ns,`${nm} repped ${t.name} +3 HP`,'#4ade80');}
      return checkWinner(ns);
    });
    if(ability==='damage3'){triggerBeam('#f43f5e',true);setTimeout(()=>triggerFx('chroma',480),140);spawnParticles('aiFront','#f43f5e',12);}
    if(ability==='destroy'){spawnParticles('aiFront','#fb923c',18);setTimeout(()=>triggerFx('big-chroma',600),100);}
    if(ability==='heal3') spawnParticles('pFront','#4ade80',10);
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
    const color=g.player.field.find(u=>g.attackers.includes(u.uid))?.color||'#38bdf8';
    setG(s=>{
      if(!s.attackers.length) return {...s,phase:'ai-turn',attackers:[]};
      const atkers=s.attackers.map(id=>s.player.field.find(u=>u.uid===id)).filter(Boolean);
      let pField=s.player.field.map(u=>s.attackers.includes(u.uid)?{...u,tapped:true}:u);
      let aiField=[...s.ai.field],aiHp=s.ai.hp;
      const toasts=[],used=new Set();
      for(const atk of atkers){
        if(atk.ability==='unblockable'){aiHp-=atk.atk;toasts.push({msg:`${atk.name} NULLIFIER → enemy pod -${atk.atk}`,color:'#4ade80'});continue;}
        const blocker=frontOf(aiField).find(u=>!used.has(u.uid))||backOf(aiField).find(u=>!used.has(u.uid));
        if(blocker){
          used.add(blocker.uid);
          const ah=atk.currentHp-blocker.atk,bh=blocker.currentHp-atk.atk;
          if(ah<=0){pField=pField.filter(u=>u.uid!==atk.uid);toasts.push({msg:`Enemy ${blocker.name} destroyed your ${atk.name}`,color:'#f87171'});}
          if(bh<=0){
            if(atk.ability==='crush'&&bh<0){aiHp+=bh;toasts.push({msg:`DOOMSDAY — ${blocker.name} + ${Math.abs(bh)} overflow`,color:'#4ade80'});}
            else toasts.push({msg:`Your ${atk.name} destroyed ${blocker.name}`,color:'#4ade80'});
            aiField=aiField.filter(u=>u.uid!==blocker.uid);
          } else aiField=aiField.map(u=>u.uid===blocker.uid?{...u,currentHp:bh}:u);
        } else {aiHp-=atk.atk;toasts.push({msg:`${atk.name} → enemy pod -${atk.atk}`,color:'#4ade80'});}
      }
      let ns={...s,player:{...s.player,field:pField},ai:{...s.ai,field:aiField,hp:aiHp},attackers:[],phase:'ai-turn'};
      for(const t of toasts) ns=addToast(ns,t.msg,t.color);
      ns=checkWinner(ns);
      if(ns.winner) setTimeout(()=>setScreen('over'),800);
      return ns;
    });
    triggerBeam(color,true);
    spawnParticles('aiFront',color,14);
    setTimeout(()=>triggerFx('chroma',400),180);
  };

  const goAttack  = () => setG(s=>({...s,phase:'player-attack',selectedCard:null,targeting:null,pendingDeploy:null}));
  const endTurn   = () => setG(s=>({...s,phase:'ai-turn',attackers:[],selectedCard:null,targeting:null,pendingDeploy:null}));
  const cancelTgt = () => setG(s=>({...s,targeting:null}));
  const cancelDeploy = () => setG(s=>({...s,pendingDeploy:null,selectedCard:null}));

  // ── RENDER SCREENS ───────────────────────────────────────────────────────────
  if(screen==='intro') return <IntroScreen onStart={startGame}/>;
  if(screen==='over'&&g) return <GameOverScreen winner={g.winner} onReset={resetGame}/>;
  if(!g) return null;

  const isTargeting=!!g.targeting;
  const isPending=!!g.pendingDeploy;
  const isAiTurn=g.phase==='ai-turn';
  const fxFilter=screenFx==='big-chroma'
    ?'drop-shadow(6px 0 0 rgba(244,63,94,.7)) drop-shadow(-6px 0 0 rgba(56,189,248,.7))'
    :screenFx==='chroma'
    ?'drop-shadow(3px 0 0 rgba(244,63,94,.5)) drop-shadow(-3px 0 0 rgba(56,189,248,.5))'
    :'none';

  const canTargetAiShip = () => isTargeting&&['damage3','destroy'].includes(g.targeting.ability);
  const canTargetPlayerShip = () => isTargeting&&g.targeting.ability==='heal3';
  const canAttack = u => g.phase==='player-attack'&&!u.tapped&&(u.row==='front'||(u.row==='back'&&u.ability==='ranged'));

  return (
    <div style={{width:'100vw',height:'100vh',background:'#060d1a',color:'#e2e8f0',
      fontFamily:"'Barlow Condensed',sans-serif",position:'relative',overflow:'hidden',
      display:'flex',flexDirection:'column',filter:fxFilter,transition:'filter .08s'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Orbitron:wght@700;900&family=Share+Tech+Mono&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:0}
        @keyframes twinkle{0%,100%{opacity:.06}50%{opacity:.45}}
        @keyframes deployIn{0%{opacity:0;transform:translateY(-30px) scale(.8)}70%{transform:translateY(4px) scale(1.05)}100%{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes deployInUp{0%{opacity:0;transform:translateY(30px) scale(.8)}70%{transform:translateY(-4px) scale(1.05)}100%{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes glow{0%,100%{box-shadow:0 0 8px var(--gc)}50%{box-shadow:0 0 20px var(--gc),0 0 40px var(--gc)44}}
        @keyframes pOut{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(var(--tx),var(--ty))}}
        @keyframes beam{0%{transform:scaleX(0);opacity:1}60%{transform:scaleX(1);opacity:.85}100%{opacity:0}}
        @keyframes toastIn{0%{opacity:0;transform:translateX(30px)}100%{opacity:1;transform:translateX(0)}}
        @keyframes toastOut{0%{opacity:1}100%{opacity:0}}
        @keyframes hpPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
        @keyframes aiThink{0%,100%{opacity:.4}50%{opacity:1}}
        .card{transition:transform .15s,box-shadow .15s;cursor:pointer;position:relative}
        .card:hover{transform:translateY(-14px) scale(1.08)!important;z-index:30}
        .card-sel{transform:translateY(-18px) scale(1.1)!important;z-index:30}
        .ship-card{transition:transform .2s,box-shadow .2s,opacity .2s;cursor:pointer}
        .ship-card:hover{transform:scale(1.06)translateY(-4px);z-index:20}
        .deploy-enemy{animation:deployIn .4s cubic-bezier(.2,1.4,.5,1) forwards}
        .deploy-player{animation:deployInUp .4s cubic-bezier(.2,1.4,.5,1) forwards}
        .btn{transition:all .15s;cursor:pointer;font-family:'Orbitron',sans-serif}
        .btn:hover:not(:disabled){filter:brightness(1.3);transform:translateY(-1px)}
        .btn:disabled{opacity:.35;cursor:not-allowed}
        .glow-anim{animation:glow 2.5s ease-in-out infinite}
        .ai-thinking{animation:aiThink 1s ease-in-out infinite}
      `}</style>

      {/* STARFIELD */}
      <div style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none'}}>
        {STARS.map((s,i)=>(
          <div key={i} style={{position:'absolute',left:s.left,top:s.top,
            width:`${s.w}px`,height:`${s.w}px`,borderRadius:'50%',
            background:s.blue?'#93c5fd':s.gold?'#fcd34d':'#fff',
            animation:`twinkle ${s.dur}s ${s.delay}s infinite`}}/>
        ))}
        {/* Subtle space gradient bands */}
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 80% 50% at 20% 50%, rgba(30,58,138,.15) 0%, transparent 60%)'}}/>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 60% 40% at 80% 30%, rgba(88,28,135,.1) 0%, transparent 60%)'}}/>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at center, transparent 40%, rgba(6,13,26,.7) 100%)'}}/>
      </div>

      {/* PARTICLES */}
      <div style={{position:'fixed',inset:0,zIndex:60,pointerEvents:'none'}}>
        {particles.map(p=>{const r=p.angle*Math.PI/180;return(
          <div key={p.id} style={{position:'absolute',
            left:`calc(${p.x}% - ${p.size/2}px)`,top:`calc(${p.y}% - ${p.size/2}px)`,
            width:`${p.size}px`,height:`${p.size}px`,borderRadius:'50%',
            background:p.color,boxShadow:`0 0 ${p.size*3}px ${p.color}`,
            '--tx':`${Math.cos(r)*p.dist}px`,'--ty':`${Math.sin(r)*p.dist}px`,
            animation:`pOut ${p.dur}s ease-out forwards`}}/>
        );})}
      </div>

      {/* BEAMS */}
      <div style={{position:'fixed',inset:0,zIndex:55,pointerEvents:'none'}}>
        {beams.map(b=>(
          <div key={b.id} style={{position:'absolute',left:0,right:0,
            top:b.fromPlayer?'60%':'38%',height:'3px',
            background:`linear-gradient(${b.fromPlayer?90:270}deg,transparent,${b.color}ee,transparent)`,
            boxShadow:`0 0 12px ${b.color},0 0 30px ${b.color}66`,
            transformOrigin:b.fromPlayer?'left':'right',
            animation:'beam .6s ease-out forwards'}}/>
        ))}
      </div>

      {/* TOAST NOTIFICATIONS */}
      <div style={{position:'fixed',top:'12px',right:'12px',zIndex:70,
        display:'flex',flexDirection:'column',gap:'4px',alignItems:'flex-end',pointerEvents:'none'}}>
        {g.toasts.slice(0,5).map((t,i)=>(
          <Toast key={t.id} toast={t} index={i}/>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN BOARD — top enemy, bottom player like MTG Arena / Hearthstone
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{position:'relative',zIndex:2,display:'flex',flexDirection:'column',
        height:'100vh',padding:'8px 12px',gap:'4px'}}>

        {/* ── ENEMY STATUS ROW ── */}
        <div style={{display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
          {/* Enemy portrait */}
          <div style={{width:'48px',height:'48px',borderRadius:'50%',flexShrink:0,
            background:'linear-gradient(135deg,#1e1b4b,#312e81)',
            border:'2px solid #4338ca55',
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:'0 0 20px #4338ca33',fontSize:'22px'}}>☠</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Orbitron',fontSize:'9px',letterSpacing:'3px',color:'#475569',marginBottom:'2px'}}>HOSTILE CAPSULEER</div>
            <HPBar hp={g.ai.hp} max={20} color='#f43f5e'
              isTargetable={isTargeting&&g.targeting.ability==='damage3'}
              onTarget={()=>handleTarget('ai-pod',null)}/>
          </div>
          {/* Enemy hand count */}
          <div style={{textAlign:'center',padding:'4px 10px',background:'rgba(0,0,0,.4)',
            border:'1px solid #1e293b',borderRadius:'6px'}}>
            <div style={{fontFamily:'Share Tech Mono',fontSize:'18px',color:'#334155',lineHeight:1}}>
              {g.ai.hand.length}
            </div>
            <div style={{fontFamily:'Orbitron',fontSize:'6px',color:'#1e293b',letterSpacing:'1px',marginTop:'1px'}}>HAND</div>
          </div>
          {/* Turn/phase indicator */}
          <div style={{textAlign:'center',padding:'4px 12px',
            background:isAiTurn?'rgba(244,63,94,.1)':'rgba(56,189,248,.06)',
            border:`1px solid ${isAiTurn?'#f43f5e44':'#38bdf844'}`,borderRadius:'6px',minWidth:'100px'}}>
            <div style={{fontFamily:'Orbitron',fontSize:'8px',letterSpacing:'2px',
              color:isAiTurn?'#f43f5e':'#38bdf8',
              ...(isAiTurn?{animation:'aiThink 1s infinite'}:{})}}>
              {isAiTurn?'ENEMY TURN':`TURN ${g.turn}`}
            </div>
            <div style={{fontFamily:'Orbitron',fontSize:'6px',color:'#1e293b',letterSpacing:'1px',marginTop:'2px'}}>
              {isAiTurn?'PROCESSING':{
                'player-play':'DEPLOY',
                'player-attack':'ENGAGE',
                'game-over':'ENDED'
              }[g.phase]||g.phase}
            </div>
          </div>
        </div>

        {/* ── ENEMY FLEET ZONES ── */}
        <FleetZone
          label="LONG RANGE"
          ships={backOf(g.ai.field)}
          isPlayer={false} isBack
          attackers={[]}
          canTargetShip={canTargetAiShip()}
          onShipClick={u=>handleTarget('ai-ship',u.uid)}/>

        <FleetZone
          label="FRONT LINE"
          ships={frontOf(g.ai.field)}
          isPlayer={false}
          attackers={[]}
          canTargetShip={canTargetAiShip()}
          onShipClick={u=>handleTarget('ai-ship',u.uid)}/>

        {/* ── ACTION BAR ── */}
        <ActionBar
          phase={g.phase}
          isPending={isPending}
          pendingName={g.pendingDeploy?.name}
          isTargeting={isTargeting}
          targetName={g.targeting?.name}
          attackerCount={g.attackers.length}
          isAiTurn={isAiTurn}
          onAttack={goAttack}
          onResolve={resolveAttack}
          onEndTurn={endTurn}
          onDeployFront={()=>deployToRow('front')}
          onDeployBack={()=>deployToRow('back')}
          onCancelDeploy={cancelDeploy}
          onCancelTarget={cancelTgt}/>

        {/* ── PLAYER FLEET ZONES ── */}
        <FleetZone
          label="FRONT LINE"
          ships={frontOf(g.player.field)}
          isPlayer={true}
          attackers={g.attackers}
          canTargetShip={canTargetPlayerShip()}
          canAttack={canAttack}
          onShipClick={u=>{
            if(canTargetPlayerShip()) handleTarget('player-ship',u.uid);
            else toggleAttacker(u.uid);
          }}/>

        <FleetZone
          label="LONG RANGE"
          ships={backOf(g.player.field)}
          isPlayer={true} isBack
          attackers={g.attackers}
          canTargetShip={canTargetPlayerShip()}
          canAttack={canAttack}
          onShipClick={u=>{
            if(canTargetPlayerShip()) handleTarget('player-ship',u.uid);
            else toggleAttacker(u.uid);
          }}/>

        {/* ── PLAYER STATUS ROW ── */}
        <div style={{display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
          <div style={{width:'48px',height:'48px',borderRadius:'50%',flexShrink:0,
            background:'linear-gradient(135deg,#0c4a6e,#075985)',
            border:'2px solid #0284c755',
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:'0 0 20px #0284c733',fontSize:'22px'}}>♦</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Orbitron',fontSize:'9px',letterSpacing:'3px',color:'#475569',marginBottom:'2px'}}>YOUR CAPSULEER</div>
            <HPBar hp={g.player.hp} max={20} color='#38bdf8'/>
          </div>
          <CapBar core={g.player.core} max={g.player.maxCore}/>
        </div>

        {/* ── HAND ── */}
        <Hand
          cards={g.player.hand}
          selected={g.selectedCard}
          pendingUid={g.pendingDeploy?.uid}
          core={g.player.core}
          phase={g.phase}
          onSelect={selectCard}
          onActivate={activateCard}/>
      </div>
    </div>
  );
}

// ── HP BAR ────────────────────────────────────────────────────────────────────
function HPBar({hp,max,color,isTargetable,onTarget}) {
  const pct=Math.max(0,hp/max*100);
  return (
    <div onClick={isTargetable?onTarget:undefined}
      style={{cursor:isTargetable?'pointer':'default',
        padding:isTargetable?'3px':0,border:isTargetable?`1px solid ${color}55`:'1px solid transparent',
        borderRadius:'6px',transition:'all .2s',background:isTargetable?`${color}11`:'transparent'}}>
      {isTargetable&&<div style={{fontFamily:'Orbitron',fontSize:'7px',color,letterSpacing:'2px',marginBottom:'2px'}}>
        🎯 CLICK TO TARGET POD
      </div>}
      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
        <div style={{flex:1,height:'8px',background:'rgba(255,255,255,.07)',borderRadius:'4px',overflow:'hidden'}}>
          <div style={{height:'100%',width:`${pct}%`,background:color,
            boxShadow:`0 0 8px ${color}`,borderRadius:'4px',transition:'width .4s ease'}}/>
        </div>
        <div style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'16px',color,
          textShadow:`0 0 12px ${color}`,minWidth:'36px',textAlign:'right',lineHeight:1}}>
          {hp}
        </div>
      </div>
    </div>
  );
}

// ── CAP BAR ───────────────────────────────────────────────────────────────────
function CapBar({core,max}) {
  return (
    <div style={{textAlign:'center',padding:'4px 10px',background:'rgba(0,0,0,.4)',
      border:'1px solid #1e293b',borderRadius:'6px',minWidth:'110px'}}>
      <div style={{display:'flex',gap:'3px',justifyContent:'center',flexWrap:'wrap',marginBottom:'3px'}}>
        {Array.from({length:max},(_,i)=>(
          <div key={i} style={{width:'10px',height:'10px',borderRadius:'2px',
            background:i<core?'#fbbf24':'rgba(255,255,255,.06)',
            border:`1px solid ${i<core?'#fbbf24':'#1e293b'}`,
            boxShadow:i<core?'0 0 6px #fbbf2488':'none',
            transition:'all .25s'}}/>
        ))}
      </div>
      <div style={{fontFamily:'Orbitron',fontSize:'7px',color:'#fbbf24',letterSpacing:'2px'}}>
        CAP {core}/{max}
      </div>
    </div>
  );
}

// ── FLEET ZONE ────────────────────────────────────────────────────────────────
function FleetZone({label,ships,isPlayer,isBack,attackers,canTargetShip,canAttack,onShipClick}) {
  const isEmpty=ships.length===0;
  return (
    <div style={{flex:1,display:'flex',gap:'8px',alignItems:'center',
      background:isPlayer
        ?(isBack?'rgba(56,189,248,.03)':'rgba(56,189,248,.06)')
        :(isBack?'rgba(244,63,94,.03)':'rgba(244,63,94,.06)'),
      border:`1px solid ${isPlayer?(isBack?'rgba(56,189,248,.08)':'rgba(56,189,248,.14)'):(isBack?'rgba(244,63,94,.08)':'rgba(244,63,94,.14)')}`,
      borderRadius:'8px',padding:'6px 10px',position:'relative',minHeight:0}}>
      {/* Row label */}
      <div style={{position:'absolute',left:'8px',top:'4px',
        fontFamily:'Orbitron',fontSize:'7px',letterSpacing:'3px',
        color:isPlayer?(isBack?'rgba(56,189,248,.25)':'rgba(56,189,248,.4)'):(isBack?'rgba(244,63,94,.25)':'rgba(244,63,94,.4)')}}>
        {label}
      </div>
      {/* Ships */}
      <div style={{display:'flex',gap:'8px',alignItems:'center',
        justifyContent:'center',flex:1,flexWrap:'wrap',paddingTop:'12px'}}>
        {isEmpty&&(
          <div style={{fontFamily:'Orbitron',fontSize:'8px',letterSpacing:'3px',
            color:isPlayer?'rgba(56,189,248,.12)':'rgba(244,63,94,.12)'}}>
            {isPlayer?'DEPLOY YOUR SHIPS HERE':'ENEMY ZONE CLEAR'}
          </div>
        )}
        {ships.map(unit=>{
          const isAtk=attackers?.includes(unit.uid);
          const isTgt=canTargetShip;
          const canSel=isTgt||(canAttack?.(unit));
          const bc=isAtk?'#fb923c':isTgt?'#fbbf24':unit.color;
          return (
            <div key={unit.uid}
              className={`ship-card glow-anim ${unit.justPlayed?(isPlayer?'deploy-player':'deploy-enemy'):''}`}
              onClick={canSel?()=>onShipClick(unit):undefined}
              style={{'--gc':`${unit.color}44`,
                width:'80px',minHeight:'100px',
                background:`linear-gradient(175deg,rgba(15,23,42,.95),rgba(15,23,42,.8),${unit.color}18)`,
                border:`2px solid ${bc}${isAtk||isTgt?'cc':'55'}`,
                borderRadius:'10px',padding:'8px 6px 6px',
                textAlign:'center',
                opacity:unit.tapped?.5:1,
                transform:unit.tapped?'rotate(12deg)':isAtk?'translateY(-6px)':'none',
                transition:'opacity .3s,transform .3s',
                cursor:canSel?'pointer':'default',
                boxShadow:isAtk?`0 0 20px ${unit.color}66,0 8px 20px rgba(0,0,0,.5)`
                  :isTgt?`0 0 18px #fbbf2466`
                  :`0 4px 12px rgba(0,0,0,.5)`,
              }}>
              {isAtk&&<div style={{position:'absolute',top:'-14px',left:'50%',transform:'translateX(-50%)',
                fontFamily:'Orbitron',fontSize:'6px',color:'#fb923c',whiteSpace:'nowrap',
                textShadow:'0 0 8px #fb923c',letterSpacing:'1px'}}>⚔ ATTACKING</div>}
              {isTgt&&<div style={{position:'absolute',top:'-14px',left:'50%',transform:'translateX(-50%)',
                fontFamily:'Orbitron',fontSize:'6px',color:'#fbbf24',whiteSpace:'nowrap',letterSpacing:'1px'}}>🎯 TARGET</div>}
              <div style={{fontSize:'28px',lineHeight:1,marginBottom:'4px'}}>{unit.icon}</div>
              <div style={{fontFamily:'Orbitron',fontSize:'8px',fontWeight:700,color:'#f1f5f9',
                lineHeight:1.2,marginBottom:'2px'}}>{unit.name}</div>
              {unit.faction&&<div style={{fontFamily:'Share Tech Mono',fontSize:'8px',color:`${unit.color}99`,
                marginBottom:'4px'}}>{unit.faction}</div>}
              {unit.ability==='ranged'&&<div style={{fontFamily:'Orbitron',fontSize:'6px',color:unit.color,
                background:`${unit.color}22`,borderRadius:'3px',padding:'1px 3px',marginBottom:'4px',letterSpacing:'1px'}}>RANGED</div>}
              {/* ATK / HP */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'3px 4px',background:'rgba(0,0,0,.4)',borderRadius:'5px',
                border:'1px solid rgba(255,255,255,.06)'}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'14px',
                    color:'#fb923c',lineHeight:1}}>{unit.atk}</div>
                  <div style={{fontFamily:'Orbitron',fontSize:'5px',color:'#fb923c66',letterSpacing:'1px'}}>ATK</div>
                </div>
                <div style={{width:'1px',height:'20px',background:'rgba(255,255,255,.08)'}}/>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'14px',
                    color:'#38bdf8',lineHeight:1}}>{unit.currentHp}</div>
                  <div style={{fontFamily:'Orbitron',fontSize:'5px',color:'#38bdf866',letterSpacing:'1px'}}>HP</div>
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
  onAttack,onResolve,onEndTurn,onDeployFront,onDeployBack,onCancelDeploy,onCancelTarget}) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
      padding:'6px 12px',background:'rgba(6,13,26,.8)',
      border:'1px solid rgba(255,255,255,.06)',borderRadius:'8px',
      backdropFilter:'blur(8px)',flexShrink:0,minHeight:'52px'}}>

      {isPending&&(<>
        <span style={{fontFamily:'Orbitron',fontSize:'9px',color:'#60a5fa',letterSpacing:'2px'}}>
          DEPLOY <b style={{color:'#f1f5f9'}}>{pendingName}</b> TO
        </span>
        <Btn label="▲ FRONT LINE" color="#38bdf8" onClick={onDeployFront}/>
        <Btn label="▼ BACK ROW" color="#34d399" onClick={onDeployBack}/>
        <Btn label="✕ CANCEL" color="#94a3b8" onClick={onCancelDeploy} small/>
      </>)}

      {isTargeting&&!isPending&&(<>
        <span style={{fontFamily:'Orbitron',fontSize:'9px',color:'#fbbf24',letterSpacing:'2px'}}>
          🎯 {targetName} — CLICK A TARGET ON THE BOARD
        </span>
        <Btn label="✕ CANCEL" color="#94a3b8" onClick={onCancelTarget} small/>
      </>)}

      {!isPending&&!isTargeting&&(<>
        {phase==='player-play'&&<>
          <Btn label="⚔ ENGAGE PHASE" color="#fb923c" onClick={onAttack}/>
          <div style={{fontFamily:'Share Tech Mono',fontSize:'10px',color:'#334155',padding:'0 4px'}}>
            Click a card to select · click again to play it
          </div>
        </>}
        {phase==='player-attack'&&<>
          <Btn label={`⚔ RESOLVE COMBAT${attackerCount?` (${attackerCount})`:''}`}
            color="#fb923c" onClick={onResolve} active={attackerCount>0}/>
          <div style={{fontFamily:'Share Tech Mono',fontSize:'10px',color:'#334155'}}>
            Click your ships to declare attackers · front row + ranged only
          </div>
        </>}
        {isAiTurn&&<>
          <div style={{fontFamily:'Orbitron',fontSize:'10px',color:'#f43f5e',letterSpacing:'3px',
            animation:'aiThink 1s infinite'}}>⟳ ENEMY FLEET ACTIVE...</div>
        </>}
        <Btn label="END TURN ▶" color="#38bdf8"
          disabled={phase==='ai-turn'||phase==='game-over'} onClick={onEndTurn}/>
      </>)}
    </div>
  );
}

function Btn({label,color,disabled,onClick,active,small}){
  return (
    <button onClick={onClick} disabled={disabled} className="btn" style={{
      background:active?`${color}22`:'rgba(255,255,255,.04)',
      border:`1px solid ${disabled?'rgba(255,255,255,.06)':active?color:color+'66'}`,
      color:disabled?'#1e293b':color,
      padding:small?'5px 10px':'7px 14px',
      fontSize:small?'8px':'9px',letterSpacing:'2px',
      borderRadius:'6px',
      boxShadow:active?`0 0 14px ${color}55,0 0 30px ${color}22`:'none',
      textShadow:disabled?'none':`0 0 8px ${color}66`,
    }}>{label}</button>
  );
}

// ── HAND ──────────────────────────────────────────────────────────────────────
function Hand({cards,selected,pendingUid,core,phase,onSelect,onActivate}) {
  return (
    <div style={{display:'flex',gap:'6px',justifyContent:'center',alignItems:'flex-end',
      padding:'4px 0 2px',flexShrink:0,overflowX:'auto',minHeight:'130px'}}>
      {cards.length===0&&(
        <div style={{fontFamily:'Orbitron',fontSize:'9px',letterSpacing:'3px',color:'#0f172a',margin:'auto'}}>
          RESERVE EMPTY
        </div>
      )}
      {cards.map((card,i)=>{
        const isPend=pendingUid===card.uid;
        const isSel=selected===card.uid||isPend;
        const affordable=card.cost<=core&&phase==='player-play';
        const centerOffset=i-Math.floor(cards.length/2);
        const baseRotate=centerOffset*2.5;
        const baseY=Math.abs(centerOffset)*1.5;
        return (
          <div key={card.uid}
            className={`card${isSel?' card-sel':''}`}
            onClick={isSel&&affordable?()=>onActivate(card.uid):()=>onSelect(card.uid)}
            style={{
              width:'84px',minHeight:'120px',flexShrink:0,
              background:`linear-gradient(175deg,#0f1629,#0a0f1e,${card.color}22)`,
              border:`2px solid ${isSel?card.color:affordable?card.color+'44':'#1e293b'}`,
              borderRadius:'10px',padding:'8px 6px 6px',textAlign:'center',
              transform:isSel?`translateY(-20px) rotate(0deg)`:`translateY(${baseY}px) rotate(${baseRotate}deg)`,
              boxShadow:isSel
                ?`0 0 28px ${card.color}88,0 0 60px ${card.color}33,0 -8px 24px ${card.color}44`
                :affordable
                ?`0 0 10px ${card.color}33,0 4px 16px rgba(0,0,0,.6)`
                :'0 4px 12px rgba(0,0,0,.5)',
              opacity:!affordable&&!isSel?.35:1,
            }}>
            {/* Cost */}
            <div style={{position:'absolute',top:'-8px',right:'-8px',
              width:'24px',height:'24px',borderRadius:'50%',
              background:affordable?card.color:'#1e293b',
              border:`2px solid ${affordable?card.color:'#0f172a'}`,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontFamily:'Orbitron',fontWeight:700,fontSize:'11px',
              color:affordable?'#0f172a':'#334155',
              boxShadow:affordable?`0 0 10px ${card.color}`:''}}>{card.cost}</div>
            {/* Color dot */}
            <div style={{position:'absolute',top:'6px',left:'6px',
              width:'6px',height:'6px',borderRadius:'50%',background:card.color,
              boxShadow:`0 0 8px ${card.color}`}}/>
            <div style={{fontSize:'26px',margin:'2px 0 4px',lineHeight:1}}>{card.icon}</div>
            <div style={{fontFamily:'Orbitron',fontSize:'9px',fontWeight:700,
              color:'#f1f5f9',lineHeight:1.2,marginBottom:'2px'}}>{card.name}</div>
            {card.faction&&<div style={{fontFamily:'Share Tech Mono',fontSize:'7px',
              color:`${card.color}99`,marginBottom:'3px'}}>{card.faction}</div>}
            {card.type==='ship'&&(
              <div style={{display:'flex',justifyContent:'space-between',
                padding:'3px 4px',background:'rgba(0,0,0,.5)',borderRadius:'5px',
                border:'1px solid rgba(255,255,255,.05)',marginBottom:'4px'}}>
                <div style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'13px',color:'#fb923c'}}>{card.atk}</div>
                <div style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'13px',color:'#38bdf8'}}>{card.def}</div>
              </div>
            )}
            <div style={{fontFamily:'Share Tech Mono',fontSize:'7.5px',
              color:'#334155',lineHeight:1.4}}>{card.effect}</div>
            {isSel&&affordable&&!isPend&&(
              <div style={{position:'absolute',bottom:'-16px',left:'50%',transform:'translateX(-50%)',
                fontFamily:'Orbitron',fontSize:'7px',color:card.color,
                whiteSpace:'nowrap',textShadow:`0 0 8px ${card.color}`}}>
                {card.type==='ship'?'▲ CHOOSE ROW':'▲ ACTIVATE'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function Toast({toast,index}) {
  const age=Date.now()-toast.ts;
  const fading=age>3000;
  return (
    <div style={{
      padding:'5px 10px',
      background:'rgba(6,13,26,.92)',
      border:`1px solid ${toast.color}44`,
      borderLeft:`3px solid ${toast.color}`,
      borderRadius:'6px',
      fontFamily:'Share Tech Mono',fontSize:'11px',
      color:index===0?toast.color:`${toast.color}88`,
      maxWidth:'240px',
      backdropFilter:'blur(8px)',
      animation:fading?'toastOut .5s forwards':'toastIn .25s ease',
      transition:'all .3s',
      boxShadow:`0 2px 12px rgba(0,0,0,.6),0 0 8px ${toast.color}22`,
    }}>{toast.msg}</div>
  );
}

// ── INTRO SCREEN ──────────────────────────────────────────────────────────────
function IntroScreen({onStart}) {
  return (
    <div style={{width:'100vw',height:'100vh',background:'#030712',
      display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Orbitron:wght@700;900&family=Share+Tech+Mono&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
      {/* Nebula glow */}
      <div style={{position:'absolute',left:'20%',top:'20%',width:'500px',height:'400px',background:'#1e3a8a',borderRadius:'50%',filter:'blur(100px)',opacity:.07}}/>
      <div style={{position:'absolute',right:'15%',bottom:'20%',width:'400px',height:'350px',background:'#4c1d95',borderRadius:'50%',filter:'blur(90px)',opacity:.06}}/>

      <div style={{textAlign:'center',maxWidth:'500px',padding:'40px',position:'relative',zIndex:2,animation:'float 4s ease-in-out infinite'}}>
        <div style={{fontFamily:'Orbitron',fontSize:'9px',letterSpacing:'7px',color:'#1e3a8a',marginBottom:'10px'}}>
          CAPSULEER AUTHENTICATION
        </div>
        <div style={{fontFamily:'Orbitron',fontWeight:900,fontSize:'32px',letterSpacing:'5px',
          background:'linear-gradient(135deg,#38bdf8,#6366f1,#a78bfa)',
          WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:'6px'}}>
          NEW EDEN
        </div>
        <div style={{fontFamily:'Orbitron',fontWeight:700,fontSize:'14px',letterSpacing:'8px',color:'#1e3a8a',marginBottom:'32px'}}>
          PROTOCOL
        </div>

        {/* Rules */}
        <div style={{textAlign:'left',marginBottom:'28px',display:'flex',flexDirection:'column',gap:'8px'}}>
          {[
            {k:'FRONT LINE',c:'#fb923c',v:'Ships here block attacks. All ships can attack from front.'},
            {k:'BACK ROW',c:'#34d399',v:'Protected from direct attack. Only the Drake (RANGED) fires from here.'},
            {k:'NULLIFIER',c:'#c084fc',v:'Stiletto bypasses all rows and hits the enemy pod directly.'},
            {k:'DOOMSDAY',c:'#f97316',v:"Revelation's excess damage bleeds through to the enemy capsuleer."},
            {k:'MODULES',c:'#60a5fa',v:'Instant-use cards: damage, destroy, heal, draw, and cap boost.'},
          ].map(({k,c,v})=>(
            <div key={k} style={{display:'flex',gap:'10px',padding:'6px 10px',
              background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.04)',borderRadius:'6px'}}>
              <div style={{fontFamily:'Orbitron',fontSize:'8px',color:c,minWidth:'80px',
                flexShrink:0,paddingTop:'2px',letterSpacing:'1px'}}>{k}</div>
              <div style={{fontFamily:'Share Tech Mono',fontSize:'10px',color:'#475569',lineHeight:1.5}}>{v}</div>
            </div>
          ))}
        </div>

        <button onClick={onStart}
          style={{background:'rgba(56,189,248,.08)',border:'2px solid #38bdf855',color:'#38bdf8',
            padding:'14px 40px',fontFamily:'Orbitron',fontWeight:700,fontSize:'12px',letterSpacing:'5px',
            cursor:'pointer',borderRadius:'8px',
            boxShadow:'0 0 30px #38bdf822,0 0 60px #38bdf811',
            textShadow:'0 0 12px #38bdf8',transition:'all .2s'}}>
          ⟶ WARP IN
        </button>
      </div>
    </div>
  );
}

// ── GAME OVER SCREEN ──────────────────────────────────────────────────────────
function GameOverScreen({winner,onReset}) {
  const won=winner==='player';
  return (
    <div style={{width:'100vw',height:'100vh',background:'rgba(3,7,18,.97)',
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      fontFamily:'Orbitron'}}>
      <div style={{fontSize:'64px',marginBottom:'16px',lineHeight:1}}>{won?'🏆':'💀'}</div>
      <div style={{fontSize:'11px',letterSpacing:'8px',color:won?'#38bdf8':'#f43f5e',marginBottom:'8px'}}>
        {won?'GF IN LOCAL':'PODDED'}
      </div>
      <div style={{fontSize:'40px',fontWeight:900,letterSpacing:'5px',
        background:won?'linear-gradient(135deg,#38bdf8,#7dd3fc)':'linear-gradient(135deg,#f43f5e,#fb7185)',
        WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:'12px'}}>
        {won?'VICTORY':'DEFEAT'}
      </div>
      <div style={{fontFamily:'Share Tech Mono',fontSize:'12px',color:'#334155',marginBottom:'36px'}}>
        {won?'Sovereignty secured. Clone contract expired.':'Ship destroyed. Pod express activated. Clone ready.'}
      </div>
      <button onClick={onReset}
        style={{background:'rgba(56,189,248,.08)',border:'2px solid #38bdf855',color:'#38bdf8',
          padding:'12px 36px',fontFamily:'Orbitron',fontSize:'10px',letterSpacing:'4px',
          cursor:'pointer',borderRadius:'8px',boxShadow:'0 0 24px #38bdf822',
          textShadow:'0 0 10px #38bdf8',transition:'all .2s'}}>
        ↺ RESHIP &amp; REDOCK
      </button>
    </div>
  );
}
