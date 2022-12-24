const express = require('express');
const { request, response } = require('./app');
const app = require("./app");


app.listen(process.env.PORT || 3000, () => {
  console.log("Started express server at port 3000");
});
