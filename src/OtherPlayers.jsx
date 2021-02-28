import React, { useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useFrame } from 'react-three-fiber'

// import io from 'socket.io-client'
import { SnapshotInterpolation } from '@geckos.io/snapshot-interpolation'

import VolumetricBox from './VolumetricBox'
import Box from './Box'
import ControllerMesh from './ControllerMesh'

const HEIGHT_OFFSET = 1.5
export default function OtherPlayers(props) {
  const socketRef = props.socketRef
  const listenerRef = props.listenerRef

  const SI = useRef(new SnapshotInterpolation(60))
  const boxRefs = useRef([])

  // These are used for the regular, non-volumetrics
  const playerGroupRefs = useRef([])

  // These are purely visual,
  // representing the controllers of other users
  const leftControllersRefs = useRef([])
  const rightControllersRefs = useRef([])

  const clients = props.clients

  useFrame(() => {
    // x y z q are for the camera/head/body
    // *L is left controller, and *R is right controller
    const snapshot = SI.current.calcInterpolation(
      'x y z q(quat) xC yC zC qC(quat) xL yL zL qL(quat) xR yR zR qR(quat)'
    )
    if (snapshot) {
      const { state } = snapshot

      state.forEach((player, index) => {
        // TODO: Ensure a deterministic order and avoid a findIndex
        const match = boxRefs.current.findIndex(
          (b) => b?.client?.id === player.id
        )
        if (match > -1) {
          const box = boxRefs.current[match]
          if (props.volumetric) {
            // In that case, update the shader uniforms
            const uniforms = box.material.uniforms
            // boxRefs.current[match].position.x = player.x
            // boxRefs.current[match].position.y = player.y + 0.0
            // boxRefs.current[match].position.z = player.z
            // boxRefs.current[match].quaternion.copy(player.qC)

            // Woogly
            uniforms.wooglyQuat.value.copy(player.qC)
            uniforms.wooglyPos.value.set(
              player.xC,
              player.yC - HEIGHT_OFFSET,
              player.zC
            )

            // Left controller
            if (player.xL !== undefined) {
              uniforms.leftControllerQuat.value.copy(player.qL)
              uniforms.leftControllerPos.value.x = player.xL
              uniforms.leftControllerPos.value.y = player.yL - HEIGHT_OFFSET
              uniforms.leftControllerPos.value.z = player.zL
            }

            // Right controller
            if (player.xR !== undefined) {
              uniforms.rightControllerQuat.value.copy(player.qR)
              uniforms.rightControllerPos.value.x = player.xR
              uniforms.rightControllerPos.value.y = player.yR - HEIGHT_OFFSET
              uniforms.rightControllerPos.value.z = player.zR
            }

            // Player group (parent of camera and controllers)
            const playerGroup = playerGroupRefs.current[match]
            playerGroup.position.set(player.x, player.y, player.z)
            playerGroup.quaternion.copy(player.q)

            // Lights
            uniforms.lightOne.value.copy(props.lightOneRef.current.position)
            uniforms.lightTwo.value.copy(props.lightTwoRef.current.position)
            uniforms.lightThree.value.copy(props.lightThreeRef.current.position)
            box.worldToLocal(uniforms.lightOne.value)
            box.worldToLocal(uniforms.lightTwo.value)
            box.worldToLocal(uniforms.lightThree.value)
          } else {
            // Update the non-volumetric objects directly
            const lc = leftControllersRefs.current[match]
            if (player.xL === 0 && player.yL === 0 && player.zL === 0) {
              lc.visible = false
            } else {
              lc.visible = true
              lc.position.set(player.xL, player.yL - HEIGHT_OFFSET, player.zL)
              lc.quaternion.copy(player.qL)
            }

            const rc = rightControllersRefs.current[match]
            if (player.xR === 0 && player.yR === 0 && player.zR === 0) {
              rc.visible = false
            } else {
              rc.visible = true
              rc.position.set(player.xR, player.yR - HEIGHT_OFFSET, player.zR)
              rc.quaternion.copy(player.qR)
            }

            // Camera/head group
            // const box = boxRefs.current[match]
            box.position.set(player.xC, player.yC - HEIGHT_OFFSET, player.zC)
            box.quaternion.copy(player.qC)

            // Player group (parent of camera and controllers)
            const playerGroup = playerGroupRefs.current[match]
            playerGroup.position.set(player.x, player.y, player.z)
            playerGroup.quaternion.copy(player.q)
          }
        }
      })
    }
  })

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on('snapshot', (snapshot) => {
        SI.current.snapshot.add(snapshot)
      })
    }

    return () => {
      socketRef.current.removeAllListeners('snapshot')
    }
  }, [socketRef.current])

  return (
    <>
      {clients.map((client, index) =>
        props.volumetric ? (
          <group
            key={index}
            ref={(el) => {
              playerGroupRefs.current[index] = el
            }}
          >
            <VolumetricBox
              ref={(el) => {
                boxRefs.current[index] = el
              }}
              boxRefs={boxRefs}
              listenerRef={listenerRef}
              index={index}
              key={client.id}
              client={client}
              position={clients[index].position}
            />
          </group>
        ) : (
          <React.Fragment key={index}>
            <group
              ref={(el) => {
                playerGroupRefs.current[index] = el
              }}
            >
              <Box
                ref={(el) => {
                  boxRefs.current[index] = el
                }}
                boxRefs={boxRefs}
                listenerRef={listenerRef}
                index={index}
                key={client.id}
                client={client}
                position={clients[index].position}
              />
              <ControllerMesh
                ref={(el) => {
                  leftControllersRefs.current[index] = el
                }}
              />
              <ControllerMesh
                ref={(el) => {
                  rightControllersRefs.current[index] = el
                }}
              />
            </group>
          </React.Fragment>
        )
      )}
    </>
  )
}

OtherPlayers.propTypes = {
  volumetric: PropTypes.bool,
  socketRef: PropTypes.shape({ current: PropTypes.object }),
  lightOneRef: PropTypes.shape({ current: PropTypes.object }),
  lightTwoRef: PropTypes.shape({ current: PropTypes.object }),
  lightThreeRef: PropTypes.shape({ current: PropTypes.object }),
  listenerRef: PropTypes.shape({ current: PropTypes.object }),
  clients: PropTypes.array,
}

OtherPlayers.defaultProps = {
  volumetric: true,
}
