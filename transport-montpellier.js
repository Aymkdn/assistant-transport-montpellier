var request = require('request-promise-native');
var AssistantTransportMontpellier = function() {}
AssistantTransportMontpellier.prototype.init = function(plugins) {
  this.plugins = plugins;
  return Promise.resolve(this);
};

/**
 * Fonction appelée par le système central
 *
 * @param {String} commande Un JSON {'delay':X, 'arrivalCitywayId':X, 'directionForTam':X, 'lineCitywayId':X, 'lineId':X, 'lineUrban':X, 'stopCitywayId':X, 'stopId':X}
 */
AssistantTransportMontpellier.prototype.action = function(commande) {
  var _this=this;
  commande = '"'+commande.replace(/'/g,'\\"').replace(/, /g,",")+'"';
  commande = JSON.parse(commande);
  if (typeof commande==="string") commande = JSON.parse(commande);
  var json = {
    "stopList":[
      {
        "sens":(commande.directionForTam==="BACKWARD"?2:1),
        "directions":[commande.arrivalCitywayId*1],
        "urbanLine":commande.lineUrban*1,
        "citywayLineId":commande.lineCitywayId*1,
        "lineNumber":""+commande.lineId,
        "citywayStopId":commande.stopCitywayId*1,
        "tamStopId":commande.stopId*1
      }
    ]
  };
  var type = (commande.lineId <= 5 ? "tram" : "bus");
  console.log("[assistant-transport-montpellier] Recherche des prochains "+type+" pour la ligne "+commande.lineId);
  return request({
    'url' : 'https://apimobile.tam-voyages.com/api/v1/hours/next/stops',
    'method':'POST',
    'headers':{
      "appPlateforme": "Android",
      "appVersion": "1.2",
      "Content-Type": "application/json; charset=UTF-8",
      "Host": "apimobile.tam-voyages.com",
      "User-Agent": "okhttp/2.4.0"
    },
    'body': JSON.stringify(json)
  })
  .then(function(response){
    var body, data;
    if (response) {
      body = JSON.parse(response);
      data = body[0].stop_next_time;
      var idx = 0;
      if (data[idx].waiting_time.replace(/min/,"") < commande.delay) idx++;
      var speak = "le prochain "+type+" est dans " + data[idx++].waiting_time + "utes";
      if (data.length > idx) speak += ", le suivant dans " + data[idx++].waiting_time + "utes";
      if (data.length > idx) speak += ", et celui d'après dans " + data[idx++].waiting_time + "utes";
      if (_this.plugins.notifier) _this.plugins.notifier.action(speak)
      console.log("[assistant-transport-montpellier] "+speak);
    } else {
      console.log("[assistant-transport-montpellier] Aucun "+type+" trouvé...");
      if (_this.plugins.notifier) _this.plugins.notifier.action("Je ne trouve aucun "+type+"...");
    }
  })
  .catch(function(err) {
    console.log("[assistant-transport-montpellier] Erreur => ",err)
  })
};

/**
 * Initialisation du plugin
 *
 * @param  {Object} plugins Un objet qui contient tous les plugins chargés
 * @return {Promise} resolve(this)
 */
exports.init=function(configuration, plugins) {
  return new AssistantTransportMontpellier().init(plugins)
  .then(function(resource) {
    console.log("[assistant-transport-montpellier] Plugin chargé et prêt.");
    return resource;
  })
}

/**
 * les données sont téléchargées de https://apimobile.tam-voyages.com/databases/android/referential_android.zip et https://apimobile.tam-voyages.com/databases/android/referential_android_2.zip
 */
