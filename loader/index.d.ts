import type {CancellationSignal} from '@interactive-project/protocol/interoperability';
export type PluginLoadCode='loader.options'|'loader.cycle'|'loader.depth'|'loader.dependency'|'loader.protocol'|'loader.disposed'|'loader.cancelled'|'loader.missing'|'loader.limit'|'loader.timeout'|'loader.failure';
export declare class PluginLoadError extends Error{readonly code:PluginLoadCode}
export interface PluginDefinition{id:string;protocolVersions:string[];dependencies:{id:string;protocolVersions:string[]}[];load(signal:CancellationSignal):unknown|PromiseLike<unknown>}
export interface PluginLoader{load(id:string,options:{protocolVersion:string;signal?:CancellationSignal}):Promise<unknown>;dispose():void}
export declare function createPluginLoader(definitions:PluginDefinition[],options?:{timeoutMs?:number;maxRetries?:number}):PluginLoader;
