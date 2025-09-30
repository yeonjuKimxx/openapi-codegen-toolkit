#!/usr/bin/env node

/**
 * 🏷️ NamingConventions - 네이밍 규칙 유틸리티
 *
 * 기존 스크립트의 네이밍 로직을 그대로 추출하여 중앙화합니다.
 * - generateDomainAPI.js의 generateFunctionName
 * - generateEndpointsByTags.js의 generateConstantName, tagToIdentifier
 */

/**
 * NamingConventions 클래스
 */
export class NamingConventions {
	/**
	 * @param {Object} config - 설정 객체
	 */
	constructor(config = {}) {
		this.config = config
		this.functionNaming = config?.codeGeneration?.functionNaming || {
			get: 'fetch',
			post: 'create',
			put: 'update',
			patch: 'modify',
			delete: 'remove',
		}
	}

	// ========================================
	// generateDomainAPI.js의 네이밍 로직
	// ========================================

	/**
	 * RESTful 함수명 생성 (generateDomainAPI.js line 219-278)
	 *
	 * @param {string} path - API 경로
	 * @param {string} method - HTTP 메서드
	 * @returns {string} 함수명 (camelCase)
	 *
	 * @example
	 * generateFunctionName('/users/{id}', 'get')
	 * // => 'fetchUsersId'
	 */
	generateFunctionName(path, method) {
		// 1단계: 경로 정리 및 표준화
		const cleanPath = path
			.replace(/\{[^}]+\}/g, 'ID') // {userId} → ID
			.replace(/[^\w]/g, '_') // 특수문자 → _
			.replace(/_+/g, '_') // 연속 _ → _
			.replace(/^_|_$/g, '') // 앞뒤 _ 제거

		// 2단계: 단어 분할
		const parts = cleanPath.toLowerCase().split('_').filter(Boolean)

		// 3단계: camelCase 변환
		const camelCase = parts
			.map((part, index) => {
				if (index === 0) {
					return part
				} else {
					return part.charAt(0).toUpperCase() + part.slice(1)
				}
			})
			.join('')

		// 4단계: HTTP 메서드별 접두사
		const prefix = this.functionNaming[method.toLowerCase()] || method.toLowerCase()

		// 5단계: 최종 함수명 조합
		const capitalizedCamelCase = camelCase.charAt(0).toUpperCase() + camelCase.slice(1)
		return `${prefix}${capitalizedCamelCase}`
	}

	// ========================================
	// generateEndpointsByTags.js의 네이밍 로직
	// ========================================

	/**
	 * 엔드포인트 상수명 생성 (generateEndpointsByTags.js line 55-65)
	 *
	 * @param {string} path - API 경로
	 * @param {string} method - HTTP 메서드
	 * @returns {string} 상수명 (SCREAMING_SNAKE_CASE)
	 *
	 * @example
	 * generateConstantName('/users/{id}', 'get')
	 * // => 'GET_USERS_ID'
	 */
	generateConstantName(path, method) {
		const cleanPath = path
			.replace(/\{[^}]+\}/g, 'ID')
			.replace(/[^\w]/g, '_')
			.replace(/_+/g, '_')
			.replace(/^_|_$/g, '')
			.toUpperCase()

		return `${method.toUpperCase()}_${cleanPath}`
	}

	/**
	 * 태그 식별자 생성 (generateEndpointsByTags.js line 381-387)
	 *
	 * @param {string} tag - 태그 이름
	 * @returns {string} 식별자 (SCREAMING_SNAKE_CASE)
	 *
	 * @example
	 * tagToIdentifier('user-management')
	 * // => 'USER_MANAGEMENT'
	 */
	tagToIdentifier(tag) {
		return tag
			.replace(/[^a-zA-Z0-9]/g, '_') // 특수문자 → _
			.replace(/_+/g, '_') // 연속 _ → _
			.replace(/^_|_$/g, '') // 앞뒤 _ 제거
			.toUpperCase()
	}

	// ========================================
	// 타입명 생성 (generateValidatedTypes.js, generateReactQueryHooks.js에서 사용)
	// ========================================

	/**
	 * Validated 타입명 생성
	 *
	 * @param {string} operationId - operationId
	 * @param {string} suffix - 접미사 (Params, Body, Response, RO 등)
	 * @returns {string} 타입명
	 *
	 * @example
	 * generateValidatedTypeName('getUserById', 'Params')
	 * // => 'getUserById_Params'
	 */
	generateValidatedTypeName(operationId, suffix) {
		return `${operationId}_${suffix}`
	}

	/**
	 * Deep Schema 타입명 생성
	 *
	 * @param {string} schemaName - Schema 이름
	 * @param {string} propertyName - 속성 이름
	 * @returns {string} Deep schema 타입명
	 *
	 * @example
	 * generateDeepSchemaTypeName('User', 'profile')
	 * // => 'Props_User_profile'
	 */
	generateDeepSchemaTypeName(schemaName, propertyName) {
		return `Props_${schemaName}_${propertyName}`
	}

	// ========================================
	// 파일명 생성
	// ========================================

	/**
	 * React Query Hook 파일명 생성
	 *
	 * @param {string} tagName - 태그 이름
	 * @param {string} hookType - Hook 타입 ('Queries' 또는 'Mutations')
	 * @returns {string} 파일명
	 *
	 * @example
	 * generateHookFileName('user', 'Queries')
	 * // => 'useUserQueries.ts'
	 */
	generateHookFileName(tagName, hookType) {
		const capitalizedTag = tagName.charAt(0).toUpperCase() + tagName.slice(1)
		return `use${capitalizedTag}${hookType}.ts`
	}

	// ========================================
	// 경로에서 태그 추출 (extractSwaggerTags.js, generateDomainAPI.js)
	// ========================================

	/**
	 * API 경로에서 태그명 추출 (generateDomainAPI.js line 119-156)
	 *
	 * @param {string} path - API 경로
	 * @returns {string} 태그명
	 *
	 * @example
	 * extractTagFromPath('/users/{id}')
	 * // => 'users'
	 *
	 * extractTagFromPath('/v1/auth/login')
	 * // => 'v1_auth'
	 */
	extractTagFromPath(path) {
		const segments = path.split('/').filter(Boolean)

		if (segments.length === 0) {
			return 'root'
		}

		// 버전 처리 (v1, v2 등)
		if (segments[0].match(/^v\d+$/i) && segments.length > 1) {
			return `${segments[0]}_${segments[1]}`
		}

		return segments[0]
	}
}

/**
 * NamingConventions 인스턴스 생성 헬퍼
 */
export function createNamingConventions(config = {}) {
	return new NamingConventions(config)
}

export default NamingConventions
