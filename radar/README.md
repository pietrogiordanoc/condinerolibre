<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1blSCulp61a3dgemc1WE351H9TlXYRiB2

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Horarios de mercado

Los eventos fundamentales se convierten desde su zona de origen y se muestran en
la zona horaria local del dispositivo. Las sesiones del radar usan las zonas
oficiales de Tokio, Londres y Nueva York, por lo que sus contadores ajustan
automáticamente los cambios de horario de verano. La franja de sesiones también
muestra la ciudad, el desfase GMT y la hora local, junto con la próxima apertura
o cierre y el tiempo que falta o queda en esa misma hora. Debajo de cada sesión
se indica si está cerrada (su próxima apertura y el tiempo que falta) o abierta
(el tiempo transcurrido, el cierre y el tiempo restante).
La línea temporal inferior representa esas sesiones y marca la hora local actual.
