var request = require('request-promise-native');
var AssistantTransportMontpellier = function() {}
AssistantTransportMontpellier.prototype.init = function(plugins) {
  this.plugins = plugins;
  return Promise.resolve(this);
};

/**
 * Fonction appelée par le système central
 *
 * @param {String|Array} commande Un JSON ou un array de JSON: {'delay':X, 'arrivalCitywayId':X, 'directionForTam':X, 'lineCitywayId':X, 'lineId':X, 'lineUrban':X, 'stopCitywayId':X, 'stopId':X}
 */
AssistantTransportMontpellier.prototype.action = function(commande) {
  var _this=this;
  var commandes = '"'+commande.replace(/'/g,'\\"').replace(/, /g,",")+'"';
  commandes = JSON.parse(commandes);
  if (typeof commandes==="string") commandes = JSON.parse(commandes);
  if (!Array.isArray(commandes)) commandes = [ commandes ];
  console.log("[assistant-transport-montpellier] Recherche d'horaires...");
  Promise.all(commandes.map(function(commande) {
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
      var result = [];
      if (response) {
        body = JSON.parse(response);
        data = body[0].stop_next_time;
        var idx = 0;
        console.log("[assistant-transport-montpellier] Recherche des prochains "+type+" pour la ligne "+commande.lineId+" (direction "+body[0].line_direction_name+")");
        if (data[idx].waiting_time.replace(/ min/,"")*1 < commande.delay) idx++;
        while(idx < 4 && data.length > idx) {
          if (data.length > idx) result.push({type:type, delai:data[idx++].waiting_time.replace(/(\d+).*/,"$1")});
        }
      }
      return result;
    })
  }))
  .then(function(ret) {
    var speak;
    // on veut comparer les résultats et les classer
    var result = [];
    ret.forEach(function(re) {
      re.forEach(function(r) {
        result.push(r);
      })
    });

    result.sort(function(a,b) {
      if (a.delai < b.delai) return -1;
      if (a.delai > b.delai) return 1;
      return 0;
    });

    if (result.length === 0) speak = "Aucun résultat trouvé.";
    result.forEach(function(r,i) {
      if (i === 0) speak = "le prochain "+r.type+" est dans " + r.delai + " minutes";
      if (i === 1) speak += ", le suivant dans " + r.delai + " minutes";
      if (i === 2) speak += ", et celui d'après dans " + r.delai + " minutes";
    })

    if (_this.plugins.notifier) return _this.plugins.notifier.action(speak)
    console.log("[assistant-transport-montpellier] "+speak);
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
