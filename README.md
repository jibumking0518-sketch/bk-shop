# BK phone 쇼핑몰 (BumBum Company)

3D 제품 소개 페이지 + 회원가입/로그인 + 주문 접수 + 관리자 주문 관리.
**Vercel**(사이트·서버)과 **Neon Postgres**(데이터베이스)로 운영합니다.

## 0. 인터넷에 올리기
모든 사람이 접속할 수 있게 배포하려면 **DEPLOY.md**를 따라 하세요. (GitHub + Vercel + Neon, 클릭만으로 가능)

## 1. 내 컴퓨터에서 실행 (선택)
- Node.js **22 이상** 설치 (https://nodejs.org 에서 LTS 버전)
- `.env.example`을 복사해 `.env`로 이름을 바꾸고 `DATABASE_URL`(Neon 주소)과 `ADMIN_PASSWORD`를 적기 (DEPLOY.md 7단계)
- `START.bat` 더블클릭 → http://localhost:3000

직접 실행하려면:
```bash
cd bk-shop
npm install
npm start
```
- 쇼핑몰 (BK phone): http://localhost:3000
- BK pierce (피어싱형 오디오): http://localhost:3000/pierce
- 관리자 페이지: http://localhost:3000/admin  (아이디 `admin`)

## 2. 폴더 구조
```
bk-shop/
├─ app.js             핵심 코드 (API + 데이터베이스). Vercel과 내 컴퓨터가 같이 씀
├─ api/index.js       Vercel 서버리스 함수 입구 (app.js를 불러옴)
├─ server.js          내 컴퓨터에서 실행할 때만 사용
├─ vercel.json        Vercel 주소 연결 설정 (/api, /admin → 서버 / 나머지는 화면 파일)
├─ package.json       필요한 라이브러리: pg (Postgres 연결)
├─ .env.example       내 컴퓨터용 설정 예시 (.env로 복사해서 사용, GitHub에 올리지 않기)
├─ public/            누구나 볼 수 있는 화면
│  ├─ index.html      BK phone 화면 (3D 폰, 가입, 주문)
│  └─ pierce.html     BK pierce 화면 (3D 피어싱, 귀 착용·노이즈 캔슬링 연출, 주문)
└─ private/
   └─ admin.html      관리자 주문 관리 화면 (비밀번호를 맞혀야만 보임)
```

## 3. 환경변수
| 이름 | 설명 |
|---|---|
| `DATABASE_URL` | Neon 연결 주소. Vercel에서 Neon을 연결하면 자동으로 들어감 |
| `ADMIN_PASSWORD` | 관리자 비밀번호. **Vercel에서는 꼭 직접 추가해야 관리자 페이지가 열림** |
| `ADMIN_USER` | 관리자 아이디 (기본값 `admin`) |

## 4. 데이터베이스 테이블 (Neon Postgres, 첫 요청 때 자동 생성)
| 테이블 | 내용 |
|---|---|
| customers | 고객: 이름, 이메일, 휴대폰, 비밀번호(암호화된 값), 마케팅 동의, 가입일 |
| sessions | 로그인 상태 (토큰은 해시로만 저장) |
| orders | 주문: 주문번호, 고객, 상품명, 색상·용량, 금액·할인, 받는 분·주소·요청사항, 상태 |

데이터는 Neon 콘솔(Vercel Storage 탭 → Open in Neon → Tables)에서 직접 볼 수 있습니다.

## 5. API
| 메서드 | 주소 | 설명 |
|---|---|---|
| GET | /api/catalog | BK phone 색상·용량·가격 |
| GET | /api/catalog/pierce | BK pierce 색상·케이스·가격 |
| POST | /api/signup | 회원가입 (가입 후 자동 로그인) |
| POST | /api/login | 로그인 |
| POST | /api/logout | 로그아웃 |
| GET | /api/me | 현재 로그인한 고객 |
| POST | /api/orders | 주문 접수 (로그인 필요, 가격은 서버가 계산. BK pierce는 product: "pierce") |
| GET | /api/orders/mine | 내 주문 내역 |
| GET | /api/admin/stats · orders · customers | 관리자용 조회 |
| PATCH | /api/admin/orders/:id | 주문 상태 변경 |

## 6. 보안 처리
- 비밀번호는 scrypt로 암호화해 저장 (원래 비밀번호는 저장하지 않음)
- 주문 금액은 화면이 보낸 값을 믿지 않고 서버의 가격표로 다시 계산
- 로그인 쿠키는 HttpOnly, SameSite=Lax / API는 JSON 요청만 허용
- 로그인·가입 반복 시도 횟수 제한 (서버리스 특성상 대략적인 제한)
- 관리자 페이지와 관리자 API는 비밀번호로 보호

## 7. 실제 판매 전에 해야 할 일
- **결제 연동**: 지금은 주문만 접수됩니다. 토스페이먼츠, 포트원 같은 PG사와 연동해야 실제 결제가 됩니다.
- **HTTPS**: Vercel은 자동으로 HTTPS를 쓰고, 로그인 쿠키에 Secure가 붙습니다.
- **약관·개인정보처리방침** 페이지 작성, 사업자 정보 표시 (통신판매업 신고 등)
- **DB 백업**: Neon의 복원(Restore) 기능 또는 정기 백업 설정 확인
