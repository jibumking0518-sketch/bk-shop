@echo off
chcp 65001 >nul
title BK shop server
cd /d "%~dp0"

rem ==========================================================
rem  BK phone 쇼핑몰 - 더블클릭하면 서버가 켜지고 사이트가 열립니다
rem  (내 컴퓨터에서 테스트할 때만 사용. 인터넷 배포는 DEPLOY.md 참고)
rem  데이터베이스 주소와 관리자 비밀번호는 .env 파일에 적어요
rem ==========================================================
set PORT=3000

rem ---- 이미 서버가 켜져 있으면 사이트만 열기 ----
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if %errorlevel%==0 goto :already

rem ---- Node.js 찾기 ----
where node >nul 2>nul
if errorlevel 1 goto :nonode

node -e "process.exit(process.allowedNodeEnvironmentFlags.has('--env-file-if-exists')?0:1)" >nul 2>nul
if errorlevel 1 goto :oldnode

rem ---- .env 파일 확인 (Neon 데이터베이스 주소) ----
if not exist ".env" goto :noenv

rem ---- 처음 한 번만: 데이터베이스 연결 라이브러리(pg) 설치 ----
if not exist "node_modules\pg" (
  echo  처음 실행이라 필요한 라이브러리를 설치하고 있어요... ^(1분 정도^)
  call npm install
  if errorlevel 1 goto :installfail
)

echo.
echo  ==============================================
echo    BK 쇼핑몰 서버를 켜는 중이에요...
echo    잠시 후 크롬(기본 브라우저)이 자동으로 열려요.
echo.
echo    BK phone   : http://localhost:%PORT%
echo    BK pierce  : http://localhost:%PORT%/pierce
echo    관리자     : http://localhost:%PORT%/admin
echo                 아이디 admin / 비밀번호는 .env 파일의 ADMIN_PASSWORD
echo.
echo    ※ 이 창을 닫으면 사이트도 꺼져요. 사이트를 쓰는 동안 열어 두세요.
echo  ==============================================
echo.
start "" /min cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:%PORT%"
node --env-file-if-exists=.env server.js
echo.
echo  서버가 꺼졌어요. 위에 빨간 오류 메시지가 있으면 캡처해서 보내 주세요.
pause
exit /b

:already
echo  서버가 이미 켜져 있어요. 사이트를 엽니다.
start http://localhost:%PORT%
timeout /t 3 >nul
exit /b

:noenv
echo.
echo  [!] .env 파일이 없어요.
echo      1) 이 폴더의 .env.example 파일을 복사해서 이름을 .env 로 바꾸세요.
echo      2) 메모장으로 열어 DATABASE_URL= 뒤에 Neon 연결 주소를 붙여 넣고 저장하세요.
echo      3) 이 START 파일을 다시 더블클릭하세요.  (자세한 방법: DEPLOY.md 7단계)
echo.
pause
exit /b

:installfail
echo.
echo  [!] 라이브러리 설치에 실패했어요. 인터넷 연결을 확인한 뒤 다시 실행해 주세요.
pause
exit /b

:nonode
echo.
echo  [!] 이 컴퓨터에서 Node.js를 찾지 못했어요.
echo      곧 열리는 사이트에서 LTS 버전을 내려받아 설치한 뒤,
echo      이 START 파일을 다시 더블클릭하세요.
echo.
start https://nodejs.org/ko/download
pause
exit /b

:oldnode
echo.
echo  [!] Node.js 버전이 너무 낮아요. 22 이상(LTS)이 필요해요.
echo      곧 열리는 사이트에서 최신 LTS 버전을 다시 설치한 뒤,
echo      이 START 파일을 다시 더블클릭하세요.
echo.
start https://nodejs.org/ko/download
pause
exit /b
