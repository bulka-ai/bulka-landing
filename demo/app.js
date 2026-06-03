/* Bulka.AI Operator Flow — prototype simulation (no backend).
   Implements the openspec/changes/task-flow-board behavior:
   - cards from jira/manual/monitoring with priority + pre-run estimate
   - lanes backlog -> queued -> running -> done, ordered by priority
   - live token/time burn; D3 temperature math; stall detection
   - clickable detail: agent + sub-agent tree, SKILL files, interventions
   - completions flow to Done with a success pulse                          */

'use strict';

// ----------------------------- config ---------------------------------
const CFG = {
  tickMs: 350,          // real ms per tick
  dtSim: 2.0,           // sim-seconds advanced per tick at 1x speed
  maxRunning: 5,        // concurrency
  stallSec: 12,         // no-progress window -> stalled
  warmupPct: 0.06,      // below this %done, hold cool (ε guard on the ratio)
  warmBand: 1.0, hotBand: 1.5,
  injectEverySec: 22,   // auto-ingest cadence (sim seconds)
};

// ----------------------------- skill texts ----------------------------
const SKILLS = {
  'way4-product-config': `# way4-product-config\nConfigure Credit/Debit/Merchant products as DB rows.\nRoots: APPL_PRODUCT, SERV_PACK, ACC_SCHEME.\nPattern: write rows -> call activation PL/SQL -> verify amendment state.`,
  'way4-product-inspector': `# way4-product-inspector\nBuild TEST_SCHEME / TEST_STEP rows, run ut_script.PROCESS_SCRIPT,\nread UT_TEST / UT_TEST_MSG to interpret what actually happened.`,
  'way4-decline-analysis': `# way4-decline-analysis\nWalk the auth decision tree for a single declined transaction.\nIdentify which validation fired and whether the decline is correct,\na defect, a misconfiguration, or a scheme-rule violation.`,
  'way4-batch-monitoring': `# way4-batch-monitoring\nMonitor the nightly cycle, clearing, settlement, statements, dunning.\nOn failure: read job log, classify ORA-error, recover from safe point.`,
  'way4-incident-resolution': `# way4-incident-resolution\nTriage -> reproduce -> hypothesize from source (not semantics) ->\nvalidate fix against the live sandbox -> generalise to prevent recurrence.`,
  'way4-setup-tags': `# way4-setup-tags\nBehaviour stored as UPPER_SNAKE tags in 4000-char VARCHAR2 columns\n(SERVICE_DETAILS, SPECIAL_PARMS...). Semicolon-separated; read/generate/validate.`,
  'way4-data-migration': `# way4-data-migration\nBulk-load millions of rows into Way4. Initial loads, re-migrations,\nmergers. Stage -> validate integrity -> load -> reconcile counts.`,
  'way4-product-composition': `# way4-product-composition\nDesign products from a target capability: pick the root, decompose\ninto SERV_PACK/SERVICE/ACC_TEMPL, iterate to a passing PI test.`,
  'way4-feature-blocks': `# way4-feature-blocks\nStitch a skeleton block + feature blocks (e.g. Rolling Reserve),\nload via ccm-load.sh, iterate in sandbox to a PI-green product.`,
  'scheme-to-way4-mapping': `# scheme-to-way4-mapping\nFor each scheme rule, record its Way4 realization: CARD_PRODUCT /\nSERV_PACK / ACC_SCHEME settings, IPS plugin, classifier set, IF++ tier.`,
  'payment-scheme-rules': `# payment-scheme-rules\nPlatform-agnostic catalog of Visa/MC/Amex/Discover/JCB/UPI mandates:\nauth protocols, clearing formats, interchange, BIN admin, disputes.`,
  'way4-prod-data-obfuscation': `# way4-prod-data-obfuscation\nProduce a safe sandbox copy: mask PAN/PII while preserving relational\nintegrity and value distributions that make the sandbox useful.`,
  'way4-environment': `# way4-environment\nbuild / snapshot / refresh / list golden Way4 images on Oracle Free.\nSnapshot a restore-point before an experiment; refresh to discard.`,
};

