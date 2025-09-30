#!/usr/bin/env node

/**
 * @stepin/openapi-codegen CLI
 *
 * OpenAPI 기반 TypeScript 코드 자동 생성 CLI
 */

import { Command } from 'commander'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ES modules에서 __dirname 구하기
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// package.json 읽기
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'))

// CLI 프로그램 생성
const program = new Command()

program
	.name('openapi-codegen')
	.description('OpenAPI 기반 TypeScript 코드 자동 생성 도구')
	.version(packageJson.version)

// generate 커맨드
program
	.command('generate')
	.description('모든 서버의 API 코드 생성')
	.option('-c, --config <path>', '설정 파일 경로', './api-generator.config.json')
	.option('-s, --server <name>', '특정 서버만 생성')
	.option('--steps <steps>', '특정 단계만 실행 (쉼표로 구분)')
	.option('--dry-run', '실제 파일 생성 없이 시뮬레이션')
	.action(async (options) => {
		try {
			console.log('🚀 OpenAPI CodeGen 시작...')

			// TODO: 실제 Generator 로직 연결
			// const { Generator } = await import('../src/core/Generator.js')
			// const { ConfigManager } = await import('../src/core/ConfigManager.js')
			// ...

			console.log('⚠️  아직 구현 중입니다.')
			console.log('옵션:', options)
		} catch (error) {
			console.error('❌ 생성 실패:', error.message)
			process.exit(1)
		}
	})

// init 커맨드
program
	.command('init')
	.description('프로젝트 초기화 및 설정 파일 생성')
	.option('--type <type>', '프로젝트 타입 (nextjs, react, react-native)', 'nextjs')
	.option('--force', '기존 설정 파일 덮어쓰기')
	.action(async (options) => {
		try {
			console.log('🎬 프로젝트 초기화...')
			console.log('타입:', options.type)

			// TODO: 설정 파일 생성 로직
			console.log('⚠️  아직 구현 중입니다.')
		} catch (error) {
			console.error('❌ 초기화 실패:', error.message)
			process.exit(1)
		}
	})

// validate 커맨드
program
	.command('validate')
	.description('설정 파일 유효성 검증')
	.option('-c, --config <path>', '설정 파일 경로', './api-generator.config.json')
	.action(async (options) => {
		try {
			console.log('🔍 설정 파일 검증 중...')

			// TODO: ConfigManager로 검증
			console.log('⚠️  아직 구현 중입니다.')
		} catch (error) {
			console.error('❌ 검증 실패:', error.message)
			process.exit(1)
		}
	})

// info 커맨드
program
	.command('info')
	.description('패키지 정보 표시')
	.action(() => {
		console.log('\n📦 @stepin/openapi-codegen')
		console.log(`버전: ${packageJson.version}`)
		console.log(`설명: ${packageJson.description}`)
		console.log(`라이센스: ${packageJson.license}`)
		console.log(`저자: ${packageJson.author}`)
		console.log(`저장소: ${packageJson.repository?.url || 'N/A'}`)
		console.log('\n지원하는 기능:')
		console.log('  ✅ TypeScript 타입 생성')
		console.log('  ✅ Validated 타입 생성')
		console.log('  ✅ Domain API 함수 생성')
		console.log('  ✅ React Query hooks 생성')
		console.log('  ✅ Endpoint 상수 생성')
		console.log('  ✅ Tags 추출')
		console.log('')
	})

// examples 커맨드
program
	.command('examples')
	.description('사용 예시 표시')
	.action(() => {
		console.log('\n📚 사용 예시:\n')
		console.log('1. 프로젝트 초기화:')
		console.log('   $ npx @stepin/openapi-codegen init --type nextjs\n')
		console.log('2. 모든 서버 코드 생성:')
		console.log('   $ npx @stepin/openapi-codegen generate\n')
		console.log('3. 특정 서버만 생성:')
		console.log('   $ npx @stepin/openapi-codegen generate --server auth\n')
		console.log('4. 특정 단계만 실행:')
		console.log('   $ npx @stepin/openapi-codegen generate --steps types,api\n')
		console.log('5. 설정 파일 검증:')
		console.log('   $ npx @stepin/openapi-codegen validate\n')
		console.log('6. 시뮬레이션 (dry-run):')
		console.log('   $ npx @stepin/openapi-codegen generate --dry-run\n')
		console.log('')
	})

// 에러 핸들링
program.exitOverride()

try {
	program.parse(process.argv)

	// 인수가 없으면 help 표시
	if (process.argv.length === 2) {
		program.help()
	}
} catch (error) {
	console.error('❌ CLI 에러:', error.message)
	process.exit(1)
}
