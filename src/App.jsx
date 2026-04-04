import { useState, useEffect, useRef, useCallback } from "react";

// ── CARD DEFINITIONS ──────────────────────────────────────────────────────────
const CARDS = [
  { id:'nano_drone',   name:'Nano Drone',   cost:1, type:'unit',    atk:1, def:1, effect:'Haste — attacks immediately.',             color:'#00ffcc', icon:'🤖', ability:'haste'      },
  { id:'plasma_guard', name:'Plasma Guard', cost:2, type:'unit',    atk:2, def:3, effect:'Resilient defensive construct.',           color:'#4488ff', icon:'🛡️', ability:null         },
  { id:'void_stalker', name:'Void Stalker', cost:3, type:'unit',    atk:3, def:2, effect:'Phase — cannot be blocked.',              color:'#aa44ff', icon:'👻', ability:'unblockable'},
  { id:'arc_spider',   name:'Arc Spider',   cost:2, type:'unit',    atk:2, def:2, effect:'Zap — 1 damage to a unit on entry.',      color:'#ffcc00', icon:'🕷️', ability:'zap'        },
  { id:'titan_mech',   name:'Titan Mech',   cost:5, type:'unit',    atk:5, def:5, effect:'Crush — overflow damage hits enemy.',     color:'#ff6644', icon:'🦾', ability:'crush'      },
  { id:'system_shock', name:'System Shock', cost:2, type:'program',              effect:'Deal 3 damage to any target.',             color:'#ff4444', icon:'⚡', ability:'damage3'    },
  { id:'data_surge',   name:'Data Surge',   cost:1, type:'program',              effect:'Draw 2 cards.',                            color:'#44ccff', icon:'📡', ability:'draw2'      },
  { id:'emp_blast',    name:'EMP Blast',    cost:3, type:'program',              effect:'Destroy target enemy unit.',               color:'#ffaa00', icon:'💥', ability:'destroy'    },
  { id:'neural_link',  name:'Neural Link',  cost:2, type:'program',              effect:'Give a friendly unit +2 ATK / +2 HP.',     color:'#88ff44', icon:'🧬', ability:'buff'       },
  { id:'core_surge',   name:'Core Surge',   cost:0, type:'program',              effect:'Gain 3 extra Core this turn.',             color:'#ffdd44', icon:'🔋', ability:'coresurge'  },
];

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

// ── STARS ─────────────────────────────────────────────────────────────────────
const STARS = Array.from({length:55},(_,i)=>({
  left:`${(i*37+13)%100}%`,top:`${(i*53+7)%100}%`,
  w:(i%3)*.5+.3,delay:(i%5)*.8,dur:1.8+(i%4)*.7
}));

// ── OPENAI NARRATIVE ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the voice of a cyberpunk noir chronicle — a dispatch from the digital underworld where sentient programs battle for control of the Nexus. 

When given a game event, write EXACTLY 2 sentences of dark, atmospheric prose. Requirements:
- Second person ("you", "your")  
- Reference the specific unit or program by name
- No dialogue, no clichés, no em-dashes
- Tone: William Gibson meets Raymond Chandler — rain-slicked neon, cold chrome, digital ghosts
- Never use the word "battle", "battle-hardened", or "epic"
- Each dispatch should feel like a new paragraph of the same noir novel`;

async function fetchNarrative(apiKey, event, context) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},
      body: JSON.stringify({
        model:"gpt-4o-mini", max_tokens:100, temperature:0.88,
        messages:[
          {role:"system", content:SYSTEM_PROMPT},
          {role:"user", content:`GAME EVENT: ${event}\n\nCONTEXT: Turn ${context.turn}. Your HP: ${context.playerHp}. Enemy HP: ${context.aiHp}. Your field: ${context.playerField||'empty'}. Enemy field: ${context.aiField||'empty'}.`}
        ]
      })
    });
    const data = await res.json();
    if(data.error) return `[TRANSMISSION ERROR: ${data.error.message}]`;
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch(e) {
    return `[SIGNAL LOST: ${e.message}]`;
  }
}

// ── AI OPPONENT ───────────────────────────────────────────────────────────────
function aiPlay(g) {
  let hand=[...g.ai.hand],field=[...g.ai.field],pField=[...g.player.field],pHp=g.player.hp,core=g.ai.core;
  const logs=[],events=[];
  const toPlay=[...hand].filter(c=>c.cost<=core).sort((a,b)=>b.cost-a.cost);
  for(const card of toPlay) {
    if(card.cost>core) continue;
    core-=card.cost; hand=hand.filter(c=>c.uid!==card.uid);
    if(card.type==='unit') {
      const unit={...card,currentHp:card.def,tapped:false,justPlayed:true};
      if(card.ability==='zap'&&pField.length){
        const t=pField.reduce((a,b)=>a.currentHp<b.currentHp?a:b);
        pField=pField.map(u=>u.uid===t.uid?{...u,currentHp:u.currentHp-1}:u).filter(u=>u.currentHp>0);
        logs.push(`🤖 ${card.name} zaps ${t.name}!`);
        events.push(`Enemy deployed ${card.name}, which zapped your ${t.name} on entry.`);
      } else { logs.push(`🤖 AI deployed ${card.name}.`); events.push(`Enemy deployed ${card.name}.`); }
      field.push(unit);
    } else {
      switch(card.ability) {
        case 'draw2': logs.push(`🤖 AI used Data Surge.`); events.push(`Enemy ran Data Surge, pulling data from the deep net.`); break;
        case 'coresurge': core+=3; logs.push(`🤖 AI: Core Surge +3.`); events.push(`Enemy pulsed Core Surge, flooding its systems with raw processing power.`); break;
        case 'damage3':
          if(pField.length){const t=pField.reduce((a,b)=>a.currentHp<b.currentHp?a:b);const hp=t.currentHp-3;pField=pField.map(u=>u.uid===t.uid?{...u,currentHp:hp}:u).filter(u=>u.currentHp>0);logs.push(`🤖 System Shock → ${t.name} -3`);events.push(`Enemy's System Shock tore through your ${t.name}${hp<=0?', leaving only ghost-code in its wake':''}.`);}
          else{pHp-=3;logs.push(`🤖 System Shock → you -3 HP`);events.push(`Enemy's System Shock arced through the Nexus core and into your feed, burning 3 points from your vitals.`);}
          break;
        case 'destroy':
          if(pField.length){const t=pField.reduce((a,b)=>a.atk>b.atk?a:b);pField=pField.filter(u=>u.uid!==t.uid);logs.push(`🤖 EMP Blast → ${t.name} destroyed`);events.push(`Enemy's EMP Blast deconstructed your ${t.name} at the molecular level. Nothing remained.`);}
          break;
        case 'buff':
          if(field.length){const t=field.reduce((a,b)=>a.atk>b.atk?a:b);field=field.map(u=>u.uid===t.uid?{...u,atk:u.atk+2,currentHp:u.currentHp+2}:u);logs.push(`🤖 Neural Link → ${t.name} +2/+2`);events.push(`Enemy threaded a Neural Link into ${t.name}, sharpening its kill instincts and hardening its shell.`);}
          break;
      }
    }
  }
  let ns={...g,ai:{...g.ai,hand,field,core},player:{...g.player,field:pField,hp:pHp}};
  return {state:ns,logs,events};
}