// ----------------------------- task templates --------------------------
const TEMPLATES = [
  { title:'30-day grace credit product', req:'Configure a Credit product with a 30-day grace period and tiered interest.',
    source:'manual', prio:3, agent:'product-developer', skills:['way4-product-config','way4-product-inspector'], profile:'CRED build', behaviour:'healthy' },
  { title:'Decline spike on BIN 521342', req:'Authorization decline rate on BIN 521342 jumped 6× overnight — find why.',
    source:'monitoring', ref:'MON-DECL-521342', prio:1, agent:'support-engineer', skills:['way4-decline-analysis','way4-incident-resolution'], profile:'Incident', behaviour:'hot' },
  { title:'MC clearing batch failed', req:'Nightly Mastercard clearing batch failed with ORA-01652 — recover and re-run.',
    source:'monitoring', ref:'MON-BATCH-MC', prio:1, agent:'support-engineer', skills:['way4-batch-monitoring'], profile:'Incident', behaviour:'healthy' },
  { title:'JIRA-4821 · FX fee tier', req:'Add a foreign-currency fee tier (1.75%) to the Acme debit product.',
    source:'jira', ref:'JIRA-4821', prio:2, agent:'product-developer', skills:['way4-setup-tags','way4-product-config'], profile:'Acme debit', behaviour:'healthy' },
  { title:'Migrate legacy portfolio (2.1M)', req:'Bulk-migrate 2.1M legacy cards onto product CRED_07.',
    source:'jira', ref:'JIRA-4790', prio:2, agent:'data-engineer', skills:['way4-data-migration'], profile:'Migration', behaviour:'slow' },
  { title:'Outage: auth host timeouts', req:'Auth host POSTMAN timeouts since 02:14 — investigate and restore.',
    source:'monitoring', ref:'MON-OUT-AUTH', prio:1, agent:'support-engineer', skills:['way4-incident-resolution'], profile:'Incident', behaviour:'stall' },
  { title:'JIRA-4833 · Rolling Reserve', req:'Add a 10% rolling reserve held 90 days to merchant product MER_03.',
    source:'jira', ref:'JIRA-4833', prio:3, agent:'product-developer', skills:['way4-product-composition','way4-feature-blocks'], profile:'MER_03', behaviour:'healthy' },
  { title:'Reissued cards not activating', req:'Reissued cards stay inactive after issue — clients blocked.',
    source:'monitoring', ref:'MON-ACT-FAIL', prio:1, agent:'support-engineer', skills:['way4-incident-resolution'], profile:'Incident', behaviour:'hot' },
  { title:'JCB auth plugin compliance', req:'Confirm which IPS plugin handles JCB auth and check config compliance.',
    source:'manual', prio:3, agent:'payment-scheme-expert', skills:['scheme-to-way4-mapping','payment-scheme-rules'], profile:'Scheme', behaviour:'healthy' },
  { title:'JIRA-4801 · Obfuscate prod dump', req:'Produce a masked sandbox copy of the prod portfolio for UAT.',
    source:'jira', ref:'JIRA-4801', prio:2, agent:'data-engineer', skills:['way4-prod-data-obfuscation'], profile:'Sandbox', behaviour:'slow' },
  { title:'Spin up fresh v62 sandbox', req:'Install Way4 v62 from distribution and snapshot a golden image.',
    source:'manual', prio:3, agent:'environment-manager', skills:['way4-environment'], profile:'Env', behaviour:'healthy' },
  { title:'JIRA-4855 · Amex interchange', req:'Update Amex interchange categorization for new mandate calendar.',
    source:'jira', ref:'JIRA-4855', prio:2, agent:'payment-scheme-expert', skills:['scheme-to-way4-mapping'], profile:'Scheme', behaviour:'healthy' },
];

