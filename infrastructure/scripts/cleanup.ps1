# FISH_MARKET Cleanup Script
param (
    [switch]$WhatIf
)

$targetFiles = @(
    "*.log", "*.tmp", "*.bak",
    "*_old.*", "*_v2.*", "*_final.*", "*_backup.*", "*_copy.*",
    "*_lint_*.json", "owner_lint*.json", "client_lint_out.txt", "compact_lint.txt",
    "final_lint.json", "lint.txt", "lint2.txt", "lint_output.txt", "lint_results.json",
    "tsc*.txt", "unix_lint.txt", "my_tree.txt", "size_before.txt", "structure.txt", "tree.txt",
    "Thumbs.db", ".DS_Store"
)

if ($WhatIf) {
    Write-Host "🐟 FISH_MARKET Cleanup — DRY RUN" -ForegroundColor Cyan
    Get-ChildItem -Recurse -Include $targetFiles | Where-Object {
        $_.FullName -notlike "*\node_modules\*" -and
        $_.FullName -notlike "*\.git\*"
    } | Select-Object FullName
} else {
    Write-Host "🐟 FISH_MARKET Cleanup — EXECUTING" -ForegroundColor Red
    Get-ChildItem -Recurse -Include $targetFiles | Where-Object {
        $_.FullName -notlike "*\node_modules\*" -and
        $_.FullName -notlike "*\.git\*"
    } | Remove-Item -Force
    Write-Host "✅ Cleanup complete!" -ForegroundColor Green
}
