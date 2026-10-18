try {
  $r = Invoke-WebRequest "http://localhost:3000/size-guide" -UseBasicParsing -TimeoutSec 300
  Write-Output ("size-guide -> {0}" -f $r.StatusCode)
  Write-Output ("has AI card: {0}" -f $r.Content.Contains("Find my size"))
} catch { Write-Output "size-guide -> ERR" }
try {
  $x = Invoke-WebRequest "http://localhost:3000/shop" -UseBasicParsing -TimeoutSec 240
  Write-Output ("shop -> {0}" -f $x.StatusCode)
} catch { Write-Output "shop -> ERR" }
Write-Output "===SGV3-DONE==="
