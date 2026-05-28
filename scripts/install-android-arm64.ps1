param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$adb = Join-Path $sdk "platform-tools\adb.exe"
$apk = Join-Path $root "src-tauri\gen\android\app\build\outputs\apk\arm64\debug\app-arm64-debug.apk"

if (-not (Test-Path $adb)) {
  throw "adb was not found at '$adb'. Install Android platform-tools or set ANDROID_HOME."
}

if (-not $SkipBuild) {
  Push-Location $root
  try {
    npm run android:build:arm64
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $apk)) {
  throw "APK was not found at '$apk'. Run npm run android:build:arm64 first."
}

$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_.Trim() }
$readyDevices = @($devices | Where-Object { $_ -match "\sdevice($|\s)" })
$unauthorizedDevices = @($devices | Where-Object { $_ -match "\sunauthorized($|\s)" })

if ($unauthorizedDevices.Count -gt 0) {
  throw "Phone is connected but unauthorized. Unlock it and accept the USB debugging prompt, then rerun this command."
}

if ($readyDevices.Count -eq 0) {
  throw "No Android device is visible to adb. Enable Developer options + USB debugging, connect the phone by USB, and run 'adb devices'."
}

& $adb install -r -d $apk
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
