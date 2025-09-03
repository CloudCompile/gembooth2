/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {useRef, useState, useCallback, useEffect} from 'react'
import c from 'clsx'
import {
  snapPhoto,
  setMode,
  deletePhoto,
  makeGif,
  hideGif,
  setCustomPrompt
} from '../lib/actions'
import useStore from '../lib/store'
import imageData from '../lib/imageData'
import modes from '../lib/modes'

const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
const modeKeys = Object.keys(modes)

export default function App() {
  const photos = useStore.use.photos()
  const customPrompt = useStore.use.customPrompt()
  const activeMode = useStore.use.activeMode()
  const gifInProgress = useStore.use.gifInProgress()
  const gifUrl = useStore.use.gifUrl()
  const [videoActive, setVideoActive] = useState(false)
  const [didInitVideo, setDidInitVideo] = useState(false)
  const [focusedId, setFocusedId] = useState(null)
  const [didJustSnap, setDidJustSnap] = useState(false)
  const [hoveredMode, setHoveredMode] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({top: 0, left: 0})
  const [showCustomPrompt, setShowCustomPrompt] = useState(false)
  const videoRef = useRef(null)
  const modeSelectorRef = useRef(null)
  const [indicatorStyle, setIndicatorStyle] = useState({})

  useEffect(() => {
    if (!modeSelectorRef.current || !videoActive) return

    const activeNode = modeSelectorRef.current.querySelector('button.active')
    if (activeNode) {
      setIndicatorStyle({
        left: activeNode.parentElement.offsetLeft,
        width: activeNode.parentElement.offsetWidth
      })
    }
  }, [activeMode, videoActive])

  const startVideo = async () => {
    setDidInitVideo(true)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {width: {ideal: 1920}, height: {ideal: 1080}},
      audio: false,
      facingMode: {ideal: 'user'}
    })
    setVideoActive(true)
    videoRef.current.srcObject = stream

    const {width, height} = stream.getVideoTracks()[0].getSettings()
    const squareSize = Math.min(width, height)
    canvas.width = squareSize
    canvas.height = squareSize
  }

  const takePhoto = () => {
    const video = videoRef.current
    const {videoWidth, videoHeight} = video
    const squareSize = canvas.width
    const sourceSize = Math.min(videoWidth, videoHeight)
    const sourceX = (videoWidth - sourceSize) / 2
    const sourceY = (videoHeight - sourceSize) / 2

    ctx.clearRect(0, 0, squareSize, squareSize)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(
      video,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      -squareSize,
      0,
      squareSize,
      squareSize
    )
    snapPhoto(canvas.toDataURL('image/jpeg'))
    setDidJustSnap(true)
    setTimeout(() => setDidJustSnap(false), 1000)
  }

  const downloadGif = () => {
    const a = document.createElement('a')
    a.href = gifUrl
    a.download = 'gembooth.gif'
    a.click()
  }

  const downloadPhoto = id => {
    const a = document.createElement('a')
    a.href = imageData.outputs[id]
    a.download = 'gembooth.png'
    a.click()
  }

  const handleShare = async (dataUrl, fileName) => {
    if (!navigator.share) {
      alert('Web Share is not supported in your browser.')
      return
    }
    try {
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const file = new File([blob], fileName, {type: blob.type})
      if (navigator.canShare && navigator.canShare({files: [file]})) {
        await navigator.share({
          title: 'GemBooth Creation',
          text: 'Check out this photo I made!',
          files: [file]
        })
      } else {
        alert('Sharing files is not supported.')
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Sharing failed:', error)
      }
    }
  }

  const handleModeHover = useCallback((modeInfo, event) => {
    if (!modeInfo) {
      setHoveredMode(null)
      return
    }

    setHoveredMode(modeInfo)

    const rect = event.currentTarget.getBoundingClientRect()
    const tooltipTop = rect.top
    const tooltipLeft = rect.left + rect.width / 2

    setTooltipPosition({
      top: tooltipTop,
      left: tooltipLeft
    })
  }, [])

  const handleSetMode = mode => {
    setMode(mode)
    if (mode === 'custom') {
      setShowCustomPrompt(true)
    }
  }

  return (
    <main>
      <div
        className="video"
        onClick={() => (gifUrl ? hideGif() : setFocusedId(null))}
      >
        {showCustomPrompt && (
          <div className="customPrompt">
            <button
              className="circleBtn"
              onClick={() => {
                setShowCustomPrompt(false)

                if (customPrompt.trim().length === 0) {
                  setMode(modeKeys[0])
                }
              }}
            >
              <span className="icon">close</span>
            </button>
            <textarea
              type="text"
              placeholder="Enter a custom prompt"
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setShowCustomPrompt(false)
                }
              }}
            />
          </div>
        )}
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          disablePictureInPicture="true"
        />
        {didJustSnap && <div className="flash" />}
        {!videoActive && (
          <button className="startButton" onClick={startVideo}>
            <h1>📸 GemBooth</h1>
            <p>{didInitVideo ? 'One sec…' : 'Tap anywhere to start webcam'}</p>
          </button>
        )}

        {videoActive && (
          <div className="videoControls">
            <button onClick={takePhoto} className="shutter">
              <span className="icon">camera</span>
            </button>

            <ul className="modeSelector" ref={modeSelectorRef}>
              <li className="indicator" style={indicatorStyle} />
              <li
                key="custom"
                onMouseEnter={e =>
                  handleModeHover({key: 'custom', prompt: customPrompt}, e)
                }
                onMouseLeave={() => handleModeHover(null)}
              >
                <button
                  className={c({active: activeMode === 'custom'})}
                  onClick={() => handleSetMode('custom')}
                >
                  <span>✏️</span> <p>Custom</p>
                </button>
              </li>
              <li
                key="random"
                onMouseEnter={e =>
                  handleModeHover(
                    {key: 'random', prompt: 'Apply a random effect!'},
                    e
                  )
                }
                onMouseLeave={() => handleModeHover(null)}
              >
                <button
                  className={c({active: activeMode === 'random'})}
                  onClick={() => handleSetMode('random')}
                >
                  <span>🎲</span> <p>Random</p>
                </button>
              </li>
              {Object.entries(modes).map(([key, {name, emoji, prompt}]) => (
                <li
                  key={key}
                  onMouseEnter={e => handleModeHover({key, prompt}, e)}
                  onMouseLeave={() => handleModeHover(null)}
                >
                  <button
                    onClick={() => handleSetMode(key)}
                    className={c({active: key === activeMode})}
                  >
                    <span>{emoji}</span> <p>{name}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(focusedId || gifUrl) && (
          <div className="focusedPhoto" onClick={e => e.stopPropagation()}>
            <button
              className="circleBtn"
              onClick={() => (gifUrl ? hideGif() : setFocusedId(null))}
            >
              <span className="icon">close</span>
            </button>
            <img
              src={gifUrl || imageData.outputs[focusedId]}
              alt="photo"
              draggable={false}
            />
            <div className="photoActions">
              {gifUrl ? (
                <>
                  <button className="button" onClick={downloadGif}>
                    Download GIF
                  </button>
                  <button
                    className={c('button', 'shareButton')}
                    onClick={() => handleShare(gifUrl, 'gembooth.gif')}
                  >
                    Share
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="button"
                    onClick={() => downloadPhoto(focusedId)}
                  >
                    Download Photo
                  </button>
                  <button
                    className={c('button', 'shareButton')}
                    onClick={() =>
                      handleShare(
                        imageData.outputs[focusedId],
                        'gembooth.png'
                      )
                    }
                  >
                    Share
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="results">
        <ul>
          {photos.length
            ? photos.map(({id, mode, isBusy}) => (
                <li className={c({isBusy})} key={id}>
                  {isBusy && (
                    <div className="loader">
                      <svg className="loader-svg" viewBox="25 25 50 50">
                        <circle
                          className="loader-path"
                          cx="50"
                          cy="50"
                          r="20"
                          fill="none"
                        />
                      </svg>
                    </div>
                  )}
                  <button
                    className="circleBtn deleteBtn"
                    onClick={() => {
                      deletePhoto(id)
                      if (focusedId === id) {
                        setFocusedId(null)
                      }
                    }}
                  >
                    <span className="icon">delete</span>
                  </button>
                  <button
                    className="photo"
                    onClick={() => {
                      if (!isBusy) {
                        setFocusedId(id)
                        hideGif()
                      }
                    }}
                  >
                    <img
                      src={
                        isBusy ? imageData.inputs[id] : imageData.outputs[id]
                      }
                      draggable={false}
                    />
                    <p className="emoji">
                      {mode === 'custom' ? '✏️' : modes[mode].emoji}
                    </p>
                  </button>
                </li>
              ))
            : videoActive && (
                <li className="empty" key="empty">
                  <p>
                    👉 <span className="icon">camera</span>
                  </p>
                  Snap a photo to get started.
                </li>
              )}
        </ul>
        {photos.filter(p => !p.isBusy).length > 1 && (
          <button
            className="button makeGif"
            onClick={makeGif}
            disabled={gifInProgress}
          >
            {gifInProgress ? 'One sec…' : 'Make GIF!'}
          </button>
        )}
      </div>

      {hoveredMode && (
        <div
          className={c('tooltip', {isFirst: hoveredMode.key === 'custom'})}
          role="tooltip"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: 'translateX(-50%)'
          }}
        >
          {hoveredMode.key === 'custom' && !hoveredMode.prompt.length ? (
            <p>Click to set a custom prompt</p>
          ) : hoveredMode.key === 'random' ? (
            <p>{hoveredMode.prompt}</p>
          ) : (
            <>
              <p>"{hoveredMode.prompt}"</p>
              <h4>Prompt</h4>
            </>
          )}
        </div>
      )}
    </main>
  )
}