function aiAttack(g) {
  const atkers=g.ai.field.filter(u=>!u.tapped&&(u.ability==='haste'||!u.justPlayed));
  if(!atkers.length) return {state:g,logs:[],events:[]};
  const logs=[`🤖 AI attacks: ${atkers.map(u=>u.name).join(', ')}`];
  const events=[];
  let aiField=[...g.ai.field],pField=[...g.player.field],pHp=g.player.hp;
  aiField=aiField.map(u=>atkers.find(a=>a.uid===u.uid)?{...u,tapped:true}:u);
  const used=new Set();
  for(const atk of atkers) {
    if(atk.ability==='unblockable'){pHp-=atk.atk;logs.push(`👻 ${atk.name} phases through — ${atk.atk} dmg`);events.push(`Enemy's ${atk.name} phased through your defenses like smoke, cutting ${atk.atk} directly from your life-feed.`);continue;}
    const blocker=pField.find(u=>!used.has(u.uid));
    if(blocker){
      used.add(blocker.uid);
      const ah=atk.currentHp-blocker.atk,bh=blocker.currentHp-atk.atk;
      if(ah<=0){aiField=aiField.filter(u=>u.uid!==atk.uid);events.push(`Your ${blocker.name} held the line, grinding enemy ${atk.name} into dead code.`);}
      else aiField=aiField.map(u=>u.uid===atk.uid?{...u,currentHp:ah}:u);
      if(bh<=0){
        if(atk.ability==='crush'&&bh<0){pHp+=bh;events.push(`Enemy ${atk.name} crushed your ${blocker.name} and the impact rippled through your core for ${Math.abs(bh)} overflow damage.`);}
        else events.push(`Enemy ${atk.name} destroyed your ${blocker.name}. Another ghost joins the static.`);
        pField=pField.filter(u=>u.uid!==blocker.uid);
      } else pField=pField.map(u=>u.uid===blocker.uid?{...u,currentHp:bh}:u);
    } else {
      pHp-=atk.atk;
      logs.push(`💥 ${atk.name} strikes for ${atk.atk}`);
      events.push(`Enemy ${atk.name} struck your core directly for ${atk.atk} — no blocker, no mercy.`);
    }
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
  const t=g.turn+1,pm=Math.min(10,g.player.maxCore+1);
  if(g.phase!=='game-over'){
    g=drawN(g,'player',1);
    g={...g,phase:'player-play',turn:t,aiThinking:false,attackers:[],selectedCard:null,
      player:{...g.player,maxCore:pm,core:pm,field:g.player.field.map(u=>({...u,tapped:false,justPlayed:false}))}};
    g=addLog(g,`⚡ Turn ${t} — your move.`);
  } else g={...g,aiThinking:false};
  return {newState:g, events:[...e1,...e2]};
}

// ── INITIAL STATE ─────────────────────────────────────────────────────────────
function initGame() {
  let s={
    phase:'player-play',turn:1,winner:null,aiThinking:false,
    selectedCard:null,attackers:[],targeting:null,
    log:['⚡ NEXUS PROTOCOL online.','Select a card to deploy it. Then ATTACK or END TURN.'],
    player:{hp:20,core:1,maxCore:1,deck:buildDeck(),hand:[],field:[]},
    ai:    {hp:20,core:1,maxCore:1,deck:buildDeck(),hand:[],field:[]},
  };
  s=drawN(s,'player',5); s=drawN(s,'ai',5);
  return s;
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [apiKey,   setApiKey]   = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [g,        setG]        = useState(null);
  const [story,    setStory]    = useState([]);   // [{text, turn, loading}]
  const [narLoading, setNarLoading] = useState(false);
  const storyRef = useRef(null);
  const timerRef = useRef(null);
  const queueRef = useRef([]);
  const processingRef = useRef(false);
  const keyRef = useRef('');

  const stateRef = useRef(null);
  useEffect(()=>{ stateRef.current = g; },[g]);

  // ── NARRATIVE QUEUE ──────────────────────────────────────────────────────
  const enqueueNarrative = useCallback((event, context) => {
    queueRef.current.push({event, context});
    processQueue();
  },[]);

  const processQueue = useCallback(async () => {
    if(processingRef.current || !queueRef.current.length) return;
    processingRef.current = true;
    const {event, context} = queueRef.current.shift();
    setNarLoading(true);
    const text = await fetchNarrative(keyRef.current, event, context);
    if(text) {
      setStory(prev => [{text, turn:context.turn}, ...prev].slice(0,20));
      setTimeout(()=>storyRef.current?.scrollTo({top:0,behavior:'smooth'}),50);
    }
    setNarLoading(false);
    processingRef.current = false;
    if(queueRef.current.length) setTimeout(processQueue, 400);
  },[apiKey]);

  // ── AI TURN EFFECT ────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!g || g.phase!=='ai-turn' || g.aiThinking) return;
    setG(s=>({...s,aiThinking:true}));
    timerRef.current = setTimeout(()=>{
      setG(prev=>{
        const {newState, events} = runAiTurn(prev);
        const ctx = {
          turn:prev.turn, playerHp:prev.player.hp, aiHp:prev.ai.hp,
          playerField: prev.player.field.map(u=>u.name).join(', ')||'empty',
          aiField: prev.ai.field.map(u=>u.name).join(', ')||'empty',
        };
        for(const ev of events) enqueueNarrative(ev, ctx);
        if(newState.winner) {
          enqueueNarrative(
            newState.winner==='ai'
              ? 'The player has been defeated. Their Nexus core goes dark.'
              : 'The enemy AI has been destroyed. Silence floods the grid.',
            {...ctx, playerHp:newState.player.hp, aiHp:newState.ai.hp}
          );
        }
        return newState;
      });
    }, 1600);
    return ()=>clearTimeout(timerRef.current);
  },[g?.phase, g?.aiThinking]);

  // ── START ─────────────────────────────────────────────────────────────────
  const startGame = async () => {
    if(!keyInput.trim().startsWith('sk-')) { setKeyError('Key should start with sk-'); return; }
    setKeyError('');
    const key = keyInput.trim();
    keyRef.current = key;
    setApiKey(key);
    const newG = {...initGame(), apiKey:key};
    setG(newG);
    setStory([]);
    const ctx = {turn:1,playerHp:20,aiHp:20,playerField:'empty',aiField:'empty'};
    enqueueNarrative(
      'The connection opens. You jack into the Nexus for the first time. Rain falls somewhere in the city above.',
      ctx
    );
  };

  const resetGame = () => {
    setG(null); setStory([]); setApiKey(''); setKeyInput(''); keyRef.current=''; processingRef.current=false; queueRef.current=[];
  };

  // ── GAME ACTIONS ──────────────────────────────────────────────────────────
  const selectCard = cUid => {
    if(!g||g.phase!=='player-play'||g.targeting) return;
    setG(s=>({...s,selectedCard:s.selectedCard===cUid?null:cUid}));
  };

  const playCard = cUid => {
    setG(s=>{
      if(s.phase!=='player-play') return s;
      const card=s.player.hand.find(c=>c.uid===cUid);
      if(!card||card.cost>s.player.core) return s;
      let ns={...s,selectedCard:null,player:{...s.player,core:s.player.core-card.cost,hand:s.player.hand.filter(c=>c.uid!==cUid)}};
      const ctx={turn:s.turn,playerHp:s.player.hp,aiHp:s.ai.hp,
        playerField:s.player.field.map(u=>u.name).join(',')||'empty',
        aiField:s.ai.field.map(u=>u.name).join(',')||'empty'};
      if(card.type==='unit'){
        const unit={...card,currentHp:card.def,tapped:card.ability!=='haste',justPlayed:card.ability!=='haste'};
        if(card.ability==='zap'&&ns.ai.field.length){
          const t=ns.ai.field.reduce((a,b)=>a.currentHp<b.currentHp?a:b);
          ns={...ns,ai:{...ns.ai,field:ns.ai.field.map(u=>u.uid===t.uid?{...u,currentHp:u.currentHp-1}:u).filter(u=>u.currentHp>0)}};
          ns=addLog(ns,`⚡ ${card.name} zaps ${t.name}!`);
          enqueueNarrative(`You deployed ${card.name}, which zapped enemy ${t.name} on entry for 1 damage.`,ctx);
        } else {
          ns=addLog(ns,`✅ Deployed ${card.name}.`);
          enqueueNarrative(`You deployed ${card.name} to the field.`,ctx);
        }
        ns={...ns,player:{...ns.player,field:[...ns.player.field,unit]}};
      } else {
        if(['damage3','destroy','buff'].includes(card.ability)){
          ns={...ns,targeting:{ability:card.ability,name:card.name}};
          ns=addLog(ns,`🎯 ${card.name} — select a target.`);
        } else {
          if(card.ability==='draw2'){ns=drawN(ns,'player',2);ns=addLog(ns,'📡 Data Surge — draw 2!');enqueueNarrative(`You ran Data Surge, pulling two fragments of hidden data from the deep net.`,ctx);}
          if(card.ability==='coresurge'){ns={...ns,player:{...ns.player,core:ns.player.core+3}};ns=addLog(ns,'🔋 Core Surge — +3!');enqueueNarrative(`You triggered Core Surge. Three pulses of raw power flooded your grid.`,ctx);}
        }
      }
      return checkWinner(ns);
    });
  };

  const handleTarget = (type, tUid) => {
    if(!g?.targeting) return;
    setG(s=>{
      if(!s.targeting) return s;
      const {ability,name}=s.targeting;
      let ns={...s,targeting:null};
      const ctx={turn:s.turn,playerHp:s.player.hp,aiHp:s.ai.hp,
        playerField:s.player.field.map(u=>u.name).join(',')||'empty',
        aiField:s.ai.field.map(u=>u.name).join(',')||'empty'};
      if(ability==='damage3'){
        if(type==='ai-unit'){const t=ns.ai.field.find(u=>u.uid===tUid);if(!t) return s;const hp=t.currentHp-3;ns={...ns,ai:{...ns.ai,field:ns.ai.field.map(u=>u.uid===tUid?{...u,currentHp:hp}:u).filter(u=>u.currentHp>0)}};ns=addLog(ns,`💥 ${name} → ${t.name} -3${hp<=0?' (destroyed)':''}!`);enqueueNarrative(`Your System Shock tore into enemy ${t.name}${hp<=0?', reducing it to fragmented code':' for 3 damage'}.`,ctx);}
        else if(type==='ai-player'){ns={...ns,ai:{...ns.ai,hp:ns.ai.hp-3}};ns=addLog(ns,'💥 System Shock → enemy core -3!');enqueueNarrative(`Your System Shock bypassed the enemy field and struck its core directly for 3 points.`,ctx);}
      } else if(ability==='destroy'&&type==='ai-unit'){const t=ns.ai.field.find(u=>u.uid===tUid);if(!t) return s;ns={...ns,ai:{...ns.ai,field:ns.ai.field.filter(u=>u.uid!==tUid)}};ns=addLog(ns,`💥 EMP Blast obliterated ${t.name}!`);enqueueNarrative(`Your EMP Blast found enemy ${t.name} and unmade it. Not killed. Erased.`,ctx);}
      else if(ability==='buff'&&type==='player-unit'){const t=ns.player.field.find(u=>u.uid===tUid);if(!t) return s;ns={...ns,player:{...ns.player,field:ns.player.field.map(u=>u.uid===tUid?{...u,atk:u.atk+2,currentHp:u.currentHp+2}:u)}};ns=addLog(ns,`🧬 Neural Link → ${t.name} +2/+2!`);enqueueNarrative(`You threaded a Neural Link into ${t.name}. It flexed, recalibrated, and became something sharper.`,ctx);}
      return checkWinner(ns);
    });
  };

  const toggleAttacker = uid => {
    if(!g||g.phase!=='player-attack') return;
    setG(s=>{const unit=s.player.field.find(u=>u.uid===uid);if(!unit||unit.tapped) return s;const has=s.attackers.includes(uid);return {...s,attackers:has?s.attackers.filter(u=>u!==uid):[...s.attackers,uid]};});
  };

  const resolveAttack = () => {
    setG(s=>{
      if(!s.attackers.length) return {...s,phase:'ai-turn',attackers:[]};
      let aiField=[...s.ai.field],pField=s.player.field.map(u=>s.attackers.includes(u.uid)?{...u,tapped:true}:u),aiHp=s.ai.hp;
      const logs=[],events=[],used=new Set();
      for(const atkUid of s.attackers){
        const atk=s.player.field.find(u=>u.uid===atkUid);if(!atk) continue;
        const ctx={turn:s.turn,playerHp:s.player.hp,aiHp,playerField:s.player.field.map(u=>u.name).join(',')||'empty',aiField:aiField.map(u=>u.name).join(',')||'empty'};
        if(atk.ability==='unblockable'){aiHp-=atk.atk;logs.push(`👻 ${atk.name} phases through for ${atk.atk}`);events.push({ev:`Your ${atk.name} phased through enemy defenses and struck for ${atk.atk} direct damage.`,ctx});continue;}
        const blocker=aiField.find(u=>!used.has(u.uid));
        if(blocker){
          used.add(blocker.uid);const ah=atk.currentHp-blocker.atk,bh=blocker.currentHp-atk.atk;
          if(ah<=0){pField=pField.filter(u=>u.uid!==atkUid);logs.push(`⚔️ ${atk.name} destroyed`);events.push({ev:`Your ${atk.name} took down enemy ${blocker.name}, but fell in the process.`,ctx});}
          else{pField=pField.map(u=>u.uid===atkUid?{...u,currentHp:ah,tapped:true}:u);if(bh<=0) events.push({ev:`Your ${atk.name} destroyed enemy ${blocker.name} and survived the exchange.`,ctx});}
          if(bh<=0){if(atk.ability==='crush'&&bh<0){aiHp+=bh;logs.push(`💥 Crush overflow ${Math.abs(bh)}`);events.push({ev:`Titan Mech's Crush reduced enemy ${blocker.name} to wreckage and pushed ${Math.abs(bh)} overflow into the enemy core.`,ctx});}
          else logs.push(`✅ ${blocker.name} destroyed`);aiField=aiField.filter(u=>u.uid!==blocker.uid);}
          else aiField=aiField.map(u=>u.uid===blocker.uid?{...u,currentHp:bh}:u);
        } else {aiHp-=atk.atk;logs.push(`💥 ${atk.name} strikes directly ${atk.atk}`);events.push({ev:`Your ${atk.name} found no defender and hit the enemy core for ${atk.atk} raw.`,ctx});}
      }
      let ns={...s,player:{...s.player,field:pField},ai:{...s.ai,field:aiField,hp:aiHp},attackers:[],phase:'ai-turn'};
      for(const l of logs) ns=addLog(ns,l);
      ns=checkWinner(ns);
      for(const {ev,ctx} of events) enqueueNarrative(ev, ctx);
      if(ns.winner) enqueueNarrative(ns.winner==='player'?'You have defeated the enemy AI. The Nexus is yours.':'You have been destroyed. The city keeps humming above the grid.', {turn:s.turn,playerHp:ns.player.hp,aiHp:ns.ai.hp});
      return ns;
    });
  };

  const goAttack  = () => setG(s=>({...s,phase:'player-attack',selectedCard:null,targeting:null}));
  const endTurn   = () => setG(s=>({...s,phase:'ai-turn',attackers:[],selectedCard:null,targeting:null}));
  const cancelTgt = () => setG(s=>({...s,targeting:null}));

  // ── SCREENS ───────────────────────────────────────────────────────────────
  if(!g) return <InitScreen keyInput={keyInput} setKeyInput={setKeyInput} keyError={keyError} onStart={startGame}/>;

  const phaseLabel = {
    'player-play':'DEPLOY PHASE','player-attack':'ATTACK PHASE',
    'ai-turn':'ENEMY PROCESSING','game-over':'GAME OVER'
  }[g.phase]||g.phase;

  const isTargeting = !!g.targeting;

  return (
    <div style={{minHeight:'100vh',background:'#020410',color:'#ddeeff',fontFamily:"'Rajdhani',sans-serif",position:'relative',overflow:'hidden',display:'flex',flexDirection:'column'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600&family=Share+Tech+Mono&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1a3050}
        @keyframes twinkle{0%,100%{opacity:.12}50%{opacity:.65}}
        @keyframes scanline{0%{top:-2px}100%{top:101%}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes flicker{0%,100%{opacity:1}92%{opacity:1}93%{opacity:.4}94%{opacity:1}97%{opacity:.7}98%{opacity:1}}
        .card-lift{transition:transform .15s ease,box-shadow .15s ease;cursor:pointer}
        .card-lift:hover{transform:translateY(-8px) scale(1.05);z-index:20}
        .btn-nx{transition:all .2s ease}
        .btn-nx:hover:not(:disabled){filter:brightness(1.4);letter-spacing:2.5px}
        .story-entry{animation:fadeIn .5s ease}
        .narrating{animation:pulse 1.4s infinite}
      `}</style>

      {/* STARFIELD */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0}}>
        {STARS.map((s,i)=>(
          <div key={i} style={{position:'absolute',left:s.left,top:s.top,width:`${s.w}px`,height:`${s.w}px`,borderRadius:'50%',background:'#fff',animation:`twinkle ${s.dur}s ${s.delay}s infinite`}}/>
        ))}
        <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,255,200,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,200,.02) 1px,transparent 1px)',backgroundSize:'44px 44px'}}/>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at center,transparent 40%,rgba(2,4,16,.75) 100%)'}}/>
      </div>
      <div style={{position:'fixed',left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(0,255,200,.12),transparent)',animation:'scanline 8s linear infinite',zIndex:1,pointerEvents:'none'}}/>

      {/* LAYOUT: two columns on wide, single on narrow */}
      <div style={{position:'relative',zIndex:2,display:'flex',gap:'8px',padding:'8px',maxWidth:'1100px',margin:'0 auto',width:'100%',height:'100vh',overflow:'hidden'}}>

        {/* LEFT: GAME BOARD */}
        <div style={{flex:'0 0 480px',display:'flex',flexDirection:'column',gap:'5px',minWidth:0}}>
          {/* Header */}
          <div style={{textAlign:'center',padding:'2px 0',fontFamily:'Orbitron'}}>
            <div style={{fontSize:'8px',letterSpacing:'5px',color:'#00ffcc55',marginBottom:'1px'}}>TURN {g.turn} · {phaseLabel}</div>
            <div style={{fontSize:'18px',fontWeight:900,letterSpacing:'4px',background:'linear-gradient(135deg,#00ffcc,#4488ff,#aa44ff)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',animation:'flicker 8s infinite'}}>
              NEXUS PROTOCOL
            </div>
          </div>

          {/* AI Status */}
          <StatusBar label="ENEMY AI" hp={g.ai.hp} handCount={g.ai.hand.length} isPlayer={false}
            isTargetable={isTargeting&&g.targeting.ability==='damage3'} onTarget={()=>handleTarget('ai-player',null)}/>

          {/* AI Field */}
          <BattleField units={g.ai.field} isPlayer={false} attacking={[]} targeting={g.targeting}
            onUnitClick={uid=>{if(isTargeting&&['damage3','destroy'].includes(g.targeting.ability)) handleTarget('ai-unit',uid);}}/>

          {/* Controls */}
          <ControlZone log={g.log} phase={g.phase} attackerCount={g.attackers.length}
            aiThinking={g.aiThinking} isTargeting={isTargeting} targetName={g.targeting?.name}
            onAttack={goAttack} onResolve={resolveAttack} onEnd={endTurn} onCancel={cancelTgt}/>

          {/* Player Field */}
          <BattleField units={g.player.field} isPlayer={true} attacking={g.attackers} targeting={g.targeting}
            onUnitClick={uid=>{if(isTargeting&&g.targeting.ability==='buff') handleTarget('player-unit',uid); else toggleAttacker(uid);}}/>

          {/* Player Status */}
          <StatusBar label="NEXUS OPERATOR" hp={g.player.hp} core={g.player.core} maxCore={g.player.maxCore} isPlayer={true}/>

          {/* Hand */}
          <Hand cards={g.player.hand} selected={g.selectedCard} core={g.player.core} phase={g.phase}
            onSelect={selectCard} onPlay={playCard}/>
        </div>

        {/* RIGHT: STORY CHRONICLE */}
        <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden'}}>
          <div style={{fontFamily:'Orbitron,sans-serif',fontSize:'8px',letterSpacing:'4px',color:'#00ffcc44',padding:'4px 0 8px',borderBottom:'1px solid #0a1828'}}>
            ◈ NEXUS CHRONICLE — LIVE DISPATCH
          </div>

          {/* Narrating indicator */}
          {narLoading && (
            <div style={{display:'flex',alignItems:'center',gap:'6px',padding:'6px 0',color:'#00ffcc88',fontFamily:'Orbitron',fontSize:'8px',letterSpacing:'2px'}} className="narrating">
              <div style={{display:'flex',gap:'3px'}}>
                {[0,1,2].map(i=><div key={i} style={{width:'3px',height:'3px',borderRadius:'50%',background:'#00ffcc',animation:`pulse 1s ${i*.2}s infinite`}}/>)}
              </div>
              TRANSMISSION INCOMING
            </div>
          )}

          {/* Story entries */}
          <div ref={storyRef} style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:'14px',padding:'10px 0'}}>
            {story.length===0 && !narLoading && (
              <div style={{color:'#0e1a2a',fontFamily:'Share Tech Mono',fontSize:'11px',lineHeight:1.7,marginTop:'20px'}}>
                awaiting first transmission...
              </div>
            )}
            {story.map((entry,i)=>(
              <div key={i} className="story-entry" style={{borderLeft:`2px solid ${i===0?'#00ffcc44':'#0e1a2a'}`,paddingLeft:'12px'}}>
                <div style={{fontFamily:'Orbitron,sans-serif',fontSize:'7px',color:'#1a3050',letterSpacing:'2px',marginBottom:'4px'}}>
                  TURN {entry.turn} · DISPATCH {story.length-i}
                </div>
                <div style={{fontFamily:'Share Tech Mono',fontSize:'12px',lineHeight:1.8,color:i===0?'#8899aa':'#2a3a4a',transition:'color .5s'}}>
                  {entry.text}
                </div>
              </div>
            ))}
          </div>

          {/* Reset */}
          <button onClick={resetGame} className="btn-nx" style={{
            background:'transparent',border:'1px solid #1a2035',color:'#223',
            padding:'6px',fontFamily:'Orbitron,sans-serif',fontSize:'7px',
            letterSpacing:'2px',cursor:'pointer',borderRadius:'2px',marginTop:'6px',
          }}>⏻ DISCONNECT &amp; RESET</button>
        </div>
      </div>

      {/* WINNER OVERLAY */}
      {g.winner && <WinnerOverlay winner={g.winner} lastStory={story[0]?.text} onReset={resetGame}/>}
    </div>
  );
}

// ── INIT SCREEN ───────────────────────────────────────────────────────────────
function InitScreen({keyInput, setKeyInput, keyError, onStart}) {
  return (
    <div style={{minHeight:'100vh',background:'#010208',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Rajdhani,sans-serif'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600&family=Share+Tech+Mono&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes flicker{0%,100%{opacity:1}92%{opacity:1}93%{opacity:.3}94%{opacity:1}}`}</style>
      <div style={{textAlign:'center',padding:'40px',maxWidth:'420px',width:'100%'}}>
        <div style={{fontSize:'9px',letterSpacing:'6px',color:'#00ffcc33',fontFamily:'Orbitron',marginBottom:'8px'}}>INITIALIZING</div>
        <div style={{fontSize:'28px',fontWeight:900,letterSpacing:'4px',fontFamily:'Orbitron',
          background:'linear-gradient(135deg,#00ffcc,#4488ff,#aa44ff)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
          animation:'flicker 6s infinite',marginBottom:'4px'}}>NEXUS PROTOCOL</div>
        <div style={{fontSize:'10px',letterSpacing:'3px',color:'#1a3050',fontFamily:'Orbitron',marginBottom:'32px'}}>AI-POWERED EDITION</div>
        <div style={{color:'#334',fontFamily:'Share Tech Mono',fontSize:'11px',lineHeight:1.8,marginBottom:'28px',textAlign:'left',borderLeft:'2px solid #0a1828',paddingLeft:'12px'}}>
          The Nexus awaits. Each move you make will be chronicled in real time by an AI narrator — dark, atmospheric, and watching every decision you make.
        </div>
        <div style={{textAlign:'left',marginBottom:'6px'}}>
          <label style={{fontFamily:'Orbitron',fontSize:'8px',letterSpacing:'2px',color:'#00ffcc55',display:'block',marginBottom:'6px'}}>OPENAI API KEY</label>
          <input
            type="password" placeholder="sk-..." value={keyInput}
            onChange={e=>setKeyInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&onStart()}
            style={{width:'100%',background:'#050a14',border:'1px solid #0e2040',color:'#8899aa',
              padding:'10px 12px',fontFamily:'Share Tech Mono',fontSize:'12px',borderRadius:'2px',outline:'none'}}
          />
          {keyError && <div style={{color:'#ff4444',fontSize:'10px',fontFamily:'Orbitron',marginTop:'4px',letterSpacing:'1px'}}>{keyError}</div>}
          <div style={{color:'#0e1828',fontFamily:'Share Tech Mono',fontSize:'9px',marginTop:'4px'}}>
            Key is used locally, never stored or sent anywhere except OpenAI.
          </div>
        </div>
        <button onClick={onStart} style={{
          width:'100%',background:'rgba(0,255,200,.06)',border:'1px solid #00ffcc55',
          color:'#00ffcc',padding:'12px',fontFamily:'Orbitron,sans-serif',fontSize:'10px',
          letterSpacing:'3px',cursor:'pointer',borderRadius:'2px',marginTop:'14px',
          boxShadow:'0 0 20px #00ffcc22',transition:'all .2s',
        }}>⟶ CONNECT TO NEXUS</button>
        <div style={{color:'#0a1020',fontFamily:'Share Tech Mono',fontSize:'9px',marginTop:'12px',lineHeight:1.7}}>
          Uses GPT-4o-mini · ~$0.001 per 30-turn game
        </div>
      </div>
    </div>
  );
}

