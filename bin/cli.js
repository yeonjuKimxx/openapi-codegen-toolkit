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
	.option('-c, --config <path>', '설정 파일 경로', './openapi-codegen.config.json')
	.option('-s, --server <name>', '특정 서버만 생성')
	.option('--steps <steps>', '특정 단계만 실행 (쉼표로 구분)')
	.option('--dry-run', '실제 파일 생성 없이 시뮬레이션')
	.action(async (options) => {
		try {
			console.log('🚀 OpenAPI CodeGen 시작...')

			// 모든 필요한 클래스 import
			const { ConfigManager } = await import('../src/core/ConfigManager.js')
			const { Generator } = await import('../src/core/Generator.js')
			const { PathResolver } = await import('../src/core/PathResolver.js')
			const { ImportResolver } = await import('../src/core/ImportResolver.js')
			const { NamingConventions } = await import('../src/utils/NamingConventions.js')
			const { SchemaGenerator } = await import('../src/generators/SchemaGenerator.js')
			const { TypeGenerator } = await import('../src/generators/TypeGenerator.js')
			const { TagsGenerator } = await import('../src/generators/TagsGenerator.js')
			const { EndpointGenerator } = await import('../src/generators/EndpointGenerator.js')
			const { DomainAPIGenerator } = await import('../src/generators/DomainAPIGenerator.js')
			const { ReactQueryGenerator } = await import('../src/generators/ReactQueryGenerator.js')
			const { DeepSchemaGenerator } = await import('../src/generators/DeepSchemaGenerator.js')

			// 설정 파일 로드
			const configManager = new ConfigManager()
			const config = configManager.loadConfig(options.config)

			if (!config) {
				console.error('❌ 설정 파일을 찾을 수 없습니다.')
				process.exit(1)
			}

			// 설정 검증
			configManager.validateConfigOrThrow(config)

			// PathResolver, ImportResolver, NamingConventions 인스턴스 생성
			const pathResolver = new PathResolver(config)
			const importResolver = new ImportResolver(config, pathResolver)
			const naming = new NamingConventions(config)

			// 모든 Generator 인스턴스 생성
			const generators = {
				generateTypes: new SchemaGenerator(config, pathResolver),
				generateTags: new TagsGenerator(config, pathResolver, importResolver, naming),
				generateValidatedTypes: new TypeGenerator(config, pathResolver, importResolver, naming),
				generateDeepSchema: new DeepSchemaGenerator(config, pathResolver, importResolver, naming),
				generateEndpoints: new EndpointGenerator(config, pathResolver, importResolver, naming),
				generateDomainAPI: new DomainAPIGenerator(config, pathResolver, importResolver, naming),
				generateReactQueryHooks: new ReactQueryGenerator(config, pathResolver, importResolver, naming),
			}

			// Generator 인스턴스 생성 (모든 의존성 전달)
			const generator = new Generator(config, pathResolver, importResolver, naming, generators)

			// 코드 생성 실행
			if (options.server) {
				console.log(`📦 서버: ${options.server}`)
				await generator.generateForServer(options.server)
			} else {
				console.log('📦 모든 서버 생성')
				await generator.generateAll()
			}

			console.log('\n✅ 코드 생성 완료!')
		} catch (error) {
			console.error('❌ 생성 실패:', error.message)
			console.error(error.stack)
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
			console.log(`📦 프로젝트 타입: ${options.type}`)

			// ConfigManager import
			const { ConfigManager } = await import('../src/core/ConfigManager.js')
			const configManager = new ConfigManager()

			// 프로젝트 타입별 기본 설정
			const defaultConfig = configManager.getDefaultConfig()
			defaultConfig.projectType = options.type
			defaultConfig.projectName = 'my-project'

			// 설정 파일 경로
			const configPath = './openapi-codegen.config.json'

			// 설정 파일 생성
			const success = configManager.createConfig(configPath, defaultConfig, {
				overwrite: options.force,
				pretty: true,
			})

			if (success) {
				console.log('\n✅ 초기화 완료!')
				console.log('\n다음 단계:')
				console.log('1. openapi-codegen.config.json 파일을 프로젝트에 맞게 수정하세요')
				console.log('2. .env 파일에 OpenAPI 서버 URL을 추가하세요')
				console.log('   예: NEXT_PUBLIC_STEPIN_AUTH=https://api.example.com')
				console.log('3. npx openapi-codegen generate 명령어로 코드를 생성하세요')
			}
		} catch (error) {
			console.error('❌ 초기화 실패:', error.message)
			process.exit(1)
		}
	})

// validate 커맨드
program
	.command('validate')
	.description('설정 파일 유효성 검증')
	.option('-c, --config <path>', '설정 파일 경로', './openapi-codegen.config.json')
	.action(async (options) => {
		try {
			console.log('🔍 설정 파일 검증 중...')
			console.log(`📄 파일: ${options.config}`)

			// ConfigManager import
			const { ConfigManager } = await import('../src/core/ConfigManager.js')
			const configManager = new ConfigManager()

			// 설정 파일 로드
			const config = configManager.loadConfig(options.config)

			if (!config) {
				console.error('❌ 설정 파일을 찾을 수 없습니다.')
				process.exit(1)
			}

			// 설정 검증
			configManager.validateConfigOrThrow(config)

			console.log('\n✅ 설정 파일이 유효합니다!')
			console.log(`\n프로젝트 정보:`)
			console.log(`  이름: ${config.projectName}`)
			console.log(`  타입: ${config.projectType}`)
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
		console.log('\n📦 openapi-codegen')
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
		console.log('   $ npx openapi-codegen init --type nextjs\n')
		console.log('2. 모든 서버 코드 생성:')
		console.log('   $ npx openapi-codegen generate\n')
		console.log('3. 특정 서버만 생성:')
		console.log('   $ npx openapi-codegen generate --server auth\n')
		console.log('4. 특정 단계만 실행:')
		console.log('   $ npx openapi-codegen generate --steps types,api\n')
		console.log('5. 설정 파일 검증:')
		console.log('   $ npx openapi-codegen validate\n')
		console.log('6. 시뮬레이션 (dry-run):')
		console.log('   $ npx openapi-codegen generate --dry-run\n')
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
