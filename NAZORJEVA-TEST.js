"use strict";

// Edino dovoljeno čakalno mesto za nove ali preoblikovane widgete.
// Vnos mora ostati status:"test" in se ne sme uporabljati v produkcijskem
// registru, dokler uporabnik izrecno ne odobri njegove promocije v NAZORJEVA.js.
const WIDGETS = Object.freeze([
  { number:63, id:"ugotovitev-preverbe", title:"Kaj smo ugotovili in kaj naj naredite?", status:"test", approved:false }
]);

module.exports = Object.freeze({
  version:"nazorjeva-test-v1",
  name:"NAZORJEVA-TEST",
  status:"test",
  widgets:WIDGETS,
  ids:Object.freeze(WIDGETS.map((entry) => entry.id))
});