// ── STATUS BAR ────────────────────────────────────────────────────────────────
function StatusBar({label,hp,handCount,core,maxCore,isPlayer,isTargetable,onTarget}) {
  const hpColor=hp>12?'#00ffcc':hp>6?'#ffcc00':'#ff4444';
  return (
    <div onClick={isTargetable?onTarget:undefined} style={{
      display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 10px',
      background:isTargetable?'rgba(255,68,68,.1)':'rgba(0,0,0,.4)',
      border:`1px solid ${isTargetable?'#ff444866':'rgba(255,255,255,.05)'}`,
      borderRadius:'2px',cursor:isTargetable?'pointer':'default',
      boxShadow:isTargetable?'0 0 16px #ff444433':'none',transition:'all .2s',
    }}>
      <span style={{fontFamily:'Orbitron',fontSize:'7px',letterSpacing:'3px',color:'#1a2840'}}>{isTargetable?'🎯 CLICK TO TARGET':label}</span>
      <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
        <div style={{fontFamily:'Orbitron',fontSize:'14px',fontWeight:700,color:hpColor,textShadow:`0 0 8px ${hpColor}`,transition:'color .4s'}}>♥ {hp}</div>
        {!isPlayer&&handCount!==undefined&&<span style={{fontSize:'9px',color:'#1a2030',fontFamily:'Orbitron'}}>✋{handCount}</span>}
        {isPlayer&&maxCore&&<CoreBar core={core} max={maxCore}/>}
      </div>
    </div>
  );
}
function CoreBar({core,max}) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
      <div style={{display:'flex',gap:'2px'}}>
        {Array.from({length:max},(_,i)=>(
          <div key={i} style={{width:'8px',height:'8px',borderRadius:'1px',background:i<core?'#ffdd44':'#0c0c18',border:`1px solid ${i<core?'#ffdd44':'#1a1a28'}`,boxShadow:i<core?'0 0 4px #ffdd44aa':'none',transition:'all .2s'}}/>
        ))}
      </div>
      <span style={{fontFamily:'Orbitron',fontSize:'11px',fontWeight:700,color:'#ffdd44'}}>{core}/{max}</span>
    </div>
  );
}

