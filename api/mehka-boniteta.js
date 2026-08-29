"use strict";

// Združljivostna vstopna točka. Celoten ročni API in delavec čakalne vrste
// morata uporabljati isto kanonično implementacijo, sicer lahko popravek
// parserja, dokazila ali varnostne pregrade obstane samo v eni poti.
module.exports = require("./_handlers/mehka-boniteta");
