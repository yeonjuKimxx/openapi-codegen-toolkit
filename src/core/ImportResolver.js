#!/usr/bin/env node

/**
 * 📦 ImportResolver - Import 경로 해결 유틸리티
 *
 * 모든 import 경로를 config 기반으로 동적으로 생성합니다.
 * TypeScript/JavaScript import문에 사용될 경로를 관리합니다.
 *
 * @description
 * - 내부 모듈 import 경로 (프로젝트 내부)
 * - 외부 패키지 import 경로 (node_modules)
 * - 상대 경로와 절대 경로(alias) 모두 지원
 * - 서버별, 태그별 동적 경로 생성
 */

import { dirname, relative } from 'path'

/**
 * ImportResolver 클래스
 *
 * @class
 * @description 설정 기반 import 경로 해결 시스템
 */
export class ImportResolver {
	/**
	 * @param {Object} config - openapi-codegen.config.json의 전체 설정 객체
	 * @param {PathResolver} pathResolver - PathResolver 인스턴스 (선택사항)
	 */
	constructor(config, pathResolver = null) {
		this.config = config
		this.pathResolver = pathResolver
		this.imports = config.imports || {}
		this.internal = this.imports.internal || {}
		this.external = this.imports.external || {}
	}

	// ========================================
	// 1. 경로 패턴 치환 헬퍼
	// ========================================

	/**
	 * import 경로 패턴을 실제 경로로 변환
	 *
	 * @param {string} pattern - 경로 패턴 (예: "@/domains/{serverName}/types/schema")
	 * @param {Object} variables - 치환할 변수들
	 * @returns {string} 치환된 경로
	 * @private
	 */
	_resolvePath(pattern, variables = {}) {
		if (!pattern) return ''

		let resolved = pattern

		Object.entries(variables).forEach(([key, value]) => {
			resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
		})

		return resolved
	}

	// ========================================
	// 2. 내부 모듈 Import 경로 (프로젝트 내부)
	// ========================================

	/**
	 * API Handlers import 경로
	 *
	 * @returns {string} API handlers import 경로
	 * @example
	 * getApiHandlersImport()
	 * // => '@/@shared/api/handlers/apiResponse'
	 */
	getApiHandlersImport() {
		return this.internal.apiHandlers || '@/@shared/api/handlers/apiResponse'
	}

	/**
	 * 서버 Instance import 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} 서버 instance import 경로
	 * @example
	 * getServerInstanceImport('auth')
	 * // => '@/model/openAPI/auth-server/instance'
	 */
	getServerInstanceImport(serverName) {
		const pattern = this.internal.serverInstance || '@/model/openAPI/{serverName}-server/instance'
		return this._resolvePath(pattern, { serverName })
	}

	/**
	 * Schema Types import 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} schema types import 경로
	 * @example
	 * getSchemaTypesImport('auth')
	 * // => '@/domains/auth/types/schema'
	 */
	getSchemaTypesImport(serverName) {
		const pattern = this.internal.schemaTypes || '@/domains/{serverName}/types/schema'
		return this._resolvePath(pattern, { serverName })
	}

	/**
	 * Validated Types import 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} validated types import 경로
	 * @example
	 * getValidatedTypesImport('auth')
	 * // => '@/domains/auth/types/validated'
	 */
	getValidatedTypesImport(serverName) {
		const pattern = this.internal.validatedTypes || '@/domains/{serverName}/types/validated'
		return this._resolvePath(pattern, { serverName })
	}

	/**
	 * Deep Schema Types import 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} deep schema types import 경로
	 * @example
	 * getDeepSchemaImport('auth')
	 * // => '@/domains/auth/types/deepSchema'
	 */
	getDeepSchemaImport(serverName) {
		const pattern = this.internal.deepSchema || '@/domains/{serverName}/types/deepSchema'
		return this._resolvePath(pattern, { serverName })
	}

