import type { GenerationCatalog, Capability, Permission } from '@interactive-project/protocol/generation';
import type { JsonValue } from '@interactive-project/protocol/types';
import type { Registry, Frozen } from '../types/registry.js';

export type CatalogErrorCode = 'registry.catalogOptions' | 'registry.catalogLimit' | 'registry.schemaOptions' | 'registry.schemaNotFound' | 'registry.schemaResolver' | 'registry.schemaInvalid' | 'registry.schemaLimit' | 'registry.schemaReference';
export type GenerationCatalogResult =
  | { readonly valid: true; readonly catalog: Frozen<GenerationCatalog>; readonly cacheKey: string }
  | { readonly valid: false; readonly code: CatalogErrorCode };
export interface GenerationCatalogOptions {
  /** Only protocol 1.0.0 is supported by this catalog entry. */
  protocolVersion?: '1.0.0';
  /** Omitted permissions are denied. */
  policy?: Partial<Record<Permission, boolean>>;
  /** Capabilities not in this allow-list are advertised as unsupported. Defaults to all known capabilities. */
  allowedCapabilities?: readonly Capability[];
  /** Capabilities with unavailable required drivers are advertised as unsupported. */
  availableDrivers?: readonly string[];
  /** Encoded catalog size limit; defaults to 1 MiB, maximum 8 MiB. */
  maxBytes?: number;
}
export declare function createGenerationCatalog(registry: Pick<Registry, 'listEngines'>, options?: GenerationCatalogOptions): GenerationCatalogResult;

export interface GenerationSchemaOptions { /** Defaults to 256 KiB; maximum 1 MiB. */ maxBytes?: number }
export type GenerationSchemaResult =
  | { readonly valid: true; readonly schema: Readonly<Record<string, JsonValue>>; readonly bytes: number }
  | { readonly valid: false; readonly code: CatalogErrorCode };
export declare function getGenerationSchema(
  catalog: Frozen<GenerationCatalog>,
  schemaId: string,
  resolveTrustedSchema: (schemaId: string) => unknown,
  options?: GenerationSchemaOptions
): GenerationSchemaResult;
