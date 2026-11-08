# Set-kroombox-token.ps1  (PowerShell 5.1)
# Menyimpan token MCP Kroombox sebagai VARIABEL LINGKUNGAN User: MCP_KROOMBOXPANEL_API_KEY
# Config Hermes aktif sudah merujuk variabel itu, jadi tidak ada token yang ditulis ke berkas.
# Masukan tersembunyi: token tidak tampil di layar, tidak masuk riwayat perintah, tidak lewat chat.
#
# Jalankan di PowerShell Anda sendiri:
#   powershell -NoProfile -ExecutionPolicy Bypass -File C:\Salman\PROJEK\aiones-boards\scripts\Set-kroombox-token.ps1
# Opsional (menulis nilai langsung ke YAML, tidak disarankan): tambahkan -ModeConfig

[CmdletBinding()]
param([switch]$ModeConfig)

$ErrorActionPreference = 'Stop'
$namaVar = 'MCP_KROOMBOXPANEL_API_KEY'
$uri = 'https://panel.kroombox.com/api/mcp/sse'

Write-Host "Masukkan token panel Kroombox (masukan TERSEMBUNYI), lalu Enter." -ForegroundColor Cyan
Write-Host "Ambil token baru di panel bila yang lama sudah tidak berlaku." -ForegroundColor DarkGray
$secure = Read-Host -AsSecureString 'Token'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if ($token -notmatch '^kp_[A-Za-z0-9_\-\.]{16,}$') {
    Write-Host "Format tidak dikenali (harus 'kp_...' tanpa spasi). Tidak ada yang diubah." -ForegroundColor Red
    exit 1
}

Set-Item -Path "Env:$namaVar" -Value $token
[Environment]::SetEnvironmentVariable($namaVar, $token, 'User')
Write-Host "OK: $namaVar disimpan sebagai variabel lingkungan User." -ForegroundColor Green

# Verifikasi token TIDAK dilakukan di sini (endpoint MCP berupa stream SSE, dan HTTP stack
# PowerShell 5.1 rewel). Yang memverifikasi token adalah agen lewat jalur yang sudah terbukti,
# jadi token salah ketahuan sebelum pipeline dijalankan.

if ($ModeConfig) {
    $cfg = Join-Path $env:LOCALAPPDATA 'hermes\config.yaml'
    if (Test-Path $cfg) {
        $text = Get-Content -Raw -Path $cfg
        $rx = [regex]'(?s)(kroomboxpanel:\s*\n(?:\s+[^\n]*\n)*?\s+Authorization:\s{0,1}["'']?Bearer\s+)(\S+?)(["'']?\s*\n)'
        if ($rx.Match($text).Success) {
            $bak = $cfg + '.bak-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
            Copy-Item $cfg $bak
            $baru = $rx.Replace($text, ('${1}' + $token + '${2}'), 1)
            Set-Content -Path $cfg -Value $baru -Encoding utf8 -NoNewline
            Write-Host "Juga ditulis ke $cfg (backup: $bak)." -ForegroundColor Green
        } else {
            Write-Host "Blok kroomboxpanel tidak ditemukan di $cfg - cukup variabel lingkungan yang dipakai." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Config tidak ada di $cfg - hanya variabel lingkungan yang diisi." -ForegroundColor Yellow
    }
}

Write-Host ("Konfirmasi (disensor): " + $token.Substring(0, 6) + "... (len=" + $token.Length + ")") -ForegroundColor DarkGray
$token = $null
[GC]::Collect()
Write-Host "LANGKAH TERAKHIR: tutup lalu jalankan ulang Hermes/sesi ini agar perkakas kroombox_* termuat." -ForegroundColor Yellow
