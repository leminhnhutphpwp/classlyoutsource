import React from 'react';
import { MathfieldElement } from 'mathlive';

// Define the custom element props
type MathFieldProps = React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement> & {
  'virtual-keyboard-mode'?: 'manual' | 'onfocus' | 'off';
  ref?: React.RefObject<MathfieldElement | null>;
};

// Extend react/jsx-runtime for React 19+ (automatic runtime)
declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': MathFieldProps;
    }
  }
}

// Extend react for classic runtime or direct imports
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': MathFieldProps;
    }
  }
}

