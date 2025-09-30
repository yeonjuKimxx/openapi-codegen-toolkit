# @stepin/openapi-codegen

OpenAPI 스펙으로부터 TypeScript API 클라이언트 코드를 자동 생성하는 도구입니다.

## 주요 기능

- **TypeScript 타입 생성**: OpenAPI 스펙으로부터 완전한 타입 정의 자동 생성
- **Validated 타입**: API 응답 검증용 타입 생성
- **Deep Schema**: 클라이언트용 복잡한 스키마 타입 생성
- **Domain API 함수**: 도메인별로 구조화된 API 호출 함수 생성
- **Endpoint 상수**: API 엔드포인트 경로 상수 생성
- **React Query Hooks**: React Query 훅 자동 생성 (선택적)
- **다중 서버 지원**: 여러 OpenAPI 서버를 동시에 관리

## 설치

```bash
npm install @stepin/openapi-codegen --save-dev
```

또는

```bash
yarn add -D @stepin/openapi-codegen
```

## 빠른 시작

### 1. 프로젝트 초기화

```bash
npx @stepin/openapi-codegen init
```

### 2. 설정 파일 작성

프로젝트 루트에 `openapi-codegen.config.json` 파일을 생성합니다:

```json
{
  "projectName": "my-project",
  "projectType": "nextjs",

  "envVarConfig": {
    "enabled": true,
    "prefix": "NEXT_PUBLIC_STEPIN_",
    "defaultDocsSuffix": "/docs-yaml"
  },

  "fileGeneration": {
    "serverInstances": "src/api/servers",
    "domainTypes": "src/types/{serverName}",
    "apiEndpoints": "src/api/{serverName}"
  },

  "imports": {
    "internal": {
      "apiHandlers": "@/@shared/api/handlers/apiResponse",
      "serverInstance": "@/api/servers/{serverName}/instance",
      "schemaTypes": "@/types/{serverName}/schema",
      "validatedTypes": "@/types/{serverName}/validated"
    },
    "external": {
      "reactQuery": "@tanstack/react-query"
    }
  },

  "featureFlags": {
    "generateValidatedTypes": { "enabled": true },
    "generateDeepSchema": { "enabled": true },
    "generateEndpoints": { "enabled": true },
    "generateDomainAPI": { "enabled": true },
    "generateReactQueryHooks": { "enabled": true }
  }
}
```

### 3. 환경변수 설정

`.env.local` 또는 `.env` 파일에 OpenAPI 서버 URL을 추가합니다:

```bash
NEXT_PUBLIC_STEPIN_AUTH=https://api.example.com/auth
NEXT_PUBLIC_STEPIN_USER=https://api.example.com/user
NEXT_PUBLIC_STEPIN_PAYMENT=https://api.example.com/payment
```

### 4. 코드 생성

```bash
npx @stepin/openapi-codegen generate
```

## CLI 명령어

### `generate`

모든 서버의 API 코드를 생성합니다.

```bash
# 모든 서버 생성
npx @stepin/openapi-codegen generate

# 특정 서버만 생성
npx @stepin/openapi-codegen generate --server auth

# 커스텀 설정 파일 사용
npx @stepin/openapi-codegen generate --config ./config/api.json

# 특정 단계만 실행
npx @stepin/openapi-codegen generate --steps types,api

# Dry run (파일 생성 없이 시뮬레이션)
npx @stepin/openapi-codegen generate --dry-run
```

### `init`

프로젝트 초기화 및 설정 파일을 생성합니다.

```bash
# Next.js 프로젝트 초기화
npx @stepin/openapi-codegen init --type nextjs

# React 프로젝트 초기화
npx @stepin/openapi-codegen init --type react

# React Native 프로젝트 초기화
npx @stepin/openapi-codegen init --type react-native

# 기존 설정 파일 덮어쓰기
npx @stepin/openapi-codegen init --force
```

### `validate`

설정 파일의 유효성을 검증합니다.

```bash
npx @stepin/openapi-codegen validate
npx @stepin/openapi-codegen validate --config ./config/api.json
```

