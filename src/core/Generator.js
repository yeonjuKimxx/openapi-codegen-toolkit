#!/usr/bin/env node

/**
 * 🚀 Generator - 메인 Orchestrator
 *
 * 모든 생성 단계를 조율하고 실행합니다.
 * generateApi.js의 로직을 클래스화했습니다.
 *
 * @description
 * - 7단계 생성 프로세스 실행
 * - Feature flags로 단계 제어
 * - 진행 상황 추적
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname } from 'path'

/**
 * Generator 클래스
 */
export class Generator {
	/**
	 * @param {Object} config - 설정 객체
	 * @param {Object} pathResolver - PathResolver 인스턴스
	 * @param {Object} importResolver - ImportResolver 인스턴스
	 * @param {Object} naming - NamingConventions 인스턴스
	 * @param {Object} generators - 모든 Generator 인스턴스들
	 */
	constructor(config, pathResolver, importResolver, naming, generators = {}) {
		this.config = config
		this.pathResolver = pathResolver
		this.importResolver = importResolver
		this.naming = naming
		this.generators = generators

		// 생성 단계 정의
		this.steps = this.defineSteps()
	}

	/**
	 * 생성 단계 정의 (generateApi.js line 30-73)
	 */
	defineSteps() {
		return [
			{
				name: 'OpenAPI 타입 생성',
				description: 'schema.d.ts 파일 생성 (openapi-typescript)',
				required: true,
				executor: 'generateTypes',
			},
			{
				name: 'Swagger 태그 추출',
				description: 'tags.ts 파일 생성',
				required: true,
				executor: 'generateTags',
			},
			{
				name: 'validated 타입 생성',
				description: 'validated.ts 파일 생성',
				flagKey: 'generateValidatedTypes',
				executor: 'generateValidatedTypes',
			},
			{
				name: 'deep schema 추출',
				description: 'deepSchema.ts 파일 생성',
				flagKey: 'generateDeepSchema',
				executor: 'generateDeepSchema',
			},
			{
				name: '서버별 엔드포인트 생성',
				description: 'endpoint.ts 파일들 생성',
				flagKey: 'generateEndpoints',
				executor: 'generateEndpoints',
			},
			{
				name: '도메인 API 함수 생성',
				description: '{tag}API.ts 파일들 생성',
				flagKey: 'generateDomainAPI',
				executor: 'generateDomainAPI',
			},
			{
				name: 'React Query hooks 생성',
				description: 'useQueries.ts, useMutations.ts 파일들 생성',
				flagKey: 'generateReactQueryHooks',
				executor: 'generateReactQueryHooks',
			},
		]
	}

	/**
	 * 활성화된 단계들 필터링 (generateApi.js line 76-99)
	 */
	getEnabledSteps() {
		const featureFlags = this.config.featureFlags || {}

		return this.steps.filter((step) => {
			// required 단계는 항상 실행
			if (step.required) {
				return true
			}

			// flagKey가 있으면 featureFlags 확인
			if (step.flagKey) {
				const flag = featureFlags[step.flagKey]

				// { enabled: true } 구조
				if (flag && typeof flag === 'object' && 'enabled' in flag) {
					return flag.enabled
				}

				// boolean 구조 (하위 호환성)
				return Boolean(flag)
			}

			return true
		})
	}

