#!/usr/bin/env node

/**
 * 📖 SchemaParser - OpenAPI Schema 파싱 유틸리티
 *
 * schema.d.ts 파일을 파싱하여 필요한 정보를 추출합니다.
 * 여러 스크립트에서 중복되는 스키마 파싱 로직을 통합합니다.
 *
 * @description
 * - paths 인터페이스에서 API 엔드포인트 추출
 * - HTTP 메서드별 operation 정보 추출
 * - 파라미터, 요청 바디, 응답 타입 추출
 * - operationId 추출 및 매핑
 * - 태그 정보 추출
 */

import { readFileSync, existsSync } from 'fs'

/**
 * SchemaParser 클래스
 *
 * @class
 * @description OpenAPI schema.d.ts 파일 파싱 시스템
 */
export class SchemaParser {
	/**
	 * @param {string} schemaFilePath - schema.d.ts 파일의 절대 경로
	 */
	constructor(schemaFilePath) {
		this.schemaFilePath = schemaFilePath
		this.schemaContent = null
		this.pathsContent = null
	}

	// ========================================
	// 1. 파일 로드
	// ========================================

	/**
	 * Schema 파일 로드
	 *
	 * @returns {boolean} 로드 성공 여부
	 */
	loadSchema() {
		if (!existsSync(this.schemaFilePath)) {
			console.error(`❌ Schema 파일을 찾을 수 없습니다: ${this.schemaFilePath}`)
			return false
		}

		try {
			this.schemaContent = readFileSync(this.schemaFilePath, 'utf-8')
			return true
		} catch (error) {
			console.error(`❌ Schema 파일 읽기 실패: ${error.message}`)
			return false
		}
	}

	/**
	 * Schema 내용 반환
	 *
	 * @returns {string|null} Schema 파일 내용
	 */
	getSchemaContent() {
		if (!this.schemaContent) {
			this.loadSchema()
		}
		return this.schemaContent
	}

	// ========================================
	// 2. Paths 인터페이스 추출
	// ========================================

	/**
	 * paths 인터페이스 전체 내용 추출
	 *
	 * @returns {string|null} paths 인터페이스 내용
	 */
	extractPathsInterface() {
		if (!this.schemaContent && !this.loadSchema()) {
			return null
		}

		// paths 인터페이스 추출 (중첩된 중괄호 고려)
		const pathsMatch = this.schemaContent.match(/interface\s+paths\s*\{([\s\S]*?)\n\}(?=\s*(?:interface|export|$))/)

		if (!pathsMatch) {
			console.warn('⚠️  paths 인터페이스를 찾을 수 없습니다.')
			return null
		}

		this.pathsContent = pathsMatch[1]
		return this.pathsContent
	}

