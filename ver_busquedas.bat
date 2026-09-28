@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Revisando lo que buscaron y no encontraron en los ultimos 30 dias...
python reporte_busquedas.py 30
echo.
if exist busquedas.xlsx start "" busquedas.xlsx
pause
