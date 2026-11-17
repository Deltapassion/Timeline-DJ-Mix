@echo off
rem Fabrique la version Windows (installateur .exe) dans le dossier dist\
rem Il faut Node.js 20 ou plus recent (https://nodejs.org) et NSIS (https://nsis.sourceforge.io)
cd /d "%~dp0"
call npm ci || goto erreur
call npm run dist:win || goto erreur
echo.
echo Termine : l'installateur est dans le dossier dist\
pause
exit /b 0
:erreur
echo La fabrication a echoue.
pause
exit /b 1
