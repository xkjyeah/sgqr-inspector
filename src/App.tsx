import React, { useCallback, useState, useRef } from 'react'
import './App.css'
import jsQR from 'jsqr'
import { UNKNOWN, ParseError, parseData, EMVCoMPMContext } from './EMVCoMPMContext'
import type { Interpretation, ParseResult } from './EMVCoMPMContext'
import { createPortal } from 'react-dom'

function renderDescription(s: string | typeof UNKNOWN): React.ReactNode {
  if (typeof s === 'string') {
    return s
  } else {
    return <em>Unknown</em>
  }
}

function renderInterpretation(s: Interpretation | null) {
  if (typeof s === 'string') {
    return s
  } else if (s === null) {
    return null
  } else if (s === UNKNOWN) {
    return <em>Unknown</em>
  } else {
    return renderParseResult(s)
  }
}

function EMVCoInterpretation(props: { data: string }) {
  const parseResult = parseData(EMVCoMPMContext, props.data)

  return renderParseResult(parseResult)
}

function renderParseResult(parseResult: ParseResult) {
  return <table>
    <thead>
      <tr><th colSpan={3}>{parseResult.context.name}</th></tr>
    </thead>
    {parseResult.elements.map((elem, index) => {
      if (elem instanceof ParseError) {
        return (<tr key={index}><td colSpan={3}>{elem.message}</td></tr>)
      } else {
        return (<>
          <tr key={index} className="group-start">
            <td>{elem.elementID}</td>
            <td>{renderDescription(elem.description)}</td>
            <td>
              <RawValue value={elem.rawValue}></RawValue>
            </td>
          </tr>
          {elem.interpretation && <tr>
            <td></td>
            <td colSpan={2}>
              {renderInterpretation(elem.interpretation)}
            </td>
          </tr>}
        </>)
      }
    })}
  </table>
}

function RawValue(props: { value: string }) {
  return <div style={{
    width: '100%',
    whiteSpace: 'normal',
    maxWidth: '100%',
    maxHeight: '300px',
    overflow: 'hidden',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    textAlign: 'left',
    border: 'solid 1px black',
  }}>
    {props.value}
  </div>
}


function RenderData(props: { data: string | null }) {
  if (props.data === null) {
    return null;
  }

  return <>
    <div style={{ textAlign: 'left' }}>
      Captured data:
    </div>
    <RawValue value={props.data}></RawValue>
    <EMVCoInterpretation data={props.data} />
  </>
}

function App() {
  const video = useRef<HTMLVideoElement | null>(null);
  // const [image, setImage] = useState(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isCapturing, setIsCapturing] = useState(false);
  const [data, setData] = useState<string | null>('propertyvaluescanbespecifiedasasinglekeywordchosenfromthelist')

  const stopCapture = useCallback(() => {
    if (video.current) {
      video.current.srcObject = null
      video.current.pause()
      video.current = null
    }
    setIsCapturing(false)
  }, [])

  const tick = useCallback(() => {
    const ve = video.current

    if (!ve) return
    if (!canvasRef.current) return

    if (ve.readyState === ve.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current.getContext('2d')

      if (!canvas) return
      // loadingMessage.hidden = true;
      // canvasElement.hidden = false;
      // outputContainer.hidden = false;

      // canvasRef.current.height = video.videoHeight;
      // canvasRef.current.width = video.videoWidth;
      canvas.drawImage(ve, 0, 0, canvasRef.current.width, canvasRef.current.height);
      const imageData = canvas.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      if (code) {
        setData(code.data)
        stopCapture()
        //   drawLine(code.location.topLeftCorner, code.location.topRightCorner, "#FF3B58");
        // drawLine(code.location.topRightCorner, code.location.bottomRightCorner, "#FF3B58");
        // drawLine(code.location.bottomRightCorner, code.location.bottomLeftCorner, "#FF3B58");
        // drawLine(code.location.bottomLeftCorner, code.location.topLeftCorner, "#FF3B58");
        // outputMessage.hidden = true;
        // outputData.parentElement.hidden = false;
        // outputData.innerText = code.data;
      }
    }
    requestAnimationFrame(tick);
  }, [stopCapture])

  const captureQR = useCallback(() => {
    if (!video.current) {
      const newVideo = document.createElement("video")

      // Use facingMode: environment to attempt to get the front camera on phones
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then(function (stream) {
          newVideo.srcObject = stream;
          newVideo.setAttribute("playsinline", 'true'); // required to tell iOS safari we don't want fullscreen
          newVideo.play();
          requestAnimationFrame(tick);
        });

      video.current = newVideo
    }
    setIsCapturing(true)
  }, [tick])

  return (
    <>
      {!isCapturing && <button onClick={captureQR}>Capture QR</button>}
      {isCapturing && <button onClick={stopCapture}>Stop Capture</button>}
      <PopupSpace style={{ display: isCapturing ? undefined : 'none', textAlign: 'center' }}>
        <button onClick={stopCapture}>Stop Capture</button>
        <canvas ref={canvasRef} width="500" height="500" style={{ height: 'auto', width: '100%', display: isCapturing ? 'block' : 'none' }}></canvas>
      </PopupSpace>
      <RenderData data={data} />
    </>
  )
}


function PopupSpace(props: { children: Array<React.ReactNode>, style: Record<string, string | number | null | undefined> }) {
  return createPortal(
    <div className="canvas-portal" style={props.style}>
      {props.children}
    </div>,
    document.body
  )
}

export default App
