if(document.querySelector('meta[name="india-job-finder"]')){
  const emit=msg=>window.postMessage({from:'india-job-connector',...msg},location.origin);
  if(!globalThis.batchFinderConnected){
    globalThis.batchFinderConnected=true;
    const pending=new Map();
    window.addEventListener('message',async event=>{
      const msg=event.data;
      if(event.source!==window || event.origin!==location.origin || msg?.from!=='india-job-page')return;
      if(msg.type==='receipt'){pending.get(msg.token)?.(msg);return;}
      if(msg.type!=='startBatch')return;
      try{
        const reply=await chrome.runtime.sendMessage({type:'start',start:msg.start});
        if(reply?.error)throw Error(reply.error);
      }catch(error){emit({type:'error',message:error.message});}
    });
    chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
      if(msg.channel!=='finder')return;
      if(msg.type!=='page'){emit(msg);reply({});return;}
      const token=crypto.randomUUID();
      const timer=setTimeout(()=>{pending.delete(token);reply({saved:false});},30000);
      pending.set(token,result=>{clearTimeout(timer);pending.delete(token);reply(result);});
      emit({...msg,token});return true;
    });
  }
  emit({type:'connected',version:2});
}
