import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.mjs':'app.mjs','/ranking.mjs':'ranking.mjs','/brave-connector.zip':'brave-connector.zip'};
const types={html:'text/html',css:'text/css',mjs:'text/javascript',zip:'application/zip'};
const port=Number(process.env.PORT || 4173);
http.createServer(async(req,res)=>{
  const file=files[new URL(req.url,'http://localhost').pathname];
  if(typeof file!=='string'){res.writeHead(404).end();return;}
  try{const body=await readFile(new URL('./web/'+file,import.meta.url));res.writeHead(200,{'content-type':types[file.split('.').pop()]}).end(body);}
  catch{res.writeHead(500).end();}
}).listen(port,'127.0.0.1',()=>console.log('http://127.0.0.1:'+port));


