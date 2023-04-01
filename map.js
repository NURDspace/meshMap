
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

var map = L.map('map', {center: L.latLng(51.9733648, 5.669929), zoom: 15});
//L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png').addTo(map);

$.ajax({
  url: "https://portal.nurdspace.nl/sdr/api/locations",
  dataType: 'json',
  cache: false
}).done(function(data){
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
  for (const element of data) {
    var circle = L.circle([element["lat"], element["lon"]], {
      color: perc2color(element["snr"],lowSnr,highSnr),
      fillColor: perc2color(element["snr"],lowSnr,highSnr),
      fillOpacity: 0.5,
      radius: 5
    })
    circle.bindPopup(`SNR: ${element["snr"]}<br>RSSI: ${element["rssi"]}`);
    circle.addTo(map);
  }

  //Set legend
  var legend = L.control({position: 'bottomright'});
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'info legend');
    const grades = [];
    const diffSnr = (highSnr - lowSnr) / 8;
    grades.push(Math.round(lowSnr));
    for (var i = 1; i < 8 ; i++) {
      grades.push(Math.round(lowSnr + (i * diffSnr)));
    }
    const labels = [];
    let from, to;
    labels.push("<h3>SNR</h3>");
    for (let i = 0; i < grades.length; i++) {
      from = grades[i];
      to = Math.round(grades[i] + diffSnr);
      labels.push(`<i style="background:${perc2color(from,lowSnr,highSnr)}"></i> ${from}&nbsp;&lt;&ndash;&gt;&nbsp;${to}<br><br>`);
    }

    div.innerHTML = labels.join('');
    return div;
  };
  legend.addTo(map);
});
