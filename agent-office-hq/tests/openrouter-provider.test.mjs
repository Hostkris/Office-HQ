import test from 'node:test';
import assert from 'node:assert/strict';
import {streamInkling,openRouterMessages,checkInkling,INKLING_MODEL,INKLING_PROVIDER} from '../native-engine/openrouter-provider.mjs';
function stream(frames,fragment=17){const bytes=new TextEncoder().encode(frames);let at=0;return new ReadableStream({pull(controller){if(at>=bytes.length)return controller.close();controller.enqueue(bytes.slice(at,at+=fragment));}});}
const frame=data=>'data: '+JSON.stringify(data)+'\r\n\r\n';
const chunk=(delta,finish_reason=null)=>({model:INKLING_MODEL,choices:[{index:0,delta,finish_reason}]});
test('fragmented SSE joins tool arguments, ignores keepalives and reads usage from the final chunk',async()=>{
 let request;const data=': OPENROUTER PROCESSING\r\n\r\n'+frame(chunk({role:'assistant',content:'Ready ',tool_calls:[{index:0,id:'call_1',function:{name:'read_file',arguments:'{"path":'}}]}))+frame(chunk({content:'for a tool.',tool_calls:[{index:0,function:{arguments:'"add.mjs"}'}}]},'tool_calls'))+frame({...chunk({},'tool_calls'),usage:{completion_tokens:12,prompt_tokens:50,completion_tokens_details:{reasoning_tokens:7},prompt_tokens_details:{cached_tokens:10},cost:0}})+'data: [DONE]\r\n\r\n';
 const result=await streamInkling({apiKey:'fixture-not-a-real-key',messages:[{role:'user',content:'Inspect the approved file.'}],tools:[],request:async(url,opts)=>{request={url,opts};return {ok:true,body:stream(data)};}});
 assert.equal(result.message.content,'Ready for a tool.');assert.deepEqual(result.message.tool_calls,[{id:'call_1',function:{name:'read_file',arguments:{path:'add.mjs'}}}]);assert.equal(result.reasoning_tokens,7);assert.equal(result.cached_tokens,10);assert.equal(result.cost,0);
 const body=JSON.parse(request.opts.body);assert.equal(body.model,INKLING_MODEL);assert.equal(body.stream,true);assert.deepEqual(body.provider.only,[INKLING_PROVIDER]);assert.equal(body.provider.allow_fallbacks,false);assert.deepEqual(body.provider.max_price,{prompt:0,completion:0});assert.equal(body.models,undefined);
});
test('SSE mid-stream errors, early disconnects and invalid arguments never return a runnable tool call',async()=>{
 for(const ending of [frame({error:{message:'upstream unavailable'}}),'',frame(chunk({},'tool_calls'))+'data: [DONE]\n\n']){
  const data=frame(chunk({tool_calls:[{index:0,id:'x',function:{name:'edit_file',arguments:'{"path":'}}]}))+ending;
  await assert.rejects(streamInkling({apiKey:'fixture-key',messages:[],tools:[],request:async()=>({ok:true,body:stream(data)})}),/stream error|complete successful|incomplete tool arguments/);
 }
});
test('tool transcript round-trips provider IDs and never forwards local thinking fields',()=>{
 const messages=openRouterMessages([{role:'assistant',thinking:'private local trace',content:'',tool_calls:[{id:'one',function:{name:'read_file',arguments:{path:'x.mjs'}}}]},{role:'tool',tool_name:'read_file',content:'file source'}]);
 assert.equal(messages[0].thinking,undefined);assert.equal(messages[0].tool_calls[0].function.arguments,'{"path":"x.mjs"}');assert.equal(messages[1].tool_call_id,'one');
 assert.throws(()=>openRouterMessages([{role:'tool',tool_name:'fake',content:'not a matched result'}]),/transcript/);
});
test('readiness checks the exact free endpoint, tools and key without generating a billable completion',async()=>{
 const urls=[];const request=async url=>{urls.push(url);return {ok:true,json:async()=>url.endsWith('/key')?{data:{}}:{data:{endpoints:[{tag:INKLING_PROVIDER,supported_parameters:['tools'],pricing:{prompt:'0',completion:'0'}}]}}};};
 assert.equal((await checkInkling({request,apiKey:'fixture-key'})).ready,true);assert.ok(urls.every(u=>!u.endsWith('/chat/completions')));assert.equal((await checkInkling({request})).keyConfigured,false);
 assert.equal((await checkInkling({apiKey:'fixture-key',request:async()=>({ok:false})})).ready,false);
});
