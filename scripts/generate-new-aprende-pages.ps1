# Script para generar nuevas páginas del área Aprende con contenido completo
# Incluye index.html y embed.html para cada página

$pages = @{
    "gestion-de-riesgo-trading" = @{
        title = "Gestión de Riesgo en Trading"
        shortTitle = "Gestión de Riesgo"
        description = "Guía completa de gestión de riesgo: cómo calcular el tamaño de posición, risk-reward ratio, drawdown y reglas de oro para proteger tu capital."
        icon = "shield_with_heart"
        iconColor = "emerald"
        category = "Fundamentos"
    }
    "velas-japonesas-trading" = @{
        title = "Velas Japonesas en Trading"
        shortTitle = "Velas Japonesas"
        description = "Qué son las velas japonesas, cómo leerlas, patrones más importantes (doji, martillo, envolvente) y cómo aplicarlas en tu análisis técnico."
        icon = "candlestick_chart"
        iconColor = "blue"
        category = "Análisis"
    }
    "soportes-y-resistencias" = @{
        title = "Soportes y Resistencias en Trading"
        shortTitle = "Soportes y Resistencias"
        description = "Cómo identificar soportes y resistencias, zonas clave de precio, rupturas, retesteos y su uso en estrategias de trading."
        icon = "show_chart"
        iconColor = "purple"
        category = "Análisis"
    }
    "psicologia-del-trading" = @{
        title = "Psicología del Trading"
        shortTitle = "Psicología del Trading"
        description = "Control emocional, disciplina, gestión del miedo y la avaricia. Cómo construir la mentalidad correcta para ser consistente en trading."
        icon = "psychology"
        iconColor = "yellow"
        category = "Fundamentos"
    }
    "estrategia-scalping" = @{
        title = "Estrategia Scalping en Trading"
        shortTitle = "Scalping"
        description = "Qué es scalping, timeframes ideales, mercados más líquidos, gestión de costes y si esta estrategia rápida es adecuada para ti."
        icon = "speed"
        iconColor = "red"
        category = "Estrategias"
    }
    "estrategia-swing-trading" = @{
        title = "Estrategia Swing Trading"
        shortTitle = "Swing Trading"
        description = "Swing trading: operaciones de varios días, análisis de tendencias, paciencia y gestión del tiempo. Ideal para traders con trabajo."
        icon = "trending_up"
        iconColor = "green"
        category = "Estrategias"
    }
    "estrategia-day-trading" = @{
        title = "Estrategia Day Trading"
        shortTitle = "Day Trading"
        description = "Day trading: operaciones intradía, sesiones más activas, gestión de tiempo y capital. Sin posiciones overnight."
        icon = "schedule"
        iconColor = "orange"
        category = "Estrategias"
    }
    "analisis-fundamental-trading" = @{
        title = "Análisis Fundamental en Trading"
        shortTitle = "Análisis Fundamental"
        description = "Cómo afectan las noticias económicas al trading: NFP, tipos de interés, PIB, calendario económico y reacción del mercado."
        icon = "article"
        iconColor = "indigo"
        category = "Análisis"
    }
    "como-elegir-broker" = @{
        title = "Cómo Elegir un Broker de Trading"
        shortTitle = "Elegir un Broker"
        description = "Qué buscar en un broker: regulación, spreads, comisiones, plataformas, apalancamiento y señales de alerta para evitar estafas."
        icon = "verified"
        iconColor = "cyan"
        category = "Fundamentos"
    }
    "cuentas-fondeadas-prop-trading" = @{
        title = "Cuentas Fondeadas y Prop Trading"
        shortTitle = "Prop Trading"
        description = "Qué son las prop firms, cómo funcionan las cuentas fondeadas, requisitos, costes, ventajas y riesgos del prop trading."
        icon = "account_balance_wallet"
        iconColor = "teal"
        category = "Fundamentos"
    }
    "journal-de-trading" = @{
        title = "Journal de Trading: Diario de Operaciones"
        shortTitle = "Journal de Trading"
        description = "Por qué llevar un journal de trading, qué registrar, cómo analizar tus operaciones y mejorar tu consistencia con datos."
        icon = "book"
        iconColor = "pink"
        category = "Fundamentos"
    }
    "errores-comunes-trading" = @{
        title = "Errores Comunes en Trading"
        shortTitle = "Errores Comunes"
        description = "Los 10 errores más comunes de traders principiantes: overtrading, falta de plan, revenge trading y cómo evitarlos."
        icon = "warning"
        iconColor = "amber"
        category = "Fundamentos"
    }
}

Write-Host "🚀 Generating new Aprende pages..." -ForegroundColor Cyan
Write-Host ""

foreach ($slug in $pages.Keys) {
    $page = $pages[$slug]
    $folderPath = "aprende\$slug"
    
    Write-Host "📄 Creating: $slug" -ForegroundColor Yellow
    
    # Crear carpeta
    if (-not (Test-Path $folderPath)) {
        New-Item -ItemType Directory -Path $folderPath -Force | Out-Null
    }
    
    # Placeholder - Las páginas reales se crearán manualmente con contenido completo
    # Este script solo crea la estructura
    
    $placeholder = @"
<!-- Página: $($page.title) -->
<!-- Esta página será generada con contenido completo -->
<!-- Slug: $slug -->
<!-- Categoría: $($page.category) -->
"@
    
    $placeholder | Out-File -FilePath "$folderPath\README.md" -Encoding UTF8
    
    Write-Host "  ✅ Structure created for $slug" -ForegroundColor Green
}

Write-Host ""
Write-Host "✨ Page structure created!" -ForegroundColor Green
Write-Host "📝 Next: Generate full HTML content for each page" -ForegroundColor Cyan
