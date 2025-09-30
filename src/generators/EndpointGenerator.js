#!/usr/bin/env node

/**
 * 📡 EndpointGenerator - Endpoint 파일 생성기
 *
 * endpoint.ts 파일을 생성합니다.
 * generateEndpointsByTags.js의 핵심 로직을 클래스화했습니다.
 *
 * @description
 * - API 엔드포인트 상수 생성 (GET_USERS, POST_USER 등)
 * - 동적 경로 헬퍼 함수 생성
 * - 태그별 그룹화
 */

import { readFileSync } from 'fs'

/**
 * EndpointGenerator 클래스
 */
export class EndpointGenerator {
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
	 * 서버의 endpoint.ts 생성
	 *
	 * @param {string} serverName - 서버 이름
	 * @param {string} tagName - 태그 이름
	 * @returns {string} 생성된 파일 내용
	 */
	generate(serverName, tagName) {
		// schema에서 경로 추출
		const schemaPath = this.pathResolver.getSchemaPath(serverName)
		const schemaContent = readFileSync(schemaPath, 'utf-8')

		const paths = this.extractPathsFromSchema(schemaContent, serverName, tagName)

		return this.generateEndpointFile(serverName, tagName, paths)
	}

	/**
	 * Schema에서 경로 추출
	 */
	extractPathsFromSchema(schemaContent, serverName, tagName) {
		const pathsData = []

		try {
			const pathsMatch = schemaContent.match(/export interface paths\s*\{([\s\S]*?)(?=\nexport interface)/)
			if (!pathsMatch) return pathsData

			const pathsBlock = pathsMatch[1]
			const pathRegex = /['"]([^'"]+)['"]:\s*\{([\s\S]*?)\n\t\}/g
			let pathMatch

			while ((pathMatch = pathRegex.exec(pathsBlock)) !== null) {
				const [_, path, pathDetails] = pathMatch

				const extractedTag = this.naming.extractTagFromPath(path)
				if (extractedTag !== tagName) continue

				const methodRegex = /(get|post|put|patch|delete)\??:/gi
				let methodMatch

				while ((methodMatch = methodRegex.exec(pathDetails)) !== null) {
					const method = methodMatch[1].toLowerCase()
					const isDynamic = path.includes('{')
					const constantName = this.naming.generateConstantName(path, method)

					pathsData.push({
						path,
						method,
						constantName,
						functionName: constantName,
						isDynamic,
						tag: tagName,
					})
				}
			}
		} catch (error) {
			console.error(`❌ ${serverName} 경로 추출 오류:`, error.message)
		}

		return pathsData
	}

	/**
	 * Endpoint 파일 생성
	 */
	generateEndpointFile(serverName, tagName, paths) {
		const serverUpper = serverName.toUpperCase()
		const tagUpper = this.naming.tagToIdentifier(tagName)

		const staticPaths = paths.filter((p) => !p.isDynamic)
		const dynamicPaths = paths.filter((p) => p.isDynamic)

		const header = `/**
 * 📡 ${serverUpper} - ${tagName} API 엔드포인트
 *
 * 자동 생성된 파일입니다.
 * @generated auto-generated
 */
`

		let apiSection = ''
		if (staticPaths.length > 0) {
			apiSection = `export const ${tagUpper}_API = {
${staticPaths.map(p => `  /** ${p.method.toUpperCase()} ${p.path} */\n  ${p.constantName}: '${p.path}' as const,`).join('\n')}
} as const;

`
		}

		let helpersSection = ''
		if (dynamicPaths.length > 0) {
			helpersSection = `export const ${tagUpper}_HELPERS = {
${dynamicPaths.map(p => {
	const params = p.path.match(/\{([^}]+)\}/g)?.map(m => m.slice(1, -1)) || []
	const paramList = params.map(p => `${p}: string`).join(', ')
	const pathTemplate = p.path.replace(/\{([^}]+)\}/g, '${$1}')
	return `  /** ${p.method.toUpperCase()} ${p.path} */\n  ${p.functionName}: (${paramList}) => \`${pathTemplate}\` as const,`
}).join('\n')}
} as const;
`
		} else {
			helpersSection = `export const ${tagUpper}_HELPERS = {} as const;
`
		}

		return header + '\n' + apiSection + helpersSection
	}
}

export function createEndpointGenerator(config, pathResolver, naming) {
	return new EndpointGenerator(config, pathResolver, naming)
}

export default EndpointGenerator
