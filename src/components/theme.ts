import { useColorScheme } from 'react-native';

const light = {
  background: '#f6f7f9',
  surface: '#ffffff',
  text: '#14171c',
  muted: '#5b6472',
  border: '#d9dde3',
  primary: '#1f6feb',
  onPrimary: '#ffffff',
  danger: '#c62828',
  green: '#1b7f3b',
  yellow: '#a86b00',
  red: '#c62828',
  fieldLine: '#9aa3ae',
  ghost: '#9aa3ae',
};

export type Theme = typeof light;

const dark: Theme = {
  background: '#0e1116',
  surface: '#171b22',
  text: '#e8ebf0',
  muted: '#9aa3ae',
  border: '#2b313b',
  primary: '#4c8dff',
  onPrimary: '#ffffff',
  danger: '#ef5350',
  green: '#4caf50',
  yellow: '#f0b429',
  red: '#ef5350',
  fieldLine: '#5b6472',
  ghost: '#5b6472',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
