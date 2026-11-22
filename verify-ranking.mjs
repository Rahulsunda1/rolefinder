import assert from 'node:assert/strict';
import {test} from 'node:test';
import {personalize,selectMatches} from './web/ranking.mjs';

const fixture={name:'Test profile',startMonth:'2026-01',skills:['nodejs','java'],domains:['example'],domainEvidence:'Example domain',evidence:{backend:'Example backend project',software:'Example software work'}};
test('role scope outweighs employer and incidental skill overlap',()=>{
  const date=new Date(2026,10,22);
  const jobs=['Backend Developer – Node.js','Core Java Backend Developer – Assistant Vice President','Associate Director – Clinical Data Foundation','Application Developer – Java Angular','Test Automation Engineer – Python']
    .map(title=>personalize({title,company:'Example',location:'India'},date,fixture));
  assert.deepEqual(selectMatches(jobs).map(j=>j.title),[jobs[0].title,jobs[3].title]);
  assert.deepEqual(selectMatches(jobs,{fit:'stretch',track:'backend'}).map(j=>j.title),[jobs[1].title]);
  assert.equal(selectMatches(jobs,{fit:'strong',query:'example node'}).length,1);
});
test('requirements change the recommendation; company history and preferences do not',()=>{
  const job={title:'Backend Engineer',company:'Example'};
  const evaluate=description=>personalize({...job,description},new Date(2026,10,22),fixture).fit;
  assert.equal(evaluate('Minimum 5 years of professional experience.'),'stretch');
  assert.equal(evaluate('Founded 20 years ago. 5 years of experience preferred.'),'strong');
});

