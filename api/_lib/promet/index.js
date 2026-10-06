"use strict";

module.exports = {
  celice: require("./celice"),
  tipDneva: require("./tip-dneva"),
  profil: require("./profil"),
  napoved: require("./napoved"),
  osrm: require("./osrm"),
  geokodiranje: require("./geokodiranje"),
  storitev: require("./storitev"),
  dan: require("./dan"),
  zemljevid: require("./zemljevid"),
  lokalno: require("./lokalno"),
  viri: { autobahn: require("./viri/autobahn"), dars: require("./viri/dars") }
};
