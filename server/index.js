require('dotenv').config()
const SnapshotInterpolation = require('@geckos.io/snapshot-interpolation')
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const path = require('path')

// Download the helper library from https://www.twilio.com/docs/node/install
// Your Account Sid and Auth Token from twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioClient = require('twilio')(accountSid, authToken)

app.use(express.static('dist'))

// A simple catch all route, based on: https://gitlab.com/sebdeckers/express-history-api-fallback
app.use((req, res, next) => {
  if ((req.method === 'GET' || req.method === 'HEAD') && req.accepts('html')) {
    res.sendFile(
      path.join(__dirname, '..', 'dist', 'index.html'),
      {},
      (err) => {
        if (err) {
          next(err)
        } else {
          console.log('Served index.html')
        }
      }
    )
  } else next()
})

const SERVER_FPS = 60
const Y_OFFSET = 0.5
const port = process.env.PORT || 3000
console.log('Server is running localhost on port: ' + port)

const SI = new SnapshotInterpolation.SnapshotInterpolation()

const spaces = {}

const addClient = (spaceName, client) => {
  const worldState = spaces[spaceName]
  if (!worldState.find((c) => c.id === client.id)) {
    worldState.push(client)
  }
}

const removeClient = (spaceName, clientId) => {
  spaces[spaceName] = spaces[spaceName].filter((c) => c.id !== clientId)
}

const updateClient = (spaceName, client) => {
  const worldState = spaces[spaceName]
  const clientIndex = findClient(spaceName, client)
  worldState[clientIndex] = { ...worldState[clientIndex], ...client }
}

const findClient = (spaceName, client) => {
  const worldState = spaces[spaceName]
  return worldState.findIndex((c) => c.id === client.id)
}

const spaceSnapshotWithoutSelf = (spaceName, client) => {
  const worldState = spaces[spaceName]
  return SI.snapshot.create(worldState.filter((c) => c.id !== client.id))
}

io.on('connection', (client) => {
  let updateInterval // the world state update interval, gets created when joining a space and cleared when leaving

  let iceServers
  // Generate the iceServers list to be passed to the browser on connection
  twilioClient.tokens
    .create()
    .then((res) => {
      iceServers = res.iceServers
      client.emit('iceServers', iceServers)
    })
    .catch((err) => console.error(err))

  console.log(
    'User ' +
      client.id +
      ' connected, there are ' +
      io.engine.clientsCount +
      ' clients connected'
  )

  client.on('disconnect', () => {
    console.log(
      `We've lost engine ${client.id} and engine 2 is no longer on fire!`
    )
  })

  // Client joining without stream/media
  client.on('client join', (spaceName, nickname) => {
    client.join(spaceName)

    // Initialize world state if not present
    spaces[spaceName] = spaces[spaceName] || []

    // 4 people max
    if (spaces[spaceName].length === 4) {
      client.emit('space full')
      return
    }

    // no suffix is player group
    // *C is camera/head
    // *L is left controller
    // *R is right controller
    const newClient = {
      id: client.id,
      spaceName: spaceName,
      nickname: nickname,
      x: Math.random() * 7,
      y: Y_OFFSET,
      z: Math.random() * 7,
      q: { x: 0, y: 0, z: 0, w: 1 },
      xC: 0, // Math.random() * 5,
      yC: 0, //
      zC: 0, // Math.random() * 5,
      qC: { x: 0, y: 1, z: 0, w: 0 },
      xL: undefined,
      yL: undefined,
      zL: undefined,
      qL: { x: 0, y: 0, z: 0, w: 1 },
      xR: undefined,
      yR: undefined,
      zR: undefined,
      qR: { x: 0, y: 0, z: 0, w: 1 },
    }

    client.emit('initial info', client.id, newClient, iceServers)

    addClient(spaceName, newClient)

    console.log(
      `Client ${nickname} (${client.id}) joined ${spaceName}. ${spaces[spaceName].length} wooglies in space.`
    )

    // Notify others in the space that a new client has joined (only pos/rot)
    client.to(spaceName).emit('client joined', client.id, newClient)

    // This is clients without audio, just position and rotation
    client.emit('clients', spaceSnapshotWithoutSelf(spaceName, client))

    // Almost the same as above, but it's just raw client ids, used for WebRTC
    client.emit(
      'peers',
      spaces[spaceName].filter((c) => c.id !== client.id).map((c) => c.id)
    )

    // This fires very frequently to update the state on the server
    client.on('move', (data) => {
      // console.log(
      //   `Client ${client.id} moving ${data.x} ${data.y} ${data.z}, time delta: ${delta}`
      // )
      const update = {
        id: client.id,
        x: data.x,
        y: data.y,
        z: data.z,
        q: data.q,
        xC: data.xC,
        yC: data.yC,
        zC: data.zC,
        qC: data.qC,
        xL: data.xL,
        yL: data.yL,
        zL: data.zL,
        qL: data.qL,
        xR: data.xR,
        yR: data.yR,
        zR: data.zR,
        qR: data.qR,
      }
      updateClient(spaceName, update)
    })

    updateInterval = setInterval(() => {
      // console.log(`Sending out a snapshot for ${worldState.length} users`)
      const snapshot = spaceSnapshotWithoutSelf(spaceName, client)
      client.emit('snapshot', snapshot)
    }, 1000.0 / SERVER_FPS)

    // Handle the disconnection
    client.on('disconnect', () => {
      // Delete this client from the object
      console.log('Disconnecting', client.id, spaceName)
      spaceName && removeClient(spaceName, client.id)
      clearInterval(updateInterval)
      io.sockets.emit('client disconnected', client.id)
      console.log(
        'User ' +
          client.id +
          ' diconnected, there are ' +
          io.engine.clientsCount +
          ' clients connected'
      )
    })
  })

  // Peers

  client.on('signal', (payload) => {
    // console.log(
    //   `Relaying signal from ${payload.from} to ${payload.to}: `,
    //   payload
    // )
    if (payload.from !== client.id) {
      console.error('Wrong from')
      return
    }

    io.to(payload.to).emit('signal', payload)
  })
})

server.listen(port)