// per-agent narrative steps (triggered as %done crosses .at)
function stepsFor(t){
  const A = t.agent;
  const base = [
    { at:0.02, who:'orchestrator', task:'route requirement', text:'Read requirement; matched routing → '+A },
  ];
  const byAgent = {
    'product-developer':[
      { at:0.10, who:'environment-manager', sub:true, task:'snapshot restore-point', text:'snapshot.sh pre-change · golden taken' },
      { at:0.28, who:'product-developer', sub:true, task:'write config rows', text:'SERV_PACK + SERVICE rows staged' },
      { at:0.52, who:'product-developer', sub:true, task:'activation PL/SQL', text:'called activation proc · amendment state = OPEN' },
      { at:0.72, who:'product-tester', sub:true, task:'PI regression', text:'TEST_SCHEME built · running ut_script.PROCESS_SCRIPT' },
      { at:0.93, who:'product-tester', sub:true, task:'read journal', text:'UT_TEST = PASS · postings match requirement' },
    ],
    'support-engineer':[
      { at:0.12, who:'support-engineer', sub:true, task:'triage', text:'pulled failing tx · isolating decision path', warn:true },
      { at:0.34, who:'way4-analyst', sub:true, task:'read config', text:'inspecting ACC_SCHEME + classifier set' },
      { at:0.58, who:'support-engineer', sub:true, task:'reproduce', text:'repro built in sandbox · confirms hypothesis' },
      { at:0.82, who:'support-engineer', sub:true, task:'validate fix', text:'fix applied · re-running probe' },
      { at:0.95, who:'product-tester', sub:true, task:'regression', text:'PI green · incident resolved' },
    ],
    'data-engineer':[
      { at:0.08, who:'data-engineer', sub:true, task:'stage extract', text:'staging legacy extract · row count reconciled' },
      { at:0.30, who:'data-engineer', sub:true, task:'validate integrity', text:'FK + distribution checks running…' },
      { at:0.60, who:'data-engineer', sub:true, task:'load', text:'bulk load in flight · 1.2M / 2.1M' },
      { at:0.88, who:'product-tester', sub:true, task:'spot-check', text:'sampled 500 contracts · balances correct' },
    ],
    'payment-scheme-expert':[
      { at:0.18, who:'payment-scheme-expert', sub:true, task:'scheme lookup', text:'mapped mandate → IPS plugin candidates' },
      { at:0.50, who:'way4-analyst', sub:true, task:'verify mapping', text:'cross-checked CONTRACT_SCHEME + IF++ tier' },
      { at:0.85, who:'payment-scheme-expert', sub:true, task:'compliance note', text:'config compliant · findings handed to developer' },
    ],
    'environment-manager':[
      { at:0.15, who:'environment-manager', sub:true, task:'pull image', text:'gvenzl/oracle-free pulled · container up' },
      { at:0.45, who:'environment-manager', sub:true, task:'install Way4', text:'running install scripts from $WAY4_HOME' },
      { at:0.85, who:'environment-manager', sub:true, task:'snapshot', text:'golden image committed' },
    ],
  };
  return base.concat(byAgent[A] || byAgent['product-developer']);
}

// ----------------------------- state ----------------------------------
let state, sim, paused=false, speed=1.5, attnOnly=false, openId=null, idSeq=1;
const cardEls = new Map();
const $ = s => document.querySelector(s);
const lanes = { backlog:$('#lane-backlog'), queued:$('#lane-queued'), running:$('#lane-running'), done:$('#lane-done') };

function fresh(){ state={tasks:[]}; sim={t:0, lastInject:0}; idSeq=1; cardEls.forEach(e=>e.remove()); cardEls.clear(); openId=null; }

function makeTask(tpl, status){
  const estTokens = 50000 + Math.round(((idSeq*97)%11)/10 * 550000);
  const estSeconds = 50 + ((idSeq*53)%140);
  return {
    id:'T'+(idSeq++), title:tpl.title, requirement:tpl.req, source:tpl.source,
    originRef: tpl.ref || null, priority: tpl.prio || 3, status: status||'backlog',
    profile: tpl.profile, agent: tpl.agent, behaviour: tpl.behaviour || 'healthy',
    estTokens, estSeconds, usedTokens:0, runSeconds:0, pctDone:0,
    lastProgressAt:0, createdAt:sim.t, enteredQueue:null, completedAt:null,
    skills: (tpl.skills||[]).slice(), steps: null, emitted:{}, log:[], subagents:[],
    interventions:[], _adjBias:0,
  };
}

// rates per behaviour: [progressMult, tokenMult]
function rates(t){
  const base = 1 / t.estSeconds;                 // pct per sim-sec for a healthy task
  const tokBase = t.estTokens / t.estSeconds;    // tokens per sim-sec
  let pm=1, km=1;
  if(t.behaviour==='slow'){ pm=0.5; km=1.25; }
  else if(t.behaviour==='hot'){ pm=0.42; km=1.5; }
  else if(t.behaviour==='stall'){ pm=(t.runSeconds<14?0.6:0.02); km=0.5; }
  pm *= (1 + t._adjBias);                         // operator estimate revision re-bases burn vs budget
  return { dp: base*pm, dt: tokBase*km };
}

