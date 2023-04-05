var firstRun = false;
var LayerGroups = [];
var legendLayer = false;
var timeRangeMax = [-86400, 0];
var timeRange = [-86400, 0];
var nodesCache = {};
var snr = [];
var rssi = [];
var viewMode = "snr";

function mapBetween(currentNum, minAllowed, maxAllowed, min, max) {
  return (maxAllowed - minAllowed) * (currentNum- min) / (max - min) + minAllowed;
}

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
  return {'id': 0, "longName": node, "shortName":"notf","macaddr":"","hwModel":"","lastSeen":-1}
}

function timeAlpha(time, rangeLow, rangeHigh) {
  const invertRangeLow = rangeLow * -1;
  const invertRangeHigh = (rangeHigh>=0?0:rangeHigh * -1);
  const currentTime = Math.floor(Date.now() / 1000);
  const diff = currentTime - time;
  if (diff <= invertRangeLow && diff >= invertRangeHigh) {
    return mapBetween(diff, 10, 100, invertRangeLow, invertRangeHigh) / 100;
  }
  return 0;
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
function drawSliderValue(values) {
  $( "#value" ).html( (values[ 0 ] * -1) + " - " + (values[ 1 ]==0?0:values[ 1 ] * -1) );
}
function drawMap(layerControl, data, nodes) {

  for (const element of data) {
    snr.push(element["snr"]);
    rssi.push(element["rssi"]);
  }

  //Calc low and highs
  var highSnr = Math.ceil(Math.max.apply(Math, snr));
  var lowSnr  = Math.floor(Math.min.apply(Math, snr));
  var highRssi = Math.ceil(Math.max.apply(Math, rssi));
  var lowRssi  = Math.floor(Math.min.apply(Math, rssi));
  var oldest = Math.floor(Date.now() / 1000);
  var current = Math.floor(Date.now() / 1000);

  //Add Elements
  let nodeList = {};
  for (const element of data) {
    if (element["lat"] && element["lon"]) {
      if (element["time"] < oldest) {
        oldest = element["time"]
        timeRangeMax[0] = (current - oldest) * -1;
      }
      const node = findNode(element['from'], nodes);
      var circle = L.circle([element["lat"], element["lon"]], {
        color: perc2color(element[viewMode],lowSnr,highSnr),
        fillColor: perc2color(element[viewMode],lowSnr,highSnr),
        fillOpacity: timeAlpha(element['time'], timeRange[0], timeRange[1]),
        opacity: timeAlpha(element['time'], timeRange[0], timeRange[1]),
        radius: 5,
        node: node,
        data: element,
        snrRange: [lowSnr,highSnr],
        rssiRange: [lowRssi, highRssi]
      })
      if (node['id'] !== 0) {
        if (nodeList[element['from']] === undefined) nodeList[element['from']] = [];
        circle.bindPopup(`Node: ${node["longName"]}<br>SNR: ${element["snr"].toFixed(2)}<br>RSSI: ${element["rssi"].toFixed(2)}<br>Time: ${new Date(element['time']*1000)}`);
        nodeList[element['from']].push(circle);
      }
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
  $('#slider').slider('option', 'min', timeRangeMax[0]);
  $('#slider').slider('option', 'values', timeRangeMax);
  drawSliderValue(timeRangeMax);
  updateTimeRange(timeRangeMax);
}

function showRSSIButton() {
  viewMode = "rssi";
  legendLayer.remove();
  let layerDone = false;
  for (var key in LayerGroups) {
    LayerGroups[key].eachLayer(function(layer) {
      if (!layerDone) legendLayer = legend(layer['options']['rssiRange'][0], layer['options']['rssiRange'][1], "RSSI")
      layerDone = true;
      layer.setStyle({
        "color": perc2color(layer['options']['data']['rssi'], layer['options']['rssiRange'][0], layer['options']['rssiRange'][1]),
        "fillColor": perc2color(layer['options']['data']['rssi'], layer['options']['rssiRange'][0], layer['options']['rssiRange'][1]),
      })
    })
  }
}

function showSNRButton() {
  viewMode = "snr";
  legendLayer.remove();
  let layerDone = false;
  for (var key in LayerGroups) {
    LayerGroups[key].eachLayer(function(layer) {
      if (!layerDone) legendLayer = legend(layer['options']['snrRange'][0], layer['options']['snrRange'][1], "SNR")
      layerDone = true;
      layer.setStyle({
        "color": perc2color(layer['options']['data']['snr'], layer['options']['snrRange'][0], layer['options']['snrRange'][1]),
        "fillColor": perc2color(layer['options']['data']['snr'], layer['options']['snrRange'][0], layer['options']['snrRange'][1]),
      })
    })
  }
}

function updateTimeRange(range) {
  for (var key in LayerGroups) {
    LayerGroups[key].eachLayer(function(layer) {
      layer.setStyle({
        "fillOpacity": timeAlpha(layer['options']['data']['time'], range[0], range[1]),
        "opacity": timeAlpha(layer['options']['data']['time'], range[0], range[1]),
      })
    })
  }
}

function updateMap() {
  snr = [];
  rssi = [];
  for (var key in LayerGroups) {
    LayerGroups[key].eachLayer(function(layer) {
      LayerGroups[key].removeLayer(layer);
    })
    layerControl.removeLayer(LayerGroups[key]);
  }
  $.ajax({
    url: "https://mesh.nurd.space/api/locations",
    dataType: 'json',
    cache: false
  }).done(function(posData){
    $.ajax({
      url: "https://mesh.nurd.space/api/nodes",
      dataType: 'json',
      cache: false
    }).done(function(nodesData){
      nodesCache = nodesData;
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

webSocket = new WebSocket("wss://mesh.nurd.space/ws");
webSocket.onmessage = (event) => {
  const element = JSON.parse(event.data)['locationUpdate'];
  if (element["lat"] && element["lon"]) {
    snr.push(element["snr"]);
    rssi.push(element["rssi"]);
    //Calc low and highs
    var highSnr = Math.ceil(Math.max.apply(Math, snr));
    var lowSnr  = Math.floor(Math.min.apply(Math, snr));
    var highRssi = Math.ceil(Math.max.apply(Math, rssi));
    var lowRssi  = Math.floor(Math.min.apply(Math, rssi));
    const node = findNode(element['from'], nodesCache);
    var circle = L.circle([element["lat"], element["lon"]], {
      color: perc2color(element[viewMode],lowSnr,highSnr),
      fillColor: perc2color(element[viewMode],lowSnr,highSnr),
      fillOpacity: timeAlpha(element['time'], timeRange[0], timeRange[1]),
      opacity: timeAlpha(element['time'], timeRange[0], timeRange[1]),
      radius: 5,
      node: node,
      data: element,
      snrRange: [lowSnr,highSnr],
      rssiRange: [lowRssi, highRssi]
    })
    if (node['id'] !== 0) {
      circle.bindPopup(`Node: ${node["longName"]}<br>SNR: ${element["snr"].toFixed(2)}<br>RSSI: ${element["rssi"].toFixed(2)}<br>Time: ${new Date(element['time']*1000)}`);
      if (LayerGroups[element['from']]) {
        LayerGroups[element['from']].addLayer(circle);
      }
    }
  }
};
webSocket.onclose = function(event) {
  if (event.wasClean) {
    console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
  } else {
    // e.g. server process killed or network down
    // event.code is usually 1006 in this case
    console.log('[close] Connection died');
  }
};

webSocket.onerror = function(error) {
  console.log(`[error]`, error);
};

$( function() {
  $( "#slider" ).slider({
    values: timeRangeMax,
    min: timeRangeMax[0],
    max: timeRangeMax[1],
    step: 60,
    range: true,
    slide: function( event, ui ) {
      drawSliderValue(ui.values);
    },
    stop: function(event, ui) {
      updateTimeRange(ui.values);
      timeRange = ui.values;
    }
  });
  drawSliderValue(timeRangeMax);
} );
