function Resource(json) {
  this.json = json;
  this.id = json["@id"];
  this.compact = this.id.replace(/.*#/, "");
  this.label = this.val("http://www.w3.org/2000/01/rdf-schema#label");
  this.comment = this.val("http://www.w3.org/2000/01/rdf-schema#comment");
  Resource.map[this.id] = this;
  Resource.list.push(this);
}
Resource.map = {};
Resource.list = [];

Resource.prototype = {
  properties: function() {
    var clazz = this.id;
    return Resource.list.filter(function(a) {
      return a.domainIncludes(clazz);
    });
  },
  cardinality: function(property) {
    var v = this.restriction().find(function(a) {
      return (a.json["http://www.w3.org/2002/07/owl#onProperty"] || []).find(function(b) {
        return b["@id"] === property;
      });
    });
    if (v && v.json["http://www.w3.org/2002/07/owl#maxQualifiedCardinality"])
      return 1;
    if (v && v.json["http://www.w3.org/2002/07/owl#maxCardinality"])
      return 1;
    return NaN;
  },
  subClassOf: function() {
    return (this.json["http://www.w3.org/2000/01/rdf-schema#subClassOf"] || []).map(function(a) {
      return Resource.map[a["@id"]];
    });
  },
  domainIncludes: function(clazz) {
    var di = this.json["http://schema.org/domainIncludes"];
    if (!di) return false;
    return !!(di.find(function(a) {
      return a["@id"] === clazz;
    }));
  },
  is: function(clazz) {
    return this.json["@type"] && this.json["@type"].find(function(a) {
      return a === clazz;
    });
  },
  parent: function() {
    return this.subClassOf().find(function(a) {
      return a.id.indexOf("http://") === 0;
    });
  },
  children: function() {
    var that = this;
    return Resource.list.filter(function(a) {
      return a.parent() === that;
    });
  },
  restriction: function() {
    return this.subClassOf().filter(function(a) {
      return a.is("http://www.w3.org/2002/07/owl#Restriction");
    });
  },
  val: function(property) {
    var v = null;
    (this.json[property] || []).forEach(function(a) {
      if (a instanceof String) v = a;
      if (a["@language"]) {
        if (a["@language"] === "ja") v = a["@value"]
      } else if (a["@value"]) v = a["@value"];
      else if (a["@id"]) v = a["@id"];
    });
    return v;
  },
  instance: function(useArray) {
    var json = this.parent() ? this.parent().instance(useArray) : {
      "@context": "http://imi.go.jp/ns/core/context.jsonld"
    };
    json["@type"] = this.compact;

    var that = this;

    this.properties().forEach(function(v) {
      var range = v.val("http://www.w3.org/2000/01/rdf-schema#range");
      var value = null;
      switch (range) {
        case "http://www.w3.org/2001/XMLSchema#string":
          value = "文字列";
          break;
        case "http://www.w3.org/2002/07/owl#Thing":
          value = "http://example.org/";
          break;
        case "http://www.w3.org/2001/XMLSchema#integer":
          value = 1234567890;
          break;
        case "http://www.w3.org/2001/XMLSchema#nonNegativeInteger":
          value = 1234567890;
          break;
        case "http://www.w3.org/2001/XMLSchema#date":
          value = "2017-05-11";
          break;
        case "http://www.w3.org/2001/XMLSchema#time":
          value = "00:00:00";
          break;
        case "http://www.w3.org/2001/XMLSchema#dateTime":
          value = "2017-05-11T00:00:00";
          break;
        case "http://www.w3.org/2001/XMLSchema#decimal":
          value = 1234.56789;
          break;
        case "http://www.w3.org/2001/XMLSchema#double":
          value = 10.0e25;
          break;
        case "urn:un:unece:uncefact:codelist:standard:ISO:ISO3AlphaCurrencyCode:2012-08-31#ISO3AlphaCurrencyCodeContentType":
          value = "YEN";
          break;
        default:
          if (!Resource.map[range]) console.log(range);
          value = {
            "@type": Resource.map[range] ? Resource.map[range].compact : range
          };
          break;
      }
      json[v.compact] = (useArray && isNaN(that.cardinality(v.id))) ? [value] : value;
    });
    return json;
  }
};

fetch("https://imi.go.jp/ns/core/rdf.jsonld").then(function(a) {
  return a.json();
}).then(function(json) {
  return new Promise(function(resolve, reject) {
    jsonld.flatten(json, function(err, flat) {
      resolve(flat.map(function(a) {
        return new Resource(a);
      }));
    });
  });
}).then(function(resources) {

  resources.filter(function(a) {
    return a.is("http://www.w3.org/2002/07/owl#Ontology");
  }).forEach(function(a) {
    $("#version").text(a.val("http://www.w3.org/2002/07/owl#versionInfo"));
  });

  var render = function(a, depth) {
    var div = $("<div class='clazz'/>");
    div.attr("id", a.label);

    $("#menu>ul").append($("<li/>").css("text-indent", depth + "em").append(
      $("<a/>").attr("href", "#" + a.label).text(a.label)));

    var anc = [];
    for (var f = a; f; f = f.parent()) anc.unshift(f);
    var ul = $("<ul/>").appendTo(div);
    anc.forEach(function(v, i) {
      var a = $("<a/>").attr("href", "#" + v.label).text(v.label);
      if (i === anc.length - 1) a = $("<b/>").text(v.label);
      ul.append($("<li/>").append(a));
    });
    div.append($("<p/>").text(a.comment));
    div.append($("<pre/>").text(JSON.stringify(a.instance(false), null, "  ")));
    div.append($("<button>配列のon/off</button>").attr("value", a.id));
    $("#container").append(div);

    a.children().forEach(function(v) {
      render(v, depth + 1);
    });

  };

  render(resources.find(function(a) {
    return a.id === "http://imi.go.jp/ns/core/rdf#概念型";
  }), 0);

  $("button").on("click", function() {
    var button = $(this);
    var pre = $(this).parent().find("pre");
    var a = Resource.map[button.attr("value")];
    if (button.is(".on")) {
      button.removeClass("on");
      pre.text(JSON.stringify(a.instance(false), null, "  "));
    } else {
      button.addClass("on");
      pre.text(JSON.stringify(a.instance(true), null, "  "));
    }
  });

});
