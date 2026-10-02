import type {ActivityType,ActivitySpec} from '@interactive-project/protocol/types';
import type {GenerationEntry} from '@interactive-project/protocol/generation';
import type {EngineSession,EngineContext,Result,MaybePromise} from '@interactive-project/protocol/interoperability';
export interface ManifestBase{manifestVersion:'1.0.0';id:string;pluginVersion:string;type:ActivityType;protocolVersions:'1.0.0'[]}
export interface EngineManifest extends ManifestBase{entries:GenerationEntry[]}
export type HostKind='react'|'vue'|'svelte'|'dom';
export interface RendererManifest extends ManifestBase{host:HostKind;activitySchemaVersions:string[];rendererContractVersion:'1.0.0'}
export type Frozen<T>=T extends object?{readonly [P in keyof T]:Frozen<T[P]>}:T;
export interface EnginePorts{createEngine(activity:ActivitySpec,context:EngineContext):MaybePromise<EngineSession>;evaluate(session:EngineSession):MaybePromise<Result>}
export interface RendererContext{session:EngineSession;mount:unknown;services?:Readonly<Record<string,unknown>>}
export interface RendererSession{update():MaybePromise<void>;dispose():MaybePromise<void>}
export interface RendererPorts{createRenderer(context:RendererContext):MaybePromise<RendererSession>}
export type EngineRegistration=EnginePorts&{readonly kind:'engine';readonly manifest:Frozen<EngineManifest>};
export type RendererRegistration=RendererPorts&{readonly kind:'renderer';readonly manifest:Frozen<RendererManifest>};
export interface RegistryDiagnostic{code:string;path:string;severity:'error';message:string;registrationId?:string}
export type RegistrationResult<T>={registered:true;registration:T;unregister():void}|{registered:false;diagnostics:RegistryDiagnostic[]};
export interface LookupRequest{type:ActivityType;protocolVersion:string;activitySchemaVersion:string}
export interface Registry{
 registerEngine(manifest:unknown,ports:EnginePorts):RegistrationResult<EngineRegistration>;
 registerRenderer(manifest:unknown,ports:RendererPorts):RegistrationResult<RendererRegistration>;
 lookupEngine(request:LookupRequest):{found:true;registration:EngineRegistration}|{found:false;code:string};
 lookupRenderer(request:LookupRequest&{host:HostKind}):{found:true;registration:RendererRegistration}|{found:false;code:string};
 dispose():void;
}
export interface RegistryOptions{
 validateEngineManifest(manifest:Frozen<EngineManifest>):{valid:boolean};
 validateRendererManifest(manifest:Frozen<RendererManifest>):{valid:boolean};
}
export declare function createRegistry(options:RegistryOptions):Registry;
