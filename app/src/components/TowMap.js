import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { C } from '../theme';
import { T } from '../ui';

/*
 Free map: MapLibre GL + OpenFreeMap tiles inside a WebView.
 No Google Maps key, no billing account. Swap the style URL to change providers later.

 Props
   markers:   [{ id, lat, lng, kind: 'pickup' | 'dropoff' | 'truck' | 'me' }]
   route:     [[lat, lng], [lat, lng]]  (drawn as a dashed line)
   camera:    { id, lat, lng, zoom } or { id, fit: [[lat, lng], ...] } — applied when id changes
   onCenter:  called with { lat, lng } after the user pans (for pin-drop pickers)
*/
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

const HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<style>
html,body,#m{margin:0;height:100%;width:100%;background:#EDEDED}
.mk{width:14px;height:14px;border-radius:50%;background:#141414;box-shadow:0 0 0 5px #fff,0 0 0 6px #e3e3e3}
.mk.dropoff{width:40px;height:40px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px #141414,0 4px 10px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;margin-top:-26px}
.mk.dropoff:after{content:"";position:absolute;bottom:-9px;left:50%;margin-left:-1px;width:2px;height:9px;background:#141414}
.mk.me{width:14px;height:14px;background:#141414;box-shadow:0 0 0 6px rgba(20,20,20,.12)}
.mk.truck{width:46px;height:46px;border-radius:50%;background:#F5EF3A;box-shadow:0 0 0 3px #fff,0 6px 14px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;margin-top:-30px}
.mk.truck:after{content:"";position:absolute;bottom:-11px;left:50%;margin-left:-1px;width:2px;height:10px;background:#141414}
.maplibregl-ctrl-attrib{font-size:9px}
</style></head><body><div id="m"></div><script>
function post(o){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }catch(e){} }
if(!window.maplibregl){ post({type:'error', message:'map-library'}); }
var map = new maplibregl.Map({ container:'m', style:'${STYLE_URL}', center:[7.4951,9.0579], zoom:12, attributionControl:{compact:true}, pitchWithRotate:false, dragRotate:false });
map.touchZoomRotate.disableRotation();
var ready=false, pending=null, markers={}, lastCam=null;
var TRUCK='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16h3l2-5h7l3 5h5M6 16a2 2 0 1 0 4 0M15 16a2 2 0 1 0 4 0M14 11V6l5 4"/></svg>';
var FLAG='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4M4 4h12l-2 4 2 4H4"/></svg>';
map.on('load', function(){
  map.addSource('route',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'route',type:'line',source:'route',paint:{'line-color':'#141414','line-width':2.5,'line-dasharray':[2,2]}});
  ready=true; if(pending){ apply(pending); pending=null; } post({type:'ready'});
});
map.on('error', function(e){ post({type:'error', message: String(e && e.error && e.error.message || 'map')}); });
map.on('moveend', function(e){ var c=map.getCenter(); post({type:'moveend', lat:c.lat, lng:c.lng, user: !!(e && e.originalEvent)}); });
window.update = function(s){ if(!ready){ pending=s; return; } apply(s); };
function apply(s){
  var seen={};
  (s.markers||[]).forEach(function(m){
    seen[m.id]=1;
    var mk=markers[m.id];
    if(!mk){
      var el=document.createElement('div'); el.className='mk '+(m.kind||'');
      if(m.kind==='truck') el.innerHTML=TRUCK;
      if(m.kind==='dropoff') el.innerHTML=FLAG;
      mk=new maplibregl.Marker({element:el}).setLngLat([m.lng,m.lat]).addTo(map); markers[m.id]=mk;
    } else mk.setLngLat([m.lng,m.lat]);
  });
  Object.keys(markers).forEach(function(k){ if(!seen[k]){ markers[k].remove(); delete markers[k]; } });
  var feats = s.route ? [{type:'Feature',geometry:{type:'LineString',coordinates:s.route.map(function(p){return [p[1],p[0]];})}}] : [];
  map.getSource('route').setData({type:'FeatureCollection',features:feats});
  var cam=s.camera;
  if(cam && cam.id!==lastCam){
    lastCam=cam.id;
    if(cam.fit && cam.fit.length>1){
      var b=new maplibregl.LngLatBounds();
      cam.fit.forEach(function(p){ b.extend([p[1],p[0]]); });
      map.fitBounds(b,{padding:{top:(cam.top||110),bottom:(cam.bottom||320),left:60,right:60},maxZoom:15,duration:600});
    } else if(cam.lat!=null){
      map.easeTo({center:[cam.lng,cam.lat], zoom: cam.zoom||map.getZoom(), duration:500});
    }
  }
}
</script></body></html>`;

export default function TowMap({ markers = [], route = null, camera = null, onCenter, style }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  const payload = useMemo(() => JSON.stringify({ markers, route, camera }), [markers, route, camera]);
  const latest = useRef(payload);
  latest.current = payload;

  useEffect(() => {
    ref.current?.injectJavaScript(`window.update && window.update(${payload}); true;`);
  }, [payload]);

  const onMessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.nativeEvent.data); } catch (err) { return; }
    if (msg.type === 'ready') ref.current?.injectJavaScript(`window.update(${latest.current}); true;`);
    if (msg.type === 'error' && msg.message === 'map-library') setFailed(true);
    if (msg.type === 'moveend' && onCenter) onCenter({ lat: msg.lat, lng: msg.lng, user: msg.user });
  };

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <WebView
        ref={ref}
        source={{ html: HTML, baseUrl: 'https://townaija.app/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        overScrollMode="never"
        style={{ flex: 1, backgroundColor: '#EDEDED' }}
        onError={() => setFailed(true)}
      />
      {failed ? (
        <View style={styles.fail}><T v="small" muted center>Map unavailable — check your internet connection.</T></View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fail: { position: 'absolute', top: '35%', left: 24, right: 24, backgroundColor: C.white, padding: 14, borderRadius: 22 },
});
