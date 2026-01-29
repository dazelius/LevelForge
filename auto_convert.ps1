# LEVELFORGE Auto Converter
# Automatically converts JSON to FBX when saved
# Usage: Run this script once to start background monitoring

$watchPath = "C:\Level"
$filter = "*.json"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LEVELFORGE Auto Converter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Watch folder: $watchPath" -ForegroundColor Yellow
Write-Host "Watch target: All .json files" -ForegroundColor Yellow
Write-Host ""
Write-Host "Auto FBX conversion on JSON save." -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Waiting..." -ForegroundColor Gray

# Last processed time (prevent duplicates)
$script:lastProcessedFile = ""
$script:lastProcessedTime = [DateTime]::MinValue

# File system watcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $watchPath
$watcher.Filter = $filter
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName
$watcher.IncludeSubdirectories = $false

# Start watching
$watcher.EnableRaisingEvents = $true

Write-Host "[Ready] Watching for JSON file changes..." -ForegroundColor Green
Write-Host ""

# Infinite loop
try {
    while ($true) {
        # Wait for event (timeout 1 second)
        $result = $watcher.WaitForChanged([System.IO.WatcherChangeTypes]::Changed -bor [System.IO.WatcherChangeTypes]::Created, 1000)
        
        if ($result.TimedOut) {
            continue
        }
        
        $fileName = $result.Name
        $path = Join-Path $watchPath $fileName
        $now = Get-Date
        $timestamp = $now.ToString("HH:mm:ss")
        
        # Skip if same file within 2 seconds (debounce)
        if ($fileName -eq $script:lastProcessedFile -and ($now - $script:lastProcessedTime).TotalSeconds -lt 2) {
            continue
        }
        
        $script:lastProcessedFile = $fileName
        $script:lastProcessedTime = $now
        
        Write-Host ""
        Write-Host "[$timestamp] Change detected: $fileName" -ForegroundColor Green
        
        # Small delay (wait for file write completion)
        Start-Sleep -Milliseconds 500
        
        # Check if file exists
        if (-not (Test-Path $path)) {
            Write-Host "[$timestamp] File not found: $path" -ForegroundColor Red
            continue
        }
        
        # Run BAT (pass changed JSON file path)
        Write-Host "[$timestamp] Starting FBX conversion..." -ForegroundColor Yellow
        $batPath = "C:\Level\convert_to_fbx.bat"
        
        if (Test-Path $batPath) {
            # Run bat file directly with argument
            Push-Location $watchPath
            try {
                & cmd.exe /c "`"$batPath`" `"$path`""
                $exitCode = $LASTEXITCODE
                
                if ($exitCode -eq 0) {
                    Write-Host "[$timestamp] Done: $fileName -> FBX" -ForegroundColor Green
                } else {
                    Write-Host "[$timestamp] Conversion failed (exit code: $exitCode)" -ForegroundColor Red
                }
            } finally {
                Pop-Location
            }
        } else {
            Write-Host "[$timestamp] ERROR: convert_to_fbx.bat not found!" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "Waiting..." -ForegroundColor Gray
    }
} finally {
    # Cleanup
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
    Write-Host "Watcher stopped" -ForegroundColor Red
}
