import React, { useRef, useEffect } from 'react'
import { useFrame, extend } from 'react-three-fiber'
import { useController } from '@react-three/xr'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import CapsuleBufferGeometry from './CapsuleBufferGeometry'
import ControllerMesh from './ControllerMesh'
extend({ CapsuleBufferGeometry })

const You = (props) => {
  const boxRef = props.wooglyRef
  const leftController = useController('left')
  const rightController = useController('right')

  const leftControllerRef = useRef()
  const rightControllerRef = useRef()

  const lowestVolume = useRef(1.0)
  const highestVolume = useRef(0.0001)

  const sphereRefs = useRef([])

  // A set number of points that are calculated initially
  // when the component loads, and then altered every frame
  // based on audio analyser results.
  const fibonacciPoints = useRef(Array(32).fill())

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

  useFrame(({ scene, camera }) => {
    let currVolume

    if (props.outboundAnalyserRef.current) {
      props.outboundAnalyserRef.current.getByteFrequencyData(
        props.analyserLevelsRef.current
      )
      const levels = props.analyserLevelsRef.current
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
        currVolume = Math.sqrt(sum / levels.length)
      }
    }

    lowestVolume.current = Math.min(lowestVolume.current, currVolume)
    highestVolume.current = Math.max(highestVolume.current, currVolume)

    // Update controllers
    if (leftControllerRef.current) {
      leftControllerRef.current.position.copy(
        leftController.controller.position
      )
      leftControllerRef.current.quaternion.copy(
        leftController.controller.quaternion
      )
    }
    if (rightControllerRef.current) {
      rightControllerRef.current.position.copy(
        rightController.controller.position
      )
      rightControllerRef.current.quaternion.copy(
        rightController.controller.quaternion
      )
    }
  })

  return (
    <>
      <group {...props} ref={boxRef} position={[0, 0, 0.01]}>
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
      </group>
      {leftController && <ControllerMesh ref={leftControllerRef} />}
      {rightController && <ControllerMesh ref={rightControllerRef} />}
    </>
  )
}

You.displayName = 'You'

You.propTypes = {
  analyserLevelsRef: PropTypes.shape({ current: PropTypes.object }),
  leftControllerPosRef: PropTypes.shape({ current: PropTypes.object }),
  leftControllerQuatRef: PropTypes.shape({ current: PropTypes.object }),
  rightControllerPosRef: PropTypes.shape({ current: PropTypes.object }),
  rightControllerQuatRef: PropTypes.shape({ current: PropTypes.object }),
  outboundAnalyserRef: PropTypes.shape({ current: PropTypes.object }),
}
export default You
