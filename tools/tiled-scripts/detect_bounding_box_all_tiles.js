/*
 * Detect Bounding Box para todos los tiles de un tileset (Tiled Scripting API, v1.10+).
 *
 * Instalación:
 *   1. En Tiled: Edit > Preferences > Plugins > asegurate que "Scripting" esté habilitado.
 *   2. Copiá este archivo a tu carpeta de extensiones de Tiled:
 *        Windows: %AppData%/Tiled/extensions/
 *      (podés abrir esa carpeta desde Edit > Preferences > Plugins > botón "Open" junto a Extensions)
 *   3. Reiniciá Tiled, o Edit > Reload Extensions.
 *
 * Uso:
 *   1. Abrí el tileset (.tsx) en el Tileset Editor.
 *   2. Menú Tileset > "Detect Bounding Box (All Tiles)".
 *      - Si tenés tiles seleccionados en la grilla del tileset, aplica solo a esos.
 *      - Si no hay selección, aplica a todos los tiles del tileset.
 */

// Calcula el bounding box de los píxeles no transparentes de un tile.
// tile.image ya devuelve el Image recortado según imageRect (spritesheet)
// o el archivo individual (image collection), así que se lee en coordenadas locales 0..width/height.
function computeOpaqueBounds(tile) {
    var w = tile.width;
    var h = tile.height;

    if (w <= 0 || h <= 0)
        return null;

    var img = tile.image;
    if (!img || img.width <= 0 || img.height <= 0)
        return null;

    // Si img es el spritesheet completo del tileset (más grande que el tile),
    // hay que offsetear la lectura con imageRect.x/y.
    var offsetX = 0, offsetY = 0;
    if (img.width > w || img.height > h) {
        offsetX = tile.imageRect.x;
        offsetY = tile.imageRect.y;
    }

    var minX = w, minY = h, maxX = -1, maxY = -1;

    for (var y = 0; y < h; ++y) {
        for (var x = 0; x < w; ++x) {
            var argb = img.pixel(offsetX + x, offsetY + y);
            var alpha = (argb >>> 24) & 0xff;
            if (alpha > 0) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX < minX || maxY < minY)
        return null; // tile completamente transparente

    return { x: minX, y: minY, width: (maxX - minX + 1), height: (maxY - minY + 1) };
}

function applyBoundingBox(tile) {
    var rect = computeOpaqueBounds(tile);
    if (!rect)
        return false;

    var objectGroup = new ObjectGroup();
    var obj = new MapObject();
    obj.x = rect.x;
    obj.y = rect.y;
    obj.width = rect.width;
    obj.height = rect.height;
    objectGroup.addObject(obj);

    tile.objectGroup = objectGroup;
    return true;
}

var action = tiled.registerAction("DetectBoundingBoxAllTiles", function() {
    var asset = tiled.activeAsset;

    if (!asset || !asset.isTileset) {
        tiled.alert("Abrí un tileset en el Tileset Editor antes de correr este script.");
        return;
    }

    var tileset = asset;
    var selection = tileset.selectedTiles;
    var tiles = (selection && selection.length > 0) ? selection : tileset.tiles;

    var applied = 0;
    var skipped = 0;

    tiled.log("Procesando " + tiles.length + " tile(s)...");

    // Diagnóstico: log detallado del primer tile para ver qué está leyendo realmente.
    if (tiles.length > 0) {
        var t0 = tiles[0];
        var img0 = t0.image;
        tiled.log("DEBUG tile[0] id=" + t0.id + " w=" + t0.width + " h=" + t0.height + " imageRect=" + JSON.stringify(t0.imageRect));
        if (img0) {
            var offX = (img0.width > t0.width || img0.height > t0.height) ? t0.imageRect.x : 0;
            var offY = (img0.width > t0.width || img0.height > t0.height) ? t0.imageRect.y : 0;
            tiled.log("DEBUG image.width=" + img0.width + " image.height=" + img0.height + " offsetX=" + offX + " offsetY=" + offY);
            for (var dy = 0; dy < Math.min(3, t0.height); ++dy) {
                var row = "";
                for (var dx = 0; dx < Math.min(6, t0.width); ++dx) {
                    var p = img0.pixel(offX + dx, offY + dy);
                    row += "0x" + (p >>> 0).toString(16) + " ";
                }
                tiled.log("DEBUG row " + dy + ": " + row);
            }
        } else {
            tiled.log("DEBUG image0 es null/undefined");
        }
    }

    for (var i = 0; i < tiles.length; ++i) {
        var tile = tiles[i];
        try {
            if (applyBoundingBox(tile))
                applied++;
            else
                skipped++;
        } catch (e) {
            tiled.error("Error en tile " + tile.id + ": " + e);
            skipped++;
        }
    }

    tiled.alert("Bounding box aplicado a " + applied + " tile(s). " + skipped + " omitido(s) (transparentes o con error).");
});

action.text = "Detect Bounding Box (All Tiles)";

tiled.extendMenu("Tileset", [
    { action: "DetectBoundingBoxAllTiles", before: "TilesetProperties" },
    { separator: true }
]);
