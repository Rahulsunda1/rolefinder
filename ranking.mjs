const aliases = [
  [/\bback[ -]end\b/gi, 'backend'],
  [/\bfull[ -]stack\b/gi, 'fullstack'],
  [/\bnode(?:\.?js)?\b/gi, 'nodejs'],
  [/\breact(?:\.?js)?\b/gi, 'react'],
  [/\b(?:software development engineer|sde)\b/gi, 'software engineer'],
  [/\bdevelopers?\b/gi, 'engineer']
];
export function tokens(text) {
  for (const [pattern, replacement] of aliases) text = text.replace(pattern, replacement);
  return new Set(text.toLowerCase().match(/[a-z0-9]+(?:[+#]+)?/g) ?? []);
}

// Relative weights for role and technology signals.
const weights = {
  backend: 10, nodejs: 10, kafka: 9, distributed: 8, microservices: 8,
  automation: 7, redis: 7, python: 6, java: 6, spring: 6, fullstack: 6,
  postgresql: 6, mcp: 6, llm: 5, api: 5, react: 4, aws: 4,
  typescript: 4, software: 4, engineer: 1
};
export function rankRoles(jobs, resume) {
  const profile = tokens(resume);
  return jobs.map(job => {
    const title = tokens(job.title);
    const matched = Object.keys(weights).filter(word => title.has(word) && profile.has(word));
    const senior = /\b(senior|sr|vice president|vp|staff|principal|manager|lead|director|architect|iii|iv)\b/i.test(job.title);
    const early = /\b(junior|associate|entry[ -]level|graduate|engineer[ -]+(?:i|1))\b/i.test(job.title);
    const score = matched.reduce((sum, word) => sum + weights[word], 0) + (early ? 3 : 0) - (senior ? 12 : 0);
    return { ...job, score, matched, levelNote: senior ? 'Check leadership and experience requirements' : early ? 'Early-career title' : 'Level unconfirmed' };
  })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}



export const tracks = [
  {id:'automation', name:'AI & workflow automation', pattern:/\b(llms?|mcp|gen(?:erative)?[ -]?ai|agentic|ai agents?|workflow automation|process automation)\b/i},
  {id:'backend', name:'Backend & distributed systems', pattern:/\b(back[ -]?end|apis?|microservices?|distributed systems?|event[ -]driven|node\.?js|spring(?: boot)?|kafka)\b/i},
  {id:'fullstack', name:'Full-stack development', pattern:/\b(full[ -]?stack|mern|react(?:\.js)?)\b/i},
  {id:'data', name:'Data pipelines & reconciliation', pattern:/\b(data engineer(?:ing)?|data pipelines?|reconciliation|data migration|etl)\b/i}
];
const genericRole=/\b((software|application[s]?) (development |systems? )?(engineer|developer)|programmer analyst|sde|swe|java developer|python developer)\b/i;
const unrelated=/\b(sales engineer|solutions? sales|recruiter|clinical|mechanical|civil engineer|electrical engineer|account executive|technical writer|talent acquisition|customer success|technical support|support analyst|qa|sdet|test automation)\b/i;
const leadership=/\b(vp|avp|vice president|principal|director|staff|lead(?:er)?|architect|manager|senior|sr\.?|iii|iv)\b/i;
const early=/\b(junior|entry[ -]level|graduate|associate|(?:engineer|sde|swe)[ -]+(?:i|1))\b/i;

function minimumExperience(text){
  const requirements=[
    /\b(?:minimum(?: of)?|at least|requires?|must have)\s+(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\+?\s*(?:years?|yrs?)\b/gi,
    /\b(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\+?\s*(?:years?|yrs?)(?:'|’)?\s+(?:of\s+)?(?:professional |relevant |hands-on |software |backend |industry |work )*(?:experience|development experience)\b/gi,
    /\bexperience\s*[:–-]\s*(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\+?\s*(?:years?|yrs?)\b/gi
  ];
  const values=[];
  for(const line of text.split(/[\n.;]/)){
    if(/preferred|nice to have|bonus/i.test(line))continue;
    for(const rule of requirements)for(const match of line.matchAll(rule))values.push(Number(match[1]));
  }
  return values.length?Math.max(...values):null;
}

export function validProfile(p){
  const strings=list=>Array.isArray(list)&&list.every(v=>typeof v==='string'&&v.length<=200);
  return p && typeof p.name==='string' && strings(p.skills) && strings(p.domains) &&
    p.evidence && typeof p.evidence==='object' && Object.values(p.evidence).every(v=>typeof v==='string') &&
    typeof p.domainEvidence==='string' && (p.startMonth==='' || /^\d{4}-(0[1-9]|1[0-2])$/.test(p.startMonth));
}
export function personalize(job,today=new Date(),profile=null){
  const title=job.title;
  const text=[title,job.description].filter(Boolean).join('\n');
  const fromTitle=tracks.filter(track=>track.pattern.test(title));
  const fromDuties=tracks.filter(track=>track.pattern.test(job.description||''));
  const relevant=[...new Set([...fromTitle,...fromDuties])].filter(track=>!profile || profile.evidence[track.id]);
  const generic=genericRole.test(title);
  const outOfScope=unrelated.test(title);
  const career=leadership.test(title)||/^(?:senior|director|vp & executive)$/im.test(job.cardText||'');
  const years=minimumExperience([text,job.cardText].filter(Boolean).join('\n'));
  const [year,month]=(profile?.startMonth||'0000-01').split('-').map(Number);
  const months=(today.getFullYear()-year)*12+today.getMonth()+1-month;
  const gap=!!profile?.startMonth && years!==null && years*12>months;
  const skills=tokens(text);
  const matched=(profile?.skills||[]).filter(word=>skills.has(word)&&!['engineer','software','backend','fullstack','automation'].includes(word));
  const reasons=relevant.map(track=>profile?.evidence[track.id] || 'Role family: '+track.name+'.');
  const checks=[];
  let score=relevant.some(track=>fromTitle.includes(track))?35:relevant.length?27:generic?16:0;
  score+=Math.min(16,matched.length*4)+Math.min(8,Math.max(0,relevant.length-1)*4);
  if(generic&&!relevant.length)reasons.push(profile?.evidence.software || 'General software development role. Check the team and responsibilities.');
  const domainText=(job.company+' '+title).toLowerCase().match(/[a-z0-9]+/g)?.join(' ')||'';
  if((generic||relevant.length)&&profile?.domains.some(d=>(' '+domainText+' ').includes(' '+d.toLowerCase()+' '))){
    score+=3;reasons.push(profile.domainEvidence);
  }
  if(early.test(title)&&!career){score+=6;reasons.push('The title indicates an early-career role.');}
  if(matched.length)reasons.push('Resume overlap: '+matched.join(', ')+'.');
  if(career){score-=35;checks.push('The listing signals senior or leadership scope.');}
  if(gap){score-=25;checks.push('The posting asks for '+years+' or more years. Your profile lists full-time experience from '+profile.startMonth+'.');}
  if(outOfScope){score-=45;checks.push('The primary role is outside your target engineering tracks.');}
  const gaps=(profile?['Angular','Databricks','Starburst','Spark']:[]).filter(s=>!profile.skills.includes(s.toLowerCase()) && new RegExp('\\b'+s+'\\b','i').test(text));
  if(gaps.length){score-=Math.min(16,gaps.length*5);checks.push('Experience with '+gaps.join(', ')+' is unconfirmed on your resume.');}
  const stretch=career||gap;
  const fit=outOfScope||(!generic&&!relevant.length)?'other':stretch?'stretch':score>=30?'strong':'possible';
  if(!job.description)checks.push('Assessment uses the portal card. Add the employer description to check duties and experience.');
  return {...job,matched,score,reasons,checks,fit,tracks:relevant.length?relevant.map(t=>t.id):[generic?'software':'other']};
}
export function selectMatches(rows,{fit='recommended',track='all',query=''}={}){
  const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(job=>{
    if(fit==='recommended'&&!['strong','possible'].includes(job.fit))return false;
    if(!['recommended','all'].includes(fit)&&job.fit!==fit)return false;
    if(track!=='all'&&!job.tracks.includes(track))return false;
    const text=[job.title,job.company,job.location,job.description,job.cardText].filter(Boolean).join(' ').toLowerCase();
    return words.every(word=>text.includes(word));
  }).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
}


