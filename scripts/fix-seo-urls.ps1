# Script de Corrección Masiva de URLs SEO
# Corrige subdominios antiguos a la estructura unificada
# Autor: ConDineroLibre
# Fecha: 2026-04-20

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CORRECIÓN MASIVA DE URLs SEO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$rootPath = $PSScriptRoot

# Definir patrones de reemplazo
$replacements = @(
    @{
        Old = 'https://aprende.condinerolibre.com/'
        New = 'https://www.condinerolibre.com/aprende/'
        Name = 'Subdominio Aprende'
    },
    @{
        Old = 'https://cursos.condinerolibre.com/'
        New = 'https://www.condinerolibre.com/cursos/'
        Name = 'Subdominio Cursos'
    },
    @{
        Old = 'https://brokers.condinerolibre.com/'
        New = 'https://www.condinerolibre.com/brokers/'
        Name = 'Subdominio Brokers'
    }
)

# Contadores
$totalFiles = 0
$totalReplacements = 0

Write-Host "🔍 Buscando archivos HTML..." -ForegroundColor Yellow
Write-Host ""

# Obtener todos los archivos HTML (excluir node_modules, .git, admin)
$htmlFiles = Get-ChildItem -Path $rootPath -Recurse -Include *.html -File | 
    Where-Object { 
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\.git\\' -and
        $_.FullName -notmatch '\\admin\\' -and
        $_.FullName -notmatch '\\cdl-portal\\' -and
        $_.FullName -notmatch '\\modulo home\\' -and
        $_.FullName -notmatch '\\modulo ' -and
        $_.FullName -notmatch '\\radar\\' 
    }

Write-Host "📄 Archivos encontrados: $($htmlFiles.Count)" -ForegroundColor Green
Write-Host ""

foreach ($file in $htmlFiles) {
    $relativePath = $file.FullName.Replace($rootPath, "").TrimStart('\')
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    $fileModified = $false
    $fileReplacements = 0

    foreach ($replacement in $replacements) {
        if ($content -match [regex]::Escape($replacement.Old)) {
            $count = ([regex]::Matches($content, [regex]::Escape($replacement.Old))).Count
            $content = $content -replace [regex]::Escape($replacement.Old), $replacement.New
            $fileReplacements += $count
            $fileModified = $true
        }
    }

    if ($fileModified) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "✅ " -ForegroundColor Green -NoNewline
        Write-Host "$relativePath " -ForegroundColor White -NoNewline
        Write-Host "($fileReplacements reemplazos)" -ForegroundColor Yellow
        $totalFiles++
        $totalReplacements += $fileReplacements
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESUMEN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📄 Archivos modificados: $totalFiles" -ForegroundColor Green
Write-Host "🔄 Total de reemplazos: $totalReplacements" -ForegroundColor Green
Write-Host ""

if ($totalFiles -gt 0) {
    Write-Host "✅ URLs corregidas exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📌 SIGUIENTE PASO:" -ForegroundColor Yellow
    Write-Host "   Ejecuta: git add ." -ForegroundColor White
    Write-Host "   Luego: git commit -m 'SEO: Corregir URLs de subdominios antiguos'" -ForegroundColor White
    Write-Host "   Finalmente: git push" -ForegroundColor White
} else {
    Write-Host "ℹ️  No se encontraron URLs para corregir" -ForegroundColor Cyan
}

Write-Host ""
