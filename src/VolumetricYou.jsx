import React, { useRef } from 'react'
import { useFrame } from 'react-three-fiber'
import { useController, useXR } from '@react-three/xr'
import PropTypes from 'prop-types'
import VolumetricMaterial from './VolumetricMaterial'

const You = (props) => {
  const fakeWooglyRef = props.wooglyRef
  const wooglyRef = useRef()
  const materialRef = useRef()
  const startTime = useRef(performance.now())
  const { isPresenting } = useXR()
  const leftController = useController('left')
  const rightController = useController('right')
  const lowestVolume = useRef(1.0)
  const highestVolume = useRef(0.0001)

  useFrame(({ scene, camera }) => {
    // Can't do anything without the materialRef
    if (!materialRef.current) {
      return
    }
    // Every frame the camera position inside the shader has to be updated
    const uniforms = materialRef.current.uniforms

    if (materialRef && materialRef.current) {
      uniforms.localCameraPos.value.setFromMatrixPosition(camera.matrixWorld)

      uniforms.iTime.value = (performance.now() - startTime.current) / 1000.0

      uniforms.iFrame.value += 1

      // TODO: Generalize for other devices. Tested with Quest 1/2.
      // Check if we're in XR and have controllers, we need to pass positions
      if (isPresenting) {
        // Left
        if (leftController) {
          uniforms.leftControllerPos.value.copy(
            leftController.controller.position
          )
          uniforms.leftControllerQuat.value.copy(
            leftController.controller.quaternion
          )
        }
        // Right
        if (rightController) {
          uniforms.rightControllerPos.value.copy(
            rightController.controller.position
          )
          uniforms.rightControllerQuat.value.copy(
            rightController.controller.quaternion
          )
        }
      }
    }

    if (wooglyRef && wooglyRef.current) {
      wooglyRef.current.updateMatrixWorld(true)
      wooglyRef.current.worldToLocal(
        materialRef.current.uniforms.localCameraPos.value
      )
      uniforms.wooglyQuat.value.copy(fakeWooglyRef.current.quaternion)
    }

    // TODO: Exactly Same stuff as in Box.jsx
    if (props.outboundAnalyserRef.current) {
      props.outboundAnalyserRef.current.getByteFrequencyData(
        props.analyserLevelsRef.current
      )
      const levels = props.analyserLevelsRef.current
      let sum = 0
      for (let i = 0; i < levels.length; i++) {
        const amplitude = levels[i] / 255

        materialRef.current.uniforms.frequencies.value[i] = amplitude
        sum += amplitude * amplitude
      }
      const currVolume = Math.sqrt(sum / levels.length)

      lowestVolume.current = Math.min(lowestVolume.current, currVolume)
      highestVolume.current = Math.max(highestVolume.current, currVolume)

      materialRef.current.uniforms.audioModifier.value =
        (currVolume - lowestVolume.current) /
        (highestVolume.current - lowestVolume.current)
    }

    // TODO: Unify with Box.jsx
    // Get world direction without updating world matrix
    // https://github.com/mrdoob/three.js/blob/dev/src/cameras/Camera.js#L46
    const e = camera.matrixWorld.elements
    materialRef.current.uniforms.worldDirection.value
      .set(-e[8], -e[9], -e[10])
      .normalize()
    materialRef.current.uniforms.zFar.value = camera.far
    materialRef.current.uniforms.zNear.value = camera.near

    uniforms.lightOne.value.copy(props.lightOneRef.current.position)
    uniforms.lightTwo.value.copy(props.lightTwoRef.current.position)
    uniforms.lightThree.value.copy(props.lightThreeRef.current.position)
    wooglyRef.current.worldToLocal(uniforms.lightOne.value)
    wooglyRef.current.worldToLocal(uniforms.lightTwo.value)
    wooglyRef.current.worldToLocal(uniforms.lightThree.value)
  })

  return (
    <>
      <mesh ref={fakeWooglyRef} />
      <mesh {...props} ref={wooglyRef}>
        <boxBufferGeometry args={[2, 1, 2]} />
        <primitive
          object={new VolumetricMaterial()}
          attach="material"
          ref={materialRef}
          transparent
        />
      </mesh>
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
  lightOneRef: PropTypes.shape({ current: PropTypes.object }),
  lightTwoRef: PropTypes.shape({ current: PropTypes.object }),
  lightThreeRef: PropTypes.shape({ current: PropTypes.object }),
  wooglyRef: PropTypes.shape({ current: PropTypes.object }),
}
export default You
