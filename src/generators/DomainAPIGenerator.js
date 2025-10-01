#!/usr/bin/env node

/**
 * 🏗️ DomainAPIGenerator - Domain API 파일 생성기
 *
 * 태그별 {tag}API.ts 파일을 생성합니다.
 * generateDomainAPI.js의 모든 로직을 클래스화했습니다.
 *
 * @description
 * - 태그별 API 함수 생성 (fetchUsers, createUser 등)
 * - JSDoc 주석 생성
 * - Params/Body/Response 타입 매핑
 * - Import 문 생성
 */

import { readFileSync } from 'fs'
import logger from '../utils/Logger.js'

/**
 * DomainAPIGenerator 클래스
 */
export class DomainAPIGenerator {
	/**
	 * @param {Object} config - 설정 객체
	 * @param {Object} pathResolver - PathResolver 인스턴스
	 * @param {Object} importResolver - ImportResolver 인스턴스
	 * @param {Object} naming - NamingConventions 인스턴스
	 */
	constructor(config, pathResolver, importResolver, naming) {
		this.config = config
		this.pathResolver = pathResolver
		this.importResolver = importResolver
		this.naming = naming
	}

	/**
	 * 태그의 Domain API 파일 생성
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름
	 * @returns {string} 생성된 파일 내용
	 */
	generate(serverName, tagName) {
		// schema에서 경로 추출
		const schemaPath = this.pathResolver.getSchemaPath(serverName)
		const schemaContent = readFileSync(schemaPath, 'utf-8')
		const pathDataArray = this.extractPathsFromSchema(schemaContent, serverName, tagName)

		if (pathDataArray.length === 0) {
			logger.warn(`${tagName} 태그에 대한 경로를 찾을 수 없습니다.`)
			return ''
		}

		// validated 타입들 파싱
		const { allTypes, operationTypes } = this.parseValidatedTypes(serverName)

		// 경로별 operationId 매핑
		const pathToOperationIdMap = this.buildPathToOperationIdMap(serverName)

		// 사용할 타입들과 API 메서드 수집
		const usedTypes = new Set()
		const apiMethods = []

		pathDataArray.forEach((pathData) => {
			const { path, method, functionName } = pathData

			// operationId 조회
			const operationId = this.getOperationId(path, method, pathToOperationIdMap)
			if (!operationId) {
				logger.warn(`${path} ${method}에 대한 operationId를 찾을 수 없습니다.`)
				return
			}

			// validated 타입 정보
			const operationTypeInfo = operationTypes[operationId] || {}
			const paramsType = operationTypeInfo.params
			const bodyType = operationTypeInfo.body
			const responseType = operationTypeInfo.response
			const roType = operationTypeInfo.ro

			// 타입 추가
			if (paramsType) usedTypes.add(paramsType)
			if (bodyType) usedTypes.add(bodyType)
			if (responseType) usedTypes.add(responseType)
			if (roType) usedTypes.add(roType)

			const finalResponseType = responseType || roType

			// 메서드 코드 생성
			const methodCode = this.generateMethodCode(
				serverName,
				path,
				method,
				functionName,
				operationId,
				paramsType,
				bodyType,
				finalResponseType
			)

			apiMethods.push(methodCode)
		})

		// 파일 내용 생성
		return this.generateFileContent(serverName, tagName, usedTypes, apiMethods)
	}

