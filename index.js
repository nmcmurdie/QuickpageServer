'use strict'
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const sharp = require('sharp');
const axios = require("axios");
const cheerio = require("cheerio");
require('dotenv').config();

const imgTypes = ["jpg", "png", "jpeg", "webp"];
const IMAGE_SIZE_THRESHOLD = 800;

const app = express();
app.use(cors({
    origin: ['chrome-extension://mbhlblpfcjcoheaejihfdnlkhpfdmoao', 'chrome-extension://hcmdimfdocdkbfhpggncklfkfnaolhem']
}));

app.get('/', (req, res) => {
    res.status(400).send("Error: Invalid Endpoint");
});

const getImageURL = (str) => {
    if (!str) return undefined;

    try {
        const url = new URL(str);
        const filetype = url.pathname.split('.').pop().trim();
        if (imgTypes.includes(filetype)) return `${url.protocol}//${url.host}${url.pathname}`;
    }
    catch (exception) {
        return undefined;
    }
}

const resizeImage = (res, url, w) => {
    fetch(url)
        .then(async response => {
            let buffer = await response.buffer();
            sharp(buffer).resize(+w).toBuffer()
                .then(data => {
                    res.contentType(response.headers.get('content-type'));
                    res.send(data);
                })
                .catch(err => {
                    res.status(404).send("Error: Image Not Found");
                })
        })
        .catch(err => {
            res.status(404).send("Error: Unable to Fetch Image");
        });
}

app.get('/thumbnail', async (req, res) => {
    res.set('Cache-control', 'public, max-age=86400');
    let { url, w } = req.query;

    if (url && w) {
        try {
            const { data } = await axios.get(url, { 
                headers: { "Accept-Encoding": "gzip,deflate,compress" } 
            });
            const $ = cheerio.load(data);
            const sources = $('source');
            const images = $('img');

            // Find largest image
            let maxImage;
            let maxImageSize = -2;

            let processImg = (el, src_attr, size_attr) => {
                const source = $(el);
                const src = source.attr(src_attr);
                const size = source.attr(size_attr);
                const sizeInt = size ? parseInt(size) : -1;
                
                const imageURL = getImageURL(src);
                if (sizeInt > maxImageSize && imageURL) maxImage = imageURL;
                if (maxImageSize >= IMAGE_SIZE_THRESHOLD) return false;
            };

            sources.each((_idx, el) => processImg(el, 'data-srcset', 'sizes'));
            images.each((_idx, el) => processImg(el, 'src', 'width'));

            resizeImage(res, maxImage, w);
        } catch(err) {
            console.log(err);
            res.status(404).send("Error: Unable to Fetch Images from Page");
        }
        
    }
    else {
        res.status(400).send("Error: Missing URL or Width Parameter");
    }
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
        .catch(() => {
            res.status(404).send("Error: Unable to Fetch Image");
        });
    else {
        res.status(400).send("Error: Missing URL Parameter");
    }
});

app.get('/resize', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    let { url, w } = req.query;

    if (url && w) resizeImage(res, url, w);
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
    .then(async response => {
        let json = await response.json();
        res.contentType('text/json');
        res.send(json);
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