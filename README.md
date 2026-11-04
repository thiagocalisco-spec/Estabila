# ESTABILA

**Gestión integral y salud geotécnica de anclajes permanentes.**

Plataforma web de una sola página (HTML, CSS y JavaScript, sin dependencias ni paso de compilación) para el monitoreo, la inspección y el control (MIC) de anclajes permanentes por tramos viales.

## Qué hace

- Evaluación general del tramo: muestra inspeccionada frente al piso del 3 % y la cuota por criticidad, salud global y mapa de riesgo de corrosión.
- Trazabilidad temporal por anclaje: T0 (tensionamiento) y épocas T1, T2… con lift-off, pérdida de tensión, estado A–D y registro fotográfico de la cabeza.
- Cuestionario de inspección visual con puntaje (pesos de Liao, 2018).
- Longitud libre aparente calculada en el navegador al cargar o ingresar datos.
- Formularios para registrar inspecciones, ensayos, anclajes y tramos sin tocar el código.
- Exportación a CSV para Excel en español (`;`, BOM UTF-8, coma decimal) y respaldo en JSON.

## Datos

- Los 54 anclajes del Talud 2 UF4A provienen de fichas reales de tensionamiento (junio de 2020).
- Las épocas T1 y T2 de nueve anclajes y todo el Sector K100 son **simulados de demostración** y están etiquetados así en la interfaz. Se retiran desde la pestaña Registrar.
- Los datos que registres se guardan en el `localStorage` del navegador de cada persona. Para conservarlos o compartirlos, descarga un respaldo JSON.

## Ejecutar en local

Abre `index.html` en el navegador, o sirve la carpeta:

```bash
npx serve .
```

## Despliegue

Es un sitio estático: Vercel lo publica sin configuración adicional (Framework Preset: *Other*, sin comando de build, directorio de salida `.`).

## Aviso

Los umbrales son criterios de gestión tomados de la bibliografía del proyecto y no reemplazan la inspección en sitio ni el criterio del ingeniero responsable.
