$pages = @("que-es-el-spread", "que-es-el-slippage", "el-swap-overnight", "horarios-sesiones-forex")

$footerTemplate = @"
  </div>
</main>

<footer id="about-cdl" class="bg-bg-blue py-12">
  <div class="wrap">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-white/10">
      <div><img src="https://ik.imagekit.io/primel/ConDineroLibreImages/logocdl.png?updatedAt=1766903325070" alt="ConDineroLibre" class="h-12 mb-4"><p class="text-footer-text text-sm">Plataforma de análisis profesional para traders.</p></div>
      <div><h4 class="text-white font-bold mb-4">Enlaces</h4><ul class="space-y-2 text-footer-text text-sm"><li><a href="/" class="hover:text-primary transition-colors">Inicio</a></li><li><a href="/aprende/que-es-el-trading/" class="hover:text-primary transition-colors">Aprende</a></li><li><a href="/#cdlradar" class="hover:text-primary transition-colors">CDL Radar</a></li><li><a href="/como-funciona/" class="hover:text-primary transition-colors">Cómo Funciona</a></li></ul></div>
      <div><h4 class="text-white font-bold mb-4">Legal</h4><ul class="space-y-2 text-footer-text text-sm"><li><a href="/legal/terminos/" class="hover:text-primary transition-colors">Términos y Condiciones</a></li><li><a href="/legal/privacidad/" class="hover:text-primary transition-colors">Política de Privacidad</a></li><li><a href="/legal/cookies/" class="hover:text-primary transition-colors">Política de Cookies</a></li></ul></div>
      <div><h4 class="text-white font-bold mb-4">Redes Sociales</h4><div class="flex space-x-4"><a href="#" class="text-footer-text hover:text-primary transition-colors"><span class="material-symbols-outlined">X</span></a><a href="#" class="text-footer-text hover:text-primary transition-colors"><span class="material-symbols-outlined">link</span></a><a href="#" class="text-footer-text hover:text-primary transition-colors"><span class="material-symbols-outlined">mail</span></a></div></div>
    </div>
    <div class="pt-8 text-center"><p class="text-footer-text text-sm mb-4">© 2025 ConDineroLibre. Todos los derechos reservados.</p><p class="text-footer-text text-xs max-w-4xl mx-auto">El trading de instrumentos financieros conlleva un alto nivel de riesgo y puede no ser adecuado para todos los inversores. Los resultados pasados no garantizan resultados futuros. Esta plataforma es solo para fines educativos e informativos.</p></div>
  </div>
</footer>

<script>
function rewriteLocalModuleLinks(){const e=window.location.hostname;if("localhost"===e||"127.0.0.1"===e)return;document.querySelectorAll('a[href^="/"]').forEach(t=>{let l=t.getAttribute("href");l.startsWith("/")||(l="/"+l);const o={"/":"https://www.condinerolibre.com","/aprende/":"https://aprende.condinerolibre.com","/brokers/":"https://brokers.condinerolibre.com","/radar/":"https://radar.condinerolibre.com","/cdl-portal/":"https://portal.condinerolibre.com","/cursos/":"https://cursos.condinerolibre.com"};for(const[e,r]of Object.entries(o))if(l.startsWith(e)){const o=l.substring(e.length);return void t.setAttribute("href",r+(o.startsWith("/")?o:"/"+o))}t.setAttribute("href","https://www.condinerolibre.com"+l)})}document.addEventListener("DOMContentLoaded",()=>{rewriteLocalModuleLinks();const e=document.getElementById("mobile-menu-btn"),t=document.getElementById("mobile-menu-close"),l=document.getElementById("mobile-menu");e&&l&&(e.addEventListener("click",()=>{l.classList.add("active")}),t&&t.addEventListener("click",()=>{l.classList.remove("active")}),document.addEventListener("click",e=>{l.classList.contains("active")&&!l.contains(e.target)&&e.target!==document.getElementById("mobile-menu-btn")&&l.classList.remove("active")}));const o=document.querySelectorAll(".nav-item-dropdown");let r=null;o.forEach(e=>{const t=e.querySelector(".mega-menu");e.addEventListener("mouseenter",()=>{clearTimeout(r),o.forEach(e=>e.classList.remove("is-open")),e.classList.add("is-open")}),e.addEventListener("mouseleave",()=>{r=setTimeout(()=>{e.classList.remove("is-open")},260)}),t&&t.addEventListener("mouseenter",()=>{clearTimeout(r)})}),document.querySelectorAll('a[href^="#"]').forEach(e=>{e.addEventListener("click",function(e){e.preventDefault();const t=this.getAttribute("href");if("#"===t)return;const l=document.querySelector(t);l&&l.scrollIntoView({behavior:"smooth",block:"start"})})})});
</script>
</body>
</html>
"@

foreach ($page in $pages) {
    $file = "$page\index.html"
    Write-Host "Processing $file" -ForegroundColor Green
    $content = Get-Content $file -Raw -Encoding UTF8
    
    # Reemplazar desde el cierre </div> del wrap hasta </html>
    $content = $content -replace '(?s)</div>\s*</div>\s*<footer.*?</html>', "$footerTemplate"
    
    Set-Content $file -Value $content -Encoding UTF8 -NoNewline
}

Write-Host "Footers applied successfully!" -ForegroundColor Yellow