### `info`

패키지 정보를 표시합니다.

```bash
npx @stepin/openapi-codegen info
```

### `examples`

사용 예시를 표시합니다.

```bash
npx @stepin/openapi-codegen examples
```

## 생성되는 파일 구조

```
src/
├── api/
│   ├── servers/
│   │   ├── auth/
│   │   │   └── instance.ts          # Axios 인스턴스
│   │   └── user/
│   │       └── instance.ts
│   ├── auth/
│   │   ├── authentication/
│   │   │   ├── endpoint.ts          # 엔드포인트 상수
│   │   │   ├── authenticationAPI.ts # API 함수들
│   │   │   └── useAuthenticationAPI.ts # React Query 훅
│   │   └── users/
│   │       ├── endpoint.ts
│   │       ├── usersAPI.ts
│   │       └── useUsersAPI.ts
│   └── user/
│       └── ...
└── types/
    ├── auth/
    │   ├── schema.d.ts              # 기본 타입 정의
    │   ├── tags.ts                  # 태그 목록
    │   ├── validated.ts             # Validated 타입
    │   └── deepSchema.ts            # Deep Schema 타입
    └── user/
        └── ...
```

## 프로그래밍 방식 사용

### 전체 코드 생성

```javascript
import { createGenerator, loadConfig } from '@stepin/openapi-codegen'

const config = loadConfig('./openapi-codegen.config.json')
const generator = createGenerator(config)

await generator.generateAll()
```

### 특정 서버만 생성

```javascript
import { createGenerator, loadConfig } from '@stepin/openapi-codegen'

const config = loadConfig()
const generator = createGenerator(config)

await generator.generateForServer('auth')
```

### 개별 Generator 사용

```javascript
import {
  createTypeGenerator,
  createDomainAPIGenerator,
  createReactQueryGenerator,
  loadConfig
} from '@stepin/openapi-codegen'

const config = loadConfig()

// TypeScript 타입 생성
const typeGen = createTypeGenerator(config)
await typeGen.generate('auth')

// Domain API 함수 생성
const apiGen = createDomainAPIGenerator(config)
await apiGen.generate('auth', 'authentication')

// React Query 훅 생성
const queryGen = createReactQueryGenerator(config)
await queryGen.generate('auth', 'authentication')
```

## 설정 옵션

### 필수 설정

| 옵션 | 설명 | 예시 |
|------|------|------|
| `projectName` | 프로젝트 이름 | `"my-project"` |
| `projectType` | 프로젝트 타입 | `"nextjs"`, `"react"`, `"react-native"` |

### 파일 생성 설정 (`fileGeneration`)

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `serverInstances` | 서버 인스턴스 생성 경로 | `"src/api/servers"` |
| `domainTypes` | 타입 파일 생성 경로 | `"src/types/{serverName}"` |
| `apiEndpoints` | API 파일 생성 경로 | `"src/api/{serverName}"` |

### Import 경로 설정 (`imports`)

```json
{
  "imports": {
    "internal": {
      "apiHandlers": "@/@shared/api/handlers/apiResponse",
      "serverInstance": "@/api/servers/{serverName}/instance",
      "schemaTypes": "@/types/{serverName}/schema",
      "validatedTypes": "@/types/{serverName}/validated"
    },
    "external": {
      "reactQuery": "@tanstack/react-query",
      "toast": "react-toastify"
    }
  }
}
```

### 환경변수 설정 (`envVarConfig`)

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `enabled` | 환경변수 자동 탐색 활성화 | `true` |
| `prefix` | 환경변수 접두사 | `"NEXT_PUBLIC_STEPIN_"` |
| `defaultDocsSuffix` | OpenAPI 문서 경로 접미사 | `"/docs-yaml"` |

### 기능 플래그 (`featureFlags`)

| 플래그 | 설명 | 기본값 |
|--------|------|--------|
| `generateValidatedTypes` | Validated 타입 생성 | `true` |
| `generateDeepSchema` | Deep Schema 생성 | `false` |
| `generateEndpoints` | Endpoint 상수 생성 | `true` |
| `generateDomainAPI` | Domain API 함수 생성 | `true` |
| `generateReactQueryHooks` | React Query 훅 생성 | `false` |

