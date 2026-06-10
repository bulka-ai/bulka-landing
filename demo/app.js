/* Bulka.AI Operator Flow — prototype simulation (no backend), revision r3.
   Three lanes (Queued ¼ · Running ½ · Done ¼). A card = a subagent session.
   - Running lane = helicopter grid (sorted by completeness) ⇄ one expanded card
     in-lane (detail + per-card chat + history + blocking gate). No right drawer.
   - Orchestrator chat = a collapsible RIGHT sidebar (injection happens here).
   - Staged mini-sprints; multi-signal temperature → "paused · <reason>".
   - History has two depths: Journey (role timeline) ⇄ Steps (current agent).
   No build step; opens via file://.                                          */

'use strict';

// ----------------------------- config ---------------------------------
const CFG = {
  tickMs: 350,
  dtSim: 2.0,
  maxRunning: 6,
  stallSec: 12,
  warmupPct: 0.06,
  warmBand: 1.0, hotBand: 1.5,
  injectEverySec: 26,
};

// ----------------------------- agent display names ---------------------
const AGENT_NAME = {
  'orchestrator':         'Orchestrator',
  'environment-manager':  'Environment Manager',
  'product-developer':    'Product Developer',
  'product-tester':       'Product Tester',
  'release-manager':      'Release Manager',
  'way4-analyst':         'Analyst',
  'payment-scheme-expert':'Scheme Expert',
  'support-engineer':     'Support',
  'data-engineer':        'Data Engineer',
  'skill-curator':        'Skill Curator',
};
const agentName = a => AGENT_NAME[a] || a;
const AGENT_SHORT = { 'environment-manager':'Env Mgr','product-developer':'Developer','product-tester':'Tester','release-manager':'Release','way4-analyst':'Analyst','payment-scheme-expert':'Scheme','support-engineer':'Support','data-engineer':'Data Eng','skill-curator':'Curator','orchestrator':'Orchestrator' };
const agentShort = a => AGENT_SHORT[a] || agentName(a);

// ----------------------------- skill texts ----------------------------
const SKILLS = {
  'way4-product-config': `# way4-product-config\nConfigure Credit/Debit/Merchant products as DB rows.\nRoots: APPL_PRODUCT, SERV_PACK, ACC_SCHEME.\nPattern: write rows -> call activation PL/SQL -> verify amendment state.`,
  'way4-product-inspector': `# way4-product-inspector\nBuild TEST_SCHEME / TEST_STEP rows, run ut_script.PROCESS_SCRIPT,\nread UT_TEST / UT_TEST_MSG to interpret what actually happened.`,
  'way4-decline-analysis': `# way4-decline-analysis\nWalk the auth decision tree for a single declined transaction.`,
  'way4-batch-monitoring': `# way4-batch-monitoring\nMonitor the nightly cycle; on failure read job log, classify ORA-error, recover.`,
  'way4-incident-resolution': `# way4-incident-resolution\nTriage -> reproduce -> hypothesize from source -> validate fix -> generalise.`,
  'way4-setup-tags': `# way4-setup-tags\nBehaviour stored as UPPER_SNAKE tags in 4000-char VARCHAR2 columns.`,
  'way4-data-migration': `# way4-data-migration\nBulk-load millions of rows. Stage -> validate integrity -> load -> reconcile.`,
  'way4-product-composition': `# way4-product-composition\nDesign products from a target capability; iterate to a passing PI test.`,
  'way4-feature-blocks': `# way4-feature-blocks\nStitch a skeleton block + feature blocks; load via ccm-load.sh; iterate.`,
  'scheme-to-way4-mapping': `# scheme-to-way4-mapping\nFor each scheme rule, record its Way4 realization (CARD_PRODUCT / SERV_PACK …).`,
  'payment-scheme-rules': `# payment-scheme-rules\nPlatform-agnostic catalog of Visa/MC/Amex/Discover/JCB/UPI mandates.`,
  'way4-prod-data-obfuscation': `# way4-prod-data-obfuscation\nProduce a safe sandbox copy: mask PAN/PII, preserve relational integrity.`,
  'way4-environment': `# way4-environment\nbuild / snapshot / refresh / list golden Way4 images on Oracle Free.`,
};

// ----------------------------- stage plans -----------------------------
// Each task type has a staged mini-sprint plan: list of {name, steps:[…]}.
// Steps are the granular develop→test→validate iterations of a stage.
const STAGE_PLANS = {
  product: [
    { name:'Scope & root', steps:['read requirement','pick product root','snapshot restore-point'] },
    { name:'Structure', steps:['SERV_PACK','SERVICE rows','ACC_TEMPL chain','classifier set'] },
    { name:'Pricing', steps:['tariff tags','fee tiers','interest schedule','activation PL/SQL'] },
    { name:'PI test', steps:['build TEST_SCHEME','run script','read journal','assert postings'] },
    { name:'Iterate & close', steps:['fix drift','re-run PI','distil block','change-log'] },
  ],
  defect: [
    { name:'Triage', steps:['pull failing tx','isolate decision path'] },
    { name:'Reproduce', steps:['read config','build repro','confirm hypothesis'] },
    { name:'Fix', steps:['apply fix','re-run probe','validate'] },
    { name:'Regress', steps:['PI regression','close incident'] },
  ],
  env: [
    { name:'Provision', steps:['pull image','container up'] },
    { name:'Install', steps:['run install scripts','loadjava','verify objects'] },
    { name:'Snapshot', steps:['reconcile checksums','commit golden'] },
  ],
  test: [
    { name:'Author', steps:['TEST_SCHEME','TEST_STEP rows'] },
    { name:'Run', steps:['process script','collect journal'] },
    { name:'Assert', steps:['drift assertions','green/red verdict'] },
  ],
  compliance: [
    { name:'Scheme lookup', steps:['map mandate','plugin candidates'] },
    { name:'Verify mapping', steps:['CONTRACT_SCHEME','IF++ tier','classifier'] },
    { name:'Decompose', steps:['walk chain','behavioural verdict'] },
    { name:'Extract block', steps:['generalize','scrub IP'] },
    { name:'Compliance note', steps:['cross-check','hand off findings'] },
  ],
};
// task.kind → plan key (product/defect/env/test); analyst+scheme use 'compliance'
function planFor(t){
  if(t.agent==='way4-analyst' || t.agent==='payment-scheme-expert') return STAGE_PLANS.compliance;
  return STAGE_PLANS[t.kind] || STAGE_PLANS.product;
}
// derive {stageIdx, stepIdx, stageCount, stepCount, stageName} from pctDone
function stagePos(t){
  const plan=t.plan||planFor(t);
  const total=plan.reduce((n,s)=>n+s.steps.length,0);
  const doneSteps=Math.min(total-1, Math.floor(t.pctDone*total));
  let acc=0;
  for(let i=0;i<plan.length;i++){
    if(doneSteps < acc+plan[i].steps.length){
      const stepIdx=doneSteps-acc;
      return { stageIdx:i, stepIdx, stageCount:plan.length, stepCount:plan[i].steps.length, stageName:plan[i].name, stepName:plan[i].steps[stepIdx], plan, total, doneSteps };
    }
    acc+=plan[i].steps.length;
  }
  const last=plan.length-1;
  return { stageIdx:last, stepIdx:plan[last].steps.length-1, stageCount:plan.length, stepCount:plan[last].steps.length, stageName:plan[last].name, stepName:plan[last].steps.slice(-1)[0], plan, total, doneSteps:total-1 };
}