	/**
	 * Schema에서 태그의 경로 추출
	 */
	extractPathsFromSchema(schemaContent, serverName, tagName) {
		const pathsData = []

		try {
			const pathsMatch = schemaContent.match(/export interface paths\s*\{([\s\S]*?)(?=\nexport interface)/)
			if (!pathsMatch) return pathsData

			const pathsBlock = pathsMatch[1]
			const pathRegex = /['"]([^'"]+)['"]:\s*\{([\s\S]*?)\n(?:\t| {4})\}/g
			let pathMatch

			while ((pathMatch = pathRegex.exec(pathsBlock)) !== null) {
				const [_, path, pathDetails] = pathMatch

				const extractedTag = this.naming.extractTagFromPath(path)
				if (extractedTag !== tagName) continue

				const methodRegex = /(get|post|put|patch|delete)\??:/gi
				let methodMatch

				while ((methodMatch = methodRegex.exec(pathDetails)) !== null) {
					const method = methodMatch[1].toLowerCase()
					const functionName = this.naming.generateFunctionName(path, method)

					pathsData.push({
						path,
						method,
						functionName,
						tag: tagName,
					})
				}
			}
		} catch (error) {
			logger.error(`${serverName} 경로 추출 오류: ${error.message}`)
		}

		return pathsData
	}

	/**
	 * 메서드 코드 생성 (generateDomainAPI.js line 786-898)
	 */
	generateMethodCode(serverName, path, method, functionName, operationId, paramsType, bodyType, responseType) {
		let parameters = []
		let apiCallOptions = []

		// Params 처리
		if (paramsType) {
			const { hasPathParams, hasQueryParams, hasHeaderParams, shouldStructure } = this.analyzeParamsType(
				serverName,
				paramsType
			)

			if (shouldStructure) {
				parameters.push(`params: ${paramsType}`)
				let paramsParts = []
				if (hasPathParams) paramsParts.push('path: params.path')
				if (hasQueryParams) paramsParts.push('query: params.query')
				if (hasHeaderParams) paramsParts.push('header: params.header')
				apiCallOptions.push(`params: {\n        ${paramsParts.join(',\n        ')}\n      }`)
			} else {
				parameters.push(`params: ${paramsType}`)
				apiCallOptions.push('params')
			}
		}

		// Body 처리
		if (bodyType) {
			parameters.push(`body: ${bodyType}`)
			apiCallOptions.push('body')
		}

		// 함수 시그니처
		const parameterString = parameters.length > 0 ? parameters.join(', ') : ''
		const optionsString = apiCallOptions.length > 0 ? `, {\n      ${apiCallOptions.join(',\n      ')}\n    }` : ''

		// JSDoc 생성
		const jsdocComment = this.generateJSDocComment(path, method, parameters, responseType)

		return `
${jsdocComment}
export const ${functionName} = async (${parameterString}) => {
  return handleAPIResponse${responseType ? `<${responseType}>` : ''}(
    ${method.toUpperCase()}('${path}'${optionsString})
  );
};`
	}

	/**
	 * Params 타입 분석 (generateDomainAPI.js line 794-877)
	 */
	analyzeParamsType(serverName, paramsType) {
		const validatedContent = this.readValidatedContent(serverName)
		if (!validatedContent) {
			return { hasPathParams: false, hasQueryParams: false, hasHeaderParams: false, shouldStructure: false }
		}

		// 타입 정의 찾기
		const typeStartPattern = `export type ${paramsType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} = {`
		const startIndex = validatedContent.indexOf(typeStartPattern)

		if (startIndex === -1) {
			return { hasPathParams: false, hasQueryParams: false, hasHeaderParams: false, shouldStructure: false }
		}

		// 중괄호 매칭으로 타입 끝 찾기
		const openBraceIndex = validatedContent.indexOf('{', startIndex)
		if (openBraceIndex === -1) {
			return { hasPathParams: false, hasQueryParams: false, hasHeaderParams: false, shouldStructure: false }
		}

		let braceCount = 1
		let currentIndex = openBraceIndex + 1
		let inString = false
		let escapeNext = false

		while (currentIndex < validatedContent.length && braceCount > 0) {
			const char = validatedContent[currentIndex]

			if (escapeNext) {
				escapeNext = false
			} else if (char === '\\') {
				escapeNext = true
			} else if (!inString && (char === '"' || char === "'" || char === '`')) {
				inString = char
			} else if (inString && char === inString) {
				inString = false
			} else if (!inString) {
				if (char === '{') braceCount++
				else if (char === '}') braceCount--
			}
			currentIndex++
		}

		if (braceCount !== 0) {
			return { hasPathParams: false, hasQueryParams: false, hasHeaderParams: false, shouldStructure: false }
		}

		const typeContent = validatedContent.substring(openBraceIndex + 1, currentIndex - 1)

		const hasPathParams = typeContent.includes('path:')
		const hasQueryParams = typeContent.includes('query:')
		const hasHeaderParams = typeContent.includes('header:')
		const shouldStructure = hasPathParams || hasQueryParams

		return { hasPathParams, hasQueryParams, hasHeaderParams, shouldStructure }
	}

	/**
	 * JSDoc 주석 생성 (generateDomainAPI.js line 1059-1112)
	 */
	generateJSDocComment(path, method, parameters, responseType) {
		const config = this.config
		const jsdocConfig = config?.codeGeneration?.jsdoc || {}

		if (!jsdocConfig.enabled) {
			return ''
		}

		const language = jsdocConfig.language || 'ko'
		const templates = jsdocConfig.templates?.[language] || {}

		const methodDescription = this.getMethodDescription(path, method)

		let lines = ['/**', ` * ${methodDescription}`]

		if (jsdocConfig.includeEndpoint) {
			const endpointPrefix = templates.endpointPrefix || 'Endpoint:'
			lines.push(` * ${endpointPrefix} ${method.toUpperCase()} ${path}`)
		}

		lines.push(' *')

		// 파라미터 설명
		if (jsdocConfig.includeParams && parameters.length > 0) {
			parameters.forEach((param) => {
				const paramName = param.split(':')[0].trim()
				const paramType = param.split(':')[1]?.trim() || 'any'
				const description = paramName === 'params' ? templates.parameterDescription : templates.bodyDescription
				lines.push(` * @param {${paramType}} ${paramName} - ${description}`)
			})
		}

		// 반환 타입
		if (jsdocConfig.includeReturns) {
			const returnDescription = templates.returnDescription || 'API response data'
			lines.push(` * @returns {Promise<${responseType || 'void'}>} ${returnDescription}`)
		}

		lines.push(' */')

		return lines.join('\n')
	}

	/**
	 * 메서드 설명 생성 (generateDomainAPI.js line 1023-1047)
	 */
	getMethodDescription(path, method) {
		const config = this.config
		const jsdocConfig = config?.codeGeneration?.jsdoc || {}
		const language = jsdocConfig.language || 'ko'
		const templates = jsdocConfig.templates?.[language] || {}

		// 커스텀 설명이 있으면 사용
		const customDescriptions = jsdocConfig.customDescriptions || {}
		if (customDescriptions[path]) {
			return customDescriptions[path]
		}

		// 기본 설명 생성
		const methodDescriptions = templates.methodDescriptions || {}
		const methodDesc = methodDescriptions[method.toLowerCase()] || method.toUpperCase()

		const pathSegments = path.split('/').filter(Boolean)
		const resourceName = pathSegments[pathSegments.length - 1] || 'resource'

		return `${resourceName} ${methodDesc}`
	}

	/**
	 * 파일 내용 생성 (generateDomainAPI.js line 916-933)
	 */
	generateFileContent(serverName, tagName, usedTypes, apiMethods) {
		const typeImports = Array.from(usedTypes)
		const importStatement =
			typeImports.length > 0
				? `import {\n  ${typeImports.join(',\n  ')}\n} from '${this.importResolver.getValidatedTypesImport(serverName)}';`
				: '// 사용 가능한 validated 타입이 없습니다.'

		return `import { createQueryParams, handleAPIResponse } from '${this.importResolver.getApiHandlersImport()}';
import { ${serverName}Fetcher } from '${this.importResolver.getServerInstanceImport(serverName)}';
${importStatement}

// openapi-fetch HTTP 메서드들 destructuring (싱글톤 인스턴스)
const { GET, POST, PUT, PATCH, DELETE } = ${serverName}Fetcher;
${apiMethods.join('\n')}
`
	}

	/**
	 * validated.ts 파일 읽기 (generateDomainAPI.js line 609-646)
	 */
	readValidatedContent(serverName) {
		try {
			const validatedPath = this.pathResolver.getValidatedTypesPath(serverName)
			return readFileSync(validatedPath, 'utf-8')
		} catch (error) {
			logger.warn(`${serverName} validated.ts 파일을 읽을 수 없습니다.`)
			return null
		}
	}

	/**
	 * validated 타입 파싱 (generateDomainAPI.js line 648-737)
	 */
	parseValidatedTypes(serverName) {
		const validatedContent = this.readValidatedContent(serverName)
		if (!validatedContent) {
			return { allTypes: [], operationTypes: {} }
		}

		const allTypes = []
		const operationTypes = {}

		// export type ... 패턴으로 모든 타입 추출
		const typeRegex = /export type ([a-zA-Z0-9_]+)(_Params|_Body|_Response|_RO)/g
		let match

		while ((match = typeRegex.exec(validatedContent)) !== null) {
			const fullTypeName = match[1] + match[2]
			const operationId = match[1]
			const suffix = match[2]

			allTypes.push(fullTypeName)

			if (!operationTypes[operationId]) {
				operationTypes[operationId] = {}
			}

			if (suffix === '_Params') operationTypes[operationId].params = fullTypeName
			else if (suffix === '_Body') operationTypes[operationId].body = fullTypeName
			else if (suffix === '_Response') operationTypes[operationId].response = fullTypeName
			else if (suffix === '_RO') operationTypes[operationId].ro = fullTypeName
		}

		return { allTypes, operationTypes }
	}

	/**
	 * operationId 매핑 생성 (generateDomainAPI.js line 953-1005)
	 */
	buildPathToOperationIdMap(serverName) {
		const schemaPath = this.pathResolver.getSchemaPath(serverName)
		const schemaContent = readFileSync(schemaPath, 'utf-8')

		const pathToOperationIdMap = {}

		// paths 인터페이스 추출
		const pathsMatch = schemaContent.match(/export interface paths \{([\s\S]*?)(?=\nexport interface)/)
		if (!pathsMatch) return pathToOperationIdMap

		const pathsBlock = pathsMatch[1]

		// 각 경로 순회 (탭 또는 공백 4개)
		const pathRegex = /['"]([^'"]+)['"]:\s*\{([\s\S]*?)\n(?:\t| {4})\}/g
		let pathMatch

		while ((pathMatch = pathRegex.exec(pathsBlock)) !== null) {
			const [_, path, pathDetails] = pathMatch

			// 각 메서드 순회
			const methodRegex = /(get|post|put|patch|delete)\??:\s*operations\[['"]([^'"]+)['"]\]/gi
			let methodMatch

			while ((methodMatch = methodRegex.exec(pathDetails)) !== null) {
				const [__, method, operationId] = methodMatch
				const key = `${path}#${method.toUpperCase()}`
				pathToOperationIdMap[key] = operationId
			}
		}

		return pathToOperationIdMap
	}

	/**
	 * operationId 조회 (generateDomainAPI.js line 1007-1021)
	 */
	getOperationId(path, method, pathToOperationIdMap) {
		const key = `${path}#${method.toUpperCase()}`
		return pathToOperationIdMap[key] || null
	}

	/**
	 * 태그를 PascalCase로 변환 (generateDomainAPI.js line 599-607)
	 */
	tagToPascalCase(tag) {
		return tag
			.split(/[-_]/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join('')
	}
}

/**
 * DomainAPIGenerator 인스턴스 생성 헬퍼
 */
export function createDomainAPIGenerator(config, pathResolver, importResolver, naming) {
	return new DomainAPIGenerator(config, pathResolver, importResolver, naming)
}

export default DomainAPIGenerator
