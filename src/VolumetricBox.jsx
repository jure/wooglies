import React, { useRef, useEffect } from 'react'
import { useFrame } from 'react-three-fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import VolumetricMaterial from './VolumetricMaterial'
import { PositionalAudioHelper } from 'three/examples/jsm/helpers/PositionalAudioHelper.js'

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

  const fakeLookAtGroupRef = useRef()
  const lookAtMarkerRef = useRef()
  const lookAtMarkerWorldPos = useRef(new THREE.Vector3())

  const textRef = useRef()
  const textRefWorldPos = useRef(new THREE.Vector3())

  useEffect(() => {
    if (props.client.peer) {
      props.client.peer.on('stream', (stream) => {
        const audio = document.createElement('audio')
        audio.srcObject = stream
        audio.autoplay = true
        audio.playsinline = true

        positionalAudioRef.current.setMediaStreamSource(audio.srcObject)
        const audioContext = positionalAudioRef.current.context
        analyserRef.current = audioContext.createAnalyser()
        analyserRef.current.fftSize = 64
        analyserRef.current.smoothingTimeConstant = 0.85
        analyserLevelsRef.current = new Uint8Array(32)
        positionalAudioRef.current.source.connect(analyserRef.current)

        audio.muted = true

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
    if (!materialRef.current) {
      return
    }
    // Every frame the camera position inside the shader has to be updated
    if (materialRef && materialRef.current) {
      materialRef.current.uniforms.localCameraPos.value.setFromMatrixPosition(
        camera.matrixWorld
      )

      materialRef.current.uniforms.iTime.value =
        (performance.now() - startTime.current) / 1000.0

      materialRef.current.uniforms.iFrame.value += 1

      // Get audio levels
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(analyserLevelsRef.current)
        const levels = analyserLevelsRef.current
        let sum = 0
        for (let i = 0; i < levels.length; i++) {
          const amplitude = levels[i] / 255

          materialRef.current.uniforms.frequencies.value[i] = amplitude
          sum += amplitude * amplitude
        }
        const currVolume = Math.sqrt(sum / levels.length)
        materialRef.current.uniforms.audioModifier.value = currVolume
      }

      // TODO: Unify with You.jsx
      // Get world direction without updating world matrix
      // https://github.com/mrdoob/three.js/blob/dev/src/cameras/Camera.js#L46
      const e = camera.matrixWorld.elements
      materialRef.current.uniforms.worldDirection.value
        .set(-e[8], -e[9], -e[10])
        .normalize()
      materialRef.current.uniforms.zFar.value = camera.far
      materialRef.current.uniforms.zNear.value = camera.near
    }

    // TODO: Just check if we have the right object, this
    // is weird. What's the fix?
    const boxRef = props.boxRefs.current[props.index]
    if (boxRef && boxRef.updateMatrixWorld) {
      boxRef.updateMatrixWorld()
      boxRef.worldToLocal(materialRef.current.uniforms.localCameraPos.value)

      // TODO: Figure out a different way to address object rotation
      objectQuat.current.copy(boxRef.quaternion)
    }

    if (textRef.current) {
      // First apply the woogly rotation to the marker for look at
      fakeLookAtGroupRef.current.quaternion.copy(
        materialRef.current.uniforms.wooglyQuat.value
      )
      lookAtMarkerRef.current.getWorldPosition(lookAtMarkerWorldPos.current)
      textRef.current.getWorldPosition(textRefWorldPos.current)
      lookAtMarkerWorldPos.current.y = textRefWorldPos.current.y
      textRef.current.lookAt(lookAtMarkerWorldPos.current)
    }
    if (positionalAudioRef.current) {
      positionalAudioRef.current.quaternion.copy(
        materialRef.current.uniforms.wooglyQuat.value
      )
    }
  })

  // The mesh and the boxBufferGeom are the player group (x,y,z,q)
  // Things inside volumetricMaterial are the camera/controller groups (*C,*L,*R)
  return (
    <>
      <mesh {...props} ref={ref}>
        <boxBufferGeometry args={[2, 3, 2]} />
        <primitive
          object={new VolumetricMaterial()}
          attach="material"
          ref={materialRef}
          transparent
        />
        <positionalAudio
          visible={false}
          args={[listenerRef.current]}
          ref={positionalAudioRef}
        />
        {/* Set up this emulated way because the head/woogly rotation happens
        inside of the shader, and not in the Object3D world */}
        <group ref={fakeLookAtGroupRef}>
          <mesh ref={lookAtMarkerRef} position={[0, 0, 1]} />
        </group>
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
