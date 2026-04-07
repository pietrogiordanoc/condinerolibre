# 🔐 Sistema de Detección de Duplicados y Bloqueo de Usuarios

## ✅ LO QUE SE IMPLEMENTÓ

### 1. **Captura de Fingerprint e IP**
- Cada vez que un usuario se conecta al portal, se captura:
  - **Fingerprint**: Huella digital única del navegador/dispositivo
  - **IP Address**: Dirección IP del usuario
  - **Ubicación**: Ciudad y país (ipapi.co)

### 2. **Visualización en Admin**
- Nueva columna "IP / Fingerprint" en la tabla de usuarios
- **Alertas visuales**:
  - IP duplicada: fondo naranja ⚠️ + contador
  - Fingerprint duplicado: fondo rojo ⚠️ + contador
  
### 3. **Sistema de Bloqueo Manual**
- Botón "🚫 Bloquear" por cada usuario
- Usuario bloqueado:
  - No puede acceder al portal (mensaje de cuenta suspendida)
  - Aparece marcado en el admin con fondo rojo y emoji 🚫
  - Botón cambia a "✓ Desbloq" para reactivar

### 4. **Auditoría**
- Todas las acciones de bloqueo/desbloqueo se registran en `audit_events`

---

## 📋 PASOS FINALES PARA ACTIVAR

### PASO 1: SQL ya ejecutado ✅
```sql
-- Ya ejecutaste esto en Supabase
ALTER TABLE user_presence ADD COLUMN fingerprint TEXT, ip_address TEXT;
ALTER TABLE profiles ADD COLUMN blocked BOOLEAN DEFAULT FALSE;
```

### PASO 2: Desplegar Portal a Netlify
1. Ve a la carpeta: `modulo portal`
2. **Ctrl + A** (seleccionar todo)
3. Arrastra a Netlify
4. Espera que publique

### PASO 3: Desplegar Admin (si es separado)
1. Ve a la carpeta: `modulo admin`
2. **Ctrl + A** (seleccionar todo)
3. Arrastra a Netlify del admin
4. Espera que publique

### PASO 4: Probar
1. Abre el portal en producción
2. Inicia sesión con una cuenta de prueba
3. Abre consola (F12) y verifica:
   - `📍 Ubicación: [ciudad], [país] | IP: [tu ip]`
   - `🔍 Fingerprint: fp_xxxxx`
4. Abre el admin y verifica que aparezcan los datos

---

## 🎯 CÓMO USAR EL SISTEMA

### Identificar Usuarios Sospechosos

**Indicadores de tramposo:**
- ⚠️ Misma IP + mismo fingerprint = **99% seguro**
- ⚠️ Mismo fingerprint, IP diferente = **90% seguro** (mismo PC, cambia WiFi)
- ⚠️ Misma IP, fingerprint diferente = **50% sospechoso** (puede ser familia)

**Ejemplo:**
```
Usuario1: FREE | IP: 85.12.45.67 ⚠️(3) | FP: fp_abc123 ⚠️(3)
Usuario2: FREE | IP: 85.12.45.67 ⚠️(3) | FP: fp_abc123 ⚠️(3)
Usuario3: FREE | IP: 85.12.45.67 ⚠️(3) | FP: fp_abc123 ⚠️(3)
→ SEGURO: 1 persona con 3 cuentas falsas
```

### Bloquear Usuario

1. Click en botón **🚫 Bloquear**
2. Confirmar acción
3. El usuario:
   - No podrá entrar al portal
   - Verá mensaje: "Cuenta Suspendida"
   - Deberá contactar soporte

### Desbloquear Usuario

1. Click en botón **✓ Desbloq**
2. Confirmar acción
3. Usuario puede volver a acceder normalmente

---

## 📊 EJEMPLO VISUAL EN ADMIN

```
┌──────────────┬──────┬───────────────┬────────────────┬────────┬─────────┐
│ USUARIO      │ PLAN │ UBICACIÓN     │ IP/FINGERPRINT │ ESTADO │ ACCIÓN  │
├──────────────┼──────┼───────────────┼────────────────┼────────┼─────────┤
│ Carlos 🚫    │ FREE │ Madrid, Spain │ 85.12.45 ⚠️(3) │ ONLINE │ Desbloq │
│              │      │               │ fp_abc12 ⚠️(3) │        │         │
├──────────────┼──────┼───────────────┼────────────────┼────────┼─────────┤
│ Pedro Legit  │ PAID │ Barce, Spain  │ 78.99.11       │ ONLINE │ Bloquear│
│              │      │               │ fp_xyz78       │        │         │
└──────────────┴──────┴───────────────┴────────────────┴────────┴─────────┘
```

---

## 🔧 MANTENIMIENTO

### Ver usuarios bloqueados
Ejecuta en Supabase:
```sql
SELECT email, blocked 
FROM profiles 
WHERE blocked = true;
```

### Limpiar fingerprints antiguos (cada 6 meses)
```sql
-- Opcional: limpiar fingerprints de usuarios inactivos
UPDATE user_presence 
SET fingerprint = NULL, ip_address = NULL
WHERE last_seen < NOW() - INTERVAL '6 months';
```

---

## ⚠️ LIMITACIONES

### Fingerprint se puede evadir con:
- Modo incógnito + VPN
- Borrar TODO el navegador
- Usar otro navegador o dispositivo

### IP se comparte entre:
- Familias en la misma casa
- Compañeros de piso
- Oficinas/universidades

**Por eso la decisión final es TUYA** 👍

---

## 🚀 PRÓXIMAS MEJORAS (OPCIONALES)

1. **Panel de estadísticas**:
   - Gráfico de IPs más usadas
   - Top 10 fingerprints sospechosos

2. **Bloqueo automático**:
   - Si 5+ cuentas FREE con mismo fingerprint → auto-bloquear

3. **Whitelist de IPs**:
   - Marcar IPs confiables (oficinas, universidades)

---

**¿Alguna duda? El sistema ya está listo para usar** 🎉
