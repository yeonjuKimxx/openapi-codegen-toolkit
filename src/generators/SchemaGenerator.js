#!/usr/bin/env node

/**
 * 📋 SchemaGenerator - OpenAPI Schema 타입 생성기
 *
 * openapi-typescript를 실행하여 schema.d.ts 파일을 생성합니다.
 * generateTypes.js의 로직을 클래스화했습니다.
 *
 * @description
 * - openapi-typescript CLI 실행
 * - schema.d.ts 파일 생성
 * - 환경 변수에서 OpenAPI URL 읽기
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import dotenv from 'dotenv'
import logger from '../utils/Logger.js'

// 환경 변수 로드
dotenv.config()

/**
 * SchemaGenerator 클래스
 */
export class SchemaGenerator {
	/**
	 * @param {Object} config - 설정 객체
	 * @param {Object} pathResolver - PathResolver 인스턴스
	 */
	constructor(config, pathResolver) {
		this.config = config
		this.pathResolver = pathResolver
	}

	/**
	 * 서버의 schema.d.ts 생성
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string|null} 생성 성공 시 null (파일로 직접 저장됨)
	 */
	generate(serverName) {
		const schemaPath = this.pathResolver.getSchemaPath(serverName)
		const url = this.getServerUrl(serverName)

		if (!url) {
			throw new Error(`${serverName} 서버의 URL을 찾을 수 없습니다. .env 파일을 확인하세요.`)
		}

		logger.info(`OpenAPI URL: ${url}`)

		try {
			// 디렉토리 생성
			const dir = dirname(schemaPath)
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true })
			}

			// openapi-typescript 실행
			const command = `npx openapi-typescript ${url} --output ${schemaPath}`
			logger.info(`실행: ${command}`)

			execSync(command, {
				stdio: 'inherit',
				cwd: process.cwd(),
			})

			logger.success(`${serverName} schema.d.ts 생성 완료`)

			// Generator.executeStep에서 파일로 저장하지 않도록 null 반환
			return null
		} catch (error) {
			logger.error(`${serverName} schema.d.ts 생성 실패: ${error.message}`)
			throw error
		}
	}

	/**
	 * 환경 변수에서 서버 URL 가져오기
	 *
	 * @param {string} serverName - 서버 이름
	 * @returns {string|null} OpenAPI URL
	 */
	getServerUrl(serverName) {
		const envVarConfig = this.config.envVarConfig || {}
		const prefix = envVarConfig.prefix || 'NEXT_PUBLIC_STEPIN_'
		const serverNameUpper = serverName.toUpperCase()

		// 환경 변수명 생성: NEXT_PUBLIC_STEPIN_AUTH
		const envVarName = `${prefix}${serverNameUpper}`
		let url = process.env[envVarName]

		if (!url) {
			logger.warn(`환경 변수 ${envVarName}를 찾을 수 없습니다.`)
			return null
		}

		// 기본 suffix 추가 (customDocsSuffix에 있으면 그것 사용)
		const customSuffix = envVarConfig.customDocsSuffix?.[serverName]
		const defaultSuffix = envVarConfig.defaultDocsSuffix || '/docs-yaml'
		const suffix = customSuffix || defaultSuffix

		// URL이 이미 suffix를 포함하고 있지 않으면 추가
		if (!url.includes('/docs')) {
			url = url + suffix
		}

		return url
	}
}

/**
 * SchemaGenerator 인스턴스 생성 헬퍼
 */
export function createSchemaGenerator(config, pathResolver) {
	return new SchemaGenerator(config, pathResolver)
}

export default SchemaGenerator
