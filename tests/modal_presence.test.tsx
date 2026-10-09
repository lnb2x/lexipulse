// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModalPresence } from '../src/components/common/ModalPresence';
import { useModalA11y } from '../src/hooks/useModalA11y';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('hides closing content immediately and cancels removal when reopened', () => {
  const { rerender } = render(<ModalPresence open><div role="dialog">First</div></ModalPresence>);
  rerender(<ModalPresence open={false}>{null}</ModalPresence>);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('First').closest('[inert]')).not.toBeNull();
  act(() => vi.advanceTimersByTime(80));
  rerender(<ModalPresence open><div role="dialog">Second</div></ModalPresence>);
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByRole('dialog').textContent).toBe('Second');
  rerender(<ModalPresence open={false}>{null}</ModalPresence>);
  act(() => vi.advanceTimersByTime(160));
  expect(screen.queryByText('Second')).toBeNull();
});

function Dialog({ name, onClose }: { name: string; onClose: () => void }) {
  const ref = useModalA11y({ isOpen: true, onClose });
  return <div ref={ref} role="dialog"><button>{name}</button></div>;
}

it('keeps the scroll lock until the last dialog closes and Escape reaches only the top dialog', () => {
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'auto';
  const lowerClose = vi.fn(); const upperClose = vi.fn();
  const { rerender, unmount } = render(<><Dialog name="Lower" onClose={lowerClose} /><Dialog name="Upper" onClose={upperClose} /></>);
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(lowerClose).not.toHaveBeenCalled();
  expect(upperClose).toHaveBeenCalledOnce();
  rerender(<Dialog name="Lower" onClose={lowerClose} />);
  expect(document.body.style.overflow).toBe('hidden');
  unmount();
  expect(document.body.style.overflow).toBe('auto');
  document.body.style.overflow = originalOverflow;
});

it('updates the close callback without moving focus or restarting the modal', () => {
  const oldClose = vi.fn(); const newClose = vi.fn();
  const { rerender } = render(<Dialog name="Edit" onClose={oldClose} />);
  act(() => vi.advanceTimersByTime(50));
  const button = screen.getByRole('button');
  const focus = vi.spyOn(button, 'focus');
  rerender(<Dialog name="Edit" onClose={newClose} />);
  act(() => vi.advanceTimersByTime(100));
  expect(focus).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(oldClose).not.toHaveBeenCalled();
  expect(newClose).toHaveBeenCalledOnce();
});
