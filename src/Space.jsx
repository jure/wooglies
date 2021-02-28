import React, { useRef, useEffect } from 'react'
import { PointerLockControls } from '@react-three/drei'
import Peer from 'simple-peer'
import io from 'socket.io-client'
import Player from './Player'
import OtherPlayers from './OtherPlayers'
import { useClientStore } from './useClientStore'
import * as THREE from 'three'
import generateName from './randomName'

export default function Space(props) {
  const socketRef = useRef()
  const controlsRef = useRef()
  const playerRef = useRef()
  // const [peers, setPeers] = useState([])
  const peersRef = useRef([])
  const yourId = useRef(null)

  const iceServersRef = useRef([
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:global.stun.twilio.com:3478',
      ],
    },
  ])
  // Mini audio system refs
  const listenerRef = useRef(new THREE.AudioListener())
  const playerAudioRef = useRef()
  const playerAudioContextRef = useRef()
  const outboundStreamRef = useRef()
  const outboundGainNodeRef = useRef()
  const outboundAnalyserRef = useRef()
  const analyserLevelsRef = useRef()
  // End mini audio system

  // Lights, needed as they go into the volumetric shader worldToLocal
  const lightOneRef = useRef()
  const lightTwoRef = useRef()
  const lightThreeRef = useRef()

  const {
    clients,
    addClient,
    deleteClient,
    updateClient,
    setClients,
  } = useClientStore()

  // Peer and client represent the diff aspects of a single user
  // peer join - audio/webrtc
  // client join - pos/rot
  useEffect(() => {
    socketRef.current = io.connect('/')

    // Init audio system on Enter button click
    // (Enter buttons live in non-React world)
    const initAudio = () => {
      console.log('Initing audio')
      // Mini audio system
      // https://github.com/mozilla/hubs/blob/ba7d9319dca7790c29d3404b95d570107f1a27f6/src/systems/audio-system.js#L103
      playerAudioContextRef.current = THREE.AudioContext.getContext()
      playerAudioContextRef.current
        .resume()
        .then(() => console.log('Audio context resumed'))

      playerAudioRef.current = playerAudioContextRef.current.createMediaStreamDestination()
      outboundStreamRef.current = playerAudioRef.current.stream
      outboundGainNodeRef.current = playerAudioContextRef.current.createGain()
      outboundAnalyserRef.current = playerAudioContextRef.current.createAnalyser()
      outboundAnalyserRef.current.fftSize = 64
      outboundAnalyserRef.current.smoothingTimeConstant = 0.85
      analyserLevelsRef.current = new Uint8Array(
        outboundAnalyserRef.current.frequencyBinCount
      )
      outboundGainNodeRef.current.connect(outboundAnalyserRef.current)
      outboundAnalyserRef.current.connect(playerAudioRef.current)

      // End mini audio system
    }
    document
      .querySelectorAll('.enterbutton')
      .forEach((button) => button.addEventListener('click', initAudio))
    // End little bridge to non-React world

    socketRef.current.on('clients', (snapshot) => {
      setClients(snapshot.state)
      console.log('Clients', snapshot.state)
    })

    socketRef.current.on('client joined', (newClientId, client) => {
      addClient(newClientId, client)

      console.log('Client joined: ', newClientId)
      const stream = playerAudioRef.current.stream
      const peer = createPeer(yourId.current, newClientId, stream, false)
      peersRef.current.push({
        peerId: newClientId,
        peer,
      })
      updateClient(newClientId, { peer })
    })

    socketRef.current.on('client disconnected', (id) => {
      deleteClient(id)
    })

    socketRef.current.on('iceServers', (iceServers) => {
      iceServersRef.current = iceServers
    })

    socketRef.current.on('initial info', (id, client) => {
      yourId.current = id
      document.getElementById('debug').innerText = id
      playerRef.current.position.set(client.x, client.y, client.z)
      console.log(`Your id is ${id}`)
    })

    // TODO: Remove bridge to the non-React input elements
    const clientJoin = () => {
      const spaceName =
        props.spaceNameRef.current ||
        Math.floor(Math.random() * 1000).toString()
      const nickname = props.nicknameRef.current || generateName()
      // Clients
      document.getElementById('nickname').value = nickname
      socketRef.current.emit('client join', spaceName, nickname)

      window.history.pushState({}, spaceName, `/${spaceName}`)
      // Once you've joined a room you can't leave/change room until reload
      document
        .querySelectorAll('.enterbutton')
        .forEach((button) => button.removeEventListener('click', clientJoin))
    }
    document
      .querySelectorAll('.enterbutton')
      .forEach((button) => button.addEventListener('click', clientJoin))
    // End TODO

    // Peers
    // Tries to connect to all clients as WebRTC peers
    socketRef.current.on('peers', (clientIds) => {
      clientIds.forEach((clientId) => {
        // Default silent/blank audio stream that we add to later
        const stream = playerAudioRef.current.stream
        const peer = createPeer(yourId.current, clientId, stream, true) // initiator = true
        peersRef.current.push({
          peerId: clientId,
          peer,
        })
        updateClient(clientId, { peer })
      })
    })

    // Relaying signals from remote to local peers
    socketRef.current.on('signal', (payload) => {
      // We're 'applying' the signal to the 'from' peer, as that's the one
      // sending us the signal. The 'from' and 'to' are in the context of
      // the server, so it knows who to send the message to.
      const item = peersRef.current.find((p) => p.peerId === payload.from)
      item.peer.signal(payload.signal)
    })
  }, [])

  function createPeer(from, to, stream, initiator = true) {
    const peer = new Peer({
      initiator,
      config: {
        iceServers: iceServersRef.current,
      },
      trickle: true,
      stream,
    })

    peer.on('signal', (signal) => {
      console.log('Signal', signal, signal.candidate?.candidate)
      socketRef.current.emit('signal', {
        from,
        to,
        signal,
      })
    })

    peer.on('close', (close) => {
      console.log('Peer closing', close)
    })

    peer.on('error', (err) => {
      console.log('Peer error', err)
    })

    return peer
  }

  return (
    <>
      <gridHelper args={[22, 22, 0x333333, 0x111111]} />
      <ambientLight intensity={0.01} />
      <pointLight ref={lightOneRef} color={0x0000ff} position={[12, -10, 1]} />
      <pointLight ref={lightTwoRef} color={0x00ff00} position={[-2, 1, -2]} />
      <pointLight ref={lightThreeRef} color={0xe43415} position={[-6, 1, 2]} />
      <OtherPlayers
        socketRef={socketRef}
        clients={clients}
        listenerRef={listenerRef}
        lightOneRef={lightOneRef}
        lightTwoRef={lightTwoRef}
        lightThreeRef={lightThreeRef}
        volumetric={props.volumetricOther}
      />
      <PointerLockControls ref={controlsRef} selector="#enterflat" />
      <Player
        analyserLevelsRef={analyserLevelsRef}
        outboundAnalyserRef={outboundAnalyserRef}
        peersRef={peersRef}
        socketRef={socketRef}
        controlsRef={controlsRef}
        playerRef={playerRef}
        listenerRef={listenerRef}
        playerAudioRef={playerAudioRef}
        playerAudioContextRef={playerAudioContextRef}
        outboundGainNodeRef={outboundGainNodeRef}
        lightOneRef={lightOneRef}
        lightTwoRef={lightTwoRef}
        lightThreeRef={lightThreeRef}
        volumetric={props.volumetricSelf}
      />
    </>
  )
}

Space.defaultProps = {
  volumetricOther: false,
  volumetricSelf: false,
}
