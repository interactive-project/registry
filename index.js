import {copyGeneratedJson} from '@interactive-project/protocol/generation/json';
const fail=(code,path='',registrationId)=>({registered:false,diagnostics:[{code,path,severity:'error',message:messages[code],...(registrationId?{registrationId}:{})}]});
const messages={'registry.invalid':'The manifest or live ports are invalid.','registry.duplicate':'The registration ID is already registered. Unregister it explicitly first.','registry.conflict':'A type/host/version slot is already claimed. Unregister the conflicting registration explicitly first.','registry.disposed':'The registry has been disposed.','registry.limit':'The registration limit was reached.'};
const engineKey=(type,protocolVersion,activitySchemaVersion)=>JSON.stringify([type,protocolVersion,activitySchemaVersion]);
const rendererKey=(type,host,protocolVersion,activitySchemaVersion)=>JSON.stringify([type,host,protocolVersion,activitySchemaVersion]);
export function createRegistry(options){
 if(!options||typeof options.validateEngineManifest!=='function'||typeof options.validateRendererManifest!=='function')throw new TypeError('Trusted manifest validators are required.');
 const validators={engine:options.validateEngineManifest,renderer:options.validateRendererManifest};
 const records=new Map(),engines=new Map(),renderers=new Map();let disposed=false;
 function register(kind,input,ports){
  if(disposed)return fail('registry.disposed');
  const copied=copyGeneratedJson(input,{maxBytes:1048576,maxDepth:32,maxCollectionSize:1000,maxStringLength:4000,maxNodes:10000});
  if(!copied.valid)return fail('registry.invalid');
  const manifest=copied.value;
  try{const validation=validators[kind](manifest);if(validation&&typeof validation.then==='function'){Promise.resolve(validation).catch(()=>{});return fail('registry.invalid');}if(validation?.valid!==true)return fail('registry.invalid');}
  catch{return fail('registry.invalid');}
  if(!ports||typeof ports!=='object')return fail('registry.invalid');
  const captured=kind==='engine'?{createEngine:ports.createEngine,evaluate:ports.evaluate}:{createRenderer:ports.createRenderer};
  if(Object.values(captured).some(port=>typeof port!=='function'))return fail('registry.invalid');
  if(disposed)return fail('registry.disposed');
  if(records.has(manifest.id))return fail('registry.duplicate','/id',manifest.id);
  if(records.size>=1000)return fail('registry.limit');
  const keys=kind==='engine'?manifest.protocolVersions.flatMap(p=>manifest.entries.map(e=>engineKey(manifest.type,p,e.activitySchemaVersion))):manifest.protocolVersions.flatMap(p=>manifest.activitySchemaVersions.map(v=>rendererKey(manifest.type,manifest.host,p,v)));
  const table=kind==='engine'?engines:renderers;
  for(const key of keys)if(table.has(key))return fail('registry.conflict',kind==='engine'?'/entries':'/activitySchemaVersions',table.get(key).manifest.id);
  const registration=Object.freeze({kind,manifest,...captured});records.set(manifest.id,registration);
  for(const key of keys)table.set(key,registration);
  let removed=false;
  function unregister(){if(removed)return;removed=true;if(records.get(manifest.id)!==registration)return;records.delete(manifest.id);for(const key of keys)if(table.get(key)===registration)table.delete(key);}
  return{registered:true,registration,unregister};
 }
 function lookupEngine(request){
  if(disposed)return{found:false,code:'registry.disposed'};
  const r=engines.get(engineKey(request?.type,request?.protocolVersion,request?.activitySchemaVersion));
  return r?{found:true,registration:r}:{found:false,code:'registry.engineMissing'};
 }
 function lookupRenderer(request){
  if(disposed)return{found:false,code:'registry.disposed'};
  const r=renderers.get(rendererKey(request?.type,request?.host,request?.protocolVersion,request?.activitySchemaVersion));
  return r?{found:true,registration:r}:{found:false,code:'registry.rendererMissing'};
 }
 function dispose(){disposed=true;records.clear();engines.clear();renderers.clear();}
 return Object.freeze({registerEngine:(m,p)=>register('engine',m,p),registerRenderer:(m,p)=>register('renderer',m,p),lookupEngine,lookupRenderer,listEngines:()=>Object.freeze([...records.values()].filter(r=>r.kind==='engine')),listRenderers:()=>Object.freeze([...records.values()].filter(r=>r.kind==='renderer')),dispose});
}
