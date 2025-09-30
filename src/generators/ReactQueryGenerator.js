#!/usr/bin/env node

/**
 * ⚛️ ReactQueryGenerator - React Query Hooks 생성기
 *
 * useQueries.ts와 useMutations.ts 파일을 생성합니다.
 * generateReactQueryHooks.js의 모든 로직을 클래스화했습니다.
 *
 * @description
 * - Query hooks: GET 메서드용
 * - Mutation hooks: POST, PUT, PATCH, DELETE용
 * - 에러/성공 핸들링 통합
 * - 타입 자동 추론
 */

import { readFileSync, existsSync } from 'fs'

/**
 * ReactQueryGenerator 클래스
 */
export class ReactQueryGenerator {
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
	 * Query Hooks 생성
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름
	 * @param {Array} functions - API 함수 목록
	 * @returns {string|null} 생성된 파일 내용
	 */
	generateQueryHooks(serverName, tagName, functions) {
		const queryFunctions = functions.filter((f) => f.hookType === 'query')

		if (queryFunctions.length === 0) {
			return null
		}

		// validated 타입 파싱
		const validatedTypes = this.parseValidatedTypes(serverName)

		// operationId 매핑
		const pathToOperationIdMap = this.buildPathToOperationIdMap(serverName)

		// API 파일 읽기
		const apiPath = this.pathResolver.getDomainApiPath(serverName, tagName)
		const apiContent = readFileSync(apiPath, 'utf-8')

		// validated.ts 읽기
		const validatedPath = this.pathResolver.getValidatedTypesPath(serverName)
		const validatedContent = existsSync(validatedPath) ? readFileSync(validatedPath, 'utf-8') : ''

		const usedTypes = new Set()
		const hookCodes = []

		queryFunctions.forEach((func) => {
			const hookCode = this.generateQueryHook(
				serverName,
				tagName,
				func,
				apiContent,
				validatedContent,
				validatedTypes,
				pathToOperationIdMap,
				usedTypes
			)
			hookCodes.push(hookCode)
		})

		return this.generateQueryHooksFile(serverName, tagName, queryFunctions, hookCodes, usedTypes)
	}

	/**
	 * Mutation Hooks 생성
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름
	 * @param {Array} functions - API 함수 목록
	 * @returns {string|null} 생성된 파일 내용
	 */
	generateMutationHooks(serverName, tagName, functions) {
		const mutationFunctions = functions.filter((f) => f.hookType === 'mutation')

		if (mutationFunctions.length === 0) {
			return null
		}

		// validated 타입 파싱
		const validatedTypes = this.parseValidatedTypes(serverName)

		// operationId 매핑
		const pathToOperationIdMap = this.buildPathToOperationIdMap(serverName)

		// API 파일 읽기
		const apiPath = this.pathResolver.getDomainApiPath(serverName, tagName)
		const apiContent = readFileSync(apiPath, 'utf-8')

		// validated.ts 읽기
		const validatedPath = this.pathResolver.getValidatedTypesPath(serverName)
		const validatedContent = existsSync(validatedPath) ? readFileSync(validatedPath, 'utf-8') : ''

		const usedTypes = new Set()
		const hookCodes = []

		mutationFunctions.forEach((func) => {
			const hookCode = this.generateMutationHook(
				serverName,
				tagName,
				func,
				apiContent,
				validatedContent,
				validatedTypes,
				pathToOperationIdMap,
				usedTypes
			)
			hookCodes.push(hookCode)
		})

		return this.generateMutationHooksFile(serverName, tagName, mutationFunctions, hookCodes, usedTypes)
	}

