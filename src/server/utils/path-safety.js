const path = require('path');

function isPathInside(parentDirectory, targetPath) {
  const resolvedParent = path.resolve(parentDirectory);
  const resolvedTarget = path.resolve(targetPath);

  if (resolvedParent === resolvedTarget) {
    return true;
  }

  const relative = path.relative(resolvedParent, resolvedTarget);
  return Boolean(relative)
    && !relative.startsWith('..')
    && !path.isAbsolute(relative);
}

module.exports = {
  isPathInside,
};
