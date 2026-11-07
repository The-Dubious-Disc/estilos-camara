# Retro Pic

Una app para dar a una foto el look de tres cámaras de otra época. Todo el revelado ocurre en el navegador: la imagen no se envía a ningún servidor y no hace falta una cuenta.

## Cómo usarla

1. Pulsa **Elegir foto**. Un solo selector abre lo que ofrezca el navegador o el sistema: cámara, galería o archivos. No en todos los dispositivos aparecen las dos.
2. El estilo se ve al momento. **70s**, **Polaroid** y **2000s** están debajo de la foto; al cambiar, la vista se actualiza sola.
3. El botón de descargar guarda un JPEG. Polaroid y 2000s llevan la fecha de hoy.

Formatos habituales: JPG, PNG y WEBP. Si el teléfono guarda en HEIC y la foto no abre, exporta una copia en JPG.

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
