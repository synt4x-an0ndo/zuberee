$ErrorActionPreference = "Continue"
Write-Output "--- stopping existing dev tree ---"
foreach ($pidToKill in @(2528, 19368)) {
  try { taskkill /F /T /PID $pidToKill 2>&1 | Out-Null } catch {}
}
try { taskkill /F /IM node.exe 2>&1 | Select-Object -First 4 } catch {}
Start-Sleep -Seconds 3
$still = Get-Process node -ErrorAction SilentlyContinue
Write-Output ("node processes left: " + ($still | Measure-Object).Count)

foreach ($port in @(3000, 3001)) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  Write-Output ("port {0} listening: {1}" -f $port, [bool]$conns)
}

Write-Output "--- prisma generate (retry, DLL now unlocked) ---"
Set-Location "C:\Users\ASUS\OneDrive\Desktop\zuberee\backend"
& npm run generate 2>&1 | Select-Object -Last 3

Write-Output "--- clearing turbopack cache ---"
Set-Location "C:\Users\ASUS\OneDrive\Desktop\zuberee\frontend"
foreach ($dir in @(".next", "node_modules\.cache")) {
  if (Test-Path $dir) { Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue }
  Write-Output ("{0} exists after cleanup: {1}" -f $dir, (Test-Path $dir))
}

Write-Output "--- recreating dev servers via scheduled task ---"
schtasks /delete /f /tn "ZubereeDev" 2>&1 | Out-Null
$cmd = 'cmd.exe /d /s /c "cd /d C:\Users\ASUS\OneDrive\Desktop\zuberee && npm run dev >> dev-root.log 2>&1"'
schtasks /create /f /tn "ZubereeDev" /tr $cmd /sc once /st 23:59 | Out-Null
schtasks /run /tn "ZubereeDev"
Start-Sleep -Seconds 20
foreach ($port in @(3000, 3001)) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  Write-Output ("port {0} listening: {1}" -f $port, [bool]$conns)
}
Write-Output "===RESTART-DONE==="
