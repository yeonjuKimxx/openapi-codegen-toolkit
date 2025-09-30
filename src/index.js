#!/usr/bin/env node

/**
 * @stepin/openapi-codegen
 *
 * OpenAPI 기반 TypeScript 코드 자동 생성 도구
 *
 * @module @stepin/openapi-codegen
 */

// ========================================
// Core
// ========================================
export { ConfigManager, createConfigManager, loadConfig } from './core/ConfigManager.js'
export { PathResolver, createPathResolver } from './core/PathResolver.js'
export { ImportResolver, createImportResolver } from './core/ImportResolver.js'
export { Generator, createGenerator } from './core/Generator.js'

// ========================================
// Parsers
// ========================================
export { SchemaParser, createSchemaParser, extractPaths, extractOperationIds } from './parsers/SchemaParser.js'

// ========================================
// Generators
// ========================================
export { TypeGenerator, createTypeGenerator } from './generators/TypeGenerator.js'
export { DomainAPIGenerator, createDomainAPIGenerator } from './generators/DomainAPIGenerator.js'
export { ReactQueryGenerator, createReactQueryGenerator } from './generators/ReactQueryGenerator.js'
export { TagsGenerator, createTagsGenerator } from './generators/TagsGenerator.js'
export { EndpointGenerator, createEndpointGenerator } from './generators/EndpointGenerator.js'
export { DeepSchemaGenerator, createDeepSchemaGenerator } from './generators/DeepSchemaGenerator.js'

// ========================================
// Utils
// ========================================
export { NamingConventions, createNamingConventions } from './utils/NamingConventions.js'
export { default as Logger } from './utils/Logger.js'

// ========================================
// Default Export
// ========================================
export default {
	// Core
	ConfigManager,
	createConfigManager,
	loadConfig,
	PathResolver,
	createPathResolver,
	ImportResolver,
	createImportResolver,
	Generator,
	createGenerator,

	// Parsers
	SchemaParser,
	createSchemaParser,
	extractPaths,
	extractOperationIds,

	// Generators
	TypeGenerator,
	createTypeGenerator,
	DomainAPIGenerator,
	createDomainAPIGenerator,
	ReactQueryGenerator,
	createReactQueryGenerator,

	// Utils
	NamingConventions,
	createNamingConventions,
}
