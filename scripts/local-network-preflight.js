'use strict';

// Public, non-billable probes: never send API keys or company data.
async function checkNetwork(options = {}) {
  const fetcher = options.fetch || fetch;
  const targets = [{name:'OpenRegister',url:'https://api.openregister.de/v1',accept:r=>r.status === 404 || r.ok}];
  if (options.jwksUrl) targets.push({name:'Supabase Auth',url:options.jwksUrl,accept:r=>r.ok});
  const results = await Promise.all(targets.map(async target => {
    try {
      const response = await fetcher(target.url, {method:'GET',redirect:'error',signal:AbortSignal.timeout(10000)});
      await response.body?.cancel();
      if (!target.accept(response)) return target.name + ': HTTP ' + response.status;
      return null;
    } catch(error) {
      return target.name + ': ' + (error.cause?.code || error.code || error.name || 'NETWORK_ERROR');
    }
  }));
  const failures = results.filter(Boolean);
  if (failures.length) {
    const error = new Error('Lokalni strežnik nima delujoče zunanje povezave (' + failures.join('; ') + '). Zaženite ga v okolju z dovoljenim omrežnim dostopom. Preverite tudi internetno povezavo. Zagon je ustavljen; to ni napaka izbranega podjetja.');
    error.code = 'LOCAL_NETWORK_UNAVAILABLE';
    throw error;
  }
}
module.exports = {checkNetwork};
