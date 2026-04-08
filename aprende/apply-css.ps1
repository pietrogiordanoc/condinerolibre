$pages = @("el-swap-overnight", "horarios-sesiones-forex")

$cssBlock = @"
<style>
.mega-menu { opacity: 0; visibility: hidden; transform: translateY(-10px); transition: opacity 260ms ease-out, transform 260ms ease-out, visibility 260ms; }
.nav-item-dropdown.is-open .mega-menu { opacity: 1; visibility: visible; transform: translateY(0); }
.platform-menu { left: 50%; transform: translateX(-50%); width: 548px; }
.learn-menu { left: 50%; transform: translateX(-50%); width: 612px; }
.mobile-menu { transform: translateX(100%); transition: transform 0.3s ease-in-out; }
.mobile-menu.active { transform: translateX(0); }
@media (min-width: 1024px) {
  .nav-item-dropdown.is-open .mega-menu { transform: translateY(0); }
  .nav-item-dropdown.is-open .platform-menu { transform: translateX(-50%) translateY(0); }
  .nav-item-dropdown.is-open .learn-menu { transform: translateX(-50%) translateY(0); }
}
</style>
"@

foreach ($page in $pages) {
    $file = "$page\index.html"
    Write-Host "Processing $file" -ForegroundColor Green
    $content = Get-Content $file -Raw -Encoding UTF8
    
    # Insertar CSS antes de </head>
    $content = $content -replace '</head>', "$cssBlock`n</head>"
    
    Set-Content $file -Value $content -Encoding UTF8 -NoNewline
}

Write-Host "CSS applied successfully to swap and horarios!" -ForegroundColor Yellow
