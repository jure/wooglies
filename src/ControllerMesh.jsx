import React from 'react'
import { extend } from 'react-three-fiber'

// new THREE.CapsuleBufferGeometry(
//   capsuleControls.radiusTop,
//   capsuleControls.radiusBottom,
//   capsuleControls.height,
//   capsuleControls.radialSegments,
//   capsuleControls.heightSegments,
//   capsuleControls.capsTopSegments,
//   capsuleControls.capsBottomSegments,
//   capsuleControls.thetaStart,
//   capsuleControls.thetaLength
// )
import CapsuleBufferGeometry from './CapsuleBufferGeometry'
extend({ CapsuleBufferGeometry })

const ControllerMesh = React.forwardRef((props, ref) => {
  return (
    <group ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleBufferGeometry
          args={[0.05, 0.1, 0.15, 10, 10, 10, 10, 0, 2 * Math.PI]}
        />
        <meshStandardMaterial color={'gray'} />
      </mesh>
    </group>
  )
})

ControllerMesh.displayName = 'ControllerMesh'

export default ControllerMesh