	/**
	 * 단일 Query Hook 생성 (generateReactQueryHooks.js line 636-743)
	 */
	generateQueryHook(serverName, tagName, func, apiContent, validatedContent, validatedTypes, pathToOperationIdMap, usedTypes) {
		const hookName = `use${func.name.charAt(0).toUpperCase() + func.name.slice(1).replace(/^fetch/, '')}Query`

		// operationId 찾기
		const functionRegex = new RegExp(`export const ${func.name} = async \\((.*?)\\) => \\{([\\s\\S]*?)\\n\\};`)
		const functionMatch = apiContent.match(functionRegex)

		let operationId = null
		if (functionMatch) {
			operationId = this.getOperationIdFromFunction(func.name, functionMatch[2], pathToOperationIdMap)
		}

		// 타입 찾기 (3단계 fallback)
		let paramsType = null
		let responseType = null

		// 1. API 파일에서 직접 추출
		const functionParams = this.extractTypesFromAPIFunction(func.name, apiContent)
		if (functionParams.paramsType || functionParams.responseType) {
			paramsType = functionParams.paramsType
			responseType = functionParams.responseType

			if (paramsType) usedTypes.add(paramsType)
			if (responseType) usedTypes.add(responseType)

			console.log(`   ✅ ${func.name}: API 파일에서 직접 타입 추출 성공`)
		}
		// 2. operationId로 찾기
		else if (operationId && validatedTypes.operationTypes[operationId]) {
			const types = validatedTypes.operationTypes[operationId]

			if (types.params) {
				paramsType = types.params
				usedTypes.add(paramsType)
			}
			if (types.response) {
				responseType = types.response
				usedTypes.add(responseType)
			} else if (types.ro) {
				responseType = types.ro
				usedTypes.add(responseType)
			}

			console.log(`   ✅ ${func.name}: operationId ${operationId}에서 타입 찾기 성공`)
		}
		// 3. 함수명에서 유추
		else {
			const inferredTypes = this.inferTypesFromFunctionName(func.name, validatedTypes.allTypes)
			if (inferredTypes.paramsType || inferredTypes.responseType) {
				paramsType = inferredTypes.paramsType
				responseType = inferredTypes.responseType

				if (paramsType) usedTypes.add(paramsType)
				if (responseType) usedTypes.add(responseType)

				console.log(`   ⚠️  ${func.name}: 함수명에서 타입 유추 (fallback)`)
			}
		}

		const hasParams = func.params && func.params !== ''

		// 파라미터 분석
		const actualFuncParams = this.analyzeAPIFunctionParams(func.name, apiContent)
		const paramsRequirement = hasParams && paramsType ? this.analyzeParamsRequirement(paramsType, validatedContent) : 'optional'

		let finalParamsArg = ''
		if (hasParams && paramsType) {
			const apiRequiredParams = !actualFuncParams.paramNames.some(
				(name) => apiContent.includes(`${name}?:`) || apiContent.includes(`${name}: undefined`)
			)
			finalParamsArg = apiRequiredParams ? `params: ${paramsType}` : `params?: ${paramsType}`
		}

		const allParams = finalParamsArg ? `${finalParamsArg}, enabled?: boolean` : 'enabled?: boolean'

		return `export const ${hookName} = (${allParams})
: UseQueryResult<${responseType || 'unknown'}, Error> => {
  return useQuery({
    queryKey: ['${func.name}', ${hasParams ? 'params' : ''}],
    queryFn: () => ${func.name}(${hasParams ? 'params' : ''}),
    enabled: enabled,
    ${this.generateErrorHandlingCode(true, func.name, serverName)},
  });
};`
	}

	/**
	 * 단일 Mutation Hook 생성 (generateReactQueryHooks.js line 836-989)
	 */
	generateMutationHook(serverName, tagName, func, apiContent, validatedContent, validatedTypes, pathToOperationIdMap, usedTypes) {
		const hookName = `use${func.name.charAt(0).toUpperCase() + func.name.slice(1).replace(/^(create|update|modify|remove)/, '')}Mutation`

		// operationId 찾기
		const functionRegex = new RegExp(`export const ${func.name} = async \\((.*?)\\) => \\{([\\s\\S]*?)\\n\\};`)
		const functionMatch = apiContent.match(functionRegex)

		let operationId = null
		if (functionMatch) {
			operationId = this.getOperationIdFromFunction(func.name, functionMatch[2], pathToOperationIdMap)
		}

		// 타입 찾기
		let paramsType = null
		let bodyType = null
		let responseType = null

		const functionParams = this.extractTypesFromAPIFunction(func.name, apiContent)
		if (functionParams.paramsType || functionParams.bodyType || functionParams.responseType) {
			paramsType = functionParams.paramsType
			bodyType = functionParams.bodyType
			responseType = functionParams.responseType

			if (paramsType) usedTypes.add(paramsType)
			if (bodyType) usedTypes.add(bodyType)
			if (responseType) usedTypes.add(responseType)

			console.log(`   ✅ ${func.name}: API 파일에서 직접 타입 추출 성공`)
		} else if (operationId && validatedTypes.operationTypes[operationId]) {
			const types = validatedTypes.operationTypes[operationId]

			if (types.params) {
				paramsType = types.params
				usedTypes.add(paramsType)
			}
			if (types.body) {
				bodyType = types.body
				usedTypes.add(bodyType)
			}
			if (types.response) {
				responseType = types.response
				usedTypes.add(responseType)
			} else if (types.ro) {
				responseType = types.ro
				usedTypes.add(responseType)
			}

			console.log(`   ✅ ${func.name}: operationId ${operationId}에서 타입 찾기 성공`)
		}

		// Variables 타입 결정
		let variablesType = 'unknown'
		if (paramsType && bodyType) {
			variablesType = `{ params: ${paramsType}; body: ${bodyType} }`
		} else if (paramsType) {
			variablesType = paramsType
		} else if (bodyType) {
			variablesType = bodyType
		}

		return `export const ${hookName} = ()
: UseMutationResult<${responseType || 'unknown'}, Error, ${variablesType}> => {
  return useMutation({
    mutationFn: (${paramsType && bodyType ? '{ params, body }' : paramsType ? 'params' : bodyType ? 'body' : 'variables'}) => ${func.name}(${
			paramsType && bodyType ? 'params, body' : paramsType ? 'params' : bodyType ? 'body' : ''
		}),
    ${this.generateErrorHandlingCode(false, func.name, serverName)},
    ${this.generateSuccessHandlingCode(responseType, func.name, serverName)},
  });
};`
	}

