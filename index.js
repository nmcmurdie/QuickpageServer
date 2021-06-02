'use strict'
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const sharp = require('sharp');

const app = express();
app.use(cors());

app.get('/', () => {
    throw new Error('Invalid endpoint');
});

app.get('/basic', (req, res) => {
    let url = req.query.url;

    if (url) fetch(url)
        .then(async response => {
            let content = await response.buffer();
            let body = `data:${response.headers.get('content-type')};base64,${content.toString('base64')}`;
            res.send(body);
        })
        .catch(err => {
            res.status(404).send("Unable to Fetch Image");
        });
    else {
        res.status(400).send("Missing URL Parameter");
    }
});

app.get('/resize', (req, res) => {
    let { url, w } = req.query;

    if (url && w) fetch(url)
        .then(async response => {
            let buffer = await response.buffer();
            sharp(buffer).resize(+w).toBuffer()
                .then(data => {
                    res.contentType(response.headers.get('content-type'));
                    res.send(data);
                });
        })
        .catch(err => {
            res.status(404).send("Unable to Fetch Image");
        });
    else {
        res.status(400).send("Missing URL or Width Parameter");
    }
});

const port = process.env.PORT || 3000;
app.listen(port);