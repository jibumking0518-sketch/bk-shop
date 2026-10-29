/* =====================================================================
   내 컴퓨터에서 실행하기 (Vercel에서는 이 파일을 쓰지 않음)
   실행: npm start  →  http://localhost:3000
   ※ .env 파일에 DATABASE_URL(Neon 주소)을 먼저 적어 두세요. (README 참고)
   ===================================================================== */
'use strict';
const http = require('node:http');
const app = require('./app');

const PORT = Number(process.env.PORT) || 3000;

if (!app.hasDatabase()) {
  console.log('\n❌ DATABASE_URL이 없어요.');
  console.log('   bk-shop 폴더의 .env.example 파일을 복사해서 이름을 .env 로 바꾸고,');
  console.log('   DATABASE_URL= 뒤에 Neon 연결 주소를 붙여 넣은 뒤 다시 실행하세요.\n');
  process.exit(1);
}

http.createServer(app).listen(PORT, () => {
  console.log(`✅ BK phone 쇼핑몰 서버 실행 중 (데이터베이스: Neon Postgres)`);
  console.log(`   쇼핑몰:      http://localhost:${PORT}`);
  console.log(`   BK pierce:   http://localhost:${PORT}/pierce`);
  console.log(`   관리자 페이지: http://localhost:${PORT}/admin  (아이디: ${app.ADMIN_USER})\n`);
});
