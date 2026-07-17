let socketInstance = null;

function getSocket() {
  if (!socketInstance) {
    socketInstance = io();
  }

  return socketInstance;
}

export { getSocket };
