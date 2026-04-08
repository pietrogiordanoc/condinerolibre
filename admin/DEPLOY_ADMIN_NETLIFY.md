# 🚨 INSTRUCCIONES DE DEPLOY - ADMIN PANEL

## ⚠️ PROBLEMA ACTUAL
El admin da 404 porque la estructura de carpetas en Netlify no es correcta.

## ✅ SOLUCIÓN PASO A PASO

### 1. Preparar archivos ANTES de deployar

**En esta carpeta:**
`C:\Users\pietr\OneDrive\Desktop\CONDINEROLIBRE\web\modulo admin`

**DEBE haber estos archivos/carpetas:**
```
modulo admin/
  ├── _redirects          ← ✅ NUEVO (ya creado)
  ├── favicon.ico
  ├── cdl-admin/
  │   ├── index.html
  │   ├── reset-password.html
  │   └── auth/
  └── dashboard/
      ├── index.html
      ├── admin-ui.css
      ├── admin-core.js
      ├── config.js
      ├── module-history.js
      ├── module-notes.js
      ├── module-presence.js
      └── module-users.js
```

### 2. Deploy a Netlify

**OPCIÓN A - Drag & Drop (Recomendado):**

1. Abre `modulo admin` en el Explorador de Windows
2. **Ctrl + A** para seleccionar TODO (incluido el nuevo `_redirects`)
3. Arrastra TODO a Netlify (admin site)
4. Espera 1-2 minutos

**OPCIÓN B - Netlify CLI:**
```powershell
cd "C:\Users\pietr\OneDrive\Desktop\CONDINEROLIBRE\web\modulo admin"
netlify deploy --prod --dir .
```

### 3. Verificar en Netlify

Después del deploy, en el sitio de Netlify debes ver:

```
/ (raíz)
  ├── _redirects
  ├── favicon.ico
  ├── cdl-admin/
  └── dashboard/
```

**NO debe quedar:**
```
/ (raíz)
  └── modulo admin/    ← ❌ INCORRECTO
      ├── cdl-admin/
      └── dashboard/
```

### 4. Prueba

Después del deploy:
- Ir a: `https://admin.condinerolibre.com/dashboard/`
- Debe cargar el dashboard (no 404)
- Login debe funcionar

---

## 🔧 Si sigue dando 404

1. Ve a Netlify → Site configuration → Deploy → **Deploy contexts**
2. Asegúrate que "Publish directory" esté en: `.` (punto, significa raíz)
3. Si dice otra cosa (como `modulo admin`), cámbialo a `.`
4. Redeploy

## 📝 Archivos críticos

- `_redirects`: Configuración de rutas (NUEVO - ya lo creé)
- `dashboard/index.html`: Panel principal
- `cdl-admin/index.html`: Página de login

## ⚡ Comando rápido de verificación

Después del deploy, abre consola del navegador en `admin.condinerolibre.com/dashboard/` y ejecuta:
```javascript
fetch('/dashboard/index.html').then(r => console.log('Status:', r.status))
```
Debe decir: `Status: 200` (no 404)
