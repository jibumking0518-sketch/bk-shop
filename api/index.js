// Vercel 서버리스 함수 입구: /api/... 와 /admin 요청이 모두 여기로 들어옴 (vercel.json 참고)
module.exports = require('../app');
