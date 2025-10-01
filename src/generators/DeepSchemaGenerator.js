#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import logger from '../utils/Logger.js'

/**
 * 스키마에서 모든 프로퍼티와 타입을 재귀적으로 추출하는 고도화된 스크립트
 * 사용법: node scripts/api/extractDeepSchemaTypes.js <스키마명> [도메인] [출력파일경로]
 */

class DeepSchemaTypeExtractor {
	constructor(domain = 'content') {
		this.domain = domain
		this.schemaFilePath = `src/domains/${domain}/types/schema.d.ts`
		this.extractedSchemas = new Set() // 이미 추출된 스키마 추적
		this.allSchemas = new Map() // 전체 스키마 저장
		this.processedTypes = new Set() // 처리된 타입들 추적
	}

	/**
	 * 스키마 파일 전체를 파싱해서 모든 스키마를 추출
	 * generateValidatedTypes.cjs의 검증된 로직을 사용
	 */
	parseAllSchemas(schemaContent) {
		// validated 스크립트와 동일한 패턴 사용
		const componentsMatch = schemaContent.match(
			/export interface components \{[\s\S]*?schemas: \{([\s\S]*?)(?=\n\t\}[\s\S]*?\nexport interface)/
		)
		if (!componentsMatch) {
			// 대안 패턴 시도 (파일 끝까지)
			const altMatch = schemaContent.match(/export interface components \{[\s\S]*?schemas: \{([\s\S]*?)$/)
			if (!altMatch) {
				throw new Error('schemas 섹션을 찾을 수 없습니다.')
			}
			this.extractSchemasWithValidatedLogic(altMatch[1])
		} else {
			this.extractSchemasWithValidatedLogic(componentsMatch[1])
		}

		logger.info(`총 ${this.allSchemas.size}개의 스키마를 발견했습니다.`)
	}

	/**
	 * validated 스크립트의 검증된 로직을 사용한 스키마 추출
	 * 개선된 중괄호 매칭으로 정확한 스키마 경계 찾기
	 */
	extractSchemasWithValidatedLogic(componentsSchemasBlock) {
		const schemaNames = []
		const schemaDefinitions = new Map()

		// 스키마명: { 패턴으로 시작점 찾기
		const schemaStartRegex = /(\w+):\s*\{/g
		let match
		const startPositions = []

		while ((match = schemaStartRegex.exec(componentsSchemasBlock)) !== null) {
			const schemaName = match[1]
			const startPos = match.index + match[0].length - 1 // { 위치
			startPositions.push({
				name: schemaName,
				start: startPos,
				fullMatch: match[0],
			})
			schemaNames.push(schemaName)
		}

		logger.debug(`발견된 스키마 이름들: ${schemaNames.join(', ')}`)

		// 각 스키마의 정확한 끝 위치를 중괄호 매칭으로 찾기
		for (let i = 0; i < startPositions.length; i++) {
			const current = startPositions[i]
			const schemaName = current.name

			try {
				// 중괄호 카운터로 정확한 끝 위치 찾기
				let braceCount = 1
				let pos = current.start + 1 // { 다음부터 시작
				let inString = false
				let inComment = false
				let escapeNext = false

				while (pos < componentsSchemasBlock.length && braceCount > 0) {
					const char = componentsSchemasBlock[pos]
					const prevChar = pos > 0 ? componentsSchemasBlock[pos - 1] : ''
					const nextChar = pos < componentsSchemasBlock.length - 1 ? componentsSchemasBlock[pos + 1] : ''

					// 문자열 내부 처리
					if (!inComment) {
						if (escapeNext) {
							escapeNext = false
						} else if (char === '\\') {
							escapeNext = true
						} else if (char === '"' || char === "'" || char === '`') {
							if (!inString) {
								inString = char
							} else if (inString === char) {
								inString = false
							}
						}
					}

					// 주석 처리
					if (!inString) {
						if (char === '/' && nextChar === '/') {
							inComment = 'line'
							pos++ // // 건너뛰기
						} else if (char === '/' && nextChar === '*') {
							inComment = 'block'
							pos++ // /* 건너뛰기
						} else if (inComment === 'line' && char === '\n') {
							inComment = false
						} else if (inComment === 'block' && char === '*' && nextChar === '/') {
							inComment = false
							pos++ // */ 건너뛰기
						}
					}

					// 중괄호 카운팅 (문자열이나 주석 안이 아닐 때만)
					if (!inString && !inComment) {
						if (char === '{') {
							braceCount++
						} else if (char === '}') {
							braceCount--
						}
					}

					pos++
				}

				if (braceCount === 0) {
					// 정확한 스키마 정의 추출
					const schemaContent = componentsSchemasBlock.substring(current.start + 1, pos - 1)
					this.allSchemas.set(schemaName, schemaContent.trim())
					logger.debug(`${schemaName}: ${schemaContent.trim().length} chars`)
				} else {
					logger.warn(`${schemaName}: 중괄호 매칭 실패`)
				}
			} catch (error) {
				logger.error(`${schemaName}: 추출 오류 - ${error.message}`)
			}
		}
	}

	/**
	 * 스키마에서 주석을 제거하는 함수
	 */
	removeCommentsFromSchema(schemaContent) {
		// /* ... */ 블록 주석 제거
		let cleaned = schemaContent.replace(/\/\*[\s\S]*?\*\//g, '')

		// /** ... */ JSDoc 주석 제거
		cleaned = cleaned.replace(/\/\*\*[\s\S]*?\*\//g, '')

		// // 라인 주석 제거
		cleaned = cleaned.replace(/\/\/.*$/gm, '')

		// 연속된 공백과 빈 줄 정리
		cleaned = cleaned.replace(/\s+/g, ' ').trim()

		return cleaned
	}

	/**
	 * 스키마 정의에서 모든 프로퍼티를 추출하고 분석 (스마트 필터링 적용)
	 */
	extractAllProperties(schemaDefinition, schemaName) {
		const properties = []
		const nestedSchemas = new Set()

		logger.debug(`${schemaName} 스키마 정의 분석 중...`)
		logger.debug(`스키마 내용: ${schemaDefinition.substring(0, 200)}...`)

		// 주석 제거 후 실제 속성만 추출
		const cleanedSchema = this.removeCommentsFromSchema(schemaDefinition)
		logger.debug(`주석 제거 후: ${cleanedSchema.substring(0, 200)}...`)

		// 속성명과 타입을 매칭하는 정규식 (옵셔널 속성 포함, 주석 제거된 내용에서만)
		const propertyRegex = /(\w+)\??\s*:\s*([^;]+);/g
		let match

		while ((match = propertyRegex.exec(cleanedSchema)) !== null) {
			const [fullMatch, propertyName, typeDefinition] = match
			const cleanType = typeDefinition.trim()
			const isOptional = fullMatch.includes('?:') // 옵셔널 마커 체크

			logger.debug(`발견된 속성: ${propertyName}${isOptional ? '?' : ''} : ${cleanType}`)

			// 스마트 필터링: 의미있는 속성들만 선별
			const shouldExtract = this.isPropertyWorthExtracting(propertyName, cleanType)
			logger.debug(`${shouldExtract ? '✅' : '❌'} ${propertyName} - ${shouldExtract ? '추출함' : '스킵됨'}`)

			if (!shouldExtract) {
				continue
			}

			const propertyInfo = {
				name: propertyName,
				originalType: cleanType,
				isEnum: false,
				isArray: false,
				isOptional: isOptional || cleanType.includes('undefined'), // 개선된 옵셔널 체크
				isNested: false,
				enumValues: [],
				nestedSchemaName: null,
				description: null,
				priority: this.getPropertyPriority(propertyName, cleanType),
			}

			// 주석에서 설명 추출
			const descriptionMatch = schemaDefinition.match(new RegExp(`/\\*\\*[\\s\\S]*?\\*/\\s*${propertyName}\\??:`))
			if (descriptionMatch) {
				const commentBlock = descriptionMatch[0]
				const descMatch = commentBlock.match(/@description\s+([^\n@]*)/)
				if (descMatch) {
					propertyInfo.description = descMatch[1].trim()
				}
			}

			// 배열 타입 체크
			if (cleanType.includes('[]') || cleanType.includes('Array<')) {
				propertyInfo.isArray = true
			}

			// Union 타입 (enum) 체크
			if (cleanType.includes('|') && !cleanType.includes('null') && !cleanType.includes('undefined')) {
				const stringLiterals = cleanType.match(/'[^']*'/g)
				if (stringLiterals && stringLiterals.length > 1) {
					propertyInfo.isEnum = true
					propertyInfo.enumValues = stringLiterals.map((s) => s.replace(/'/g, ''))
				}
			}

			// 중첩된 스키마 참조 체크
			const componentMatch = cleanType.match(/components\['schemas'\]\['(\w+)'\]/)
			if (componentMatch) {
				propertyInfo.isNested = true
				propertyInfo.nestedSchemaName = componentMatch[1]
				nestedSchemas.add(componentMatch[1])
			}

			properties.push(propertyInfo)
		}

		// 우선순위로 정렬
		properties.sort((a, b) => b.priority - a.priority)

		return { properties, nestedSchemas }
	}

	/**
	 * 속성이 추출할 가치가 있는지 판단
	 */
	isPropertyWorthExtracting(propertyName, typeDefinition) {
		// 무의미한 속성들 제외
		const skipPatterns = [
			/^id$/i, // 단순 id
			/^.*Id$/, // ~Id로 끝나는 것들 (대부분 FK)
			/^.*Url$/i, // URL 필드들
			/^.*Count$/i, // Count 필드들
			/^description$/i, // description
			/^content$/i, // content
			/^message$/i, // message
			/^code$/i, // code (응답 코드)
			/^data$/i, // data (wrapper)
			/^format$/i, // format
			/^https$/i, // https
		]

		// 제외 패턴에 매칭되는지 확인
		if (skipPatterns.some((pattern) => pattern.test(propertyName))) {
			// 단, enum이나 union 타입이면 포함
			if (typeDefinition.includes('|') && !typeDefinition.includes('null') && !typeDefinition.includes('undefined')) {
				const stringLiterals = typeDefinition.match(/'[^']*'/g)
				if (stringLiterals && stringLiterals.length > 1) {
					return true // enum이면 포함
				}
			}
			return false
		}

		// 포함할 가치가 있는 패턴들
		const includePatterns = [
			/Type$/i, // ~Type으로 끝나는 것들
			/Status$/i, // ~Status로 끝나는 것들
			/State$/i, // ~State로 끝나는 것들
			/Mode$/i, // ~Mode로 끝나는 것들
		]

		// 포함 패턴에 매칭되거나, enum/union 타입이면 포함
		if (includePatterns.some((pattern) => pattern.test(propertyName))) {
			return true
		}

		// Union 타입 (enum) 체크
		if (typeDefinition.includes('|') && !typeDefinition.includes('null') && !typeDefinition.includes('undefined')) {
			const stringLiterals = typeDefinition.match(/'[^']*'/g)
			if (stringLiterals && stringLiterals.length > 1) {
				return true // enum이면 포함
			}
		}

		// 기본적으로 포함 (나머지 필드들)
		return true
	}

	/**
	 * 속성의 우선순위 계산 (높을수록 먼저 출력)
	 */
	getPropertyPriority(propertyName, typeDefinition) {
		let priority = 0

		// Enum/Union 타입은 최고 우선순위
		if (typeDefinition.includes('|') && !typeDefinition.includes('null') && !typeDefinition.includes('undefined')) {
			const stringLiterals = typeDefinition.match(/'[^']*'/g)
			if (stringLiterals && stringLiterals.length > 1) {
				priority += 100
			}
		}

		// Type, Status, State 등은 높은 우선순위
		if (/Type$/i.test(propertyName)) priority += 50
		if (/Status$/i.test(propertyName)) priority += 50
		if (/State$/i.test(propertyName)) priority += 40
		if (/Mode$/i.test(propertyName)) priority += 30

		// 중첩된 스키마 참조는 중간 우선순위
		if (typeDefinition.includes("components['schemas']")) {
			priority += 20
		}

		return priority
	}

	/**
	 * 중첩된 스키마들을 재귀적으로 처리
	 */
	processNestedSchemas(nestedSchemas, depth = 0) {
		const maxDepth = 5 // 무한 재귀 방지
		if (depth > maxDepth) {
			logger.warn(`최대 깊이(${maxDepth})에 도달했습니다.`)
			return []
		}

		const nestedTypes = []

		for (const schemaName of nestedSchemas) {
			if (this.processedTypes.has(schemaName)) {
				continue // 이미 처리된 타입 스킵
			}

			this.processedTypes.add(schemaName)

			if (this.allSchemas.has(schemaName)) {
				const schemaBody = this.allSchemas.get(schemaName)
				const { properties, nestedSchemas: furtherNested } = this.extractAllProperties(schemaBody, schemaName)

				nestedTypes.push({
					schemaName,
					properties,
					depth,
				})

				// 더 깊은 중첩 처리
				if (furtherNested.size > 0) {
					const deeperTypes = this.processNestedSchemas(furtherNested, depth + 1)
					nestedTypes.push(...deeperTypes)
				}
			}
		}

		return nestedTypes
	}

	/**
	 * TypeScript 타입 정의 생성
	 */
	generateDeepTypeFile(schemaName, mainSchema, nestedTypes) {
		let content = `import type { components } from '@/domains/${this.domain}/types/schema';\n\n`

		// 메인 스키마 타입
		content += `// ==================== ${schemaName} ====================\n`
		content += `export type ${schemaName} = components['schemas']['${schemaName}'];\n\n`

		// 메인 스키마의 프로퍼티들
		if (mainSchema.properties.length > 0) {
			content += `// ${schemaName} Properties\n`

			mainSchema.properties.forEach((prop) => {
				// 동적 타입명 생성 사용
				const propTypeName = this.generateUniqueTypeName(schemaName, prop.name)
				content += `export type ${propTypeName} = ${schemaName}['${prop.name}'];\n`
			})
			content += '\n'
		}

		// 중첩된 스키마들
		const groupedNested = this.groupNestedByDepth(nestedTypes)

		Object.keys(groupedNested)
			.sort()
			.forEach((depth) => {
				const schemas = groupedNested[depth]

				content += `// ==================== Nested Types (Depth ${depth}) ====================\n`

				schemas.forEach((nested) => {
					content += `// ${nested.schemaName}\n`
					content += `export type ${nested.schemaName} = components['schemas']['${nested.schemaName}'];\n`

					// 중첩된 스키마의 프로퍼티들
					nested.properties.forEach((prop) => {
						if (prop.isEnum) {
							const enumTypeName = `${nested.schemaName}_${this.capitalize(prop.name)}`
							content += `export type ${enumTypeName} = ${nested.schemaName}['${prop.name}'];\n`
						}
					})
					content += '\n'
				})
			})

		// 타입 요약 정보
		content += `// ==================== Type Summary ====================\n`
		content += `// Main Schema: ${schemaName}\n`
		content += `// Properties: ${mainSchema.properties.length}\n`
		content += `// Enum Properties: ${mainSchema.properties.filter((p) => p.isEnum).length}\n`
		content += `// Nested Schemas: ${nestedTypes.length}\n`
		content += `// Total Depth: ${Math.max(...nestedTypes.map((n) => n.depth), 0)}\n`

		return content
	}

	/**
	 * 중첩된 타입들을 깊이별로 그룹화
	 */
	groupNestedByDepth(nestedTypes) {
		const grouped = {}
		nestedTypes.forEach((nested) => {
			const depth = nested.depth
			if (!grouped[depth]) {
				grouped[depth] = []
			}
			grouped[depth].push(nested)
		})
		return grouped
	}

	/**
	 * 문자열 첫 글자를 대문자로 변환
	 */
	capitalize(str) {
		return str.charAt(0).toUpperCase() + str.slice(1)
	}

	/**
	 * camelCase를 PascalCase로 동적 변환
	 * tournamentType -> TournamentType
	 * verifyStatus -> VerifyStatus
	 * allowContentSave -> AllowContentSave
	 */
	toPascalCase(str) {
		// camelCase를 PascalCase로 변환
		return str
			.replace(/([a-z])([A-Z])/g, '$1$2')
			.split(/(?=[A-Z])/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join('')
	}

	/**
	 * 속성명을 TypeScript 타입명으로 동적 변환
	 */
	generatePropertyTypeName(propertyName) {
		// 이미 PascalCase인 경우 그대로 반환
		if (/^[A-Z]/.test(propertyName)) {
			return propertyName
		}

		// camelCase를 PascalCase로 변환
		let typeName = this.toPascalCase(propertyName)

		// 특수 케이스 후처리 (동적 규칙 기반)

		// 숫자로 끝나는 속성명 처리 (예: followStatus의 '0' -> 'AccountInfo')
		if (/^\d+$/.test(propertyName)) {
			return 'AccountInfo' // 숫자 속성은 보통 계정 정보를 의미
		}

		// Boolean 속성들의 더 나은 네이밍
		if (
			propertyName.startsWith('is') ||
			propertyName.startsWith('has') ||
			propertyName.startsWith('allow') ||
			propertyName.startsWith('hide')
		) {
			return typeName
		}

		// URL 관련 속성들 정리
		if (propertyName.toLowerCase().includes('url')) {
			return typeName.replace(/Url$/, 'URL')
		}

		// ID 관련 속성들 정리
		if (propertyName.toLowerCase().includes('id')) {
			return typeName.replace(/Id$/, 'ID')
		}

		// Count 관련 속성들
		if (propertyName.toLowerCase().includes('count')) {
			return typeName
		}

		// At으로 끝나는 날짜/시간 속성들
		if (propertyName.endsWith('At')) {
			return typeName
		}

		return typeName
	}

	/**
	 * 스키마명과 속성명을 조합하여 고유한 타입명 생성
	 * 실제 props인 속성들에만 Props_ 접두사 적용
	 */
	generateUniqueTypeName(schemaName, propertyName) {
		const enhancedPropertyName = this.generatePropertyTypeName(propertyName)

		// 모든 속성에 Props_ 접두사 적용 (소문자)
		return `Props_${schemaName}_${enhancedPropertyName}`
	}

	/**
	 * 결과 요약 출력
	 */
	printSummary(schemaName, mainSchema, nestedTypes, outputPath) {
		logger.success('깊이 있는 타입 추출 완료!')
		logger.info(`출력 파일: ${outputPath}`)
		logger.info(`메인 스키마: ${schemaName}`)
		logger.info(`메인 프로퍼티: ${mainSchema.properties.length}개`)
		logger.info(`Enum 프로퍼티: ${mainSchema.properties.filter((p) => p.isEnum).length}개`)
		logger.info(`중첩 스키마: ${nestedTypes.length}개`)
		logger.info(`최대 깊이: ${Math.max(...nestedTypes.map((n) => n.depth), 0)}`)

		if (mainSchema.properties.filter((p) => p.isEnum).length > 0) {
			logger.debug('발견된 Enum 타입들:')
			mainSchema.properties
				.filter((p) => p.isEnum)
				.forEach((prop) => {
					logger.debug(`  - ${this.capitalize(prop.name)}: [${prop.enumValues.join(', ')}]`)
				})
		}

		if (nestedTypes.length > 0) {
			logger.debug('중첩된 스키마들:')
			nestedTypes.forEach((nested) => {
				logger.debug(`  - ${nested.schemaName} (깊이: ${nested.depth}, 프로퍼티: ${nested.properties.length}개)`)
			})
		}
	}

	/**
	 * 메인 실행 함수
	 */
	async extract(schemaName, outputPath = null) {
		try {
			logger.info(`${schemaName} 스키마 깊이 분석 시작...`)

			// 스키마 파일 읽기
			if (!existsSync(this.schemaFilePath)) {
				throw new Error(`스키마 파일을 찾을 수 없습니다: ${this.schemaFilePath}`)
			}

			const schemaContent = readFileSync(this.schemaFilePath, 'utf-8')

			// 모든 스키마 파싱
			this.parseAllSchemas(schemaContent)

			// 메인 스키마 확인
			if (!this.allSchemas.has(schemaName)) {
				throw new Error(`스키마 '${schemaName}'을 찾을 수 없습니다.`)
			}

			// 메인 스키마 분석
			const mainSchemaDefinition = this.allSchemas.get(schemaName)
			const { properties, nestedSchemas } = this.extractAllProperties(mainSchemaDefinition, schemaName)

			const mainSchema = {
				schemaName,
				properties,
				depth: 0,
			}

			// 중첩된 스키마들 재귀적으로 처리
			logger.info(`중첩된 스키마 ${nestedSchemas.size}개 처리 중...`)
			const nestedTypes = this.processNestedSchemas(nestedSchemas)

			// 출력 파일 경로 결정
			if (!outputPath) {
				outputPath = `src/app/[locale]/_/types/${schemaName.toLowerCase()}.ts`
			}

			// 타입 파일 생성
			const typeFileContent = this.generateDeepTypeFile(schemaName, mainSchema, nestedTypes)

			// 디렉토리 생성 (필요한 경우)
			const dir = dirname(outputPath)
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true })
			}

			// 파일 쓰기
			writeFileSync(outputPath, typeFileContent)

			// 결과 요약
			this.printSummary(schemaName, mainSchema, nestedTypes, outputPath)

			logger.debug('생성된 파일 미리보기:')
			logger.debug('─'.repeat(60))
			logger.debug(typeFileContent.substring(0, 1000) + (typeFileContent.length > 1000 ? '...' : ''))
			logger.debug('─'.repeat(60))
		} catch (error) {
			logger.error(`오류 발생: ${error.message}`)
			process.exit(1)
		}
	}
}

/**
 * 배치 처리: 모든 도메인의 모든 스키마를 자동으로 처리하여 deepSchema.ts 파일 생성
 */
async function processBatchMode() {
	const domains = convertToServerList(detectServersFromModel())
	const results = {
		totalDomains: 0,
		totalSchemas: 0,
		processedDomains: 0,
		errors: [],
		summary: [],
	}

	logger.info('배치 모드 시작: 모든 도메인의 통합 deepSchema.ts 파일 생성')
	logger.info('─'.repeat(80))

	for (const domain of domains) {
		logger.info(`도메인 처리 중: ${domain.toUpperCase()}`)

		const schemaFilePath = `src/domains/${domain}/types/schema.d.ts`
		const outputPath = `src/domains/${domain}/types/deepSchema.ts`

		// 스키마 파일 존재 확인
		if (!existsSync(schemaFilePath)) {
			logger.warn(`스키마 파일이 존재하지 않습니다: ${schemaFilePath}`)
			results.errors.push(`${domain}: 스키마 파일 없음`)
			continue
		}

		results.totalDomains++

		try {
			const extractor = new DeepSchemaTypeExtractor(domain)
			const schemaContent = readFileSync(schemaFilePath, 'utf-8')

			// 모든 스키마 파싱
			extractor.parseAllSchemas(schemaContent)
			const schemaNames = Array.from(extractor.allSchemas.keys())

			logger.info(`발견된 스키마: ${schemaNames.length}개`)
			results.totalSchemas += schemaNames.length

			// 도메인의 모든 스키마를 하나의 파일로 통합 생성
			const consolidatedContent = await generateConsolidatedDeepSchemaFile(extractor, schemaNames, domain)

			// 디렉토리 생성 (필요한 경우)
			const dir = dirname(outputPath)
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true })
			}

			// 파일 쓰기
			writeFileSync(outputPath, consolidatedContent)

			results.processedDomains++
			results.summary.push({
				domain,
				schemaCount: schemaNames.length,
				outputPath,
			})

			logger.success(`${domain} 완료: ${schemaNames.length}개 스키마 → ${outputPath}`)
		} catch (error) {
			logger.error(`${domain} 도메인 처리 실패: ${error.message}`)
			results.errors.push(`${domain} 도메인: ${error.message}`)
		}
	}

	// 최종 결과 출력
	logger.info('='.repeat(80))
	logger.info('배치 처리 완료 결과')
	logger.info('='.repeat(80))
	logger.info(`처리된 도메인: ${results.processedDomains}/${results.totalDomains}개`)
	logger.info(`총 스키마: ${results.totalSchemas}개`)
	logger.info(`생성된 파일: ${results.processedDomains}개`)
	logger.info(`실패한 도메인: ${results.errors.length}개`)

	// 도메인별 상세 결과
	if (results.summary.length > 0) {
		logger.info('도메인별 결과:')
		results.summary.forEach((domainResult) => {
			logger.info(`  ${domainResult.domain.toUpperCase()}: ${domainResult.schemaCount}개 스키마`)
			logger.info(`     → ${domainResult.outputPath}`)
		})
	}

	// 오류 상세 정보
	if (results.errors.length > 0) {
		logger.error('발생한 오류들:')
		results.errors.forEach((error) => {
			logger.error(`  - ${error}`)
		})
	}

	logger.success('모든 도메인 처리 완료!')
	logger.info(`생성된 파일들은 각 도메인의 types 디렉토리에서 확인하세요.`)
}

/**
 * 도메인의 모든 스키마를 하나의 통합된 deepSchema.ts 파일로 생성
 */
async function generateConsolidatedDeepSchemaFile(extractor, schemaNames, domain) {
	let content = `import type { components } from './schema';\n\n`
	content += `// ==================== ${domain.toUpperCase()} Domain Deep Schema Types ====================\n`
	content += `// 자동 생성된 파일입니다. 수정하지 마세요.\n`
	content += `// Generated by: scripts/api/extractDeepSchemaTypes.cjs\n\n`

	const allProcessedSchemas = new Map()
	const globalProcessedTypes = new Set()

	// 모든 스키마 처리
	for (const schemaName of schemaNames) {
		logger.debug(`분석 중: ${schemaName}`)

		try {
			// 개별 스키마 분석을 위한 새로운 인스턴스
			const schemaExtractor = new DeepSchemaTypeExtractor(domain)
			schemaExtractor.parseAllSchemas(readFileSync(extractor.schemaFilePath, 'utf-8'))
			schemaExtractor.processedTypes = new Set(globalProcessedTypes)

			const mainSchemaDefinition = schemaExtractor.allSchemas.get(schemaName)
			const { properties, nestedSchemas } = schemaExtractor.extractAllProperties(mainSchemaDefinition, schemaName)

			const mainSchema = {
				schemaName,
				properties,
				depth: 0,
			}

			// 중첩된 스키마들 재귀적으로 처리
			const nestedTypes = schemaExtractor.processNestedSchemas(nestedSchemas)

			// 처리된 타입들을 글로벌 세트에 추가
			globalProcessedTypes.add(schemaName)
			nestedTypes.forEach((nested) => globalProcessedTypes.add(nested.schemaName))

			allProcessedSchemas.set(schemaName, {
				mainSchema,
				nestedTypes,
			})
		} catch (error) {
			logger.warn(`${schemaName} 스키마 처리 중 오류: ${error.message}`)
		}
	}

	// 메인 스키마들 생성
	content += `// ==================== Main Schemas ====================\n`
	for (const [schemaName, data] of allProcessedSchemas) {
		content += `export type ${schemaName} = components['schemas']['${schemaName}'];\n`
	}
	content += '\n'

	// 프로퍼티 타입들 생성 (동적 고유 네이밍 적용)
	content += `// ==================== Property Types ====================\n`
	const generatedPropertyTypes = new Set()

	for (const [schemaName, data] of allProcessedSchemas) {
		const { mainSchema, nestedTypes } = data

		// 메인 스키마 프로퍼티들 - 동적 타입명 생성 사용
		mainSchema.properties.forEach((prop) => {
			const propTypeName = extractor.generateUniqueTypeName(schemaName, prop.name)
			if (!generatedPropertyTypes.has(propTypeName)) {
				content += `export type ${propTypeName} = ${schemaName}['${prop.name}'];\n`
				generatedPropertyTypes.add(propTypeName)
			}
		})

		// 중첩된 스키마의 프로퍼티들 - 동적 타입명 생성 사용
		nestedTypes.forEach((nested) => {
			nested.properties.forEach((prop) => {
				const propTypeName = extractor.generateUniqueTypeName(nested.schemaName, prop.name)
				if (!generatedPropertyTypes.has(propTypeName)) {
					content += `export type ${propTypeName} = ${nested.schemaName}['${prop.name}'];\n`
					generatedPropertyTypes.add(propTypeName)
				}
			})
		})
	}
	content += '\n'

	// 중첩된 스키마들 (중복 제거)
	const uniqueNestedSchemas = new Set()
	for (const [, data] of allProcessedSchemas) {
		data.nestedTypes.forEach((nested) => {
			uniqueNestedSchemas.add(nested.schemaName)
		})
	}

	if (uniqueNestedSchemas.size > 0) {
		content += `// ==================== Nested Schemas ====================\n`
		for (const nestedSchemaName of uniqueNestedSchemas) {
			if (!allProcessedSchemas.has(nestedSchemaName)) {
				content += `export type ${nestedSchemaName} = components['schemas']['${nestedSchemaName}'];\n`
			}
		}
		content += '\n'
	}

	// 통계 정보
	content += `// ==================== Statistics ====================\n`
	content += `// Domain: ${domain}\n`
	content += `// Total Schemas: ${allProcessedSchemas.size}\n`
	content += `// Nested Schemas: ${uniqueNestedSchemas.size}\n`
	content += `// Property Types: ${generatedPropertyTypes.size}\n`
	content += `// Auto-generated file - do not edit manually\n`

	return content
}

// CLI 실행
// 스크립트 직접 실행 시에만 실행
if (import.meta.url === `file://${process.argv[1]}`) {
	const args = process.argv.slice(2)

	if (args.length === 0) {
		// 배치 모드: 모든 도메인의 모든 스키마 처리
		logger.info('인자가 없으므로 배치 모드로 실행합니다.')
		logger.info('모든 도메인(auth, content, payment, search, system)의 모든 스키마를 처리합니다.')
		processBatchMode().catch((error) => {
			logger.error(`배치 처리 중 오류 발생: ${error.message}`)
			process.exit(1)
		})
	} else {
		// 기존 단일 스키마 처리 모드
		const [schemaName, domainOrPath, outputPath] = args

		// 두 번째 인자가 도메인인지 파일 경로인지 판단
		const domains = convertToServerList(detectServersFromModel())
		let domain = domains[0] || 'content' // 첫 번째 감지된 서버를 기본값으로 사용
		let finalOutputPath = outputPath

		if (domains.includes(domainOrPath)) {
			domain = domainOrPath
		} else if (domainOrPath) {
			// 두 번째 인자가 파일 경로인 경우
			finalOutputPath = domainOrPath
		}

		logger.info(`도메인: ${domain}`)
		logger.info(`스키마: ${schemaName}`)
		logger.info(`깊이 분석 모드 활성화`)

		const extractor = new DeepSchemaTypeExtractor(domain)
		extractor.extract(schemaName, finalOutputPath)
	}
}

/**
 * Generator 호환 래퍼 클래스
 */
export class DeepSchemaGenerator {
	constructor(config, pathResolver, importResolver, naming) {
		this.config = config
		this.pathResolver = pathResolver
		this.importResolver = importResolver
		this.naming = naming
	}

	/**
	 * Generator 인터페이스 호환 메서드
	 */
	async generate(serverName) {
		const schemaFilePath = this.pathResolver.getSchemaPath(serverName)
		const outputPath = this.pathResolver.resolvePath(
			this.config.fileGeneration.domainTypes + '/' + (this.config.fileGeneration?.files?.deepSchema || 'deepSchema.ts'),
			{ serverName }
		)

		const extractor = new DeepSchemaTypeExtractor(serverName)
		const schemaContent = readFileSync(schemaFilePath, 'utf-8')

		// 모든 스키마 파싱
		extractor.parseAllSchemas(schemaContent)
		const schemaNames = Array.from(extractor.allSchemas.keys())

		// 통합 파일 생성
		const consolidatedContent = await generateConsolidatedDeepSchemaFile(extractor, schemaNames, serverName)

		return consolidatedContent
	}
}

/**
 * DeepSchemaGenerator 헬퍼 함수
 */
export function createDeepSchemaGenerator(config, pathResolver, importResolver, naming) {
	return new DeepSchemaGenerator(config, pathResolver, importResolver, naming)
}

export { DeepSchemaTypeExtractor }
export default DeepSchemaGenerator
