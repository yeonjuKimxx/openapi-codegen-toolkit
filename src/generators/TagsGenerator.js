#!/usr/bin/env node

/**
 * 🏷️ TagsGenerator - Tags 파일 생성기
 *
 * tags.ts 파일을 생성합니다.
 * extractSwaggerTags.js의 모든 로직을 클래스화했습니다.
 *
 * @description
 * - OpenAPI schema에서 태그 추출
 * - 태그별 통계 계산
 * - TypeScript 타입 정의 생성
 */

import { readFileSync } from 'fs'
import logger from '../utils/Logger.js'

/**
 * TagsGenerator 클래스
 */
export class TagsGenerator {
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
	 * 서버의 tags.ts 생성
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string} 생성된 파일 내용
	 */
	generate(serverName) {
		const schemaPath = this.pathResolver.getSchemaPath(serverName)
		const schemaContent = readFileSync(schemaPath, 'utf-8')

		const { tags, pathsData } = this.extractTagsFromSchema(schemaContent, serverName)

		return this.generateTagFile(serverName, tags, pathsData)
	}

	/**
	 * 경로에서 태그 추출 (extractSwaggerTags.js line 25-55)
	 */
	extractTagFromPath(path, schemaName = '') {
		const segments = path.split('/').filter(Boolean)

		if (segments.length === 0) return 'root'

		// 버전 정보 처리 (v1, v2 등)
		if (segments[0].match(/^v\d+$/)) {
			if (segments.length > 1) {
				const tag = `${segments[0]}_${segments[1]}`

				// content 서버에서만 tournament 태그 제외
				if (schemaName === 'content' && segments[1] === 'tournament') {
					return null
				}

				// internal 태그 제외
				if (segments[1] === 'internal') {
					return null
				}

				return tag
			}
			return segments[0]
		}

		// internal 태그 제외
		if (segments[0] === 'internal') {
			return null
		}

		// content 서버의 tournament 태그 제외
		if (schemaName === 'content' && segments[0] === 'tournament') {
			return null
		}

		return segments[0]
	}

	/**
	 * 스키마에서 태그 추출 (extractSwaggerTags.js line 60-99)
	 */
	extractTagsFromSchema(schemaContent, schemaName) {
		const tags = new Set()
		const pathsData = []

		try {
			// paths 인터페이스 추출
			const pathsRegex = /export interface paths\s*\{([\s\S]*?)\n\}/
			const pathsMatch = schemaContent.match(pathsRegex)

			if (!pathsMatch) {
				logger.warn(`${schemaName}에서 paths를 찾을 수 없습니다`)
				return { tags, pathsData }
			}

			const pathsContent = pathsMatch[1]

			// 각 경로 추출
			const pathRegex = /['"]([^'"]+)['"]:\s*\{/g
			let pathMatch

			while ((pathMatch = pathRegex.exec(pathsContent)) !== null) {
				const path = pathMatch[1]
				const tag = this.extractTagFromPath(path, schemaName)

				// null 태그는 무시
				if (tag !== null) {
					tags.add(tag)
					pathsData.push({
						path,
						tag,
						schema: schemaName,
					})
				}
			}
		} catch (error) {
			logger.error(`${schemaName} 태그 추출 오류: ${error.message}`)
		}

		return { tags, pathsData }
	}

	/**
	 * 태그 파일 생성 (extractSwaggerTags.js line 131-194)
	 */
	generateTagFile(serverName, tags, pathsData) {
		const sortedTags = Array.from(tags).sort()

		// 태그별 통계
		const tagStats = {}
		pathsData.forEach(({ tag }) => {
			tagStats[tag] = (tagStats[tag] || 0) + 1
		})

		const serverUpper = serverName.toUpperCase()
		const serverPascal = this.naming.naming?.tagToPascalCase?.(serverName) ||
			serverName.charAt(0).toUpperCase() + serverName.slice(1)

		return `/**
 * 🏷️ ${serverUpper} 서버 태그 리스트
 *
 * ${serverUpper} 서버의 OpenAPI 스키마에서 자동 추출된 태그들입니다.
 *
 * 🔧 생성 명령어: npm run api:extract-tags
 *
 * 📊 총 ${sortedTags.length}개 태그 발견
 */

// === 🏷️ ${serverUpper} 서버 태그 리스트 ===

/**
 * ${serverUpper} 서버의 모든 Swagger 태그들
 */
export const ${serverUpper}_TAGS = [
${sortedTags.map((tag) => `  '${tag}',`).join('\n')}
] as const;

/**
 * ${serverUpper} 서버 태그별 API 수량 통계
 */
export const ${serverUpper}_TAG_STATS = {
${sortedTags.map((tag) => `  '${tag}': ${tagStats[tag]},`).join('\n')}
} as const;

/**
 * ${serverUpper} 서버 태그 요약
 */
export const ${serverUpper}_TAG_SUMMARY = {
  server: '${serverName}',
  total: ${sortedTags.length},
  tags: ${serverUpper}_TAGS,
  stats: ${serverUpper}_TAG_STATS
} as const;

// === 🎯 타입 정의 ===

/**
 * ${serverUpper} 서버 태그 타입
 */
export type ${serverPascal}Tag = typeof ${serverUpper}_TAGS[number];

/**
 * ${serverUpper} 서버 태그 통계 타입
 */
export type ${serverPascal}TagStats = typeof ${serverUpper}_TAG_STATS;

// === 🔧 기본 export ===

export default {
  TAGS: ${serverUpper}_TAGS,
  STATS: ${serverUpper}_TAG_STATS,
  SUMMARY: ${serverUpper}_TAG_SUMMARY
};`
	}
}

/**
 * TagsGenerator 인스턴스 생성 헬퍼
 */
export function createTagsGenerator(config, pathResolver, naming) {
	return new TagsGenerator(config, pathResolver, naming)
}

export default TagsGenerator
