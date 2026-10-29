# BK 쇼핑몰 인터넷에 올리기 (Vercel + Neon Postgres)

모든 사람이 `https://bk-shop-xxxx.vercel.app` 같은 주소로 들어와 회원가입·주문까지 할 수 있게 만드는 방법입니다.
코딩 없이 **웹사이트에서 클릭만으로** 할 수 있어요. 처음 한 번은 20~30분 정도 걸립니다.

- **Vercel**: 사이트 화면과 서버 코드를 실행해 주는 곳
- **Neon**: 회원·주문 데이터를 저장하는 데이터베이스 (Vercel 안에서 바로 만들 수 있어요)
- **GitHub**: 코드를 올려 두는 곳 (Vercel이 여기서 코드를 가져가요)

---

## 1단계. GitHub에 가입하고 저장소 만들기
1. https://github.com 에서 **Sign up**으로 가입하고 이메일 인증까지 마칩니다.
2. 오른쪽 위 **+** → **New repository**를 누릅니다.
3. Repository name에 `bk-shop`이라고 쓰고, Public/Private 중 아무거나 고른 뒤 **Create repository**를 누릅니다.

## 2단계. 파일 올리기
1. 저장소 화면에서 **uploading an existing file** 링크를 누릅니다.
2. bk-shop 폴더를 열고 아래 파일과 폴더를 **전부 선택해서 브라우저 창으로 끌어다 놓습니다.**
   - 폴더: `api`, `public`, `private`
   - 파일: `app.js`, `server.js`, `package.json`, `vercel.json`, `.gitignore`, `.env.example`, `README.md`, `DEPLOY.md`, `START.bat`
   - ⚠️ **올리면 안 되는 것**: `.env` 파일(데이터베이스 비밀번호가 들어 있음), `node_modules` 폴더, `data` 폴더
3. **Commit changes**를 누릅니다.
4. 저장소 첫 화면에 `api`, `public`, `private` 폴더와 `vercel.json`이 보이면 성공입니다.

> 이미 예전 버전(Render용)을 올려 둔 저장소가 있다면, 새 파일을 전부 다시 올리고
> `render.yaml`과 `public/admin.html`은 저장소에서 지워 주세요. (관리자 화면은 이제 `private` 폴더에 있어요)

## 3단계. Vercel에 가입하고 프로젝트 만들기
1. https://vercel.com 에서 **Sign Up** → **Continue with GitHub**로 가입합니다. (요금제는 **Hobby**(무료) 선택)
2. 대시보드에서 **Add New…** → **Project**를 누릅니다.
3. GitHub 저장소 목록에서 `bk-shop` 옆의 **Import**를 누릅니다.
   - 목록에 없으면 **Adjust GitHub App Permissions**를 눌러 bk-shop 저장소 접근을 허용하세요.
4. 설정 화면에서
   - **Framework Preset**: `Other` (자동으로 잡혀 있으면 그대로)
   - Build Command / Output Directory 등은 **건드리지 않습니다.**
   - **Environment Variables**를 펼쳐서 하나 추가합니다.
     - Key: `ADMIN_PASSWORD`  /  Value: 관리자 페이지에 쓸 비밀번호 (예: 영문+숫자 섞어서 10자 이상)
5. **Deploy**를 누릅니다. 1~2분 뒤 축하 화면이 나오면 1차 배포 완료!
   (아직 데이터베이스를 안 붙였으니 가입·주문은 다음 단계를 마쳐야 동작해요)

## 4단계. Neon 데이터베이스 만들어서 연결하기
1. Vercel에서 방금 만든 **bk-shop 프로젝트**로 들어가 위쪽 **Storage** 탭을 누릅니다.
2. **Create Database** → 목록에서 **Neon**(Serverless Postgres)을 고르고 **Continue**.
3. 처음이면 **Create New Neon Account**를 고르고 진행합니다.
4. 설정 화면에서
   - **Region**: `Singapore` (아시아 태평양)를 고르세요. 이 사이트의 서버도 싱가포르에서 돌도록 맞춰 두었어요.
   - **Plan**: **Free** 선택
   - 데이터베이스 이름: `bk-shop-db` 등 아무거나
5. **Create**를 누르면 데이터베이스가 만들어집니다.
6. 연결 화면이 나오면 **bk-shop** 프로젝트를 고르고, Development·Preview·Production을 **모두 체크**한 뒤 **Connect**를 누릅니다.
   - 연결 화면이 바로 안 나오면: Storage 탭 → 만든 데이터베이스 → **Connect Project**
   - 이렇게 하면 `DATABASE_URL`이라는 환경변수가 프로젝트에 자동으로 들어가요. 직접 입력할 필요 없어요.

