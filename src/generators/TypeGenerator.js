#!/usr/bin/env node

/**
 * 📝 TypeGenerator - Validated Types 생성기
 *
 * OpenAPI schema.d.ts에서 Params, Body, Response, RO 타입을 생성합니다.
 * generateValidatedTypes.js의 로직을 그대로 클래스화했습니다.
 *
 * @description
 * - Params 타입: path, query, header 등 모든 파라미터
 * - Body 타입: requestBody의 JSON schema
 * - Response 타입: 200번대 응답의 타입
 * - RO (Read-Only) 타입: Response.data 필드의 타입
 */

import { readFileSync } from 'fs'

/**
 * TypeGenerator 클래스
 */
export class TypeGenerator {
	/**
	 * @param {Object} config - 설정 객체
	 * @param {Object} pathResolver - PathResolver 인스턴스
	 * @param {Object} naming - NamingConventions 인스턴스
	 */
	constructor(config, pathResolver, naming) {
		this.config = config
		this.pathResolver = pathResolver
		this.naming = naming
	}

	/**
	 * 서버의 validated 타입 생성
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} 생성된 타입 파일 내용
	 */
	generate(serverName) {
		const schemaPath = this.pathResolver.getSchemaPath(serverName)

		try {
			const schemaContent = readFileSync(schemaPath, 'utf8')
			const generatedTypes = this.processSchema(schemaContent)

			// 파일 헤더 + 타입들
			const fileContent = [
				`import type { components, paths } from './schema';`,
				'',
				...generatedTypes,
			].join('\n')

			return fileContent
		} catch (error) {
			console.error(`❌ ${serverName} 타입 생성 실패:`, error.message)
			throw error
		}
	}

