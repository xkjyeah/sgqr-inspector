import React, { useEffect, useRef, Fragment, useCallback, useState } from 'react'
import './App.css'
import * as qrcode from 'qrcode'
import { maxBy, range } from 'lodash'

function GenerateQRToy(props: { value: string, onChange: (s: string) => void }) {
  const { value, onChange } = props
  const [errorCorrectionLevel, setErrorCorrectionLevel] = React.useState<'L' | 'M' | 'Q' | 'H'>('M')
  const [maskPattern, setMaskPattern] = React.useState<qrcode.QRCodeMaskPattern | undefined>(undefined)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [qrcodeDataURL, setQRCodeDataURL] = React.useState<string>('')

  const [computedCode, setComputedCode] = React.useState<qrcode.QRCode | null>(null)

  useEffect(() => {
    if (!value) {
      setQRCodeDataURL('')
      setComputedCode(null)
      return
    }
    if (canvasRef.current) {
      const canvasElem = canvasRef.current
      const computedCode = qrcode.create(value, { errorCorrectionLevel, maskPattern })

      setComputedCode(computedCode)

      qrcode.toCanvas(canvasElem, value, {
        errorCorrectionLevel: errorCorrectionLevel,
        width: 1000,
        color: { dark: '#000000' },
        maskPattern,

      })
        .then(() => {
          setQRCodeDataURL(canvasElem.toDataURL())
        })
    }
  }, [value, errorCorrectionLevel, maskPattern])

  return (<>
    <h4>Data</h4>
    <p>
      <textarea id="data" value={value} onChange={(e) => onChange(e.target.value)} style={{ display: 'block', maxWidth: '500px', width: '100%' }} />
    </p>
    <h4>Error correction level</h4>
    <p>
      <input type="radio" id="error-correction-level-l" checked={errorCorrectionLevel === 'L'}
        onChange={() => setErrorCorrectionLevel('L')} />
      <label htmlFor="error-correction-level-l">Low</label>

      <input type="radio" id="error-correction-level-m" checked={errorCorrectionLevel === 'M'}
        onChange={() => setErrorCorrectionLevel('M')} />
      <label htmlFor="error-correction-level-m">Medium</label>

      <input type="radio" id="error-correction-level-q" checked={errorCorrectionLevel === 'Q'}
        onChange={() => setErrorCorrectionLevel('Q')} />
      <label htmlFor="error-correction-level-q">Quartile</label>

      <input type="radio" id="error-correction-level-h" checked={errorCorrectionLevel === 'H'}
        onChange={() => setErrorCorrectionLevel('H')} />
      <label htmlFor="error-correction-level-h">High</label>
    </p>

    <h4>Mask pattern</h4>
    <p>
      <Fragment>
        <input type="radio" id={`mask-pattern-auto`} checked={maskPattern === undefined}
          onChange={() => setMaskPattern(undefined)} />
        <label htmlFor={`mask-pattern-auto`}>Auto</label>
      </Fragment>
      {
        range(0, 8).map(i =>
          <Fragment key={i}>
            <input type="radio" id={`mask-pattern-${i}`} checked={maskPattern === i}
              onChange={() => setMaskPattern(i as any)} />
            <label htmlFor={`mask-pattern-${i}`}>{i}</label>
          </Fragment>
        )
      }
    </p>
    <canvas width="1000" height="1000" ref={canvasRef} style={{ display: 'none' }}></canvas>
    {qrcodeDataURL && <img src={qrcodeDataURL} className="generated-QR" style={{ width: '100%', maxWidth: '500px', height: 'auto' }} />}
    {computedCode && <table style={{ margin: '0 auto' }}>
      <tbody>
        <tr>
          <th style={{ width: '200px', textAlign: 'center' }}>Version (size)</th>
          <td style={{ width: '200px', textAlign: 'center' }}>{computedCode.version}</td>
        </tr>
        <tr>
          <th style={{ textAlign: 'center' }}>Mask pattern</th>
          <td style={{ textAlign: 'center' }}>{computedCode.maskPattern}</td>
        </tr>
        <tr>
          <th style={{ textAlign: 'center' }}>Error correction level</th>
          <td style={{ textAlign: 'center' }}>{['Medium', 'Low', 'High', 'Quartile'][(computedCode.errorCorrectionLevel.bit)]}</td>
        </tr>
      </tbody></table>}
    {computedCode && <CompareQRsToy computedCode={computedCode} value={value} onImage={setQRCodeDataURL} />}
  </>)
}

