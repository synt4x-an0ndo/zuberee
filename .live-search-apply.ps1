$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root=(Get-Location).Path
$stamp=Get-Date -Format yyyyMMdd-HHmmss
$archive=[IO.Compression.ZipFile]::OpenRead((Join-Path $root '.live-search-deploy.zip'))
if(Test-Path -LiteralPath (Join-Path $root 'frontend\components\site\LiveProductSearch.js')){throw 'UNEXPECTED_EXISTING frontend/components/site/LiveProductSearch.js'}
if((Get-FileHash -LiteralPath (Join-Path $root 'frontend\components\site\ProductListing.js') -Algorithm SHA256).Hash -ne '3cd1fd43ada1d5e9089b0cd50a916873262d3d2a644e0bcd7bc070d9ed28ec63'){throw 'SOURCE_DRIFT frontend/components/site/ProductListing.js'}
if(Test-Path -LiteralPath (Join-Path $root 'frontend\components\site\LiveProductSearch.module.css')){throw 'UNEXPECTED_EXISTING frontend/components/site/LiveProductSearch.module.css'}
if((Get-FileHash -LiteralPath (Join-Path $root 'frontend\components\site\Header.js') -Algorithm SHA256).Hash -ne 'bda7387ffecc144526c3331ef143acff57c97f721414e43393776d0055a9c79e'){throw 'SOURCE_DRIFT frontend/components/site/Header.js'}
if((Get-FileHash -LiteralPath (Join-Path $root 'backend\app\api\product-search\route.js') -Algorithm SHA256).Hash -ne 'a11c5bc8eee0494fff474639a548bbfdace53c548744ada8edd793ca0b6e6768'){throw 'SOURCE_DRIFT backend/app/api/product-search/route.js'}
$p=Join-Path $root 'frontend\components\site\LiveProductSearch.js'
if(Test-Path -LiteralPath $p){Copy-Item -LiteralPath $p -Destination ($p+'.bak-live-search-'+$stamp)}
$es=$archive.GetEntry('frontend/components/site/LiveProductSearch.js').Open();$ms=New-Object IO.MemoryStream;$es.CopyTo($ms);$es.Dispose();[IO.File]::WriteAllBytes($p,$ms.ToArray());$ms.Dispose()
if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne 'aff12d4f4f7a5df67492bac43095b4395ce8565bcd53f7b26c724ae4de9b255b'){throw 'DEPLOY_MISMATCH frontend/components/site/LiveProductSearch.js'}
Write-Output 'DEPLOYED frontend/components/site/LiveProductSearch.js HASH_MATCH=True'
$p=Join-Path $root 'frontend\components\site\ProductListing.js'
if(Test-Path -LiteralPath $p){Copy-Item -LiteralPath $p -Destination ($p+'.bak-live-search-'+$stamp)}
$es=$archive.GetEntry('frontend/components/site/ProductListing.js').Open();$ms=New-Object IO.MemoryStream;$es.CopyTo($ms);$es.Dispose();[IO.File]::WriteAllBytes($p,$ms.ToArray());$ms.Dispose()
if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne '5fe3a5e9c3c239c26b46f2bf9f64839b855e25a9669b09b6f1180db725b573ef'){throw 'DEPLOY_MISMATCH frontend/components/site/ProductListing.js'}
Write-Output 'DEPLOYED frontend/components/site/ProductListing.js HASH_MATCH=True'
$p=Join-Path $root 'frontend\components\site\LiveProductSearch.module.css'
if(Test-Path -LiteralPath $p){Copy-Item -LiteralPath $p -Destination ($p+'.bak-live-search-'+$stamp)}
$es=$archive.GetEntry('frontend/components/site/LiveProductSearch.module.css').Open();$ms=New-Object IO.MemoryStream;$es.CopyTo($ms);$es.Dispose();[IO.File]::WriteAllBytes($p,$ms.ToArray());$ms.Dispose()
if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne 'c42a769662a64bcb50b51918507af9bcfa55d5c0c9e8c1b86e78e84315a58b52'){throw 'DEPLOY_MISMATCH frontend/components/site/LiveProductSearch.module.css'}
Write-Output 'DEPLOYED frontend/components/site/LiveProductSearch.module.css HASH_MATCH=True'
$p=Join-Path $root 'frontend\components\site\Header.js'
if(Test-Path -LiteralPath $p){Copy-Item -LiteralPath $p -Destination ($p+'.bak-live-search-'+$stamp)}
$es=$archive.GetEntry('frontend/components/site/Header.js').Open();$ms=New-Object IO.MemoryStream;$es.CopyTo($ms);$es.Dispose();[IO.File]::WriteAllBytes($p,$ms.ToArray());$ms.Dispose()
if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne '9747164d2ce7107abf3a159cc5178e2424796a387f3be56088cac865b863f541'){throw 'DEPLOY_MISMATCH frontend/components/site/Header.js'}
Write-Output 'DEPLOYED frontend/components/site/Header.js HASH_MATCH=True'
$p=Join-Path $root 'backend\app\api\product-search\route.js'
if(Test-Path -LiteralPath $p){Copy-Item -LiteralPath $p -Destination ($p+'.bak-live-search-'+$stamp)}
$es=$archive.GetEntry('backend/app/api/product-search/route.js').Open();$ms=New-Object IO.MemoryStream;$es.CopyTo($ms);$es.Dispose();[IO.File]::WriteAllBytes($p,$ms.ToArray());$ms.Dispose()
if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne '894d8e40f2d76a0bfe68408bd33414ea74a6c89756053b7efce6590b4139dc4e'){throw 'DEPLOY_MISMATCH backend/app/api/product-search/route.js'}
Write-Output 'DEPLOYED backend/app/api/product-search/route.js HASH_MATCH=True'
$archive.Dispose()
Write-Output ('STAMP='+$stamp)