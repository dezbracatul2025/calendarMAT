@echo off
echo =====================================
echo Instalare dependente Calendar Agenti
echo =====================================
echo.

rem Setare configurație npm
echo Configurare npm...
call npm config set legacy-peer-deps true

rem Curățare cache npm
echo Curățare cache npm...
call npm cache clean --force

rem Ștergere node_modules și package-lock (dacă există)
echo Ștergere fișiere vechi...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f package-lock.json

rem Instalare dependente cu --legacy-peer-deps pentru a evita probleme de compatibilitate
echo Instalare dependențe (poate dura câteva minute)...
call npm install --legacy-peer-deps

echo.
echo Instalare completă!
echo Pentru a porni aplicația, rulați: npm start
echo.
pause 