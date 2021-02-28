import React, { useRef, useState } from 'react'
import { VRCanvas } from '@react-three/xr'
import Space from './Space'
import { VRButton } from './VRButton'

export default function App() {
  const spaceName = useRef()
  const nickname = useRef()

  const [volumetricSelf, setVolumetricSelf] = useState(false)
  const [volumetricOther, setVolumetricOther] = useState(false)
  return (
    <VRCanvas
      onCreated={({ gl }) => {
        VRButton.createButton(gl)

        // This is maybe a good enough place for now
        // to manage all the enter button, room name etc,
        // and other non-React code

        // Handle space name
        const spacenameInput = document.getElementById('spacename')
        if (window.location.pathname !== '/') {
          spacenameInput.value = window.location.pathname.slice(1)
          spaceName.current = spacenameInput.value
        }

        spacenameInput.addEventListener('change', () => {
          spaceName.current = spacenameInput.value
        })

        // Handle nickname
        const nicknameInput = document.getElementById('nickname')
        nicknameInput.addEventListener('change', () => {
          nickname.current = nicknameInput.value
        })

        // Volumetric options
        const volumetricSelfInput = document.getElementById('volumetricself')
        volumetricSelfInput.addEventListener('change', () => {
          setVolumetricSelf(volumetricSelfInput.checked)
        })
        const volumetricOtherInput = document.getElementById('volumetricother')

        volumetricOtherInput.addEventListener('change', () => {
          setVolumetricOther(volumetricOtherInput.checked)
        })

        // TODO: Both Enter (flat + VR) buttons need this
        document.querySelector('.enterbutton').addEventListener('click', () => {
          // Disable certain options after client already joined
          // TODO: Make all of this dynamic.
          document.getElementById('options').style.display = 'block'
          document.getElementById('hi').style.display = 'none'
          document.getElementById('volumetricother').disabled = true
          document.getElementById('nickname').disabled = true
          document.getElementById('spacename').disabled = true
        })
      }}
      style={{ background: '#000000' }}
      gl={{ antialias: true }}
    >
      <Space
        spaceNameRef={spaceName}
        nicknameRef={nickname}
        volumetricSelf={volumetricSelf}
        volumetricOther={volumetricOther}
      />
    </VRCanvas>
  )
}
