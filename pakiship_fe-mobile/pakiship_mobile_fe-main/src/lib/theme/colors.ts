export const colors = {
  primary: '#39B5A8',
  primaryLight: '#9EE0D3',
  primaryFaint: '#F1FAF8',
  dark: '#1A1A2E',
  background: '#F7FDFB',
  white: '#FFFFFF',
  gray: {
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
  },
  border: '#E6F5F2',
} as const;

export type Colors = typeof colors;
