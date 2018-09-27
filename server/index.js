const keys          = require('./keys');
const express       = require('express');
const bodyParser    = require('body-parser');
const cors          = require('cors');
const redis         = require('redis');
const { Pool }      = require('pg');
const app           = express();

//pg clinet set up
const pgClient      = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
});

//redis client set up
const redisClient   = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate();

//express config
app.use(cors());
app.use(bodyParser.json());

//pg on error
pgClient.on('error', () => console.log('Lost PG connection'));

pgClient
    .query('CREATE TABLE IF NOT EXISTS values (number INT)')
    .catch(error => console.log("Error PG:", error));

//routes
app.get('/', (req, res) => {
    res.send('Hiii');
});

app.get('/values/all', async (req, res) => {
    const values = await pgClient.query('SELECT * from values');
    res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
    redisClient.hgetall('values', (error, values) => {
        res.send(values);
    });
});

app.post('/values', async (req, res) => {
    const index = req.body.index;
    if(parseInt(index) > 40) return res.status(422).send('Index too high');
    redisClient.hset('values', index, 'Nothing yet!');
    redisPublisher.publish('insert', index);
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);
    res.send({ working: true });
});

app.listen(5000, error => console.log('Listening..')); 