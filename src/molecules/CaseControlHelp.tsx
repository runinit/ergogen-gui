import { RefObject, useEffect, useId, useState } from 'react';
import styled from 'styled-components';
import { theme } from '../theme/theme';
import { settingHelp } from './CaseField';

const Hint = styled.div`
  position: fixed;
  z-index: ${theme.caseWizard.hintLayer};
  max-width: ${theme.caseWizard.hintWidth}px;
  padding: ${theme.caseWizard.gap};
  background: ${theme.colors.backgroundLighter};
  color: ${theme.colors.text};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.caseWizard.radius};
  pointer-events: none;
  font-size: ${theme.fontSizes.sm};
`;
// Delegation also covers controls added by the advanced forms and feature editor.
export default function CaseControlHelp({
  root,
}: {
  root: RefObject<HTMLElement | null>;
}) {
  const id = useId();
  const [hint, setHint] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    let described: HTMLElement | null = null;
    const hide = () => {
      if (described?.getAttribute('aria-describedby') === id) {
        described.removeAttribute('aria-describedby');
      }
      described = null;
      setHint(null);
    };
    const show = (event: Event) => {
      const target = (event.target as Element)?.closest<HTMLElement>(
        'button,input,select,summary'
      );
      if (target === described) {
        return;
      }
      if (
        !target ||
        target.getAttribute('aria-label')?.startsWith('Help:') ||
        target.hasAttribute('aria-describedby')
      ) {
        hide();
        return;
      }
      const label =
        target.getAttribute('aria-label') ||
        (target as HTMLInputElement).labels?.[0]?.textContent?.trim() ||
        target.textContent?.trim() ||
        'Preview control';
      if (!label) {
        hide();
        return;
      }
      const box = target.getBoundingClientRect();
      hide();
      described = target;
      target.setAttribute('aria-describedby', id);
      setHint({
        text: target.getAttribute('title') || settingHelp(label),
        x: Math.max(
          theme.caseWizard.hintMargin,
          Math.min(
            box.left,
            window.innerWidth -
              theme.caseWizard.hintWidth -
              theme.caseWizard.hintMargin * 2
          )
        ),
        y:
          box.bottom + theme.caseWizard.hintHeight > window.innerHeight
            ? Math.max(
                theme.caseWizard.hintMargin,
                box.top - theme.caseWizard.hintHeight
              )
            : box.bottom + theme.caseWizard.hintGap,
      });
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hide();
      }
    };
    element.addEventListener('focusin', show);
    element.addEventListener('pointerover', show);
    element.addEventListener('pointerdown', show);
    element.addEventListener('focusout', hide);
    element.addEventListener('pointerout', hide);
    element.addEventListener('keydown', escape);
    return () => {
      hide();
      element.removeEventListener('focusin', show);
      element.removeEventListener('pointerover', show);
      element.removeEventListener('pointerdown', show);
      element.removeEventListener('focusout', hide);
      element.removeEventListener('pointerout', hide);
      element.removeEventListener('keydown', escape);
    };
  }, [root, id]);
  return hint ? (
    <Hint role="tooltip" id={id} style={{ left: hint.x, top: hint.y }}>
      {hint.text}
    </Hint>
  ) : null;
}