	/**
	 * 에러 핸들링 코드 생성 (generateReactQueryHooks.js line 25-81)
	 */
	generateErrorHandlingCode(isQuery, functionName, serverName) {
		const errorHandling = this.config?.errorHandling || {}

		if (errorHandling.useToast) {
			const toastMessages = errorHandling.toastMessages || {}
			const message = isQuery ? toastMessages.queryError : toastMessages.mutationError
			const messageTemplate = message || 'Error: {message}'

			return `throwOnError: (error: Error) => {
      toast.error('${messageTemplate.replace('{message}', '\' + error.message + \'')}');
      throw error;
    }`
		}

		return `throwOnError: true`
	}

	/**
	 * 성공 핸들링 코드 생성 (generateReactQueryHooks.js line 126-175)
	 */
	generateSuccessHandlingCode(responseType, functionName, serverName) {
		const errorHandling = this.config?.errorHandling || {}

		if (errorHandling.successNotification && errorHandling.useToast) {
			const toastMessages = errorHandling.toastMessages || {}
			const message = toastMessages.mutationSuccess || 'Operation completed successfully'

			return `onSuccess: () => {
      toast.success('${message}');
    }`
		}

		return ''
	}

	/**
	 * Query Hooks 파일 생성 (generateReactQueryHooks.js line 760-767)
	 */
	generateQueryHooksFile(serverName, tagName, queryFunctions, hookCodes, usedTypes) {
		const typeImports = Array.from(usedTypes)
		const importStatement =
			typeImports.length > 0
				? `import {\n  ${typeImports.join(',\n  ')}\n} from '${this.importResolver.getValidatedTypesImport(serverName)}';`
				: ''

		return `import { useQuery, UseQueryResult } from '${this.importResolver.getReactQueryImport()}';
import { toast } from '${this.importResolver.getToastImport()}';
import { ${queryFunctions.map((f) => f.name).join(', ')} } from './${tagName}API';
${importStatement}

${hookCodes.join('\n\n')}
`
	}

	/**
	 * Mutation Hooks 파일 생성
	 */
	generateMutationHooksFile(serverName, tagName, mutationFunctions, hookCodes, usedTypes) {
		const typeImports = Array.from(usedTypes)
		const importStatement =
			typeImports.length > 0
				? `import {\n  ${typeImports.join(',\n  ')}\n} from '${this.importResolver.getValidatedTypesImport(serverName)}';`
				: ''

		return `import { useMutation, UseMutationResult } from '${this.importResolver.getReactQueryImport()}';
import { toast } from '${this.importResolver.getToastImport()}';
import { ${mutationFunctions.map((f) => f.name).join(', ')} } from './${tagName}API';
${importStatement}

${hookCodes.join('\n\n')}
`
	}

	// ========================================
	// 유틸리티 메서드들
	// ========================================

