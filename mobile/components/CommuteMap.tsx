import { useRef, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import Colors from '@/constants/colors';
import { CommuteRoute } from '@/constants/sampleRoutes';

interface CommuteMapProps {
  route: CommuteRoute;
  height?: number;
}

export default function CommuteMap({ route, height = 400 }: CommuteMapProps) {
  const webViewRef = useRef<WebView>(null);

  const html = useMemo(() => generateMapHtml(route), [route]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height }]}>
        <iframe
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 20 }}
          sandbox="allow-scripts allow-same-origin"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={() => true}
      />
    </View>
  );
}

function generateMapHtml(route: CommuteRoute): string {
  const allCoords: [number, number][] = [];
  route.segments.forEach(seg => allCoords.push(...seg.coordinates));

  const centerLat = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length;
  const centerLng = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length;

  const latMin = Math.min(...allCoords.map(c => c[0]));
  const latMax = Math.max(...allCoords.map(c => c[0]));
  const lngMin = Math.min(...allCoords.map(c => c[1]));
  const lngMax = Math.max(...allCoords.map(c => c[1]));

  const segmentsJson = JSON.stringify(route.segments);
  const overlapsJson = JSON.stringify(route.matchOverlaps);
  const startCoord = route.segments[0]?.coordinates[0] || [centerLat, centerLng];
  const lastSeg = route.segments[route.segments.length - 1];
  const endCoord = lastSeg?.coordinates[lastSeg.coordinates.length - 1] || [centerLat, centerLng];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; }
    .legend {
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 12px 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      line-height: 1.6;
      box-shadow: 0 2px 12px rgba(0,0,0,0.12);
      max-width: 180px;
    }
    .legend-title {
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 8px;
      color: #1A1A1A;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
    }
    .legend-line {
      width: 24px;
      height: 4px;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .legend-line-dotted {
      width: 24px;
      height: 0;
      border-top: 3px dotted;
      flex-shrink: 0;
    }
    .legend-text {
      color: #4B5563;
      font-size: 11px;
    }
    .marker-label {
      background: transparent;
      border: none;
      border-radius: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      white-space: nowrap;
      text-shadow:
        -1px -1px 0 rgba(255,255,255,0.9),
         1px -1px 0 rgba(255,255,255,0.9),
        -1px  1px 0 rgba(255,255,255,0.9),
         1px  1px 0 rgba(255,255,255,0.9);
    }
    .meet-point-label {
      color: #25A18E;
    }
    .split-point-label {
      color: #EF4444;
    }
    .start-marker {
      width: 32px;
      height: 32px;
      background: #25A18E;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .end-marker {
      width: 32px;
      height: 32px;
      background: ${Colors.primary};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .marker-inner {
      width: 10px;
      height: 10px;
      background: white;
      border-radius: 50%;
    }
    .meet-marker {
      width: 28px;
      height: 28px;
      background: #25A18E;
      border: 2px solid white;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .split-marker {
      width: 28px;
      height: 28px;
      background: #EF4444;
      border: 2px solid white;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .marker-icon-text {
      color: white;
      font-size: 14px;
      font-weight: bold;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 12px !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important;
    }
    .leaflet-popup-content {
      margin: 12px 16px !important;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
    }
    .popup-title {
      font-weight: 700;
      font-size: 14px;
      color: #1A1A1A;
      margin-bottom: 4px;
    }
    .popup-sub {
      font-size: 12px;
      color: #6B7280;
    }
    .popup-match {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #F0F0F0;
    }
    .popup-match-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .popup-match-name {
      font-size: 12px;
      font-weight: 600;
      color: #1A1A1A;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      var segments = ${segmentsJson};
      var overlaps = ${overlapsJson};

      var map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      var bounds = L.latLngBounds(
        L.latLng(${latMin}, ${lngMin}),
        L.latLng(${latMax}, ${lngMax})
      );
      map.fitBounds(bounds.pad(0.15));

      // Draw route segments
      segments.forEach(function(seg) {
        var latlngs = seg.coordinates.map(function(c) { return [c[0], c[1]]; });

        if (seg.type === 'walk') {
          // Walking: dotted line
          L.polyline(latlngs, {
            color: '#004E64',
            weight: 5,
            opacity: 0.7,
            dashArray: '8, 12',
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);

          // Subtle shadow
          L.polyline(latlngs, {
            color: '#004E64',
            weight: 8,
            opacity: 0.12,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);
        } else {
          // Transit: solid thick line
          // Shadow
          L.polyline(latlngs, {
            color: '#3B82F6',
            weight: 10,
            opacity: 0.15,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);

          L.polyline(latlngs, {
            color: '#3B82F6',
            weight: 6,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);

          // Small train icons along transit route
          if (latlngs.length > 2) {
            var mid = Math.floor(latlngs.length / 2);
            var transitIcon = L.divIcon({
              html: '<div style="background:#3B82F6;color:white;border-radius:12px;padding:3px 8px;font-size:10px;font-weight:700;font-family:-apple-system,sans-serif;white-space:nowrap;box-shadow:0 2px 6px rgba(59,130,246,0.3);">' + (seg.transitLine || 'Transit') + '</div>',
              className: '',
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            });
            L.marker(latlngs[mid], { icon: transitIcon, interactive: false }).addTo(map);
          }
        }
      });

      // Draw match overlaps
      var overlapColors = ['#FF6B35', '#8B5CF6', '#EC4899', '#10B981'];
      overlaps.forEach(function(overlap, idx) {
        var latlngs = overlap.coordinates.map(function(c) { return [c[0], c[1]]; });
        var color = overlapColors[idx % overlapColors.length];

        // Glow effect
        L.polyline(latlngs, {
          color: color,
          weight: 14,
          opacity: 0.15,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        // Main overlap line
        L.polyline(latlngs, {
          color: color,
          weight: 7,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        // Meet point marker
        var meetIcon = L.divIcon({
          html: '<div class="meet-marker"><span class="marker-icon-text">+</span></div>',
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker(overlap.meetPoint, { icon: meetIcon })
          .bindPopup(
            '<div class="popup-title">Meet Point</div>' +
            '<div class="popup-sub">' + overlap.meetPointName + '</div>' +
            '<div class="popup-match"><div class="popup-match-dot" style="background:' + color + '"></div><span class="popup-match-name">' + overlap.matchName + ' joins here</span></div>'
          )
          .addTo(map);

        // Meet label
        var meetLabel = L.divIcon({
          html: '<div class="marker-label meet-point-label">Meet point</div>',
          className: '',
          iconSize: [0, 0],
          iconAnchor: [-56, 4],
        });
        L.marker(overlap.meetPoint, { icon: meetLabel, interactive: false }).addTo(map);

        // Split point marker
        var splitIcon = L.divIcon({
          html: '<div class="split-marker"><span class="marker-icon-text">&times;</span></div>',
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker(overlap.splitPoint, { icon: splitIcon })
          .bindPopup(
            '<div class="popup-title">Split Point</div>' +
            '<div class="popup-sub">' + overlap.splitPointName + '</div>' +
            '<div class="popup-match"><div class="popup-match-dot" style="background:' + color + '"></div><span class="popup-match-name">' + overlap.matchName + ' leaves here</span></div>'
          )
          .addTo(map);

        // Split label
        var splitLabel = L.divIcon({
          html: '<div class="marker-label split-point-label">Split point</div>',
          className: '',
          iconSize: [0, 0],
          iconAnchor: [-52, 4],
        });
        L.marker(overlap.splitPoint, { icon: splitLabel, interactive: false }).addTo(map);
      });

      // Start marker
      var startIcon = L.divIcon({
        html: '<div class="start-marker"><div class="marker-inner"></div></div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker([${startCoord[0]}, ${startCoord[1]}], { icon: startIcon })
        .bindPopup('<div class="popup-title">Start</div><div class="popup-sub">${route.startName}</div>')
        .addTo(map);

      // End marker
      var endIcon = L.divIcon({
        html: '<div class="end-marker"><div class="marker-inner"></div></div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker([${endCoord[0]}, ${endCoord[1]}], { icon: endIcon })
        .bindPopup('<div class="popup-title">Destination</div><div class="popup-sub">${route.endName}</div>')
        .addTo(map);

      // Legend
      var legend = L.control({ position: 'bottomleft' });
      legend.onAdd = function() {
        var div = L.DomUtil.create('div', 'legend');
        var html = '<div class="legend-title">Route Legend</div>';
        html += '<div class="legend-item"><div class="legend-line-dotted" style="border-color:#004E64;"></div><span class="legend-text">Walking</span></div>';

        var hasTransit = segments.some(function(s) { return s.type === 'transit'; });
        if (hasTransit) {
          html += '<div class="legend-item"><div class="legend-line" style="background:#3B82F6;"></div><span class="legend-text">Transit</span></div>';
        }

        overlaps.forEach(function(overlap, idx) {
          var color = overlapColors[idx % overlapColors.length];
          html += '<div class="legend-item"><div class="legend-line" style="background:' + color + ';"></div><span class="legend-text">With ' + overlap.matchName.split(' ')[0] + '</span></div>';
        });

        div.innerHTML = html;
        return div;
      };
      legend.addTo(map);

      setTimeout(function() { map.invalidateSize(); }, 100);
    })();
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E8E6E1',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
