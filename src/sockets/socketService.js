let io;

module.exports = {
  init: (socketIo) => {
    io = socketIo;
    return io;
  },
  getIo: () => {
    if (!io) {
      // Return a mock if not initialized to prevent crashes
      return {
        to: () => ({ emit: () => {} }),
        emit: () => {}
      };
    }
    return io;
  }
};