	/**
	 * Tags import 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} tags import 경로
	 * @example
	 * getTagsImport('auth')
	 * // => '@/domains/auth/types/tags'
	 */
	getTagsImport(serverName) {
		const pattern = this.internal.tags || '@/domains/{serverName}/types/tags'
		return this._resolvePath(pattern, { serverName })
	}

	/**
	 * Endpoint import 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름
	 * @returns {string} endpoint import 경로
	 * @example
	 * getEndpointImport('auth', 'user')
	 * // => '@/domains/auth/api/user/endpoint'
	 */
	getEndpointImport(serverName, tagName) {
		const pattern = this.internal.endpoint || '@/domains/{serverName}/api/{tagName}/endpoint'
		return this._resolvePath(pattern, { serverName, tagName })
	}

	/**
	 * Domain API import 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름
	 * @returns {string} domain API import 경로
	 * @example
	 * getDomainApiImport('auth', 'user')
	 * // => '@/domains/auth/api/user/userAPI'
	 */
	getDomainApiImport(serverName, tagName) {
		const pattern = this.internal.domainApi || '@/domains/{serverName}/api/{tagName}/{tagName}API'
		return this._resolvePath(pattern, { serverName, tagName })
	}

	// ========================================
	// 3. 외부 패키지 Import 경로 (node_modules)
	// ========================================

	/**
	 * React Query import 경로
	 *
	 * @returns {string} React Query 패키지명
	 * @example
	 * getReactQueryImport()
	 * // => '@tanstack/react-query'
	 */
	getReactQueryImport() {
		return this.external.reactQuery || '@tanstack/react-query'
	}

	/**
	 * Toast 라이브러리 import 경로
	 *
	 * @returns {string} Toast 라이브러리 패키지명
	 * @example
	 * getToastImport()
	 * // => 'react-toastify'
	 */
	getToastImport() {
		return this.external.toast || 'react-toastify'
	}

	/**
	 * 커스텀 외부 패키지 import 경로
	 *
	 * @param {string} packageName - 패키지 키 이름
	 * @returns {string|null} import 경로 (없으면 null)
	 * @example
	 * getExternalImport('axios')
	 * // => 'axios' (config.imports.external.axios가 정의된 경우)
	 */
	getExternalImport(packageName) {
		return this.external[packageName] || null
	}

	// ========================================
	// 4. 상대 경로 Import (PathResolver와 통합)
	// ========================================

	/**
	 * from 파일에서 to 파일로의 상대 import 경로 생성
	 *
	 * @param {string} fromFile - 시작 파일의 절대 경로
	 * @param {string} toFile - 목적지 파일의 절대 경로
	 * @returns {string} 상대 import 경로
	 * @example
	 * getRelativeImport(
	 *   '/project/src/api/auth/userAPI.ts',
	 *   '/project/src/domains/auth/types/schema.d.ts'
	 * )
	 * // => '../../../domains/auth/types/schema'
	 */
	getRelativeImport(fromFile, toFile) {
		const fromDir = dirname(fromFile)
		let relativePath = relative(fromDir, toFile)

		// 확장자 제거
		relativePath = relativePath.replace(/\.(ts|js|d\.ts)$/, '')

		// ./ 또는 ../ 로 시작하도록 보장
		if (!relativePath.startsWith('.')) {
			relativePath = './' + relativePath
		}

		return relativePath
	}

	// ========================================
	// 5. Import 문 생성 헬퍼
	// ========================================