// ----------------------------- task templates --------------------------
const TEMPLATES = [
  { title:'Amex Gold credit product', req:'Configure an Amex-Gold-tier Credit product: rewards, tiered interest, fee schedule, 5-stage build.',
    source:'jira', ref:'JIRA-4920', prio:2, agent:'product-developer', kind:'product', skills:['way4-product-config','way4-product-inspector'], profile:'Amex Gold', behaviour:'healthy', model:'Opus' },
  { title:'30-day grace credit product', req:'Configure a Credit product with a 30-day grace period and tiered interest.',
    source:'manual', prio:3, agent:'product-developer', kind:'product', skills:['way4-product-config','way4-product-inspector'], profile:'CRED build', behaviour:'healthy', model:'Sonnet' },
  { title:'Decline spike on BIN 521342', req:'Authorization decline rate on BIN 521342 jumped 6× overnight — find why.',
    source:'monitoring', ref:'MON-DECL-521342', prio:1, agent:'support-engineer', kind:'defect', skills:['way4-decline-analysis','way4-incident-resolution'], profile:'Incident', behaviour:'hot', hotKind:'error-loop', model:'Opus' },
  { title:'MC clearing batch failed', req:'Nightly Mastercard clearing batch failed with ORA-01652 — recover and re-run.',
    source:'monitoring', ref:'MON-BATCH-MC', prio:1, agent:'support-engineer', kind:'defect', skills:['way4-batch-monitoring'], profile:'Incident', behaviour:'healthy', hotKind:'permission', model:'Sonnet' },
  { title:'JIRA-4821 · FX fee tier', req:'Add a foreign-currency fee tier (1.75%) to the Acme debit product.',
    source:'jira', ref:'JIRA-4821', prio:2, agent:'product-developer', kind:'product', skills:['way4-setup-tags','way4-product-config'], profile:'Acme debit', behaviour:'healthy', hotKind:'permission', model:'Sonnet' },
  { title:'Migrate legacy portfolio (2.1M)', req:'Bulk-migrate 2.1M legacy cards onto product CRED_07.',
    source:'jira', ref:'JIRA-4790', prio:2, agent:'data-engineer', kind:'product', skills:['way4-data-migration'], profile:'Migration', behaviour:'slow', hotKind:'stall', model:'Sonnet' },
  { title:'Outage: auth host timeouts', req:'Auth host POSTMAN timeouts since 02:14 — investigate and restore.',
    source:'monitoring', ref:'MON-OUT-AUTH', prio:1, agent:'support-engineer', kind:'defect', skills:['way4-incident-resolution'], profile:'Incident', behaviour:'stall', hotKind:'stall', model:'Opus' },
  { title:'JIRA-4833 · Rolling Reserve', req:'Add a 10% rolling reserve held 90 days to merchant product MER_03.',
    source:'jira', ref:'JIRA-4833', prio:3, agent:'product-developer', kind:'product', skills:['way4-product-composition','way4-feature-blocks'], profile:'MER_03', behaviour:'healthy', hotKind:'uncertainty', model:'Opus' },
  { title:'Reissued cards not activating', req:'Reissued cards stay inactive after issue — clients blocked.',
    source:'monitoring', ref:'MON-ACT-FAIL', prio:1, agent:'support-engineer', kind:'defect', skills:['way4-incident-resolution'], profile:'Incident', behaviour:'hot', hotKind:'uncertainty', model:'Opus' },
  { title:'JCB auth plugin compliance', req:'Confirm which IPS plugin handles JCB auth and check config compliance.',
    source:'slack', prio:3, agent:'payment-scheme-expert', kind:'defect', skills:['scheme-to-way4-mapping','payment-scheme-rules'], profile:'Scheme', behaviour:'healthy', hotKind:'missing-skill', model:'Sonnet' },
  { title:'Obfuscate prod dump for UAT', req:'Produce a masked sandbox copy of the prod portfolio for UAT.',
    source:'jira', ref:'JIRA-4801', prio:2, agent:'data-engineer', kind:'product', skills:['way4-prod-data-obfuscation'], profile:'Sandbox', behaviour:'slow', hotKind:'permission', model:'Sonnet' },
  { title:'Spin up fresh v62 sandbox', req:'Install Way4 v62 from distribution and snapshot a golden image.',
    source:'scheduled', prio:3, agent:'environment-manager', kind:'env', skills:['way4-environment'], profile:'Env', behaviour:'healthy', hotKind:'stall', model:'Sonnet' },
  { title:'Amex interchange recategorize', req:'Update Amex interchange categorization for the new mandate calendar.',
    source:'jira', ref:'JIRA-4855', prio:2, agent:'payment-scheme-expert', kind:'defect', skills:['scheme-to-way4-mapping'], profile:'Scheme', behaviour:'healthy', hotKind:'missing-skill', model:'Sonnet' },
  { title:'Import client cutie (Acme v62)', req:'Load cutie_v62_2026-05-30.zip into the sandbox and reconcile checksums.',
    source:'manual', prio:3, agent:'environment-manager', kind:'env', skills:['way4-environment'], profile:'Cutie', behaviour:'healthy', hotKind:'stall', model:'Sonnet' },
  { title:'RE: decompose CRED_07 fee chain', req:'Reverse-engineer CRED_07 fee chain into a behavioural dossier + feature blocks.',
    source:'manual', prio:2, agent:'way4-analyst', kind:'product', skills:['way4-product-composition','way4-feature-blocks'], profile:'RE dossier', behaviour:'healthy', hotKind:'uncertainty', model:'Opus' },
  { title:'PI regression · Acme debit suite', req:'Re-run the full Product Inspector regression suite for the Acme debit product.',
    source:'scheduled', prio:3, agent:'product-tester', kind:'test', skills:['way4-product-inspector'], profile:'PI suite', behaviour:'healthy', hotKind:'error-loop', model:'Haiku' },
  { title:'Nightly settlement health check', req:'Scheduled check that last night’s settlement + statement run completed clean.',
    source:'scheduled', prio:3, agent:'support-engineer', kind:'test', skills:['way4-batch-monitoring'], profile:'Batch', behaviour:'healthy', model:'Haiku' },
];

// ----------------------------- taxonomy meta --------------------------
const HOT_SIGNALS = {
  'token-overrun': { icon:'🔥', label:'token overrun', cls:'sig-token', pause:'over budget',          tip:'projected burn is over the token budget' },
  'stall':         { icon:'💤', label:'idle',          cls:'sig-stall', pause:'no progress',          tip:'no progress — idle' },
  'uncertainty':   { icon:'❓', label:'awaiting decision', cls:'sig-ask', pause:'awaiting decision',   tip:'agent is low-confidence and needs a decision' },
  'missing-skill': { icon:'🧩', label:'missing skill', cls:'sig-skill', pause:'missing skill',         tip:'capability gap — the rails don’t cover this' },
  'error-loop':    { icon:'↻',  label:'too many failures', cls:'sig-err', pause:'too many failures',   tip:'repeated failed attempts — possible thrashing' },
  'permission':    { icon:'🔒', label:'awaiting approval', cls:'sig-perm', pause:'awaiting approval',  tip:'a write gate is pending your approval' },
};
const KIND_ICON = {
  env:     { icon:'🏗️', label:'environment' },
  defect:  { icon:'🐞', label:'defect' },
  product: { icon:'🧱', label:'product' },
  test:    { icon:'🧪', label:'test' },
};
const BLOCKING = ['permission','uncertainty','missing-skill','error-loop'];

// per-agent narrative steps (transcript). `who` = the real agent on that step.
function stepsFor(t){
  const A = t.agent;
  const base = [
    { at:0.02, who:'orchestrator', task:'route requirement', text:'Read requirement; matched routing → '+agentName(A) },
  ];
  const byAgent = {
    'product-developer':[
      { at:0.10, who:'environment-manager', task:'snapshot restore-point', text:'snapshot.sh pre-change · golden taken' },
      { at:0.28, who:'product-developer', task:'write config rows', text:'SERV_PACK + SERVICE rows staged' },
      { at:0.52, who:'product-developer', task:'activation PL/SQL', text:'called activation proc · amendment state = OPEN' },
      { at:0.72, who:'product-tester', task:'PI regression', text:'TEST_SCHEME built · running ut_script.PROCESS_SCRIPT' },
      { at:0.88, who:'product-developer', task:'apply fix', text:'tightened TARIFF_ROLE casing · re-staging' },
      { at:0.95, who:'product-tester', task:'verify', text:'UT_TEST = PASS · postings match requirement' },
    ],
    'support-engineer':[
      { at:0.12, who:'support-engineer', task:'triage', text:'pulled failing tx · isolating decision path', warn:true },
      { at:0.34, who:'way4-analyst', task:'read config', text:'inspecting ACC_SCHEME + classifier set' },
      { at:0.58, who:'support-engineer', task:'reproduce', text:'repro built in sandbox · confirms hypothesis' },
      { at:0.82, who:'support-engineer', task:'validate fix', text:'fix applied · re-running probe' },
      { at:0.95, who:'product-tester', task:'regression', text:'PI green · incident resolved' },
    ],
    'data-engineer':[
      { at:0.08, who:'data-engineer', task:'stage extract', text:'staging legacy extract · row count reconciled' },
      { at:0.30, who:'data-engineer', task:'validate integrity', text:'FK + distribution checks running…' },
      { at:0.60, who:'data-engineer', task:'load', text:'bulk load in flight · 1.2M / 2.1M' },
      { at:0.88, who:'product-tester', task:'spot-check', text:'sampled 500 contracts · balances correct' },
    ],
    'payment-scheme-expert':[
      { at:0.18, who:'payment-scheme-expert', task:'scheme lookup', text:'mapped mandate → IPS plugin candidates' },
      { at:0.50, who:'way4-analyst', task:'verify mapping', text:'cross-checked CONTRACT_SCHEME + IF++ tier' },
      { at:0.85, who:'payment-scheme-expert', task:'compliance note', text:'config compliant · findings handed to developer' },
    ],
    'way4-analyst':[
      { at:0.16, who:'way4-analyst', task:'decompose', text:'walking SERV_PACK → SERVICE → ACC_TEMPL chain' },
      { at:0.48, who:'way4-analyst', task:'behavioural verdict', text:'feature REAL · extracting building-block JSON' },
      { at:0.84, who:'product-tester', task:'PI-validate', text:'parameters-only PI run confirms behaviour' },
    ],
    'environment-manager':[
      { at:0.15, who:'environment-manager', task:'pull image', text:'gvenzl/oracle-free pulled · container up' },
      { at:0.45, who:'environment-manager', task:'install Way4', text:'running install scripts from $WAY4_HOME' },
      { at:0.85, who:'environment-manager', task:'snapshot', text:'golden image committed' },
    ],
    'product-tester':[
      { at:0.20, who:'product-tester', task:'build script', text:'TEST_SCHEME / TEST_STEP rows assembled' },
      { at:0.55, who:'product-tester', task:'run suite', text:'ut_script.PROCESS_SCRIPT · 41 steps' },
      { at:0.88, who:'product-tester', task:'read journal', text:'UT_TEST green · drift assertions held' },
    ],
  };
  return base.concat(byAgent[A] || byAgent['product-developer']);
}

