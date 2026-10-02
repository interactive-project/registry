import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRegistry} from '../index.js';
import {validateEngineManifest,validateRendererManifest} from '../validation/index.js';
import {createEngine,evaluate} from '../fixtures/quiz-engine.js';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const options={validateEngineManifest,validateRendererManifest},registry=createRegistry(options),manifest=read('../fixtures/engine.json'),before=JSON.stringify(manifest);
const ports={createEngine,evaluate};const registered=registry.registerEngine(manifest,ports);assert(registered.registered);assert.equal(JSON.stringify(manifest),before);assert(Object.isFrozen(registered.registration.manifest.entries[0].capabilities));
assert.equal(registry.registerEngine(manifest,ports).diagnostics[0].code,'registry.duplicate');
assert.equal(registry.registerEngine({...manifest,id:'fixtures/conflict'},ports).diagnostics[0].code,'registry.conflict');
assert.equal(registry.registerEngine({...manifest,id:'fixtures/invalid',entries:[]},ports).diagnostics[0].code,'registry.invalid');
assert.equal(registry.registerEngine({...manifest,id:'fixtures/invalid',entries:[{...manifest.entries[0],type:'interactive-project/code'}]},ports).diagnostics[0].code,'registry.invalid');
const duplicate=structuredClone(manifest);duplicate.entries.push(duplicate.entries[0]);assert(!validateEngineManifest(duplicate).valid);
assert.equal(registry.registerEngine({...manifest,id:'fixtures/missing'},{}).diagnostics[0].code,'registry.invalid');
const lookup={type:manifest.type,protocolVersion:'1.0.0',activitySchemaVersion:'0.0.1'};
assert.equal(registry.lookupEngine({...lookup,activitySchemaVersion:'1.0.0'}).found,false);
let calls=0;for(const host of ['react','vue','svelte','dom']){
 const m=read('../fixtures/renderer-'+host+'.json');assert(validateRendererManifest(m).valid);
 const r=registry.registerRenderer(m,{createRenderer:({session})=>{calls++;return{update:()=>session.evaluate(),dispose(){}};}});assert(r.registered);
 assert.equal(registry.registerRenderer({...m,id:'fixtures/conflict-'+host},{createRenderer:()=>{}}).diagnostics[0].code,'registry.conflict');
 const engine=registry.lookupEngine(lookup);assert(engine.found);assert.equal(engine.registration.createEngine,createEngine);
 const renderer=registry.lookupRenderer({...lookup,host});assert(renderer.found);assert.equal(renderer.registration.manifest.host,host);
}
assert.equal(calls,0,'Registration and lookup never instantiate/render/import a framework');
const resolved=registry.lookupEngine(lookup);assert(resolved.found);
const activity={protocolVersion:'1.0.0',id:'00000000-0000-4000-8000-000000000001',type:manifest.type,activitySchemaVersion:'0.0.1',metadata:{title:'Fixture quiz'},config:{expectedAnswer:'A'}};
const context={sessionId:'00000000-0000-4000-8000-000000000002'},session=resolved.registration.createEngine(activity,context);
session.dispatch({id:'00000000-0000-4000-8000-000000000003',activityId:activity.id,sessionId:context.sessionId,type:'fixtures/select',payload:{answer:'A'}});
assert.equal(resolved.registration.evaluate(session).score.value,1);
for(const host of ['react','vue','svelte','dom']){const r=registry.lookupRenderer({...lookup,host});const rendered=r.registration.createRenderer({session,mount:{fixtureHost:host}});assert.equal(rendered.update().score.value,1);rendered.dispose();}
assert.equal(calls,4);assert(!session.disposed);
ports.createEngine=()=>{throw Error('Mutated host object');};assert.equal(resolved.registration.createEngine,createEngine,'Capture live ports without retaining mutable registration object');
registered.unregister();registered.unregister();assert.equal(registry.lookupEngine(lookup).found,false);assert.equal(resolved.registration.evaluate(session).score.value,1);
const replacement=registry.registerEngine(manifest,{createEngine,evaluate});assert(replacement.registered);registered.unregister();assert(registry.lookupEngine(lookup).found);
replacement.unregister();
const invalidVersions={...manifest,protocolVersions:['2.0.0']};assert(!validateEngineManifest(invalidVersions).valid);
const asyncRegistry=createRegistry({validateEngineManifest:async()=>{throw Error('async');},validateRendererManifest});assert.equal(asyncRegistry.registerEngine(manifest,{createEngine,evaluate}).diagnostics[0].code,'registry.invalid');await new Promise(r=>setImmediate(r));
registry.dispose();registry.dispose();assert.equal(registry.lookupEngine(lookup).code,'registry.disposed');assert.equal(registry.registerEngine(manifest,{createEngine,evaluate}).diagnostics[0].code,'registry.disposed');assert.equal(resolved.registration.evaluate(session).score.value,1);assert(!session.disposed);session.dispose();assert(session.disposed);
const source=readFileSync(new URL('../fixtures/quiz-engine.js',import.meta.url),'utf8');assert(!/from\s+['"](?:react|vue|svelte)|document|window/.test(source));
const ts=(await import('typescript')).default;
const program=ts.createProgram([new URL('./type-consumer.mts',import.meta.url).pathname],{strict:true,noEmit:true,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,lib:['lib.es2022.d.ts']});
const diagnostics=ts.getPreEmitDiagnostics(program);assert.equal(diagnostics.length,0,diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
const checker=program.getTypeChecker(),typeSource=program.getSourceFiles().find(s=>s.fileName.endsWith('/types/registry.d.ts')),decls=new Map(typeSource.statements.filter(s=>s.name).map(s=>[s.name.text,s]));
const schema=read('../schemas/plugin-manifest.v1.schema.json');
for(const [name,definition]of [['EngineManifest','engine'],['RendererManifest','renderer']]){
 const type=checker.getTypeAtLocation(decls.get(name)),props=checker.getPropertiesOfType(type),shape=schema.$defs[definition];
 assert.deepEqual(props.map(p=>p.name).sort(),Object.keys(shape.properties).sort());
 for(const prop of props)assert.equal(!(prop.flags&ts.SymbolFlags.Optional),shape.required.includes(prop.name));
}
console.log('Registry: manifest rejection, exact independent engine/four-host renderer lookup, explicit replacement, retained sessions and ES2022 types passed.');
