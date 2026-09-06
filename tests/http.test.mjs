import test from 'node:test';import assert from 'node:assert/strict';import {samples} from '../lib/extraction.mjs';
const url=process.env.TEST_URL||'http://localhost:3122';
async function post(body){const r=await fetch(url+'/api/compare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
test('fixture flow returns a comparison without invented freight',async()=>{const r=await post({quotes:samples,quantity:12,mode:'fixture'});assert.equal(r.status,200);assert.equal(r.body.comparison.lowestLandedQuoteIds,null);assert.equal(r.body.quotes[0].freight,null);});
test('modified documents cannot use canned results',async()=>assert.equal((await post({quotes:['changed',...samples.slice(1)],quantity:12,mode:'fixture'})).status,400));
test('invalid quantity rejected',async()=>assert.equal((await post({quotes:samples,quantity:0,mode:'fixture'})).status,400));
test('missing live credentials fail visibly',async()=>{const config=await (await fetch(url+'/api/compare')).json();if(config.configured)return;const r=await post({quotes:samples,quantity:12,mode:'nebius'});assert.equal(r.status,400);assert.match(r.body.error,/credentials/);});
