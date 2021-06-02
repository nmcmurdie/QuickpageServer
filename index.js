'use strict'
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

app.get('/', () => {
    throw new Error('Invalid endpoint');
});

app.get('/basic', (req, res) => {
    let url = req.query.url;
    fetch(url)
        .then(async response => {
            let content = await response.buffer();
            let body = `data:${response.headers.get('content-type')};base64,${content.toString('base64')}`;
            res.send(body);
        })
        .catch(err => {
            throw new Error("Unable to retrieve image");
        });
});

const port = process.env.PORT || 3000;

app.listen(port);