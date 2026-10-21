$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead((Join-Path (Get-Location) '.responsive-source-audit.zip'))
$stamp=Get-Date -Format yyyyMMdd-HHmmss
if((Get-FileHash -LiteralPath '.responsive-transfer\0.txt' -Algorithm MD5).Hash -ne '578B3505C20E48DB5F1D715435396C99'){throw 'STAGE_HASH 0'}
$h=(Get-FileHash -LiteralPath 'frontend\app\globals.css' -Algorithm MD5).Hash;if($h -ne '11961A12F66DD65B21460C70AE54E010' -and $h -ne '578B3505C20E48DB5F1D715435396C99'){throw 'DRIFT 0'}
if((Get-FileHash -LiteralPath '.responsive-transfer\1.txt' -Algorithm MD5).Hash -ne '71CC9007D95D8BB6C916AE96F176BDA4'){throw 'STAGE_HASH 1'}
$h=(Get-FileHash -LiteralPath 'frontend\app\(admin)\admin\banners\page.js' -Algorithm MD5).Hash;if($h -ne 'D39084594FCFC58111DB3288B7B1C402' -and $h -ne '71CC9007D95D8BB6C916AE96F176BDA4'){throw 'DRIFT 1'}
if((Get-FileHash -LiteralPath '.responsive-transfer\2.txt' -Algorithm MD5).Hash -ne '486693BF962604075D7F6E5E9BE98FC7'){throw 'STAGE_HASH 2'}
$h=(Get-FileHash -LiteralPath 'frontend\app\(admin)\admin\chat\page.js' -Algorithm MD5).Hash;if($h -ne '2A432594C1F7B7CFC13538E71F802C42' -and $h -ne '486693BF962604075D7F6E5E9BE98FC7'){throw 'DRIFT 2'}
if((Get-FileHash -LiteralPath '.responsive-transfer\3.txt' -Algorithm MD5).Hash -ne 'CF4BCAB0A95E031CF9039E214E9797A4'){throw 'STAGE_HASH 3'}
$h=(Get-FileHash -LiteralPath 'frontend\app\(admin)\admin\incomplete_orders\page.js' -Algorithm MD5).Hash;if($h -ne 'F7A521C21DA70CB2BA54C9D74596C1A1' -and $h -ne 'CF4BCAB0A95E031CF9039E214E9797A4'){throw 'DRIFT 3'}
if((Get-FileHash -LiteralPath '.responsive-transfer\4.txt' -Algorithm MD5).Hash -ne '544BBB5F0F57F0B24FB635FC7C7548F8'){throw 'STAGE_HASH 4'}
$h=(Get-FileHash -LiteralPath 'frontend\app\(admin)\admin\orders\new\page.js' -Algorithm MD5).Hash;if($h -ne '620697D61030DBDAF5CA2701378B68AE' -and $h -ne '544BBB5F0F57F0B24FB635FC7C7548F8'){throw 'DRIFT 4'}
if((Get-FileHash -LiteralPath '.responsive-transfer\5.txt' -Algorithm MD5).Hash -ne '495B0184779BCB0C609297266405F425'){throw 'STAGE_HASH 5'}
$h=(Get-FileHash -LiteralPath 'frontend\app\(admin)\admin\orders\invoice\[orderId]\page.js' -Algorithm MD5).Hash;if($h -ne 'F7326B9C9FA47512558F615562216350' -and $h -ne '495B0184779BCB0C609297266405F425'){throw 'DRIFT 5'}
if((Get-FileHash -LiteralPath '.responsive-transfer\6.txt' -Algorithm MD5).Hash -ne 'FA5CBF50E90BEE5AD9CAF03EC8D1527E'){throw 'STAGE_HASH 6'}
$h=(Get-FileHash -LiteralPath 'frontend\app\(admin)\admin\orders\edit\[id]\page.js' -Algorithm MD5).Hash;if($h -ne 'FE5E3E27396A5AE7AC95B2B3EE22B744' -and $h -ne 'FA5CBF50E90BEE5AD9CAF03EC8D1527E'){throw 'DRIFT 6'}
if((Get-FileHash -LiteralPath '.responsive-transfer\7.txt' -Algorithm MD5).Hash -ne 'E5461BA6E1FA7691E7E3675354CA8278'){throw 'STAGE_HASH 7'}
$h=(Get-FileHash -LiteralPath 'frontend\components\site\CartDrawer.js' -Algorithm MD5).Hash;if($h -ne 'B40213B2925C532CF9A89AC32921F09A' -and $h -ne 'E5461BA6E1FA7691E7E3675354CA8278'){throw 'DRIFT 7'}
$entry=$zip.GetEntry('app/globals.css');if(-not $entry){throw 'MISSING_BASELINE 0'}
$ms=New-Object IO.MemoryStream;$es=$entry.Open();$es.CopyTo($ms);$es.Dispose()
$p=Join-Path (Get-Location) 'frontend\app\globals.css';$b=$p+'.bak-responsive-original-'+$stamp;[IO.File]::WriteAllBytes($b,$ms.ToArray());$ms.Dispose()
if((Get-FileHash -LiteralPath $b -Algorithm MD5).Hash -ne '11961A12F66DD65B21460C70AE54E010'){throw 'BACKUP_HASH 0'}
[IO.File]::WriteAllBytes($p,[IO.File]::ReadAllBytes((Join-Path (Get-Location) '.responsive-transfer\0.txt')))
Write-Output ('DEPLOYED app/globals.css MATCH='+((Get-FileHash -LiteralPath $p -Algorithm MD5).Hash -eq '578B3505C20E48DB5F1D715435396C99'))
$entry=$zip.GetEntry('app/(admin)/admin/banners/page.js');if(-not $entry){throw 'MISSING_BASELINE 1'}
$ms=New-Object IO.MemoryStream;$es=$entry.Open();$es.CopyTo($ms);$es.Dispose()
$p=Join-Path (Get-Location) 'frontend\app\(admin)\admin\banners\page.js';$b=$p+'.bak-responsive-original-'+$stamp;[IO.File]::WriteAllBytes($b,$ms.ToArray());$ms.Dispose()
if((Get-FileHash -LiteralPath $b -Algorithm MD5).Hash -ne 'D39084594FCFC58111DB3288B7B1C402'){throw 'BACKUP_HASH 1'}
[IO.File]::WriteAllBytes($p,[IO.File]::ReadAllBytes((Join-Path (Get-Location) '.responsive-transfer\1.txt')))
Write-Output ('DEPLOYED app/(admin)/admin/banners/page.js MATCH='+((Get-FileHash -LiteralPath $p -Algorithm MD5).Hash -eq '71CC9007D95D8BB6C916AE96F176BDA4'))
$entry=$zip.GetEntry('app/(admin)/admin/chat/page.js');if(-not $entry){throw 'MISSING_BASELINE 2'}
$ms=New-Object IO.MemoryStream;$es=$entry.Open();$es.CopyTo($ms);$es.Dispose()
$p=Join-Path (Get-Location) 'frontend\app\(admin)\admin\chat\page.js';$b=$p+'.bak-responsive-original-'+$stamp;[IO.File]::WriteAllBytes($b,$ms.ToArray());$ms.Dispose()
if((Get-FileHash -LiteralPath $b -Algorithm MD5).Hash -ne '2A432594C1F7B7CFC13538E71F802C42'){throw 'BACKUP_HASH 2'}
[IO.File]::WriteAllBytes($p,[IO.File]::ReadAllBytes((Join-Path (Get-Location) '.responsive-transfer\2.txt')))
Write-Output ('DEPLOYED app/(admin)/admin/chat/page.js MATCH='+((Get-FileHash -LiteralPath $p -Algorithm MD5).Hash -eq '486693BF962604075D7F6E5E9BE98FC7'))
$entry=$zip.GetEntry('app/(admin)/admin/incomplete_orders/page.js');if(-not $entry){throw 'MISSING_BASELINE 3'}
$ms=New-Object IO.MemoryStream;$es=$entry.Open();$es.CopyTo($ms);$es.Dispose()
$p=Join-Path (Get-Location) 'frontend\app\(admin)\admin\incomplete_orders\page.js';$b=$p+'.bak-responsive-original-'+$stamp;[IO.File]::WriteAllBytes($b,$ms.ToArray());$ms.Dispose()
if((Get-FileHash -LiteralPath $b -Algorithm MD5).Hash -ne 'F7A521C21DA70CB2BA54C9D74596C1A1'){throw 'BACKUP_HASH 3'}
[IO.File]::WriteAllBytes($p,[IO.File]::ReadAllBytes((Join-Path (Get-Location) '.responsive-transfer\3.txt')))
Write-Output ('DEPLOYED app/(admin)/admin/incomplete_orders/page.js MATCH='+((Get-FileHash -LiteralPath $p -Algorithm MD5).Hash -eq 'CF4BCAB0A95E031CF9039E214E9797A4'))
$entry=$zip.GetEntry('app/(admin)/admin/orders/new/page.js');if(-not $entry){throw 'MISSING_BASELINE 4'}
$ms=New-Object IO.MemoryStream;$es=$entry.Open();$es.CopyTo($ms);$es.Dispose()
$p=Join-Path (Get-Location) 'frontend\app\(admin)\admin\orders\new\page.js';$b=$p+'.bak-responsive-original-'+$stamp;[IO.File]::WriteAllBytes($b,$ms.ToArray());$ms.Dispose()
if((Get-FileHash -LiteralPath $b -Algorithm MD5).Hash -ne '620697D61030DBDAF5CA2701378B68AE'){throw 'BACKUP_HASH 4'}
[IO.File]::WriteAllBytes($p,[IO.File]::ReadAllBytes((Join-Path (Get-Location) '.responsive-transfer\4.txt')))
Write-Output ('DEPLOYED app/(admin)/admin/orders/new/page.js MATCH='+((Get-FileHash -LiteralPath $p -Algorithm MD5).Hash -eq '544BBB5F0F57F0B24FB635FC7C7548F8'))
$entry=$zip.GetEntry('app/(admin)/admin/orders/invoice/[orderId]/page.js');if(-not $entry){throw 'MISSING_BASELINE 5'}
$ms=New-Object IO.MemoryStream;$es=$entry.Open();$es.CopyTo($ms);$es.Dispose()
$p=Join-Path (Get-Location) 'frontend\app\(admin)\admin\orders\invoice\[orderId]\page.js';$b=$p+'.bak-responsive-original-'+$stamp;[IO.File]::WriteAllBytes($b,$ms.ToArray());$ms.Dispose()
if((Get-FileHash -LiteralPath $b -Algorithm MD5).Hash -ne 'F7326B9C9FA47512558F615562216350'){throw 'BACKUP_HASH 5'}
[IO.File]::WriteAllBytes($p,[IO.File]::ReadAllBytes((Join-Path (Get-Location) '.responsive-transfer\5.txt')))
Write-Output ('DEPLOYED app/(admin)/admin/orders/invoice/[orderId]/page.js MATCH='+((Get-FileHash -LiteralPath $p -Algorithm MD5).Hash -eq '495B0184779BCB0C609297266405F425'))
$entry=$zip.GetEntry('app/(admin)/admin/orders/edit/[id]/page.js');if(-not $entry){throw 'MISSING_BASELINE 6'}
$ms=New-Object IO.MemoryStream;$es=$entry.Open();$es.CopyTo($ms);$es.Dispose()
$p=Join-Path (Get-Location) 'frontend\app\(admin)\admin\orders\edit\[id]\page.js';$b=$p+'.bak-responsive-original-'+$stamp;[IO.File]::WriteAllBytes($b,$ms.ToArray());$ms.Dispose()
if((Get-FileHash -LiteralPath $b -Algorithm MD5).Hash -ne 'FE5E3E27396A5AE7AC95B2B3EE22B744'){throw 'BACKUP_HASH 6'}
[IO.File]::WriteAllBytes($p,[IO.File]::ReadAllBytes((Join-Path (Get-Location) '.responsive-transfer\6.txt')))
Write-Output ('DEPLOYED app/(admin)/admin/orders/edit/[id]/page.js MATCH='+((Get-FileHash -LiteralPath $p -Algorithm MD5).Hash -eq 'FA5CBF50E90BEE5AD9CAF03EC8D1527E'))
$entry=$zip.GetEntry('components/site/CartDrawer.js');if(-not $entry){throw 'MISSING_BASELINE 7'}
$ms=New-Object IO.MemoryStream;$es=$entry.Open();$es.CopyTo($ms);$es.Dispose()
$p=Join-Path (Get-Location) 'frontend\components\site\CartDrawer.js';$b=$p+'.bak-responsive-original-'+$stamp;[IO.File]::WriteAllBytes($b,$ms.ToArray());$ms.Dispose()
if((Get-FileHash -LiteralPath $b -Algorithm MD5).Hash -ne 'B40213B2925C532CF9A89AC32921F09A'){throw 'BACKUP_HASH 7'}
[IO.File]::WriteAllBytes($p,[IO.File]::ReadAllBytes((Join-Path (Get-Location) '.responsive-transfer\7.txt')))
Write-Output ('DEPLOYED components/site/CartDrawer.js MATCH='+((Get-FileHash -LiteralPath $p -Algorithm MD5).Hash -eq 'E5461BA6E1FA7691E7E3675354CA8278'))
$zip.Dispose()