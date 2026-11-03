# 매일혈압

두 사람이 각자의 아이디로 쓰는 모바일 혈압 기록장입니다. Next.js App Router, TypeScript, Supabase Auth/Postgres, Vercel로 구성합니다.

- 사이트: https://pressure4962.vercel.app
- 소스: https://github.com/parkjin0413/pressure
- Supabase: 기존 `work` 프로젝트 (`urcdwhuiszggdaeksmcz`, 서울 리전)
- 로그인 ID: `parkjin0413`, `ksn4962` (전체 `@pressure.com` 주소도 입력 가능)

## 사용 방법

로그인 → 혈압 기록하기 → 수축기·이완기 입력 → 저장합니다. 맥박과 메모는 선택입니다. 실제 기록은 DB 서버의 현재 시각으로 저장되고 기기의 현지 시각으로 표시됩니다. 기록 내역, 7·30·90일 통계, 일별 평균 그래프, CSV 다운로드, 삭제를 지원합니다. 두 계정은 서로의 기록을 볼 수 없습니다.

최초 생성 비밀번호는 **이 PC의 `.env.accounts.local`** 에만 저장합니다. Git과 Vercel 업로드에서 제외됩니다. 주소는 로그인 식별자로 사용하며 메일은 보내지 않습니다. 비밀번호를 변경했다면 로컬 생성 파일의 이전 비밀번호는 더 이상 유효하지 않습니다. 관리자는 Supabase Authentication에서 해당 사용자의 비밀번호를 재설정할 수 있습니다.

체험 기록은 해당 브라우저에만 저장되고 실제 계정으로 이전되지 않습니다. 오프라인 동기화와 진단 기능은 제공하지 않습니다.

## 기존 work 사이트와 분리

| 대상 | 혈압 앱의 처리 |
| --- | --- |
| 테이블 | `public.pressure_members`, `public.pressure_readings`만 사용 |
| 기존 테이블·권한·정책 | 변경하지 않음 |
| 공통 Auth 설정·Site URL | 변경하지 않음 |
| 계정 | 메일 발송 없이 전용 두 계정 직접 생성 |
| 접근 권한 | 등록된 혈압 회원이 본인 기록만 조회·입력·삭제 |
| 브라우저 로그인 저장소 | 전용 키 `pressure-auth-v1` |
| 로그아웃 | `scope: 'local'`, 현재 세션만 종료 |
| 배포 | 별도 Vercel `pressure` 프로젝트·GitHub 저장소 |

서버, 인증 사용자 목록, 저장 공간과 사용량 한도는 공유합니다. 서버 장애나 한도 초과까지 분리되지는 않습니다. 기존 앱의 접근 정책을 추가·변경할 때도 혈압 계정에 기존 데이터 접근 권한이 생기지 않는지 확인해야 합니다.

일반 사용자는 혈압 회원을 추가·수정할 수 없습니다. 혈압 앱의 가입 기능은 없고 공통 가입 설정은 변경하지 않습니다. 기록 사용자 ID와 시각은 DB 기본값으로 정하며 클라이언트의 덮어쓰기 권한은 차단합니다. 잘못 입력한 기록은 삭제 후 다시 기록합니다.

## 로컬 실행

Node.js 22.18 이상에서 실행합니다. PowerShell 실행 정책 오류가 나면 `npm.cmd`를 사용하세요.

```sh
npm ci
npm run dev
```

http://localhost:3000 에 접속합니다. `.env.example`을 참고해 `.env.local`에 다음 두 공개 설정을 넣습니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://urcdwhuiszggdaeksmcz.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=프로젝트의_publishable_key_또는_anon_key
```

`secret` 또는 `service_role` 키를 `NEXT_PUBLIC_*` 변수에 넣지 마세요. 실제 환경변수와 비밀번호 파일은 커밋하지 않습니다.

## 배포

Vercel `pressure`는 GitHub `main` 브랜치에 연결되어 push 시 운영 배포가 생성됩니다. Production과 Development에 공개 Supabase 설정을 등록합니다. Preview에는 운영 DB 설정을 자동 복사하지 않습니다. 환경변수 변경 후 재배포해야 적용됩니다.

공유 Supabase의 Site URL을 혈압 주소로 바꾸거나 공통 회원가입을 끄면 기존 앱에 영향을 줄 수 있으므로 변경하지 마세요. 이 앱은 이메일 리디렉션 없는 비밀번호 로그인을 사용합니다.

## 관리와 검증

```sh
npm test
npm run typecheck
npm run build
```

관리 스크립트는 로그인된 Supabase CLI가 있는 Windows 환경에서 실행합니다. 대상 프로젝트를 명시하며 관리자 키는 메모리에서만 사용하고 출력·저장하지 않습니다.

- `scripts/provision-pressure.mjs`: 초기 구성. 기존 일반 계정을 덮어쓰지 않습니다.
- `scripts/verify-pressure.mjs`: 두 계정 로그인, 서버 시각 저장, 계정 간 조회·삭제 차단, 익명·비회원 접근 차단, ID·시각 위조 차단, 기존 work 데이터 접근 차단, 로그아웃 격리 검증. 임시 기록은 삭제합니다.
- `scripts/configure-vercel.mjs`: 공개 연결 값 두 개만 Vercel `pressure`에 stdin으로 전달합니다.
- `supabase/migrations/001_initial.sql`: 혈압 전용 객체 정의. 이미 적용한 DB에서 다시 실행하지 마세요.
- `supabase/isolation-snapshot.sql`: 기존 구조·권한·정책·인증 트리거의 변경 여부 확인. 기존 앱의 데이터는 읽지 않습니다.
- `supabase/verify.sql`: 혈압 테이블 RLS·컬럼 권한 확인.
- `supabase/verify-nonmember.sql`: 관련 없는 인증 사용자의 혈압 기록 접근 차단 검증.

운영에서는 각 계정으로 본인 기록만 보이는지 확인하세요. 로컬 계정 파일과 관리자 스크립트는 배포되지 않습니다.
