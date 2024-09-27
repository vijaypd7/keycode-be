const express = require("express");
const routes = require("./routes");
const { amqp } = require("./utils/amqp");

const app = express();
const port = process.env.PORT || 3000;

amqp.init().then(() => {
  "Connected to RabbitMQ";
});

app.use(express.json());
app.use("/api", routes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
