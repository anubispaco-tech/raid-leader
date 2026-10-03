const G=require('../src/core.js');
function party(classes, lv, ilvl){ const items={}; return {heroes:classes.map(c=>{const h=G.makeHero(c,lv); for(const sl of ['weapon','armor','trinket']){const it=G.makeItem(sl,ilvl,1); items[it.id]=it; h.gear[sl]=it.id;} return h;}), items}; }
const comps={'標準':['guardian','cleric','rogue','mage','mage'],'無坦':['cleric','rogue','rogue','mage','mage'],'無補':['guardian','rogue','rogue','mage','mage'],'3盜':['guardian','cleric','rogue','rogue','rogue'],'3法':['guardian','cleric','mage','mage','mage'],'雙補':['guardian','cleric','cleric','rogue','mage'],'雙坦':['guardian','guardian','cleric','rogue','mage']};
const wr=(c,d,lv,il,n=150)=>{let w=0;for(let i=0;i<n;i++){const p=party(c,lv,il); if(new G.Battle(p.heroes,p.items,d).runToEnd().win) w++;} return Math.round(100*w/n);};
for(let d=0;d<7;d++){ const il=d?G.dungeonInfo(d-1).dropIlvl:0; let lv=1; while(lv<40 && wr(comps['標準'],d,lv,il,60)<70) lv++;
  let line=`D${d+1} ${G.DUNGEONS[d].tip.split('→')[1]} (Lv${lv},裝${il}): `; for(const [n,c] of Object.entries(comps)) line+=`${n} ${wr(c,d,lv,il)}% `; console.log(line);}
