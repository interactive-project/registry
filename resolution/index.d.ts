import type {ActivityType} from '@interactive-project/protocol/types';
import type {Capability,GenerationEntry} from '@interactive-project/protocol/generation';
import type {Registry,EngineRegistration,RendererRegistration,HostKind,Frozen} from '../types/registry.js';
export interface ResolutionQuery{
 type:ActivityType;protocolVersion:string;
 activityVersion:{exact:string}|{min:string;maxExclusive:string};
 requiredCapabilities?:Capability[];availableDrivers?:string[];
 policy?:{network?:boolean;execution?:boolean;media?:boolean};host?:HostKind;
}
export interface ResolutionRejection{registrationId:string;activitySchemaVersion:string;code:string;detail?:string}
export type ResolutionResult={resolved:true;registration:EngineRegistration;entry:Frozen<GenerationEntry>;renderer?:RendererRegistration;rejections:ResolutionRejection[]}|{resolved:false;code:string;rejections:ResolutionRejection[]};
export declare function resolveEngine(registry:Registry,query:ResolutionQuery):ResolutionResult;
