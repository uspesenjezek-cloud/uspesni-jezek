"use strict";

function requestQuery(req) {
  let params;
  try {
    params = new URL(req && req.url || "/", "http://localhost").searchParams;
  } catch (_) {
    params = new URLSearchParams();
  }
  const result = Object.create(null);
  for (const [key, value] of params) {
    if (!Object.prototype.hasOwnProperty.call(result, key)) result[key] = value;
  }
  return Object.freeze(result);
}

module.exports = requestQuery;
