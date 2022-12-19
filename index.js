'use strict'
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const sharp = require('sharp');
const axios = require("axios");
const cheerio = require("cheerio");
require('dotenv').config();

const imgTypes = ["jpg", "png", "jpeg", "webp"];

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
        if (imgTypes.includes(filetype)) return str;
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
                    console.log(err);
                    res.status(404).send("Error: image not found");
                })
        })
        .catch(err => {
            console.log(err);
            res.status(404).send("Error: Unable to fetch image");
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

            // Find thumbnail
            let maxImage;

            $('link[rel="preload"]').each((_idx, el) => {
                const source = $(el);
                const src = source.attr('href');
                const sizes = source.attr('media');
                if (!sizes) return;

                const minIndex = sizes.indexOf("min-width:"),
                    maxIndex = sizes.indexOf("max-width:");
                let sizeInt = -1;
                
                if (maxIndex !== -1 || minIndex !== -1) {
                    const index = Math.max(maxIndex, minIndex);
                    let size = parseInt(sizes.substring(index + 10));
                    sizeInt = size ?? sizeInt;
                }
                
                const imageURL = getImageURL(src);
                if (sizeInt >= w && imageURL) {
                    maxImage = imageURL;
                    return false;
                }
            });

            const processImg = (el, src_attr, size_attr) => {
                const source = $(el);
                const src = source.attr(src_attr);
                const size = source.attr(size_attr);
                const sizeInt = size ? parseInt(size) : -1;
                
                const imageURL = getImageURL(src);
                if (sizeInt >= w && imageURL) {
                    maxImage = imageURL;
                    return false;
                }
                else if (!maxImage && imageURL) {
                    maxImage = imageURL;
                }
            };

            if (!maxImage) $('source').each((_idx, el) => processImg(el, 'data-srcset', 'sizes'));
            if (!maxImage) $('img').each((_idx, el) => processImg(el, 'src', 'width'));

            if (!maxImage) {
                res.status(404).send("Error: Unable to find thumbnail image");
                return;
            }

            resizeImage(res, maxImage, w);
        } catch(err) {
            console.log(err);
            res.status(404).send("Error: Unable to fetch images from page");
        }
        
    }
    else {
        res.status(400).send("Error: Missing URL or width parameter");
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