import { Platform } from 'react-native';

export const typography = {
  fontFamily: {
    regular: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
    bold: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 14,
    md: 16,
    lg: 20,
    xl: 32,
    xxl: 40,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
  lineHeight: {
    tight: 44,
    normal: 20,
  },
} as const;

export type Typography = typeof typography;