// current agent = the who of the latest emitted step (excluding orchestrator
// unless nothing else emitted). Journey = ordered list of agent "visits".
function currentAgent(t){
  if(!t.steps) return t.agent;
  let cur=t.agent;
  for(const s of t.steps){ if(t.emitted[s.at] && s.who!=='orchestrator') cur=s.who; }
  return cur;
}
// journey = sequence of role spans [{who, from, to, summary, status}] inferred
// from emitted steps; consecutive same-who steps collapse into one span summary.
function journey(t){
  const spans=[];
  for(const s of t.steps||[]){
    if(!t.emitted[s.at]) break;
    const last=spans[spans.length-1];
    if(last && last.who===s.who){ last.tasks.push(s.task); }
    else spans.push({ who:s.who, tasks:[s.task] });
  }
  const curIdx=spans.length-1;
  return spans.map((sp,i)=>({
    who: sp.who,
    summary: sp.tasks.join(' · '),
    status: i<curIdx ? 'done' : (t.status==='done'?'done':'run'),
  }));
}

// ----------------------------- state ----------------------------------
let state, sim, paused=false, speed=1.5, idSeq=1;
const expanded={queued:null, running:null, done:null};  // per-lane zoomed card id
let historyMode='steps';             // 'steps' | 'journey'
const filters = { laneStat:null, source:new Set(), agent:new Set() };
function passesSource(t){ return !filters.source.size || filters.source.has(t.source); }
const cardEls = new Map();
const $ = s => document.querySelector(s);
const lanes = { queued:$('#lane-queued'), running:$('#lane-running'), done:$('#lane-done') };

function fresh(){
  state={ tasks:[], orch:[], srcPulse:{}, pending:null };
  sim={t:0, lastInject:0}; idSeq=1;
  cardEls.forEach(e=>e.remove()); cardEls.clear(); expanded.queued=expanded.running=expanded.done=null;
  orchSay('orchestrator','BA orchestrator online · watching 5 sources. Describe a task to queue it.');
}

function makeTask(tpl, status){
  const estTokens = 80000 + Math.round(((idSeq*97)%11)/10 * 540000);
  const estSeconds = 60 + ((idSeq*53)%160);
  const ctx = 18 + ((idSeq*37)%52);   // k tokens of context
  return {
    id:'T'+(idSeq++), title:tpl.title, requirement:tpl.req, source:tpl.source,
    originRef: tpl.ref || null, priority: tpl.prio || 3, status: status||'queued',
    profile: tpl.profile, agent: tpl.agent, kind: tpl.kind||'product', behaviour: tpl.behaviour || 'healthy',
    model: tpl.model || 'Sonnet', ctxK: ctx,
    hotKind: tpl.hotKind || 'token-overrun',
    estTokens, estSeconds, usedTokens:0, runSeconds:0, pctDone:0, cardPaused:false,
    lastProgressAt:0, createdAt:sim.t, enteredQueue:(status==='queued'?sim.t:null), completedAt:null,
    skills: (tpl.skills||[]).slice(), steps: null, emitted:{}, plan: planFor(tpl),
    interventions:[], _adjBias:0,
    signals:{}, _signalRaisedAt:{}, chat:[], _chatSeeded:false,
  };
}

function rates(t){
  const base = 1 / t.estSeconds;
  const tokBase = t.estTokens / t.estSeconds;
  let pm=1, km=1;
  if(t.behaviour==='slow'){ pm=0.5; km=1.25; }
  else if(t.behaviour==='hot'){ pm=0.42; km=1.5; }
  else if(t.behaviour==='stall'){ pm=(t.runSeconds<14?0.6:0.02); km=0.5; }
  pm *= (1 + t._adjBias);
  return { dp: base*pm, dt: tokBase*km };
}

// ----------------------------- temperature ----------------------------
function temperature(t){
  if(['done','failed','cancelled'].includes(t.status)) return { band:'neutral', over:0, timeR:0, tokR:0, stalled:false };
  const stalled = t.status==='running' && t.pctDone<0.999 && (sim.t - t.lastProgressAt) > CFG.stallSec;
  if(t.pctDone < CFG.warmupPct) return { band: stalled?'warm':'cool', over:0, timeR:0, tokR:0, stalled };
  const expT = t.estTokens * t.pctDone, expS = t.estSeconds * t.pctDone;
  const tokR = t.usedTokens / Math.max(expT, t.estTokens*CFG.warmupPct);
  const timeR = t.runSeconds / Math.max(expS, t.estSeconds*CFG.warmupPct);
  const over = Math.max(tokR, timeR);
  let band = over<=CFG.warmBand ? 'cool' : over<=CFG.hotBand ? 'warm' : 'hot';
  if(stalled && band==='cool') band='warm';
  if(activeSignals(t).some(s=>s!=='token-overrun') && band!=='hot') band='hot';
  return { band, over, timeR, tokR, stalled };
}
function activeSignals(t){
  if(['done','failed','cancelled'].includes(t.status)) return [];
  return Object.keys(t.signals).filter(k=>t.signals[k]);
}
function maintainSignals(t){
  if(t.status!=='running'){ t.signals={}; return; }
  const stalled = t.pctDone<0.999 && (sim.t - t.lastProgressAt) > CFG.stallSec;
  const expT = t.estTokens * Math.max(t.pctDone, CFG.warmupPct);
  const tokR = t.usedTokens / Math.max(expT, t.estTokens*CFG.warmupPct);
  setSig(t,'token-overrun', tokR > CFG.hotBand);
  setSig(t,'stall', stalled);
  const k=t.hotKind, p=t.pctDone;
  if(k==='uncertainty'){ if(p>0.40 && p<0.90 && !t._asked && !t._answered){ setSig(t,'uncertainty',true); t._asked=true; } }
  else if(k==='missing-skill'){ if(p>0.30 && !t._skillFilled && !t._skillRaised){ setSig(t,'missing-skill',true); t._skillRaised=true; } }
  else if(k==='error-loop'){ if(p>0.25 && p<0.80 && !t._loopBroken && !t._loopRaised){ setSig(t,'error-loop',true); t._loopRaised=true; } }
  else if(k==='permission'){ if(p>0.35 && !t._approved && !t._permRaised){ setSig(t,'permission',true); t._permRaised=true; } }
}
function setSig(t,k,on){ if(!!t.signals[k]===on) return; if(on){ t.signals[k]=true; t._signalRaisedAt[k]=sim.t; } else delete t.signals[k]; }
const isAttention = t => activeSignals(t).length>0 || temperature(t).band==='hot' || temperature(t).stalled;
// the single reason a card is paused, if any (blocking signal, or operator)
function pauseReason(t){
  for(const k of BLOCKING) if(t.signals[k]) return HOT_SIGNALS[k].pause;
  if(t.cardPaused) return 'operator';
  if(t.signals.stall) return 'no progress';
  return null;
}
function isPaused(t){ return t.status==='running' && (t.cardPaused || BLOCKING.some(k=>t.signals[k])); }

