import {tracks,tokens} from './ranking.mjs';

const vocabulary='javascript typescript nodejs react python java spring kafka redis postgresql mysql mongodb sql aws docker kubernetes terraform angular spark databricks starburst linux git automation llm mcp express django flask go rust kotlin scala azure gcp html css backend fullstack api microservices distributed'.split(' ');
const domains=['insurance','banking','payments','fintech','financial services','healthcare','ecommerce','retail','logistics','telecommunications'];
const monthNames='jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
function startMonth(lines){
  let employment=false;
  const dates=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(/^(?:professional |work |employment )?(?:experience|history)\s*:?$/i.test(line)){employment=true;continue;}
    if(/^(projects|education|certifications|technical skills)\b/i.test(line))employment=false;
    if(!employment)continue;
    const date=line.match(/\b([a-z]{3,9})\s+(20\d{2})\s*[-–—]/i);
    if(!date||/\bintern(?:ship)?\b/i.test(line)||(/^\s*[A-Z][a-z]+\s+20\d{2}/.test(line)&&/\bintern(?:ship)?\b/i.test(lines[i-1]||'')))continue;
    const month=monthNames.indexOf(date[1].slice(0,3).toLowerCase())+1;
    if(month)dates.push(date[2]+'-'+String(month).padStart(2,'0'));
  }
  return dates.sort()[0]||'';
}
export function extractProfile(text,name){
  const lines=text.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
  if(lines.join(' ').split(/\s+/).length<8)throw Error('Too little readable text. Use a text-based PDF, DOCX or TXT resume.');
  const content=lines.join(' ');
  const words=tokens(content.replace(/\bLLMs\b/gi,'llm').replace(/\bAPIs\b/gi,'api'));
  const skills=vocabulary.filter(s=>words.has(s));
  const evidence={};
  // Use a bullet or sentence as supporting evidence, including wrapped PDF lines.
  const passages=lines.join('\n').split(/\n(?=[–•●▪]|-\s)|(?<=[.!?])\s+|\n(?=[A-Z][^\n]*\|)/)
    .map(s=>s.replace(/^[–•●▪-]\s*/,'').replace(/\s+/g,' ').trim())
    .filter(s=>s.length>24 && !s.includes('@') && !/https?:\/\//i.test(s));
  for(const track of tracks){
    if(!track.pattern.test(content))continue;
    const passage=passages.find(s=>track.pattern.test(s)&&/\b(built|developed|designed|implemented|automated|engineered|created|deployed)\b/i.test(s)&&s.length<=650);
    evidence[track.id]=passage?'Resume evidence · '+passage.slice(0,320):'Resume mentions '+track.name.toLowerCase()+'.';
  }
  if(/software (engineer|develop)|application develop/i.test(content))evidence.software='Your resume includes software development experience.';
  const foundDomains=domains.filter(d=>new RegExp('\\b'+d+'\\b','i').test(content));
  return {name,skills,evidence,domains:foundDomains,domainEvidence:'Industry overlap with your resume · '+foundDomains.join(', '),startMonth:startMonth(lines)};
}
export async function readResume(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext==='txt')return file.text();
  if(ext==='docx'){
    await import('./vendor/mammoth.browser.min.js');
    return (await globalThis.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value;
  }
  if(ext!=='pdf')throw Error('Choose a PDF, DOCX or TXT resume.');
  const pdfjs=await import('./vendor/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.min.mjs',import.meta.url).href;
  const task=pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false,useSystemFonts:true});
  try{
    const pdf=await task.promise;
    const pages=[];
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      const {items}=await page.getTextContent();
      pages.push(items.map(item=>(item.str||'')+(item.hasEOL?'\n':' ')).join(''));
    }
    return pages.join('\n');
  }finally{await task.destroy();}
}