function randomString(alphabet: string, length: number): string {
  let s = ''

  for (let i = 0; i < length; i++) {
    s += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
  }
  return s
}

const NUMERIC: string = '0123456789'
const ALPHANUMERIC: string = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'

function replaceWithRandomData(segments: qrcode.GeneratedQRCodeSegment[], start: number, end: number): qrcode.QRCodeSegment[] {
  let currentSegmentIndex = 0
  let currentOffset = 0
  let newSegments: qrcode.QRCodeSegment[] = []

  while (currentSegmentIndex < segments.length) {
    const currentSegment = segments[currentSegmentIndex]

    if (currentSegment.mode.id === 'Numeric' || currentSegment.mode.id === 'Alphanumeric') {
      const length = currentSegment.data.length
      const lowerOverlap = Math.min(length, Math.max(0, start - currentOffset))
      const upperOverlap = Math.min(length, Math.max(0, end - currentOffset))

      const newSegment: qrcode.QRCodeSegment = {
        mode: currentSegment.mode.id === 'Numeric' ? 'numeric' : 'alphanumeric',
        data: currentSegment.data.slice(0, lowerOverlap) +
          randomString(currentSegment.mode.id === "Numeric" ? NUMERIC : ALPHANUMERIC, upperOverlap - lowerOverlap) +
          currentSegment.data.slice(upperOverlap, length),
      }
      newSegments.push(newSegment)

      currentOffset += length
      currentSegmentIndex += 1
    } else if (currentSegment.mode.id === 'Byte') {
      const length = currentSegment.data.length
      const lowerOverlap = Math.min(length, Math.max(0, start - currentOffset))
      const upperOverlap = Math.min(length, Math.max(0, end - currentOffset))

      const dataAsArray: Uint8Array = currentSegment.data as Uint8Array
      const newSegment: qrcode.QRCodeSegment = {
        mode: 'byte',
        data: new Uint8Array(Array.from(dataAsArray.slice(0, lowerOverlap))
          .concat(
            range(0, upperOverlap - lowerOverlap).map(() => Math.floor(Math.random() * 256))
          ).concat(
            Array.from(dataAsArray.slice(upperOverlap, length))
          )),
      }
      newSegments.push(newSegment)

      currentOffset += length
      currentSegmentIndex += 1
    } else {
      throw new Error("Kanji not supported here")
    }
  }

  return newSegments
}