## 5단계. 다시 배포하기 (중요!)
환경변수는 **새로 배포할 때부터** 적용돼요.
1. 프로젝트의 **Deployments** 탭 → 맨 위 배포 줄 오른쪽 **⋯** → **Redeploy** → **Redeploy**를 누릅니다.
2. 1~2분 뒤 **Ready**가 되면 끝!
3. 프로젝트 첫 화면(Overview)의 **Domains**에 있는 `https://bk-shop-xxxx.vercel.app`이 **모두가 들어올 수 있는 사이트 주소**입니다.
   - BK pierce: 주소 뒤에 `/pierce`
   - 관리자 페이지: 주소 뒤에 `/admin` (아이디 `admin`, 비밀번호는 3단계에서 정한 값)

테이블(customers, sessions, orders)은 첫 요청 때 서버가 자동으로 만들어요. 따로 할 일 없습니다.

## 6단계. 잘 되는지 확인하기
1. 사이트에서 회원가입 → 주문을 한 번 해 봅니다.
2. `/admin`에 들어가서 방금 주문이 보이면 성공입니다.
3. Vercel Storage 탭 → 데이터베이스 → **Open in Neon** → **Tables**에서 실제 저장된 데이터도 볼 수 있어요.

### 안 될 때
| 증상 | 해결 |
|---|---|
| 가입할 때 "데이터베이스 주소(DATABASE_URL)가 설정되지 않았어요" | 4단계 6번(Connect)을 했는지 확인 → 5단계 Redeploy |
| `/admin`에서 "ADMIN_PASSWORD가 설정되지 않았어요" | Settings → Environment Variables에 `ADMIN_PASSWORD` 추가 → Redeploy |
| "서버 오류가 발생했어요" | 프로젝트 → **Logs** 탭에서 빨간 줄을 캡처해서 물어보세요 |
| 화면은 나오는데 3D가 안 보임 | 데이터베이스와 무관해요. 브라우저 새로고침(Ctrl+F5) |

---

## 7단계. 내 컴퓨터에서 테스트하기 (선택)
이제 내 컴퓨터에서 실행할 때도 같은 Neon 데이터베이스를 씁니다.
1. Vercel Storage 탭 → 데이터베이스 → **.env.local** 탭에서 **Show secret**을 누르고 `DATABASE_URL="postgresql://..."` 값을 복사합니다.
2. bk-shop 폴더의 `.env.example`을 복사해서 이름을 **`.env`**로 바꿉니다.
   (Windows에서 확장자가 안 보이면 탐색기 **보기 → 파일 확장명** 체크)
3. `.env`를 메모장으로 열고 `DATABASE_URL=` 뒤에 복사한 주소를 붙여 넣고 저장합니다. (따옴표는 있어도 없어도 돼요)
4. `START.bat`을 더블클릭하면 처음 한 번 라이브러리를 설치한 뒤 http://localhost:3000 이 열립니다.

⚠️ 내 컴퓨터에서 가입·주문한 것도 **실제 사이트와 같은 데이터베이스**에 저장돼요.
테스트 데이터를 따로 두고 싶으면 Neon에서 **Branch**를 하나 더 만들어 그 주소를 `.env`에 쓰면 됩니다.

## 사이트를 고친 뒤 다시 올리기
GitHub 저장소에서 **Add file → Upload files**로 바뀐 파일을 끌어다 놓고 **Commit changes**를 누르면,
Vercel이 알아서 새 버전으로 다시 배포합니다. (1~2분)

---

## 무료 플랜에서 알아 둘 점
- **데이터는 지워지지 않아요.** Render 무료 플랜과 달리, 서버가 쉬었다 켜져도 가입·주문 기록이 Neon에 그대로 남습니다.
- 한동안 방문자가 없으면 Neon 데이터베이스가 잠들어서, 다음 첫 요청이 1~2초 정도 느릴 수 있어요.
- 무료 플랜은 저장 용량·사용 시간에 한도가 있어요. 학교 과제·시연용으로는 충분합니다. 정확한 한도는 Vercel/Neon 요금 페이지에서 확인하세요.
- Vercel Hobby(무료) 요금제는 **개인·비상업용**입니다. 실제로 돈을 받고 판매한다면 Pro 요금제가 필요해요.

## 예전 데이터에 대해
이전 버전은 내 컴퓨터의 `data/shop.db`(SQLite) 파일에 저장했어요. 새 버전은 Neon에서 **빈 데이터베이스로 시작**합니다.
예전 테스트 가입·주문 기록은 옮겨지지 않아요. 필요하면 따로 옮기는 방법을 물어보세요.

## 실제로 물건을 판다면
지금 사이트는 가상 제품 데모입니다. 실제 판매를 하려면 결제 연동(PG사), 개인정보처리방침, 사업자 등록·통신판매업 신고 등이 필요합니다.
