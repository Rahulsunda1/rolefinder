// A full India scan can exceed localStorage's per-origin limit.
// Commit each completed report in one transaction so a failed save preserves its predecessor.
function openReports() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rolefinder', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('reports');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
async function latestReport(slot) {
  const db = await openReports();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('reports').objectStore('reports').get(slot);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
async function saveReport(report,slot='batches-v2') {
  const db = await openReports();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('reports', 'readwrite');
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
      transaction.objectStore('reports').put(report, slot);
    });
  } finally { db.close(); }
}


import {personalize,selectMatches,validProfile} from './ranking.mjs';
const $=id=>document.getElementById(id);
let report,rows=[],shown=0,active=false,connected=false,fresh=false,batchStart=1;
const valid=job=>job && typeof job.title==='string' && typeof job.company==='string' && /^https?:\/\//i.test(job.url);
function nextPage(){return fresh||report?.ended?1:(report?.cursor||0)+1;}
function controls(){
  const start=active?batchStart:nextPage();
  $('run').textContent='Search pages '+start+'–'+(Math.ceil(start/10)*10);
  $('run').disabled=active||!connected;
  $('reset').hidden=active||start===1;
}
const descriptions=new Map();
let profile=null;
try{
  const saved=JSON.parse(localStorage.getItem('rolefinder.profile'));
  if(validProfile(saved))profile=saved;
}catch{}
import {readResume,extractProfile} from './resume.mjs';
function showProfile(){
  if(!profile)return;
  $('profile-name').textContent=profile.name;
  $('resume-review').hidden=false;
  $('resume-skills').textContent='Skills · '+(profile.skills.join(', ')||'None recognized');
  $('resume-tracks').textContent=Object.values(profile.evidence).join(' ');
  $('experience-start').value=profile.startMonth;
}
showProfile();
let uploadSequence=0;
$('resume-file').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  const seq=++uploadSequence;
  $('parse-status').textContent='Reading your resume…';
  try{
    const text=await readResume(file);
    const parsed=extractProfile(text,file.name);
    if(seq!==uploadSequence)return;
    localStorage.setItem('rolefinder.profile',JSON.stringify(parsed));
    profile=parsed;showProfile();render();
    $('parse-status').textContent='Resume ready. Saved jobs have been re-ranked.';
    $('resume-review').open=true;
  }catch(error){
    if(seq===uploadSequence)$('parse-status').textContent='Could not parse this resume. '+error.message;
  }finally{if(seq===uploadSequence)event.target.value='';}
};
$('experience-start').onchange=()=>{
  if(!profile)return;
  const updated={...profile,startMonth:$('experience-start').value};
  if(!validProfile(updated))return;
  localStorage.setItem('rolefinder.profile',JSON.stringify(updated));profile=updated;render();
};
const filterIds=['fit','track','query'];
function filterValues(){return Object.fromEntries(filterIds.map(id=>[id,$(id).value]));}
for(const id of filterIds){
  $(id).addEventListener(id==='query'?'input':'change',()=>{
    try{localStorage.setItem('rolefinder.filters',JSON.stringify(filterValues()));}catch{}
    render();
  });
}
try{
  const saved=JSON.parse(localStorage.getItem('rolefinder.filters')||'{}');
  for(const id of filterIds){
    const field=$(id);
    if(typeof saved[id]==='string' && (id==='query'||[...field.options].some(o=>o.value===saved[id])))field.value=saved[id];
  }
}catch{}
const fitLabels={strong:'Strong match',possible:'Possible match',stretch:'Experience stretch',other:'Outside target roles'};
function descriptionEditor(job){
  const detail=document.createElement('details'),summary=document.createElement('summary');
  summary.textContent='Compare employer description';
  const input=document.createElement('textarea');
  input.setAttribute('aria-label','Employer description for '+job.title);
  input.placeholder='Paste the responsibilities and experience requirements';
  input.value=descriptions.get(job.url)||job.description||'';
  const button=document.createElement('button');button.type='button';button.textContent='Update match';
  button.onclick=async()=>{
    button.disabled=true;
    const value=input.value.trim();
    try{
      await saveReport(value,'description:'+job.url);
      descriptions.set(job.url,value);
      render();
      $('status').textContent='Updated the match for '+job.title+'.';
    }catch{$('status').textContent='Could not save the description. Please retry.';button.disabled=false;}
  };
  detail.append(summary,input,button);return detail;
}
function render(reset=true){
  if(reset){
    const all=report?.rows||[];
    rows=selectMatches(all.map(job=>personalize({...job,description:descriptions.get(job.url)??job.description},new Date(),profile)),filterValues());
    shown=0;$('list').replaceChildren();
    $('stamp').textContent=report?(report.cursor?'Pages 1–'+report.cursor+' saved':'Previous search')+' · '+all.length+' unique listings · '+rows.length+' matching filters'+(report.ended?' · End of filter reached':''):'';
  }
  for(const job of rows.slice(shown,shown+20)){
    const card=document.createElement('article'),title=document.createElement('h3'),link=document.createElement('a');
    link.textContent=job.title;link.href=job.url;link.rel='noreferrer';link.target='_blank';title.append(link);card.append(title);
    const grade=document.createElement('small');grade.textContent=fitLabels[job.fit];card.append(grade);
    for(const line of [job.company+' · '+job.location,...job.reasons,...job.checks]){
      const p=document.createElement('p');p.textContent=line;card.append(p);
    }
    card.append(descriptionEditor(job));
    $('list').append(card);
  }
  if(reset && report && !rows.length){$('list').textContent='No saved listings match these filters. Broaden the filters or scan the next batch.';}
  shown+=20;$('more').hidden=shown>=rows.length;controls();
}
const restore=(async()=>{
  let data=await latestReport('batches-v2');
  if(!data){
    const old=(await Promise.all(['partial','complete'].map(latestReport))).filter(Boolean).sort((a,b)=>b.time.localeCompare(a.time));
    data=old[0]||JSON.parse(localStorage.getItem('rolefinder.complete.v1')||'null');
  }
  if(data?.rows?.every(valid)){
    const db=await openReports();
    try{
      await new Promise((resolve,reject)=>{
        const cursor=db.transaction('reports').objectStore('reports').openCursor(IDBKeyRange.bound('description:','description:\uffff'));
        cursor.onerror=()=>reject(cursor.error);
        cursor.onsuccess=()=>{const entry=cursor.result;if(!entry){resolve();return;}descriptions.set(entry.key.slice(12),entry.value);entry.continue();};
      });
    }finally{db.close();}
    report=data;render();
  }
})().catch(()=>{});
$('more').onclick=()=>render(false);
$('reset').onclick=()=>{fresh=true;controls();$('status').textContent='Ready for a fresh search. Prior results stay visible until page 1 is saved.';};
$('run').onclick=async()=>{
  await restore;
  if(active||!connected)return;
  const start=active?batchStart:nextPage();
  batchStart=start;fresh=start===1;active=true;controls();
  $('status').textContent='Reading pages '+start+'–'+(Math.ceil(start/10)*10)+'…';
  window.postMessage({from:'india-job-page',type:'startBatch',start},location.origin);
};
window.addEventListener('message',async e=>{
  const m=e.data;if(e.source!==window||e.origin!==location.origin||m?.from!=='india-job-connector')return;
  if(m.type==='connected'){
    connected=m.version===2;controls();
    $('setup').open=!connected;
    $('setup').querySelector('summary').textContent=connected?'Brave connected':'Update Brave connector';
    $('status').textContent=connected?'Ready to search ten pages.':'Load the updated connector and reconnect this tab.';
    return;
  }
  if(!active)return;
  if(m.type==='page'){
    try{
      const expected=fresh?1:(report?.cursor||0)+1;
      if(m.number!==expected||!Array.isArray(m.jobs)||!m.jobs.every(valid))throw Error('Unexpected page or unreadable listing.');
      const jobs=new Map((fresh?[]:report?.rows||[]).map(j=>[j.url,j]));
      for(const job of m.jobs)jobs.set(job.url,job);
      const next={time:new Date().toISOString(),cursor:m.number,rows:[...jobs.values()],ended:!!m.final};
      await saveReport(next);report=next;fresh=false;render();
      $('status').textContent='Saved page '+m.number+' · '+jobs.size+' unique listings';
      window.postMessage({from:'india-job-page',type:'receipt',token:m.token,saved:true},location.origin);
    }catch(error){
      window.postMessage({from:'india-job-page',type:'receipt',token:m.token,saved:false,message:error.message},location.origin);
    }
    return;
  }
  if(!['error','batch','done'].includes(m.type))return;
  active=false;controls();
  $('status').textContent=m.type==='error'?m.message:m.type==='done'?'Reached the end of the filter.':'Batch saved. Keep the portal tab open to continue from page '+nextPage()+'.';
});
controls();