### 코드 생성 설정 (`codeGeneration`)

```json
{
  "codeGeneration": {
    "jsdoc": {
      "enabled": true,
      "language": "ko",
      "includeParams": true,
      "includeReturns": true,
      "includeExample": false
    },
    "functionNaming": {
      "get": "fetch",
      "post": "create",
      "put": "update",
      "patch": "modify",
      "delete": "remove"
    }
  }
}
```

### 에러 핸들링 설정 (`errorHandling`)

```json
{
  "errorHandling": {
    "useToast": false,
    "logErrors": true,
    "successNotification": false,
    "customHandlers": {
      "enabled": false,
      "errorHandler": {
        "functionName": "handleAPIError",
        "importPath": "@/utils/errorHandler"
      }
    }
  }
}
```

## 사용 예시

### 생성된 API 함수 사용

```typescript
import { loginAPI } from '@/api/auth/authentication/authenticationAPI'

// API 호출
const result = await loginAPI({
  body: {
    email: 'user@example.com',
    password: 'password123'
  }
})

if (result.success) {
  console.log('로그인 성공:', result.data)
} else {
  console.error('로그인 실패:', result.error)
}
```

### React Query 훅 사용

```typescript
import { useLoginAPI } from '@/api/auth/authentication/useAuthenticationAPI'

function LoginForm() {
  const loginMutation = useLoginAPI()

  const handleLogin = () => {
    loginMutation.mutate({
      email: 'user@example.com',
      password: 'password123'
    })
  }

  return (
    <button onClick={handleLogin} disabled={loginMutation.isPending}>
      {loginMutation.isPending ? '로그인 중...' : '로그인'}
    </button>
  )
}
```

### Endpoint 상수 사용

```typescript
import { AUTHENTICATION_ENDPOINTS } from '@/api/auth/authentication/endpoint'

console.log(AUTHENTICATION_ENDPOINTS.login) // "/auth/login"
```

## 고급 사용법

### 커스텀 서버 탐지

```json
{
  "serverSettings": {
    "defaultEnvironment": "production",
    "serverNameExtraction": {
      "pattern": "{serverName}",
      "removePattern": "_SERVER"
    }
  }
}
```

### 특정 서버 제외/포함

```json
{
  "excludeServers": ["legacy", "deprecated"],
  "includeOnlyServers": ["auth", "user"]
}
```

### 로깅 설정

```json
{
  "logging": {
    "enabled": true,
    "showTimestamp": false,
    "showEmoji": true,
    "levels": {
      "debug": false,
      "info": true,
      "success": true,
      "warn": true,
      "error": true
    }
  }
}
```

## 트러블슈팅

### OpenAPI 문서를 찾을 수 없는 경우

환경변수가 올바르게 설정되었는지 확인하세요:

```bash
# 환경변수 확인
echo $NEXT_PUBLIC_STEPIN_AUTH
```

### 타입 생성 실패

OpenAPI 스펙이 유효한지 확인하세요:

```bash
# 설정 파일 검증
npx @stepin/openapi-codegen validate
```

### Import 경로 오류

`tsconfig.json`의 path 설정을 확인하세요:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## 개발

```bash
# 저장소 클론
git clone https://github.com/yeonjuKimxx/openapi-codegen-toolkit.git

# 의존성 설치
npm install

# 테스트
npm test

# 로컬 테스트
npm link
npx @stepin/openapi-codegen generate
```

## 라이선스

MIT

## 기여

이슈와 풀 리퀘스트는 언제나 환영합니다!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 관련 링크

- [GitHub Repository](https://github.com/yeonjuKimxx/openapi-codegen-toolkit)
- [Issues](https://github.com/yeonjuKimxx/openapi-codegen-toolkit/issues)
- [OpenAPI Specification](https://swagger.io/specification/)
- [openapi-typescript](https://github.com/drwpow/openapi-typescript)
