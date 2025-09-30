#!/usr/bin/env node

/**
 * 🗂️ PathResolver - 경로 해결 유틸리티
 *
 * 모든 파일 경로를 config 기반으로 동적으로 해결합니다.
 * 하드코딩된 경로를 제거하고, 설정 파일만으로 경로를 관리합니다.
 *
 * @description
 * - 프로젝트 루트 경로를 config에서 받아 처리
 * - 모든 경로 패턴을 동적으로 치환
 * - 서버별, 태그별 경로 생성
 * - 절대 경로와 상대 경로 모두 지원
 */

import { join, relative, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

/**
 * PathResolver 클래스
 *
 * @class
 * @description 설정 기반 경로 해결 시스템
 */
export class PathResolver {
	/**
	 * @param {Object} config - api-generator.config.json의 전체 설정 객체
	 * @param {string} projectRoot - 프로젝트 루트 경로 (기본: process.cwd())
	 */
	constructor(config, projectRoot = process.cwd()) {
		this.config = config
		this.projectRoot = projectRoot
		this.fileGeneration = config.fileGeneration || {}
		this.imports = config.imports || {}
	}

	// ========================================
	// 1. 기본 경로 해결 메서드
	// ========================================

	/**
	 * 경로 패턴을 실제 경로로 변환
	 *
	 * @param {string} pattern - 패턴 문자열 (예: "src/domains/{serverName}/types")
	 * @param {Object} variables - 치환할 변수들 (예: { serverName: 'auth', tagName: 'user' })
	 * @returns {string} 변환된 경로
	 *
	 * @example
	 * resolvePath('src/domains/{serverName}/types', { serverName: 'auth' })
	 * // => 'src/domains/auth/types'
	 */
	resolvePath(pattern, variables = {}) {
		if (!pattern) return ''

		let resolved = pattern

		// 모든 변수를 치환
		Object.entries(variables).forEach(([key, value]) => {
			resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
		})

		return resolved
	}

	/**
	 * 절대 경로로 변환
	 *
	 * @param {string} relativePath - 상대 경로
	 * @returns {string} 절대 경로
	 */
	toAbsolutePath(relativePath) {
		if (!relativePath) return this.projectRoot
		return join(this.projectRoot, relativePath)
	}

	/**
	 * 상대 경로로 변환
	 *
	 * @param {string} absolutePath - 절대 경로
	 * @returns {string} projectRoot 기준 상대 경로
	 */
	toRelativePath(absolutePath) {
		return relative(this.projectRoot, absolutePath)
	}

	// ========================================
	// 2. 서버 인스턴스 경로
	// ========================================

	/**
	 * 서버 인스턴스 디렉토리 경로
	 *
	 * @returns {string} 서버 인스턴스 디렉토리의 절대 경로
	 * @example
	 * getServerInstancesDir()
	 * // => '/Users/.../event-stepin-ai/src/model/openAPI'
	 */
	getServerInstancesDir() {
		const pattern = this.fileGeneration.serverInstances || 'src/api/servers'
		return this.toAbsolutePath(pattern)
	}

	/**
	 * 특정 서버의 instance.ts 파일 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} instance.ts 파일의 절대 경로
	 * @example
	 * getServerInstancePath('auth')
	 * // => '/Users/.../event-stepin-ai/src/model/openAPI/auth-server/instance.ts'
	 */
	getServerInstancePath(serverName) {
		const baseDir = this.getServerInstancesDir()
		const pattern = this.fileGeneration.serverInstancePattern || '{serverName}/instance.ts'
		const resolved = this.resolvePath(pattern, { serverName })
		return join(baseDir, resolved)
	}

	// ========================================
	// 3. 도메인 타입 경로
	// ========================================

	/**
	 * 도메인 타입 디렉토리 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} 타입 디렉토리의 절대 경로
	 * @example
	 * getDomainTypesDir('auth')
	 * // => '/Users/.../event-stepin-ai/src/domains/auth/types'
	 */
	getDomainTypesDir(serverName) {
		const pattern = this.fileGeneration.domainTypes || 'src/types/{serverName}'
		const resolved = this.resolvePath(pattern, { serverName })
		return this.toAbsolutePath(resolved)
	}

	/**
	 * schema.d.ts 파일 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} schema.d.ts 파일의 절대 경로
	 */
	getSchemaPath(serverName) {
		const typesDir = this.getDomainTypesDir(serverName)
		const filename = this.fileGeneration.files?.schema || 'schema.d.ts'
		return join(typesDir, filename)
	}

	/**
	 * validated.ts 파일 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} validated.ts 파일의 절대 경로
	 */
	getValidatedTypesPath(serverName) {
		const typesDir = this.getDomainTypesDir(serverName)
		const filename = this.fileGeneration.files?.validated || 'validated.ts'
		return join(typesDir, filename)
	}

	/**
	 * deepSchema.ts 파일 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} deepSchema.ts 파일의 절대 경로
	 */
	getDeepSchemaPath(serverName) {
		const typesDir = this.getDomainTypesDir(serverName)
		const filename = this.fileGeneration.files?.deepSchema || 'deepSchema.ts'
		return join(typesDir, filename)
	}

	/**
	 * tags.ts 파일 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} tags.ts 파일의 절대 경로
	 */
	getTagsPath(serverName) {
		const typesDir = this.getDomainTypesDir(serverName)
		return join(typesDir, 'tags.ts')
	}

	// ========================================
	// 4. API 엔드포인트 경로
	// ========================================

	/**
	 * API 엔드포인트 디렉토리 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} API 디렉토리의 절대 경로
	 * @example
	 * getApiEndpointsDir('auth')
	 * // => '/Users/.../event-stepin-ai/src/domains/auth/api'
	 */
	getApiEndpointsDir(serverName) {
		const pattern = this.fileGeneration.apiEndpoints || 'src/api/{serverName}'
		const resolved = this.resolvePath(pattern, { serverName })
		return this.toAbsolutePath(resolved)
	}

	/**
	 * 태그별 엔드포인트 디렉토리 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름
	 * @returns {string} 태그별 API 디렉토리의 절대 경로
	 * @example
	 * getTagApiDir('auth', 'user')
	 * // => '/Users/.../event-stepin-ai/src/domains/auth/api/user'
	 */
	getTagApiDir(serverName, tagName) {
		const apiDir = this.getApiEndpointsDir(serverName)
		return join(apiDir, tagName)
	}

	/**
	 * endpoint.ts 파일 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름
	 * @returns {string} endpoint.ts 파일의 절대 경로
	 */
	getEndpointPath(serverName, tagName) {
		const tagDir = this.getTagApiDir(serverName, tagName)
		const filename = this.fileGeneration.files?.endpoint || 'endpoint.ts'
		return join(tagDir, filename)
	}

	/**
	 * 도메인 API 파일 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름
	 * @returns {string} {tagName}API.ts 파일의 절대 경로
	 * @example
	 * getDomainApiPath('auth', 'user')
	 * // => '/Users/.../event-stepin-ai/src/domains/auth/api/user/userAPI.ts'
	 */
	getDomainApiPath(serverName, tagName) {
		const tagDir = this.getTagApiDir(serverName, tagName)
		const filenamePattern = this.fileGeneration.files?.domainApi || '{tagName}API.ts'
		const filename = this.resolvePath(filenamePattern, { tagName })
		return join(tagDir, filename)
	}

	/**
	 * React Query Queries 파일 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름
	 * @returns {string} use{Tag}Queries.ts 파일의 절대 경로
	 */
	getReactQueryQueriesPath(serverName, tagName) {
		const tagDir = this.getTagApiDir(serverName, tagName)
		const capitalizedTag = this.capitalize(tagName)
		return join(tagDir, `use${capitalizedTag}Queries.ts`)
	}

	/**
	 * React Query Mutations 파일 경로
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름
	 * @returns {string} use{Tag}Mutations.ts 파일의 절대 경로
	 */
	getReactQueryMutationsPath(serverName, tagName) {
		const tagDir = this.getTagApiDir(serverName, tagName)
		const capitalizedTag = this.capitalize(tagName)
		return join(tagDir, `use${capitalizedTag}Mutations.ts`)
	}

	// ========================================
	// 5. 상대 경로 계산 (import문 생성용)
	// ========================================

	/**
	 * from 파일에서 to 파일로의 상대 경로 계산
	 *
	 * @param {string} fromFile - 시작 파일의 절대 경로
	 * @param {string} toFile - 목적지 파일의 절대 경로
	 * @returns {string} import에 사용할 상대 경로 (확장자 제거, ./ 또는 ../ 시작)
	 *
	 * @example
	 * getRelativeImportPath(
	 *   '/project/src/api/auth/user/userAPI.ts',
	 *   '/project/src/domains/auth/types/schema.d.ts'
	 * )
	 * // => '../../../domains/auth/types/schema'
	 */
	getRelativeImportPath(fromFile, toFile) {
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
	// 6. 설정 파일 경로
	// ========================================

	/**
	 * API generator 설정 파일 경로
	 *
	 * @returns {string} 설정 파일의 절대 경로
	 */
	getConfigPath() {
		return join(this.projectRoot, 'scripts/api/api-generator.config.json')
	}

	/**
	 * .env 파일 경로
	 *
	 * @returns {string} .env 파일의 절대 경로
	 */
	getEnvPath() {
		return join(this.projectRoot, '.env')
	}

	// ========================================
	// 7. 유틸리티 메서드
	// ========================================

	/**
	 * 문자열을 PascalCase로 변환
	 *
	 * @param {string} str - 변환할 문자열
	 * @returns {string} PascalCase 문자열
	 * @private
	 */
	capitalize(str) {
		if (!str) return ''
		return str.charAt(0).toUpperCase() + str.slice(1)
	}

	/**
	 * 디렉토리 경로 생성용 헬퍼
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름 (선택)
	 * @returns {Object} 모든 관련 경로를 포함하는 객체
	 *
	 * @example
	 * getAllPaths('auth', 'user')
	 * // => {
	 * //   typesDir: '...',
	 * //   schemaPath: '...',
	 * //   apiDir: '...',
	 * //   domainApiPath: '...',
	 * //   ...
	 * // }
	 */
	getAllPaths(serverName, tagName = null) {
		const paths = {
			// Server instance
			serverInstancesDir: this.getServerInstancesDir(),
			serverInstancePath: this.getServerInstancePath(serverName),

			// Types
			typesDir: this.getDomainTypesDir(serverName),
			schemaPath: this.getSchemaPath(serverName),
			validatedPath: this.getValidatedTypesPath(serverName),
			deepSchemaPath: this.getDeepSchemaPath(serverName),
			tagsPath: this.getTagsPath(serverName),

			// API
			apiDir: this.getApiEndpointsDir(serverName),
		}

		// 태그별 경로 추가
		if (tagName) {
			paths.tagApiDir = this.getTagApiDir(serverName, tagName)
			paths.endpointPath = this.getEndpointPath(serverName, tagName)
			paths.domainApiPath = this.getDomainApiPath(serverName, tagName)
			paths.queriesPath = this.getReactQueryQueriesPath(serverName, tagName)
			paths.mutationsPath = this.getReactQueryMutationsPath(serverName, tagName)
		}

		return paths
	}

	/**
	 * 경로가 존재하는지 확인하는 헬퍼
	 *
	 * @param {string} path - 확인할 경로
	 * @returns {boolean} 경로 존재 여부
	 */
	exists(path) {
		return existsSync(path)
	}

	/**
	 * 디버깅용: 모든 경로 출력
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름 (선택)
	 */
	printAllPaths(serverName, tagName = null) {
		const paths = this.getAllPaths(serverName, tagName)

		console.log('\n🗂️  PathResolver - 생성된 경로:')
		console.log(`📁 Server: ${serverName}${tagName ? ` / Tag: ${tagName}` : ''}`)
		console.log('\n경로 목록:')

		Object.entries(paths).forEach(([key, value]) => {
			const relativePath = this.toRelativePath(value)
			console.log(`  ${key}: ${relativePath}`)
		})
	}
}

/**
 * PathResolver 인스턴스 생성 헬퍼
 *
 * @param {Object} config - 설정 객체
 * @param {string} projectRoot - 프로젝트 루트 경로
 * @returns {PathResolver} PathResolver 인스턴스
 *
 * @example
 * import { createPathResolver } from './utils/PathResolver.js'
 * const pathResolver = createPathResolver(config)
 */
export function createPathResolver(config, projectRoot = process.cwd()) {
	return new PathResolver(config, projectRoot)
}

/**
 * 기본 export
 */
export default PathResolver
