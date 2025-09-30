#!/usr/bin/env node

/**
 * 2단계 테스트: tags.ts 생성 (TagsGenerator)
 */

import { readFileSync, writeFileSync } from 'fs'
import { ConfigManager } from './src/core/ConfigManager.js'
import { PathResolver } from './src/core/PathResolver.js'
import { TagsGenerator } from './src/generators/TagsGenerator.js'
import { NamingConventions } from './src/utils/NamingConventions.js'

const EVENT_STEPIN_ROOT = '/Users/kim-yeonju/Github/event-stepin-ai'
const SERVER_NAME = 'auth'

console.log('🏷️  2단계 테스트: tags.ts 생성')
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

	// 3. TagsGenerator로 tags.ts 생성
	console.log('\n2️⃣ TagsGenerator로 tags.ts 생성 중...')
	const tagsGenerator = new TagsGenerator(config, pathResolver, naming)
	const generatedContent = tagsGenerator.generate(SERVER_NAME)

	console.log('✅ tags.ts 생성 완료')
	console.log(`   크기: ${generatedContent.length} bytes`)
	console.log(`   줄 수: ${generatedContent.split('\n').length} lines`)

	// 4. 생성된 내용 미리보기
	console.log('\n3️⃣ 생성된 tags.ts 미리보기:')
	console.log('-'.repeat(60))
	console.log(generatedContent.split('\n').slice(0, 30).join('\n'))
	console.log('-'.repeat(60))

	// 5. 임시 파일로 저장
	const outputPath = `/tmp/toolkit-test-tags.ts`
	writeFileSync(outputPath, generatedContent)
	console.log(`\n✅ 테스트 파일 저장: ${outputPath}`)

	console.log('\n✅ 2단계 테스트 완료!')
	console.log('='.repeat(60))

} catch (error) {
	console.error('\n❌ 테스트 실패:', error.message)
	console.error(error.stack)
	process.exit(1)
}
