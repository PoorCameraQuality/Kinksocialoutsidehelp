Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 1200, 630
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(26, 26, 46))
$font = New-Object System.Drawing.Font('Segoe UI', 48, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(212, 175, 55))
$g.DrawString('Coast to Coast Kink', $font, $brush, 80, 260)
$g.Dispose()
$out = Join-Path $PSScriptRoot '..\packages\web\public\og-default.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Wrote $out"
