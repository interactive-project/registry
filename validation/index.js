import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {copyGeneratedJson} from '@interactive-project/protocol/generation/json';
import {validateGenerationCatalog} from '@interactive-project/protocol/generation';
const require=createRequire(import.meta.url),ajv=new Ajv2020({strict:true,allErrors:true,ownProperties:true});addFormats(ajv);
ajv.addSchema(JSON.parse(readFileSync(require.resolve('@interactive-project/protocol/schemas/generation-catalog.v1.schema.json'))));
const schema=JSON.parse(readFileSync(new URL('../schemas/plugin-manifest.v1.schema.json',import.meta.url)));ajv.addSchema(schema);
const engine=ajv.compile({$ref:schema.$id+'#/$defs/engine'}),renderer=ajv.compile({$ref:schema.$id+'#/$defs/renderer'});
const fail=(path='')=>({valid:false,diagnostics:[{code:'registry.manifest',path,severity:'error',message:'The manifest violates its structural or semantic contract.'}]});
function prepared(input){const copied=copyGeneratedJson(input,{maxBytes:1048576,maxDepth:32,maxCollectionSize:1000,maxStringLength:4000,maxNodes:10000});return copied.valid?copied.value:null;}
export function validateEngineManifest(input){
 const m=prepared(input);if(!m||!engine(m))return fail();
 if(m.entries.some(e=>e.type!==m.type))return fail('/entries');
 if(!validateGenerationCatalog({catalogVersion:'1.0.0',protocolVersion:'1.0.0',entries:m.entries}).valid)return fail('/entries');
 return{valid:true,diagnostics:[]};
}
export function validateRendererManifest(input){const m=prepared(input);return m&&renderer(m)?{valid:true,diagnostics:[]}:fail();}