// ----------------------------- simulation tick -------------------------
function tick(){
  if(paused) return;
  const dt = CFG.dtSim * speed;
  sim.t += dt;

  let running = state.tasks.filter(t=>t.status==='running').length;
  for(const t of state.tasks.filter(t=>t.status==='queued').sort((a,b)=>a.priority-b.priority||a.enteredQueue-b.enteredQueue)){
    if(running>=CFG.maxRunning) break;
    t.status='running'; t.lastProgressAt=sim.t; running++;
  }

  for(const t of state.tasks){
    if(t.status!=='running') continue;
    if(!t.steps){ t.steps = stepsFor(t); t.plan = planFor(t); }
    maintainSignals(t);
    const blockedSig = BLOCKING.some(k=>t.signals[k]);
    const frozen = blockedSig || t.cardPaused;
    const r = rates(t);
    const prevPct = t.pctDone;
    if(!frozen){ t.pctDone = Math.min(1, t.pctDone + r.dp*dt); if(t.pctDone - prevPct > 0.001) t.lastProgressAt = sim.t; }
    if(!t.cardPaused){ t.usedTokens += r.dt*dt*(blockedSig?0.18:1); t.runSeconds += dt; }
    growChat(t, frozen);
    emitSteps(t);
    if(t.pctDone>=1){
      const fail = (t.source==='monitoring' && t.behaviour==='hot' && (t.id.charCodeAt(1)%5===0));
      t.status = fail ? 'failed' : 'done';
      t.completedAt = sim.t; t.pctDone = 1; t.signals={};
      t.steps.forEach(s=>t.emitted[s.at]=true);
      pushChat(t,'agent', fail?'Task failed — escalating to operator.':'Task complete. Distilled episode written; PI green.', {who2: fail?'support-engineer':currentAgent(t)});
      if(expanded.running===t.id) expanded.running=null;   // bounce back to grid on completion
    }
  }

  if(sim.t - sim.lastInject > CFG.injectEverySec){ sim.lastInject=sim.t; injectRandom(); }

  render();
  if(!$('#orch').classList.contains('collapsed')) renderOrch();
}

function emitSteps(t){
  for(const s of t.steps){ if(t.pctDone>=s.at) t.emitted[s.at]=true; }
}

function injectRandom(){
  const tpl = TEMPLATES[(idSeq*7+(sim.t|0)) % TEMPLATES.length];
  const t = makeTask(tpl,'queued');
  if(Math.random()<0.4) t.priority=3;
  state.tasks.push(t);
  state.srcPulse[t.source]=sim.t;
  orchSay('system', `${SRC_META[t.source].label} feed → Queued · ${t.title}`);
  return t;
}

// ----------------------------- per-card chat ---------------------------
// chat entries carry the REAL agent (who2) so the transcript shows agent names.
function pushChat(t, who, text, opts){ t.chat.push(Object.assign({ who, who2: who==='agent'?currentAgent(t):null, text, t:fmtClock(t.runSeconds) }, opts||{})); }
function growChat(t, frozen){
  if(!t._chatSeeded){
    t._chatSeeded=true;
    t.chat.push({who:'orchestrator', text:`Spawned session · routed to ${agentName(t.agent)}.`, t:fmtClock(0)});
    pushChat(t,'agent',`Reading requirement: "${t.requirement}"`);
  }
  for(const k of BLOCKING){
    if(t.signals[k] && !(t._chatPrompted&&t._chatPrompted[k])){
      (t._chatPrompted ||= {})[k]=true;
      pushChat(t,'agent', PROMPT_TEXT[k](t), {prompt:k});
    }
  }
  if(!frozen && Math.random()<0.035 && t.pctDone<0.95 && t.pctDone>0.1){
    pushChat(t,'agent', NARRATE[(Math.random()*NARRATE.length)|0]);
  }
}
const PROMPT_TEXT = {
  uncertainty: t=>`I'm low-confidence on a design choice for "${t.profile}". Two valid readings of the requirement — which did you intend?`,
  permission:  t=>`I need to commit config rows (SERV_PACK + SERVICE) to the sandbox. Approve the write?`,
  'missing-skill': t=>`Capability gap: the rails don't cover this scheme rule. Proceed best-effort, or point me at a skill?`,
  'error-loop': t=>`I've retried 3× with the same failure — I may be thrashing. Switch approach, or hold?`,
};
const NARRATE = [
  'Staged rows; validating amendment state…',
  'Running ut_script.PROCESS_SCRIPT against the sandbox…',
  'Cross-checking classifier set against the dossier…',
  'Reconciling row counts after load…',
  'Reading UT_TEST journal for postings…',
];
function resolveSignal(t, k, note){
  setSig(t,k,false);
  if(k==='uncertainty'){ t._answered=true; pushChat(t,'operator', note||'Use reading B (tiered).'); pushChat(t,'agent','Got it — proceeding with that. Thanks.'); }
  else if(k==='permission'){ t._approved=true; pushChat(t,'operator','✓ Approved write.'); pushChat(t,'agent','Write committed. Will clear PI before Done.'); }
  else if(k==='missing-skill'){ t._skillFilled=true; pushChat(t,'operator', note||'Proceed best-effort; logged a skill-gap.'); pushChat(t,'agent','Acknowledged — capability gap fed to the learning loop.'); }
  else if(k==='error-loop'){ t._loopBroken=true; pushChat(t,'operator','Switch approach.'); pushChat(t,'agent','Switching strategy — different hypothesis from source.'); }
  t.lastProgressAt=sim.t;
  logInt(t, `helped: ${k} resolved`);
}

// ----------------------------- orchestrator chat + injection -----------
function orchSay(who,text,opts){ state.orch.push(Object.assign({who,text,t:fmtClock(sim.t)},opts||{})); if(state.orch.length>140) state.orch.shift(); if(!$('#orch').classList.contains('collapsed')) renderOrch(); }
function operatorInject(text){
  orchSay('operator', text);
  const lc=text.toLowerCase();
  let base = TEMPLATES.find(x=> x.title.toLowerCase().split(/\W+/).some(w=>w.length>4&&lc.includes(w)));
  const kind = lc.includes('test')?'test' : /incident|decline|fail|outage|bug/.test(lc)?'defect' : /env|sandbox|cutie|install/.test(lc)?'env' : 'product';
  const agent = kind==='defect'?'support-engineer' : kind==='env'?'environment-manager' : kind==='test'?'product-tester' : 'product-developer';
  const tpl = base ? Object.assign({}, base, { title:text.replace(/\s+/g,' ').trim().slice(0,46), req:text, source:'manual', kind, agent })
                   : { title:text.replace(/\s+/g,' ').trim().slice(0,46), req:text, source:'manual', prio:2, agent, kind, skills:['way4-product-config'], profile:'Manual', behaviour:'healthy', model:'Sonnet' };
  setTimeout(()=>{ if(!state) return; orchSay('orchestrator','Clarifying scope · checking the solution cache for a prior match…'); }, 500);
  setTimeout(()=>{ if(!state) return; emitConfirmation(tpl); }, 1300);
}
function emitConfirmation(tpl){
  const est = 80000 + Math.round(((idSeq*97)%11)/10 * 540000);
  const secs = 60 + ((idSeq*53)%160);
  const prio = tpl.prio || 2;
  const model = tpl.model || (tpl.kind==='test'?'Haiku':tpl.kind==='product'?'Opus':'Sonnet');
  const plan = planFor({kind:tpl.kind, agent:tpl.agent});
  state.pending = { tpl, est, secs, prio, model, plan };
  orchSay('orchestrator', '', { confirm:true });
}
function confirmPending(ok){
  const p=state.pending; if(!p) return; state.pending=null;
  if(ok){
    const t=makeTask(p.tpl,'queued'); t.priority=p.prio; t.estTokens=p.est; t.estSeconds=p.secs; t.model=p.model;
    state.tasks.push(t);
    orchSay('orchestrator', `Confirmed → queued as ${t.id} · ${agentName(t.agent)} · ${p.plan.length}-stage plan · P${t.priority}.`);
  } else orchSay('orchestrator', 'Cancelled — nothing queued.');
  render(); renderOrch();
}

// ----------------------------- sources ---------------------------------
const SOURCES = ['jira','slack','manual','monitoring','scheduled'];
const SRC_META = {
  jira:       { label:'Jira',       icon:'🟦', cls:'jira' },
  slack:      { label:'Slack',      icon:'💬', cls:'slack' },
  manual:     { label:'Manual',     icon:'✍️', cls:'manual' },
  monitoring: { label:'Monitoring', icon:'🔴', cls:'monitoring' },
  scheduled:  { label:'Scheduled',  icon:'🕒', cls:'scheduled' },
};
function srcLabel(s){ return (SRC_META[s]?SRC_META[s].label:String(s)).toUpperCase(); }

// ----------------------------- rendering -------------------------------
function laneOf(t){ if(t.status==='queued')return'queued'; if(t.status==='running'||t.status==='interrupted')return'running'; return'done'; }

