import * as G from '../src/core/index.js';
function playthrough(maxRuns=1500){
  const s = G.newGame(); let log=[]; let firstClearRun={};
  for(let run=0; run<maxRuns; run++){
    const want = s.party.length<5 ? (s.heroes.some(h=>h.cls==='mage')?'rogue':'mage') : null;
    if(want){ const t=s.tavern.find(h=>h.cls===want)||null;
      if(t && s.gold>=G.hireCost(t)){ s.gold-=G.hireCost(t); s.heroes.push(t); s.party.push(t.id); s.tavern=s.tavern.filter(x=>x!==t); G.rollTavern(s);}
      else if(!t && s.gold>=G.ECONOMY.refreshCost+80){ s.gold-=G.ECONOMY.refreshCost; G.rollTavern(s);} }
    for(const h of G.partyHeroes(s)) for(const sl of ['weapon','armor','trinket']){ const id=h.gear[sl]; if(id && s.gold>300) G.upgrade(s,id); }
    G.autoEquip(s);
    for(const id of [...s.bag]) if(s.bag.length>20) G.salvage(s,id);
    const top = s.unlocked-1;
    let d = top;
    if(s._fs>=1 && top>0 && run%2===0) d = top-1;
    const b = new G.Battle(G.partyHeroes(s), s.items, d).runToEnd();
    G.applyResult(s,d,b);
    if(d===top) s._fs = b.win?0:(s._fs||0)+1;
    if(b.win && firstClearRun[d]===undefined){ firstClearRun[d]=run;
      const p=G.partyHeroes(s); log.push(`D${d+1} 首通 @run ${run} lv=${p.map(h=>h.level).join('/')} ilvl=${p.map(h=>G.heroIlvl(h,s.items)).join('/')} ticks=${b.tick} gold=${s.gold}`);}
    if(firstClearRun[G.DUNGEONS.length-1]!==undefined) break;
  }
  return {log, firstClearRun, s};
}
const N=+process.argv[2]||5; const agg={};
for(let i=0;i<N;i++){ const r=playthrough(); if(i===0) console.log(r.log.join('\n')); for(const k in r.firstClearRun){(agg[k]=agg[k]||[]).push(r.firstClearRun[k]);} }
console.log('平均首通場次:', Object.entries(agg).map(([k,v])=>`D${+k+1}:${Math.round(v.reduce((a,b)=>a+b)/v.length)}(${v.length}/${N})`).join(' '));
