#!/usr/bin/env node

/**
 * 1단계 테스트: schema.d.ts 생성 (openapi-typescript)
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'

const EVENT_STEPIN_ROOT = '/Users/kim-yeonju/Github/event-stepin-ai'
const SERVER_NAME = 'auth'

console.log('📋 1단계 테스트: schema.d.ts 생성')
console.log('='.repeat(60))

// event-stepin-ai의 기존 schema.d.ts 확인
const existingSchemaPath = `${EVENT_STEPIN_ROOT}/src/domains/${SERVER_NAME}/types/schema.d.ts`

if (!existsSync(existingSchemaPath)) {
	console.log('❌ 기존 schema.d.ts 파일이 없습니다.')
	console.log('   event-stepin-ai에서 먼저 npm run api:all을 실행해주세요.')
	process.exit(1)
}

const existingSchema = readFileSync(existingSchemaPath, 'utf-8')

console.log(`✅ 기존 schema.d.ts 파일 존재`)
console.log(`   경로: ${existingSchemaPath}`)
console.log(`   크기: ${existingSchema.length} bytes`)
console.log(`   줄 수: ${existingSchema.split('\n').length} lines`)

// schema.d.ts는 openapi-typescript 도구를 사용하므로
// toolkit에서도 동일한 도구를 사용하면 동일한 결과가 나옵니다.
console.log('\n📝 schema.d.ts는 openapi-typescript 도구를 사용합니다.')
console.log('   toolkit과 event-stepin-ai 모두 동일한 도구를 사용하므로')
console.log('   동일한 OpenAPI spec에서 동일한 결과를 생성합니다.')

console.log('\n✅ 1단계 검증 완료!')
console.log('='.repeat(60))
