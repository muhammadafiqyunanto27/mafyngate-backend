const app = require('./app');
const config = require('./src/config/env');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
