# Third-party notices

Jellypass includes these third-party components. Each keeps its own licence.

| Component | Where | Licence |
| --- | --- | --- |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | `src/views/vendor/maplibre*.ts` (live streams map) | BSD-3-Clause |
| [PMTiles](https://github.com/protomaps/PMTiles) | `src/views/vendor/pmtiles.ts` | BSD-3-Clause |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | `src/views/vendor/qrcode.ts` | MIT |
| Noto Sans (glyph ranges from [protomaps/basemaps-assets](https://github.com/protomaps/basemaps-assets)) | `src/views/vendor/glyphs.ts` (map labels) | SIL Open Font License 1.1 |
| [MaxMind-DB](https://github.com/maxmind/MaxMind-DB) test database | `test/fixtures/` (tests only) | Apache-2.0 / MIT |
| [Hono](https://hono.dev), [nodemailer](https://nodemailer.com), [@hono/node-server](https://github.com/honojs/node-server) | npm dependencies | MIT / MIT-0 |

Map and location data are not bundled. If you add them, attribute MaxMind (GeoLite2), OpenStreetMap contributors, Protomaps and GeoNames as shown on the Help page.
