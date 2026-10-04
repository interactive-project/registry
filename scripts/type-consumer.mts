import {createRegistry,type EnginePorts,type RendererPorts} from '@interactive-project/registry';
import {validateEngineManifest,validateRendererManifest} from '@interactive-project/registry/validation';
const registry=createRegistry({validateEngineManifest,validateRendererManifest});
declare const ports:EnginePorts;
const renderer:RendererPorts={createRenderer:()=>({update(){},dispose(){}})};
const result=registry.registerEngine({},ports);
if(result.registered){
 const version:'1.0.0'=result.registration.manifest.manifestVersion;void version;
 // @ts-expect-error Manifests are deeply readonly.
 result.registration.manifest.entries[0].schemaId='mutated';
 result.unregister();
}
registry.registerRenderer({},renderer);registry.lookupRenderer({type:'interactive-project/quiz',protocolVersion:'1.0.0',activitySchemaVersion:'0.0.1',host:'react'});
// @ts-expect-error Unknown hosts are not a valid renderer request.
registry.lookupRenderer({type:'interactive-project/quiz',protocolVersion:'1.0.0',activitySchemaVersion:'0.0.1',host:'native'});

import {resolveEngine} from '@interactive-project/registry/resolution';
import {createPluginLoader} from '@interactive-project/registry/loader';
import {createGenerationCatalog,getGenerationSchema} from '@interactive-project/registry/catalog';
const resolved=resolveEngine(registry,{type:'interactive-project/quiz',protocolVersion:'1.0.0',activityVersion:{min:'0.0.1',maxExclusive:'1.0.0'},requiredCapabilities:['offline']});if(resolved.resolved){const id:string=resolved.registration.manifest.id;void id;}
const loader=createPluginLoader([{id:'fixtures/plugin',protocolVersions:['1.0.0'],dependencies:[],load:async signal=>{const aborted:boolean=signal.aborted;return{aborted};}}]);void loader;
const catalog=createGenerationCatalog(registry,{policy:{execution:false},allowedCapabilities:['interactive','evaluable'],availableDrivers:[]});if(catalog.valid){const key:string=catalog.cacheKey;void key;getGenerationSchema(catalog.catalog,'urn:fixture:schema',()=>({type:'object'}),{maxBytes:1024});}
