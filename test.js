#!/usr/bin/env node

/**
 * openapi-codegen-toolkit 테스트 스크립트
 *
 * event-stepin-ai의 api-generator.config.json을 사용하여
 * 동일한 결과물이 생성되는지 테스트합니다.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// ES modules에서 __dirname 구하기
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// event-stepin-ai 프로젝트 경로
const EVENT_STEPIN_ROOT = '/Users/kim-yeonju/Github/event-stepin-ai'

// Core classes
import { ConfigManager } from './src/core/ConfigManager.js'
import { PathResolver } from './src/core/PathResolver.js'
import { ImportResolver } from './src/core/ImportResolver.js'
import { Generator } from './src/core/Generator.js'

// Generators
import { TypeGenerator } from './src/generators/TypeGenerator.js'
import { TagsGenerator } from './src/generators/TagsGenerator.js'
import { EndpointGenerator } from './src/generators/EndpointGenerator.js'
import { DomainAPIGenerator } from './src/generators/DomainAPIGenerator.js'
import { ReactQueryGenerator } from './src/generators/ReactQueryGenerator.js'

// Utils
import { NamingConventions } from './src/utils/NamingConventions.js'
import { SchemaParser } from './src/parsers/SchemaParser.js'

async function testToolkit() {
	console.log('🚀 openapi-codegen-toolkit 테스트 시작...')
	console.log('='.repeat(60))

	try {
		// 1. ConfigManager로 event-stepin-ai의 설정 파일 로드
		console.log('\n1️⃣ 설정 파일 로드 중...')
		const configManager = new ConfigManager(EVENT_STEPIN_ROOT)
		const config = configManager.loadConfig(
			join(EVENT_STEPIN_ROOT, 'scripts/api/api-generator.config.json')
		)
		console.log('✅ 설정 파일 로드 완료')
		console.log(`   프로젝트: ${config.projectName}`)
		console.log(`   타입: ${config.projectType}`)

		// 2. PathResolver, ImportResolver, NamingConventions 생성
		console.log('\n2️⃣ 유틸리티 클래스 초기화 중...')
		const pathResolver = new PathResolver(config, EVENT_STEPIN_ROOT)
		const importResolver = new ImportResolver(config, pathResolver)
		const naming = new NamingConventions(config)
		console.log('✅ 유틸리티 클래스 초기화 완료')

		// 3. 각 Generator 인스턴스 생성
		console.log('\n3️⃣ Generator 인스턴스 생성 중...')
		const generators = {
			generateTypes: null, // openapi-typescript 사용
			generateTags: new TagsGenerator(config, pathResolver, naming),
			generateValidatedTypes: new TypeGenerator(config, pathResolver, naming),
			generateDeepSchema: null, // TODO: DeepSchemaGenerator 구현 필요
			generateEndpoints: new EndpointGenerator(config, pathResolver, naming),
			generateDomainAPI: new DomainAPIGenerator(config, pathResolver, importResolver, naming),
			generateReactQueryHooks: new ReactQueryGenerator(config, pathResolver, importResolver, naming),
		}
		console.log('✅ Generator 인스턴스 생성 완료')

		// 4. Main Generator 생성
		console.log('\n4️⃣ Main Generator 생성 중...')
		const generator = new Generator(config, pathResolver, importResolver, naming, generators)
		console.log('✅ Main Generator 생성 완료')

		// 5. 테스트: auth 서버의 tags.ts 생성
		console.log('\n5️⃣ 테스트: auth 서버 tags.ts 생성...')
		const serverName = 'auth'

		// schema.d.ts 파일이 존재하는지 확인
		const schemaPath = pathResolver.getSchemaPath(serverName)
		console.log(`   Schema 파일 경로: ${schemaPath}`)

		try {
			const schemaContent = readFileSync(schemaPath, 'utf-8')
			console.log(`   ✅ Schema 파일 존재 (${schemaContent.length} bytes)`)

			// tags.ts 생성
			const tagsContent = generators.generateTags.generate(serverName)
			console.log(`   ✅ tags.ts 생성 완료 (${tagsContent.length} bytes)`)
			console.log('\n   생성된 tags.ts 미리보기:')
			console.log('   ' + '-'.repeat(56))
			console.log(tagsContent.split('\n').slice(0, 20).map(line => '   ' + line).join('\n'))
			console.log('   ' + '-'.repeat(56))

		} catch (error) {
			console.error(`   ❌ 오류: ${error.message}`)
		}

		// 6. 테스트: SchemaParser
		console.log('\n6️⃣ 테스트: SchemaParser...')
		const schemaParser = new SchemaParser(pathResolver.getSchemaPath(serverName))
		schemaParser.loadSchema()
		const paths = schemaParser.extractAllPaths()
		console.log(`   ✅ 총 ${paths.length}개의 경로 발견`)
		console.log(`   경로 예시: ${paths.slice(0, 5).join(', ')}`)

		console.log('\n' + '='.repeat(60))
		console.log('✅ 테스트 완료!')
		console.log('='.repeat(60))

	} catch (error) {
		console.error('\n❌ 테스트 실패:', error.message)
		console.error(error.stack)
		process.exit(1)
	}
}

// 실행
testToolkit()