// ----------------------------- temperature (D3) ------------------------
function temperature(t){
  const terminal = ['done','failed','cancelled'].includes(t.status);
  if(terminal) return { band:'neutral', over:0, timeR:0, tokR:0, stalled:false };
  const stalled = t.status==='running' && t.pctDone<0.999 && (sim.t - t.lastProgressAt) > CFG.stallSec;
  if(t.pctDone < CFG.warmupPct){
    return { band: stalled?'warm':'cool', over:0, timeR:0, tokR:0, stalled };
  }
  const expT = t.estTokens * t.pctDone, expS = t.estSeconds * t.pctDone;
  const tokR = t.usedTokens / Math.max(expT, t.estTokens*CFG.warmupPct);
  const timeR = t.runSeconds / Math.max(expS, t.estSeconds*CFG.warmupPct);
  const over = Math.max(tokR, timeR);
  let band = over<=CFG.warmBand ? 'cool' : over<=CFG.hotBand ? 'warm' : 'hot';
  if(stalled && band==='cool') band='warm';
  return { band, over, timeR, tokR, stalled };
}
const isAttention = t => { const x=temperature(t); return x.band==='hot' || x.stalled; };

// ----------------------------- simulation tick -------------------------
function tick(){
  if(paused) return;
  const dt = CFG.dtSim * speed;
  sim.t += dt;

  // promote backlog -> queued, queued -> running (respecting concurrency)
  for(const t of state.tasks){
    if(t.status==='backlog' && sim.t - t.createdAt > 4){ t.status='queued'; t.enteredQueue=sim.t; }
  }
  let running = state.tasks.filter(t=>t.status==='running').length;
  for(const t of state.tasks.filter(t=>t.status==='queued').sort((a,b)=>a.priority-b.priority||a.enteredQueue-b.enteredQueue)){
    if(running>=CFG.maxRunning) break;
    t.status='running'; t.lastProgressAt=sim.t; running++;
  }

  // advance running tasks
  for(const t of state.tasks){
    if(t.status!=='running') continue;
    if(!t.steps) t.steps = stepsFor(t);
    const r = rates(t);
    const prevPct = t.pctDone;
    t.pctDone = Math.min(1, t.pctDone + r.dp*dt);
    t.usedTokens += r.dt*dt;
    t.runSeconds += dt;
    if(t.pctDone - prevPct > 0.001) t.lastProgressAt = sim.t;
    emitSteps(t);
    if(t.pctDone>=1){
      // small chance an incident "fails" to show the failed style; most succeed
      const fail = (t.source==='monitoring' && t.behaviour==='hot' && (t.id.charCodeAt(1)%5===0));
      t.status = fail ? 'failed' : 'done';
      t.completedAt = sim.t; t.pctDone = 1;
      closeSubs(t, fail);
    }
  }

  // auto-ingest
  if(sim.t - sim.lastInject > CFG.injectEverySec){ sim.lastInject=sim.t; injectRandom(); }

  render();
  if(openId) renderDetail(byId(openId));
}

function emitSteps(t){
  for(const s of t.steps){
    if(t.pctDone>=s.at && !t.emitted[s.at]){
      t.emitted[s.at]=true;
      let node = t.subagents.find(n=>n.who===s.who && n.sub===!!s.sub);
      if(!node){ node={who:s.who, task:s.task, sub:!!s.sub, status:'run', lines:[]}; t.subagents.push(node); }
      node.task=s.task;
      node.lines.push({ t:fmtClock(t.runSeconds), text:s.text, kind:s.err?'err':s.warn?'warn':'' });
      // mark previous sub done
      t.subagents.forEach(n=>{ if(n!==node && n.status==='run' && n.sub) n.status='ok'; });
    }
  }
}
function closeSubs(t, fail){
  t.subagents.forEach(n=>{ if(n.status==='run') n.status = fail?'fail':'ok'; });
}

function injectRandom(){
  const tpl = TEMPLATES[(idSeq*7+sim.t|0) % TEMPLATES.length];
  state.tasks.push(makeTask(tpl,'backlog'));
}

