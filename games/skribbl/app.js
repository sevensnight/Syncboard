const express = require('express');

const app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    // Accept both ?id= and SyncBoard's ?room=
    const roomID = req.query.id || req.query.room || null;
    res.render('index', { roomID });
});

module.exports = app;