	/**
	 * TypeScript import 문 생성
	 *
	 * @param {Array<string>|string} items - import할 항목들
	 * @param {string} path - import 경로
	 * @param {Object} options - 옵션
	 * @param {boolean} options.isDefault - default import 여부
	 * @param {boolean} options.isNamespace - namespace import (* as) 여부
	 * @param {string} options.alias - namespace import 시 별칭
	 * @returns {string} 완성된 import 문
	 *
	 * @example
	 * generateImportStatement(['useState', 'useEffect'], 'react')
	 * // => "import { useState, useEffect } from 'react';"
	 *
	 * generateImportStatement('React', 'react', { isDefault: true })
	 * // => "import React from 'react';"
	 *
	 * generateImportStatement('*', 'fs', { isNamespace: true, alias: 'fs' })
	 * // => "import * as fs from 'fs';"
	 */
	generateImportStatement(items, path, options = {}) {
		const { isDefault = false, isNamespace = false, alias = '' } = options

		// Namespace import
		if (isNamespace) {
			return `import * as ${alias || 'module'} from '${path}';`
		}

		// Default import
		if (isDefault) {
			const defaultName = typeof items === 'string' ? items : items[0]
			return `import ${defaultName} from '${path}';`
		}

		// Named imports
		const itemsArray = Array.isArray(items) ? items : [items]

		if (itemsArray.length === 0) {
			return `// No imports from '${path}'`
		}

		// 한 줄로 표시할지, 여러 줄로 표시할지 결정
		if (itemsArray.length <= 3) {
			// 3개 이하: 한 줄
			return `import { ${itemsArray.join(', ')} } from '${path}';`
		} else {
			// 4개 이상: 여러 줄
			return `import {\n  ${itemsArray.join(',\n  ')}\n} from '${path}';`
		}
	}

	/**
	 * Type-only import 문 생성
	 *
	 * @param {Array<string>|string} types - import할 타입들
	 * @param {string} path - import 경로
	 * @returns {string} type-only import 문
	 *
	 * @example
	 * generateTypeImportStatement(['User', 'Post'], '@/types')
	 * // => "import type { User, Post } from '@/types';"
	 */
	generateTypeImportStatement(types, path) {
		const typesArray = Array.isArray(types) ? types : [types]

		if (typesArray.length === 0) {
			return `// No type imports from '${path}'`
		}

		if (typesArray.length <= 3) {
			return `import type { ${typesArray.join(', ')} } from '${path}';`
		} else {
			return `import type {\n  ${typesArray.join(',\n  ')}\n} from '${path}';`
		}
	}

	// ========================================
	// 6. 생성기별 Import 세트
	// ========================================

	/**
	 * Domain API 파일용 import 문 세트 생성
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {Array<string>} validatedTypes - 사용할 validated 타입들
	 * @returns {Object} import 문들을 포함하는 객체
	 *
	 * @example
	 * getDomainApiImports('auth', ['GetUsers_Params', 'GetUsers_Response'])
	 * // => {
	 * //   apiHandlers: "import { ... } from '@/@shared/api/handlers/apiResponse';",
	 * //   serverInstance: "import { authFetcher } from '@/model/openAPI/auth-server/instance';",
	 * //   validatedTypes: "import {\n  GetUsers_Params,\n  GetUsers_Response\n} from '@/domains/auth/types/validated';"
	 * // }
	 */
	getDomainApiImports(serverName, validatedTypes = []) {
		return {
			apiHandlers: this.generateImportStatement(
				['createQueryParams', 'handleAPIResponse'],
				this.getApiHandlersImport()
			),
			serverInstance: this.generateImportStatement(
				[`${serverName}Fetcher`],
				this.getServerInstanceImport(serverName)
			),
			validatedTypes:
				validatedTypes.length > 0
					? this.generateImportStatement(validatedTypes, this.getValidatedTypesImport(serverName))
					: '// No validated types used',
		}
	}

