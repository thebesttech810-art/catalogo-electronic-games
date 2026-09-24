@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Revisando facturas de los ultimos 30 dias...
python reporte_comisiones.py 30
echo.
if exist comisiones.xlsx start "" comisiones.xlsx
pause
