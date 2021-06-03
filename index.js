'use strict'
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const sharp = require('sharp');
require('dotenv').config();

const app = express();
app.use(cors({
    origin: 'chrome-extension://mbhlblpfcjcoheaejihfdnlkhpfdmoao'
}));

app.get('/', (req, res) => {
    res.status(400).send("Error: Invalid Endpoint");
});

app.get('/basic', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    let url = req.query.url;

    if (url) fetch(url)
        .then(async response => {
            let content = await response.buffer();
            let body = `data:${response.headers.get('content-type')};base64,${content.toString('base64')}`;
            res.send(body);
        })
        .catch(err => {
            res.status(404).send("Error: Unable to Fetch Image");
        });
    else {
        res.status(400).send("Error: Missing URL Parameter");
    }
});

app.get('/resize', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    let { url, w } = req.query;

    if (url && w) fetch(url)
        .then(async response => {
            let buffer = await response.buffer();
            sharp(buffer).resize(+w).toBuffer()
                .then(data => {
                    res.contentType(response.headers.get('content-type'));
                    res.send(data);
                })
                .catch(err => {
                    res.status(400).send("Error: Invalid Image Format");
                })
        })
        .catch(err => {
            res.status(404).send("Error: Unable to Fetch Image");
        });
    else {
        res.status(400).send("Error: Missing URL or Width Parameter");
    }
});

function fetchSpotifyAuth(res, path) {
    let baseURL = 'https://accounts.spotify.com';
    fetch(baseURL + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    .then(res => res.json())
    .then(response => {
        res.contentType('text/json');
        res.send(response);
    })
    .catch(err => {
        res.status(400).send("Error: Unable to Retrieve Authorization");
    });
}

app.get('/spotifyauth', (req, res) => {
    let { redirect_uri, code } = req.query;

    if (redirect_uri && code) {
        let path = `/api/token?client_id=${process.env.SPOTIFY_CLIENT}&client_secret=${process.env.SPOTIFY_SECRET}&grant_type=authorization_code&code=${code}&redirect_uri=${redirect_uri}`;
        fetchSpotifyAuth(res, path);
    }
    else {
        res.status(400).send("Error: Missing URI or Code Parameter");
    }
});

app.get('/spotifyrefresh', (req, res) => {
    let { refresh_token } = req.query;

    if (refresh_token) {
        let path = `/api/token?client_id=${process.env.SPOTIFY_CLIENT}&client_secret=${process.env.SPOTIFY_SECRET}&grant_type=refresh_token&refresh_token=${refresh_token}`;
        fetchSpotifyAuth(res, path);
    }
    else {
        res.status(400).send("Error: Missing Refresh Token Parameter");
    }
});

const port = process.env.PORT || 3000;
app.listen(port);