function render(){
  const buckets={queued:[],running:[],done:[]};
  for(const t of state.tasks){ if(passesSource(t)) buckets[laneOf(t)].push(t); }
  buckets.queued.sort((a,b)=> a.priority-b.priority || (a.queuePos??a.enteredQueue) - (b.queuePos??b.enteredQueue));
  // Running grid: sort by COMPLETENESS left→right (least complete near Queued)
  buckets.running.sort((a,b)=> a.pctDone-b.pctDone || a.createdAt-b.createdAt);
  buckets.done.sort((a,b)=> (b.completedAt??0)-(a.completedAt??0));

  // apply Running-lane filters (hot/paused/agent) only to the running bucket
  buckets.running = buckets.running.filter(t=>{
    if(filters.laneStat==='hot' && temperature(t).band!=='hot') return false;
    if(filters.laneStat==='paused' && !isPaused(t)) return false;
    if(filters.agent.size && !filters.agent.has(currentAgent(t))) return false;
    return true;
  });

  // ----- expanded (list→detail) takes over its lane, for all 3 lanes -----
  const LANE_EL = {
    queued:  { strip:'#queued-strip',  detail:'#queued-detail',  render:renderQueuedDetail },
    running: { strip:'#run-strip',     detail:'#run-detail',     render:renderRunDetail },
    done:    { strip:'#done-strip',    detail:'#done-detail',    render:renderDoneDetail },
  };
  for(const lane of ['queued','running','done']){
    const cfg=LANE_EL[lane], grid=lanes[lane], strip=$(cfg.strip), detail=$(cfg.detail);
    let exp = expanded[lane] ? byId(expanded[lane]) : null;
    // the expanded card must still belong to this lane (e.g. a queued card started running)
    if(exp && laneOf(exp)!==lane) exp=null;
    if(exp){
      grid.hidden=true; strip.hidden=false; detail.hidden=false;
      cfg.render(exp);
    } else {
      expanded[lane]=null;
      grid.hidden=false; strip.hidden=true; detail.hidden=true;
    }
  }

  const seen=new Set();
  for(const k in buckets){
    const laneEl=lanes[k];
    buckets[k].forEach((t,idx)=>{
      seen.add(t.id);
      let el=cardEls.get(t.id);
      if(!el || el._lane!==k){ if(el) el.remove(); el=buildCard(t,k); cardEls.set(t.id,el); }
      if(laneEl.children[idx] !== el) laneEl.insertBefore(el, laneEl.children[idx] || null);
      updateCard(el,t,k);
    });
    $('#count-'+k).textContent=buckets[k].length;
  }
  for(const [id,el] of cardEls){ if(!seen.has(id)){ el.remove(); cardEls.delete(id); } }

  // running-lane stat counters
  const runs=state.tasks.filter(t=>t.status==='running');
  $('#n-hot').textContent = runs.filter(t=>temperature(t).band==='hot').length;
  $('#n-paused').textContent = runs.filter(isPaused).length;
  $('#ls-hot').classList.toggle('active', filters.laneStat==='hot');
  $('#ls-paused').classList.toggle('active', filters.laneStat==='paused');
  $('#btn-agentf').classList.toggle('on', filters.agent.size>0);

  renderSrcRail();
}

function buildCard(t, lane){
  const el=document.createElement('div');
  el.className='card '+(lane==='running'?'card-full':'card-line');
  el.dataset.id=t.id; el._lane=lane;
  el.addEventListener('click',(e)=>{
    if(e.target.closest('[data-stop]')) return;
    if(el._wasDragged){ el._wasDragged=false; return; }   // ignore the click that ends a drag
    expanded[lane]=t.id; if(lane==='running') historyMode='steps'; render();
  });
  if(lane==='queued'){
    el.draggable=true;
    el.addEventListener('dragstart',e=>{ el._wasDragged=true; el.classList.add('dragging'); e.dataTransfer.setData('text/plain',t.id); e.dataTransfer.effectAllowed='move'; });
    el.addEventListener('dragend',()=>el.classList.remove('dragging'));
    el.addEventListener('dragover',e=>{ e.preventDefault(); const dr=document.querySelector('.dragging'); if(dr&&dr!==el) el.classList.add('drop-target'); });
    el.addEventListener('dragleave',()=>el.classList.remove('drop-target'));
    el.addEventListener('drop',e=>{ e.preventDefault(); el.classList.remove('drop-target'); reorderQueued(e.dataTransfer.getData('text/plain'), t.id); });
  }
  return el;
}
function reorderQueued(dragId, dropId){
  const a=byId(dragId), b=byId(dropId); if(!a||!b||a===b) return;
  a.priority=b.priority;
  const q = state.tasks.filter(x=>x.status==='queued' && x.priority===b.priority).sort((x,y)=>(x.queuePos??x.enteredQueue)-(y.queuePos??y.enteredQueue));
  const bi=q.indexOf(b); const prev=q[bi-1];
  a.queuePos = prev ? ((prev.queuePos??prev.enteredQueue)+(b.queuePos??b.enteredQueue))/2 : (b.queuePos??b.enteredQueue)-1;
  logInt(a, `reordered → P${a.priority}`);
  render();
}

function updateCard(el,t,lane){
  const tp=temperature(t);
  setClass(el,'band-warm', tp.band==='warm');
  setClass(el,'band-hot', tp.band==='hot');
  setClass(el,'paused', isPaused(t));
  setClass(el,'status-done', t.status==='done');
  setClass(el,'status-failed', t.status==='failed');
  if(t.completedAt!=null && !el._celebrated && t.status==='done'){ el._celebrated=true; el.classList.add('just-done'); setTimeout(()=>el.classList.remove('just-done'),900); }
  if(lane==='queued')  return updateQueuedCard(el,t);
  if(lane==='done')    return updateDoneCard(el,t);
  return updateRunningCard(el,t,tp);
}

// Queued one-liner
function updateQueuedCard(el,t){
  const sig=['q',t.title,t.priority,t.kind].join('|'); if(el._sig===sig) return; el._sig=sig;
  const k=KIND_ICON[t.kind]||KIND_ICON.product;
  el.innerHTML = `
    <span class="drag-grip" title="drag to reorder priority">⣿</span>
    <span class="kind-ico" title="${k.label}">${k.icon}</span>
    <span class="line-title">${esc(t.title)}</span>
    <span class="prio p${t.priority}">P${t.priority}</span>`;
}
// Done one-liner
function updateDoneCard(el,t){
  const sig=['d',t.title,t.status,Math.round(t.usedTokens)].join('|'); if(el._sig===sig) return; el._sig=sig;
  const k=KIND_ICON[t.kind]||KIND_ICON.product;
  const tag = t.status==='failed'?'<span class="done-x">✗</span>':'<span class="done-ok">✓</span>';
  el.innerHTML = `${tag}<span class="kind-ico">${k.icon}</span><span class="line-title">${esc(t.title)}</span><span class="done-cost">${fmtTok(t.usedTokens)} · ${fmtClock(t.runSeconds)}</span>`;
}

// Running card (grid view)
function updateRunningCard(el,t,tp){
  const sigs=activeSignals(t), pos=stagePos(t), pct=Math.round(t.pctDone*100);
  const pr=pauseReason(t);
  const sig=['r',t.priority,tp.band,sigs.join(','),pr||'',t.cardPaused,pct,pos.doneSteps,Math.round(t.usedTokens),Math.round(t.runSeconds),currentAgent(t)].join('|');
  if(el._sig===sig) return; el._sig=sig;

  const pausedTag = pr ? `<span class="pause-tag">⏸ paused · ${pr}</span>` : '';
  const pauseLbl = t.cardPaused ? '▶' : '⏸';
  // compact card: plain % bar where % = completed-steps / total-steps
  const stepPct = Math.round(((pos.doneSteps+1)/pos.total)*100);

  el.innerHTML = `
    <div class="card-top">
      <span class="src-badge ${SRC_META[t.source].cls}">${srcLabel(t.source)}</span>
      <span class="prio p${t.priority}">P${t.priority}</span>
      <span class="card-ref">${t.originRef||t.id}</span>
      <button class="card-pause" data-stop data-pause title="${t.cardPaused?'resume':'pause'} this card">${pauseLbl}</button>
    </div>
    <div class="card-title">${esc(t.title)}</div>
    <div class="meta-line">
      <span class="agent-now" title="agent currently on the card">${agentName(currentAgent(t))}</span>
      <span class="model-chip" title="model · context size">${t.model} · ${t.ctxK}k ctx</span>
    </div>
    ${ sigs.length ? `<div class="sig-row">${sigs.map(k=>{const m=HOT_SIGNALS[k];return `<button class="sig-chip ${m.cls}" data-stop data-sig="${k}" title="${m.tip}">${m.icon} ${m.label}</button>`}).join('')}</div>` : '' }
    ${ pausedTag }
    <div class="stage-line">stage ${pos.stageIdx+1}/${pos.stageCount} · step ${pos.stepIdx+1}/${pos.stepCount} <span class="stage-name">${esc(pos.stageName)}</span></div>
    <div class="nums">
      <span class="num ${tp.tokR>1.5?'over':''}"><b>tok</b> ${fmtTok(t.usedTokens)}/${fmtTok(t.estTokens)}</span>
      <span class="num ${tp.timeR>1.5?'over':''}"><b>time</b> ${fmtClock(t.runSeconds)}/${fmtClock(t.estSeconds)}</span>
    </div>
    <div class="prog-bar" title="${pos.doneSteps+1}/${pos.total} steps"><i style="width:${stepPct}%"></i><span class="prog-pct">${stepPct}%</span></div>`;

  el.querySelectorAll('[data-sig]').forEach(b=>b.onclick=ev=>{ ev.stopPropagation(); expanded.running=t.id; historyMode='steps'; render(); const g=$('#run-detail .gate'); if(g) g.scrollIntoView({block:'nearest'}); });
  const pb=el.querySelector('[data-pause]'); if(pb) pb.onclick=ev=>{ ev.stopPropagation(); t.cardPaused=!t.cardPaused; if(t.cardPaused)t.lastProgressAt=sim.t; logInt(t,t.cardPaused?'paused':'resumed'); render(); };
}