// ----------------------------- rendering -------------------------------
function laneOf(t){ if(t.status==='backlog')return'backlog'; if(t.status==='queued')return'queued';
  if(t.status==='running'||t.status==='interrupted')return'running'; return'done'; }

function render(){
  const buckets={backlog:[],queued:[],running:[],done:[]};
  for(const t of state.tasks) buckets[laneOf(t)].push(t);
  for(const k in buckets){
    buckets[k].sort((a,b)=> a.priority-b.priority || temperature(b).over - temperature(a).over || a.createdAt-b.createdAt);
  }
  const seen=new Set();
  for(const k in buckets){
    const laneEl=lanes[k];
    buckets[k].forEach((t,idx)=>{
      seen.add(t.id);
      let el=cardEls.get(t.id);
      if(!el){ el=buildCard(t); cardEls.set(t.id,el); }
      // only touch the DOM when this card is NOT already at the right slot —
      // re-inserting a node restarts its CSS animation (that was the blink).
      if(laneEl.children[idx] !== el) laneEl.insertBefore(el, laneEl.children[idx] || null);
      updateCard(el,t);
    });
    $('#count-'+k).textContent=buckets[k].length;
  }
  for(const [id,el] of cardEls){ if(!seen.has(id)){ el.remove(); cardEls.delete(id); } }
  // stats
  $('#stat-running').textContent = state.tasks.filter(t=>t.status==='running').length;
  $('#stat-hot').textContent     = state.tasks.filter(t=>temperature(t).band==='hot').length;
  $('#stat-stalled').textContent = state.tasks.filter(t=>temperature(t).stalled).length;
  $('#stat-done').textContent    = state.tasks.filter(t=>t.status==='done').length;
}

function buildCard(t){
  const el=document.createElement('div');
  el.className='card'; el.dataset.id=t.id;
  el.addEventListener('click',()=>openDetail(t.id));
  return el;
}

function srcLabel(s){ return s==='monitoring'?'MONITOR':s.toUpperCase(); }

function updateCard(el,t){
  const tp=temperature(t);
  // classes (toggle only on change to preserve animations)
  setClass(el,'band-warm', tp.band==='warm');
  setClass(el,'band-hot', tp.band==='hot');
  setClass(el,'stalled', tp.stalled);
  setClass(el,'status-interrupted', t.status==='interrupted');
  setClass(el,'status-done', t.status==='done');
  setClass(el,'status-failed', t.status==='failed');
  setClass(el,'status-cancelled', t.status==='cancelled');
  setClass(el,'dim', attnOnly && !isAttention(t) && t.status==='running');
  // just-completed pulse
  if(t.completedAt!=null && !el._celebrated && t.status==='done'){ el._celebrated=true; el.classList.add('just-done'); setTimeout(()=>el.classList.remove('just-done'),900); }

  const heat = tp.band==='hot' ? `<span class="heat-chip hot">🔥 ${tp.over.toFixed(1)}×</span>`
            : tp.band==='warm' ? `<span class="heat-chip warm">${tp.over?tp.over.toFixed(1)+'×':'watch'}</span>` : '';
  const stall = tp.stalled ? `<span class="stall-chip">⏸ stalled</span>` : '';
  const statusTag = t.status==='done'?'✓ done':t.status==='failed'?'✗ failed':t.status==='cancelled'?'cancelled':t.status==='interrupted'?'⏸ interrupted':'';

  // skip the DOM write unless something visible actually changed
  const sig = [t.status,t.priority,tp.band,tp.stalled,Math.round(t.pctDone*100),Math.round(t.usedTokens),Math.round(t.runSeconds)].join('|');
  if(el._sig===sig) return;
  el._sig=sig;

  el.innerHTML = `
    <div class="card-top">
      <span class="src-badge ${t.source}">${srcLabel(t.source)}</span>
      <span class="prio p${t.priority}">P${t.priority}</span>
      ${t.originRef?`<span class="card-ref">${t.originRef}</span>`:`<span class="card-ref">${t.id}</span>`}
    </div>
    <div class="card-title">${t.title}${heat}${stall}</div>
    ${ laneOf(t)==='running' ? bars(t) : laneOf(t)==='done' ? `<div class="bar-row"><span class="bar-lbl" style="width:auto">${statusTag}</span><span class="bar-val" style="width:auto">${fmtTok(t.usedTokens)} · ${fmtClock(t.runSeconds)}</span></div>` : `<div class="bar-row"><span class="bar-lbl" style="width:auto">est</span><span class="bar-val" style="width:auto">${fmtTok(t.estTokens)} · ${fmtClock(t.estSeconds)}</span></div>` }
  `;
}

