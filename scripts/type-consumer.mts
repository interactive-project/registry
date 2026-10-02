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