// ----------------------------- expanded running detail (in-lane) -------
function renderRunDetail(t){
  const d=$('#run-detail');
  const tp=temperature(t), pos=stagePos(t), pct=Math.round(t.pctDone*100);
  const sigs=activeSignals(t);
  const blocking = BLOCKING.filter(k=>t.signals[k]);

  // blocking gate goes at the TOP (red border)
  const gate = blocking.length ? renderGate(t, blocking[0]) : '';

  // economics in ONE row
  const econ = `<div class="econ-row">
    <div class="ev"><span>progress</span><b>${pct}%</b></div>
    <div class="ev"><span>tok</span><b class="${tp.tokR>1.5?'over':''}">${fmtTok(t.usedTokens)}/${fmtTok(t.estTokens)}</b></div>
    <div class="ev"><span>time</span><b class="${tp.timeR>1.5?'over':''}">${fmtClock(t.runSeconds)}/${fmtClock(t.estSeconds)}</b></div>
    <div class="ev"><span>model</span><b>${t.model} · ${t.ctxK}k</b></div>
    <div class="ev"><span>temp</span><b class="temp-${tp.band}">${tp.band==='neutral'?'—':tp.over.toFixed(2)+'×'} ${tp.band}</b></div>
  </div>`;

  d.innerHTML = `
    <div class="rd-head">
      <span class="src-badge ${SRC_META[t.source].cls}">${srcLabel(t.source)}</span>
      <span class="prio p${t.priority}">P${t.priority}</span>
      <span class="agent-now">${agentName(currentAgent(t))}</span>
      <span class="rd-ref">${t.originRef||t.id}</span>
      <button class="card-pause big" data-rdpause title="${t.cardPaused?'resume':'pause'}">${t.cardPaused?'▶':'⏸'}</button>
    </div>
    <div class="rd-title">${esc(t.title)}</div>
    <div class="rd-req">${esc(t.requirement)}</div>

    ${gate}

    <div class="rd-stages">
      <div class="rd-stagehdr">Mini-sprints — stage ${pos.stageIdx+1}/${pos.stageCount} · step ${pos.stepIdx+1}/${pos.stepCount}</div>
      <div class="stage-track">${pos.plan.map((s,i)=>`<div class="st-cell ${i<pos.stageIdx?'done':i===pos.stageIdx?'cur':''}"><span class="st-n">${i+1}</span><span class="st-name">${esc(s.name)}</span></div>`).join('')}</div>
    </div>

    ${econ}

    <div class="rd-section">
      <div class="rd-h">
        <span>History</span>
        <div class="hist-toggle" id="hist-toggle">
          <button data-hist="journey" class="${historyMode==='journey'?'on':''}">Journey</button>
          <button data-hist="steps" class="${historyMode==='steps'?'on':''}">Steps</button>
        </div>
      </div>
      <div class="hist-body">${ historyMode==='journey' ? renderJourney(t) : renderSteps(t) }</div>
    </div>

    <div class="rd-section">
      <div class="rd-h"><span>Chat — direct line to ${agentName(currentAgent(t))}</span></div>
      <div class="chat-log" id="rd-chat">${renderCardChat(t)}</div>
      ${renderCardChatInput(t)}
    </div>

    <div class="rd-section">
      <div class="rd-h"><span>SKILL files</span></div>
      <div class="skill-list">${t.skills.map(s=>`<span class="skill-chip" data-skill="${s}">${s}</span>`).join('')}</div>
      <div class="skill-reader" id="skill-reader"></div>
    </div>`;

  // wire
  $('#back-all').onclick=()=>{ expanded.running=null; render(); };
  d.querySelector('[data-rdpause]').onclick=()=>{ t.cardPaused=!t.cardPaused; if(t.cardPaused)t.lastProgressAt=sim.t; logInt(t,t.cardPaused?'paused':'resumed'); render(); };
  d.querySelectorAll('#hist-toggle [data-hist]').forEach(b=>b.onclick=()=>{ historyMode=b.dataset.hist; render(); });
  d.querySelectorAll('.skill-chip').forEach(c=>c.onclick=()=>{
    const r=$('#skill-reader'); const name=c.dataset.skill;
    d.querySelectorAll('.skill-chip').forEach(x=>x.classList.remove('active')); c.classList.add('active');
    r.innerHTML=`<span class="sk-name">${name}</span>${esc(SKILLS[name]||'(skill text not cached)')}`; r.classList.add('show');
  });
  wireGate(t,d);
  wireCardChat(t,d);
  const sc=$('#rd-chat'); if(sc) sc.scrollTop=sc.scrollHeight;
}

// ----------------------------- queued detail (in-lane) -----------------
function renderQueuedDetail(t){
  const d=$('#queued-detail');
  const plan=t.plan||planFor(t);
  const k=KIND_ICON[t.kind]||KIND_ICON.product;
  d.innerHTML = `
    <div class="rd-head">
      <span class="src-badge ${SRC_META[t.source].cls}">${srcLabel(t.source)}</span>
      <span class="prio p${t.priority}">P${t.priority}</span>
      <span class="kind-chip">${k.icon} ${k.label}</span>
      <span class="rd-ref">${t.originRef||t.id}</span>
    </div>
    <div class="rd-title">${esc(t.title)}</div>
    <div class="rd-req">${esc(t.requirement)}</div>

    <div class="rd-section">
      <div class="rd-h"><span>Proposed plan · ${plan.length} stages</span></div>
      <ol class="plan-list">${plan.map(s=>`<li>${esc(s.name)} <span class="pl-steps">${s.steps.length} steps</span></li>`).join('')}</ol>
    </div>

    <div class="rd-section">
      <div class="rd-h"><span>Estimate</span></div>
      <div class="econ-row">
        <div class="ev"><span>tokens</span><b>${fmtTok(t.estTokens)}</b></div>
        <div class="ev"><span>time</span><b>${fmtClock(t.estSeconds)}</b></div>
        <div class="ev"><span>agent</span><b>${agentName(t.agent)}</b></div>
        <div class="ev"><span>queued</span><b>#${queuePosOf(t)}</b></div>
      </div>
    </div>

    <div class="rd-section">
      <div class="rd-h"><span>Priority &amp; routing</span></div>
      <div class="q-actions">
        <button class="btn" data-q="raise" ${t.priority<=1?'disabled':''}>▲ Raise priority</button>
        <button class="btn" data-q="lower" ${t.priority>=3?'disabled':''}>▼ Lower priority</button>
        <button class="btn btn-primary" data-q="start">▶ Start now</button>
        <button class="btn btn-danger" data-q="bounce">↩ Bounce to originator</button>
      </div>
    </div>`;
  d.querySelector('[data-q="raise"]').onclick=()=>{ t.priority=Math.max(1,t.priority-1); logInt(t,`raised → P${t.priority}`); render(); };
  d.querySelector('[data-q="lower"]').onclick=()=>{ t.priority=Math.min(3,t.priority+1); logInt(t,`lowered → P${t.priority}`); render(); };
  d.querySelector('[data-q="start"]').onclick=()=>{ t.status='running'; t.lastProgressAt=sim.t; t.steps=stepsFor(t); expanded.queued=null; expanded.running=t.id; historyMode='steps'; render(); };
  d.querySelector('[data-q="bounce"]').onclick=()=>{ const idx=state.tasks.indexOf(t); if(idx>=0) state.tasks.splice(idx,1); cardEls.get(t.id)?.remove(); cardEls.delete(t.id); expanded.queued=null; orchSay('orchestrator',`Bounced ${t.id} to ${SRC_META[t.source].label} originator — needs clarification.`); render(); };
}
function queuePosOf(t){
  const q=state.tasks.filter(x=>x.status==='queued' && passesSource(x)).sort((a,b)=> a.priority-b.priority || (a.queuePos??a.enteredQueue)-(b.queuePos??b.enteredQueue));
  return Math.max(1, q.indexOf(t)+1);
}

