import React, { useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from 'react-three-fiber'
import { useController, useXR } from '@react-three/xr'

import * as THREE from 'three'
import VolumetricYou from './VolumetricYou'
import You from './You'
import PropTypes from 'prop-types'

const Y_OFFSET = 0.5

export default function Player(props) {
  const fly = props.fly
  const socketRef = props.socketRef
  const controlsRef = props.controlsRef
  const playerRef = props.playerRef
  const playerAudioContextRef = props.playerAudioContextRef
  const listenerRef = props.listenerRef
  const outboundGainNodeRef = props.outboundGainNodeRef

  const moveLeftRef = useRef(false)
  const moveRightRef = useRef(false)
  const moveForwardRef = useRef(false)
  const moveBackwardRef = useRef(false)

  const { camera } = useThree()

  const velocityRef = useRef(new THREE.Vector3())
  const directionRef = useRef(new THREE.Vector3())

  const cameraPositionRef = useRef(new THREE.Vector3())
  const cameraDirectionRef = useRef(new THREE.Vector3())

  const canJump = useRef(true)
  const wooglyRef = useRef()
  const cameraRef = useRef()

  const cameraQuat = useRef(new THREE.Quaternion())
  const wooglyQuat = useRef(new THREE.Quaternion())
  const { isPresenting } = useXR()
  const leftController = useController('left')
  const rightController = useController('right')

  // TODO: This is a workaround, pending: https://github.com/mrdoob/three.js/pull/21268
  // Basically all quat uniforms should temporarily be replaced with vec4s
  const leftControllerQuatRef = useRef(new THREE.Quaternion())
  const rightControllerQuatRef = useRef(new THREE.Quaternion())
  const leftControllerPosRef = useRef(new THREE.Vector3())
  const rightControllerPosRef = useRef(new THREE.Vector3())

  const rightControllerThumbstickRef = useRef(new THREE.Vector2())
  const canSnapturn = useRef(true)
  const snapturnRotation = THREE.MathUtils.degToRad(45)

  // TODO: Maybe do this with a hook into session.addEventListener('end')?
  // This is then used to reset things like camera rotation after XR session is done
  const needsXRCleanup = useRef(false)

  useEffect(() => {
    const onKeyDown = function (event) {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          moveForwardRef.current = true
          break

        case 'ArrowLeft':
        case 'KeyA':
          moveLeftRef.current = true
          break

        case 'ArrowDown':
        case 'KeyS':
          moveBackwardRef.current = true
          break

        case 'ArrowRight':
        case 'KeyD':
          moveRightRef.current = true
          break

        case 'Space':
          if (canJump.current === true) velocityRef.current.y = 5
          canJump.current = false
          break
      }
    }

    const onKeyUp = function (event) {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          moveForwardRef.current = false
          break

        case 'ArrowLeft':
        case 'KeyA':
          moveLeftRef.current = false
          break

        case 'ArrowDown':
        case 'KeyS':
          moveBackwardRef.current = false
          break

        case 'ArrowRight':
        case 'KeyD':
          moveRightRef.current = false
          break
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
  }, [])

  useEffect(() => {
    // So that we get the permissions question asap
    navigator.mediaDevices.getUserMedia({ video: false, audio: true })

    // This starts the audio context
    const enterButtons = document.querySelectorAll('.enterbutton')
    enterButtons.forEach((enterButton) =>
      enterButton.addEventListener('click', () => {
        console.log('Adding input/microphone streams')

        navigator.mediaDevices
          .getUserMedia({ video: false, audio: true })
          .then((stream) => {
            const sourceNode = playerAudioContextRef.current.createMediaStreamSource(
              stream
            )
            const gainNode = playerAudioContextRef.current.createGain()
            sourceNode.connect(gainNode)
            gainNode.connect(outboundGainNodeRef.current)
          })
          .catch((e) => {
            console.log(e)
          })
      })
    )

    cameraRef.current.add(listenerRef.current)
  }, [])

  useEffect(() => {
    const enter = document.querySelector('#enter')

    controlsRef.current.addEventListener('lock', () => {
      enter.style.display = 'none'
    })
    controlsRef.current.addEventListener('unlock', () => {
      enter.style.display = null
    })
  }, [controlsRef.current])

  useFrame(({ camera }, delta) => {
    // Potentially cleanup after XR
    if (needsXRCleanup.current && !isPresenting) {
      const euler = new THREE.Euler(0, 0, 0, 'YXZ')
      euler.setFromQuaternion(camera.quaternion)

      euler.z = 0
      euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x))

      cameraRef.current.quaternion.setFromEuler(euler)
      // cameraRef.current.rotation.z = 0
      // (cameraRef.current.rotation)
      // // cameraRef.current.updateProjectionMatrix()
      needsXRCleanup.current = false
    }

    const velocity = velocityRef.current
    const direction = directionRef.current

    // Controls used in flat/ASDF mode
    if (controlsRef.current.isLocked === true) {
      const moveForward = moveForwardRef.current
      const moveBackward = moveBackwardRef.current
      const moveLeft = moveLeftRef.current
      const moveRight = moveRightRef.current

      direction.y = 0
      direction.z = Number(moveBackward) - Number(moveForward)
      direction.x = Number(moveRight) - Number(moveLeft)
      direction.normalize() // this ensures consistent movements in all directions

      // if (moveForward || moveBackward) velocity.z -= direction.z * 100.0 * delta
      // if (moveLeft || moveRight) velocity.x -= direction.x * 100.0 * delta
    }

    // TODO: Generalize, tested only on Q1/2
    if (isPresenting) {
      // Movement is controlled by the left controller thumbstick
      if (leftController) {
        direction.y = 0
        direction.x = leftController?.inputSource?.gamepad?.axes[2]
        direction.z = leftController?.inputSource?.gamepad?.axes[3]
      }

      if (rightController) {
        const x = rightController?.inputSource?.gamepad?.axes[3]
        const y = rightController?.inputSource?.gamepad?.axes[2]
        rightControllerThumbstickRef.current.set(x, y)

        const angle = rightControllerThumbstickRef.current.angle() // Math.atan2(x, y) + Math.PI
        const length = rightControllerThumbstickRef.current.length()

        // Prevent further snapturns until axis returns to (close enough to) 0
        if (length < 0.5 && !canSnapturn.current) canSnapturn.current = true

        if (canSnapturn.current) {
          // Only do snapturns if axis is very prominent (user intent is clear)
          if (length > 0.95) {
            if (Math.abs(angle - Math.PI / 2.0) < 0.6) {
              playerRef.current.rotateY(-snapturnRotation)
              canSnapturn.current = false
            } else if (Math.abs(angle - 1.5 * Math.PI) < 0.6) {
              playerRef.current.rotateY(snapturnRotation)
              canSnapturn.current = false
            }
          }
        }
      }

      // Update the x and z position of the woogly self, so that
      // it moves with the camera/head in VR
      if (wooglyRef.current) {
        wooglyRef.current.position.x = camera.position.x
        wooglyRef.current.position.z = camera.position.z + 0.01
      }

      // Once we're in VR, cleanup is needed when exiting
      needsXRCleanup.current = true
    }

    // Send move events if the player is controlling with keyboard or is in VR
    if (controlsRef.current.isLocked || isPresenting) {
      // Handle moving with direction that's generated by either keypresses or thumbstick axes
      cameraRef.current.getWorldQuaternion(cameraQuat.current)
      direction.applyQuaternion(cameraQuat.current)

      const SPEED = 0.4
      const factor = direction.length()
      if (fly) {
        velocity.copy(direction)
        velocity.multiplyScalar(SPEED * 16.66667)
      } else if (factor > 0) {
        // TODO: What is this, really? Must be a better name for it
        const vector2 = new THREE.Vector2()
        vector2.set(direction.x, direction.z)
        vector2.setLength(factor * SPEED * 16.66667)
        velocity.x = vector2.x
        velocity.z = vector2.y
      } else if (isPresenting) {
        // You want to do a hard stop in VR, not gradually decrease speed
        velocity.x = 0
        velocity.z = 0
      } else {
        // But in flat mode, you can slowly decrease speed for smoothness
        velocity.x -= velocity.x * 10.0 * delta
        velocity.z -= velocity.z * 10.0 * delta
      }

      velocity.y = velocity.y - 9.8 * delta

      if (velocity.z !== 0) {
        playerRef.current.position.z += velocity.z * delta
      }
      if (velocity.x !== 0) {
        playerRef.current.position.x += velocity.x * delta
      }
      if (velocity.y !== 0) {
        playerRef.current.position.y += velocity.y * delta
      }

      // If player is below ground, reset to 0 and re-enable jump
      if (playerRef.current.position.y <= Y_OFFSET) {
        playerRef.current.position.y = Y_OFFSET
        velocity.y = 0
        canJump.current = true
      }

      const leftControllerData = {
        xL: undefined,
        yL: undefined,
        zL: undefined,
        qL: { x: 0, y: 0, z: 0, w: 1 },
      }

      const rightControllerData = {
        xR: undefined,
        yR: undefined,
        zR: undefined,
        qR: { x: 0, y: 0, z: 0, w: 1 },
      }

      // TODO: Generalize. Optimize. :song:
      if (isPresenting) {
        if (leftController) {
          // We do this here (and not only in You.jsx) as we need to use it for
          // our local avatar and to send it across the wire.
          leftControllerQuatRef.current.copy(
            leftController.controller.quaternion
          )
          // The shader needs the inverse of the quat for the controller rotation,
          // so why not do it here
          leftControllerQuatRef.current.invert()
          leftControllerPosRef.current.copy(leftController.controller.position)

          leftControllerData.xL = leftController.controller.position.x
          leftControllerData.yL = leftController.controller.position.y
          leftControllerData.zL = leftController.controller.position.z
          leftControllerData.qL.x = leftController.controller.quaternion.x
          leftControllerData.qL.y = leftController.controller.quaternion.y
          leftControllerData.qL.z = leftController.controller.quaternion.z
          leftControllerData.qL.w = leftController.controller.quaternion.w
        }
        if (rightController) {
          rightControllerQuatRef.current.copy(
            rightController.controller.quaternion
          )
          // The shader needs the inverse of the quat for the controller rotation,
          // so why not do it here
          rightControllerQuatRef.current.invert()
          rightControllerPosRef.current.copy(
            rightController.controller.position
          )

          rightControllerData.xR = rightController.controller.position.x
          rightControllerData.yR = rightController.controller.position.y
          rightControllerData.zR = rightController.controller.position.z
          rightControllerData.qR.x = rightController.controller.quaternion.x
          rightControllerData.qR.y = rightController.controller.quaternion.y
          rightControllerData.qR.z = rightController.controller.quaternion.z
          rightControllerData.qR.w = rightController.controller.quaternion.w
        }
      }

      // TODO: Temp. Improve this. It's too jittery at extremes.
      const cameraPosition = cameraPositionRef.current
      const cameraDirection = cameraDirectionRef.current
      const boxTargetOffset = 3.0

      cameraRef.current.getWorldPosition(cameraPosition)
      cameraRef.current.getWorldDirection(cameraDirection) // this is a unit vector

      wooglyRef.current.lookAt(
        cameraPosition.add(cameraDirection.multiplyScalar(boxTargetOffset))
      )

      wooglyRef.current.getWorldQuaternion(wooglyQuat.current)

      socketRef.current.emit('move', {
        x: playerRef.current.position.x,
        y: playerRef.current.position.y,
        z: playerRef.current.position.z,
        q: {
          x: playerRef.current.quaternion.x,
          y: playerRef.current.quaternion.y,
          z: playerRef.current.quaternion.z,
          w: playerRef.current.quaternion.w,
        },
        // This is the position of the 'camera'
        xC: cameraRef.current.position.x,
        yC: cameraRef.current.position.y,
        zC: cameraRef.current.position.z,
        // But this is the rotation of the 'woogly'
        // Since it's different, an adapted direction
        // based on the camera looking x units forward.
        qC: {
          x: wooglyRef.current.quaternion.x,
          y: wooglyRef.current.quaternion.y,
          z: wooglyRef.current.quaternion.z,
          w: wooglyRef.current.quaternion.w,
        },
        ...leftControllerData,
        ...rightControllerData,
      })
    }
  })

  return (
    <group ref={playerRef} position={[0, Y_OFFSET, 0]}>
      <primitive
        object={camera}
        ref={cameraRef}
        position={[0, 2, 0]}
        near={0.1}
        far={200.0}
      />
      {props.volumetric ? (
        <VolumetricYou
          position={[0, 0.0, 0]}
          analyserLevelsRef={props.analyserLevelsRef}
          wooglyRef={wooglyRef}
          outboundAnalyserRef={props.outboundAnalyserRef}
          leftControllerQuatRef={leftControllerQuatRef}
          leftControllerPosRef={leftControllerPosRef}
          rightControllerQuatRef={rightControllerQuatRef}
          rightControllerPosRef={rightControllerPosRef}
          lightOneRef={props.lightOneRef}
          lightTwoRef={props.lightTwoRef}
          lightThreeRef={props.lightThreeRef}
        />
      ) : (
        <You
          position={[0, 0.0, 0]}
          analyserLevelsRef={props.analyserLevelsRef}
          wooglyRef={wooglyRef}
          outboundAnalyserRef={props.outboundAnalyserRef}
          leftControllerQuatRef={leftControllerQuatRef}
          leftControllerPosRef={leftControllerPosRef}
          rightControllerQuatRef={rightControllerQuatRef}
          rightControllerPosRef={rightControllerPosRef}
        />
      )}
    </group>
  )
}

Player.propTypes = {
  volumetric: PropTypes.bool,
  playerRef: PropTypes.shape({ current: PropTypes.object }),
  playerAudioRef: PropTypes.shape({ current: PropTypes.object }),
  playerStreamRef: PropTypes.shape({ current: PropTypes.object }),
  socketRef: PropTypes.shape({ current: PropTypes.object }),
  controlsRef: PropTypes.shape({ current: PropTypes.object }),
  fly: PropTypes.bool,
  // A reference to the listener - this is used in OtherPlayers and here
  listenerRef: PropTypes.shape({ current: PropTypes.object }),
  playerAudioContextRef: PropTypes.shape({ current: PropTypes.object }),
}

Player.defaultProps = {
  volumetric: true,
}