	/**
	 * validated 타입 파싱 (generateReactQueryHooks.js line 177-231)
	 */
	parseValidatedTypes(serverName) {
		const validatedPath = this.pathResolver.getValidatedTypesPath(serverName)
		if (!existsSync(validatedPath)) {
			return { allTypes: [], operationTypes: {} }
		}

		const validatedContent = readFileSync(validatedPath, 'utf-8')
		const allTypes = []
		const operationTypes = {}

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
	 * operationId 매핑 생성 (generateReactQueryHooks.js line 299-338)
	 */
	buildPathToOperationIdMap(serverName) {
		const schemaPath = this.pathResolver.getSchemaPath(serverName)
		const schemaContent = readFileSync(schemaPath, 'utf-8')

		const pathToOperationIdMap = {}

		const pathsMatch = schemaContent.match(/export interface paths \{([\s\S]*?)(?=\nexport interface)/)
		if (!pathsMatch) return pathToOperationIdMap

		const pathsBlock = pathsMatch[1]
		const pathRegex = /['"]([^'"]+)['"]:\s*\{([\s\S]*?)\n\t\}/g
		let pathMatch

		while ((pathMatch = pathRegex.exec(pathsBlock)) !== null) {
			const [_, path, pathDetails] = pathMatch
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
	 * API 함수에서 타입 추출 (generateReactQueryHooks.js line 445-511)
	 */
	extractTypesFromAPIFunction(functionName, apiContent) {
		const functionRegex = new RegExp(`export const ${functionName} = async \\((.*?)\\) => \\{([\\s\\S]*?)\\n\\};`)
		const functionMatch = apiContent.match(functionRegex)

		if (!functionMatch) {
			return { paramsType: null, bodyType: null, responseType: null }
		}

		const params = functionMatch[1]
		const body = functionMatch[2]

		let paramsType = null
		let bodyType = null
		let responseType = null

		// params 타입 추출
		const paramsMatch = params.match(/params:\s*([a-zA-Z0-9_]+)/)
		if (paramsMatch) {
			paramsType = paramsMatch[1]
		}

		// body 타입 추출
		const bodyMatch = params.match(/body:\s*([a-zA-Z0-9_]+)/)
		if (bodyMatch) {
			bodyType = bodyMatch[1]
		}

		// response 타입 추출
		const responseMatch = body.match(/handleAPIResponse<([a-zA-Z0-9_]+)>/)
		if (responseMatch) {
			responseType = responseMatch[1]
		}

		return { paramsType, bodyType, responseType }
	}

	/**
	 * 함수명에서 타입 유추 (generateReactQueryHooks.js line 356-405)
	 */
	inferTypesFromFunctionName(functionName, allTypes) {
		const baseName = functionName.replace(/^(fetch|create|update|modify|remove)/, '')
		const pascalBaseName = baseName.charAt(0).toUpperCase() + baseName.slice(1)

		const paramsType = allTypes.find((t) => t === `${functionName}_Params` || t.startsWith(pascalBaseName) && t.endsWith('_Params'))
		const responseType = allTypes.find((t) => t === `${functionName}_Response` || t === `${functionName}_RO` || (t.startsWith(pascalBaseName) && (t.endsWith('_Response') || t.endsWith('_RO'))))

		return { paramsType: paramsType || null, responseType: responseType || null }
	}

	/**
	 * 함수에서 operationId 찾기 (generateReactQueryHooks.js line 340-354)
	 */
	getOperationIdFromFunction(functionName, functionContent, pathToOperationIdMap) {
		const pathMatch = functionContent.match(/[A-Z]+\('([^']+)'/)
		if (!pathMatch) return null

		const path = pathMatch[1]
		const methodMatch = functionContent.match(/(GET|POST|PUT|PATCH|DELETE)\(/)
		if (!methodMatch) return null

		const method = methodMatch[1]
		const key = `${path}#${method}`

		return pathToOperationIdMap[key] || null
	}

	/**
	 * API 함수 파라미터 분석 (generateReactQueryHooks.js line 772-796)
	 */
	analyzeAPIFunctionParams(functionName, apiContent) {
		const functionRegex = new RegExp(`export const ${functionName} = async \\((.*?)\\) => \\{`)
		const functionMatch = apiContent.match(functionRegex)

		if (!functionMatch) {
			return { paramNames: [], hasParams: false, hasBody: false }
		}

		const params = functionMatch[1]
		const paramNames = params.split(',').map((p) => p.trim().split(':')[0].trim()).filter(Boolean)

		return {
			paramNames,
			hasParams: paramNames.some((n) => n.includes('params')),
			hasBody: paramNames.some((n) => n.includes('body')),
		}
	}

	/**
	 * Params 요구사항 분석 (generateReactQueryHooks.js line 587-610)
	 */
	analyzeParamsRequirement(paramsTypeName, validatedContent) {
		if (!validatedContent) return 'optional'

		const typeDefRegex = new RegExp(`export type ${paramsTypeName} = \\{([\\s\\S]*?)\\};`)
		const typeDefMatch = validatedContent.match(typeDefRegex)

		if (!typeDefMatch) return 'optional'

		const typeContent = typeDefMatch[1]
		const hasRequiredField = typeContent.includes(':') && !typeContent.includes('?:')

		return hasRequiredField ? 'required' : 'optional'
	}
}

/**
 * ReactQueryGenerator 인스턴스 생성 헬퍼
 */
export function createReactQueryGenerator(config, pathResolver, importResolver, naming) {
	return new ReactQueryGenerator(config, pathResolver, importResolver, naming)
}

export default ReactQueryGenerator
