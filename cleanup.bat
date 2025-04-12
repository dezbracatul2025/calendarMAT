@echo off
echo =============================================
echo      CURATARE COMPLETA CALENDAR AGENTI
echo =============================================
echo.
echo ATENTIE: Acest script va sterge toate fisierele generate
echo si dependentele instalate. Proiectul sursa va ramane intact.
echo.
set /p confirm=Sunteti sigur ca doriti sa continuati? (d/n): 
if /i not "%confirm%"=="d" goto :end

echo.
echo [1/5] Oprire procese npm...
taskkill /f /im node.exe >nul 2>&1

echo [2/5] Stergere node_modules...
if exist node_modules (
  rmdir /s /q node_modules
  echo       Node modules sters
) else (
  echo       Node modules nu exista
)

echo [3/5] Stergere fisiere de build...
if exist build (
  rmdir /s /q build
  echo       Directorul build sters
) else (
  echo       Directorul build nu exista
)

echo [4/5] Stergere fisiere cache...
if exist .cache (
  rmdir /s /q .cache
  echo       Cache sters
) else (
  echo       Cache nu exista
)

if exist package-lock.json (
  del /f package-lock.json
  echo       Package-lock.json sters
) else (
  echo       Package-lock.json nu exista
)

echo [5/5] Curatare cache npm...
call npm cache clean --force

echo.
echo =============================================
echo         CURATARE COMPLETA
echo =============================================
echo.
echo Proiectul a fost curatat complet.
echo Pentru a reinstala, rulati install.bat
echo.

:end
pause 