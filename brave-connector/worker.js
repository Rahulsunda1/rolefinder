const source = 'https://layoffsandhires.com/jobs?r=IN&roles=tech';
const db = chrome.storage.session;

chrome.action.onClicked.addListener(async tab => {
  const url = new URL(tab.url);
  if (url.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(url.hostname)) return;
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['bridge.js']});
});
async function finish(run, type, message) {
  await db.remove('run');
  await chrome.alarms.clear('watchdog');
  await chrome.tabs.sendMessage(run.owner,{channel:'finder',type,message}).catch(()=>{});
  if(type==='done') await chrome.tabs.remove(run.portal).catch(()=>{});
}
async function handle(msg,sender) {
  const id=sender.tab?.id;
  if(!id || sender.frameId!==0) return;
  const {run, bookmark}=await db.get(['run','bookmark']);
  if(msg.type==='start'){
    if(run) throw Error('Another batch is running.');
    const start=msg.start;
    if(!Number.isSafeInteger(start)||start<1) throw Error('Invalid starting page.');
    const origin=new URL(sender.url).origin;
    let portal;
    const openAtFirst=start===1 || (start===2 && (!bookmark || bookmark.origin!==origin || !await chrome.tabs.get(bookmark.portal).catch(()=>null)));
    if(openAtFirst) {
      portal=(await chrome.tabs.create({url:'about:blank',active:false})).id;
    } else {
      if(bookmark?.origin!==origin || !await chrome.tabs.get(bookmark.portal).catch(()=>null))
        throw Error('The continuation tab is closed. Your matches are saved. Use Start from page 1 for a fresh search.');
      portal=bookmark.portal;
    }
    const state={portal,owner:id,start,next:start,end:Math.ceil(start/10)*10,last:Date.now()};
    await db.set({run:state,bookmark:{portal,origin}});
    try {
      await chrome.alarms.create('watchdog',{periodInMinutes:1});
      if(openAtFirst) await chrome.tabs.update(portal,{url:source});
      else await chrome.tabs.sendMessage(portal,{channel:'collector',type:'resume',start});
    } catch(error){await finish(state,'error',error.message);}
    return;
  }
  if(!run || id!==run.portal || new URL(sender.url).origin!==new URL(source).origin) return;
  if(msg.type==='ready') return {start:run.next};
  if(msg.type==='page'){
    if(msg.number!==run.next || msg.number>run.end) throw Error('Page order changed. Your earlier matches are saved.');
    const receipt=await chrome.tabs.sendMessage(run.owner,{channel:'finder',type:'page',number:msg.number,jobs:msg.jobs,final:msg.final});
    if(!receipt?.saved) throw Error(receipt?.message || 'The finder could not save this page.');
    run.next++;run.last=Date.now();await db.set({run});
    if(msg.final || msg.number===run.end){
      await finish(run,msg.final?'done':'batch','');
      return {stop:true};
    }
    return {stop:false};
  }
  if(msg.type==='error') await finish(run,'error',msg.message);
}
let queue=Promise.resolve();
function serial(fn){const pending=queue.then(fn);queue=pending.catch(()=>{});return pending;}
chrome.runtime.onMessage.addListener((m,s,reply)=>{
  serial(()=>handle(m,s)).then(v=>reply(v??{}),e=>reply({error:e.message}));return true;
});
chrome.alarms.onAlarm.addListener(()=>serial(async()=>{
  const {run}=await db.get('run');
  if(run && Date.now()-run.last>150000) await finish(run,'error','The portal stopped responding. Saved pages are available.');
}));
chrome.tabs.onRemoved.addListener(id=>serial(async()=>{
  const {run}=await db.get('run');
  if(run && (id===run.owner || id===run.portal)) await finish(run,'error','A search tab closed.');
}));


