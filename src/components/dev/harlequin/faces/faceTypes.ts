import type { usePasscodeAuth } from '../usePasscodeAuth';
import type { useSpinToOpen } from '../useSpinToOpen';

/**
 * Props every HARLEQUIN face receives from `HarlequinPortalCard`. The shell owns
 * the shared passcode + spin state and passes them down; each face owns its own
 * wrap element, pointer handlers (the angle math is shape-specific) and renders
 * its lockup's exact visual layers + passcode panel.
 */
export interface FaceProps {
  passcode: ReturnType<typeof usePasscodeAuth>;
  spin: ReturnType<typeof useSpinToOpen>;
  /** Passcode panel is visible (spin completed). */
  revealed: boolean;
  /** Called by a face on mouseleave when not opened (resets spin) or opened (resets portal). */
  onLeave: () => void;
  /** Reveal the passcode panel directly (keyboard / fallback triggers). */
  onReveal: () => void;
}