	/**
	 * 모든 API 경로 목록 추출
	 *
	 * @returns {Array<string>} API 경로 배열
	 *
	 * @example
	 * extractAllPaths()
	 * // => ['/users', '/users/{id}', '/auth/login', ...]
	 */
	extractAllPaths() {
		const pathsContent = this.pathsContent || this.extractPathsInterface()
		if (!pathsContent) return []

		// "/경로": { 형태의 경로들 추출
		const pathMatches = pathsContent.matchAll(/["']([^"']+)["']\s*:\s*\{/g)
		const paths = []

		for (const match of pathMatches) {
			paths.push(match[1])
		}

		return paths
	}

	// ========================================
	// 3. Operation 정보 추출
	// ========================================

	/**
	 * 특정 경로의 전체 내용 추출
	 *
	 * @param {string} path - API 경로
	 * @returns {string|null} 경로의 전체 정의 내용
	 */
	extractPathDefinition(path) {
		const pathsContent = this.pathsContent || this.extractPathsInterface()
		if (!pathsContent) return null

		// 경로를 정규식에 안전하게 사용하기 위해 이스케이프
		const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

		// 경로 정의 추출 (중첩된 중괄호 처리)
		const regex = new RegExp(`["']${escapedPath}["']\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\}(?=\\s*(?:["']|\\}))`,'')

		const match = pathsContent.match(regex)
		return match ? match[1] : null
	}

	/**
	 * 특정 경로와 메서드의 operation 정보 추출
	 *
	 * @param {string} path - API 경로
	 * @param {string} method - HTTP 메서드 (소문자)
	 * @returns {Object|null} Operation 정보
	 *
	 * @example
	 * extractOperation('/users/{id}', 'get')
	 * // => {
	 * //   method: 'get',
	 * //   operationId: 'getUserById',
	 * //   parameters: '...',
	 * //   requestBody: '...',
	 * //   responses: '...'
	 * // }
	 */
	extractOperation(path, method) {
		const pathDef = this.extractPathDefinition(path)
		if (!pathDef) return null

		const methodLower = method.toLowerCase()

		// 메서드 정의 추출
		const methodRegex = new RegExp(`${methodLower}\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\}(?=\\s*(?:get|post|put|patch|delete|\\}))`, 'i')
		const methodMatch = pathDef.match(methodRegex)

		if (!methodMatch) return null

		const operationContent = methodMatch[1]

		return {
			method: methodLower,
			path: path,
			content: operationContent,
			operationId: this._extractOperationId(operationContent),
			parameters: this._extractParameters(operationContent),
			requestBody: this._extractRequestBody(operationContent),
			responses: this._extractResponses(operationContent),
		}
	}

	/**
	 * 경로의 모든 메서드 추출
	 *
	 * @param {string} path - API 경로
	 * @returns {Array<Object>} Operation 배열
	 */
	extractAllOperations(path) {
		const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']
		const operations = []

		for (const method of methods) {
			const operation = this.extractOperation(path, method)
			if (operation) {
				operations.push(operation)
			}
		}

		return operations
	}

	// ========================================
	// 4. 세부 정보 추출 (private)
	// ========================================

	/**
	 * operationId 추출
	 *
	 * @param {string} operationContent - operation 내용
	 * @returns {string|null} operationId
	 * @private
	 */
	_extractOperationId(operationContent) {
		const match = operationContent.match(/operationId\??\s*:\s*["']([^"']+)["']/)
		return match ? match[1] : null
	}

	/**
	 * Parameters 추출
	 *
	 * @param {string} operationContent - operation 내용
	 * @returns {Object} 파라미터 정보
	 * @private
	 */
	_extractParameters(operationContent) {
		const result = {
			hasParameters: false,
			query: [],
			path: [],
			header: [],
			raw: null,
		}

		// parameters 블록 전체 추출
		const paramsMatch = operationContent.match(/parameters\??\s*:\s*\{([^\}]+)\}/)
		if (!paramsMatch) return result

		result.hasParameters = true
		result.raw = paramsMatch[1]

		// query 파라미터
		const queryMatch = result.raw.match(/query\??\s*:\s*\{([^\}]+)\}/)
		if (queryMatch) {
			result.query = this._parseParameterBlock(queryMatch[1])
		}

