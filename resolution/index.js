import {copyGeneratedJson} from '@interactive-project/protocol/generation/json';
const version=/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const caps=['interactive','evaluable','collaborative','offline','deterministic','resumable','aiGeneratable'];
function parts(v){if(typeof v!=='string'||!version.test(v))throw Error();return v.split('.').map(BigInt);}
function compare(a,b){const x=parts(a),y=parts(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]<y[i]?-1:1;return 0;}
export function resolveEngine(registry,input){
 const reject=(code,rejections=[])=>({resolved:false,code,rejections});
 const copied=copyGeneratedJson(input,{maxBytes:1048576,maxDepth:16,maxCollectionSize:1000,maxStringLength:4000,maxNodes:10000});
 if(!copied.valid)return reject('resolution.invalid');
 const q=copied.value;let matching;
 try{
  if(!q||typeof q!=='object'||Object.keys(q).some(k=>!['type','protocolVersion','activityVersion','requiredCapabilities','availableDrivers','policy','host'].includes(k)))return reject('resolution.invalid');
  parts(q.protocolVersion);const v=q.activityVersion;
  if(!v||typeof v!=='object')return reject('resolution.invalid');
  if(Object.keys(v).join(',')==='exact'){parts(v.exact);matching=value=>value===v.exact;}
  else if(Object.keys(v).sort().join(',')==='maxExclusive,min'){const min=parts(v.min);parts(v.maxExclusive);if(compare(v.min,v.maxExclusive)>=0)return reject('resolution.invalid');matching=value=>parts(value)[0]===min[0]&&compare(value,v.min)>=0&&compare(value,v.maxExclusive)<0;}
  else return reject('resolution.invalid');
  if(q.requiredCapabilities!==undefined&&(!Array.isArray(q.requiredCapabilities)||q.requiredCapabilities.some(c=>!caps.includes(c))))return reject('resolution.invalid');
  if(q.availableDrivers!==undefined&&(!Array.isArray(q.availableDrivers)||q.availableDrivers.some(d=>typeof d!=='string')))return reject('resolution.invalid');
  if(q.host!==undefined&&!['react','vue','svelte','dom'].includes(q.host))return reject('resolution.invalid');
  if(q.policy!==undefined&&(!q.policy||typeof q.policy!=='object'||Array.isArray(q.policy)||Object.entries(q.policy).some(([k,v])=>!['network','execution','media'].includes(k)||typeof v!=='boolean')))return reject('resolution.invalid');
 }catch{return reject('resolution.invalid');}
 const candidates=[],rejections=[];
 const note=(r,e,code,detail)=>rejections.push({registrationId:r.manifest.id,activitySchemaVersion:e.activitySchemaVersion,code,...(detail?{detail}:{})});
 for(const registration of registry.listEngines()){
  const m=registration.manifest;if(m.type!==q.type)continue;
  for(const entry of m.entries){
   if(!m.protocolVersions.includes(q.protocolVersion)){note(registration,entry,'resolution.protocol');continue;}
   if(!matching(entry.activitySchemaVersion)){note(registration,entry,'resolution.version');continue;}
   let denied=false;
   for(const permission of entry.requiredPermissions)if(q.policy?.[permission]!==true){note(registration,entry,'resolution.permission',permission);denied=true;}
   const required=new Set([...entry.requiredCapabilities,...(q.requiredCapabilities??[])]);
   for(const capability of required){const declaration=entry.capabilities[capability];if(!declaration.supported||(capability==='offline'&&entry.requiredPermissions.includes('network'))){note(registration,entry,'resolution.capability',capability);denied=true;}
    for(const driver of declaration.requiredDrivers??[])if(!(q.availableDrivers??[]).includes(driver)){note(registration,entry,'resolution.driver',driver);denied=true;}
   }
   let renderer;
   if(q.host!==undefined){const r=registry.lookupRenderer({type:q.type,host:q.host,protocolVersion:q.protocolVersion,activitySchemaVersion:entry.activitySchemaVersion});if(!r.found){note(registration,entry,'resolution.renderer');denied=true;}else renderer=r.registration;}
   if(!denied)candidates.push({registration,entry,...(renderer?{renderer}:{})});
  }
 }
 candidates.sort((a,b)=>compare(b.entry.activitySchemaVersion,a.entry.activitySchemaVersion)||(a.registration.manifest.id<b.registration.manifest.id?-1:a.registration.manifest.id>b.registration.manifest.id?1:0));
 return candidates.length?{resolved:true,...candidates[0],rejections}:reject('resolution.unavailable',rejections);
}
