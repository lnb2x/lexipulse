// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GlassDropdown } from '../src/components/common/GlassDropdown';

afterEach(cleanup);
const options = [{ value: 'all', label: 'Tất cả' }, { value: 'disabled', label: 'Không có', disabled: true }, { value: 'tense', label: 'Thì động từ' }, { value: 'word', label: 'Từ loại' }];

it('keeps focus on the combobox, skips disabled options, and commits with Enter', () => {
  const onChange = vi.fn();
  render(<GlassDropdown label="Chủ đề" value="all" options={options} onChange={onChange} />);
  const trigger = screen.getByRole('combobox');
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Thì động từ' }).id);
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledExactlyOnceWith('tense');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
});

it('supports Home, End, typeahead and Escape without changing the saved value', () => {
  const onChange = vi.fn();
  render(<GlassDropdown label="Chủ đề" value="all" options={options} onChange={onChange} />);
  const trigger = screen.getByRole('combobox');
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: 'End' });
  expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Từ loại' }).id);
  fireEvent.keyDown(trigger, { key: 'Home' });
  expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Tất cả' }).id);
  fireEvent.keyDown(trigger, { key: 't' });
  fireEvent.keyDown(trigger, { key: 'h' });
  expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Thì động từ' }).id);
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(onChange).not.toHaveBeenCalled();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('commits pointer selection and closes for outside clicks and Tab', () => {
  const onChange = vi.fn();
  render(<GlassDropdown label="Chủ đề" value="all" options={options} onChange={onChange} />);
  const trigger = screen.getByRole('combobox');
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('option', { name: 'Không có' }));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('option', { name: 'Từ loại' }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith('word');
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: 'Tab' });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('does not open a disabled or empty control', () => {
  const onChange = vi.fn();
  const { rerender } = render(<GlassDropdown disabled label="Chủ đề" value="all" options={options} onChange={onChange} />);
  fireEvent.click(screen.getByRole('combobox'));
  expect(screen.queryByRole('listbox')).toBeNull();
  rerender(<GlassDropdown label="Chủ đề" value="" options={[]} onChange={onChange} />);
  fireEvent.click(screen.getByRole('combobox'));
  expect(screen.queryByRole('listbox')).toBeNull();
});
