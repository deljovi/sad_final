/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#152A32',
    background: '#F1F7F6',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#DDF3EF',
    textSecondary: '#63777C',
    primary: '#087F73',
    primarySoft: '#E1F4F0',
    border: '#D8E7E4',
    success: '#16805D',
    danger: '#C94D48',
  },
  dark: {
    text: '#F0F8F6',
    background: '#0E191D',
    backgroundElement: '#17272C',
    backgroundSelected: '#1D3D3B',
    textSecondary: '#A8BCBD',
    primary: '#52C9B5',
    primarySoft: '#1B3B38',
    border: '#2A4144',
    success: '#62D6A4',
    danger: '#FF9385',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
