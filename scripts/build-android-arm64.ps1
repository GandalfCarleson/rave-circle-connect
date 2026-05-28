param(
  [ValidateSet("debug", "release")]
  [string]$Profile = "debug"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidProject = Join-Path $root "src-tauri\gen\android"
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$ndk = if ($env:ANDROID_NDK_HOME) { $env:ANDROID_NDK_HOME } else { Join-Path $sdk "ndk\23.2.8568313" }
$jdkCandidates = @(
  $env:JAVA_HOME,
  "C:\Program Files (x86)\Android\openjdk\jdk-17.0.12",
  "C:\Program Files\Android\Android Studio\jbr"
) | Where-Object { $_ -and (Test-Path (Join-Path $_ "bin\java.exe")) }

if (-not (Test-Path (Join-Path $sdk "cmdline-tools\latest\bin\sdkmanager.bat"))) {
  throw "Android SDK command-line tools were not found at '$sdk'. Run 'npm run android:init' after installing Android SDK tools."
}

if (-not (Test-Path $ndk)) {
  throw "Android NDK was not found at '$ndk'. Install NDK 23.2.8568313 or set ANDROID_NDK_HOME."
}

if (-not $jdkCandidates) {
  throw "JDK 17 was not found. Set JAVA_HOME to a JDK 17 installation."
}

$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:ANDROID_NDK_HOME = $ndk
$env:NDK_HOME = $ndk
$env:JAVA_HOME = @($jdkCandidates)[0]
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

Push-Location $root
try {
  $tauriLog = Join-Path $env:TEMP "rave-circle-tauri-android-build.log"
  $tauriProfileArg = if ($Profile -eq "debug") { "--debug" } else { "" }
  cmd /c "npm run tauri -- android build $tauriProfileArg --target aarch64 --apk > `"$tauriLog`" 2>&1"
  if ($LASTEXITCODE -ne 0) {
    $nativeProfileDir = if ($Profile -eq "debug") { "debug" } else { "release" }
    $nativeLib = Join-Path $root "src-tauri\target\aarch64-linux-android\$nativeProfileDir\librave_circle_lib.so"
    if (-not (Test-Path $nativeLib)) {
      Get-Content $tauriLog
      exit $LASTEXITCODE
    }

    Write-Warning "Tauri could not create Windows symlinks; packaging arm64 APK by copying the native library."
    $jniDir = Join-Path $androidProject "app\src\main\jniLibs\arm64-v8a"
    New-Item -ItemType Directory -Force -Path $jniDir | Out-Null
    Copy-Item -Force $nativeLib (Join-Path $jniDir "librave_circle_lib.so")

    Push-Location $androidProject
    try {
      if ($Profile -eq "debug") {
        .\gradlew.bat assembleArm64Debug -x rustBuildArm64Debug
      } else {
        .\gradlew.bat assembleArm64Release -x rustBuildArm64Release
      }
      if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
      }
    } finally {
      Pop-Location
    }
  }
} finally {
  Pop-Location
}
