#!/usr/bin/env node

/**
 * ⚙️ ConfigManager - 설정 관리 유틸리티
 *
 * openapi-codegen.config.json 파일을 로드, 검증, 병합하는 역할을 합니다.
 * 프로젝트별 설정과 기본 설정을 병합하여 완전한 설정 객체를 제공합니다.
 *
 * @description
 * - 여러 경로에서 설정 파일 자동 탐색
 * - 기본 설정과 사용자 설정 깊은 병합 (deep merge)
 * - 설정 유효성 검증
 * - 타입 안전성 보장
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * ConfigManager 클래스
 *
 * @class
 * @description 설정 파일 로드 및 관리 시스템
 */
export class ConfigManager {
  /**
   * @param {string} projectRoot - 프로젝트 루트 경로 (기본: process.cwd())
   */
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.config = null;
    this.configPath = null;
  }

  // ========================================
  // 1. 설정 파일 로드
  // ========================================

  /**
   * 설정 파일 로드 (자동 탐색)
   *
   * @param {string} customPath - 커스텀 설정 파일 경로 (선택사항)
   * @returns {Object} 로드된 설정 객체
   *
   * @example
   * const config = configManager.loadConfig()
   * const config = configManager.loadConfig('./my-config.json')
   */
  loadConfig(customPath = null) {
    // 설정 파일 탐색 경로 목록
    const possiblePaths = [
      customPath,
      join(this.projectRoot, 'scripts/api/openapi-codegen.config.json'),
      join(this.projectRoot, 'openapi-codegen.config.json'),
      join(this.projectRoot, '.openapi-codegen.config.json'),
      join(this.projectRoot, 'config/openapi-codegen.json'),
      join(this.projectRoot, '.config/openapi-codegen.json'),
    ].filter(Boolean);

    // 각 경로를 순회하며 설정 파일 찾기
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        try {
          const userConfig = JSON.parse(readFileSync(path, 'utf-8'));
          this.configPath = path;
          this.config = this.mergeWithDefaults(userConfig);
          console.log(`📋 설정 파일 로드: ${path}`);
          return this.config;
        } catch (error) {
          console.warn(`⚠️  설정 파일 파싱 실패: ${path}`, error.message);
        }
      }
    }

    // 설정 파일을 찾지 못한 경우 기본 설정 사용
    console.log('📋 기본 설정 사용 (설정 파일을 찾을 수 없음)');
    this.config = this.getDefaultConfig();
    return this.config;
  }

  /**
   * 현재 로드된 설정 반환
   *
   * @returns {Object|null} 현재 설정 객체 (없으면 null)
   */
  getConfig() {
    if (!this.config) {
      console.warn(
        '⚠️  설정이 로드되지 않았습니다. loadConfig()를 먼저 호출하세요.'
      );
    }
    return this.config;
  }

  /**
   * 설정 파일 경로 반환
   *
   * @returns {string|null} 설정 파일 경로 (없으면 null)
   */
  getConfigPath() {
    return this.configPath;
  }

  // ========================================
  // 2. 기본 설정
  // ========================================

  /**
   * 기본 설정 반환
   *
   * @returns {Object} 기본 설정 객체
   */
  getDefaultConfig() {
    return {
      projectName: 'my-project',
      projectType: 'nextjs',

      // 파일 생성 설정
      fileGeneration: {
        serverInstances: 'src/model/openAPI',
        serverInstancePattern: '{serverName}-server/instance.ts',
        domainTypes: 'src/domains/{serverName}/types',
        apiEndpoints: 'src/domains/{serverName}/api',
        files: {
          schema: 'schema.d.ts',
          validated: 'validated.ts',
          deepSchema: 'deepSchema.ts',
          endpoint: 'endpoint.ts',
          domainApi: '{tagName}API.ts',
        },
      },

      // Import 경로 설정
      imports: {
        internal: {
          apiHandlers: '@/@shared/api/handlers/apiResponse',
          serverInstance: '@/model/openAPI/{serverName}-server/instance',
          schemaTypes: '@/domains/{serverName}/types/schema',
          validatedTypes: '@/domains/{serverName}/types/validated',
          deepSchema: '@/domains/{serverName}/types/deepSchema',
          endpoint: '@/domains/{serverName}/api/endpoint',
          domainApi: '@/domains/{serverName}/api/{tagName}API',
        },
        external: {
          reactQuery: '@tanstack/react-query',
          toast: 'react-toastify',
        },
      },

      // 서버 설정
      serverSettings: {
        defaultEnvironment: 'development',
        serverNameExtraction: {
          pattern: '{serverName}-server',
          removePattern: '-server',
        },
      },

      // 환경변수 설정
      envVarConfig: {
        enabled: true,
        prefix: 'NEXT_PUBLIC_STEPIN_',
        defaultDocsSuffix: '/docs-yaml',
        customDocsSuffix: {},
      },

      // 제외/포함 서버 설정
      excludeServers: [],
      includeOnlyServers: [],

      // 기능 플래그
      featureFlags: {
        _comment:
          '각 생성 단계별 활성화/비활성화 설정 - 불필요한 파일 생성을 방지하여 빌드 시간 단축',
        _steps_order:
          '1.타입 → 2.태그 → 3.validated → 4.deepSchema → 5.엔드포인트 → 6.도메인API → 7.React Query',
        generateValidatedTypes: {
          enabled: true,
          _comment: 'validated 타입 생성 - 대부분의 프로젝트에서 필요',
        },
        generateDeepSchema: {
          enabled: true,
          _comment:
            '클라이언트용 복잡한 타입 생성 - 단순한 API만 사용하면 false로 설정',
        },
        generateEndpoints: {
          enabled: true,
          _comment: '서버별 엔드포인트 파일 생성 - API 구조화에 필수',
        },
        generateDomainAPI: {
          enabled: true,
          _comment: '도메인별 API 함수 생성 - 실제 API 호출 함수들',
        },
        generateReactQueryHooks: {
          enabled: true,
          _comment:
            'React Query 훅 생성 - React 프로젝트가 아니거나 다른 상태관리 사용시 false',
        },
      },

      // 로깅 설정
      logging: {
        _comment:
          '스크립트 실행 시 콘솔 로그 레벨 설정 - 각 레벨별로 개별 토글',
        enabled: true,
        showTimestamp: false,
        showEmoji: true,
        levels: {
          _comment: '로그 레벨 설정 - 우선순위: all > 개별설정 > none',
          all: false,
          debug: false,
          info: true,
          success: true,
          warn: true,
          error: true,
          none: false,
        },
        _presets: {
          _comment: '빠른 설정을 위한 프리셋들',
          _usage: 'all: true (모든 로그), none: true (로그 없음)',
          _priority: 'all > none > 개별설정 순서',
          _conflict: 'all과 none이 둘 다 true면 all이 승리',
        },
        _examples: {
          _comment: '다양한 조합 예시들',
          _all_on: '모든 레벨을 true로 설정',
          _production: 'warn, error만 true로 설정',
          _success_and_errors: 'success, error만 true로 설정',
          _progress_only: 'info, success만 true로 설정',
        },
        colors: {
          _comment: '각 로그 레벨별 색상 및 이모지 설정',
          debug: { emoji: '🔍', color: 'gray' },
          info: { emoji: '📋', color: 'blue' },
          success: { emoji: '✅', color: 'green' },
          warn: { emoji: '⚠️', color: 'yellow' },
          error: { emoji: '❌', color: 'red' },
        },
        categories: {
          _comment: '특정 카테고리별 로그 레벨 세부 설정',
          server_detection: 'info',
          type_generation: 'info',
          file_creation: 'info',
          api_analysis: 'debug',
          schema_parsing: 'debug',
        },
      },

      // 에러 핸들링 설정
      errorHandling: {
        _comment:
          'React Query 훅의 에러 처리 방식 설정 - 프로젝트별 에러 처리 전략에 맞춤',
        useToast: true,
        logErrors: false,
        successNotification: true,
        customErrorHandler: null,
        customSuccessHandler: null,
        customHandlers: {
          _comment:
            '커스텀 핸들러 고급 설정 - 함수명, import 경로, 파라미터 등을 정의',
          enabled: false,
          errorHandler: {
            functionName: 'handleAPIError',
            importPath: '@/utils/errorHandler',
            parameters: ['error', 'context'],
            async: false,
          },
          successHandler: {
            functionName: 'handleAPISuccess',
            importPath: '@/utils/successHandler',
            parameters: ['result', 'context'],
            async: false,
          },
          contextData: {
            _comment: '핸들러에 전달할 추가 컨텍스트 정보',
            includeEndpoint: true,
            includeTimestamp: true,
            includeUserId: false,
            customFields: {},
          },
        },
        toastMessages: {
          _comment: 'toast 메시지 커스터마이징',
          queryError: 'Query Error: {message}',
          mutationError: 'Operation Error: {message}',
          mutationSuccess: 'Operation completed successfully',
        },
        _examples: {
          _comment: '다양한 에러 처리 조합 예시',
          _production: 'useToast: false, logErrors: true (조용한 에러 처리)',
          _development: 'useToast: true, logErrors: true (상세한 에러 정보)',
          _custom: "customErrorHandler: 'handleAPIError' (커스텀 핸들러)",
        },
      },

      // 코드 생성 설정
      codeGeneration: {
        _comment_functionNaming:
          'API 함수명 생성 규칙 - HTTP 메서드별 접두사 설정',
        _example_functionNaming:
          'GET /users → fetchUsers, POST /users → createUser',
        jsdoc: {
          _comment:
            '생성된 API 함수의 JSDoc 주석 설정 - 개발자 경험 향상을 위한 문서화',
          enabled: true,
          language: 'ko',
          includeParams: true,
          includeReturns: true,
          includeExample: false,
          includeDescription: true,
          includeEndpoint: true,
          customDescriptions: {
            _comment:
              '특정 엔드포인트에 대한 커스텀 설명 - 자동 생성된 설명을 override',
            _example: "/auth/login → '사용자 로그인을 처리하는 API'",
          },
          templates: {
            _comment: '언어별 JSDoc 템플릿 설정',
            ko: {
              parameterDescription: 'API 요청 파라미터',
              bodyDescription: 'API 요청 본문 데이터',
              returnDescription: 'API 응답 데이터',
              endpointPrefix: '엔드포인트:',
              methodDescriptions: {
                get: '조회',
                post: '등록',
                put: '전체 수정',
                patch: '수정',
                delete: '삭제',
              },
            },
            en: {
              parameterDescription: 'API request parameters',
              bodyDescription: 'API request body data',
              returnDescription: 'API response data',
              endpointPrefix: 'Endpoint:',
              methodDescriptions: {
                get: 'Retrieve',
                post: 'Create',
                put: 'Update',
                patch: 'Modify',
                delete: 'Delete',
              },
            },
          },
        },
        functionNaming: {
          _comment: '각 HTTP 메서드에 대응하는 함수 접두사를 설정합니다',
          get: 'fetch',
          post: 'create',
          put: 'update',
          patch: 'modify',
          delete: 'remove',
        },
        _alternatives_functionNaming: {
          _comment: '다른 팀에서 사용할 수 있는 대안 예시들',
          _restful_style: {
            get: 'get',
            post: 'create',
            put: 'update',
            delete: 'delete',
          },
          _service_style: {
            get: 'fetch',
            post: 'add',
            put: 'replace',
            delete: 'remove',
          },
          _domain_style: {
            get: 'retrieve',
            post: 'register',
            put: 'modify',
            delete: 'deactivate',
          },
        },
      },
    };
  }

  // ========================================
  // 3. 설정 병합
  // ========================================

  /**
   * 사용자 설정과 기본 설정 깊은 병합
   *
   * @param {Object} userConfig - 사용자 설정
   * @returns {Object} 병합된 설정
   */
  mergeWithDefaults(userConfig) {
    const defaultConfig = this.getDefaultConfig();
    return this._deepMerge(defaultConfig, userConfig);
  }

  /**
   * 깊은 객체 병합 (Deep Merge)
   *
   * @param {Object} target - 대상 객체
   * @param {Object} source - 소스 객체
   * @returns {Object} 병합된 객체
   * @private
   */
  _deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        // 둘 다 객체이고 배열이 아닌 경우 재귀적으로 병합
        if (
          this._isPlainObject(sourceValue) &&
          this._isPlainObject(targetValue)
        ) {
          result[key] = this._deepMerge(targetValue, sourceValue);
        } else {
          // 그 외의 경우 source 값으로 덮어쓰기
          result[key] = sourceValue;
        }
      }
    }

    return result;
  }

  /**
   * Plain Object 여부 확인
   *
   * @param {*} value - 확인할 값
   * @returns {boolean} Plain Object 여부
   * @private
   */
  _isPlainObject(value) {
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.prototype.toString.call(value) === '[object Object]'
    );
  }

  // ========================================
  // 4. 설정 검증
  // ========================================

  /**
   * 설정 유효성 검증
   *
   * @param {Object} config - 검증할 설정 객체 (선택, 없으면 현재 설정 사용)
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateConfig(config = null) {
    const cfg = config || this.config;

    if (!cfg) {
      return {
        valid: false,
        errors: ['설정이 로드되지 않았습니다.'],
      };
    }

    const errors = [];

    // 필수 필드 검증
    if (!cfg.projectName) {
      errors.push('projectName이 정의되지 않았습니다.');
    }

    if (!cfg.fileGeneration) {
      errors.push('fileGeneration이 정의되지 않았습니다.');
    } else {
      // fileGeneration 하위 필드 검증
      if (!cfg.fileGeneration.serverInstances) {
        errors.push('fileGeneration.serverInstances가 정의되지 않았습니다.');
      }
      if (!cfg.fileGeneration.domainTypes) {
        errors.push('fileGeneration.domainTypes가 정의되지 않았습니다.');
      }
      if (!cfg.fileGeneration.apiEndpoints) {
        errors.push('fileGeneration.apiEndpoints가 정의되지 않았습니다.');
      }
    }

    if (!cfg.imports) {
      errors.push('imports가 정의되지 않았습니다.');
    }

    if (!cfg.featureFlags) {
      errors.push('featureFlags가 정의되지 않았습니다.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 설정 검증 후 에러 출력
   *
   * @param {Object} config - 검증할 설정 객체
   * @throws {Error} 설정이 유효하지 않은 경우 에러 발생
   */
  validateConfigOrThrow(config = null) {
    const result = this.validateConfig(config);

    if (!result.valid) {
      console.error('❌ 설정 검증 실패:');
      result.errors.forEach((error) => console.error(`   - ${error}`));
      throw new Error('설정 파일이 유효하지 않습니다.');
    }

    console.log('✅ 설정 검증 성공');
  }

  // ========================================
  // 5. 설정 파일 생성
  // ========================================

  /**
   * 새 설정 파일 생성
   *
   * @param {string} path - 생성할 파일 경로
   * @param {Object} config - 저장할 설정 객체 (선택, 없으면 기본 설정)
   * @param {Object} options - 옵션
   * @param {boolean} options.overwrite - 덮어쓰기 여부 (기본: false)
   * @param {boolean} options.pretty - 예쁘게 포맷팅 여부 (기본: true)
   */
  createConfig(path, config = null, options = {}) {
    const { overwrite = false, pretty = true } = options;

    // 경로가 상대 경로인 경우 절대 경로로 변환
    const absolutePath = path.startsWith('/')
      ? path
      : join(this.projectRoot, path);

    // 이미 존재하고 overwrite가 false인 경우
    if (existsSync(absolutePath) && !overwrite) {
      console.warn(`⚠️  설정 파일이 이미 존재합니다: ${absolutePath}`);
      console.warn('   덮어쓰려면 overwrite 옵션을 true로 설정하세요.');
      return false;
    }

    // 저장할 설정 객체
    const configToSave = config || this.getDefaultConfig();

    // JSON 문자열로 변환
    const jsonString = pretty
      ? JSON.stringify(configToSave, null, 2)
      : JSON.stringify(configToSave);

    try {
      writeFileSync(absolutePath, jsonString, 'utf-8');
      console.log(`✅ 설정 파일 생성: ${absolutePath}`);
      return true;
    } catch (error) {
      console.error(`❌ 설정 파일 생성 실패: ${error.message}`);
      return false;
    }
  }

  // ========================================
  // 6. 유틸리티 메서드
  // ========================================

  /**
   * Feature Flag 확인
   *
   * @param {string} flagName - 플래그 이름
   * @returns {boolean} 플래그 활성화 여부
   *
   * @example
   * isFeatureEnabled('generateReactQueryHooks')
   * // => true
   */
  isFeatureEnabled(flagName) {
    if (!this.config || !this.config.featureFlags) {
      return false;
    }

    const flag = this.config.featureFlags[flagName];

    // { enabled: true } 형태
    if (typeof flag === 'object' && flag.enabled !== undefined) {
      return flag.enabled === true;
    }

    // true/false 형태
    return flag === true;
  }

  /**
   * 로그 레벨 확인
   *
   * @param {string} level - 로그 레벨 (debug, info, success, warn, error)
   * @returns {boolean} 로그 레벨 활성화 여부
   */
  isLogLevelEnabled(level) {
    if (!this.config || !this.config.logging) {
      return level === 'error'; // 기본값: error만 출력
    }

    const logging = this.config.logging;

    // 로깅 자체가 비활성화된 경우
    if (!logging.enabled) {
      return false;
    }

    const levels = logging.levels || {};

    // all이 true면 모든 레벨 활성화
    if (levels.all === true) {
      return true;
    }

    // none이 true면 모든 레벨 비활성화
    if (levels.none === true) {
      return false;
    }

    // 개별 레벨 확인
    return levels[level] === true;
  }

  /**
   * 디버깅용: 전체 설정 출력
   */
  printConfig() {
    if (!this.config) {
      console.log('설정이 로드되지 않았습니다.');
      return;
    }

    console.log('\n⚙️  ConfigManager - 현재 설정:');
    console.log(`📁 설정 파일: ${this.configPath || '(기본 설정)'}`);
    console.log('\n설정 내용:');
    console.log(JSON.stringify(this.config, null, 2));
  }
}

/**
 * ConfigManager 인스턴스 생성 헬퍼
 *
 * @param {string} projectRoot - 프로젝트 루트 경로
 * @returns {ConfigManager} ConfigManager 인스턴스
 *
 * @example
 * import { createConfigManager } from './utils/ConfigManager.js'
 * const configManager = createConfigManager()
 * const config = configManager.loadConfig()
 */
export function createConfigManager(projectRoot = process.cwd()) {
  return new ConfigManager(projectRoot);
}

/**
 * 설정 로드 헬퍼 함수 (기존 코드 호환성)
 *
 * @param {string} configPath - 설정 파일 경로 (선택사항)
 * @param {string} projectRoot - 프로젝트 루트 경로
 * @returns {Object} 로드된 설정 객체
 *
 * @example
 * import { loadConfig } from './utils/ConfigManager.js'
 * const config = loadConfig()
 */
export function loadConfig(configPath = null, projectRoot = process.cwd()) {
  const manager = new ConfigManager(projectRoot);
  return manager.loadConfig(configPath);
}

/**
 * 기본 export
 */
export default ConfigManager;
