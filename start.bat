@echo off
title LexiPulse - Vocabulary App
cd /d "%~dp0"
echo --------------------------------------------------
echo      Dang khoi dong LexiPulse Vocabulary App...
echo --------------------------------------------------
echo.
echo Ung dung se tu dong mo tren trinh duyet sau vai giay.
echo De dung ung dung, ban chi can dong cua so nay lai.
echo.
start http://localhost:5173/
npm run dev