		// path 파라미터
		const pathMatch = result.raw.match(/path\??\s*:\s*\{([^\}]+)\}/)
		if (pathMatch) {
			result.path = this._parseParameterBlock(pathMatch[1])
		}

		// header 파라미터
		const headerMatch = result.raw.match(/header\??\s*:\s*\{([^\}]+)\}/)
		if (headerMatch) {
			result.header = this._parseParameterBlock(headerMatch[1])
		}

		return result
	}

	/**
	 * 파라미터 블록 파싱
	 *
	 * @param {string} block - 파라미터 블록 내용
	 * @returns {Array<Object>} 파싱된 파라미터 배열
	 * @private
	 */
	_parseParameterBlock(block) {
		const params = []
		const paramRegex = /(\w+)\??\s*:\s*([^;,]+)/g
		let match

		while ((match = paramRegex.exec(block)) !== null) {
			params.push({
				name: match[1],
				type: match[2].trim(),
				optional: block.includes(`${match[1]}?`),
			})
		}

		return params
	}

	/**
	 * Request Body 추출
	 *
	 * @param {string} operationContent - operation 내용
	 * @returns {Object} Request body 정보
	 * @private
	 */
	_extractRequestBody(operationContent) {
		const result = {
			hasBody: false,
			contentType: null,
			schema: null,
			raw: null,
		}

		// requestBody 블록 추출
		const bodyMatch = operationContent.match(/requestBody\??\s*:\s*\{[\s\S]*?content\s*:\s*\{[\s\S]*?\}[\s\S]*?\}/)
		if (!bodyMatch) return result

		result.hasBody = true
		result.raw = bodyMatch[0]

		// content-type 추출 (application/json 등)
		const contentTypeMatch = result.raw.match(/["']([^"']*application\/[^"']+)["']\s*:/)
		if (contentTypeMatch) {
			result.contentType = contentTypeMatch[1]
		}

		// schema 참조 추출
		const schemaMatch = result.raw.match(/components\[["']schemas["']\]\[["']([^"']+)["']\]/)
		if (schemaMatch) {
			result.schema = schemaMatch[1]
		}

		return result
	}

	/**
	 * Responses 추출
	 *
	 * @param {string} operationContent - operation 내용
	 * @returns {Object} Response 정보
	 * @private
	 */
	_extractResponses(operationContent) {
		const result = {
			hasResponses: false,
			statusCodes: [],
			schemas: {},
			raw: null,
		}

		// responses 블록 추출
		const responsesMatch = operationContent.match(/responses\s*:\s*\{([\s\S]*)\}(?=\s*$)/)
		if (!responsesMatch) return result

		result.hasResponses = true
		result.raw = responsesMatch[1]

		// 각 상태 코드별 응답 추출
		const statusRegex = /(20\d|default)\s*:\s*\{/g
		let match

		while ((match = statusRegex.exec(result.raw)) !== null) {
			const statusCode = match[1]
			result.statusCodes.push(statusCode)

			// 해당 상태 코드의 schema 찾기
			const statusBlock = this._extractStatusCodeBlock(result.raw, statusCode)
			if (statusBlock) {
				const schemaMatch = statusBlock.match(/components\[["']schemas["']\]\[["']([^"']+)["']\]/)
				if (schemaMatch) {
					result.schemas[statusCode] = schemaMatch[1]
				}

				// inline response 체크
				if (statusBlock.includes('code') && statusBlock.includes('message')) {
					result.schemas[statusCode] = result.schemas[statusCode] || 'inline'
				}

				// void 응답 체크
				if (statusBlock.includes('content?: never') || statusCode === '204') {
					result.schemas[statusCode] = 'void'
				}
			}
		}

		return result
	}

	/**
	 * 특정 상태 코드의 블록 추출
	 *
	 * @param {string} responsesContent - responses 블록 내용
	 * @param {string} statusCode - 상태 코드
	 * @returns {string|null} 상태 코드 블록
	 * @private
	 */
	_extractStatusCodeBlock(responsesContent, statusCode) {
		const regex = new RegExp(`${statusCode}\\s*:\\s*\\{([\\s\\S]*?)\\}(?=\\s*(?:20\\d|default|\\}))`)
		const match = responsesContent.match(regex)
		return match ? match[1] : null
	}

	// ========================================
	// 5. 고급 추출 기능
	// ========================================

	/**
	 * operationId를 경로#메서드 형태로 매핑
	 *
	 * @returns {Object} { "경로#메서드": "operationId" } 매핑
	 *
	 * @example
	 * extractOperationIdMapping()
	 * // => {
	 * //   "/users#GET": "getUsers",
	 * //   "/users/{id}#GET": "getUserById",
	 * //   "/users#POST": "createUser"
	 * // }
	 */
	extractOperationIdMapping() {
		const paths = this.extractAllPaths()
		const mapping = {}

		for (const path of paths) {
			const operations = this.extractAllOperations(path)
			for (const op of operations) {
				if (op.operationId) {
					const key = `${path}#${op.method.toUpperCase()}`
					mapping[key] = op.operationId
				}
			}
		}

		return mapping
	}

	/**
	 * 모든 operation 정보를 배열로 반환
	 *
	 * @returns {Array<Object>} 모든 operation 배열
	 */
	extractAllOperationsFlat() {
		const paths = this.extractAllPaths()
		const allOperations = []

		for (const path of paths) {
			const operations = this.extractAllOperations(path)
			allOperations.push(...operations)
		}

		return allOperations
	}

	/**
	 * 태그별로 operation 그룹화
	 *
	 * @returns {Object} { tagName: [operations] } 형태
	 */
	extractOperationsByTag() {
		const allOps = this.extractAllOperationsFlat()
		const byTag = {}

		for (const op of allOps) {
			// 경로에서 태그 추출 (첫 번째 세그먼트)
			const tag = this._extractTagFromPath(op.path)

			if (!byTag[tag]) {
				byTag[tag] = []
			}

			byTag[tag].push(op)
		}

		return byTag
	}

	/**
	 * 경로에서 태그 추출
	 *
	 * @param {string} path - API 경로
	 * @returns {string} 태그명
	 * @private
	 */
	_extractTagFromPath(path) {
		const segments = path.split('/').filter(Boolean)

		if (segments.length === 0) return 'root'

		// 버전 처리 (v1, v2 등)
		if (segments[0].match(/^v\d+$/i) && segments.length > 1) {
			return `${segments[0]}_${segments[1]}`
		}

		return segments[0]
	}

	// ========================================
	// 6. 유틸리티 메서드
	// ========================================

	/**
	 * Schema 파일이 유효한지 확인
	 *
	 * @returns {boolean} 유효성 여부
	 */
	isValid() {
		if (!this.schemaContent && !this.loadSchema()) {
			return false
		}

		// paths 인터페이스가 있는지 확인
		const hasPathsInterface = this.schemaContent.includes('interface paths')

		// components가 있는지 확인
		const hasComponents = this.schemaContent.includes('components')

		return hasPathsInterface && hasComponents
	}

	/**
	 * 디버깅용: 파싱 결과 요약 출력
	 */
	printSummary() {
		console.log('\n📖 SchemaParser - 파싱 결과 요약:')
		console.log(`📁 파일: ${this.schemaFilePath}`)

		if (!this.isValid()) {
			console.log('❌ 유효하지 않은 schema 파일입니다.')
			return
		}

		const paths = this.extractAllPaths()
		const allOps = this.extractAllOperationsFlat()
		const byTag = this.extractOperationsByTag()

		console.log(`\n📊 통계:`)
		console.log(`  - 총 경로 수: ${paths.length}`)
		console.log(`  - 총 operation 수: ${allOps.length}`)
		console.log(`  - 태그 수: ${Object.keys(byTag).length}`)

		console.log(`\n🏷️  태그별 operation 수:`)
		for (const [tag, ops] of Object.entries(byTag)) {
			console.log(`  - ${tag}: ${ops.length}개`)
		}
	}
}

/**
 * SchemaParser 인스턴스 생성 헬퍼
 *
 * @param {string} schemaFilePath - schema.d.ts 파일 경로
 * @returns {SchemaParser} SchemaParser 인스턴스
 *
 * @example
 * import { createSchemaParser } from './utils/SchemaParser.js'
 * const parser = createSchemaParser('/path/to/schema.d.ts')
 * const paths = parser.extractAllPaths()
 */
export function createSchemaParser(schemaFilePath) {
	return new SchemaParser(schemaFilePath)
}

/**
 * 빠른 사용을 위한 헬퍼 함수들
 */

/**
 * Schema 파일에서 모든 경로 추출
 *
 * @param {string} schemaFilePath - schema.d.ts 파일 경로
 * @returns {Array<string>} 경로 배열
 */
export function extractPaths(schemaFilePath) {
	const parser = new SchemaParser(schemaFilePath)
	return parser.extractAllPaths()
}

/**
 * Schema 파일에서 operationId 매핑 추출
 *
 * @param {string} schemaFilePath - schema.d.ts 파일 경로
 * @returns {Object} operationId 매핑
 */
export function extractOperationIds(schemaFilePath) {
	const parser = new SchemaParser(schemaFilePath)
	return parser.extractOperationIdMapping()
}

/**
 * 기본 export
 */
export default SchemaParser