// ----------------------------- done detail (in-lane, read-only) --------
function renderDoneDetail(t){
  const d=$('#done-detail');
  const failed = t.status==='failed';
  const k=KIND_ICON[t.kind]||KIND_ICON.product;
  // distilled-artifact line varies by kind/outcome
  const artifact = failed ? '✗ bounced to originator · no artifact'
    : t.kind==='product' ? '→ building-block CCM promoted · change-log written'
    : t.kind==='defect'  ? '→ fix validated · root-cause lesson proposed'
    : t.kind==='env'     ? '→ golden image committed'
    : '→ PI regression bundle archived';
  d.innerHTML = `
    <div class="rd-head">
      <span class="src-badge ${SRC_META[t.source].cls}">${srcLabel(t.source)}</span>
      <span class="outcome ${failed?'fail':'ok'}">${failed?'✗ failed / bounced':'✓ success'}</span>
      <span class="rd-ref">${t.originRef||t.id}</span>
    </div>
    <div class="rd-title">${esc(t.title)}</div>
    <div class="rd-req">${esc(t.requirement)}</div>

    <div class="rd-section">
      <div class="rd-h"><span>Final cost</span></div>
      <div class="econ-row">
        <div class="ev"><span>tokens</span><b>${fmtTok(t.usedTokens)}</b></div>
        <div class="ev"><span>time</span><b>${fmtClock(t.runSeconds)}</b></div>
        <div class="ev"><span>agent</span><b>${agentName(t.agent)}</b></div>
        <div class="ev"><span>type</span><b>${k.icon} ${k.label}</b></div>
      </div>
    </div>

    <div class="rd-section">
      <div class="rd-h"><span>Journey — who did what</span></div>
      <div class="hist-body">${renderJourney(t)}</div>
    </div>

    <div class="rd-section">
      <div class="rd-h"><span>Distilled artifact</span></div>
      <div class="artifact ${failed?'fail':''}">${artifact}</div>
    </div>`;
}

// blocking gate (top, red): permission = tool approval; uncertainty = question + options
function renderGate(t, k){
  const m=HOT_SIGNALS[k];
  if(k==='permission'){
    return `<div class="gate gate-perm">
      <div class="gate-h">${m.icon} Tool approval gate</div>
      <div class="gate-tool">write · SERV_PACK + SERVICE rows → sandbox</div>
      <div class="gate-btns"><button class="btn btn-primary" data-gate="approve">Approve</button><button class="btn btn-danger" data-gate="deny">Deny</button></div>
    </div>`;
  }
  if(k==='uncertainty'){
    return `<div class="gate gate-ask">
      <div class="gate-h">${m.icon} ${agentName(currentAgent(t))} needs a decision</div>
      <div class="gate-q">${esc(PROMPT_TEXT.uncertainty(t))}</div>
      <div class="gate-opts">
        <button class="opt" data-gate="answer" data-ans="Reading A — flat interest">Reading A · flat interest</button>
        <button class="opt" data-gate="answer" data-ans="Reading B — tiered interest">Reading B · tiered interest</button>
      </div>
      <div class="gate-row"><input id="gate-input" placeholder="…or type your own answer" /><button class="btn" data-gate="answer">Send</button></div>
    </div>`;
  }
  if(k==='missing-skill'){
    return `<div class="gate gate-skill">
      <div class="gate-h">${m.icon} Capability gap</div>
      <div class="gate-q">The rails don’t cover this scheme rule. Fill the gap or proceed best-effort.</div>
      <div class="gate-btns"><button class="btn btn-primary" data-gate="skill-proceed">Proceed best-effort</button><button class="btn" data-gate="skill-point">Point at a skill</button></div>
    </div>`;
  }
  // error-loop
  return `<div class="gate gate-err">
    <div class="gate-h">${m.icon} Too many failures — possible thrashing</div>
    <div class="gate-retries"><div>✗ attempt 1 · same ORA-error</div><div>✗ attempt 2 · same ORA-error</div><div>✗ attempt 3 · same ORA-error</div></div>
    <div class="gate-btns"><button class="btn btn-primary" data-gate="switch">Switch approach</button><button class="btn" data-gate="hold">Hold &amp; watch</button></div>
  </div>`;
}
function wireGate(t,d){
  d.querySelectorAll('[data-gate]').forEach(b=>b.onclick=()=>{
    const g=b.dataset.gate;
    if(g==='approve') resolveSignal(t,'permission');
    else if(g==='deny'){ setSig(t,'permission',false); t._approved=true; pushChat(t,'operator','✕ Denied write.'); pushChat(t,'agent','Understood — skipping the write; will flag in the gap report.'); logInt(t,'denied write'); }
    else if(g==='answer'){ const inp=$('#gate-input'); const note=b.dataset.ans||(inp&&inp.value.trim())||''; resolveSignal(t,'uncertainty',note); }
    else if(g==='skill-proceed') resolveSignal(t,'missing-skill');
    else if(g==='skill-point') resolveSignal(t,'missing-skill','pointed at scheme-to-way4-mapping');
    else if(g==='switch') resolveSignal(t,'error-loop');
    else if(g==='hold'){ pushChat(t,'operator','Hold — keep trying, I\'m watching.'); }
    render();
  });
}

// history depth 1: Journey (role timeline, per-agent summary)
function renderJourney(t){
  const j=journey(t);
  if(!j.length) return `<div class="empty">no journey yet…</div>`;
  return `<div class="journey">${j.map((sp,i)=>`
    <div class="jrow ${sp.status}">
      <span class="jdot"></span>
      <div class="jbody"><span class="jwho">${agentName(sp.who)}</span><span class="jsum">${esc(sp.summary)}</span></div>
      <span class="jst ${sp.status}">${sp.status==='run'?'active':'done'}</span>
    </div>`).join('')}</div>`;
}
// history depth 2: Steps of the CURRENT agent (granular)
function renderSteps(t){
  const cur=currentAgent(t);
  const pos=stagePos(t);
  // steps of the current agent from the transcript
  const mine=(t.steps||[]).filter(s=>s.who===cur);
  const rows = mine.map(s=>{
    const done=t.emitted[s.at] && t.pctDone>s.at+0.001;
    const active=t.emitted[s.at] && !done;
    return `<div class="sstep ${done?'done':active?'cur':''}"><span class="sdot"></span><span class="stask">${esc(s.task)}</span><span class="stext">${esc(s.text)}</span></div>`;
  }).join('');
  return `<div class="steps">
    <div class="steps-hdr">${agentName(cur)} · ${pos.stageName} — step ${pos.stepIdx+1}/${pos.stepCount}</div>
    <div class="steps-now"><span class="sdot cur"></span><b>now:</b> ${esc(pos.stepName)}</div>
    ${rows}
  </div>`;
}

function renderCardChat(t){
  if(!t.chat.length) return `<div class="empty">session has not started emitting yet…</div>`;
  return t.chat.map(m=>{
    const promptCls = m.prompt?` prompt prompt-${HOT_SIGNALS[m.prompt].cls}`:'';
    const who = m.who==='agent' ? agentName(m.who2||currentAgent(t)) : (m.who==='operator'?'operator':m.who);
    return `<div class="msg ${m.who}${promptCls}"><span class="msg-who">${esc(who)}</span><span class="msg-t">${m.t}</span><div class="msg-text">${esc(m.text)}</div></div>`;
  }).join('');
}
function renderCardChatInput(t){
  if(t.status!=='running') return '';
  return `<div class="ca-row plain"><input id="ca-input" placeholder="Message this session / redirect…" /><button class="btn" data-send="card">Send</button></div>`;
}
function wireCardChat(t,d){
  const sendBtn=d.querySelector('[data-send="card"]');
  if(sendBtn) sendBtn.onclick=()=>{ const inp=$('#ca-input'); const v=inp&&inp.value.trim(); if(!v)return; pushChat(t,'operator',v); pushChat(t,'agent','Noted — folding that into the run.'); t.lastProgressAt=sim.t; render(); };
}

// ----------------------------- interventions ---------------------------
function logInt(t,msg){ t.interventions.unshift(`${fmtClock(sim.t)} · ${msg}`); }

