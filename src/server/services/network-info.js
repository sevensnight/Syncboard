const QRCode = require('qrcode');
const os = require('os');
const { normalizeText } = require('../utils/text');

function isPrivateIpv4(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }

  if (address.startsWith('10.')) {
    return true;
  }

  if (address.startsWith('192.168.')) {
    return true;
  }

  const parts = address.split('.').map(Number);
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function scoreInterface(name, address) {
  const normalizedName = String(name || '').toLowerCase();
  let score = 0;

  const blockedKeywords = [
    'vmware',
    'virtualbox',
    'hyper-v',
    'vethernet',
    'wsl',
    'docker',
    'tailscale',
    'zerotier',
    'teredo',
    'loopback',
    'bridge',
    'bluetooth',
    'radmin',
    'npcap',
    'tap',
    'tun',
    'pptp',
    'l2tp',
    'pppoe',
  ];

  if (blockedKeywords.some((keyword) => normalizedName.includes(keyword))) {
    return -100;
  }

  if (normalizedName.includes('wlan') || normalizedName.includes('wi-fi') || normalizedName.includes('wireless')) {
    score += 100;
  }

  if (normalizedName.includes('ethernet') || normalizedName.includes('以太网') || normalizedName.includes('lan')) {
    score += 80;
  }

  if (address.startsWith('192.168.')) {
    score += 50;
  } else if (address.startsWith('10.')) {
    score += 30;
  } else {
    score += 10;
  }

  return score;
}

function getPreferredLanAddress() {
  const networkInterfaces = os.networkInterfaces();
  const candidates = [];

  Object.entries(networkInterfaces).forEach(([name, interfaceGroup]) => {
    (interfaceGroup || []).forEach((network) => {
      const isIpv4 = typeof network.family === 'string' ? network.family === 'IPv4' : network.family === 4;

      if (!isIpv4 || network.internal || !isPrivateIpv4(network.address)) {
        return;
      }

      const score = scoreInterface(name, network.address);

      if (score < 0) {
        return;
      }

      candidates.push({
        name,
        address: network.address,
        score,
      });
    });
  });

  candidates.sort((left, right) => right.score - left.score || left.address.localeCompare(right.address));
  return candidates[0]?.address || null;
}

function buildShareUrl(baseUrl, roomId) {
  const shareUrl = new URL(baseUrl);
  shareUrl.searchParams.set('room', normalizeText(roomId, 'lobby', 32));
  return shareUrl.toString();
}

async function getNetworkInfo({ port, roomId = 'lobby' }) {
  const preferredLanAddress = getPreferredLanAddress();
  const preferredLanUrl = preferredLanAddress ? `http://${preferredLanAddress}:${port}` : null;
  const localhostUrl = `http://localhost:${port}`;
  const shareUrl = buildShareUrl(preferredLanUrl || localhostUrl, roomId);
  const qrCodeDataUrl = await QRCode.toDataURL(shareUrl, {
    width: 220,
    margin: 1,
  });

  return {
    port,
    localhostUrl,
    preferredLanAddress,
    preferredLanUrl,
    shareUrl,
    qrCodeDataUrl,
  };
}

module.exports = {
  buildShareUrl,
  getNetworkInfo,
  getPreferredLanAddress,
};
