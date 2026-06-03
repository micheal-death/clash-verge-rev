<h1 align="center">
  <img src="../src-tauri/icons/icon.png" alt="Clash" width="128" />
  <br>
  Continuación de <a href="https://github.com/zzzgydi/clash-verge">Clash Verge</a>
  <br>
</h1>

<h3 align="center">
Una interfaz gráfica para Clash Meta construida con <a href="https://github.com/tauri-apps/tauri">Tauri</a>.
</h3>

<p align="center">
  Idiomas:
  <a href="../README.md">简体中文</a> ·
  <a href="./README_en.md">English</a> ·
  <a href="./README_es.md">Español</a> ·
  <a href="./README_ru.md">Русский</a> ·
  <a href="./README_ja.md">日本語</a> ·
  <a href="./README_ko.md">한국어</a> ·
  <a href="./README_fa.md">فارسی</a>
</p>

## Vista previa

| Oscuro                              | Claro                               |
| ----------------------------------- | ----------------------------------- |
| ![Vista oscura](./preview_dark.png) | ![Vista clara](./preview_light.png) |

## Instalación

Visita [Custom AutoBuild](https://github.com/micheal-death/clash-verge-rev/releases/tag/custom-autobuild) para descargar la compilación personal de este fork.<br>
Actualmente solo se publican instaladores para Windows x64 y macOS Apple Silicon.

#### Cómo elegir el canal de lanzamiento

| Canal            | Descripción                                      | Enlace                                                                                               |
| :--------------- | :----------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| Custom AutoBuild | Compilación continua personal con cambios del fork. | [Custom AutoBuild](https://github.com/micheal-death/clash-verge-rev/releases/tag/custom-autobuild) |

#### Guías de instalación y preguntas frecuentes

Consulta el [README](https://github.com/micheal-death/clash-verge-rev#readme) de este repositorio para instalación, solución de problemas y preguntas frecuentes.


---

## Funciones

- Basado en Rust de alto rendimiento y en el framework Tauri 2
- Incluye el núcleo integrado [Clash.Meta (mihomo)](https://github.com/MetaCubeX/mihomo) y permite cambiar al canal `Alpha`
- Interfaz limpia y elegante con controles de color de tema, iconos de grupos proxy/bandeja y `CSS Injection`
- Gestión avanzada de perfiles (herramientas Merge y Script) con sugerencias de sintaxis para configuraciones
- Control del proxy del sistema, modo guardián y soporte para `TUN` (adaptador de red virtual)
- Editores visuales para nodos y reglas
- Copias de seguridad y sincronización mediante WebDAV

### Preguntas frecuentes

Consulta el [README](https://github.com/micheal-death/clash-verge-rev#readme) de este repositorio para obtener instrucciones específicas.


## Desarrollo

Consulta [CONTRIBUTING.md](../CONTRIBUTING.md) para conocer las pautas de contribución.

Después de instalar todos los requisitos de **Tauri**, ejecuta el entorno de desarrollo con:

```shell
pnpm i
pnpm run prebuild
pnpm dev
```

## Contribuciones

Se agradecen los issues y pull requests.

## Agradecimientos

Clash Verge Rev se basa en, o se inspira en, los siguientes proyectos:

- [zzzgydi/clash-verge](https://github.com/zzzgydi/clash-verge): Interfaz gráfica para Clash basada en Tauri. Compatible con Windows, macOS y Linux.
- [tauri-apps/tauri](https://github.com/tauri-apps/tauri): Construye aplicaciones de escritorio más pequeñas, rápidas y seguras con un frontend web.
- [Dreamacro/clash](https://github.com/Dreamacro/clash): Túnel basado en reglas escrito en Go.
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo): Túnel basado en reglas escrito en Go.
- [Fndroid/clash_for_windows_pkg](https://github.com/Fndroid/clash_for_windows_pkg): Interfaz de Clash para Windows y macOS.
- [vitejs/vite](https://github.com/vitejs/vite): Herramientas de frontend de nueva generación con una experiencia rapidísima.

## Licencia

Licencia GPL-3.0. Consulta el [archivo de licencia](../LICENSE) para más detalles.
