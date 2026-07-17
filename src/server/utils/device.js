function detectDeviceType(userAgent) {
  const normalized = String(userAgent || '').toLowerCase();

  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(normalized)) {
    return 'tablet';
  }

  if (/mobi|iphone|ipod|android|windows phone/i.test(normalized)) {
    return 'mobile';
  }

  return 'desktop';
}

module.exports = {
  detectDeviceType,
};
