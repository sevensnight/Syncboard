@echo off
setlocal
cd /d "%~dp0"

echo [SyncBoard] 清理 3000 端口并启动服务...
call npm run start:clean

echo.
echo [SyncBoard] 服务已退出。
pause