// ── BATTLE FIELD ──────────────────────────────────────────────────────────────
function BattleField({units,isPlayer,attacking,targeting,onUnitClick}) {
  const canTarget=u=>!targeting?false:(!isPlayer&&['damage3','destroy'].includes(targeting.ability))||(isPlayer&&targeting.ability==='buff');
  const canSel=u=>canTarget(u)||(isPlayer&&!targeting&&!u.tapped);
  return (
    <div style={{display:'flex',gap:'6px',padding:'6px',minHeight:'95px',flexWrap:'wrap',alignItems:'center',
      background:'rgba(0,0,0,.15)',border:'1px solid rgba(255,255,255,.03)',borderRadius:'2px'}}>
      {units.length===0&&<div style={{color:'#0e1828',fontFamily:'Orbitron',fontSize:'8px',margin:'auto',letterSpacing:'4px'}}>{isPlayer?'— YOUR FIELD —':'— ENEMY FIELD —'}</div>}
      {units.map(unit=>{
        const isAtk=attacking.includes(unit.uid),tgtable=canTarget(unit),sel=canSel(unit);
        const bc=isAtk?'#ff6644':tgtable?'#ffaa00':unit.color;
        return (
          <div key={unit.uid} className={sel?'card-lift':''} onClick={sel?()=>onUnitClick(unit.uid):undefined}
            style={{width:'68px',minHeight:'86px',background:`linear-gradient(160deg,#070712,${unit.color}18)`,
              border:`1px solid ${bc}77`,borderRadius:'3px',padding:'5px 3px',textAlign:'center',position:'relative',
              boxShadow:`0 0 ${isAtk?'12px':tgtable?'10px':'4px'} ${bc}${isAtk?'88':tgtable?'77':'33'}`,
              opacity:unit.tapped?.5:1,transform:unit.tapped?'rotate(9deg) translateY(3px)':'none',transition:'all .3s'}}>
            {isAtk&&<div style={{position:'absolute',top:'-11px',left:'50%',transform:'translateX(-50%)',fontSize:'6px',color:'#ff6644',fontFamily:'Orbitron',whiteSpace:'nowrap'}}>⚔ ATTACK</div>}
            <div style={{fontSize:'18px',marginBottom:'1px'}}>{unit.icon}</div>
            <div style={{fontSize:'6.5px',fontFamily:'Orbitron',color:unit.color,lineHeight:1.2,marginBottom:'2px',textShadow:`0 0 5px ${unit.color}77`}}>{unit.name}</div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',fontWeight:700}}>
              <span style={{color:'#ff7755'}}>⚔{unit.atk}</span>
              <span style={{color:'#55aaff'}}>♥{unit.currentHp}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── CONTROL ZONE ──────────────────────────────────────────────────────────────
function ControlZone({log,phase,attackerCount,aiThinking,isTargeting,targetName,onAttack,onResolve,onEnd,onCancel}) {
  return (
    <div style={{display:'flex',gap:'8px',background:'rgba(0,0,0,.25)',border:'1px solid rgba(0,255,200,.05)',borderRadius:'2px',padding:'5px'}}>
      <div style={{flex:1,height:'70px',overflowY:'auto',fontSize:'9px',lineHeight:'1.6',fontFamily:'Share Tech Mono'}}>
        {log.map((l,i)=><div key={i} style={{color:i===0?'#445566':'#1a2030'}}>{l}</div>)}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'4px',justifyContent:'center',minWidth:'110px'}}>
        {isTargeting?(<>
          <div style={{fontFamily:'Orbitron',fontSize:'7px',color:'#ffaa00',letterSpacing:'1px',textAlign:'center'}}>🎯 {targetName}</div>
          <div style={{fontFamily:'Orbitron',fontSize:'6px',color:'#443311',textAlign:'center'}}>click a valid target</div>
          <NxBtn label="✕ CANCEL" color="#ffaa00" onClick={onCancel}/>
        </>):(<>
          {phase==='player-play'   &&<NxBtn label="⚔ ATTACK" color="#ff6644" onClick={onAttack}/>}
          {phase==='player-attack' &&<NxBtn label={`✓ RESOLVE (${attackerCount})`} color="#ff6644" onClick={onResolve} active/>}
          <NxBtn label={aiThinking?'⟳ PROCESSING':'END TURN'} color="#4488ff" disabled={phase==='ai-turn'||phase==='game-over'} onClick={onEnd}/>
        </>)}
      </div>
    </div>
  );
}
function NxBtn({label,color,disabled,onClick,active}){
  return <button onClick={onClick} disabled={disabled} className="btn-nx" style={{background:active?`${color}18`:'rgba(0,0,0,.3)',border:`1px solid ${disabled?'#111':color+'77'}`,color:disabled?'#1a1a2a':color,padding:'5px 6px',fontFamily:'Orbitron',fontSize:'8px',letterSpacing:'1.5px',cursor:disabled?'not-allowed':'pointer',borderRadius:'2px',boxShadow:active?`0 0 8px ${color}44`:'none'}}>{label}</button>;
}

// ── HAND ──────────────────────────────────────────────────────────────────────
function Hand({cards,selected,core,phase,onSelect,onPlay}) {
  return (
    <div style={{display:'flex',gap:'4px',padding:'3px 0 6px',overflowX:'auto',alignItems:'flex-end',minHeight:'118px'}}>
      {cards.length===0&&<div style={{color:'#0a1020',fontFamily:'Orbitron',fontSize:'8px',margin:'auto',letterSpacing:'3px'}}>NO CARDS</div>}
      {cards.map(card=>{
        const sel=selected===card.uid,affordable=card.cost<=core,canPlay=affordable&&phase==='player-play';
        return (
          <div key={card.uid} className="card-lift" onClick={sel&&canPlay?()=>onPlay(card.uid):()=>onSelect(card.uid)}
            style={{width:'76px',minHeight:'106px',flexShrink:0,
              background:sel?`linear-gradient(160deg,${card.color}1e,${card.color}0a)`:'linear-gradient(160deg,#0a0a1c,#06060e)',
              border:`1px solid ${sel?card.color:'#141428'}`,borderRadius:'3px',padding:'5px 3px',
              boxShadow:sel?`0 0 18px ${card.color}66,0 -4px 14px ${card.color}33`:'0 2px 6px rgba(0,0,0,.6)',
              opacity:!affordable&&!sel?.35:1,transform:sel?'translateY(-12px)':'none',position:'relative',textAlign:'center'}}>
            <div style={{position:'absolute',top:'2px',right:'2px',background:'#ffdd4412',border:'1px solid #ffdd4455',borderRadius:'1px',padding:'0 2px',color:'#ffdd44',fontFamily:'Orbitron',fontSize:'8px',fontWeight:700}}>{card.cost}</div>
            <div style={{position:'absolute',top:'3px',left:'3px',width:'5px',height:'5px',borderRadius:'50%',background:card.color,boxShadow:`0 0 4px ${card.color}`}}/>
            <div style={{fontSize:'20px',margin:'5px 0 2px'}}>{card.icon}</div>
            <div style={{fontSize:'7px',fontFamily:'Orbitron',color:card.color,lineHeight:1.2,marginBottom:'2px',textShadow:`0 0 6px ${card.color}77`}}>{card.name}</div>
            {card.type==='unit'&&<div style={{display:'flex',justifyContent:'center',gap:'5px',fontSize:'9px',fontWeight:700,marginBottom:'2px'}}><span style={{color:'#ff7755'}}>⚔{card.atk}</span><span style={{color:'#55aaff'}}>♥{card.def}</span></div>}
            <div style={{fontSize:'6px',color:'#1a2a3a',lineHeight:1.3}}>{card.effect}</div>
            {sel&&canPlay&&<div style={{position:'absolute',bottom:'-14px',left:'50%',transform:'translateX(-50%)',fontSize:'6px',color:'#00ffcc',fontFamily:'Orbitron',whiteSpace:'nowrap',textShadow:'0 0 5px #00ffcc'}}>▲ PLAY</div>}
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
    <div style={{position:'fixed',inset:0,background:'rgba(1,2,10,.95)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:200,fontFamily:'Orbitron'}}>
      <div style={{fontSize:'48px',marginBottom:'12px'}}>{won?'🏆':'💀'}</div>
      <div style={{fontSize:'32px',fontWeight:900,letterSpacing:'5px',background:won?'linear-gradient(135deg,#00ffcc,#44ff88)':'linear-gradient(135deg,#ff4444,#ff8844)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:'4px'}}>
        {won?'VICTORY':'DEFEAT'}
      </div>
      {lastStory&&<div style={{maxWidth:'380px',fontFamily:'Share Tech Mono',fontSize:'12px',lineHeight:1.8,color:'#2a3a4a',textAlign:'center',margin:'20px 0 28px',borderLeft:'2px solid #0a1828',padding:'0 16px'}}>{lastStory}</div>}
      <button onClick={onReset} style={{background:'rgba(0,255,200,.06)',border:'1px solid #00ffcc66',color:'#00ffcc',padding:'10px 28px',fontFamily:'Orbitron',fontSize:'9px',letterSpacing:'3px',cursor:'pointer',borderRadius:'2px',boxShadow:'0 0 14px #00ffcc22'}}>
        ↺ RECONNECT
      </button>
    </div>
  );
}
