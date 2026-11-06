# Estilos cámara

Una app para dar a una foto el look de tres cámaras de otra época. Todo el revelado ocurre en el navegador: la imagen no se envía a ningún servidor y no hace falta una cuenta.

## Cómo usarla

1. Sube una foto o tómala con la cámara.
2. Elige un estilo: **Cámara de los 70s**, **Polaroid 90s** o **Cámara digital 2000s**.
3. Pulsa **Crear estilo**.
4. Compara el antes y el después y descarga el resultado en PNG o JPEG.

En el móvil, **Tomar foto** abre la cámara trasera. Si todavía no tienes una imagen a mano, **Probar una escena** genera una naturaleza muerta para ver los tres looks.

Formatos: JPG, PNG y WEBP. Si tu teléfono guarda en HEIC y la foto no abre, exporta una copia en JPG.

## Arranque local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Para una versión de producción:

```bash
npm run build
npm start
```

Al publicarla como Cursor App, un nombre de enlace que encaja es `estilos-camara`.