function bars(t){
  const tp=temperature(t);
  const pct=Math.round(t.pctDone*100);
  const tok=Math.min(180, t.usedTokens/t.estTokens*100);
  const tim=Math.min(180, t.runSeconds/t.estSeconds*100);
  return `<div class="bars">
    <div class="bar-row"><span class="bar-lbl">done</span><div class="bar prog"><i style="width:${pct}%"></i></div><span class="bar-val">${pct}%</span></div>
    <div class="bar-row"><span class="bar-lbl">tok</span><div class="bar tok ${tp.tokR>1.5?'over':''}"><i style="width:${Math.min(100,tok)}%"></i></div><span class="bar-val">${fmtTok(t.usedTokens)}/${fmtTok(t.estTokens)}</span></div>
    <div class="bar-row"><span class="bar-lbl">time</span><div class="bar time ${tp.timeR>1.5?'over':''}"><i style="width:${Math.min(100,tim)}%"></i></div><span class="bar-val">${fmtClock(t.runSeconds)}/${fmtClock(t.estSeconds)}</span></div>
  </div>`;
}

// ----------------------------- detail panel ----------------------------
function openDetail(id){ openId=id; $('#scrim').classList.add('show'); $('#detail').classList.add('open'); $('#detail').setAttribute('aria-hidden','false'); renderDetail(byId(id)); }
function closeDetail(){ openId=null; $('#scrim').classList.remove('show'); $('#detail').classList.remove('open'); $('#detail').setAttribute('aria-hidden','true'); }

