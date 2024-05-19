import './DragSortable.css'
import React, { useState, useEffect } from 'react'
import { range } from 'lodash'

// Given a pageY, find the offsetY (ignore all offsets up to to's offsetParent)
const getOffsetYRelativeTo = (pageY: number, to: HTMLElement | null): number => {
  let offsetElement: Element | null = to?.offsetParent as (Element | null)
  while (offsetElement) {
    pageY -= (offsetElement as HTMLElement).offsetTop
    offsetElement = (offsetElement as HTMLElement).offsetParent
  }
  return pageY
}

const findIndexToReplace = (offsetY: number, elementOffsets: number[]): number | undefined => {
  return range(0, elementOffsets.length)
    .find((index) => {
      const start = elementOffsets[index]
      const end = elementOffsets[index + 1] ?? 1e6 // Some phenomenally large number

      if (offsetY >= start && offsetY <= end) {
        return true
      } else if (offsetY <= start) {
        return true
      }
    })
}

type DragSortableListProps<R> = {
  list: R[],
  children: (props: { item: R, index: number }) => React.ReactNode,
  onSwap: (a: number, b: number) => void,
}

const initializeDragSortData = (props: { draggedIndex: number, clickPageY: number, parentElem: HTMLElement, childrenElem: HTMLDivElement[], target: EventTarget }): {
  handleDragMove: (pageY: number) => void,
  handleDragEnd: (pageY: number) => ({ draggedIndex: number, insertBefore: number }),
} => {
  const { draggedIndex, parentElem, childrenElem } = props
  const offsetTops = childrenElem.map(c => c.offsetTop)
  const target = (props.target as HTMLElement)

  target.classList.add('drag-sortable-dragged')
  parentElem.classList.add('drag-sortable-dragging')

  const clickY = props.clickPageY
  const height = (offsetTops[draggedIndex + 1] ?? (parentElem.offsetTop + parentElem.offsetHeight)) - offsetTops[draggedIndex]
  const oldLeft = target.style.left
  const oldTop = target.style.top
  const oldUserSelect = target.style.userSelect

  const handleDragMove = (pageY: number) => {
    // PART 1: Update position of element being dragged
    const diffY = pageY - clickY
    console.log(diffY)

    // Compute the adjustment for the target
    target.style.top = diffY + "px"
    target.style.userSelect = "none"

    // PART 2: Displace the existing elements
    // Need to figure out where the mouseclick is relative to nearest offsetParent
    const offsetY = getOffsetYRelativeTo(pageY, parentElem!.offsetParent as HTMLElement | null)

    // Find which element is being replaced
    const indexToBeReplaced = findIndexToReplace(offsetY, offsetTops)

    if (indexToBeReplaced === undefined) {
      throw new Error(`indexToBeReplaced is somehow null`)
    } else {
      // console.log(indexToBeReplaced)
    }

    for (let i of range(0, offsetTops.length)) {
      if (i === draggedIndex) { // Don't mess with the mouse dragging
        continue
      } else if (i < draggedIndex && i < indexToBeReplaced) {
        // unset the top -- use auto positioning
        childrenElem[i].style.top = '0'
      } else if (i > draggedIndex && i > indexToBeReplaced) {
        // unset the top -- use auto positioning
        childrenElem[i].style.top = '0'
      } else if (draggedIndex === indexToBeReplaced) {
        childrenElem[i].style.top = '0'
      } else if (draggedIndex > indexToBeReplaced) { // Moving up!
        childrenElem[i].style.top = `${height}px`
      } else if (draggedIndex < indexToBeReplaced) { // Moving up!
        childrenElem[i].style.top = `-${height}px`
      }
    }
    console.log(target.style.top)
  }
  const handleDragEnd = (pageY: number): { draggedIndex: number, insertBefore: number } => {
    // Reset positions!
    for (let i of range(0, offsetTops.length)) {
      childrenElem[i].style.top = '0'
    }
    target.classList.remove('drag-sortable-dragged')
    parentElem.classList.remove('drag-sortable-dragging')

    target.style.top = oldTop
    target.style.userSelect = oldUserSelect

    // Emit event!
    const offsetY = getOffsetYRelativeTo(pageY, parentElem.offsetParent as HTMLElement | null)
    const indexToBeReplaced = findIndexToReplace(offsetY, offsetTops)

    // We're not calling this from anywhere...
    return {
      draggedIndex,
      insertBefore: (indexToBeReplaced! > draggedIndex) ? indexToBeReplaced! + 1 : indexToBeReplaced!
    }
  }
  return { handleDragEnd, handleDragMove }
}

export function DragSortableList<R>(props: DragSortableListProps<R>) {
  const parentElem = React.useRef<HTMLDivElement | null>(null)
  const childrenElem = React.useRef<HTMLDivElement[]>([])
  const { list } = props

  // Truncate any excess elements
  useEffect(() => {
    childrenElem.current.length = list.length
  }, [list])


  const handleMouseDown = (draggedIndex: number) => (e: React.MouseEvent) => {
    e.preventDefault()

    const { handleDragMove, handleDragEnd } = initializeDragSortData({
      draggedIndex,
      parentElem: parentElem.current!,
      childrenElem: childrenElem.current!,
      clickPageY: e.pageY,
      target: e.currentTarget,
    })

    // Mouse events!
    const moveListener = (e: MouseEvent) => {
      e.preventDefault()
      handleDragMove(e.pageY)
    }
    const upListener = (e: MouseEvent) => {
      window.removeEventListener('mousemove', moveListener)
      window.removeEventListener('mouseup', upListener)

      const { draggedIndex, insertBefore } = handleDragEnd(e.pageY)

      props.onSwap(draggedIndex, insertBefore)
    }

    window.addEventListener('mousemove', moveListener)
    window.addEventListener('mouseup', upListener)
  }


  const handleTouchStart = (draggedIndex: number) => (e: React.TouchEvent) => {
    if (e.touches.length > 1) {
      return
    }

    // If device supports touch, prevent emulated mouse events
    e.preventDefault()

    const { handleDragMove, handleDragEnd } = initializeDragSortData({
      draggedIndex,
      parentElem: parentElem.current!,
      childrenElem: childrenElem.current!,
      clickPageY: e.touches[0].pageY,
      target: e.currentTarget,
    })

    // Mouse events!
    const touchMoveListener = (e: TouchEvent) => {
      e.preventDefault()
      handleDragMove(e.touches[0].pageY)
    }
    const touchEndListener = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        return
      }

      window.removeEventListener('touchmove', touchMoveListener)
      window.removeEventListener('touchend', touchEndListener)

      const { draggedIndex, insertBefore } = handleDragEnd(e.changedTouches[0].pageY)

      props.onSwap(draggedIndex, insertBefore)
    }

    window.addEventListener('touchmove', touchMoveListener)
    window.addEventListener('touchend', touchEndListener)
  }

  return <div ref={parentElem} className="drag-sortable">
    {props.list.map((r, i) => <div
      key={i}
      ref={(e) => childrenElem.current[i] = e!}
      onMouseDown={handleMouseDown(i)}
      onTouchStart={handleTouchStart(i)}
      className="drag-sortable-element"
    >{props.children({
      item: r, index: i,
    })}</div>)}
  </div>
}
