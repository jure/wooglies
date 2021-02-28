import React, { useRef, useState, useEffect } from 'react'
import { useFrame, extend } from 'react-three-fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { PositionalAudioHelper } from 'three/examples/jsm/helpers/PositionalAudioHelper.js'

import CapsuleBufferGeometry from './CapsuleBufferGeometry'
extend({ CapsuleBufferGeometry })

const Box = React.forwardRef((props, ref) => {
  // This reference will give us direct access to the mesh
  const innerRef = useRef()
  const startTime = useRef(performance.now())
  const materialRef = useRef()
  const cameraQuatRef = useRef(new THREE.Quaternion())
  const listenerRef = props.listenerRef
  const positionalAudioRef = useRef()
  const objectQuat = useRef(new THREE.Quaternion())

  // Audio system
  const analyserRef = useRef()
  const analyserLevelsRef = useRef()
  const gainRef = useRef()
  const splitterRef = useRef()

  const sphereRefs = useRef([])
  const fibonacciPoints = useRef(Array(32).fill())
  const lookAtMarkerRef = useRef()
  const lookAtMarkerWorldPos = useRef(new THREE.Vector3())

  const textRef = useRef()
  const textRefWorldPos = useRef(new THREE.Vector3())

  useEffect(() => {
    // Adapted from https://gist.github.com/stephanbogner/a5f50548a06bec723dcb0991dcbb0856
    const samples = fibonacciPoints.current.length
    const radius = 1 // radius || 1
    const randomize = false // randomize || true
    let random = 1
    if (randomize === true) {
      random = Math.random() * samples
    }

    const offset = 2 / samples
    const increment = Math.PI * (3 - Math.sqrt(5))

    for (let i = 0; i < samples; i++) {
      let y = i * offset - 1 + offset / 2
      const distance = Math.sqrt(1 - Math.pow(y, 2))
      const phi = ((i + random) % samples) * increment
      let x = Math.cos(phi) * distance
      let z = Math.sin(phi) * distance
      x = x * radius
      y = y * radius
      z = z * radius
      fibonacciPoints.current[i] = new THREE.Vector3(x, y, z)
    }
  }, [])

  useEffect(() => {
    if (props.client.peer) {
      props.client.peer.on('stream', (stream) => {
        const audio = document.createElement('audio')
        audio.srcObject = stream
        audio.muted = true

        positionalAudioRef.current.setMediaStreamSource(audio.srcObject)
        const audioContext = positionalAudioRef.current.context
        analyserRef.current = audioContext.createAnalyser()
        analyserRef.current.fftSize = 64
        analyserRef.current.smoothingTimeConstant = 0.85
        analyserLevelsRef.current = new Uint8Array(32)
        positionalAudioRef.current.source.connect(analyserRef.current)

        positionalAudioRef.current.setRefDistance(2)
        positionalAudioRef.current.setDirectionalCone(150, 230, 0.2)
        const helper = new PositionalAudioHelper(
          positionalAudioRef.current,
          1.0
        )
        positionalAudioRef.current.add(helper)
      })
    }
  }, [props.client])

  // Rotate mesh every frame, this is outside of React without overhead
  useFrame(({ camera }) => {
    // Get audio levels
    if (analyserRef.current) {
      analyserRef.current.getByteFrequencyData(analyserLevelsRef.current)
      const levels = analyserLevelsRef.current
      let sum = 0
      for (let i = 0; i < levels.length; i++) {
        const amplitude = levels[i] / 255

        if (fibonacciPoints.current[i] && sphereRefs.current[i]) {
          const reverseIndex = levels.length - i - 1
          sphereRefs.current[reverseIndex].position.copy(
            fibonacciPoints.current[reverseIndex]
          )
          sphereRefs.current[reverseIndex].position.multiplyScalar(
            0.2 + amplitude
          )
        }

        sum += amplitude * amplitude
      }
      const currVolume = Math.sqrt(sum / levels.length)
    }

    // Rotate player name, but only on y axis
    const boxRef = props.boxRefs.current[props.index]
    if (boxRef && textRef.current) {
      textRef.current.position.set(
        boxRef.position.x,
        boxRef.position.y + 1,
        boxRef.position.z
      )
      textRef.current.quaternion.copy(
        positionalAudioRef.current.parent.quaternion
      )
      lookAtMarkerRef.current.getWorldPosition(lookAtMarkerWorldPos.current)
      textRef.current.getWorldPosition(textRefWorldPos.current)
      lookAtMarkerWorldPos.current.y = textRefWorldPos.current.y
      textRef.current.lookAt(lookAtMarkerWorldPos.current)
    }
  })

  return (
    <>
      <mesh {...props} ref={ref}>
        {fibonacciPoints.current.map((sphere, index) => (
          <mesh
            key={index}
            position={sphere}
            ref={(el) => {
              sphereRefs.current[index] = el
            }}
          >
            <sphereGeometry args={[0.1, 20, 20]} />
            <meshStandardMaterial color={'white'} />
          </mesh>
        ))}
        <mesh ref={lookAtMarkerRef} position={[0, 0, 1]} />
        <positionalAudio
          visible={false}
          args={[listenerRef.current]}
          ref={positionalAudioRef}
        />
      </mesh>
      <Text
        position={[0, 1.5, 0]}
        ref={textRef}
        color={'#b1b1b1'}
        fontSize={0.25}
        maxWidth={1}
        lineHeight={1}
        letterSpacing={0.02}
        textAlign={'center'}
        font="/AmaticSC-Bold.ttf"
        anchorX="center"
        anchorY="middle"
      >
        {props.client.nickname || ''}
      </Text>
    </>
  )
})
Box.displayName = 'Box'

export default Box