	/**
	 * 전체 생성 프로세스 실행 (generateApi.js line 101-160)
	 */
	async generateAll(servers = null) {
		console.log('🚀 API 통합 생성 프로세스 시작...')
		console.log('='.repeat(60))

		const enabledSteps = this.getEnabledSteps()
		const disabledSteps = this.steps.filter((s) => !enabledSteps.includes(s) && !s.required)

		// 비활성화된 단계 표시
		if (disabledSteps.length > 0) {
			console.log('⏸️  비활성화된 단계들:')
			disabledSteps.forEach((step) => {
				console.log(`   - ${step.name} (featureFlags.${step.flagKey}: false)`)
			})
			console.log('='.repeat(60))
		}

		let completedSteps = 0
		const totalSteps = enabledSteps.length
		const results = {
			success: [],
			failed: [],
		}

		console.log(`📋 활성화된 단계: ${totalSteps}개`)
		console.log('='.repeat(60))

		// 각 단계 실행
		for (let i = 0; i < enabledSteps.length; i++) {
			const step = enabledSteps[i]

			try {
				console.log(`\n${i + 1}/${totalSteps}: ${step.name}`)
				console.log(`📝 ${step.description}`)

				// executor 실행
				if (this.generators[step.executor]) {
					await this.executeStep(step, servers)
					completedSteps++
					results.success.push(step.name)
					console.log(`✅ ${step.name} 완료!`)
				} else {
					console.warn(`⚠️  ${step.executor} generator가 없습니다. 건너뜁니다.`)
				}
			} catch (error) {
				console.error(`❌ ${step.name} 실패:`, error.message)
				results.failed.push({ name: step.name, error: error.message })

				// required 단계 실패 시 중단
				if (step.required) {
					console.error(`⚠️  필수 단계 실패로 프로세스를 중단합니다.`)
					break
				}
			}
		}

		// 결과 요약
		console.log('\n' + '='.repeat(60))
		console.log('✅ API 생성 프로세스 완료!')
		console.log(`📊 실행된 단계: ${completedSteps}/${totalSteps}`)

		if (results.success.length > 0) {
			console.log('\n✅ 성공:')
			results.success.forEach((name) => console.log(`   - ${name}`))
		}

		if (results.failed.length > 0) {
			console.log('\n❌ 실패:')
			results.failed.forEach(({ name, error }) => console.log(`   - ${name}: ${error}`))
		}

		console.log('='.repeat(60))

		return results
	}

	/**
	 * 단일 단계 실행
	 */
	async executeStep(step, servers = null) {
		const executor = this.generators[step.executor]

		if (!executor) {
			throw new Error(`${step.executor} generator not found`)
		}

		// servers가 없으면 자동 감지 (TODO: 서버 자동 감지 로직)
		const targetServers = servers || this.detectServers()

		// 각 서버에 대해 실행
		for (const server of targetServers) {
			console.log(`   🔧 ${server} 처리 중...`)
			await executor.generate(server)
		}
	}

	/**
	 * 서버 자동 감지 (임시 - TODO: 실제 구현 필요)
	 */
	detectServers() {
		// TODO: universalAutoDetect.js 로직 통합 필요
		return ['auth', 'content'] // 임시
	}

	/**
	 * 단일 서버 생성
	 */
	async generateServer(serverName) {
		console.log(`🚀 ${serverName} 서버 생성 시작...`)

		const enabledSteps = this.getEnabledSteps()

		for (const step of enabledSteps) {
			try {
				console.log(`\n📋 ${step.name}`)

				if (this.generators[step.executor]) {
					await this.executeStep(step, [serverName])
					console.log(`✅ ${step.name} 완료!`)
				}
			} catch (error) {
				console.error(`❌ ${step.name} 실패:`, error.message)

				if (step.required) {
					throw error
				}
			}
		}

		console.log(`\n✅ ${serverName} 서버 생성 완료!`)
	}

	/**
	 * 특정 단계만 실행
	 */
	async generateStep(stepName, servers = null) {
		const step = this.steps.find((s) => s.executor === stepName || s.name === stepName)

		if (!step) {
			throw new Error(`Step not found: ${stepName}`)
		}

		console.log(`🚀 ${step.name} 실행...`)

		await this.executeStep(step, servers)

		console.log(`✅ ${step.name} 완료!`)
	}

	/**
	 * 파일 쓰기 헬퍼
	 */
	writeFile(filePath, content) {
		const dir = dirname(filePath)

		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true })
		}

		writeFileSync(filePath, content, 'utf-8')
		console.log(`   💾 생성: ${filePath}`)
	}
}

/**
 * Generator 인스턴스 생성 헬퍼
 */
export function createGenerator(config, pathResolver, importResolver, naming, generators) {
	return new Generator(config, pathResolver, importResolver, naming, generators)
}

export default Generator
