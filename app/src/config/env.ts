
// This file loads environment variables and provides type safety

// For React Native/Expo, we need to use a different approach
// Expo uses a special way to load environment variables

const RAPID_API_KEY = process.env.RAPID_API_KEY || '';

if (!RAPID_API_KEY) {
  console.warn('⚠️ RAPID_API_KEY is not set in environment variables!');
}

export const config = {
  RAPID_API_KEY,
} as const;

export default config;