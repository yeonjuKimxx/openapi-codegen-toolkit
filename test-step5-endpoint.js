#!/usr/bin/env node

/**
 * 5단계 테스트: endpoint.ts 생성 (EndpointGenerator)
 *
 * 4단계(deepSchema.ts)는 건너뛰고 5단계 진행
 */

import { writeFileSync } from 'fs'
import { ConfigManager } from './src/core/ConfigManager.js'
import { PathResolver } from './src/core/PathResolver.js'
import { EndpointGenerator } from './src/generators/EndpointGenerator.js'
import { NamingConventions } from './src/utils/NamingConventions.js'

const EVENT_STEPIN_ROOT = '/Users/kim-yeonju/Github/event-stepin-ai'
const SERVER_NAME = 'auth'
const TAG_NAME = 'auth' // auth 태그의 endpoint.ts 테스트

console.log('📡 5단계 테스트: endpoint.ts 생성')
console.log('='.repeat(60))

try {
	// 1. 설정 로드
	console.log('\n1️⃣ 설정 로드 중...')
	const configManager = new ConfigManager(EVENT_STEPIN_ROOT)
	const config = configManager.loadConfig()
	console.log('✅ 설정 로드 완료')

	// 2. PathResolver, NamingConventions 생성
	const pathResolver = new PathResolver(config, EVENT_STEPIN_ROOT)
	const naming = new NamingConventions(config)

	// 3. EndpointGenerator로 endpoint.ts 생성
	console.log('\n2️⃣ EndpointGenerator로 endpoint.ts 생성 중...')
	const endpointGenerator = new EndpointGenerator(config, pathResolver, naming)
	const generatedContent = endpointGenerator.generate(SERVER_NAME, TAG_NAME)

	console.log('✅ endpoint.ts 생성 완료')
	console.log(`   크기: ${generatedContent.length} bytes`)
	console.log(`   줄 수: ${generatedContent.split('\n').length} lines`)

	// 4. 생성된 엔드포인트 개수 확인
	const apiMatches = generatedContent.match(/AUTH_API\s*=\s*\{([\s\S]*?)\}/)?.[1] || ''
	const helperMatches = generatedContent.match(/AUTH_HELPERS\s*=\s*\{([\s\S]*?)\}/)?.[1] || ''

	const staticCount = (apiMatches.match(/:\s*'[^']+'/g) || []).length
	const dynamicCount = (helperMatches.match(/:\s*\(/g) || []).length

	console.log('\n3️⃣ 생성된 엔드포인트 통계:')
	console.log(`   정적 엔드포인트: ${staticCount}개`)
	console.log(`   동적 엔드포인트: ${dynamicCount}개`)
	console.log(`   전체: ${staticCount + dynamicCount}개`)

	// 5. 생성된 내용 미리보기
	console.log('\n4️⃣ 생성된 endpoint.ts 미리보기:')
	console.log('-'.repeat(60))
	console.log(generatedContent)
	console.log('-'.repeat(60))

	// 6. 임시 파일로 저장
	const outputPath = `/tmp/toolkit-test-endpoint.ts`
	writeFileSync(outputPath, generatedContent)
	console.log(`\n✅ 테스트 파일 저장: ${outputPath}`)

	console.log('\n✅ 5단계 테스트 완료!')
	console.log('='.repeat(60))

} catch (error) {
	console.error('\n❌ 테스트 실패:', error.message)
	console.error(error.stack)
	process.exit(1)
}
