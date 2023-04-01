var firstRun = false;
var LayerGroups = [];
var legendLayer = false;

function perc2color(perc,min,max) {
  var base = (max - min);

  if (base == 0) { perc = 100; }
  else {
    perc = (perc - min) / base * 100; 
  }
  var r, g, b = 0;
  if (perc < 50) {
    r = 255;
    g = Math.round(5.1 * perc);
  }
  else {
    g = 255;
    r = Math.round(510 - 5.10 * perc);
  }
  var h = r * 0x10000 + g * 0x100 + b * 0x1;
  return '#' + ('000000' + h.toString(16)).slice(-6);
}

function findNode(node, nodes) {
  for (const nd of nodes) {
    if (nd['id'] === node) return nd;
  }
  return {'id': node, "longName": node, "shortName":"notf","macaddr":"","hwModel":"","lastSeen":-1}
}

function legend(low,high,name){
  //Set legend
  var legend = L.control({position: 'bottomright'});
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'info legend');
    const grades = [];
    const diffSnr = (high - low) / 8;
    grades.push(Math.round(low));
    for (var i = 1; i < 8 ; i++) {
      grades.push(Math.round(low + (i * diffSnr)));
    }
    const labels = [];
    let from, to;
    labels.push("<h3>" + name + "</h3>");
    for (let i = 0; i < grades.length; i++) {
      from = grades[i];
      to = Math.round(grades[i] + diffSnr);
      labels.push(`<i style="background:${perc2color(from,low,high)}"></i> ${from}&nbsp;&lt;&ndash;&gt;&nbsp;${to}<br><br>`);
    }
    div.innerHTML = labels.join('');
    return div;
  };
  legend.addTo(map);
  return legend;
}

function drawMap(layerControl, data, nodes) {
  var snr = [];
  var rssi = [];

  for (const element of data) {
    snr.push(element["snr"]);
    rssi.push(element["rssi"]);
  }

  //Calc low and highs
  var highSnr = Math.ceil(Math.max.apply(Math, snr));
  var lowSnr  = Math.floor(Math.min.apply(Math, snr));
  var highRssi = Math.ceil(Math.max.apply(Math, rssi));
  var lowRssi  = Math.floor(Math.min.apply(Math, rssi));

  //Add Elements
  let nodeList = {};
  for (const element of data) {
    if (element["lat"] && element["lon"]) {
      const node = findNode(element['from'], nodes);
      var circle = L.circle([element["lat"], element["lon"]], {
        color: perc2color(element["snr"],lowSnr,highSnr),
        fillColor: perc2color(element["snr"],lowSnr,highSnr),
        fillOpacity: 0.5,
        radius: 5,
        node: node,
        data: element,
        snrRange: [lowSnr,highSnr],
        rssiRange: [lowRssi, highRssi]
      })
      if (nodeList[element['from']] === undefined) nodeList[element['from']] = [];
      circle.bindPopup(`Node: ${node["longName"]}<br>SNR: ${element["snr"]}<br>RSSI: ${element["rssi"]}`);
      nodeList[element['from']].push(circle);
      //circle.addTo(map);
    }
  }

  for (var key in nodeList) {
    LayerGroups[key] = L.layerGroup(nodeList[key]);
    map.addLayer(LayerGroups[key]);
    layerControl.addOverlay(LayerGroups[key], findNode(key, nodes)['longName']);
    layerControl._update();
  }
  if (legendLayer)
    legendLayer.remove();
  legendLayer = legend(lowSnr, highSnr, "SNR");
}

function showRSSIButton() {
  legendLayer.remove();
  let layerDone = false;
  for (var key in LayerGroups) {
    LayerGroups[key].eachLayer(function(layer) {
      if (!layerDone) legendLayer = legend(layer['options']['rssiRange'][0], layer['options']['rssiRange'][1], "RSSI")
      layerDone = true;
      layer.setStyle({
        "color": perc2color(layer['options']['data']['rssi'], layer['options']['rssiRange'][0], layer['options']['rssiRange'][1]),
        "fill": perc2color(layer['options']['data']['rssi'], layer['options']['rssiRange'][0], layer['options']['rssiRange'][1]),
      })
    })
  }
}

function showSNRButton() {
  legendLayer.remove();
  let layerDone = false;
  for (var key in LayerGroups) {
    LayerGroups[key].eachLayer(function(layer) {
      if (!layerDone) legendLayer = legend(layer['options']['snrRange'][0], layer['options']['snrRange'][1], "SNR")
      layerDone = true;
      layer.setStyle({
        "color": perc2color(layer['options']['data']['snr'], layer['options']['snrRange'][0], layer['options']['snrRange'][1]),
        "fill": perc2color(layer['options']['data']['snr'], layer['options']['snrRange'][0], layer['options']['snrRange'][1]),
      })
    })
  }
}

function updateMap() {
  for (var key in LayerGroups) {
    LayerGroups[key].eachLayer(function(layer) {
      LayerGroups[key].removeLayer(layer);
    })
    layerControl.removeLayer(LayerGroups[key]);
  }
  $.ajax({
    url: "https://portal.nurdspace.nl/sdr/api/locations",
    dataType: 'json',
    cache: false
  }).done(function(posData){
    $.ajax({
      url: "https://portal.nurdspace.nl/sdr/api/nodes",
      dataType: 'json',
      cache: false
    }).done(function(nodesData){
      drawMap(layerControl, posData,nodesData);
      firstRun = true;
    });
  });
}


const dark = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png');
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19});
var map = L.map('map', {center: L.latLng(51.9733648, 5.669929), zoom: 15, layers: [osm, dark]});
const baseLayers = {
  'OpenStreetMap': osm,
  'Dark': dark,
};
const layerControl = L.control.layers(baseLayers, {}).addTo(map);


updateMap();

webSocket = new WebSocket("wss://portal.nurdspace.nl/ws", "dingen");
webSocket.onmessage = (event) => {
  console.log(event.data);
};
