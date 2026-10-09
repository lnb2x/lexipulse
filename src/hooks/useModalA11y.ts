import { useEffect, useRef } from 'react';
import { stopPronunciation } from '../services/audio';

export interface UseModalA11yOptions {
  isOpen: boolean;
  onClose: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

const modalStack: HTMLElement[] = [];
let previousOverflow = '';

/**
 * WAI-ARIA compliant modal accessibility hook:
 * - Traps Tab navigation inside modal dialog
 * - Closes modal on Escape key
 * - Remembers active element when opening and restores focus upon closing
 * - Focuses initial element or first interactive element
 */
export function useModalA11y({ isOpen, onClose, initialFocusRef }: UseModalA11yOptions) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // Immediately stop any ongoing audio playback and signal modal open
    stopPronunciation();
    window.dispatchEvent(new CustomEvent('lexipulse:modal-opened'));

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    if (!modal) return;
    if (!modalStack.length) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    modalStack.push(modal);

    const focusTimer = setTimeout(() => {
      if (modalStack.at(-1) !== modal || modal.closest('[inert]')) return;
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (modalStack.at(-1) !== modal || modal.closest('[inert]')) return;
      if (e.key === 'Escape') {
        if (document.activeElement?.matches('[role="combobox"][aria-expanded="true"]')) return;
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !modal.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !modal.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown, true);
      const index = modalStack.indexOf(modal);
      if (index >= 0) modalStack.splice(index, 1);
      if (!modalStack.length) document.body.style.overflow = previousOverflow;
      const focusedDialog = document.activeElement?.closest('[role="dialog"]');
      if ((!focusedDialog || focusedDialog === modal) && previouslyFocusedElementRef.current?.isConnected) {
        previouslyFocusedElementRef.current.focus({ preventScroll: true });
      }
    };
  }, [isOpen, initialFocusRef]);

  return modalRef;
}
