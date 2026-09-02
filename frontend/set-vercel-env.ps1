# PowerShell script to automate Vercel CLI login, environment variable setup, and production deployment
$envFile = "..\backend\.env"

if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    $geminiKey = ($envContent | Select-String "GEMINI_API_KEY=(.*)").Matches.Groups[1].Value
    $rzpId = ($envContent | Select-String "RAZORPAY_KEY_ID=(.*)").Matches.Groups[1].Value
    $rzpSecret = ($envContent | Select-String "RAZORPAY_KEY_SECRET=(.*)").Matches.Groups[1].Value

    Write-Host "1. Authenticating Vercel CLI..." -ForegroundColor Cyan
    npx vercel login

    Write-Host "2. Linking project to Vercel..." -ForegroundColor Cyan
    npx vercel link --yes

    Write-Host "3. Adding Environment Variables to Production..." -ForegroundColor Cyan
    $geminiKey | npx vercel env add GEMINI_API_KEY production
    $rzpId | npx vercel env add RAZORPAY_KEY_ID production
    $rzpSecret | npx vercel env add RAZORPAY_KEY_SECRET production

    Write-Host "4. Deploying to Vercel Production..." -ForegroundColor Cyan
    npx vercel --prod
} else {
    Write-Host "backend/.env file not found." -ForegroundColor Red
}
