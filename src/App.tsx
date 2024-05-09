import React, { useCallback, useState, useRef } from 'react'
import './App.css'
import jsQR from 'jsqr'

type KnownElement = {
  description: string,
  interpreter?: ((value: string) => string)
}

type InterpretationContext = {
  name: string,
  knownElements: Record<string, KnownElement>
}

const EMVCoMPMContext: InterpretationContext = {
  name: 'EMVCo Merchant Presented QR Code',
  knownElements: {
    '00': {
      description: 'Payload format indicator'
    },
    '01': {
      description: 'Point of initiation'
    },
    '26': {
      description: 'Merchant account information'
    },
    '52': {
      description: 'Merchant category code'
    },
    '53': {
      description: 'Transaction currency'
    },
    '58': {
      description: 'Country code'
    },
    '59': {
      description: 'Merchant name'
    },
    '60': {
      description: 'Merchant city'
    },
    '63': {
      description: 'CRC'
    },
  }
}


const UNKNOWN: unique symbol = Symbol()

type ParsedElement = {
  elementID: string,
  length: number,
  rawValue: string,
  interpretation: string | ParseResult | null,
  description: string | typeof UNKNOWN,
}
type ParseResult = {
  context: InterpretationContext,
  elements: Array<ParsedElement | ParseError>
}

class ParseError extends Error { }
class InvalidLengthError extends ParseError {
  lengthRequested: number
  lengthAvailable: number
  constructor(lengthRequested: number, lengthAvailable: number) {
    super(`A length of ${lengthRequested} was requested, but only ${lengthAvailable} chars are left in the payload`)
    this.lengthRequested = lengthRequested
    this.lengthAvailable = lengthAvailable
  }
}
class InvalidElementError extends ParseError {
  element: string
  constructor(element: string) {
    super(`An invalid element+length indicator of ${element} was encountered`)
    this.element = element
  }
}

const parseData = (context: InterpretationContext, data: string): ParseResult => {
  let index = 0
  const elements: Array<ParseError | ParsedElement> = []

  while (index < data.length) {
    const elementAndLength = data.substring(index, index + 4)

    index += 4

    if (elementAndLength.length < 4) {
      elements.push(new InvalidElementError(elementAndLength))
      break;
    }

    const elementID = elementAndLength.substring(0, 2)
    const lengthString = elementAndLength.substring(2, 4)
    if (!lengthString.match(/[0-9]{2}/)) {
      elements.push(new InvalidElementError(elementAndLength))
      break;
    }

    const length = parseInt(lengthString)
    const value = data.substring(index, index + length)

    index += length

    if (value.length < length) {
      elements.push(new InvalidLengthError(length, value.length))
      break;
    }

    if (elementID in context.knownElements) {
      elements.push({
        elementID,
        length,
        description: context.knownElements[elementID].description,
        rawValue: value,
        interpretation: context.knownElements[elementID].interpreter?.(value) || null,
      })
    } else {
      elements.push({
        elementID,
        length,
        description: UNKNOWN,
        rawValue: value,
        interpretation: null,
      })
    }
  }

  return {
    context,
    elements,
  }
}

function renderDescription(s: string | typeof UNKNOWN): React.ReactNode {
  if (typeof s === 'string') {
    return s
  } else {
    return <em>Unknown</em>
  }
}

function EMVCoInterpretation(props: { data: string }) {
  const parsedData = parseData(EMVCoMPMContext, props.data)

  return <table>
    <thead>
      <tr><th colSpan={3}>{parsedData.context.name}</th></tr>
    </thead>
    {parsedData.elements.map((elem, index) => {
      if (elem instanceof ParseError) {
        return (<tr key={index}><td colSpan={3}>{elem.message}</td></tr>)
      } else {
        return (<tr key={index}><td>{elem.elementID}</td>
          <td>{renderDescription(elem.description)}</td>
          <td>
            <RawValue value={elem.rawValue}></RawValue>

            {typeof elem.interpretation === 'string' && elem.interpretation}
          </td></tr>)
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
  }, [])

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

  const stopCapture = useCallback(() => {
    if (video.current) {
      video.current.srcObject = null
      video.current.pause()
      video.current = null
    }
    setIsCapturing(false)
  }, [])

  return (
    <>
      {!isCapturing && <button onClick={captureQR}>Capture QR</button>}
      {isCapturing && <button onClick={stopCapture}>Stop Capture</button>}
      <canvas ref={canvasRef} width="500" height="500" style={{ height: '100px', width: '100px', display: isCapturing ? 'block' : 'none' }}></canvas>
      <RenderData data={data} />
    </>
  )
}

export default App
