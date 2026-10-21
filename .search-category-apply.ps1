$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z=[IO.Compression.ZipFile]::OpenRead((Join-Path (Get-Location) '.search-category.zip'))
$stamp=Get-Date -Format yyyyMMdd-HHmmss
$p=Join-Path (Get-Location) 'backend\app\api\product-search\route.js'
if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne '894d8e40f2d76a0bfe68408bd33414ea74a6c89756053b7efce6590b4139dc4e'){throw 'SOURCE_DRIFT backend/app/api/product-search/route.js'}
Copy-Item -LiteralPath $p -Destination ($p+'.bak-search-category-'+$stamp)
$es=$z.GetEntry('backend/app/api/product-search/route.js').Open();$ms=New-Object IO.MemoryStream;$es.CopyTo($ms);$es.Dispose();[IO.File]::WriteAllBytes($p,$ms.ToArray());$ms.Dispose()
Write-Output ('CATEGORY_DEPLOY backend/app/api/product-search/route.js MATCH='+((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -eq '611d75bb3210b2f09cff9f03461eabe095f727b70ff57f5b310dc4be667795a7'))
$p=Join-Path (Get-Location) 'backend\app\api\product-pagination\route.js'
if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne '6dde5a89d983fc28ce434d12cdf16b1d906047057b1073bdfce65f0ff9ac04cb'){throw 'SOURCE_DRIFT backend/app/api/product-pagination/route.js'}
Copy-Item -LiteralPath $p -Destination ($p+'.bak-search-category-'+$stamp)
$es=$z.GetEntry('backend/app/api/product-pagination/route.js').Open();$ms=New-Object IO.MemoryStream;$es.CopyTo($ms);$es.Dispose();[IO.File]::WriteAllBytes($p,$ms.ToArray());$ms.Dispose()
Write-Output ('CATEGORY_DEPLOY backend/app/api/product-pagination/route.js MATCH='+((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -eq '0ba2c7172ae6bf61c8dc6f5cfa7db7b63e42cd5eb32132b40e3e7d9765947a77'))
$z.Dispose()
Set-Location backend
& npx.cmd eslint app/api/product-search/route.js app/api/product-pagination/route.js
Write-Output "BACKEND_SEARCH_LINT_EXIT=$LASTEXITCODE"