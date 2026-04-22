# Script para generar las 7 páginas restantes de aprende con estructura optimizada

$pages = @(
  @{
    slug = "estrategia-scalping"
    title = "Estrategia Scalping en Trading: Guía para Operar Rápido"
    description = "Scalping en trading: qué es, cómo funciona, timeframes, mercados líquidos, costos de trading y si es para ti."
    badge = "Estrategias"
    badgeColor = "red"
    icon = "speed"
    gradient = "from-red-400 to-orange-400"
    heroImage = "scalping-hero.jpg"
    sections = @(
      @{id="que-es"; title="¿Qué es scalping?"; content="<p>Scalping es una estrategia de trading <strong>ultra corto plazo</strong> donde abres y cierras posiciones en minutos (o segundos). Objetivo: capturar movimientos pequeños de precio repetidamente.</p><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50 mb-4'><p class='text-slate-300 text-sm'><strong>Timeframes típicos:</strong> M1, M5, M15<br><strong>Duración trades:</strong> 30 segundos a 15 minutos<br><strong>Objetivo por trade:</strong> 5-15 pips en Forex, $0.50-$2 en acciones</p></div><p class='text-slate-300'>Requiere alta concentración, spreads bajos, ejecución rápida y disciplina férrea.</p>"}
      @{id="ventajas-desventajas"; title="Ventajas y desventajas"; content="<h3 class='text-lg font-bold text-emerald-400 mb-3'>✓ Ventajas</h3><ul class='text-slate-300 text-sm space-y-1 mb-4'><li>• Sin riesgo overnight (no dejas posiciones abiertas)</li><li>• Muchas oportunidades diarias</li><li>• Ganancias rápidas si eres consistente</li></ul><h3 class='text-lg font-bold text-red-400 mb-3'>✗ Desventajas</h3><ul class='text-slate-300 text-sm space-y-1'><li>• Muy estresante y demandante</li><li>• Costos (spreads/comisiones) se acumulan</li><li>• Requiere capital decente para que valga la pena</li><li>• No apto para principiantes</li></ul>"}
      @{id="requisitos"; title="Qué necesitas"; content="<div class='grid grid-cols-1 md:grid-cols-2 gap-4'><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50'><div class='text-blue-400 font-bold mb-2'>Broker adecuado</div><p class='text-sm text-slate-300'>Spreads ultra bajos (ECN/STP), ejecución instantánea, sin requotes.</p></div><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50'><div class='text-purple-400 font-bold mb-2'>Mercados líquidos</div><p class='text-sm text-slate-300'>EUR/USD, GBP/USD, índices mayores. Evita pares exóticos.</p></div><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50'><div class='text-emerald-400 font-bold mb-2'>Horarios activos</div><p class='text-sm text-slate-300'>Sesión europea + overlap NY (8am-12pm EST).</p></div><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50'><div class='text-orange-400 font-bold mb-2'>Gestión de riesgo</div><p class='text-sm text-slate-300'>Stop loss ajustado siempre. Máximo 0.5-1% riesgo.</p></div></div>"}
    )
  },
  @{
    slug = "estrategia-swing-trading"
    title = "Estrategia Swing Trading: Operar Tendencias Multi-Día"
    description = "Swing trading: qué es, timeframes, análisis técnico, gestión de tiempo y cómo capturar swings de mercado."
    badge = "Estrategias"
    badgeColor = "blue"
    icon = "trending_up"
    gradient = "from-blue-400 to-cyan-400"
    heroImage = "swing-trading-hero.jpg"
    sections = @(
      @{id="que-es"; title="¿Qué es swing trading?"; content="<p>Swing trading busca capturar <strong>movimientos de precio de varios días a semanas</strong>. Operas el 'swing' (oscilación) de tendencias sin estar pegado al gráfico todo el día.</p><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50 mb-4'><p class='text-slate-300 text-sm'><strong>Timeframes típicos:</strong> H4, D1, W1<br><strong>Duración trades:</strong> 2 días a 3 semanas<br><strong>Objetivo por trade:</strong> 50-200 pips, 3-10% en acciones</p></div><p class='text-slate-300'>Perfecto para quienes tienen trabajo/estudio y no pueden hacer day trading.</p>"}
      @{id="ventajas"; title="Por qué funciona"; content="<ul class='space-y-2 text-slate-300'><li class='flex items-start gap-2'><span class='material-symbols-outlined text-emerald-500 mt-1 text-sm'>check_circle</span><span><strong>Menos tiempo en pantalla:</strong> Solo necesitas revisar gráficos 1-2 veces al día</span></li><li class='flex items-start gap-2'><span class='material-symbols-outlined text-emerald-500 mt-1 text-sm'>check_circle</span><span><strong>Costos menores:</strong> Pocos trades = menos comisiones que scalping</span></li><li class='flex items-start gap-2'><span class='material-symbols-outlined text-emerald-500 mt-1 text-sm'>check_circle</span><span><strong>Capturas movimientos grandes:</strong> Un swing puede darte 5-10% en una semana</span></li></ul>"}
      @{id="como-operar"; title="Cómo operar swings"; content="<div class='space-y-3'><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50'><div class='text-blue-400 font-bold mb-2'>1. Identifica tendencia</div><p class='text-sm text-slate-300'>Usa gráfico diario. Alcista (higher highs) o bajista (lower lows).</p></div><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50'><div class='text-purple-400 font-bold mb-2'>2. Espera retroceso</div><p class='text-sm text-slate-300'>No persigas el precio. Espera pullback a soporte/resistencia.</p></div><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50'><div class='text-emerald-400 font-bold mb-2'>3. Confirmación</div><p class='text-sm text-slate-300'>Patrón de velas (martillo, envolvente) + rebote del nivel.</p></div><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50'><div class='text-orange-400 font-bold mb-2'>4. Gestiona</div><p class='text-sm text-slate-300'>Stop bajo swing low/high. Target: próxima resistencia/soporte mayor.</p></div></div>"}
    )
  },
  @{
    slug = "estrategia-day-trading"
    title = "Estrategia Day Trading: Operaciones Intraday sin Overnight"
    description = "Day trading: qué es, horarios de sesiones activas, timeframes, análisis intraday y gestión de riesgo diaria."
    badge = "Estrategias"
    badgeColor = "orange"
    icon = "today"
    gradient = "from-orange-400 to-red-400"
    heroImage = "day-trading-hero.jpg"
    sections = @(
      @{id="que-es"; title="¿Qué es day trading?"; content="<p>Day trading es abrir y cerrar todas tus posiciones <strong>dentro del mismo día</strong>. No dejas trades abiertos overnight, evitando riesgo de gaps.</p><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50 mb-4'><p class='text-slate-300 text-sm'><strong>Timeframes típicos:</strong> M15, M30, H1<br><strong>Duración trades:</strong> 30 minutos a 6 horas<br><strong>Objetivo:</strong> Capturar momentum intraday</p></div><p class='text-slate-300'>Requiere dedicación (mínimo 4-6 horas diarias frente a gráficos).</p>"}
      @{id="sesiones"; title="Horarios clave"; content="<div class='overflow-x-auto rounded-xl border border-slate-700'><table class='w-full text-left text-sm'><thead class='bg-surface-dark text-slate-200'><tr><th class='px-6 py-4'>Sesión</th><th class='px-6 py-4'>Horario (EST)</th><th class='px-6 py-4'>Activos</th></tr></thead><tbody class='divide-y divide-slate-700 bg-background-dark'><tr><td class='px-6 py-4 text-white'>Londres</td><td class='px-6 py-4'>3am-12pm</td><td class='px-6 py-4 text-slate-300'>EUR, GBP pares</td></tr><tr><td class='px-6 py-4 text-white'>Nueva York</td><td class='px-6 py-4'>8am-5pm</td><td class='px-6 py-4 text-slate-300'>USD pares, índices US</td></tr><tr><td class='px-6 py-4 text-emerald-400'>Overlap</td><td class='px-6 py-4'>8am-12pm</td><td class='px-6 py-4 text-emerald-400'>Máxima liquidez y volatilidad</td></tr></tbody></table></div><p class='text-slate-300 text-sm mt-4'>Evita operar en sesión asiática (baja volatilidad) a menos que hagas scalping.</p>"}
      @{id="ventajas-desventajas"; title="Pros y contras"; content="<h3 class='text-lg font-bold text-emerald-400 mb-2'>✓ Ventajas</h3><ul class='text-sm text-slate-300 space-y-1 mb-4'><li>• Sin riesgo overnight</li><li>• Resultados diarios (sabes si ganaste o perdiste cada día)</li><li>• Múltiples oportunidades</li></ul><h3 class='text-lg font-bold text-red-400 mb-2'>✗ Desventajas</h3><ul class='text-sm text-slate-300 space-y-1'><li>• Requiere tiempo completo o medio tiempo</li><li>• Alta presión psicológica</li><li>• Costos de spread/comisión se acumulan</li></ul>"}
    )
  },
  @{
    slug = "analisis-fundamental-trading"
    title = "Análisis Fundamental en Trading: Noticias e Impacto en Precio"
    description = "Análisis fundamental: cómo las noticias económicas (NFP, tasas de interés, PIB) impactan el precio y calendario económico."
    badge = "Análisis"
    badgeColor = "indigo"
    icon = "newspaper"
    gradient = "from-indigo-400 to-purple-400"
    heroImage = "fundamental-analysis-hero.jpg"
    sections = @(
      @{id="que-es"; title="¿Qué es análisis fundamental?"; content="<p>Análisis fundamental estudia <strong>eventos económicos y noticias</strong> que afectan el valor de un activo. Diferente del técnico (que solo mira gráficos).</p><p class='text-slate-300 mt-4'>Ejemplos: tasas de interés, NFP (nóminas no agrícolas), decisiones de bancos centrales, PIB, inflación.</p><div class='mt-4 p-4 bg-indigo-900/20 rounded border border-indigo-400/20 text-slate-200 text-sm'><strong>En Forex:</strong> Si la Fed sube tasas, USD tiende a fortalecerse. Si BCE las baja, EUR se debilita.</div>"}
      @{id="eventos-clave"; title="Eventos económicos importantes"; content="<div class='grid grid-cols-1 md:grid-cols-2 gap-3'><div class='bg-background-dark p-4 rounded-lg border border-red-700/50'><div class='text-red-400 font-bold mb-2'>🔴 Alto impacto</div><ul class='text-sm text-slate-300 space-y-1'><li>• NFP (Non-Farm Payrolls)</li><li>• Decisiones de tasas (Fed, ECB, BOE)</li><li>• Inflación (CPI, PCE)</li><li>• PIB trimestral</li></ul></div><div class='bg-background-dark p-4 rounded-lg border border-yellow-700/50'><div class='text-yellow-400 font-bold mb-2'>🟡 Impacto medio</div><ul class='text-sm text-slate-300 space-y-1'><li>• Peticiones de desempleo</li><li>• Ventas minoristas</li><li>• PMI manufactura/servicios</li></ul></div></div>"}
      @{id="calendario"; title="Calendario económico"; content="<p class='text-slate-300 mb-4'>Usa calendarios como <strong>Investing.com</strong>, <strong>ForexFactory</strong>, <strong>Myfxbook</strong> para saber cuándo salen noticias.</p><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50'><p class='text-emerald-400 font-bold mb-2'>Estrategia:</p><ul class='text-sm text-slate-300 space-y-1'><li>• Evita operar 15-30 min antes/después de noticias de alto impacto</li><li>• O usa noticias para confirmar bias direccional</li><li>• NUNCA 'gambles' en el evento mismo (volatilidad extrema)</li></ul></div>"}
    )
  },
  @{
    slug = "como-elegir-broker"
    title = "Cómo Elegir un Broker de Trading: Guía Completa 2026"
    description = "Cómo elegir broker: regulación, spreads, comisiones, plataformas, ejecución, depósito mínimo y red flags a evitar."
    badge = "Fundamentos"
    badgeColor = "green"
    icon = "business"
    gradient = "from-green-400 to-emerald-400"
    heroImage = "broker-hero.jpg"
    sections = @(
      @{id="por-que-importa"; title="Por qué importa elegir bien"; content="<p>Tu broker es tu socio en trading. Un broker malo puede <strong>robarte con spreads altos, rechazar tus órdenes, o peor: no devolverte tu dinero</strong>.</p><div class='bg-red-900/20 p-4 rounded border border-red-500/20 mt-4'><p class='text-red-300 text-sm font-bold'>Señales de alerta:</p><ul class='text-slate-300 text-sm space-y-1 mt-2'><li>• No está regulado o regulación en país 'offshore'</li><li>• Promesas de ganancias garantizadas</li><li>• Bonus exagerados con condiciones imposibles</li><li>• Dificultad para retirar fondos</li></ul></div>"}
      @{id="regulacion"; title="Regulación (LO MÁS IMPORTANTE)"; content="<p class='text-slate-300 mb-4'>Opera SOLO con brokers regulados por autoridades serias:</p><div class='grid grid-cols-1 md:grid-cols-2 gap-3'><div class='bg-background-dark p-3 rounded-lg border border-emerald-700/50'><p class='text-emerald-400 font-bold text-sm'>✓ Reguladores confiables</p><ul class='text-xs text-slate-300 space-y-1 mt-2'><li>• FCA (UK)</li><li>• CySEC (Chipre)</li><li>• ASIC (Australia)</li><li>• NFA/CFTC (USA)</li><li>• BaFin (Alemania)</li></ul></div><div class='bg-background-dark p-3 rounded-lg border border-red-700/50'><p class='text-red-400 font-bold text-sm'>✗ Evita</p><ul class='text-xs text-slate-300 space-y-1 mt-2'><li>• Brokers sin regulación</li><li>• Regulación en paraísos fiscales</li><li>• 'Auto-regulados'</li></ul></div></div>"}
      @{id="costos"; title="Spreads y comisiones"; content="<div class='overflow-x-auto rounded-xl border border-slate-700 mb-4'><table class='w-full text-left text-sm'><thead class='bg-surface-dark text-slate-200'><tr><th class='px-6 py-4'>Modelo</th><th class='px-6 py-4'>Spread</th><th class='px-6 py-4'>Comisión</th></tr></thead><tbody class='divide-y divide-slate-700 bg-background-dark'><tr><td class='px-6 py-4 text-white'>Market Maker</td><td class='px-6 py-4'>Más alto (2-3 pips)</td><td class='px-6 py-4 text-emerald-400'>$0</td></tr><tr><td class='px-6 py-4 text-white'>ECN/STP</td><td class='px-6 py-4 text-emerald-400'>Muy bajo (0.1-0.5 pips)</td><td class='px-6 py-4'>$3-$7 por lote</td></tr></tbody></table></div><p class='text-slate-300 text-sm'><strong>Para scalping/day trading:</strong> ECN. <strong>Para swing:</strong> Market Maker está bien.</p>"}
      @{id="plataformas"; title="Plataformas de trading"; content="<ul class='space-y-2 text-slate-300 text-sm'><li class='flex items-start gap-2'><span class='text-primary'>•</span><span><strong>MetaTrader 4/5:</strong> Estándar de industria, muchos indicadores</span></li><li class='flex items-start gap-2'><span class='text-primary'>•</span><span><strong>cTrader:</strong> Mejor para scalping (ejecución rápida)</span></li><li class='flex items-start gap-2'><span class='text-primary'>•</span><span><strong>TradingView:</strong> Gráficos excelentes, integración con algunos brokers</span></li><li class='flex items-start gap-2'><span class='text-primary'>•</span><span><strong>Propias:</strong> Algunos brokers tienen plataformas web (verifica reviews)</span></li></ul>"}
    )
  },
  @{
    slug = "cuentas-fondeadas-prop-trading"
    title = "Cuentas Fondeadas y Prop Trading: Guía Completa 2026"
    description = "Prop trading y cuentas fondeadas: qué son, cómo funcionan, requisitos, costos, profit split y si conviene."
    badge = "Fundamentos"
    badgeColor = "yellow"
    icon = "account_balance"
    gradient = "from-yellow-400 to-orange-400"
    heroImage = "prop-trading-hero.jpg"
    sections = @(
      @{id="que-es"; title="¿Qué es prop trading?"; content="<p><strong>Prop trading</strong> (proprietary trading) es operar con <strong>capital de una empresa</strong> en vez de tu propio dinero. Si ganas, te quedas con un porcentaje (50-90%).</p><p class='text-slate-300 mt-4'><strong>Cuentas fondeadas:</strong> Empresas como FTMO, MyForexFunds, Funded Next te dan capital ($10k-$200k) después de pasar un 'challenge' (evaluación).</p>"}
      @{id="como-funciona"; title="Cómo funciona"; content="<div class='space-y-3'><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50'><div class='text-blue-400 font-bold mb-2'>1. Pagas la evaluación</div><p class='text-sm text-slate-300'>$150-$500 según tamaño de cuenta ($10k-$100k+).</p></div><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50'><div class='text-purple-400 font-bold mb-2'>2. Challenge (Fase 1 y 2)</div><p class='text-sm text-slate-300'>Debes alcanzar objetivo de profit (ej: 10% fase 1, 5% fase 2) sin romper reglas (max drawdown -10%, max loss diario -5%).</p></div><div class='bg-background-dark p-4 rounded-lg border border-slate-700/50'><div class='text-emerald-400 font-bold mb-2'>3. Cuenta fondeada</div><p class='text-sm text-slate-300'>Si pasas, operas cuenta real. Te quedas con 70-90% de ganancias, retiros cada 14-30 días.</p></div></div>"}
      @{id="pros-contras"; title="Ventajas y desventajas"; content="<h3 class='text-lg font-bold text-emerald-400 mb-2'>✓ Pros</h3><ul class='text-sm text-slate-300 space-y-1 mb-4'><li>• No arriesgas tu capital (solo el fee de evaluación)</li><li>• Operas cuentas grandes ($50k-$200k)</li><li>• Buenos profit splits (80-90%)</li></ul><h3 class='text-lg font-bold text-red-400 mb-2'>✗ Contras</h3><ul class='text-sm text-slate-300 space-y-1'><li>• Reglas estrictas (drawdown -10%, pérdida diaria -5%)</li><li>• Pagas fees ($150-$500 por intento)</li><li>• Tasa de aprobación ~10-20% (difícil pasar)</li><li>• Algunas empresas son scam (investiga bien)</li></ul>"}
      @{id="empresas"; title="Empresas recomendadas"; content="<div class='grid grid-cols-1 md:grid-cols-2 gap-3'><div class='bg-background-dark p-4 rounded-lg border border-emerald-700/50'><div class='text-emerald-400 font-bold mb-2'>FTMO</div><p class='text-sm text-slate-300'>La más conocida. Strict rules pero paga consistentemente.</p></div><div class='bg-background-dark p-4 rounded-lg border border-blue-700/50'><div class='text-blue-400 font-bold mb-2'>The5%ers</div><p class='text-sm text-slate-300'>Más flexible, profit split hasta 100% después de tiempo.</p></div><div class='bg-background-dark p-4 rounded-lg border border-purple-700/50'><div class='text-purple-400 font-bold mb-2'>Funded Next</div><p class='text-sm text-slate-300'>Rápido scaling, reglas moderadas.</p></div><div class='bg-background-dark p-4 rounded-lg border border-orange-700/50'><div class='text-orange-400 font-bold mb-2'>E8 Funding</div><p class='text-sm text-slate-300'>Swing traders friendly (no límite de holding time).</p></div></div>"}
    )
  },
  @{
    slug = "journal-de-trading"
    title = "Journal de Trading: Cómo Registrar y Mejorar tus Operaciones"
    description = "Trading journal: por qué es crítico, qué registrar, cómo analizar datos y mejorar consistentemente tu trading."
    badge = "Fundamentos"
    badgeColor = "pink"
    icon = "book"
    gradient = "from-pink-400 to-rose-400"
    heroImage = "journal-trading-hero.jpg"
    sections = @(
      @{id="por-que"; title="Por qué necesitas un journal"; content="<p>Un <strong>trading journal</strong> es donde registras CADA trade con detalles: setup, emoción, razón de entrada, resultado.</p><div class='bg-purple-900/20 p-4 rounded border border-purple-400/20 mt-4'><p class='text-purple-200 font-bold mb-2'>Sin journal:</p><ul class='text-slate-300 text-sm space-y-1'><li>• No sabes qué funciona y qué no</li><li>• Repites los mismos errores</li><li>• No puedes mejorar consistentemente</li></ul></div><p class='text-slate-300 mt-4'>Traders profesionales <strong>todos</strong> tienen journal. No es opcional.</p>"}
      @{id="que-registrar"; title="Qué registrar"; content="<div class='grid grid-cols-1 md:grid-cols-2 gap-4'><div class='bg-background-dark p-4 rounded-lg border border-emerald-700/50'><div class='text-emerald-400 font-bold mb-2'>📊 Datos técnicos</div><ul class='text-sm text-slate-300 space-y-1'><li>• Fecha y hora</li><li>• Activo (EUR/USD, AAPL, etc.)</li><li>• Dirección (Long/Short)</li><li>• Entrada, Stop, Target</li><li>• R:R ratio</li><li>• Resultado ($, %)</li></ul></div><div class='bg-background-dark p-4 rounded-lg border border-purple-700/50'><div class='text-purple-400 font-bold mb-2'>🧠 Datos psicológicos</div><ul class='text-sm text-slate-300 space-y-1'><li>• Razón de entrada (setup A, B, FOMO)</li><li>• Emoción ANTES (confiado, nervioso)</li><li>• Emoción DURANTE (ansiedad, calma)</li><li>• Emoción DESPUÉS (euforia, rabia)</li><li>• ¿Seguí mi plan? (Sí/No)</li></ul></div></div>"}
      @{id="herramientas"; title="Herramientas para journal"; content="<ul class='space-y-2 text-slate-300 text-sm'><li class='flex items-start gap-2'><span class='text-primary'>•</span><span><strong>Excel/Google Sheets:</strong> Gratis, customizable, fácil análisis</span></li><li class='flex items-start gap-2'><span class='text-primary'>•</span><span><strong>Edgewonk:</strong> Software paid ($79/año) con análisis avanzado</span></li><li class='flex items-start gap-2'><span class='text-primary'>•</span><span><strong>Tradervue:</strong> Web app con gráficos integrados</span></li><li class='flex items-start gap-2'><span class='text-primary'>•</span><span><strong>Notion:</strong> Flexible, puedes agregar screenshots</span></li></ul><div class='mt-4 p-4 bg-emerald-900/20 rounded border border-emerald-400/20 text-slate-200 text-sm'><strong>Recomendación CDL:</strong> Empieza con Google Sheets simple. Después migra a paid tools si necesitas.</div>"}
      @{id="analisis"; title="Cómo analizar tu journal"; content="<p class='text-slate-300 mb-4'>Cada semana/mes, revisa:</p><div class='space-y-2'><div class='bg-background-dark p-3 rounded-lg border border-slate-700/50'><p class='text-sm text-slate-300'><strong>Winrate:</strong> ¿Cuántos % de trades ganas? (No es lo más importante)</p></div><div class='bg-background-dark p-3 rounded-lg border border-slate-700/50'><p class='text-sm text-slate-300'><strong>R:R promedio:</strong> ¿Ganas más cuando aciertas de lo que pierdes cuando fallas?</p></div><div class='bg-background-dark p-3 rounded-lg border border-slate-700/50'><p class='text-sm text-slate-300'><strong>Mejor/peor setup:</strong> ¿Qué setup tiene mejor resultado?</p></div><div class='bg-background-dark p-3 rounded-lg border border-slate-700/50'><p class='text-sm text-slate-300'><strong>Patrones emocionales:</strong> ¿Pierdes más cuando sientes FOMO? ¿Operas mejor en ciertos horarios?</p></div></div>"}
    )
  },
  @{
    slug = "errores-comunes-trading"
    title = "Errores Comunes en Trading: Top 10 y Cómo Evitarlos"
    description = "Los 10 errores más comunes en trading: overtrading, revenge trading, no usar stop loss, FOMO y cómo evitarlos."
    badge = "Fundamentos"
    badgeColor = "red"
    icon = "warning"
    gradient = "from-red-400 to-pink-400"
    heroImage = "errores-trading-hero.jpg"
    sections = @(
      @{id="intro"; title="Por qué traders fallan"; content="<p>El 90% de traders pierde dinero, pero <strong>no por falta de conocimiento</strong>. Pierden por repetir los mismos errores psicológicos y de ejecución.</p><p class='text-slate-300 mt-4'>Esta guía cubre los 10 errores más devastadores y cómo evitarlos.</p>"}
      @{id="top-10"; title="Top 10 errores"; content="<div class='space-y-4'><div class='bg-background-dark p-4 rounded-lg border border-red-700/50'><h3 class='text-red-400 font-bold mb-2'>1. No usar stop loss</h3><p class='text-slate-300 text-sm'>Pensar 'lo vigilo yo' → Una mala noticia y pierdes 50%. <strong>Solución:</strong> Stop loss SIEMPRE.</p></div><div class='bg-background-dark p-4 rounded-lg border border-red-700/50'><h3 class='text-red-400 font-bold mb-2'>2. Overtrading</h3><p class='text-slate-300 text-sm'>Abrir 20 trades por día sin setup claro. <strong>Solución:</strong> Máximo 2-3 trades/día, solo tus setups A y B.</p></div><div class='bg-background-dark p-4 rounded-lg border border-red-700/50'><h3 class='text-red-400 font-bold mb-2'>3. Revenge trading</h3><p class='text-slate-300 text-sm'>Perder → inmediatamente abrir otro trade para 'recuperar'. <strong>Solución:</strong> Regla: 2 pérdidas = cierra plataforma por hoy.</p></div><div class='bg-background-dark p-4 rounded-lg border border-red-700/50'><h3 class='text-red-400 font-bold mb-2'>4. FOMO (entrar sin análisis)</h3><p class='text-slate-300 text-sm'>Ver activo subir 20% y comprar en el tope. <strong>Solución:</strong> Si perdiste el movimiento, déjalo ir. Habrá otro.</p></div><div class='bg-background-dark p-4 rounded-lg border border-red-700/50'><h3 class='text-red-400 font-bold mb-2'>5. Arriesgar demasiado por trade</h3><p class='text-slate-300 text-sm'>10-20% por operación → 3 pérdidas = cuenta muerta. <strong>Solución:</strong> Máximo 1-2% por trade.</p></div><div class='bg-background-dark p-4 rounded-lg border border-red-700/50'><h3 class='text-red-400 font-bold mb-2'>6. No tener plan de trading</h3><p class='text-slate-300 text-sm'>Operar 'por feeling'. <strong>Solución:</strong> Plan escrito con setups, gestión de riesgo, reglas.</p></div><div class='bg-background-dark p-4 rounded-lg border border-red-700/50'><h3 class='text-red-400 font-bold mb-2'>7. Mover el stop loss</h3><p class='text-slate-300 text-sm'>Trade va contra ti → mueves stop para 'dar más espacio' → pierdes el doble. <strong>Solución:</strong> Stop es sagrado, no se toca.</p></div><div class='bg-background-dark p-4 rounded-lg border border-red-700/50'><h3 class='text-red-400 font-bold mb-2'>8. Operar sin entender el activo</h3><p class='text-slate-300 text-sm'>Comprar crypto porque 'está de moda' sin entenderlo. <strong>Solución:</strong> Solo opera lo que entiendes.</p></div><div class='bg-background-dark p-4 rounded-lg border border-red-700/50'><h3 class='text-red-400 font-bold mb-2'>9. Compararse con otros</h3><p class='text-slate-300 text-sm'>Ver Instagram de traders 'ganando $10k/día' → frustrarse. <strong>Solución:</strong> Compite contigo mismo, no con fantasías de redes.</p></div><div class='bg-background-dark p-4 rounded-lg border border-red-700/50'><h3 class='text-red-400 font-bold mb-2'>10. No llevar journal</h3><p class='text-slate-300 text-sm'>Repetir errores porque no los registras. <strong>Solución:</strong> Journal obligatorio cada trade. <a href='/aprende/journal-de-trading/' class='underline hover:text-primary'>Ver guía</a></p></div></div>"}
    )
  }
)

