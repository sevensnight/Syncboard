function createRateLimiter({ maxEvents = 30, windowMs = 1000 } = {}) {
  const hitsByKey = new Map();

  function allow(key) {
    if (!key) {
      return true;
    }

    const now = Date.now();
    const recentHits = (hitsByKey.get(key) || []).filter((timestamp) => now - timestamp < windowMs);

    if (recentHits.length >= maxEvents) {
      hitsByKey.set(key, recentHits);
      return false;
    }

    recentHits.push(now);
    hitsByKey.set(key, recentHits);
    return true;
  }

  function clear(key) {
    if (!key) {
      return;
    }

    hitsByKey.delete(key);
  }

  return {
    allow,
    clear,
  };
}

module.exports = {
  createRateLimiter,
};
