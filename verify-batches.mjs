import {chromium} from 'playwright-core';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const finder=await browser.newPage(),portal=await browser.newPage();
 const store={};let listener;
 const source='https://layoffsandhires.com/jobs?r=IN&roles=tech';
 const event={addListener(){}};
 const chromeMock={action:{onClicked:event},storage:{session:{get:async()=>structuredClone(store),set:async v=>Object.assign(store,v),remove:async k=>delete store[k]}},alarms:{create(){},clear(){},onAlarm:event},runtime:{onMessage:{addListener:f=>listener=f}},tabs:{onRemoved:event,create:async()=>({id:2}),get:async()=>({id:2}),async update(){},async remove(){},sendMessage:async(id,msg)=>(id===1?finder:portal).evaluate(m=>new Promise(resolve=>window.listener(m,{},resolve)),msg)}};
 vm.runInNewContext(await readFile('brave-connector/worker.js','utf8'),{chrome:chromeMock,URL,Date});
 for(const [page,id] of [[finder,1],[portal,2]]){
   page.on('pageerror',console.error);
   await page.exposeFunction('sendToWorker',m=>new Promise(resolve=>listener(m,{tab:{id},frameId:0,url:page.url()},v=>{if(m.type==='error'||v.error)console.log(m,v);resolve(v)})));
   await page.addInitScript(()=>{window.chrome.runtime={sendMessage:window.sendToWorker,onMessage:{addListener:f=>window.listener=f}}});
 }
 await finder.goto(process.env.FINDER_TEST_URL || 'http://127.0.0.1:4173');
 const connect=async()=>{await finder.addScriptTag({content:await readFile('brave-connector/bridge.js','utf8')});await finder.waitForFunction(()=>!document.querySelector('#run').disabled)};
 const year=new Date().getFullYear();
 await finder.locator('#resume-file').setInputFiles({name:'fixture.txt',mimeType:'text/plain',buffer:Buffer.from('Experience\nBackend Developer January '+year+' – Present\nBuilt Node.js backend APIs for financial services and maintained production systems.')});
 await finder.waitForFunction(()=>document.querySelector('#profile-name').textContent==='fixture.txt');
 await connect();await finder.locator('#run').click();
 for(let i=0;i<100&&!store.run;i++) await new Promise(r=>setTimeout(r,20));
 await portal.route(source,r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<button aria-label="Account: Test">Account</button><main><h1>Jobs in India</h1><ul></ul><nav aria-label="Pagination"><button aria-current="page">1</button><button id="next">Next<span aria-hidden="true">›</span></button></nav></main>'}));
 await portal.goto(source);
 await portal.evaluate(()=>{
   let n=1;
   const timeout=window.setTimeout;window.setTimeout=(f,t,...args)=>timeout(f,Math.min(t,15),...args);
   function render(){document.querySelector('ul').innerHTML='<li class="job"><h3 class="job-title">Backend Engineer</h3><b class="job-co">Bank</b><a class="job-apply" href="https://example.com/job/'+n+'">Apply</a></li>';document.querySelector('[aria-current]').textContent=n;next.disabled=n===23;}
   next.onclick=()=>{n++;render()};render();
 });
 await portal.addScriptTag({content:await readFile('brave-connector/portal.js','utf8')});
 for(const end of [10,20,23]){
   try{await finder.waitForFunction(n=>document.querySelector('#stamp').textContent.includes('Pages 1–'+n+' saved')&&!document.querySelector('#run').disabled,end,{timeout:18000})}catch(error){
     console.log('failure state',await finder.locator('#status').textContent(),await finder.locator('#stamp').textContent(),await portal.locator('[aria-current]').textContent(),store);throw error;
   }
   assert.equal(await portal.locator('[aria-current]').textContent(),String(end));console.log('Verified stop at',end);
   if(end===10){await finder.reload();await connect();}
   if(end<23)await finder.locator('#run').click();
 }
 assert.match(await finder.locator('#stamp').textContent(),/23 unique listings.*End of filter/);
 await finder.locator('#query').fill('unmatched employer');
 assert.equal(await finder.locator('article').count(),0);
 await finder.locator('#query').fill('');
 await finder.locator('article details summary').first().click();
 await finder.locator('article textarea').first().fill('Requires 5 years of professional experience.');
 await finder.getByRole('button',{name:'Update match'}).first().click();
 await finder.waitForFunction(()=>document.querySelector('#stamp').textContent.includes('22 matching filters'));
 await finder.locator('#fit').selectOption('stretch');
 assert.equal(await finder.locator('article').count(),1);
 await finder.reload();
 await finder.waitForFunction(()=>document.querySelectorAll('article').length===1);
 assert.match(await finder.locator('article').innerText(),/5 or more years/);
 console.log('Verified search, experience filtering, description re-ranking and persistence.');
}finally{await browser.close();}





