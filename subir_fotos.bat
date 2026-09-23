@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\Git\cmd"
echo Procesando fotos del catalogo...
python subir_fotos.py %*
echo.
pause
