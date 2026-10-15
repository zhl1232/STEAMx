import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PhysicsLab from './page'
describe('circuit lab interactions', () => {
  it('switches examples and changes source voltage', () => {
    render(<PhysicsLab />)
    expect(screen.getByTestId('source-current')).toHaveTextContent('0.06 A')
    fireEvent.change(screen.getByLabelText('电压'), { target: { value: '12' } })
    expect(screen.getByTestId('source-current')).toHaveTextContent('0.12 A')
    fireEvent.click(screen.getByText('串联'))
    expect(screen.getByTestId('source-current')).toHaveTextContent('0.03 A')
    fireEvent.click(screen.getByText('并联'))
    expect(screen.getByTestId('source-current')).toHaveTextContent('0.12 A')
    fireEvent.click(screen.getByText('开关示例'))
    expect(screen.getByTestId('source-current')).toHaveTextContent('0 A')
    fireEvent.click(screen.getByLabelText('移动开关 3'))
    fireEvent.click(screen.getByText('闭合开关'))
    expect(screen.getByTestId('source-current')).toHaveTextContent('0.06 A')
  })
  it('connects, disconnects, detects short and resets', () => {
    render(<PhysicsLab />)
    const a = screen.getByLabelText('电池 1 A端点'), b = screen.getByLabelText('电池 1 B端点')
    fireEvent.click(a); fireEvent.keyDown(a, { key: 'Escape' }); expect(a).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(a); fireEvent.click(b); expect(screen.getByTestId('circuit-status')).toHaveTextContent('短路')
    fireEvent.click(a); fireEvent.click(b); expect(screen.getByTestId('source-current')).toHaveTextContent('0.06 A')
    fireEvent.click(screen.getByLabelText('断开导线 1')); expect(screen.getByTestId('circuit-status')).toHaveTextContent('断路')
    fireEvent.click(screen.getByText('重置实验')); expect(screen.getByTestId('source-current')).toHaveTextContent('0.06 A')
  })
  it('adds and deletes components and moves by keyboard', () => {
    render(<PhysicsLab />)
    expect(screen.getByText('添加电池')).toBeDisabled()
    fireEvent.click(screen.getByText('添加电阻'))
    const move = screen.getByLabelText('移动电阻 3'), container = move.parentElement!
    const before = container.style.left
    fireEvent.keyDown(move, { key: 'ArrowRight' }); expect(container.style.left).not.toBe(before)
    fireEvent.change(screen.getByLabelText('电阻'), { target: { value: '200' } }); expect(move).toHaveTextContent('200 Ω')
    fireEvent.click(screen.getByText('删除选中元件')); expect(screen.queryByLabelText('移动电阻 3')).not.toBeInTheDocument()
  })
})
