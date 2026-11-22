(()=>{
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const visible=el=>el.getClientRects().length>0;
  const label=el=>(el.getAttribute('aria-label')||el.textContent).trim();
  const send=async message=>{
    const reply=await chrome.runtime.sendMessage(message);
    if(!reply || reply.error)throw Error(reply?.error||'Finder connection lost.');
    return reply;
  };
  function current(){
    const url=new URL(location.href);
    if(url.pathname!=='/jobs'||url.searchParams.get('r')!=='IN'||url.searchParams.get('roles')!=='tech'||
       [...url.searchParams.keys()].some(k=>!['r','roles','p','page'].includes(k)))throw Error('Restore the original India tech filter.');
    const main=document.querySelector('main');
    if(!main)return;
    const text=main.innerText;
    if(/going fast|too many requests|try again in a few minutes/i.test(text))throw Error('The portal asked to pause. Try the remaining pages later.');
    const account=[...document.querySelectorAll('button')].some(b=>visible(b)&&/^account\b/i.test(label(b)));
    if(!account || !/jobs in india/i.test(text) || main.querySelector('[aria-busy="true"]'))return;
    if(/unlock (all|more) (jobs|results)|sign in free to see every job/i.test(text))throw Error('The portal requires additional access.');
    const nav=main.querySelector('nav[aria-label="Pagination"]');
    const number=Number(nav?.querySelector('[aria-current="page"]')?.textContent);
    const cards=[...main.querySelectorAll('li.job')].filter(visible);
    if(!cards.length && /no (matching )?jobs (found|match)/i.test(text))return {number:1,cards:[],final:true};
    if(!number||!cards.length)return;
    const next=[...nav.querySelectorAll('button')].find(b=>/^next(?: page)?[\s›»→]*$/i.test(label(b)));
    if(!next)return;
    return {number,cards,next,final:next.disabled||next.getAttribute('aria-disabled')==='true'};
  }
  function listing(el){
    const title=el.querySelector('.job-title')?.textContent.trim();
    const company=el.querySelector('.job-co')?.textContent.trim();
    const a=el.querySelector('a.job-apply[href],a[aria-label^="Apply:"][href]');
    if(!title||!company||!a||!/^https?:$/.test(a.protocol))throw Error('A portal listing could not be read.');
    return {title,company,url:a.href,location:el.querySelector('[data-country]')?.textContent.trim()||'India',cardText:el.innerText};
  }
  let busy=false;
  async function scan(start){
    if(!start||busy)return;
    busy=true;
    try{
      for(let expected=start;expected<start+10;expected++){
        let advanced=false,page;
        const deadline=Date.now()+65000;
        while(Date.now()<deadline){
          page=current();
          if(page?.number===expected)break;
          if(page && page.number===expected-1 && !advanced && !page.final){
            await pause(8000);page.next.click();advanced=true;
          }else if(page && page.number!==expected-1){
            throw Error('The portal tab moved. Return it to page '+expected+' or start a fresh search.');
          }
          page=null;await pause(350);
        }
        if(!page)throw Error('Could not load page '+expected+'. Your saved pages are available.');
        const receipt=await send({type:'page',number:expected,jobs:page.cards.map(listing),final:page.final});
        if(receipt.stop)return;
      }
    }catch(error){await send({type:'error',message:error.message});}
    finally{busy=false;}
  }
  chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
    if(msg.channel==='collector' && msg.type==='resume'){reply({});void scan(msg.start);}
  });
  send({type:'ready'}).then(reply=>scan(reply.start)).catch(console.error);
})();