function renderDetail(t){
  if(!t) return;
  const tp=temperature(t);
  const d=$('#detail');
  const running = t.status==='running', interrupted=t.status==='interrupted';
  const actions = running
    ? `<button class="btn" data-act="interrupt">⏸ Interrupt</button>`
    : interrupted
    ? `<button class="btn btn-primary" data-act="resume">▶ Resume</button><button class="btn" data-act="retry">↻ Retry</button><button class="btn" data-act="cancel">✕ Cancel</button>`
    : `<span class="empty">terminal — no actions</span>`;

  d.innerHTML = `
   <div class="d-head">
     <div class="d-top">
       <span class="src-badge ${t.source}">${srcLabel(t.source)}</span>
       <span class="prio p${t.priority}">P${t.priority}</span>
       <span class="card-ref" style="color:#7d8aa0">${t.originRef||t.id} · ${t.status}</span>
       <button class="d-close" id="d-close">×</button>
     </div>
     <div class="d-title">${t.title}</div>
     <div class="d-req">${t.requirement}</div>
   </div>
   <div class="d-body">

     <div class="d-section">
       <h3>Estimate vs actual</h3>
       <div class="metrics">
         <div class="metric"><div class="m-lbl">Progress</div><div class="m-val">${Math.round(t.pctDone*100)}%</div><div class="m-sub">profile · ${t.profile}</div></div>
         <div class="metric"><div class="m-lbl">Runtime</div><div class="m-val">${fmtClock(t.runSeconds)}</div><div class="m-sub">est ${fmtClock(t.estSeconds)}</div></div>
         <div class="metric"><div class="m-lbl">Tokens</div><div class="m-val">${fmtTok(t.usedTokens)}</div><div class="m-sub">est ${fmtTok(t.estTokens)}</div></div>
         <div class="metric"><div class="m-lbl">Source</div><div class="m-val" style="font-size:14px">${srcLabel(t.source)}</div><div class="m-sub">${t.originRef||'manual entry'}</div></div>
         <div class="metric full">
           <div class="m-lbl">Visual temperature</div>
           <div class="gauge ${tp.band}">
             <div class="gauge-num">${tp.band==='neutral'?'—':tp.over.toFixed(2)+'×'}</div>
             <div class="gauge-meta"><b style="text-transform:uppercase">${tp.band}</b>${tp.stalled?' · ⏸ stalled':''}<br>
               token burn ${tp.tokR?tp.tokR.toFixed(2)+'×':'—'} · time burn ${tp.timeR?tp.timeR.toFixed(2)+'×':'—'}<br>
               <span style="color:#5d6878">overBurn = max(used/(est·%done), runtime/(est·%done))</span></div>
           </div>
         </div>
       </div>
     </div>

     <div class="d-section">
       <h3>Agent &amp; sub-agent activity</h3>
       <div class="tree">${renderTree(t)}</div>
     </div>

     <div class="d-section">
       <h3>SKILL files in play</h3>
       <div class="skill-list" id="skill-list">
         ${t.skills.map(s=>`<span class="skill-chip" data-skill="${s}">${s}</span>`).join('')}
       </div>
       <div class="skill-reader" id="skill-reader"></div>
     </div>

     <div class="d-section">
       <h3>Operator intervention</h3>
       <div class="actions">${actions}</div>
       <div class="adjust">
         <label>Priority</label>
         <div class="seg" id="seg-prio">
           ${[1,2,3].map(p=>`<button data-prio="${p}" class="${t.priority===p?'on':''}">P${p}</button>`).join('')}
         </div><span></span>
         <label>Est. tokens</label>
         <div class="stepper"><button data-est="tok" data-d="-1">−</button><span class="v">${fmtTok(t.estTokens)}</span><button data-est="tok" data-d="1">＋</button></div><span></span>
         <label>Est. time</label>
         <div class="stepper"><button data-est="sec" data-d="-1">−</button><span class="v">${fmtClock(t.estSeconds)}</span><button data-est="sec" data-d="1">＋</button></div><span></span>
       </div>
       <div class="intlog">${ t.interventions.length? t.interventions.map(i=>`<div>${i}</div>`).join('') : '<span class="empty">no interventions yet</span>'}</div>
     </div>

   </div>`;

  // wire detail events
  $('#d-close').onclick=closeDetail;
  d.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>intervene(t,b.dataset.act));
  d.querySelectorAll('#seg-prio [data-prio]').forEach(b=>b.onclick=()=>{ t.priority=+b.dataset.prio; logInt(t,`priority → P${t.priority}`); render(); renderDetail(t); });
  d.querySelectorAll('[data-est]').forEach(b=>b.onclick=()=>adjustEst(t,b.dataset.est,+b.dataset.d));
  d.querySelectorAll('.skill-chip').forEach(c=>c.onclick=()=>{
    const r=$('#skill-reader'); const name=c.dataset.skill;
    d.querySelectorAll('.skill-chip').forEach(x=>x.classList.remove('active')); c.classList.add('active');
    r.innerHTML=`<span class="sk-name">${name}</span>${(SKILLS[name]||'(skill text not cached)')}`; r.classList.add('show');
  });
}

function renderTree(t){
  const main=t.subagents.filter(n=>!n.sub), subs=t.subagents.filter(n=>n.sub);
  const orch=t.subagents.find(n=>n.who==='orchestrator');
  const node=(n)=>`
    <div class="agent-node">
      <div class="agent-head">
        ${n.status==='run'?'<span class="spinner"></span>':''}
        <span class="who">${n.who}</span><span class="task">— ${n.task}</span>
        <span class="st ${n.status}">${n.status==='run'?'running':n.status==='ok'?'done':'failed'}</span>
      </div>
      <div class="loglines">${n.lines.map(l=>`<div class="logline ${l.kind?l.kind+'l':''}"><span class="t">${l.t}</span>${l.text}</div>`).join('')}</div>
    </div>`;
  let html='';
  if(orch) html+=node(orch);
  if(subs.length) html+=`<div class="sub">${subs.map(node).join('')}</div>`;
  if(!t.subagents.length) html=`<span class="empty">agent has not started emitting yet…</span>`;
  return html;
}