// ----------------------------- orchestrator render ---------------------
function renderOrch(){
  const log=$('#orch-log'); if(!log) return;
  log.innerHTML = state.orch.map(m=>{
    if(m.confirm) return renderConfirmCard();
    return `<div class="msg ${m.who}"><span class="msg-who">${m.who==='system'?'source':m.who}</span><span class="msg-t">${m.t}</span><div class="msg-text">${esc(m.text)}</div></div>`;
  }).join('');
  log.scrollTop = log.scrollHeight;
  const c=log.querySelector('#confirm-card');
  if(c){ c.querySelector('[data-confirm]').onclick=()=>confirmPending(true); c.querySelector('[data-cancel]').onclick=()=>confirmPending(false); }
}
function renderConfirmCard(){
  const p=state.pending;
  if(!p) return `<div class="msg orchestrator"><div class="msg-text empty">task confirmed</div></div>`;
  const k=KIND_ICON[p.tpl.kind]||KIND_ICON.product;
  return `<div class="confirm-card" id="confirm-card">
    <div class="cc-head">${k.icon} Confirm new task</div>
    <div class="cc-title">${esc(p.tpl.title)}</div>
    <div class="cc-grid">
      <div><span>estimate</span><b>${fmtTok(p.est)} · ${fmtClock(p.secs)}</b></div>
      <div><span>priority</span><b>P${p.prio}</b></div>
      <div><span>agent</span><b>${agentName(p.tpl.agent)}</b></div>
      <div><span>model</span><b>${p.model}</b></div>
    </div>
    <div class="cc-plan"><span>staged plan</span><div class="cc-stages">${p.plan.map((s,i)=>`<span class="cc-stage">${i+1}. ${esc(s.name)}</span>`).join('')}</div></div>
    <div class="cc-btns"><button class="btn btn-primary" data-confirm>Confirm → Queue</button><button class="btn" data-cancel>Cancel</button></div>
  </div>`;
}

// ----------------------------- sources rail render ---------------------
function renderSrcRail(){
  const rail=$('#src-rail'); if(!rail) return;
  rail.innerHTML = SOURCES.map(s=>{
    const m=SRC_META[s];
    const n=state.tasks.filter(x=>x.source===s).length;
    const live=(sim.t-(state.srcPulse[s]||-99))<3;
    const on=filters.source.has(s);
    return `<button class="src-item ${m.cls} ${live?'live':''} ${on?'sel':''}" data-src="${s}" title="filter by ${m.label}"><span class="si">${m.icon}</span><span class="sn">${m.label}</span><span class="sc">${n}</span></button>`;
  }).join('');
  rail.querySelectorAll('[data-src]').forEach(b=>b.onclick=()=>{ toggleSet(filters.source,b.dataset.src); render(); });
}

// ----------------------------- agent filter (Running lane) -------------
function buildAgentFilter(){
  const pop=$('#agentf-pop');
  const agents=['environment-manager','product-developer','product-tester','way4-analyst','payment-scheme-expert','support-engineer','data-engineer'];
  pop.innerHTML = agents.map(a=>`<button class="af-chip" data-fagent="${a}">${agentName(a)}</button>`).join('')
    + `<button class="af-clear" data-afclear>clear</button>`;
  pop.querySelectorAll('[data-fagent]').forEach(b=>b.onclick=()=>{ toggleSet(filters.agent,b.dataset.fagent); syncAgentFilter(); $('#agentf-pop').hidden=true; render(); });
  pop.querySelector('[data-afclear]').onclick=()=>{ filters.agent.clear(); syncAgentFilter(); $('#agentf-pop').hidden=true; render(); };
}
function syncAgentFilter(){ $('#agentf-pop').querySelectorAll('[data-fagent]').forEach(b=>b.classList.toggle('on', filters.agent.has(b.dataset.fagent))); }

// ----------------------------- helpers ---------------------------------
function byId(id){ return state.tasks.find(t=>t.id===id); }
function setClass(el,c,on){ if(on!==el.classList.contains(c)) el.classList.toggle(c,on); }
function toggleSet(set,v){ set.has(v)?set.delete(v):set.add(v); }
function esc(s){ return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function fmtTok(n){ return n>=1000? (n/1000).toFixed(n>=100000?0:1)+'k' : Math.round(n)+''; }
function fmtClock(s){ s=Math.round(s); const m=Math.floor(s/60), ss=s%60; return m? `${m}m${ss.toString().padStart(2,'0')}s` : `${ss}s`; }

// ----------------------------- seed + boot -----------------------------
function tplByTitle(s){ return TEMPLATES.find(x=>x.title===s); }
function seed(){
  fresh();
  ['JIRA-4821 · FX fee tier','Spin up fresh v62 sandbox'].forEach((title,i)=>{
    const done=makeTask(tplByTitle(title),'done'); done.pctDone=1; done.usedTokens=done.estTokens*0.96; done.runSeconds=done.estSeconds*0.98; done.completedAt=-(i+1); done.steps=stepsFor(done); done.steps.forEach(s=>done.emitted[s.at]=true); state.tasks.push(done);
  });
  ['healthy','hot','slow','stall'].forEach((b,i)=>{
    const tpl = TEMPLATES.find(x=>x.behaviour===b) || TEMPLATES[i];
    const t=makeTask(tpl,'running'); t.pctDone=0.16+i*0.12; t.runSeconds=t.estSeconds*t.pctDone*(b==='hot'?2.0:b==='slow'?1.6:1.0);
    t.usedTokens=t.estTokens*t.pctDone*(b==='hot'?2.1:b==='slow'?1.5:1.0); t.lastProgressAt=(b==='stall')?-20:0; t.steps=stepsFor(t); emitSteps(t); growChat(t,false); maintainSignals(t); state.tasks.push(t);
  });
  [['Amex Gold credit product','permission',0.34],['Reissued cards not activating','uncertainty',0.55],['JCB auth plugin compliance','missing-skill',0.42]]
  .forEach(([title,,pct])=>{
    const t=makeTask(tplByTitle(title),'running'); t.pctDone=pct; t.runSeconds=t.estSeconds*pct; t.usedTokens=t.estTokens*pct;
    t.lastProgressAt=sim.t-2; t.steps=stepsFor(t); emitSteps(t); growChat(t,false); maintainSignals(t); state.tasks.push(t);
  });
  ['JIRA-4833 · Rolling Reserve','Import client cutie (Acme v62)','RE: decompose CRED_07 fee chain','30-day grace credit product','PI regression · Acme debit suite','Migrate legacy portfolio (2.1M)']
  .forEach(title=>{ const t=makeTask(tplByTitle(title),'queued'); state.tasks.push(t); });
  state.tasks.forEach(t=>{ if(t.status==='queued')t.enteredQueue=sim.t; });
  render();
}

// ----------------------------- controls --------------------------------
$('#btn-pause').onclick=e=>{ paused=!paused; e.target.textContent=paused?'▶ Resume':'⏸ Pause'; };
$('#btn-reset').onclick=()=>{ expanded.queued=expanded.running=expanded.done=null; seed(); };
// "← all <lane>" back controls (delegated; the running button is re-wired per-render too)
document.addEventListener('click',e=>{ const b=e.target.closest('[data-back]'); if(b){ expanded[b.dataset.back]=null; render(); } });
$('#speed').oninput=e=>{ speed=+e.target.value; $('#speed-val').textContent=speed+'×'; };
$('#orch-send').onclick=sendOrch;
$('#orch-input').addEventListener('keydown',e=>{ if(e.key==='Enter') sendOrch(); });
function sendOrch(){ const i=$('#orch-input'); const v=i.value.trim(); if(!v)return; i.value=''; operatorInject(v); }

// orchestrator sidebar collapse / reopen
function setOrch(collapsed){
  $('#orch').classList.toggle('collapsed', collapsed);
  $('#shell').classList.toggle('orch-collapsed', collapsed);
  $('#orch-reopen').hidden = !collapsed;
  if(!collapsed) renderOrch();
}
$('#orch-collapse').onclick=()=>setOrch(true);
$('#orch-reopen').onclick=()=>setOrch(false);

// Running-lane stat filters
$('#ls-hot').onclick=()=>{ filters.laneStat = filters.laneStat==='hot'?null:'hot'; render(); };
$('#ls-paused').onclick=()=>{ filters.laneStat = filters.laneStat==='paused'?null:'paused'; render(); };
// agent filter popover
$('#btn-agentf').onclick=(e)=>{ e.stopPropagation(); const pop=$('#agentf-pop'); pop.hidden=!pop.hidden; };
document.addEventListener('click',e=>{ const pop=$('#agentf-pop'); if(pop && !pop.hidden && !pop.contains(e.target) && e.target!==$('#btn-agentf')) pop.hidden=true; });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if(expanded.queued||expanded.running||expanded.done){ expanded.queued=expanded.running=expanded.done=null; render(); } } });

buildAgentFilter();
seed();
setInterval(tick, CFG.tickMs);
