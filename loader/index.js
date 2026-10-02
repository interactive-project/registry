export class PluginLoadError extends Error{constructor(code){super('Plugin loading failed.');this.name='PluginLoadError';this.code=code;}}
const error=code=>new PluginLoadError(code),version=/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/,id=/^[a-z0-9][a-z0-9.-]*\/[a-z0-9][a-z0-9._-]*$/;
export function createPluginLoader(definitions,{timeoutMs=30000,maxRetries=0}={}){
 if(!Array.isArray(definitions)||definitions.length>1000||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000||!Number.isSafeInteger(maxRetries)||maxRetries<0||maxRetries>3)throw error('loader.options');
 const records=new Map();
 const versions=v=>Array.isArray(v)&&v.length>0&&v.length<=32&&new Set(v).size===v.length&&v.every(x=>typeof x==='string'&&version.test(x));
 for(const d of definitions){
  if(!d||typeof d.id!=='string'||d.id.length>128||!id.test(d.id)||records.has(d.id)||!versions(d.protocolVersions)||!Array.isArray(d.dependencies)||d.dependencies.length>32||typeof d.load!=='function')throw error('loader.options');
  const dependencies=d.dependencies.map(e=>{if(!e||typeof e.id!=='string'||!versions(e.protocolVersions))throw error('loader.options');return{id:e.id,protocolVersions:[...e.protocolVersions]};});
  if(new Set(dependencies.map(e=>e.id)).size!==dependencies.length)throw error('loader.options');
  records.set(d.id,{id:d.id,protocolVersions:[...d.protocolVersions],dependencies,load:d.load});
 }
 const effective=new Map(),heights=new Map(),visiting=new Set();
 function inspect(plugin,depth=0){
  if(visiting.has(plugin))throw error('loader.cycle');
  if(depth>32)throw error('loader.depth');
  if(effective.has(plugin)){if(depth+heights.get(plugin)>32)throw error('loader.depth');return effective.get(plugin);}
  const d=records.get(plugin);if(!d)throw error('loader.dependency');
  visiting.add(plugin);let allowed=new Set(d.protocolVersions),height=0;
  for(const edge of d.dependencies){const child=inspect(edge.id,depth+1);height=Math.max(height,1+heights.get(edge.id));allowed=new Set([...allowed].filter(v=>edge.protocolVersions.includes(v)&&child.has(v)));}
  visiting.delete(plugin);if(!allowed.size)throw error('loader.protocol');heights.set(plugin,height);effective.set(plugin,allowed);return allowed;
 }
 for(const plugin of records.keys())inspect(plugin);
 const inflight=new Map(),cache=new Map();let disposed=false;
 function load(plugin,{protocolVersion,signal}={}){
  if(disposed)return Promise.reject(error('loader.disposed'));
  if(signal?.aborted)return Promise.reject(error('loader.cancelled'));
  if(!records.has(plugin))return Promise.reject(error('loader.missing'));
  if(!effective.get(plugin).has(protocolVersion))return Promise.reject(error('loader.protocol'));
  const key=JSON.stringify([plugin,protocolVersion]);
  if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return Promise.resolve(value);}
  let op=inflight.get(key);
  if(!op){
   if(inflight.size>=128)return Promise.reject(error('loader.limit'));
   const controller=new AbortController(),waiters=new Set();
   op={controller,waiters,done:false,reason:null};inflight.set(key,op);
   const timer=setTimeout(()=>{op.reason='loader.timeout';controller.abort();},timeoutMs);
   let abortListener;
   const cancelled=new Promise((_,reject)=>{abortListener=()=>reject(error(op.reason??'loader.cancelled'));controller.signal.addEventListener('abort',abortListener,{once:true});});
   const work=Promise.resolve().then(async()=>{
    const d=records.get(plugin);
    for(const edge of d.dependencies)await load(edge.id,{protocolVersion,signal:controller.signal});
    for(let attempt=0;attempt<=maxRetries;attempt++){
     if(controller.signal.aborted)throw error(op.reason??'loader.cancelled');
     try{return await d.load(controller.signal);}catch{if(controller.signal.aborted)throw error(op.reason??'loader.cancelled');if(attempt===maxRetries)throw error('loader.failure');}
    }
   });
   op.result=Promise.race([work,cancelled]);
   const finish=()=>{op.done=true;clearTimeout(timer);controller.signal.removeEventListener('abort',abortListener);if(inflight.get(key)===op)inflight.delete(key);};
   op.result.then(value=>{if(!disposed&&!controller.signal.aborted){cache.set(key,value);while(cache.size>128)cache.delete(cache.keys().next().value);}finish();},finish);
  }
  if(op.waiters.size>=128)return Promise.reject(error('loader.limit'));
  return new Promise((resolve,reject)=>{
   const waiter={active:true};op.waiters.add(waiter);
   const cleanup=()=>{waiter.active=false;op.waiters.delete(waiter);signal?.removeEventListener('abort',abort);};
   const abort=()=>{if(!waiter.active)return;cleanup();reject(error('loader.cancelled'));if(!op.done&&op.waiters.size===0){op.reason='loader.cancelled';op.controller.abort();if(inflight.get(key)===op)inflight.delete(key);}};
   signal?.addEventListener('abort',abort,{once:true});
   if(signal?.aborted){abort();return;}
   op.result.then(value=>{if(waiter.active){cleanup();resolve(value);}},reason=>{if(waiter.active){cleanup();reject(reason);}});
  });
 }
 function dispose(){if(disposed)return;disposed=true;for(const op of inflight.values()){op.reason='loader.disposed';op.controller.abort();}inflight.clear();cache.clear();}
 return Object.freeze({load,dispose});
}