	/**
	 * 스키마 파일 내용을 받아 타입 정의 배열을 생성
	 * (generateValidatedTypes.js의 processSchema 함수 그대로)
	 *
	 * @param {string} schemaContent - schema.d.ts 파일의 전체 내용
	 * @returns {string[]} - 생성된 타입 정의 문자열 배열
	 */
	processSchema(schemaContent) {
		const generatedTypes = []

		// 1. 주요 인터페이스 블록을 텍스트로 추출
		const pathsMatch = schemaContent.match(/export interface paths \{([\s\S]*?)(?=\nexport interface)/)
		const pathsBlock = pathsMatch ? pathsMatch[1] : ''

		const componentsMatch = schemaContent.match(
			/export interface components \{[\s\S]*?schemas: \{([\s\S]*?)(?=\n(?:\t| {4})\}[\s\S]*?\nexport interface)/
		)
		const componentsSchemasBlock = componentsMatch ? componentsMatch[1] : ''

		const operationsMatch = schemaContent.match(/export interface operations \{([\s\S]*?)$/)
		const operationsBlock = operationsMatch ? operationsMatch[1] : ''

		console.log(
			`  📊 추출된 블록 크기: paths(${pathsBlock.length}), schemas(${componentsSchemasBlock.length}), operations(${operationsBlock.length})`
		)

		// 2. paths 블록을 기준으로 엔드포인트 순회 (탭 또는 공백 4개)
		const pathRegex = /['"]([^'"]+)['"]:\s*\{([\s\S]*?)\n(?:\t| {4})\}/g
		let pathMatch
		let pathCount = 0

		while ((pathMatch = pathRegex.exec(pathsBlock)) !== null) {
			const [_, path, pathDetails] = pathMatch
			pathCount++

			// 3. 각 엔드포인트의 CRUD 메서드 순회
			const methodRegex = /(get|post|put|patch|delete)\??:\s*operations\[['"]([^'"]+)['"]\]/g
			let methodMatch
			let methodCount = 0

			while ((methodMatch = methodRegex.exec(pathDetails)) !== null) {
				const [__, method, operationId] = methodMatch
				methodCount++

				console.log(`  🔎 [${method.toUpperCase()}] ${path} (${operationId}) 분석 중...`)
				const controllerName = operationId.split('_')[0]
				generatedTypes.push(`//// ${controllerName}`, `// ${operationId}`)

				// 4. 해당 operationId의 정의 블록 찾기 (탭 또는 공백 4개)
				const operationRegex = new RegExp(`${operationId}:\\s*\\{([\\s\\S]*?)\\n(?:\\t| {4})\\}`, 'm')
				const operationDetailsMatch = operationsBlock.match(operationRegex)
				if (!operationDetailsMatch) continue

				const operationDetails = operationDetailsMatch[1]

				// 5. Params 타입 생성 - 모든 파라미터 타입 동적 감지
				const paramsParts = []
				if (operationDetails.includes('parameters:')) {
					const parametersMatch = operationDetails.match(/parameters:\s*\{([\s\S]*?)\n(?:\t{2}| {8})\}/)
					if (parametersMatch) {
						const parametersBlock = parametersMatch[1]
						const paramTypeRegex = /(\w+)(\??):\s*\{[\s\S]*?\n(?:\t{3}| {12})\}/g
						let paramMatch

						while ((paramMatch = paramTypeRegex.exec(parametersBlock)) !== null) {
							const [fullMatch, paramType, optionalMarker] = paramMatch

							if (!fullMatch.includes('never') && !fullMatch.includes('{}')) {
								const isOptional = optionalMarker === '?'
								const optionalSuffix = isOptional ? '?' : ''
								paramsParts.push(
									`  ${paramType}${optionalSuffix}: paths['${path}']['${method}']['parameters']['${paramType}'];`
								)
							}
						}
					}
				}

				// Params 타입 생성
				if (paramsParts.length > 0) {
					generatedTypes.push(`export type ${operationId}_Params = {`)
					paramsParts.forEach((part) => generatedTypes.push(part))
					generatedTypes.push(`};`)
				}

				// 6. RequestBody 추출
				const requestBodyMatch = operationDetails.match(
					/requestBody:\s*\{[\s\S]*?['"]application\/json['"]:\s*components\[['"]schemas['"]\]\[['"]([^'"]+)['"]\]/
				)
				if (requestBodyMatch) {
					const bodySchemaName = requestBodyMatch[1]
					generatedTypes.push(`export type ${operationId}_Body = components['schemas']['${bodySchemaName}'];`)
				}

				// 7. Response 추출 - 스키마 파일 기반 정확한 타입 매칭
				let responseSchemaMatch = operationDetails.match(
					/responses:\s*\{[\s\S]*?(?:20\d|default):\s*\{[\s\S]*?['"]application\/json['"]:\s*components\[['"]schemas['"]\]\[['"]([^'"]+Response)['"]\]/
				)

				if (responseSchemaMatch) {
					// Response 스키마가 있는 경우
					const responseSchemaName = responseSchemaMatch[1]
					generatedTypes.push(
						`export type ${operationId}_Response = components['schemas']['${responseSchemaName}'];`
					)

					// RO 타입 추출 (Response.data 필드) (탭 또는 공백 8개)
					const schemaDefinitionRegex = new RegExp(
						`${responseSchemaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*\\{([\\s\\S]*?)\\n(?:\\t{2}| {8})\\}`,
						''
					)
					const schemaDefinitionMatch = componentsSchemasBlock.match(schemaDefinitionRegex)

					if (schemaDefinitionMatch) {
						const schemaBody = schemaDefinitionMatch[1]
						const dataFieldMatch = schemaBody.match(
							/data\??:\s*components\[['"]schemas['"]\]\[['"]([^'"]+)['"]\]/
						)

						if (dataFieldMatch) {
							const roSchemaName = dataFieldMatch[1]
							generatedTypes.push(`export type ${operationId}_RO = components['schemas']['${roSchemaName}'];`)
						}
					}
				} else {
					// Response 스키마가 없는 경우: inline response 처리

					// 1. data가 있는 inline response (200번대 또는 default)
					let inlineResponseWithDataMatch = operationDetails.match(
						/responses:\s*\{[\s\S]*?20\d:\s*\{[\s\S]*?['"]application\/json['"]:\s*\{[\s\S]*?data\??\s*:\s*components\[['"]schemas['"]\]\[['"]([^'"]+)['"]\]/
					)

					if (!inlineResponseWithDataMatch) {
						inlineResponseWithDataMatch = operationDetails.match(
							/responses:\s*\{[\s\S]*?default:\s*\{[\s\S]*?['"]application\/json['"]:\s*\{[\s\S]*?data\??\s*:\s*components\[['"]schemas['"]\]\[['"]([^'"]+)['"]\]/
						)
					}

					if (inlineResponseWithDataMatch) {
						const roSchemaName = inlineResponseWithDataMatch[1]
						generatedTypes.push(
							`export type ${operationId}_Response = { code: number; message: string; data?: components['schemas']['${roSchemaName}']; };`
						)
						generatedTypes.push(`export type ${operationId}_RO = components['schemas']['${roSchemaName}'];`)
					} else {
						// 2. data가 없는 inline response
						let inlineResponseWithoutDataMatch = operationDetails.match(
							/responses:\s*\{[\s\S]*?20\d:\s*\{[\s\S]*?['"]application\/json['"]:\s*\{[\s\S]*?code\s*:\s*number/
						)

						if (!inlineResponseWithoutDataMatch) {
							inlineResponseWithoutDataMatch = operationDetails.match(
								/responses:\s*\{[\s\S]*?default:\s*\{[\s\S]*?['"]application\/json['"]:\s*\{[\s\S]*?code\s*:\s*number/
							)
						}

						if (inlineResponseWithoutDataMatch) {
							generatedTypes.push(`export type ${operationId}_Response = { code: number; message: string; };`)
						} else {
							// 3. 204 No Content 응답
							const noContentMatch = operationDetails.match(/responses:\s*\{[\s\S]*?204:/)
							if (noContentMatch) {
								generatedTypes.push(`export type ${operationId}_Response = void;`)
							} else {
								// 4. content가 없는 응답 (content?: never)
								let noContentResponseMatch = operationDetails.match(
									/responses:\s*\{[\s\S]*?20\d:\s*\{[\s\S]*?content\?:\s*never/
								)
								if (!noContentResponseMatch) {
									noContentResponseMatch = operationDetails.match(
										/responses:\s*\{[\s\S]*?default:\s*\{[\s\S]*?content\?:\s*never/
									)
								}

								if (noContentResponseMatch) {
									generatedTypes.push(`export type ${operationId}_Response = void;`)
								} else {
									// 5. 마지막 fallback
									console.warn(`⚠️  ${operationId}: Response 타입을 추출할 수 없어 기본 타입으로 생성합니다.`)
									generatedTypes.push(`export type ${operationId}_Response = any;`)
								}
							}
						}
					}
				}
			}
			generatedTypes.push('')
		}

		if (pathCount % 10 === 0) {
			console.log(`    처리된 path: ${pathCount}`)
		}

		console.log(`  ✅ 총 처리된 paths: ${pathCount}, 생성된 타입: ${generatedTypes.length}`)

		// 중복된 컨트롤러 헤더 제거 및 정리
		const finalTypes = []
		let lastController = ''
		generatedTypes.forEach((line) => {
			if (line.startsWith('////')) {
				if (line !== lastController) {
					finalTypes.push(line)
					lastController = line
				}
			} else {
				finalTypes.push(line)
			}
		})

		return finalTypes
	}
}

/**
 * TypeGenerator 인스턴스 생성 헬퍼
 */
export function createTypeGenerator(config, pathResolver, naming) {
	return new TypeGenerator(config, pathResolver, naming)
}

export default TypeGenerator
