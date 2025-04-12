@echo off
echo =============================================
echo Diagnosticare si Reparare Calendar Agenti
echo =============================================
echo.

:: Verificare versiune Node
echo [1/7] Verificare versiune Node.js...
node -v > nul 2>&1
if %errorlevel% neq 0 (
  echo [EROARE] Node.js nu este instalat sau nu este in PATH
  echo Instalati Node.js de la https://nodejs.org/ (recomandam versiunea LTS)
  goto :end
) else (
  for /f "tokens=*" %%a in ('node -v') do set nodeversion=%%a
  echo [OK] Node.js %nodeversion% detectat
)

:: Verificare versiune npm
echo [2/7] Verificare versiune npm...
npm -v > nul 2>&1
if %errorlevel% neq 0 (
  echo [EROARE] npm nu este instalat sau nu este in PATH
  goto :end
) else (
  for /f "tokens=*" %%a in ('npm -v') do set npmversion=%%a
  echo [OK] npm %npmversion% detectat
)

:: Verificare existenta package.json
echo [3/7] Verificare fisier package.json...
if not exist package.json (
  echo [EROARE] Fisierul package.json nu exista in directorul curent
  goto :end
) else (
  echo [OK] package.json gasit
)

:: Verificare existenta node_modules
echo [4/7] Verificare node_modules...
if not exist node_modules (
  echo [ATENTIE] Directorul node_modules nu exista, vom instala dependentele
) else (
  echo [OK] node_modules gasit
)

:: Verificare acces la Firestore
echo [5/7] Verificare configuratie Firebase...
if not exist src\firebase.js (
  echo [EROARE] Fisierul firebase.js nu exista in src/
  goto :end
) else (
  echo [OK] Configuratie Firebase gasita
)

:: Reparam probleme comune
echo [6/7] Reparare probleme comune...

:: 1. Setari npm
echo   - Configurare npm pentru compatibilitate...
call npm config set legacy-peer-deps true
call npm config set fund false

:: 2. Curatam cache
echo   - Curatare cache npm...
call npm cache clean --force

:: 3. Verificam daca .env exista
if not exist .env (
  echo   - Crearea fisierului .env...
  echo BROWSER=none> .env
  echo REACT_APP_DISABLE_ESLINT_PLUGIN=true>> .env
)

:: 4. Instalare dependente
echo [7/7] Instalare dependente cu parametri speciali...
echo.
echo Acest proces poate dura cateva minute. Va rugam asteptati...
echo.
call npm install --legacy-peer-deps --no-fund

echo.
echo =============================================
echo         DIAGNOSTICARE COMPLETA
echo =============================================
echo.
echo Toate verificarile si reparatiile au fost efectuate.
echo.
echo Pentru a porni aplicatia, rulati:
echo npm start
echo.
echo Daca intampinati in continuare probleme, va rugam sa:
echo 1. Verificati erorile din consola browser (F12)
echo 2. Verificati setarile Firebase din consola Firebase
echo 3. Asigurati-va ca aveti Firestore Database activat
echo.

:end
pause 