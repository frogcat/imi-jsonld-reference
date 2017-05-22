function format(flat) {

  var map = {};
  flat.forEach(function(a) {
    map[a["@id"]] = a;
  });

  var ontology = {};

  (function(a) {
    ontology.version = a["http://www.w3.org/2002/07/owl#versionInfo"][0]["@value"];
    ontology.label = a["http://www.w3.org/2000/01/rdf-schema#label"].find(function(a) {
      return a["@language"] === "ja";
    })["@value"];
    ontology.comment = a["http://www.w3.org/2000/01/rdf-schema#comment"].find(function(a) {
      return a["@language"] === "ja";
    })["@value"];
  })(map["http://imi.go.jp/ns/core/rdf"]);

  var dig = function(id) {
    var a = map[id];
    var json = {
      id: id,
      label: a["http://www.w3.org/2000/01/rdf-schema#label"].find(function(a) {
        return a["@language"] === "ja";
      })["@value"],
      comment: a["http://www.w3.org/2000/01/rdf-schema#comment"].find(function(a) {
        return a["@language"] === "ja";
      })["@value"]
    };

    json.children = flat.filter(function(a) {
      return (a["http://www.w3.org/2000/01/rdf-schema#subClassOf"] || []).find(function(b) {
        return b["@id"] === id;
      });
    }).map(function(a) {
      return dig(a["@id"]);
    });

    json.properties = (a["http://www.w3.org/2000/01/rdf-schema#subClassOf"] || []).filter(function(b) {
      return b["@id"].indexOf("_:") === 0;
    }).map(function(b) {
      return map[b["@id"]];
    }).map(function(b) {
      var id = b["http://www.w3.org/2002/07/owl#onProperty"][0]["@id"];
      var prop = {
        id: id,
        min: 0,
        range: map[id]["http://www.w3.org/2000/01/rdf-schema#range"][0]["@id"]
      };
      if (b["http://www.w3.org/2002/07/owl#maxQualifiedCardinality"]) prop.max = 1;
      if (b["http://www.w3.org/2002/07/owl#maxCardinality"]) prop.max = 1;
      return prop;
    });

    return json;
  };

  ontology.root = dig("http://imi.go.jp/ns/core/rdf#概念型");

  return ontology;
}

var defaultInstance = {
  "http://www.w3.org/2001/XMLSchema#string": "文字列",
  "http://www.w3.org/2002/07/owl#Thing": "http://example.org/",
  "http://www.w3.org/2001/XMLSchema#integer": 1234567890,
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger": 1234567890,
  "http://www.w3.org/2001/XMLSchema#date": "2017-05-11",
  "http://www.w3.org/2001/XMLSchema#time": "00:00:00",
  "http://www.w3.org/2001/XMLSchema#dateTime": "2017-05-11T00:00:00",
  "http://www.w3.org/2001/XMLSchema#decimal": 1234.56789,
  "http://www.w3.org/2001/XMLSchema#double": 10.0e25,
  "urn:un:unece:uncefact:codelist:standard:ISO:ISO3AlphaCurrencyCode:2012-08-31#ISO3AlphaCurrencyCodeContentType": "YEN"
};

fetch("https://imi.go.jp/ns/core/rdf.jsonld").then(function(a) {
  return a.json();
}).then(function(json) {
  return new Promise(function(resolve, reject) {
    jsonld.flatten(json, function(err, flat) {
      resolve(format(flat));
    });
  });
}).then(function(ontology) {
  console.log(ontology);

  $("#version").text(ontology.version);

  var render = function(anc) {
    var a = anc[anc.length - 1];
    var div = $("<div class='clazz'/>");
    div.attr("id", a.label);

    $("#menu>ul").append($("<li/>").css("text-indent", (anc.length - 1) + "em").append(
      $("<a/>").attr("href", "#" + a.label).text(a.label)));

    var ul = $("<ul/>").appendTo(div);
    anc.forEach(function(v, i) {
      var a = $("<a/>").attr("href", "#" + v.label).text(v.label);
      if (i === anc.length - 1) a = $("<b/>").text(v.label);
      ul.append($("<li/>").append(a));
    });
    div.append($("<p/>").text(a.comment));

    var compact = function(v) {
      return v.replace(/.*#/, "");
    };

    var instance1 = {
      "@context": "http://imi.go.jp/ns/core/context.jsonld"
    };
    var instance2 = {
      "@context": "http://imi.go.jp/ns/core/context.jsonld"
    };
    anc.forEach(function(v) {
      instance1["@type"] = compact(v.id);
      instance2["@type"] = compact(v.id);
      v.properties.forEach(function(w) {
        var val = defaultInstance[w.range] || {
          "@type": compact(w.range)
        };
        instance1[compact(w.id)] = w.max === 1 ? val : [val];
        instance2[compact(w.id)] = val;
      });
    });

    div.append($("<button>配列あり</button>").attr("value", JSON.stringify(instance1, null, "  ")));
    div.append($("<button>配列なし</button>").attr("value", JSON.stringify(instance2, null, "  ")));
    div.append($("<pre contentEditable='true'/>").text(JSON.stringify(instance2, null, "  ")));
    $("#container").append(div);

    a.children.forEach(function(v) {
      render(anc.concat(v));
    });
  };

  render([ontology.root]);

  $("button").click(function() {
    $(this).parent().find("pre").text($(this).val());
  });
});
