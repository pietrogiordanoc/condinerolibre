# 🚀 Guía Paso a Paso: Configurar Webhook de PayPal

## 📋 Índice
- [Paso 1: Preparar Base de Datos](#paso-1-preparar-base-de-datos)
- [Paso 2: Obtener Credenciales de PayPal](#paso-2-obtener-credenciales-de-paypal)
- [Paso 3: Configurar Supabase](#paso-3-configurar-supabase)
- [Paso 4: Instalar Herramientas](#paso-4-instalar-herramientas)
- [Paso 5: Desplegar Edge Function](#paso-5-desplegar-edge-function)
- [Paso 6: Crear Webhook en PayPal](#paso-6-crear-webhook-en-paypal)
- [Paso 7: Prueba Final](#paso-7-prueba-final)

---

## Paso 1: Preparar Base de Datos

### 🎯 Objetivo
Añadir columnas necesarias para guardar las suscripciones de PayPal.

### 📝 Instrucciones

1. **Abre Supabase en tu navegador:**
   - Ve a: https://supabase.com/dashboard
   - Inicia sesión con tu cuenta

2. **Selecciona tu proyecto:**
   - Click en el proyecto `yhgqmbexjscojlrzguvh`

3. **Abre el SQL Editor:**
   - En el menú lateral izquierdo, busca y haz clic en **"SQL Editor"**
   - Es un ícono que parece `</>`

4. **Crea una nueva query:**
   - Haz clic en el botón **"+ New query"** (arriba a la derecha)

5. **Copia y pega este código:**
   ```sql
   -- Añadir columnas para suscripciones
   ALTER TABLE profiles 
   ADD COLUMN IF NOT EXISTS subscription_id TEXT,
   ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';

   -- Crear índice para búsquedas rápidas
   CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id 
   ON profiles(subscription_id);

   -- Verificar que se crearon correctamente
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'profiles' 
     AND column_name IN ('subscription_id', 'subscription_status');
   ```

6. **Ejecuta la query:**
   - Haz clic en el botón **"Run"** o presiona `Ctrl + Enter`

7. **Verifica el resultado:**
   - Deberías ver una tabla con 2 filas:
     - `subscription_id | text`
     - `subscription_status | text`
   - Si ves esto, ✅ **¡Perfecto! Paso 1 completado**

---

## Paso 2: Obtener Credenciales de PayPal

### 🎯 Objetivo
Obtener el Client ID y Client Secret de tu cuenta de PayPal.

### 📝 Instrucciones

**YA TIENES EL CLIENT_ID** (de tu imagen):
```
ATeQqFo-1rpKLpkSsABudZfD5nPLEeFEX44Cq84qFkvvDHY8OohSadLVzvjXubX6sqhtwwGPVDyUJ51K
```

**Ahora necesitas obtener el CLIENT_SECRET:**

1. **Abre PayPal Developer:**
   - Ve a: https://developer.paypal.com/dashboard/applications/live
   - Inicia sesión con tu cuenta de PayPal

2. **Selecciona "Default App":**
   - En la lista de aplicaciones, haz clic en **"Default App"**
   - (Es la que aparece en tu primera imagen)

3. **Copia el Client Secret:**
   - Busca la sección que dice **"Secret"**
   - Haz clic en el botón **"Show"**
   - Aparecerá una cadena larga de texto (similar al Client ID)
   - **COPIA ESTE TEXTO** (lo necesitarás en el siguiente paso)
   - ⚠️ **IMPORTANTE:** No lo compartas con nadie

4. **Guarda ambos valores:**
   - Abre el bloc de notas (Notepad) temporalmente
   - Pega:
     ```
     Client ID: ATeQqFo-1rpKLpkSsABudZfD5nPLEeFEX44Cq84qFkvvDHY8OohSadLVzvjXubX6sqhtwwGPVDyUJ51K
     Client Secret: [el-que-copiaste]
     ```
   - Guarda este archivo temporalmente como `paypal-credentials.txt`
   - ✅ **Paso 2 completado**

---

## Paso 3: Configurar Supabase

### 🎯 Objetivo
Añadir las credenciales de PayPal como variables secretas en Supabase.

### 📝 Instrucciones

1. **Abre tu proyecto de Supabase:**
   - Ve a: https://supabase.com/dashboard/project/yhgqmbexjscojlrzguvh

2. **Ve a Settings:**
   - En el menú lateral izquierdo, haz clic en el ícono de engranaje ⚙️ **"Settings"**
   - O ve directamente a: https://supabase.com/dashboard/project/yhgqmbexjscojlrzguvh/settings/functions

3. **Abre Edge Functions:**
   - En el submenú de Settings, busca **"Edge Functions"**
   - Haz clic en **"Edge Functions"**

4. **Añade las variables:**
   - Busca la sección **"Secrets"** o **"Environment Variables"**
   - Haz clic en **"Add new secret"** o **"+ New variable"**

5. **Añade cada variable una por una:**

   **Variable 1:**
   - **Name:** `PAYPAL_CLIENT_ID`
   - **Value:** `ATeQqFo-1rpKLpkSsABudZfD5nPLEeFEX44Cq84qFkvvDHY8OohSadLVzvjXubX6sqhtwwGPVDyUJ51K`
   - Click **Save**

   **Variable 2:**
   - **Name:** `PAYPAL_CLIENT_SECRET`
   - **Value:** [pega aquí el secret que copiaste en el Paso 2]
   - Click **Save**

   **Variable 3:**
   - **Name:** `PAYPAL_MODE`
   - **Value:** `live`
   - Click **Save**

   **Variable 4 (por ahora déjala vacía, la completaremos después):**
   - **Name:** `PAYPAL_WEBHOOK_ID`
   - **Value:** `PENDIENTE`
   - Click **Save**

6. **Verifica que estén todas:**
   - Deberías ver 4 variables en la lista:
     - ✅ PAYPAL_CLIENT_ID
     - ✅ PAYPAL_CLIENT_SECRET
     - ✅ PAYPAL_MODE
     - ✅ PAYPAL_WEBHOOK_ID (con valor PENDIENTE)
   - ✅ **Paso 3 completado**

---

## Paso 4: Instalar Herramientas

### 🎯 Objetivo
Instalar Supabase CLI en tu computadora para poder desplegar el código.

### 📝 Instrucciones

1. **Abre PowerShell:**
   - Presiona la tecla `Windows` en tu teclado
   - Escribe: `PowerShell`
   - Haz clic derecho en **"Windows PowerShell"**
   - Selecciona **"Ejecutar como administrador"**
   - Click **"Sí"** si te pregunta

2. **Instala Node.js (si no lo tienes):**
   - En PowerShell, escribe:
     ```powershell
     node --version
     ```
   - Si ves un número (ej: `v18.0.0`), ya lo tienes ✅
   - Si dice "no se reconoce", descárgalo de: https://nodejs.org
   - Instala la versión LTS (recomendada)
   - Reinicia PowerShell después de instalar

3. **Instala Supabase CLI:**
   - En PowerShell, copia y pega este comando:
     ```powershell
     npm install -g supabase
     ```
   - Presiona `Enter`
   - Espera 1-2 minutos mientras instala
   - Verás muchos textos pasando, es normal

4. **Verifica la instalación:**
   - Escribe:
     ```powershell
     supabase --version
     ```
   - Deberías ver un número de versión (ej: `1.50.0`)
   - ✅ **Paso 4 completado**

---

## Paso 5: Desplegar Edge Function

### 🎯 Objetivo
Subir el código del webhook a Supabase para que pueda recibir eventos de PayPal.

### 📝 Instrucciones

1. **Mantén PowerShell abierto** (del paso anterior)

2. **Ve a la carpeta de tu proyecto:**
   ```powershell
   cd "C:\Users\pietr\OneDrive\Desktop\site portal"
   ```
   - Presiona `Enter`
   - Deberías ver que cambió la ruta en PowerShell

3. **Inicia sesión en Supabase:**
   ```powershell
   supabase login
   ```
   - Presiona `Enter`
   - Se abrirá tu navegador
   - Autoriza el acceso
   - Verás un mensaje: **"Access Token created successfully!"**
   - Vuelve a PowerShell

4. **Conecta tu proyecto:**
   ```powershell
   supabase link --project-ref yhgqmbexjscojlrzguvh
   ```
   - Presiona `Enter`
   - Te pedirá la **database password** (contraseña de tu base de datos)
   - Escribe tu contraseña (no se verá mientras escribes, es normal)
   - Presiona `Enter`
   - Deberías ver: **"Linked to project yhgqmbexjscojlrzguvh"**

5. **Despliega la función del webhook:**
   ```powershell
   supabase functions deploy paypal-webhook --no-verify-jwt
   ```
   - Presiona `Enter`
   - Verás varios mensajes de progreso
   - Al final dirá: **"Deployed Function paypal-webhook"**
   - Verás una URL como: `https://yhgqmbexjscojlrzguvh.supabase.co/functions/v1/paypal-webhook`
   - **COPIA ESTA URL** (la necesitarás en el siguiente paso)

6. **Guarda la URL:**
   - Abre el bloc de notas
   - Pega la URL completa
   - Guarda como `webhook-url.txt`
   - ✅ **Paso 5 completado**

---

## Paso 6: Crear Webhook en PayPal

### 🎯 Objetivo
Decirle a PayPal que envíe notificaciones a tu servidor cuando haya cambios en las suscripciones.

### 📝 Instrucciones

1. **Vuelve a PayPal Developer:**
   - Ve a: https://developer.paypal.com/dashboard/applications/live
   - Inicia sesión si es necesario

2. **Abre tu aplicación:**
   - Haz clic en **"Default App"**

3. **Busca la sección Webhooks:**
   - Desplázate hacia abajo hasta ver **"Webhooks"**
   - Haz clic en **"Add Webhook"** o **"Manage Webhooks"**

4. **Si ya existen webhooks:**
   - Haz clic en **"+ Add Webhook"** (botón azul arriba a la derecha)

5. **Configura el webhook:**

   **Webhook URL:**
   - Pega la URL que copiaste en el Paso 5
   - Debería ser: `https://yhgqmbexjscojlrzguvh.supabase.co/functions/v1/paypal-webhook`

   **Event types (Tipos de eventos):**
   - Busca y marca estas casillas (✅):
     - ☑️ `BILLING.SUBSCRIPTION.ACTIVATED`
     - ☑️ `BILLING.SUBSCRIPTION.CANCELLED`
     - ☑️ `BILLING.SUBSCRIPTION.SUSPENDED`
     - ☑️ `BILLING.SUBSCRIPTION.UPDATED`
     - ☑️ `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
     - ☑️ `PAYMENT.SALE.COMPLETED`

   💡 **Tip:** Usa el buscador para encontrar cada evento más rápido

6. **Guarda el webhook:**
   - Haz clic en **"Save"** o **"Create Webhook"**
   - Te redirigirá a la página de detalles del webhook

7. **Copia el Webhook ID:**
   - En la página del webhook, verás **"Webhook ID"**
   - Será algo como: `WH-XXXXX-XXXXXXXXXXXXX`
   - **COPIA ESTE ID COMPLETO**

8. **Actualiza Supabase con el Webhook ID:**
   - Ve de nuevo a: https://supabase.com/dashboard/project/yhgqmbexjscojlrzguvh/settings/functions
   - Busca la variable `PAYPAL_WEBHOOK_ID`
   - Haz clic en **"Edit"** o el ícono de lápiz
   - Reemplaza `PENDIENTE` con el ID que copiaste
   - Haz clic en **"Save"**

9. **Re-despliega la función (para que tome el nuevo ID):**
   - Vuelve a PowerShell
   - Ejecuta de nuevo:
     ```powershell
     supabase functions deploy paypal-webhook --no-verify-jwt
     ```
   - Espera a que termine
   - ✅ **Paso 6 completado**

---

## Paso 7: Prueba Final

### 🎯 Objetivo
Verificar que todo funciona correctamente.

### 📝 Instrucciones

1. **Abre tu portal:**
   - Ve a: https://portal.condinerolibre.com/cdl-portal/dashboard/

2. **Inicia sesión:**
   - Si no estás logueado, inicia sesión con tu cuenta

3. **Ve a la sección de Upgrade:**
   - En el menú lateral, haz clic en **"Desbloquear PRO"**
   - O ve directamente al hash: `#upgrade`

4. **Verifica el botón de PayPal:**
   - Deberías ver el botón azul de PayPal
   - Si no se muestra, refresca la página (F5)

5. **Prueba de suscripción (OPCIONAL - en sandbox):**
   - Si quieres probar sin gastar dinero real, configura el modo sandbox
   - Por ahora, solo verifica que el botón aparezca

6. **Monitorea los logs:**
   - En PowerShell, ejecuta:
     ```powershell
     supabase functions logs paypal-webhook --follow
     ```
   - Esto mostrará en tiempo real cuando lleguen eventos de PayPal
   - Para detenerlo, presiona `Ctrl + C`

7. **Cuando alguien se suscriba:**
   - El webhook recibirá la notificación de PayPal
   - Actualizará automáticamente el campo `plan` a `pro` en la base de datos
   - El usuario verá su plan actualizado

---

## ✅ Verificación Final

Marca cada punto cuando lo hayas completado:

- [ ] Base de datos tiene columnas `subscription_id` y `subscription_status`
- [ ] Tienes guardados Client ID y Client Secret de PayPal
- [ ] Variables configuradas en Supabase (4 variables)
- [ ] Supabase CLI instalado en tu PC
- [ ] Edge Function desplegada exitosamente
- [ ] Webhook creado en PayPal con los 6 eventos
- [ ] Webhook ID añadido a Supabase
- [ ] Función re-desplegada con el Webhook ID
- [ ] Botón de PayPal se muestra en tu portal

---

## 🆘 Solución de Problemas

### Problema: No puedo instalar Supabase CLI
**Solución:**
- Asegúrate de ejecutar PowerShell como administrador
- Verifica que Node.js esté instalado: `node --version`
- Si falla, intenta: `npm cache clean --force` y luego vuelve a instalar

### Problema: "Database password" es incorrecta
**Solución:**
- La contraseña es la que usaste al crear tu proyecto de Supabase
- Si no la recuerdas, ve a Supabase Dashboard > Settings > Database > Reset password

### Problema: El botón de PayPal no aparece
**Solución:**
- Abre la consola del navegador (F12)
- Ve a la pestaña "Console"
- Busca errores en rojo
- Verifica que el script de PayPal se cargue: mira en la pestaña "Network"

### Problema: Los webhooks no llegan
**Solución:**
- Verifica que el webhook esté activo en PayPal Dashboard
- Comprueba los logs: `supabase functions logs paypal-webhook`
- Verifica que la URL del webhook sea correcta
- Usa el simulador de webhooks de PayPal para probar

---

## 📞 ¿Necesitas Ayuda?

Si tienes algún problema en algún paso:

1. **Copia el mensaje de error** exactamente como aparece
2. **Toma una captura de pantalla** si es posible
3. **Dime en qué paso estás** (número del paso)
4. Te ayudaré a resolverlo

---

## 🎉 ¡Felicidades!

Cuando completes todos los pasos, tu sistema de pagos con PayPal estará completamente automatizado. Cada vez que un usuario se suscriba, su cuenta se actualizará automáticamente a PRO sin que tengas que hacer nada.

**Flujo automático:**
1. Usuario → Click en PayPal
2. PayPal → Procesa pago
3. PayPal → Envía webhook a tu servidor
4. Tu servidor → Actualiza el plan a PRO
5. Usuario → Ve su plan PRO inmediatamente

¡Todo automático! 🚀
