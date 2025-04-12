@echo off
echo ================================================
echo  REPARARE PROBLEMA REACT-SCRIPTS
echo ================================================
echo.

echo [1/4] Verificare existenta react-scripts...
if exist node_modules\react-scripts (
  echo       [INFO] react-scripts exista, dar nu functioneaza corect
) else (
  echo       [ATENTIE] react-scripts nu exista! Vom incerca sa-l instalam.
)

echo [2/4] Instalare react-scripts local...
call npm install react-scripts@5.0.1 --save-dev --legacy-peer-deps

echo [3/4] Creare fisier start-local.bat...
echo @echo off > start-local.bat
echo echo Pornire aplicatie cu react-scripts local... >> start-local.bat
echo call node ./node_modules/react-scripts/bin/react-scripts.js start >> start-local.bat

echo [4/4] Verificare npx...
npx --version > nul 2>&1
if %errorlevel% neq 0 (
  echo       [EROARE] npx nu este disponibil!
) else (
  echo       [OK] npx este disponibil
  echo Creare fisier start-npx.bat...
  echo @echo off > start-npx.bat
  echo echo Pornire aplicatie cu npx... >> start-npx.bat
  echo call npx react-scripts start >> start-npx.bat
)

echo.
echo ================================================
echo  REPARARE FINALIZATA
echo ================================================
echo.
echo Pentru a porni aplicatia, puteti folosi:
echo.
echo 1. start-local.bat (recomandat)
echo 2. start-npx.bat (alternativ)
echo.
echo Aceste scripturi ocolesc problema cu calea react-scripts.
echo.
pause 