	/**
	 * React Query Hooks 파일용 import 문 세트 생성
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름
	 * @param {Object} options - 옵션
	 * @param {boolean} options.includeToast - toast import 포함 여부
	 * @returns {Object} import 문들을 포함하는 객체
	 */
	getReactQueryHooksImports(serverName, tagName, options = {}) {
		const { includeToast = true } = options

		const imports = {
			reactQuery: this.generateImportStatement(
				['useQuery', 'useMutation', 'UseQueryResult', 'UseMutationResult'],
				this.getReactQueryImport()
			),
			domainApi: `import * as ${tagName}API from '${this.getDomainApiImport(serverName, tagName)}';`,
			validatedTypes: `import type * as Types from '${this.getValidatedTypesImport(serverName)}';`,
		}

		if (includeToast) {
			imports.toast = this.generateImportStatement(['toast'], this.getToastImport())
		}

		return imports
	}

	/**
	 * Endpoint 파일용 import 문 세트 생성
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {Object} import 문들을 포함하는 객체
	 */
	getEndpointImports(serverName) {
		return {
			tags: this.generateImportStatement(['TAGS'], this.getTagsImport(serverName)),
		}
	}

	// ========================================
	// 7. 전체 Import 세트 생성
	// ========================================

	/**
	 * 특정 파일 타입에 맞는 모든 import 문 생성
	 *
	 * @param {string} fileType - 파일 타입 ('domainApi', 'reactQueryHooks', 'endpoint')
	 * @param {string} serverName - 서버 이름
	 * @param {Object} options - 추가 옵션
	 * @returns {string} 완성된 import 문들 (줄바꿈 포함)
	 *
	 * @example
	 * getAllImports('domainApi', 'auth', { validatedTypes: ['GetUsers_Response'] })
	 * // => "import { ... } from '...';\nimport { ... } from '...';\n..."
	 */
	getAllImports(fileType, serverName, options = {}) {
		let imports = {}

		switch (fileType) {
			case 'domainApi':
				imports = this.getDomainApiImports(serverName, options.validatedTypes || [])
				break

			case 'reactQueryHooks':
				imports = this.getReactQueryHooksImports(serverName, options.tagName, options)
				break

			case 'endpoint':
				imports = this.getEndpointImports(serverName)
				break

			default:
				console.warn(`⚠️  Unknown file type: ${fileType}`)
				return ''
		}

		// 모든 import 문을 줄바꿈으로 결합
		return Object.values(imports).filter(Boolean).join('\n')
	}

	// ========================================
	// 8. 유틸리티 메서드
	// ========================================

	/**
	 * 디버깅용: 모든 import 경로 출력
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름 (선택)
	 */
	printAllImports(serverName, tagName = null) {
		console.log('\n📦 ImportResolver - 생성된 Import 경로:')
		console.log(`📁 Server: ${serverName}${tagName ? ` / Tag: ${tagName}` : ''}`)

		console.log('\n내부 모듈:')
		console.log(`  apiHandlers: ${this.getApiHandlersImport()}`)
		console.log(`  serverInstance: ${this.getServerInstanceImport(serverName)}`)
		console.log(`  schemaTypes: ${this.getSchemaTypesImport(serverName)}`)
		console.log(`  validatedTypes: ${this.getValidatedTypesImport(serverName)}`)

		if (tagName) {
			console.log(`  endpoint: ${this.getEndpointImport(serverName, tagName)}`)
			console.log(`  domainApi: ${this.getDomainApiImport(serverName, tagName)}`)
		}

		console.log('\n외부 패키지:')
		console.log(`  reactQuery: ${this.getReactQueryImport()}`)
		console.log(`  toast: ${this.getToastImport()}`)
	}
}

/**
 * ImportResolver 인스턴스 생성 헬퍼
 *
 * @param {Object} config - 설정 객체
 * @param {PathResolver} pathResolver - PathResolver 인스턴스 (선택)
 * @returns {ImportResolver} ImportResolver 인스턴스
 *
 * @example
 * import { createImportResolver } from './utils/ImportResolver.js'
 * const importResolver = createImportResolver(config)
 */
export function createImportResolver(config, pathResolver = null) {
	return new ImportResolver(config, pathResolver)
}

/**
 * 기본 export
 */
export default ImportResolver
