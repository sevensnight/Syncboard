const express = require('express')
const socketio = require('socket.io')
const http = require('http')
const cors = require('cors')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./users')
const path = require('path')

const PORT = Number(process.env.PORT) || 3003
const HOST = process.env.HOST || '0.0.0.0'

const app = express()
const server = http.createServer(app)
const io = socketio(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
})

app.use(cors())

io.on('connection', socket => {
    socket.on('join', (payload, callback) => {
        // Roles must stay "Player 1" / "Player 2" — game UI & turn logic depend on them.
        let numberOfUsersInRoom = getUsersInRoom(payload.room).length

        const { error, newUser} = addUser({
            id: socket.id,
            name: numberOfUsersInRoom === 0 ? 'Player 1' : 'Player 2',
            room: payload.room
        })

        if(error)
            return callback(error)

        socket.join(newUser.room)

        io.to(newUser.room).emit('roomData', {room: newUser.room, users: getUsersInRoom(newUser.room)})
        socket.emit('currentUserData', {name: newUser.name})
        callback()
    })

    socket.on('initGameState', gameState => {
        const user = getUser(socket.id)
        if(user)
            io.to(user.room).emit('initGameState', gameState)
    })

    socket.on('updateGameState', gameState => {
        const user = getUser(socket.id)
        if(user)
            io.to(user.room).emit('updateGameState', gameState)
    })

    socket.on('sendMessage', (payload, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('message', {user: user.name, text: payload.message})
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)
        if(user)
            io.to(user.room).emit('roomData', {room: user.room, users: getUsersInRoom(user.room)})
    })
})

// Always serve CRA build when present (SyncBoard embeds this process in an iframe).
const clientBuildDir = path.resolve(__dirname, 'client', 'build')
const clientBuildIndex = path.join(clientBuildDir, 'index.html')
if (require('fs').existsSync(clientBuildIndex)) {
	app.use(express.static(clientBuildDir))
	app.get('*', (req, res) => {
		res.sendFile(clientBuildIndex)
	})
} else {
	app.get('/', (_req, res) => {
		res.status(503).send('UNO client is not built yet. Run: cd client && npm install && npm run build')
	})
}

server.listen(PORT, HOST, () => {
    console.log(`UNO server running on http://${HOST}:${PORT}`)
})