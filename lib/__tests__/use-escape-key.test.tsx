/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react'
import { useEscapeKey } from '../use-escape-key'

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
}

describe('useEscapeKey (LIFO stacking)', () => {
  it('closes only the topmost overlay, then the next', () => {
    const drawer = jest.fn()
    const modal = jest.fn()

    const drawerHook = renderHook(() => useEscapeKey(drawer))
    const modalHook = renderHook(() => useEscapeKey(modal))

    // Escape closes the most-recently-opened overlay (modal), not the drawer.
    pressEscape()
    expect(modal).toHaveBeenCalledTimes(1)
    expect(drawer).not.toHaveBeenCalled()

    // Modal closes → next Escape closes the drawer.
    modalHook.unmount()
    pressEscape()
    expect(drawer).toHaveBeenCalledTimes(1)

    drawerHook.unmount()
    pressEscape()
    expect(drawer).toHaveBeenCalledTimes(1) // no listener left
  })
})
