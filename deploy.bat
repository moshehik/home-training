@echo off
rem Deploys the site to Vercel production (one deployment) and checks /api/health.
cd /d "%~dp0"
set NODE_OPTIONS=--use-system-ca
echo.
echo === Checking Vercel login ===
call npx --yes vercel@65.1.0 whoami
if errorlevel 1 goto login
:deploy
echo.
echo === Deploying to Vercel production ===
echo.
call npx --yes vercel@65.1.0 deploy --prod --archive=tgz --yes
if errorlevel 1 goto failed
echo.
echo === Checking /api/health ===
curl -s https://home-training-tawny.vercel.app/api/health
echo.
echo Expected: {"ok":true,"users":0}
pause
exit /b 0
:login
echo.
echo Not logged in to Vercel on this computer - logging in now (follow the browser).
call npx --yes vercel@65.1.0 login
if errorlevel 1 goto failed
goto deploy
:failed
echo.
echo *** FAILED - see the messages above ***
pause
exit /b 1
