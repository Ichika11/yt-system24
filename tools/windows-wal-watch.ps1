<#
    windows-wal-watch.ps1 — wallpaper-driven theming on Windows.

    Windows has no wallpaper-change event, so this polls the registry key
    Explorer writes when the wallpaper changes. On a change it re-runs pywal
    and copies the rendered stylesheet to a fixed path.

    Stylus live-reloads a UserCSS installed from a file:// URL, so pointing it
    at that fixed path is what closes the loop — nothing has to talk to the
    browser.

    STATUS: UNTESTED. Written on Linux, never run on Windows. If it works,
    say so and this note comes out; if it doesn't, the failure is worth
    recording here.

    Setup:
        pip install pywal colorthief
        mkdir  $env:USERPROFILE\.config\wal\templates
        copy   templates\youtube.user.css $env:USERPROFILE\.config\wal\templates\

    Run:
        powershell -ExecutionPolicy Bypass -File tools\windows-wal-watch.ps1

    Then install the style in Stylus from the file:// URL it prints, and grant
    Stylus local-file access (about:addons -> Stylus -> Permissions).
#>
param(
    [string]$Out = "$env:USERPROFILE\yt-system24-live.user.css",
    [int]$IntervalSeconds = 5,
    # pywal's default backend needs ImageMagick; colorthief is pure Python and
    # installs with pip, which is one less thing to get working on Windows.
    [string]$Backend = "colorthief"
)

$key = 'HKCU:\Control Panel\Desktop'
$rendered = Join-Path $env:USERPROFILE '.cache\wal\youtube.user.css'
$last = ''

if (-not (Get-Command wal -ErrorAction SilentlyContinue)) {
    Write-Error "pywal not on PATH. Try: pip install pywal colorthief"
    exit 1
}

Write-Host "watching wallpaper every ${IntervalSeconds}s"
Write-Host "writing  $Out"
Write-Host "install in Stylus from:  file:///$($Out -replace '\\','/')"
Write-Host ""

while ($true) {
    try {
        $wp = (Get-ItemProperty -Path $key -Name WallPaper -ErrorAction Stop).WallPaper
    } catch {
        Start-Sleep -Seconds $IntervalSeconds; continue
    }

    if ($wp -and $wp -ne $last -and (Test-Path $wp)) {
        $last = $wp
        Write-Host "[$(Get-Date -Format HH:mm:ss)] $wp"

        # -n skip setting the wallpaper (Windows already did), -s -t -e keep
        # pywal from touching terminals, titles and reload hooks
        & wal -i "$wp" -n -s -t -e --backend $Backend 2>&1 | Out-Null

        if (Test-Path $rendered) {
            Copy-Item $rendered $Out -Force
            Write-Host "  -> $Out"
        } else {
            Write-Warning "  pywal ran but produced no youtube.user.css."
            Write-Warning "  Is the template in $env:USERPROFILE\.config\wal\templates\ ?"
        }
    }

    Start-Sleep -Seconds $IntervalSeconds
}
