export type ManifestValidationResult={valid:true;diagnostics:[]}|{valid:false;diagnostics:{code:string;path:string;severity:'error';message:string}[]};
export declare function validateEngineManifest(input:unknown):ManifestValidationResult;
export declare function validateRendererManifest(input:unknown):ManifestValidationResult;
