(function(){
 const S='uj_scit_podjetja_podatki_v1', A='uj_svetovalec_podjetja_podatki_v1', ACTIVE='uj_svetovalec_izbrano_podjetje_v1';
 const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))||f;}catch{return f;}};
 const norm=s=>String(s||'').trim().toLocaleLowerCase('sl');
 function full(c){const all=read(S,{});const pair=Object.entries(all).find(([k,x])=>c?.id&&(k===c.id||x.id===c.id))||Object.entries(all).find(([k,x])=>norm(x.name)===norm(c?.name));return pair?{...pair[1],id:pair[1].id||pair[0]}:c||{};}
 function save(c,select=true){
 if(!c?.name?.trim())return c;
 const all=read(S,{});const key=Object.keys(all).find(k=>c.id&&(k===c.id||all[k].id===c.id))||Object.keys(all).find(k=>norm(all[k].name)===norm(c.name))||c.id||'scit-'+crypto.randomUUID();
 const merged={...all[key],...c,id:c.id||all[key]?.id||key};
 if(c.details){merged.dejavnosti=c.details.activity?[c.details.activity]:[];merged.glavnaDejavnost=c.details.activity;for(const k of ['vloga','odnos','sodelovanje','stik']){const v=c.details.answers?.[k];merged[k]=v?[...(v.selected||[]),v.custom||''].filter(Boolean).join(' · '):'';}}
 else {merged.details={activity:merged.glavnaDejavnost||merged.dejavnosti?.[0]||'',answers:{}};for(const k of ['vloga','odnos','sodelovanje','stik'])merged.details.answers[k]={selected:(merged[k]||'').split(' · ').filter(Boolean),custom:''};}
 all[key]=merged;localStorage.setItem(S,JSON.stringify(all));
 const rows=read(A,[]).filter(x=>x.id!==merged.id&&norm(x.name)!==norm(merged.name));rows.unshift(merged);localStorage.setItem(A,JSON.stringify(rows));
 if(select)localStorage.setItem(ACTIVE,JSON.stringify(merged));return merged;
 }
 window.UJCompanyContact={save,full,active:()=>full(read(ACTIVE,null))};
 // Import existing advisor contacts without changing the user's active selection.
 for(const c of read(A,[])){if(!Object.values(read(S,{})).some(x=>norm(x.name)===norm(c.name)))save(c,false);}
for(const [id,c] of Object.entries(read(S,{})))save({...c,id:c.id||id},false);
})();
