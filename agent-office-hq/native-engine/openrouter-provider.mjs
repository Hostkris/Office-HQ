/* OpenRouter runs only on the Mac server. No key is ever returned to a client.
 * Fixed free model and provider route; no model/provider fallbacks.
 */
export const INKLING_MODEL='thinkingmachines/inkling:free';
export const INKLING_PROVIDER='thinkingmachines/nvfp4';
const BASE='https://openrouter.ai/api/v1';
const error=message=>Object.assign(Error(message),{status:503});
export async function checkInkling({request=fetch,apiKey}={}){
 if(!apiKey)return {ready:false,message:'Add your OpenRouter API key on the Mac to enable Inkling.',keyConfigured:false};
 try{
  const [auth,models]=await Promise.all([request(BASE+'/key',{headers:{Authorization:'Bearer '+apiKey},signal:AbortSignal.timeout(6000)}),request(BASE+'/models/thinkingmachines/inkling:free/endpoints',{signal:AbortSignal.timeout(6000)})]);
  if(!auth.ok)return {ready:false,keyConfigured:true,message:'OpenRouter key was not accepted. Check it on the Mac.'};
  if(!models.ok)throw Error('Unavailable');const d=(await models.json()).data;
  const endpoint=d?.endpoints?.find(e=>e.tag===INKLING_PROVIDER||e.provider_tag===INKLING_PROVIDER);
  if(!endpoint||!endpoint.supported_parameters?.includes('tools')||Number(endpoint.pricing?.prompt)!==0||Number(endpoint.pricing?.completion)!==0)return {ready:false,keyConfigured:true,message:'The pinned free Inkling provider with tools is unavailable. No fallback will be used.'};
  return {ready:true,keyConfigured:true,model:INKLING_MODEL,provider:INKLING_PROVIDER,message:'OpenRouter key and pinned free tool endpoint checked. Real task performance is not yet measured.'};
 }catch{return {ready:false,keyConfigured:true,message:'Could not verify the pinned free Inkling endpoint. No fallback will be used.'};}
}
export function openRouterMessages(messages){
 let pending=[];return messages.map(m=>{
  if(m.role==='assistant'){
   const calls=(m.tool_calls||[]).map((c,i)=>({id:c.id||'call_'+i+'_'+Math.random().toString(16).slice(2),type:'function',function:{name:c.function.name,arguments:typeof c.function.arguments==='string'?c.function.arguments:JSON.stringify(c.function.arguments)}}));pending=[...calls];
   return {role:'assistant',content:m.content||null,...(calls.length?{tool_calls:calls}:{}),...(m.reasoning_details?{reasoning_details:m.reasoning_details}:{})};
  }
  if(m.role==='tool'){const next=pending.shift();if(!next||next.function.name!==m.tool_name)throw error('Tool transcript did not match the provider’s tool calls.');return {role:'tool',tool_call_id:next.id,content:m.content};}
  return {role:m.role,content:m.content};
 });
}
export async function streamInkling({request=fetch,apiKey,messages,tools,signal,thinking='auto'}={}){
 if(!apiKey)throw error('OpenRouter API key is missing on the Mac.');const started=Date.now();
 const body={model:INKLING_MODEL,messages:openRouterMessages(messages),tools,stream:true,max_tokens:6000,provider:{only:[INKLING_PROVIDER],allow_fallbacks:false,require_parameters:true,max_price:{prompt:0,completion:0}}};
 if(thinking!=='auto')body.reasoning={effort:thinking==='fast'?'low':'high'};
 const response=await request(BASE+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','X-OpenRouter-Title':'Office HQ coding worker'},body:JSON.stringify(body),signal});
 if(!response.ok)throw error('OpenRouter returned HTTP '+response.status+'. The pinned provider was not replaced.');
 if(!response.body)throw error('OpenRouter returned no response stream.');
 let buffer='',bytes=0,done=false,finish=null,content='',usage=null,firstTokenMs=null;const calls=new Map(),reasoningDetails=[];
 function frame(raw){
  const data=raw.split(/\r?\n/).filter(s=>s.startsWith('data:')).map(s=>s.slice(5).trimStart()).join('\n');if(!data)return;if(data==='[DONE]'){done=true;return;}
  let chunk;try{chunk=JSON.parse(data);}catch{throw error('OpenRouter sent an invalid streaming frame. No partial tool action was executed.');}
  if(chunk.error)throw error('OpenRouter reported a stream error. No partial tool action was executed.');
  if(chunk.model&&chunk.model!==INKLING_MODEL&&chunk.model!=='thinkingmachines/inkling')throw error('OpenRouter returned an unexpected model.');
  if(chunk.usage)usage=chunk.usage;
  const choice=chunk.choices?.find(c=>c.index===0)||chunk.choices?.[0];if(!choice)return;
  if(choice.finish_reason)finish=choice.finish_reason;const delta=choice.delta||{};
  if((delta.content||delta.tool_calls?.length)&&firstTokenMs===null)firstTokenMs=Date.now()-started;
  if(typeof delta.content==='string')content+=delta.content;
  if(Array.isArray(delta.reasoning_details))reasoningDetails.push(...delta.reasoning_details);
  for(const part of delta.tool_calls||[]){
   if(!Number.isInteger(part.index)||part.index<0||part.index>7)throw error('Invalid streamed tool-call index.');
   const call=calls.get(part.index)||{id:'',function:{name:'',arguments:''}};
   if(part.id)call.id+=part.id;if(part.function?.name)call.function.name+=part.function.name;if(part.function?.arguments)call.function.arguments+=part.function.arguments;calls.set(part.index,call);
  }
 }
 const decoder=new TextDecoder();
 try{
  for await(const chunk of response.body){
   signal?.throwIfAborted();bytes+=chunk.length;if(bytes>2000000)throw error('OpenRouter stream exceeded the task response limit.');buffer+=decoder.decode(chunk,{stream:true});
   let match;while((match=/\r?\n\r?\n/.exec(buffer))){frame(buffer.slice(0,match.index));buffer=buffer.slice(match.index+match[0].length);}
  }
  buffer+=decoder.decode();if(buffer.trim())frame(buffer);
 }catch(e){await response.body.cancel?.().catch(()=>{});throw e;}
 if(!done||!['stop','tool_calls','length'].includes(finish))throw error('OpenRouter stream ended without a complete successful response. No partial tool action was executed.');
 const toolCalls=[];if(finish!=='length')for(const [,c]of [...calls].sort((a,b)=>a[0]-b[0])){let args;try{args=JSON.parse(c.function.arguments);}catch{throw error('OpenRouter returned incomplete tool arguments.');}if(!c.id||!c.function.name)throw error('OpenRouter returned an incomplete tool call.');toolCalls.push({id:c.id,function:{name:c.function.name,arguments:args}});}
 return {done:true,done_reason:finish,message:{role:'assistant',content,tool_calls:toolCalls,...(reasoningDetails.length?{reasoning_details:reasoningDetails}:{})},eval_count:usage?.completion_tokens||0,prompt_eval_count:usage?.prompt_tokens||0,eval_duration:(Date.now()-started)*1e6,load_duration:0,reasoning_tokens:usage?.completion_tokens_details?.reasoning_tokens??null,cached_tokens:usage?.prompt_tokens_details?.cached_tokens??null,cost:usage?.cost??null,first_token_ms:firstTokenMs};
}
