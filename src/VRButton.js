import 'regenerator-runtime'

class VRButton {
  static createButton(renderer, options) {
    if (options) {
      console.error(
        'THREE.VRButton: The "options" parameter has been removed. Please set the reference space type via renderer.xr.setReferenceSpaceType() instead.'
      )
    }

    const button = document.getElementById('entervr')

    function showEnterVR(/* device */) {
      let currentSession = null

      async function onSessionStarted(session) {
        session.addEventListener('end', onSessionEnded)

        await renderer.xr.setSession(session)
        button.textContent = 'Exit VR'

        currentSession = session
      }

      function onSessionEnded(/* event */) {
        currentSession.removeEventListener('end', onSessionEnded)

        button.textContent = 'Enter VR'

        currentSession = null
      }

      //

      button.style.display = ''

      button.style.cursor = 'pointer'

      button.textContent = 'Enter with VR'

      button.onclick = function () {
        if (currentSession === null) {
          // WebXR's requestReferenceSpace only works if the corresponding feature
          // was requested at session creation time. For simplicity, just ask for
          // the interesting ones as optional features, but be aware that the
          // requestReferenceSpace call will fail if it turns out to be unavailable.
          // ('local' is always available for immersive sessions and doesn't need to
          // be requested separately.)

          const sessionInit = {
            optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
          }
          navigator.xr
            .requestSession('immersive-vr', sessionInit)
            .then(onSessionStarted)
        } else {
          currentSession.end()
        }
      }
    }

    function disableButton() {
      button.style.display = ''

      button.style.cursor = 'auto'

      button.onmouseenter = null
      button.onmouseleave = null
      button.disabled = true
      button.onclick = null
    }

    function showWebXRNotFound() {
      disableButton()

      button.textContent = 'No VR support found'
    }

    if ('xr' in navigator) {
      button.id = 'VRButton'
      button.style.display = 'none'

      navigator.xr
        .isSessionSupported('immersive-vr')
        .then(function (supported) {
          supported ? showEnterVR() : showWebXRNotFound()
        })

      return button
    } else {
      const message = document.createElement('a')

      if (window.isSecureContext === false) {
        message.href = document.location.href.replace(/^http:/, 'https:')
        message.innerHTML = 'WebXR needs HTTPS' // TODO Improve message
      } else {
        message.href = 'https://immersiveweb.dev/'
        message.innerHTML = 'WebXR not supported'
      }

      return message
    }
  }
}

export { VRButton }