# Generar cada página
foreach ($page in $pages) {
  $slug = $page.slug
  $dir = "c:\Users\pietr\OneDrive\Desktop\CONDINEROLIBRE\web\aprende\$slug"
  
  # Crear directorio
  if (!(Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  
  # Generar contenido HTML
  $sectionsHtml = ""
  $tocLinks = ""
  $sectionNum = 1
  
  foreach ($section in $page.sections) {
    $sectionsHtml += @"

      <section class="scroll-mt-24" id="$($section.id)">
        <h2 class="text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-3">
          <span class="flex items-center justify-center size-8 rounded bg-primary/20 text-primary text-lg font-bold">$sectionNum</span>
          $($section.title)
        </h2>
        <div class="bg-surface-dark p-6 rounded-xl border border-slate-800">
          $($section.content)
        </div>
      </section>
"@
    $tocLinks += "<a class='flex items-center gap-3 p-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors' href='#$($section.id)'><span>$sectionNum.</span> $($section.title)</a>`n"
    $sectionNum++
  }
  
  # HTML completo
  $html = @"
<!DOCTYPE html>
<html class="dark" lang="es">
<head>
  <meta charset="utf-8"/>
  <link rel="icon" href="favicon.ico" type="image/x-icon" />
  <meta name="description" content="$($page.description)" />
  <link rel="canonical" href="https://www.condinerolibre.com/aprende/$slug/" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta property="og:title" content="$($page.title)" />
  <meta property="og:description" content="$($page.description)" />
  <meta property="og:url" content="https://www.condinerolibre.com/aprende/$slug/" />
  <meta property="og:image" content="https://www.condinerolibre.com/images/$($page.heroImage)" />
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>$($page.title)</title>
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
  <style>html { scroll-behavior: smooth; }</style>
  <link rel="stylesheet" href="/shared/cdl-shell.css">
</head>
<body class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-50 font-display antialiased selection:bg-primary selection:text-white">
<main class="relative flex flex-col items-center w-full min-h-screen pt-8 pb-20">
  <div class="w-full max-w-7xl px-4 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
    <article class="lg:col-span-8 flex flex-col gap-8">
      <div class="flex flex-col gap-6 border-b border-slate-800 pb-8">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-$($page.badgeColor)-500/10 border border-$($page.badgeColor)-400/20 w-fit">
          <span class="material-symbols-outlined text-$($page.badgeColor)-300 text-sm">$($page.icon)</span>
          <span class="text-$($page.badgeColor)-200 text-xs font-bold uppercase tracking-wider">$($page.badge)</span>
        </div>
        <h1 class="text-white text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] tracking-[-0.033em]">
          <span class="text-transparent bg-clip-text bg-gradient-to-r $($page.gradient)">$($page.title)</span>
        </h1>
        <p class="text-slate-400 text-lg md:text-xl font-normal leading-relaxed max-w-3xl">
          $($page.description)
        </p>
        <figure class="relative bg-surface-dark rounded-xl border border-slate-800 overflow-hidden">
          <img src="/images/$($page.heroImage)" alt="$($page.title)" class="w-full h-auto" width="1200" height="630" loading="eager" fetchpriority="high"/>
        </figure>
      </div>
      $sectionsHtml
      <section class="scroll-mt-24" id="autor">
        <div class="bg-surface-dark/50 border border-slate-700 p-6 rounded-xl">
          <div class="flex items-start gap-4">
            <div class="size-12 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0">
              <span class="material-symbols-outlined">person</span>
            </div>
            <div>
              <h3 class="text-white font-bold text-lg">Sobre ConDineroLibre</h3>
              <p class="text-slate-300 text-sm leading-relaxed mt-2">
                Educación de trading honesta sin promesas mágicas. Proceso, disciplina y gestión de riesgo.
              </p>
            </div>
          </div>
        </div>
      </section>
    </article>
    <aside class="hidden lg:block col-span-4 relative">
      <div class="sticky top-24">
        <div class="bg-surface-dark rounded-xl border border-slate-800 p-5">
          <h4 class="text-white font-bold mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-slate-400 text-lg">list</span>
            Contenido
          </h4>
          <nav class="flex flex-col space-y-1 text-sm">
            $tocLinks
          </nav>
        </div>
      </div>
    </aside>
  </div>
</main>
<script src="/shared/cdl-shell.js"></script>
</body>
</html>
"@

  # Guardar archivo
  $html | Out-File -FilePath "$dir\index.html" -Encoding UTF8
  Write-Host "✓ Creado: $slug" -ForegroundColor Green
}

Write-Host "`n✓ Todas las páginas generadas exitosamente!" -ForegroundColor Cyan
