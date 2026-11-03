# 매일혈압

두 사람이 각자의 계정으로 로그인해서 쓰는 모바일 중심 혈압 기록장입니다. Next.js App Router, TypeScript, Supabase Auth/Postgres로 구성하며 Vercel에 배포합니다.

## 기능

- 이메일·비밀번호 로그인, 로그인 유지, 로그아웃
- 수축기·이완기 혈압, 선택 맥박·메모 입력
- 저장 시각 자동 지정: 실제 기록은 DB 서버 시각, 체험은 기기 시각
- 최근 기록, 7·30·90일 조회, 평균 혈압·맥박, 기록한 날 수
- 일별 평균 혈압 그래프, 선택 기간 CSV 다운로드, 삭제 확인
- 계정별 기록 분리: DB RLS 및 등록된 사용자 목록으로 접근 제어
- 환경변수 없이 브라우저 저장을 사용하는 명시적 체험 모드

실제 계정 사이의 기록 공유 기능은 없습니다. 체험 기록은 실제 계정으로 이전되지 않습니다. 진단이나 혈압 분류를 제공하지 않습니다.

## 로컬 실행

Node.js 22.18 이상에서 실행합니다. PowerShell 실행 정책으로 npm이 막히면 `npm.cmd`를 사용하세요.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

http://localhost:3000 에 접속합니다. `.env.local`을 작성하지 않아도 체험 모드를 사용할 수 있습니다. 체험 기록은 브라우저 저장 공간을 삭제하면 사라집니다.

## Supabase 연결

1. Supabase 프로젝트를 만들고 SQL Editor에서 `supabase/migrations/001_initial.sql`을 한 번 실행합니다.
2. Authentication → 설정에서 새 사용자 가입(Allow new users to sign up)을 **비활성화**합니다. 이메일/비밀번호 로그인은 활성화합니다.
3. Authentication → Users → Add user → Create new user에서 두 분의 이메일과 비밀번호로 계정을 직접 생성하고 이메일을 확인된 상태로 설정합니다. 앱에서는 가입·초대 메일을 보내지 않습니다.
4. 생성된 각 사용자의 UUID로 아래 SQL을 실행합니다. `<...>`를 실제 UUID로 교체합니다.

```sql
insert into public.members (user_id, display_name) values
  ('<본인 UUID>', '나'),
  ('<어머니 UUID>', '엄마');
```

5. 각 Auth 사용자의 User metadata에 `{"display_name":"나"}` 또는 `{"display_name":"엄마"}`를 설정하면 화면 상단에 해당 이름이 나옵니다. 생략하면 `회원님`으로 표시됩니다. 회원 테이블의 이름은 관리용이며 권한은 UUID로 판단합니다.
6. 프로젝트의 Connect 또는 API 설정에서 Project URL과 **publishable key**를 찾아 `.env.local`에 설정합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://실제프로젝트.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=실제_publishable_key
```

이 두 값은 클라이언트 공개 설정입니다. **secret key / service_role key는 넣지 마세요.** `.env.local`은 Git에서 제외됩니다. 환경변수를 변경한 후 개발 서버를 재시작하세요.

일반 로그인 사용자는 본인의 membership만 읽을 수 있으며 membership을 생성하거나 변경할 수 없습니다. 등록된 사용자만 본인 기록을 조회·입력·삭제할 수 있습니다. 측정 시각과 사용자 ID는 컬럼 권한으로 클라이언트 입력을 차단하고 DB 기본값으로 설정합니다. 기록 수정은 지원하지 않으며 잘못 입력한 기록은 삭제 후 새로 기록합니다. 모든 기록을 페이지 단위로 불러와 통계와 CSV가 기본 행 제한에서 잘리지 않게 합니다. 시간은 UTC로 저장하고 사용 중인 기기의 현지 시각으로 표시합니다.

## GitHub → Vercel 배포

1. GitHub에 새 **비공개** 저장소를 만든 뒤 이 폴더를 연결합니다. 환경변수 파일은 올리지 않습니다.

```sh
git init
git add .
git commit -m "Build daily blood pressure tracker"
git branch -M main
git remote add origin https://github.com/사용자명/저장소명.git
git push -u origin main
```

2. Vercel → Add New → Project에서 GitHub 저장소를 가져옵니다. Framework Preset은 Next.js, Root Directory는 기본값을 사용합니다.
3. 위 두 환경변수를 Vercel의 Production 환경에 넣고 배포합니다. Preview에서 실제 DB를 쓰려면 Preview에도 추가해야 합니다. 분리된 개발용 Supabase 프로젝트를 권장합니다.
4. Supabase Authentication → URL Configuration의 Site URL에 Vercel 운영 주소를 등록합니다.
5. 이후 main으로 push하면 Vercel이 자동 배포합니다. 환경변수 변경 시 재배포합니다.

모바일 브라우저에서 운영 주소를 연 다음 홈 화면에 추가하면 편하게 열 수 있습니다. 오프라인 저장·동기화는 지원하지 않으며 실제 기록 저장에는 인터넷 연결이 필요합니다.

## 검증

```sh
npm test
npm run typecheck
npm run build
```

Supabase 연결 후 실제 계정으로 다음을 확인하세요: A가 입력한 기록이 재로그인 후 유지되는지, B에게 보이지 않는지, 목록에 없는 C는 저장할 수 없는지, 익명 요청은 거부되는지. 운영 전 확인을 위한 SQL은 `supabase/verify.sql`에 있습니다. 실제 Supabase 프로젝트와 계정이 없으면 인증·RLS 통합 검증은 수행할 수 없습니다.

사용한 공식 문서: [Next.js](https://nextjs.org/docs/app/getting-started/installation), [Supabase 비밀번호 로그인](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
