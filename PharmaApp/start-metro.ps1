# Metro Bundler Başlatma Scripti
# Bu script Metro bundler'ı başlatır

Write-Host "`n=== Metro Bundler Başlatılıyor ===" -ForegroundColor Cyan
Write-Host "Port: 8081" -ForegroundColor Yellow
Write-Host "`nMetro'yu durdurmak için Ctrl+C tuşlarına basın`n" -ForegroundColor Gray

cd "C:\PHARMA_APP\PharmaApp"
npx react-native start --reset-cache