function CompareQRsToy(props: { value: string, computedCode: qrcode.QRCode, onImage: (dataUrl: string) => void }) {
  const { value } = props;
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const SAMPLES = 16;
  const canvasRefs = useRef<HTMLCanvasElement[]>([])
  const { computedCode, onImage } = props
  const animation = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  const nextSelect = useCallback(() => {
    const ta = textAreaRef.current!

    if (!ta.value) {
      return
    }

    const s1 = (ta.selectionStart + 1) % ta.value.length
    const s2 = s1 + 1

    ta.setSelectionRange(s1, s2)
    ta.focus()
  }, [])

  const startStopAnimation = useCallback(() => {
    if (animation.current !== null) {
      clearInterval(animation.current)
      animation.current = null
    }

    if (isAnimating) {
      setIsAnimating(false)
    } else {
      setIsAnimating(true)
      animation.current = setInterval(() => {
        nextSelect()
      }, 500)
    }
  }, [isAnimating])

  const stopAnimation = useCallback(() => {
    if (animation.current !== null) {
      clearInterval(animation.current)
      animation.current = null
    }

    if (isAnimating) {
      setIsAnimating(false)
    }
  }, [isAnimating])

  const handleSelect = useCallback(() => {
    const ta = textAreaRef.current!
    const lower = Math.min(ta.selectionStart, ta.selectionEnd)
    const upper = Math.max(ta.selectionStart, ta.selectionEnd)
    const preSelected = ta.value.slice(0, lower)
    const selected = ta.value.slice(lower, upper)

    // What's the byte offset? Depends on the UTF-8 encoding!
    const lowerByteIndex = new TextEncoder().encode(preSelected).length
    const upperByteIndex = lowerByteIndex + new TextEncoder().encode(selected).length

    // Make 8 copies of random data
    const promises = range(0, SAMPLES).map((i) => {
      const newSegments = i === 0 ? replaceWithRandomData(
        computedCode.segments,
        0,
        0,
      ) : replaceWithRandomData(
        computedCode.segments,
        lowerByteIndex,
        upperByteIndex,
      )

      console.log(newSegments)

      return qrcode.toCanvas(canvasRefs.current[i], newSegments, {
        scale: 5,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        // These must be maintained!
        maskPattern: computedCode.maskPattern,
        version: computedCode.version,
        errorCorrectionLevel: (['medium', 'low', 'high', 'quartile'] as qrcode.QRCodeErrorCorrectionLevel[])[(computedCode.errorCorrectionLevel.bit)],
      })
    })

    // Compare where they differ
    Promise.all(promises).then(() => {
      const imagesData = range(0, SAMPLES).map(i => {
        const width = canvasRefs.current[i].width
        const height = canvasRefs.current[i].height
        const context = canvasRefs.current[i].getContext('2d')!

        return context.getImageData(0, 0, width, height)
      })

      range(1, SAMPLES).forEach(i => {
        for (let j = 0; j < imagesData[i].data.length; j++) {
          imagesData[i].data[j] = imagesData[0].data[j] ^ imagesData[i].data[j]
        }
      })

      const c0 = canvasRefs.current[0].getContext('2d')!

      const c0Orig = imagesData[0]

      for (let j = 0; j < imagesData[0].data.length; j += 4) {
        const isSignificant = maxBy(range(1, SAMPLES).map(i => imagesData[i].data[j + 0]))
        const overlay = [255, 0, 0]
        const opacity = isSignificant ? 0.5 : 0

        c0Orig.data[j + 0] = c0Orig.data[j + 0] * (1 - opacity) + overlay[0] * opacity
        c0Orig.data[j + 1] = c0Orig.data[j + 1] * (1 - opacity) + overlay[1] * opacity
        c0Orig.data[j + 2] = c0Orig.data[j + 2] * (1 - opacity) + overlay[2] * opacity
        // c0Orig.data[j + 3] = c0Orig.data[j + 3] * (1 - opacity) + overlay[3] * opacity
      }

      c0.putImageData(c0Orig, 0, 0)
      onImage(canvasRefs.current[0].toDataURL())
    })
  }, [computedCode, onImage])

  return <>
    Select text below to see where it's stored in the QR code (along with its error-correction information)
    {range(0, SAMPLES).map((i) => <canvas key={i} style={{ width: '100px', height: '100px', display: 'none' }} ref={(e) => canvasRefs.current[i] = e!} />)}
    <textarea id="data" value={value} readOnly
      style={{ display: 'block', maxWidth: '500px', width: '100%' }}
      onSelect={handleSelect}
      onBlur={stopAnimation}
      ref={textAreaRef} />
    Or
    <button onClick={startStopAnimation} disabled={!value}>{isAnimating ? 'Stop animation' : 'Start animation'}</button>
  </>
}

function LearnQRCodes() {
  const [value, setValue] = React.useState('')

  return (
    <div style={{ width: '550px', margin: '0 auto', textAlign: 'left' }}>
      <p>
        QR codes are some pretty cool stuff. You can corrupt parts of them (e.g. pasting your
        logo in the middle of them) and the QR reader will still work!
      </p>
      <p>
        On this page, you can play with QR code generation to learn about them.
      </p>
      <h2>Generate QR code with different parameters</h2>
      <GenerateQRToy value={value} onChange={setValue} />
    </div>
  )
}


export default LearnQRCodes