// ----------------------------- interventions ---------------------------
function logInt(t,msg){ t.interventions.unshift(`${fmtClock(sim.t)} · ${msg}`); }
function intervene(t,act){
  if(act==='interrupt' && t.status==='running'){ t.status='interrupted'; logInt(t,'interrupted at safe point'); t.subagents.forEach(n=>{if(n.status==='run')n.status='ok';}); }
  else if(act==='resume' && t.status==='interrupted'){ t.status='running'; t.lastProgressAt=sim.t; logInt(t,'resumed with adjustments'); }
  else if(act==='retry'){ t.usedTokens=0; t.runSeconds=0; t.pctDone=0; t.emitted={}; t.subagents=[]; t.steps=null; t.completedAt=null; t._celebrated=false; t.status='running'; t.lastProgressAt=sim.t; logInt(t,'retried from start'); }
  else if(act==='cancel'){ t.status='cancelled'; t.completedAt=sim.t; logInt(t,'cancelled by operator'); t.subagents.forEach(n=>{if(n.status==='run')n.status='ok';}); }
  render(); renderDetail(t);
}
function adjustEst(t,kind,dir){
  if(kind==='tok'){ t.estTokens=Math.max(20000, t.estTokens + dir*50000); }
  else { t.estSeconds=Math.max(20, t.estSeconds + dir*20); }
  // revising the estimate re-bases temperature AND the burn-rate-vs-budget (D3/D4)
  t._adjBias = dir>0 ? Math.min(0.6, t._adjBias+0.12) : Math.max(-0.4, t._adjBias-0.12);
  logInt(t,`estimate ${kind==='tok'?'tokens':'time'} ${dir>0?'＋':'−'} → ${kind==='tok'?fmtTok(t.estTokens):fmtClock(t.estSeconds)}`);
  render(); renderDetail(t);
}

// ----------------------------- helpers ---------------------------------
function byId(id){ return state.tasks.find(t=>t.id===id); }
function setClass(el,c,on){ if(on!==el.classList.contains(c)) el.classList.toggle(c,on); }
function fmtTok(n){ return n>=1000? (n/1000).toFixed(n>=100000?0:1)+'k' : Math.round(n)+''; }
function fmtClock(s){ s=Math.round(s); const m=Math.floor(s/60), ss=s%60; return m? `${m}m${ss.toString().padStart(2,'0')}s` : `${ss}s`; }

// ----------------------------- seed + boot -----------------------------
function seed(){
  fresh();
  // a couple already-finished
  const done=makeTask(TEMPLATES[3],'done'); done.pctDone=1; done.usedTokens=done.estTokens*0.96; done.runSeconds=done.estSeconds*0.98; done.completedAt=0; done.subagents=[{who:'orchestrator',task:'route',sub:false,status:'ok',lines:[{t:'0s',text:'routed → product-developer'}]}]; state.tasks.push(done);
  // running mix: healthy, hot, slow, stall
  ['healthy','hot','slow','stall'].forEach((b,i)=>{
    const tpl = TEMPLATES.find(x=>x.behaviour===b) || TEMPLATES[i];
    const t=makeTask(tpl,'running'); t.pctDone=0.18+i*0.08; t.runSeconds=t.estSeconds*t.pctDone*(b==='hot'?2.0:b==='slow'?1.6:1.0);
    t.usedTokens=t.estTokens*t.pctDone*(b==='hot'?2.1:b==='slow'?1.5:1.0); t.lastProgressAt=(b==='stall')?-20:0; t.steps=stepsFor(t); emitSteps(t); state.tasks.push(t);
  });
  // queued + backlog
  state.tasks.push(makeTask(TEMPLATES[6],'queued'), makeTask(TEMPLATES[8],'queued'));
  state.tasks.push(makeTask(TEMPLATES[10],'backlog'), makeTask(TEMPLATES[0],'backlog'), makeTask(TEMPLATES[2],'backlog'));
  state.tasks.forEach(t=>{ if(t.status==='queued')t.enteredQueue=sim.t; });
  render();
}

// controls
$('#btn-pause').onclick=e=>{ paused=!paused; e.target.textContent=paused?'▶ Resume':'⏸ Pause'; };
$('#btn-inject').onclick=()=>{ injectRandom(); render(); };
$('#btn-reset').onclick=()=>{ closeDetail(); seed(); };
$('#attn-only').onchange=e=>{ attnOnly=e.target.checked; render(); };
$('#speed').oninput=e=>{ speed=+e.target.value; $('#speed-val').textContent=speed+'×'; };
$('#scrim').onclick=closeDetail;
document.addEventListener('keydown',e=>{ if(e.key==='Escape')closeDetail(); });

seed();
setInterval(tick, CFG.tickMs);
