# Guia local rapida (Windows)

Objetivo: levantar el sitio en segundos y abrir la pagina correcta sin usar file:///.

## Primera vez

1. Abre terminal en la carpeta web.
2. Ejecuta: npm install

## Uso diario

Home principal:

npm run dev:local

Modulo home:

npm run dev:local:modhome

Portal:

npm run dev:local:portal

## Notas

- El script abre el navegador automaticamente.
- Si el puerto 8080 estaba ocupado, lo libera.
- Para detener el servidor: Ctrl + C.
- Usa siempre http://127.0.0.1:8080/... y no file:///.
