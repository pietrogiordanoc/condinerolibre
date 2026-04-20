# Script para crear páginas embed.html sin header/footer
# Elimina botones redundantes de "Acceder a la plataforma"

$pages = @(
    "indices-para-trading",
    "acciones-para-trading",
    "cripto-para-principiantes",
    "que-es-el-spread",
    "que-es-el-slippage",
    "el-swap-overnight",
    "horarios-sesiones-forex",
    "que-es-un-pip",
    "que-es-un-lote",
    "timeframes",
    "tipos-de-ordenes",
    "liquidez-y-volatilidad",
    "tipos-de-mercado",
    "que-es-el-trading"
)

$baseTemplate = @'
<!DOCTYPE html>
<html class="dark" lang="es">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>{{TITLE}} | CDL</title>

  <!-- Fonts / Icons / Tailwind -->
  <link href="https://fonts.googleapis.com" rel="preconnect"/>
  <link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
  <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&family=Noto+Sans:wght@100..900&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

  <script id="tailwind-config">
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            primary: "#39E079",
            "background-light": "#f6f8f7",
            "background-dark": "#122017",
            "surface-dark": "#1c2633",
            "surface-darker": "#111822"
          },
          fontFamily: {
            display: "Lexend",
            body: ["Noto Sans", "sans-serif"]
          }
        }
      }
    };
  </script>

  <style>
    html { scroll-behavior: smooth; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  </style>
</head>

<body class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-50 font-display antialiased selection:bg-primary selection:text-white">

{{MAIN_CONTENT}}

<script>
// Image modal zoom functionality
const zoomBtn = document.getElementById('zoom-btn');
const modal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalBackdrop = document.getElementById('modal-backdrop');

function openImageModal() {
  if (!modal) return;
  modal.classList.remove('pointer-events-none');
  setTimeout(() => {
    modal.style.backdropFilter = 'blur(20px)';
    modal.classList.remove('opacity-0');
  }, 50);
  setTimeout(() => {
    if (modalImage) modalImage.style.transform = 'scale(1)';
  }, 100);
}

function closeImageModal() {
  if (!modal || !modalImage) return;
  modalImage.style.transform = 'scale(0)';
  setTimeout(() => {
    modal.classList.add('opacity-0');
    modal.style.backdropFilter = 'blur(0px)';
  }, 200);
  setTimeout(() => {
    modal.classList.add('pointer-events-none');
  }, 700);
}

if (zoomBtn) zoomBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  openImageModal();
});

if (closeModalBtn) closeModalBtn.addEventListener('click', closeImageModal);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeImageModal);
if (modal) modal.addEventListener('click', (e) => {
  if (e.target === modal) closeImageModal();
});
</script>

</body>
</html>
'@

foreach ($page in $pages) {
    $indexPath = "aprende\$page\index.html"
    $embedPath = "aprende\$page\embed.html"
    
    Write-Host "Processing: $page" -ForegroundColor Cyan
    
    if (-not (Test-Path $indexPath)) {
        Write-Host "  ⚠️  File not found: $indexPath" -ForegroundColor Yellow
        continue
    }
    
    # Leer contenido completo
    $content = Get-Content $indexPath -Raw -Encoding UTF8
    
    # Extraer título de la página
    if ($content -match '<title>(.*?)</title>') {
        $title = $matches[1] -replace ' \| Guía CDL', '' -replace ' \| CDL', ''
    } else {
        $title = $page -replace '-', ' '
    }
    
    # Extraer contenido <main>
    if ($content -match '(?s)<main class="[^"]*">(.*?)</main>') {
        $mainContent = $matches[1]
        
        # Eliminar botones redundantes de "Acceder a la plataforma"
        # Patrón 1: Div con botón dentro del hero
        $mainContent = $mainContent -replace '(?s)<div class="flex flex-wrap gap-4 pt-2">.*?Acceder a la plataforma.*?</a>\s*</div>', ''
        
        # Patrón 2: Sección de siguiente paso con botón
        $mainContent = $mainContent -replace '(?s)<div class="flex-shrink-0">.*?Acceder a la plataforma.*?</a>\s*</div>', ''
        
        # Patrón 3: Cualquier enlace a /cdl-portal/login o dashboard con "Acceder"
        $mainContent = $mainContent -replace '(?s)<a[^>]*href="/cdl-portal/(login|dashboard)[^"]*"[^>]*>.*?Acceder a la plataforma.*?</a>', ''
        
        # Crear contenido final
        $finalContent = $baseTemplate -replace '{{TITLE}}', $title -replace '{{MAIN_CONTENT}}', "<main class=`"relative flex flex-col items-center w-full min-h-screen pt-8 pb-20`">$mainContent</main>"
        
        # Guardar archivo
        $finalContent | Out-File -FilePath $embedPath -Encoding UTF8 -NoNewline
        Write-Host "  ✅ Created: $embedPath" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Could not extract <main> content from $indexPath" -ForegroundColor Red
    }
}

Write-Host "`n✨ Done! Created embed.html files for all pages." -ForegroundColor Green
