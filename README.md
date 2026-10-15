# El Sombrero Encantado — Impact Enterprises 🎃

Juego de Halloween **completamente funcional** listo para mostrar a clientes en vivo, sin formularios, sin base de datos y sin contratar servicios adicionales. Incluye la portada visual aprobada, el castillo nocturno, el sombrero original y las fotos de los cinco regalos.

## Mecánica

1. Pulsa **Iniciar el juego**.
2. Verás los cinco regalos disponibles durante un momento.
3. Los cinco sombreros cubren los regalos y se mezclan rápidamente.
4. La persona toca uno de los sombreros.
5. **En ese instante** se sortea su premio con las probabilidades configuradas y el sombrero revela la fotografía del producto.
6. Pulsa **Volver a jugar** para otra ronda.

**Importante:** los cinco productos iniciales ilustran las opciones de premios, pero no están fijados a una posición. La mezcla es visual y no afecta las probabilidades. Cada sombrero tiene las mismas posibilidades de activar el sorteo. Los porcentajes no aparecen en la pantalla del cliente; solo están configurados en el código.

## Probabilidades exactas

| Premio | Probabilidad |
|---|---:|
| Set de tazones | **5%** |
| Set de tazas de café | **5%** |
| Espumador | **20%** |
| Cuchillo Santoku | **35%** |
| Set de utensilios | **35%** |

Cada participación tiene un resultado ganador. El código usa `crypto.getRandomValues()` cuando el navegador lo permite; cada sorteo es independiente. **Las probabilidades no garantizan cantidades fijas** en grupos de 20, 40 o 100 partidas. Confirma que cuentas con premios suficientes antes de usarlo ante clientes.

## Cómo desplegar en GitHub y Vercel (sin programación)

1. En [github.com/new](https://github.com/new), crea un repositorio, por ejemplo `el-sombrero-encantado`.
2. Extrae el ZIP de este proyecto. En tu repositorio, elige **Add file → Upload files** y sube **todos** los archivos y la carpeta `assets`. Confirma con **Commit changes**. El archivo `index.html` debe quedar en la raíz, no dentro de otra carpeta adicional.
3. En [vercel.com/new](https://vercel.com/new), inicia sesión y conecta tu cuenta de GitHub (si aún no lo has hecho).
4. Importa el repositorio `el-sombrero-encantado`.
5. Si Vercel te pregunta, selecciona **Framework Preset: Other**. Deja **Root Directory** en `./` y los comandos de compilación vacíos. No necesitas variables de entorno ni backend.
6. Pulsa **Deploy**. Vercel te dará una URL pública que podrás usar en el teléfono, tablet o computadora. Los siguientes cambios que subas a la rama principal se volverán a desplegar.

## Probar en tu computadora

Abre una terminal dentro de la carpeta del proyecto:

```sh
python3 -m http.server 8080
```

Luego abre <http://localhost:8080> en tu navegador. No requiere npm ni instalar paquetes.

## Personalización

- **Cambiar probabilidades:** abre `game.js` y edita la propiedad `percentage` de cada elemento en `PRIZES`. Los cinco valores deben sumar 100.
- **Cambiar premios/fotos:** edita `name` e `image` en `PRIZES`, y reemplaza el archivo `.webp` correspondiente dentro de `assets`.
- **Cambiar el texto del juego:** abre `index.html`.
- **Cambiar animaciones y colores:** abre `styles.css`.
- **Cambiar duración de mezcla:** en `game.js`, edita el valor `9` en `step < 9` y los tiempos de `sleep`.

## Historial, sonido y privacidad

- **Ver historial de premios** muestra cuántos productos se han sorteado **en este navegador y dispositivo**. Permite exportar un CSV o borrarlo.
- Este historial se guarda en `localStorage`. Puede desaparecer si limpias el navegador o usas modo privado; no se comparte ni se sincroniza entre dispositivos.
- La música ambiental y los efectos mágicos están activados por defecto, al pulsar **Iniciar el juego**. Hay sonidos al comenzar, cubrir regalos, mezclar sombreros y revelar el premio. Puedes silenciarlo o reactivarlo con el botón **Sonido**. En iPhone y iPad debes comenzar con un toque y tener el volumen del dispositivo habilitado.
- El botón de pantalla completa funciona donde el navegador lo permita. En iPhone se puede usar **Añadir a pantalla de inicio** desde Safari.
- No se capturan nombres, teléfonos, correos ni información personal.
- La entrega de premios físicos y el control de existencias son responsabilidad de quien dirige el evento. El juego no valida inventarios y no debe utilizarse si no puedes entregar el regalo que aparece.

## Archivos incluidos

```text
index.html             Pantallas y contenido
styles.css             Diseño responsivo y animaciones
game.js                Mezcla, selección, probabilidades e historial
vercel.json            Configuración opcional de Vercel
favicon.svg            Ícono del sitio
assets/portada.webp    Imagen aprobada de campaña
assets/fondo.webp      Castillo de Halloween
assets/sombrero.webp   Sombrero recortado con transparencia
assets/*.webp          Fotos reales de los cinco premios
assets/ambiente.mp3     Música de fondo original incluida, sin dependencias externas
```

**Uso:** dinámica presencial sin formulario. La participación y la entrega de premios deben cumplir con las reglas comerciales y promocionales aplicables.
