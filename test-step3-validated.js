#!/usr/bin/env node

/**
 * 3단계 테스트: validated.ts 생성 (TypeGenerator)
 */

import { readFileSync, writeFileSync } from 'fs'
import { ConfigManager } from './src/core/ConfigManager.js'
import { PathResolver } from './src/core/PathResolver.js'
import { TypeGenerator } from './src/generators/TypeGenerator.js'
import { NamingConventions } from './src/utils/NamingConventions.js'

const EVENT_STEPIN_ROOT = '/Users/kim-yeonju/Github/event-stepin-ai'
const SERVER_NAME = 'auth'

console.log('📝 3단계 테스트: validated.ts 생성')
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

	// 3. TypeGenerator로 validated.ts 생성
	console.log('\n2️⃣ TypeGenerator로 validated.ts 생성 중...')
	const typeGenerator = new TypeGenerator(config, pathResolver, naming)
	const generatedContent = typeGenerator.generate(SERVER_NAME)

	console.log('✅ validated.ts 생성 완료')
	console.log(`   크기: ${generatedContent.length} bytes`)
	console.log(`   줄 수: ${generatedContent.split('\n').length} lines`)

	// 4. 생성된 타입 개수 확인
	const typeCount = (generatedContent.match(/export type/g) || []).length
	const paramsCount = (generatedContent.match(/_Params/g) || []).length
	const bodyCount = (generatedContent.match(/_Body/g) || []).length
	const responseCount = (generatedContent.match(/_Response/g) || []).length
	const roCount = (generatedContent.match(/_RO/g) || []).length

	console.log('\n3️⃣ 생성된 타입 통계:')
	console.log(`   전체 타입: ${typeCount}개`)
	console.log(`   Params 타입: ${paramsCount}개`)
	console.log(`   Body 타입: ${bodyCount}개`)
	console.log(`   Response 타입: ${responseCount}개`)
	console.log(`   RO 타입: ${roCount}개`)

	// 5. 생성된 내용 미리보기
	console.log('\n4️⃣ 생성된 validated.ts 미리보기:')
	console.log('-'.repeat(60))
	console.log(generatedContent.split('\n').slice(0, 50).join('\n'))
	console.log('-'.repeat(60))

	// 6. 임시 파일로 저장
	const outputPath = `/tmp/toolkit-test-validated.ts`
	writeFileSync(outputPath, generatedContent)
	console.log(`\n✅ 테스트 파일 저장: ${outputPath}`)

	// 7. 기존 파일과 비교
	const existingPath = `${EVENT_STEPIN_ROOT}/src/domains/${SERVER_NAME}/types/validated.ts`
	const existingContent = readFileSync(existingPath, 'utf-8')
	const existingTypeCount = (existingContent.match(/export type/g) || []).length

	console.log('\n5️⃣ 기존 파일과 비교:')
	console.log(`   기존 타입 개수: ${existingTypeCount}개`)
	console.log(`   새로 생성된 타입 개수: ${typeCount}개`)
	console.log(`   차이: ${typeCount - existingTypeCount}개`)

	if (typeCount === existingTypeCount) {
		console.log('   ✅ 타입 개수 일치!')
	} else {
		console.log('   ⚠️  타입 개수가 다릅니다.')
	}

	console.log('\n✅ 3단계 테스트 완료!')
	console.log('='.repeat(60))

} catch (error) {
	console.error('\n❌ 테스트 실패:', error.message)
	console.error(error.stack)
	process.exit(1)
}
