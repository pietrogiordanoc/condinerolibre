# Script para crear embed.html para las 4 nuevas páginas educativas

$newPages = @(
    "gestion-de-riesgo-trading",
    "velas-japonesas-trading",
    "psicologia-del-trading",
    "soportes-y-resistencias"
)

$baseDir = "c:\Users\pietr\OneDrive\Desktop\CONDINEROLIBRE\web\aprende"

foreach ($page in $newPages) {
    $sourceFile = "$baseDir\$page\index.html"
    $targetFile = "$baseDir\$page\embed.html"
    
    if (!(Test-Path $sourceFile)) {
        Write-Host "⚠ No encontrado: $sourceFile" -ForegroundColor Yellow
        continue
    }
    
    # Leer contenido del index.html
    $content = Get-Content $sourceFile -Raw -Encoding UTF8
    
    # Extraer el <main> content usando regex
    if ($content -match '(?s)(<main\s+class="[^"]*">.*?</main>)') {
        $mainContent = $Matches[1]
        
        # Limpiar botones redundantes de "Acceder a la plataforma"
        $mainContent = $mainContent -replace '(?s)<a\s+href="/login/[^>]*>\s*<button[^>]*>.*?Acceder a la plataforma.*?</button>\s*</a>', ''
        $mainContent = $mainContent -replace '(?s)<a\s+class="[^"]*"\s+href="/login/[^>]*>\s*Acceder a la plataforma.*?</a>', ''
        
        # Extraer title del head
        $title = "Embed Page"
        if ($content -match '<title>([^<]+)</title>') {
            $title = $Matches[1]
        }
        
        # Template completo para embed
        $embedHTML = @"
<!DOCTYPE html>
<html class="dark" lang="es">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <meta name="robots" content="noindex,nofollow" />
  <title>$title</title>

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

$mainContent

<script>
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
"@
        
        # Guardar embed.html
        $embedHTML | Out-File -FilePath $targetFile -Encoding UTF8
        Write-Host "✓ Creado: $page\embed.html" -ForegroundColor Green
        
    } else {
        Write-Host "⚠ No se pudo extraer <main> de: $page" -ForegroundColor Yellow
    }
}

Write-Host "`n✓ Proceso completado" -ForegroundColor Cyan
